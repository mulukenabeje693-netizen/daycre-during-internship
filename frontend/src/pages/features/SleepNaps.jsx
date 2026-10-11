import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import ChildSelectDropdown from '../../components/ChildSelectDropdown';

/* ── helpers ──────────────────────────────────────────────── */
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const duration = (start, end) => {
  if (!start) return '—';
  const ms = (end ? new Date(end) : new Date()) - new Date(start);
  const m  = Math.floor(ms / 60000);
  const h  = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

/* ── live elapsed timer ───────────────────────────────────── */
const LiveTimer = ({ start }) => {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const tick = () => setElapsed(duration(start, null));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [start]);
  return <span className="font-mono text-indigo-400 font-bold">{elapsed}</span>;
};

/* ═══════════════════════════════════════════════════════════ */
const SleepNaps = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const QUALITY = [
    { value: 'good', label: t('qualityGood'), color: 'emerald', icon: 'bx-happy'     },
    { value: 'fair', label: t('qualityFair'), color: 'amber',   icon: 'bx-meh'       },
    { value: 'poor', label: t('qualityPoor'), color: 'rose',    icon: 'bx-sad'       },
  ];
  const [children,    setChildren]    = useState([]);
  const [records,     setRecords]     = useState([]);   // today's attendance records
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  // log nap form
  const [selChildren, setSelChildren] = useState([]);
  const [napNotes,    setNapNotes]    = useState('');
  const [starting,    setStarting]    = useState(false);
  const [startTime,   setStartTime]   = useState('13:00');
  const [endTime,     setEndTime]     = useState('15:00');
  const [quality,     setQuality]     = useState('good');

  // delete confirm
  const [delModal,    setDelModal]    = useState(null);
  const [delFor,      setDelFor]      = useState(true);
  const [deleting,    setDeleting]    = useState(false);

  const flash = (s, msg, ms = 3000) => { s(msg); setTimeout(() => s(''), ms); };

  /* ── fetch ─────────────────────────────────────────────── */
  const fetchData = async () => {
    try {
      setLoading(true);
      const [cr, nr] = await Promise.allSettled([
        api.get('/children'),
        api.get('/attendance/today'),
      ]);
      if (cr.status === 'fulfilled') setChildren(cr.value.data?.data || []);
      if (nr.status === 'fulfilled') setRecords(nr.value.data?.data?.records || []);
      if (cr.status === 'rejected' && nr.status === 'rejected') {
        setError('Failed to load data.');
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const canEdit = ['admin', 'teacher', 'reception'].includes(user?.role);

  /* ── derived lists ──────────────────────────────────────── */
  const napping   = records.filter(r => r.napStart && !r.napEnd);
  const completed = records.filter(r => r.napStart &&  r.napEnd);
  const avgMin    = completed.length
    ? Math.round(completed.reduce((s, r) => s + (new Date(r.napEnd) - new Date(r.napStart)) / 60000, 0) / completed.length)
    : 0;

  /* ── log nap ──────────────────────────────────────────── */
  const handleStart = async () => {
    if (!selChildren || selChildren.length === 0) return setError('Please select at least one child.');
    setStarting(true); setError('');
    try {
      await Promise.all(selChildren.map(childId => 
        api.post('/attendance/nap/log', { childId, notes: napNotes, startTime, endTime, quality })
      ));
      flash(setSuccess, '✅ Nap logged successfully!');
      setSelChildren([]); setNapNotes(''); setStartTime('13:00'); setEndTime('15:00'); setQuality('good');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log nap.');
    } finally { setStarting(false); }
  };

  /* ── render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6">



      {/* ── HEADER ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('sleepNapsTitle')}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('sleepNapsSubtitle')}</p>
      </div>

      {error   && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">{success}</div>}

      {/* ── STATS ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: t('completedToday'),  value: completed.length, icon: 'bx-check-circle',  color: 'emerald' },
          { label: t('avgDuration'),     value: avgMin,           icon: 'bx-time',           color: 'cyan'    },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-${s.color}-500/10 flex items-center justify-center`}>
                <i className={`bx ${s.icon} text-2xl text-${s.color}-400`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── LOG COMPLETED NAP FORM ──────────────────────────────────── */}
      {canEdit && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="bx bx-check-circle text-emerald-400" /> {t('logCompletedNap')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('selectChildLabel')}</label>
              <ChildSelectDropdown 
                childrenList={children}
                selectedIds={selChildren}
                onChange={setSelChildren}
                label={t('selectChild')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('qualityLabel')}</label>
              <select value={quality} onChange={e => setQuality(e.target.value)}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {QUALITY.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('startTimeLabel')}</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('endTimeLabel')}</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('notesLabel')}</label>
              <input type="text" value={napNotes} onChange={e => setNapNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <button onClick={handleStart} disabled={selChildren.length === 0 || starting}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50">
            <i className="bx bx-check-circle" />
            {starting ? t('submitting') : t('submitBtn')}
          </button>
        </div>
      )}



      {/* ── COMPLETED NAPS ──────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-teal-900/30">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bx bx-check-circle text-emerald-400" /> {t('completedNapsToday')} ({completed.length})
          </h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : completed.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">{t('noCompletedNaps')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]/50">
                  {[t('childCol2'), t('startCol'), t('endCol'), t('durationCol'), t('qualityCol'), t('notesCol')].map(h => (
                    <th key={h} className="text-left px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completed.map(r => {
                  const q = QUALITY.find(x => x.value === (r.napQuality || 'good'));
                  return (
                    <tr key={r._id} className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {r.child?.firstName?.charAt(0)}{r.child?.lastName?.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-white">
                            {r.child?.firstName} {r.child?.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{fmtTime(r.napStart)}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{fmtTime(r.napEnd)}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-cyan-400">{duration(r.napStart, r.napEnd)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-${q?.color || 'slate'}-500/10 text-${q?.color || 'slate'}-400`}>
                          <i className={`bx ${q?.icon || 'bx-meh'}`} /> {q?.label || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{r.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default SleepNaps;
