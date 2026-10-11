import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';

const ReceptionDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [visitors, setVisitors]             = useState({ count: 0, checkedIn: 0, data: [] });
  const [appointments, setAppointments]     = useState([]);
  const [children, setChildren]             = useState([]);
  const [meals, setMeals]                   = useState([]);
  const [childAttendance, setChildAttendance] = useState({ records: [], absentChildren: [], summary: {} });
  const [nannyAttendance, setNannyAttendance] = useState([]);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [visitorsRes, apptsRes, childrenRes, mealsRes, childAttRes, nannyAttRes] = await Promise.all([
          api.get('/visitors/today').catch(() => ({ data: { data: [], checkedIn: 0 } })),
          api.get('/appointments/upcoming').catch(() => ({ data: { data: [] } })),
          api.get('/children').catch(() => ({ data: { data: [] } })),
          api.get('/meals').catch(() => ({ data: { data: [] } })),
          api.get('/attendance/today').catch(() => ({ data: { data: { records: [], absentChildren: [], summary: {} } } })),
          api.get('/teacher-attendance').catch(() => ({ data: { data: [] } }))
        ]);
        setVisitors(visitorsRes.data || { data: [], checkedIn: 0 });
        setAppointments(apptsRes.data?.data || []);
        setChildren(childrenRes.data?.data || []);
        setMeals(mealsRes.data?.data || []);
        setChildAttendance(childAttRes.data?.data || { records: [], absentChildren: [], summary: {} });
        const nData = nannyAttRes.data?.data;
        setNannyAttendance(Array.isArray(nData) ? nData : []);
      } catch (err) {
        console.error('Reception dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleVisitorCheckout = async (visitorId) => {
    try {
      await api.put(`/visitors/${visitorId}/checkout`);
      setVisitors(prev => ({
        ...prev,
        checkedIn: prev.checkedIn - 1,
        data: prev.data.map(v => v._id === visitorId ? { ...v, status: 'checked-out', checkOut: new Date() } : v)
      }));
    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  // ── Attendance summaries (mirrors AdminDashboard logic) ──────────────────
  const childRecords = childAttendance?.records || [];
  const childSummary = {
    present:    childAttendance?.summary?.present    ?? childRecords.filter(r => r.status === 'present').length,
    absent:     (childAttendance?.absentChildren?.length || 0) + childRecords.filter(r => r.status === 'absent').length,
    late:       childAttendance?.summary?.late       ?? childRecords.filter(r => r.status === 'late').length,
    permission: childAttendance?.summary?.permission ?? childRecords.filter(r => ['permission', 'authorized-absence', 'excused'].includes(r.status)).length,
    sick:       childAttendance?.summary?.sick       ?? childRecords.filter(r => r.status === 'sick').length,
  };
  const totalChildrenEnrolled = children.length || (childSummary.present + childSummary.absent + childSummary.permission + childSummary.late + childSummary.sick) || 0;
  const childAttendanceRate   = totalChildrenEnrolled > 0 ? Math.round((childSummary.present / totalChildrenEnrolled) * 100) : 0;

  const totalNannies    = nannyAttendance.length;
  const nannySummary    = {
    present: nannyAttendance.filter(n => n.status === 'present').length,
    late:    nannyAttendance.filter(n => n.status === 'late').length,
    absent:  nannyAttendance.filter(n => n.status === 'absent').length,
    onLeave: nannyAttendance.filter(n => n.status === 'on-leave').length,
  };
  const nannyPresenceRate = totalNannies > 0 ? Math.round((nannySummary.present / totalNannies) * 100) : 0;

  const previewChildren = useMemo(() => {
    const list = [];
    childRecords.forEach(r => {
      if (r.child) {
        list.push({
          id: r.child._id,
          name: `${r.child.firstName || ''} ${r.child.lastName || ''}`.trim(),
          status: r.status,
        });
      }
    });
    (childAttendance?.absentChildren || []).forEach(c => {
      list.push({
        id: c._id,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        status: 'absent',
      });
    });
    return list.slice(0, 5);
  }, [childAttendance]);

  const previewNannies = useMemo(() => (nannyAttendance || []).slice(0, 5), [nannyAttendance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Welcome ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {t('receptionDesk')} 👋
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t('totalFamilies'),         value: visitors.count,      icon: 'bx-user-check', color: 'indigo' },
          { label: t('present'),               value: visitors.checkedIn,  icon: 'bx-building',   color: 'emerald' },
          { label: t('upcomingAppointments'),  value: appointments.length, icon: 'bx-calendar',   color: 'cyan' },
          { label: t('totalChildren'),         value: children.length,     icon: 'bx-child',      color: 'purple' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-glass p-3.5 sm:p-4">
            <i className={`bx ${s.icon} text-xl text-${s.color}-400`} />
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1.5 sm:mt-2">{s.value}</p>
            <p className="text-xs text-slate-500 truncate">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Today's Attendance Overview (matches Admin layout) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
              <i className="bx bx-calendar-check text-xl" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {t('todaysAttendance', "Today's Attendance")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('viewOnlyAttendance', 'View Only')} · {t('attendancePortal', 'Attendance Portal')}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/reception/child-attendance"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800/40 text-xs font-semibold hover:bg-teal-100 transition-colors"
          >
            <span>{t('attendanceDashboard', 'Attendance Center')}</span>
            <i className="bx bx-right-arrow-alt text-base" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Children Attendance Card ─────────────────────── */}
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-teal-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <i className="bx bx-face text-2xl" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-base">
                    {t('childrenAttendance', "Children's Attendance")}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {childSummary.present} / {totalChildrenEnrolled} {t('present', 'Present')} ({childAttendanceRate}%)
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard/reception/child-attendance"
                className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
              >
                {t('viewDetails', 'View Full Roster')} <i className="bx bx-chevron-right" />
              </Link>
            </div>

            {/* Stat counts */}
            <div className="grid grid-cols-5 gap-2 my-4">
              {[
                { label: t('present', 'Present'),    value: childSummary.present,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: t('absent', 'Absent'),      value: childSummary.absent,     color: 'text-rose-500',    bg: 'bg-rose-500/10'    },
                { label: t('late', 'Late'),          value: childSummary.late,       color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
                { label: t('permission', 'Perm'),    value: childSummary.permission, color: 'text-cyan-500',    bg: 'bg-cyan-500/10'    },
                { label: t('sick', 'Sick'),          value: childSummary.sick,       color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-2 text-center`}>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Preview list */}
            <div className="space-y-2 border-t border-slate-100 dark:border-teal-900/30 pt-3">
              {previewChildren.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">
                  {t('noStudentsFound', 'No children attendance records today.')}
                </p>
              ) : (
                previewChildren.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs py-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      c.status === 'present'   ? 'bg-emerald-500/10 text-emerald-500' :
                      c.status === 'absent'    ? 'bg-rose-500/10    text-rose-500'    :
                      c.status === 'late'      ? 'bg-amber-500/10   text-amber-500'   :
                      (c.status === 'permission' || c.status === 'authorized-absence' || c.status === 'excused')
                                               ? 'bg-cyan-500/10    text-cyan-500'    :
                      c.status === 'sick'      ? 'bg-purple-500/10  text-purple-500'  :
                                                 'bg-slate-500/10   text-slate-400'
                    }`}>
                      {t(c.status || 'notMarked', c.status || 'Not Marked')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Nanny Attendance Card ────────────────────────── */}
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-teal-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                  <i className="bx bxs-graduation text-2xl" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-base">
                    {t('nannyAttendance', 'Nannies & Providers')}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {nannySummary.present} / {totalNannies} {t('present', 'Present')} ({nannyPresenceRate}%)
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard/reception/teacher-attendance"
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                {t('markAttendance', '+ Mark Attendance')} <i className="bx bx-chevron-right" />
              </Link>
            </div>

            {/* Stat counts */}
            <div className="grid grid-cols-4 gap-2 my-4">
              {[
                { label: t('present', 'Present'), value: nannySummary.present, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: t('late', 'Late'),       value: nannySummary.late,    color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
                { label: t('absent', 'Absent'),   value: nannySummary.absent,  color: 'text-rose-500',    bg: 'bg-rose-500/10'    },
                { label: t('onLeave', 'Leave'),   value: nannySummary.onLeave, color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-2 text-center`}>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Preview list */}
            <div className="space-y-2 border-t border-slate-100 dark:border-teal-900/30 pt-3">
              {previewNannies.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">
                  {t('noStaffFound', 'No nannies/providers found.')}
                </p>
              ) : (
                previewNannies.map(n => (
                  <div key={n.id} className="flex items-center justify-between text-xs py-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{n.fullName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      n.status === 'present'  ? 'bg-emerald-500/10 text-emerald-500' :
                      n.status === 'late'     ? 'bg-amber-500/10   text-amber-500'   :
                      n.status === 'absent'   ? 'bg-rose-500/10    text-rose-500'    :
                      n.status === 'on-leave' ? 'bg-purple-500/10  text-purple-500'  :
                                                'bg-slate-500/10   text-slate-400'
                    }`}>
                      {t(n.status || 'absent', n.status || 'Absent')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Upcoming Appointments ────────────────────────────── */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bx bx-calendar text-indigo-400" /> {t('upcomingAppointments')}
          </h3>
          <Link to="/dashboard/reception/parent-meetings" className="text-xs text-indigo-400 hover:underline">
            {t('viewAll')}
          </Link>
        </div>
        {appointments.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">{t('noUpcomingAppointments')}</p>
        ) : (
          <div className="space-y-3">
            {appointments.slice(0, 5).map(a => (
              <div key={a._id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#0d1520]">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <i className="bx bx-calendar-event text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{a.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(a.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(a.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-slate-400">{a.requestedBy?.fullName || 'N/A'}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                  a.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick Actions ────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
        <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <i className="bx bx-grid-alt text-indigo-400" /> {t('quickActions')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { labelKey: 'childAttendance',      icon: 'bx-log-in-circle',   path: '/dashboard/reception/child-attendance',   color: 'emerald' },
            { labelKey: 'providerAttendance',   icon: 'bx-calendar-check',  path: '/dashboard/reception/teacher-attendance', color: 'cyan'    },
            { labelKey: 'registerChild',        icon: 'bx-user-plus',       path: '/dashboard/reception/new-child-registry', color: 'indigo'  },
            { labelKey: 'newRegister',          icon: 'bx-user-circle',     path: '/dashboard/reception/register-parent',    color: 'purple'  },
            { labelKey: 'upcomingAppointments', icon: 'bx-calendar-plus',   path: '/dashboard/reception/parent-meetings',    color: 'cyan'    },
            { labelKey: 'pickupLog',            icon: 'bx-list-ol',         path: '/dashboard/reception/visitor-registry',   color: 'rose'    },
          ].map(action => (
            <Link
              key={action.labelKey}
              to={action.path}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-[#0d1520] hover:bg-indigo-500/10 transition-all group"
            >
              <i className={`bx ${action.icon} text-xl text-slate-400 group-hover:text-indigo-400 transition-colors`} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-indigo-400 text-center">
                {t(action.labelKey)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Today's Meals ────────────────────────────────────── */}
      {meals.filter(m => m.date === new Date().toISOString().split('T')[0]).length > 0 && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i className="bx bx-restaurant text-amber-400" /> {t('mealsToday')}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {meals.filter(m => m.date === new Date().toISOString().split('T')[0]).slice(0, 4).map(meal => (
              <div key={meal._id} className="bg-amber-500/10 rounded-xl p-3 text-center">
                <i className="bx bx-bowl-hot text-xl text-amber-400" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2 truncate">{meal.name}</p>
                <p className="text-xs text-slate-400 mt-1">{meal.time}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default ReceptionDashboard;
