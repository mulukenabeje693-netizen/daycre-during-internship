import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';

const ClassroomList = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const emptyForm = { name: '', ageGroup: '', capacity: 15, room: '', teacher: '', color: '#6366F1' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/classrooms');
      setClassrooms(res.data.data);
    } catch (err) {
      setError('Failed to load classrooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
    if (user?.role === 'admin') {
      api.get('/staff').then(res => {
        setTeachers(res.data.data.filter(u => u.role === 'teacher'));
      }).catch(() => {});
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        capacity: parseInt(form.capacity) || 0,
        teacher: form.teacher ? form.teacher : null
      };

      if (editingId) {
        await api.put(`/classrooms/${editingId}`, payload);
        setSuccess('Classroom updated successfully!');
      } else {
        await api.post('/classrooms', payload);
        setSuccess('Classroom created successfully!');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchClassrooms();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save classroom.');
    }
  };

  const handleEdit = (c) => {
    setForm({
      name: c.name,
      ageGroup: c.ageGroup,
      capacity: c.capacity,
      room: c.room,
      teacher: c.teacher?._id || '',
      color: c.color || '#6366F1'
    });
    setEditingId(c._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/classrooms/${deleteTarget}`);
      setClassrooms(prev => prev.filter(c => c._id !== deleteTarget));
      setSuccess('Classroom deleted.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Delete failed.');
    } finally {
      setDeleteTarget(null);
      setDeleteForEveryone(false);
    }
  };

  const canEdit = user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title={t('deleteConfirmationTitle')}
        description="Are you sure you want to delete this classroom?"
        warning="This action cannot be undone."
        onCancel={() => { setDeleteTarget(null); setDeleteForEveryone(false); }}
        onConfirm={handleDelete}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('classroomsTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('manageLearnSpaces')}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
            <i className={`bx ${showForm ? 'bx-x' : 'bx-plus'}`} />
            {showForm ? t('cancel') : t('addClassroom')}
          </button>
        )}
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Form */}
      {showForm && canEdit && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">{editingId ? t('editClassroom') : t('createNewClassroom')}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('nameLabel')} *</label>
              <input type="text" required value={form.name} placeholder="e.g. Sunshine Room"
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('ageGroupLabel')} *</label>
              <input type="text" required value={form.ageGroup} placeholder="e.g. 2-3 years"
                onChange={e => setForm({ ...form, ageGroup: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('capacityLabel')} *</label>
              <input type="number" required min="1" value={form.capacity}
                onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('roomLocation')}</label>
              <input type="text" value={form.room} placeholder="e.g. Room 101"
                onChange={e => setForm({ ...form, room: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('teacherLabel')}</label>
              <select value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">{t('unassignedTeacher')}</option>
                {teachers.map(tchr => <option key={tchr._id} value={tchr._id}>{tchr.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('themeColor')}</label>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                className="w-full h-10 border border-slate-200 dark:border-teal-900/40 rounded-xl px-1 py-1 bg-white dark:bg-[#0d1520] cursor-pointer" />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-sm font-semibold text-slate-600 bg-slate-100 dark:bg-[#0d1520] rounded-xl">{t('cancel')}</button>
              <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600">{t('save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-buildings text-4xl" /><p className="text-sm mt-2">{t('noClassroomsFound')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {classrooms.map(c => {
            const enrolled = c.children?.length || 0;
            const percentage = Math.round((enrolled / c.capacity) * 100);
            return (
              <div key={c._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden hover:shadow-lg transition-shadow relative">
                <div className="h-2 w-full" style={{ backgroundColor: c.color || '#6366F1' }} />
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {c.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">{c.ageGroup} · {c.room}</p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10"><i className="bx bx-edit text-lg" /></button>
                        <button onClick={() => setDeleteTarget(c._id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"><i className="bx bx-trash text-lg" /></button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0d1520] rounded-xl border border-slate-100 dark:border-teal-900/40/50">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <i className="bx bx-user-circle text-2xl" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">{t('leadTeacher')}</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.teacher?.fullName || t('unassignedTeacher')}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{t('capacity')}</span>
                        <span className="text-slate-500 font-mono">{enrolled} / {c.capacity}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-[#0d1520] rounded-full h-2">
                        <div className={`h-2 rounded-full ${percentage >= 100 ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                      </div>
                      {percentage >= 100 && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{t('classroomFull')}</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClassroomList;

