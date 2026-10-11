import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';

const AppointmentCalendar = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [children, setChildren] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const emptyForm = {
    title: '', description: '', type: 'parent-teacher-meeting',
    withUser: '', child: '', scheduledAt: '', duration: 30, location: 'Main Office'
  };
  const [form, setForm] = useState(emptyForm);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/appointments');
      setAppointments(res.data.data);
    } catch (err) {
      setError('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    api.get('/staff').then(r => setContacts(r.data.data)).catch(() => {});
    api.get('/children').then(r => setChildren(r.data.data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/appointments', form);
      setSuccess('Appointment scheduled!');
      setShowForm(false);
      setForm(emptyForm);
      fetchAppointments();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Scheduling failed.');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.put(`/appointments/${id}`, { status });
      fetchAppointments();
    } catch (err) {
      setError('Update failed.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/appointments/${deleteTarget}`);
      setAppointments(prev => prev.filter(a => a._id !== deleteTarget));
    } catch (err) {
      setError('Delete failed.');
    } finally {
      setDeleteTarget(null);
      setDeleteForEveryone(false);
    }
  };

  const statusBadge = (status) => ({
    pending: 'bg-amber-500/10 text-amber-400',
    confirmed: 'bg-emerald-500/10 text-emerald-400',
    cancelled: 'bg-rose-500/10 text-rose-400',
    completed: 'bg-slate-500/10 text-slate-400'
  }[status] || 'bg-slate-500/10 text-slate-400');

  const upcoming = appointments.filter(a => new Date(a.scheduledAt) >= new Date() && a.status !== 'cancelled');
  const past = appointments.filter(a => new Date(a.scheduledAt) < new Date() || a.status === 'cancelled');

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Appointment"
        description="Are you sure you want to delete this appointment?"
        warning="This action cannot be undone."
        onCancel={() => { setDeleteTarget(null); setDeleteForEveryone(false); }}
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Appointments</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{upcoming.length} upcoming</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 btn-primary px-4 py-2 rounded-xl font-semibold transition-colors">
          <i className={`bx ${showForm ? 'bx-x' : 'bx-calendar-plus'}`} />
          {showForm ? 'Cancel' : 'Schedule Meeting'}
        </button>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Create Form */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-glass p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Schedule Appointment</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Title *</label>
              <input type="text" required value={form.title} placeholder="e.g. Progress Review - Emma Johnson"
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border border-glass rounded-xl px-4 py-2.5 text-sm bg-card text-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full border border-glass rounded-xl px-4 py-2.5 text-sm bg-card text-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]">
                <option value="parent-teacher-meeting">Parent-Teacher Meeting</option>
                <option value="school-visit">School Visit</option>
                <option value="enrollment-tour">Enrollment Tour</option>
                <option value="health-checkup">Health Checkup</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">With (Staff/Teacher)</label>
              <select value={form.withUser} onChange={e => setForm({ ...form, withUser: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Person</option>
                {contacts.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Date & Time *</label>
              <input type="datetime-local" required value={form.scheduledAt}
                onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full border border-glass rounded-xl px-4 py-2.5 text-sm bg-card text-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Duration (minutes)</label>
              <select value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
                className="w-full border border-glass rounded-xl px-4 py-2.5 text-sm bg-card text-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Location</label>
              <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Related Child</label>
              <select value={form.child} onChange={e => setForm({ ...form, child: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None</option>
                {children.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Notes</label>
              <textarea rows={2} value={form.description} placeholder="Additional notes..."
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
              <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-semibold text-muted bg-var-surface rounded-xl">Cancel</button>
              <button type="submit" className="px-5 py-2.5 text-sm font-semibold btn-primary rounded-xl hover:brightness-95 transition-colors">Schedule</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Upcoming */}
          <div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">Upcoming ({upcoming.length})</h3>
            {upcoming.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
                <i className="bx bx-calendar-x text-4xl" /><p className="text-sm mt-2">No upcoming appointments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map(a => (
                  <div key={a._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex flex-col items-center justify-center flex-shrink-0">
                      <p className="text-xl font-bold text-indigo-500">{new Date(a.scheduledAt).getDate()}</p>
                      <p className="text-[10px] text-indigo-400 font-semibold uppercase">{new Date(a.scheduledAt).toLocaleString('en-US', { month: 'short' })}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-white">{a.title}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><i className="bx bx-time" /> {new Date(a.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ({a.duration}min)</span>
                        <span className="flex items-center gap-1"><i className="bx bx-map-pin" /> {a.location}</span>
                        {a.withUser && <span className="flex items-center gap-1"><i className="bx bx-user" /> {a.withUser.fullName}</span>}
                        {a.child && <span className="flex items-center gap-1"><i className="bx bx-child" /> {a.child.firstName} {a.child.lastName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusBadge(a.status)}`}>{a.status}</span>
                      {['admin', 'reception'].includes(user?.role) && a.status === 'pending' && (
                        <button onClick={() => handleUpdateStatus(a._id, 'confirmed')}
                          className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl font-semibold hover:bg-emerald-500/20">
                          Confirm
                        </button>
                      )}
                      <button onClick={() => setDeleteTarget(a._id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <i className="bx bx-trash text-lg" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-500 mb-3 text-sm uppercase tracking-wide">Past / Cancelled ({past.length})</h3>
              <div className="space-y-2">
                {past.slice(0, 5).map(a => (
                  <div key={a._id} className="bg-white dark:bg-[#111c2d] rounded-xl border border-slate-100 dark:border-teal-900/30 p-4 flex items-center justify-between opacity-60">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{a.title}</p>
                      <p className="text-xs text-slate-400">{new Date(a.scheduledAt).toLocaleDateString()} · {a.location}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusBadge(a.status)}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AppointmentCalendar;

