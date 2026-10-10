import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';

const AssignedRoom = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [classrooms, setClassrooms] = useState([]);
  const [unassignedChildren, setUnassignedChildren] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Teachers can't call /children directly (403) — use /classrooms/my-classroom
      // which already includes the enrolled children for their room.
      if (user?.role === 'teacher') {
        const classroomsRes = await api.get('/classrooms/my-classroom');
        const myClassrooms = Array.isArray(classroomsRes.data.data) ? classroomsRes.data.data : [];
        setClassrooms(myClassrooms);
        // Flatten all children from the teacher's classrooms as "enrolled" — no unassigned view
        setUnassignedChildren([]);
      } else {
        const [classroomsRes, childrenRes] = await Promise.all([
          api.get('/classrooms'),
          api.get('/children')
        ]);
        setClassrooms(classroomsRes.data.data || []);
        setUnassignedChildren((childrenRes.data.data || []).filter(c => !c.classroom));
      }
    } catch (err) {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async () => {
    if (!selectedClassroom || selectedChildren.length === 0) {
      setError('Please select a classroom and at least one child.');
      return;
    }

    try {
      await Promise.all(
        selectedChildren.map(childId =>
          api.put(`/children/${childId}`, { classroom: selectedClassroom })
        )
      );
      setSuccess(`${selectedChildren.length} child(ren) assigned successfully!`);
      setSelectedClassroom('');
      setSelectedChildren([]);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to assign children.');
    }
  };

  const handleUnassign = async (childId) => {
    try {
      await api.put(`/children/${childId}`, { classroom: null });
      setSuccess('Child unassigned successfully!');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to unassign child.');
    }
  };

  const toggleChildSelection = (childId) => {
    setSelectedChildren(prev =>
      prev.includes(childId)
        ? prev.filter(id => id !== childId)
        : [...prev, childId]
    );
  };

  const canEdit = ['admin', 'reception'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('roomAssignmentTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('roomAssignmentSubtitle')}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Assignment Form */}
      {canEdit && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">{t('assignChildrenToClassroom')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('selectClassroomLabel')} *</label>
              <select
                value={selectedClassroom}
                onChange={e => setSelectedClassroom(e.target.value)}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t('chooseClassroomDots')}</option>
                {classrooms.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.ageGroup}) - {c.children?.length || 0}/{c.capacity} enrolled
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                {t('unassignedChildrenLabel')} ({unassignedChildren.length})
              </label>
              <div className="border border-slate-200 dark:border-teal-900/40 rounded-xl p-3 max-h-40 overflow-y-auto bg-white dark:bg-[#0d1520]">
                {unassignedChildren.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-2">{t('noUnassignedChildren')}</p>
                ) : (
                  unassignedChildren.map(child => (
                    <label key={child._id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 px-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedChildren.includes(child._id)}
                        onChange={() => toggleChildSelection(child._id)}
                        className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        {child.firstName} {child.lastName}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleAssign}
            disabled={!selectedClassroom || selectedChildren.length === 0}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('assignSelected')} ({selectedChildren.length})
          </button>
        </div>
      )}

      {/* Classroom Overview */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {classrooms.map(classroom => {
            const enrolled = classroom.children || [];
            const available = classroom.capacity - enrolled.length;
            
            return (
              <div key={classroom._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
                <div className="h-2 w-full" style={{ backgroundColor: classroom.color || '#6366F1' }} />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">{classroom.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{classroom.ageGroup} · {classroom.room}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-[#00A884] dark:text-[#00C49A]">{classroom.capacity}</p>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('capacity', 'Capacity')}</p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500">{t('classroomCapacity', 'Classroom Capacity')}</span>
                      <span className="font-bold text-[#00A884] dark:text-[#00C49A]">
                        {classroom.capacity} {t('spots', 'Spots')}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-[#0d1520] rounded-full h-2">
                      <div className="h-2 rounded-full bg-[#00A884] dark:bg-[#00C49A]" 
                        style={{ width: `${Math.min(((enrolled.length || 0) / (classroom.capacity || 1)) * 100, 100)}%` }} />
                    </div>
                  </div>

                  {enrolled.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-teal-900/30">
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {enrolled.map(child => (
                          <div key={child._id} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-[#0d1520] rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                {child.firstName?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                  {child.firstName} {child.lastName}
                                </p>
                                <p className="text-xs text-slate-400">{child.age} yrs</p>
                              </div>
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => handleUnassign(child._id)}
                                className="text-xs text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg hover:bg-rose-500/20 transition-colors"
                              >
                                {t('unassignChild')}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssignedRoom;

