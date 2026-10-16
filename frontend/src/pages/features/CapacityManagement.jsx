import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';

const CapacityManagement = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      // If the user is a teacher/nanny, return only their assigned classrooms
      if (user?.role === 'teacher') {
        const res = await api.get('/classrooms/my-classroom');
        // `data` is now an array of classrooms
        setClassrooms(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        const res = await api.get('/classrooms');
        setClassrooms(res.data.data);
      }
    } catch (err) {
      setError('Failed to load classroom data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const handleUpdateCapacity = async (classroomId, newCapacity) => {
    try {
      await api.put(`/classrooms/${classroomId}`, { capacity: newCapacity });
      setSuccess('Capacity updated successfully!');
      fetchClassrooms();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update capacity.');
    }
  };

  const canEdit = ['admin', 'reception'].includes(user?.role);

  const totalCapacity = classrooms.reduce((sum, c) => sum + (c.capacity || 0), 0);
  const totalEnrolled = classrooms.reduce((sum, c) => sum + (c.enrolledCount ?? c.children?.length ?? 0), 0);
  const overallPercentage = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('capacityManagementTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('capacityManagementSubtitle')}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <i className="bx bx-buildings text-2xl text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{classrooms.length}</p>
              <p className="text-xs text-slate-500">{t('totalClassrooms')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <i className="bx bx-group text-2xl text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{totalEnrolled} / {totalCapacity}</p>
              <p className="text-xs text-slate-500">{t('totalEnrollment')}</p>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#0d1520] rounded-full h-2">
            <div className={`h-2 rounded-full ${overallPercentage >= 90 ? 'bg-rose-500' : overallPercentage >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(overallPercentage, 100)}%` }} />
          </div>
        </div>
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <i className="bx bx-pie-chart text-2xl text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{overallPercentage}%</p>
              <p className="text-xs text-slate-500">{t('overallUtilization')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Classroom Capacity Details */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-buildings text-4xl" /><p className="text-sm mt-2">{t('noClassroomsFound')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]/50">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('classroom')}</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('ageGroupCol')}</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('capacityCol')}</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('enrolledCol')}</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('availableCol')}</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('utilizationCol')}</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('statusCol2')}</th>
                  {canEdit && <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{t('thActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {classrooms.map((classroom) => {
                  const enrolled = classroom.enrolledCount ?? classroom.children?.length ?? 0;
                  const available = classroom.capacity - enrolled;
                  const percentage = Math.round((enrolled / classroom.capacity) * 100);
                  const statusKey = percentage >= 100 ? 'statusFull' : percentage >= 80 ? 'statusHigh' : percentage >= 50 ? 'statusModerate' : 'statusLow';
                  const statusLabel = t(statusKey);
                  
                  return (
                    <tr key={classroom._id} className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: classroom.color || '#6366F1' }} />
                          <span className="font-semibold text-slate-800 dark:text-white">{classroom.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{classroom.ageGroup}</td>
                      <td className="px-5 py-4">
                        {canEdit ? (
                          <input
                            type="number"
                            min="1"
                            value={classroom.capacity}
                            onChange={(e) => handleUpdateCapacity(classroom._id, parseInt(e.target.value))}
                            className="w-20 border border-slate-200 dark:border-teal-900/40 rounded-lg px-2 py-1 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300">{classroom.capacity}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{enrolled}</td>
                      <td className="px-5 py-4">
                        <span className={`font-semibold ${available <= 0 ? 'text-rose-400' : available <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {available}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 dark:bg-[#0d1520] rounded-full h-2">
                            <div className={`h-2 rounded-full ${percentage >= 100 ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{percentage}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                          statusKey === 'statusFull' ? 'bg-rose-500/10 text-rose-400' :
                          statusKey === 'statusHigh' ? 'bg-amber-500/10 text-amber-400' :
                          statusKey === 'statusModerate' ? 'bg-cyan-500/10 text-cyan-400' :
                          'bg-emerald-500/10 text-emerald-400'
                        }`}>{statusLabel}</span>
                      </td>
                      {canEdit && (
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleUpdateCapacity(classroom._id, classroom.capacity + 5)}
                            className="text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg hover:bg-indigo-500/20 transition-colors font-semibold"
                          >
                            +5
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapacityManagement;

