import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { useSettings } from '../../context/SettingsContext';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isFreeMode } = useSettings();
  const [classroom, setClassroom] = useState(null);
  const [attendance, setAttendance] = useState({ records: [], absentChildren: [], summary: {} });
  const [reports, setReports] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [meals, setMeals] = useState([]);
  const [naps, setNaps] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 6 parallel calls — duplicate /attendance/today removed, /payments → /payments/summary
        const [classroomRes, attendanceRes, reportsRes, apptsRes, mealsRes, paymentsRes] = await Promise.all([
          api.get('/classrooms/my-classroom').catch(() => ({ data: { data: null } })),
          api.get('/attendance/today').catch(() => ({ data: { data: { records: [], absentChildren: [], summary: {} } } })),
          api.get('/reports').catch(() => ({ data: { data: [] } })),
          api.get('/appointments/upcoming').catch(() => ({ data: { data: [] } })),
          api.get('/meals').catch(() => ({ data: { data: [] } })),
          api.get('/payments/summary').catch(() => ({ data: { stats: {}, data: [] } }))
        ]);
        const attendanceData = attendanceRes.data?.data || { records: [], absentChildren: [], summary: {} };
        // getMyClassroom returns an array — take the first classroom
        const classroomRaw = classroomRes.data?.data;
        const classroomData = Array.isArray(classroomRaw) ? (classroomRaw[0] || null) : (classroomRaw || null);
        setClassroom(classroomData);
        setAttendance(attendanceData);
        setReports(reportsRes.data?.data || []);
        setAppointments(apptsRes.data?.data || []);
        setMeals(mealsRes.data?.data || []);
        // reuse the same attendance response for naps — no second round-trip needed
        setNaps(attendanceData.records || []);
        setPayments(paymentsRes.data?.data || []);
      } catch (err) {
        console.error('Teacher dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalStudents = classroom?.children?.length || 0;

  const unpaidChildrenIds = new Set(
    payments
      .filter(p => ['pending', 'overdue', 'unpaid'].includes(p.status?.toLowerCase()))
      .map(p => p.child?._id || (typeof p.child === 'string' ? p.child : null))
      .filter(Boolean)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {new Date().getHours() < 12 ? t('goodMorning') : t('goodAfternoon')}, {user?.fullName?.split(' ')[0]} 👋
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {classroom ? `${classroom.name} · ${classroom.ageGroup}` : t('unassigned')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t('totalChildren'), value: totalStudents, icon: 'bx-group', color: 'indigo' },
          { label: t('present'), value: attendance.summary?.present || 0, icon: 'bx-user-check', color: 'emerald' },
          { label: t('absent'), value: (attendance.summary?.absent || 0) + (attendance.absentChildren?.length || 0), icon: 'bx-user-x', color: 'rose' },
          { label: t('currentlyNapping'), value: naps.filter(n => n.napStart && !n.napEnd).length, icon: 'bx-moon', color: 'purple' }
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-glass p-3.5 sm:p-4">
            <i className={`bx ${s.icon} text-xl text-${s.color}-400`} />
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1.5 sm:mt-2">{s.value}</p>
            <p className="text-xs text-slate-500 truncate">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance */}
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i className="bx bx-calendar-check text-indigo-400" /> {t('attendanceDashboard')}
            </h3>
            <Link to="/dashboard/teacher/check-in-out" className="text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full hover:bg-indigo-500/20 transition-colors">
              {t('markAttendance')}
            </Link>
          </div>

          {classroom?.children?.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t('noStudentsFound')}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {classroom?.children?.map(child => {
                const record = attendance.records?.find(r => r.child?._id === child._id);
                const isUnpaid = !isFreeMode && unpaidChildrenIds.has(child._id);
                return (
                  <div key={child._id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-teal-900/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#0d1520] flex items-center justify-center text-xs font-bold text-slate-500">
                        {child.firstName?.charAt(0)}{child.lastName?.charAt(0)}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{child.firstName} {child.lastName}</p>
                        {isUnpaid && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                            Unpaid
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      record?.status === 'present' ? 'bg-emerald-500/10 text-emerald-400' :
                      record?.status === 'late' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {t(record?.status || 'absent')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <i className="bx bx-grid-alt text-indigo-400" /> {t('quickActions')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { labelKey: 'markAttendance', icon: 'bx-calendar-check', path: '/dashboard/teacher/check-in-out', color: 'indigo' },
                { labelKey: 'dailyReports', icon: 'bx-edit', path: '/dashboard/teacher/daily-report', color: 'emerald' },
                { labelKey: 'studentList', icon: 'bx-list-ul', path: '/dashboard/teacher/student-list', color: 'cyan' },
                { labelKey: 'communication', icon: 'bx-message-square', path: '/dashboard/teacher/messages', color: 'purple' }
              ].map(action => (
                <Link
                  key={action.labelKey}
                  to={action.path}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-[#0d1520] hover:bg-indigo-500/10 transition-all group"
                >
                  <i className={`bx ${action.icon} text-xl text-slate-400 group-hover:text-indigo-400 transition-colors`} />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-indigo-400 text-center">{t(action.labelKey)}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming Appointments */}
          {appointments.length > 0 && (
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                <i className="bx bx-calendar text-indigo-400" /> {t('upcomingAppointments')}
              </h3>
              {appointments.slice(0, 3).map(a => (
                <div key={a._id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-teal-900/30 last:border-0">
                  <i className="bx bx-time text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.title}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(a.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(a.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Today's Meals */}
          {meals.filter(m => m.date === new Date().toISOString().split('T')[0]).length > 0 && (
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                <i className="bx bx-restaurant text-amber-400" /> {t('mealsToday')}
              </h3>
              {meals.filter(m => m.date === new Date().toISOString().split('T')[0]).slice(0, 3).map(meal => (
                <div key={meal._id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-teal-900/30 last:border-0">
                  <i className="bx bx-bowl-hot text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{meal.name}</p>
                    <p className="text-xs text-slate-400">{meal.time} · {meal.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;

