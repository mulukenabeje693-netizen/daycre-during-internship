import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { validateEthPhone } from '../../utils/phoneValidation';

const VisitorLog = () => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [children, setChildren] = useState([]);
  const [phoneError, setPhoneError] = useState('');

  const emptyForm = {
    fullName: '', phone: '', purpose: '', host: '',
    relationship: 'other', visitingChild: '', badgeNumber: ''
  };
  const [form, setForm] = useState(emptyForm);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const res = await api.get('/visitors/today');
      setVisitors(res.data.data);
    } catch (err) {
      setError('Failed to load visitor log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
    api.get('/children').then(r => setChildren(r.data.data)).catch(() => {});
  }, []);

  const handleCheckIn = async (e) => {
    e.preventDefault();
    setError('');
    const validationMessage = validateEthPhone(form.phone);
    if (validationMessage) {
      setPhoneError(validationMessage);
      return;
    }
    setPhoneError('');
    try {
      await api.post('/visitors/checkin', form);
      setSuccess('Visitor checked in!');
      setShowForm(false);
      setForm(emptyForm);
      fetchVisitors();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed.');
    }
  };

  const handleCheckOut = async (id) => {
    try {
      await api.put(`/visitors/${id}/checkout`);
      fetchVisitors();
      setSuccess('Visitor checked out.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Check-out failed.');
    }
  };

  const activeVisitors = visitors.filter(v => v.status === 'checked-in');
  const checkedOutVisitors = visitors.filter(v => v.status === 'checked-out');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Visitor Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{visitors.length} visitors today · {activeVisitors.length} currently inside</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
          <i className={`bx ${showForm ? 'bx-x' : 'bx-user-plus'}`} />
          {showForm ? 'Cancel' : 'Check In Visitor'}
        </button>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Check-In Form */}
      {showForm && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Visitor Check-In</h3>
          <form onSubmit={handleCheckIn} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Full Name *', key: 'fullName', type: 'text', required: true },
              { label: 'Phone Number', key: 'phone', type: 'tel' },
              { label: 'Purpose of Visit *', key: 'purpose', type: 'text', required: true, placeholder: 'e.g. Pick up child' },
              { label: 'Hosting Person/Staff', key: 'host', type: 'text', placeholder: 'Who are they visiting?' },
              { label: 'Badge Number', key: 'badgeNumber', type: 'text', placeholder: 'Visitor badge #' }
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{f.label}</label>
                <input type={f.key === 'badgeNumber' ? 'text' : f.type} inputMode={f.key === 'badgeNumber' ? 'numeric' : undefined}
                  pattern={f.key === 'badgeNumber' ? '[0-9]*' : undefined} required={f.required} placeholder={f.placeholder || ''} value={form[f.key]}
                  onChange={e => {
                    const value = f.key === 'badgeNumber' ? e.target.value.replace(/\D/g, '') : e.target.value;
                    setForm({ ...form, [f.key]: value });
                    if (f.key === 'phone') setPhoneError(validateEthPhone(value));
                  }}
                  className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {f.key === 'phone' && phoneError && <p className="mt-1 text-xs text-rose-500">{phoneError}</p>}
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Relationship</label>
              <select value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="parent">Parent</option>
                <option value="guardian">Guardian</option>
                <option value="relative">Relative</option>
                <option value="official">Official</option>
                <option value="vendor">Vendor</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Visiting Child (optional)</label>
              <select value={form.visitingChild} onChange={e => setForm({ ...form, visitingChild: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None</option>
                {children.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 dark:bg-[#0d1520] rounded-xl">Cancel</button>
              <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors">Check In</button>
            </div>
          </form>
        </div>
      )}

      {/* Active Visitors */}
      {activeVisitors.length > 0 && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-emerald-500/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-teal-900/30 flex items-center gap-2 bg-emerald-500/5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-bold text-slate-800 dark:text-white">Currently Inside ({activeVisitors.length})</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {activeVisitors.map(v => (
              <div key={v._id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm font-bold">
                    {v.fullName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{v.fullName || 'Unknown Visitor'}</p>
                    <p className="text-xs text-slate-400">{v.purpose || 'N/A'} · Badge: {v.badgeNumber || 'N/A'}</p>
                    <p className="text-xs text-emerald-400">In: {v.checkIn ? new Date(v.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
                  </div>
                </div>
                <button onClick={() => handleCheckOut(v._id)}
                  className="text-sm text-rose-400 bg-rose-500/10 px-4 py-2 rounded-xl hover:bg-rose-500/20 font-semibold transition-colors">
                  Check Out
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-teal-900/30">
          <h3 className="font-bold text-slate-800 dark:text-white">Today's Registry ({visitors.length})</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : visitors.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><i className="bx bx-user text-4xl" /><p className="text-sm mt-2">No visitors today</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0d1520]/50 border-b border-slate-100 dark:border-teal-900/30">
                  {['Name', 'Purpose', 'Relationship', 'Check In', 'Check Out', 'Status'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitors.map(v => (
                  <tr key={v._id} className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30">
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-white">{v.fullName || 'N/A'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{v.purpose || 'N/A'}</td>
                    <td className="px-5 py-3.5 capitalize text-slate-500">{v.relationship || 'N/A'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{v.checkIn ? new Date(v.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{v.checkOut ? new Date(v.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${v.status === 'checked-in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitorLog;

