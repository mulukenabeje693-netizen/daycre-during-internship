import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';

const DailyReports = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState([]);
  const [children, setChildren] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const emptyForm = {
    child: '',
    mood: 'happy',
    meals: {
      breakfast: { provided: false, ate: 'all', time: '08:30' },
      lunch: { provided: false, ate: 'all', time: '12:00' },
      snack: { provided: false, ate: 'all', time: '15:00' }
    },
    naps: [{ startTime: '', endTime: '' }],
    activities: [],
    potty: { times: 0, notes: '' },
    teacherNotes: ''
  };
  
  const [form, setForm] = useState(emptyForm);

  const isTeacherOrAdmin = ['admin', 'teacher'].includes(user?.role);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports');
      setReports(res.data.data);
    } catch (err) {
      setError('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    if (isTeacherOrAdmin) {
      api.get('/children').then(r => setChildren(r.data.data)).catch(() => {});
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/reports', form);
      
      const childObj = children.find(c => c._id === form.child);
      if (childObj && childObj.parents && childObj.parents.length > 0) {
        childObj.parents.forEach(parent => {
          api.post('/messages', {
            recipientId: parent._id,
            subject: `New Daily Report for ${childObj.firstName}`,
            body: `A new daily report has been posted for ${childObj.firstName}. Mood: ${form.mood}. ${form.teacherNotes ? `Notes: ${form.teacherNotes}` : ''}`,
            priority: 'normal',
            relatedChild: childObj._id
          }).catch(err => console.error('Failed to notify parent', err));
        });
      }

      setSuccess('Daily report saved!');
      setShowForm(false);
      setForm(emptyForm);
      fetchReports();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save report.');
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await api.put(`/reports/${id}/acknowledge`);
      setSuccess('Report acknowledged.');
      fetchReports();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to acknowledge report.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('dailyReportsTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('dailyReportsSubtitle')}</p>
        </div>
        {isTeacherOrAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
            <i className={`bx ${showForm ? 'bx-x' : 'bx-edit'}`} />
            {showForm ? t('cancel') : t('writeReport')}
          </button>
        )}
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Write Report Form */}
      {showForm && isTeacherOrAdmin && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-5">{t('createDailyReport')}</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('childLabel')}</label>
                <select required value={form.child} onChange={e => setForm({ ...form, child: e.target.value })}
                  className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">{t('selectChild')}</option>
                  {children.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('moodLabel')}</label>
                <select value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}
                  className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="happy">{t('moodHappyFull')}</option>
                  <option value="sad">{t('moodSadFull')}</option>
                  <option value="cranky">{t('moodCrankyFull')}</option>
                  <option value="sleepy">{t('moodSleepyFull')}</option>
                  <option value="energetic">{t('moodEnergeticFull')}</option>
                  <option value="sick">{t('moodSickFull')}</option>
                </select>
              </div>
            </div>

            {/* Meals */}
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-100 dark:border-teal-900/30 pb-2">{t('mealsSection')}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: 'breakfast', labelKey: 'breakfastProvided' },
                  { key: 'lunch',     labelKey: 'lunchProvided' },
                  { key: 'snack',     labelKey: 'snackProvided' },
                ].map(({ key: meal, labelKey }) => (
                  <div key={meal} className="bg-slate-50 dark:bg-[#0d1520]/50 p-4 rounded-xl border border-slate-100 dark:border-teal-900/40/50">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 capitalize flex items-center gap-2 mb-3">
                      <input type="checkbox" checked={form.meals[meal].provided}
                        onChange={e => setForm(prev => ({
                          ...prev, meals: { ...prev.meals, [meal]: { ...prev.meals[meal], provided: e.target.checked } }
                        }))}
                        className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500" />
                      {t(labelKey)}
                    </label>
                    {form.meals[meal].provided && (
                      <div className="space-y-3">
                        <select value={form.meals[meal].ate}
                          onChange={e => setForm(prev => ({
                            ...prev, meals: { ...prev.meals, [meal]: { ...prev.meals[meal], ate: e.target.value } }
                          }))}
                          className="w-full border border-slate-200 dark:border-teal-900/40 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                          <option value="all">{t('ateAll')}</option>
                          <option value="most">{t('ateMost')}</option>
                          <option value="some">{t('ateSome')}</option>
                          <option value="none">{t('ateNone')}</option>
                        </select>
                        <input type="time" value={form.meals[meal].time}
                          onChange={e => setForm(prev => ({
                            ...prev, meals: { ...prev.meals, [meal]: { ...prev.meals[meal], time: e.target.value } }
                          }))}
                          className="w-full border border-slate-200 dark:border-teal-900/40 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Naps & Potty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-100 dark:border-teal-900/30 pb-2">{t('napTimeSection')}</p>
                {form.naps.map((nap, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input type="time" placeholder={t('startTimeLabel')} value={nap.startTime}
                      onChange={e => {
                        const newNaps = [...form.naps];
                        newNaps[idx].startTime = e.target.value;
                        setForm({ ...form, naps: newNaps });
                      }}
                      className="flex-1 border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
                    <input type="time" placeholder={t('endTimeLabel')} value={nap.endTime}
                      onChange={e => {
                        const newNaps = [...form.naps];
                        newNaps[idx].endTime = e.target.value;
                        setForm({ ...form, naps: newNaps });
                      }}
                      className="flex-1 border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-100 dark:border-teal-900/30 pb-2">{t('pottyDiapers')}</p>
                <div className="flex gap-3">
                  <div className="w-1/3">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">{t('pottyTimes')}</label>
                    <input type="number" min="0" value={form.potty.times}
                      onChange={e => setForm({ ...form, potty: { ...form.potty, times: parseInt(e.target.value) || 0 } })}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">{t('notesLabel')}</label>
                    <input type="text" placeholder="e.g. wet, dry" value={form.potty.notes}
                      onChange={e => setForm({ ...form, potty: { ...form.potty, notes: e.target.value } })}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('teacherNotes')}</p>
              <textarea rows={3} value={form.teacherNotes} placeholder={t('teacherNotesPlaceholder')}
                onChange={e => setForm({ ...form, teacherNotes: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-teal-900/30">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 dark:bg-[#0d1520] rounded-xl">{t('cancel')}</button>
              <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors">{t('submitReport')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-file-blank text-4xl" /><p className="text-sm mt-2">{t('noDailyReports')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map(report => (
            <div key={report._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-teal-900/30 bg-slate-50/50 dark:bg-[#0d1520]/20">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">{report.child?.firstName} {report.child?.lastName}</h3>
                    <p className="text-xs text-slate-400">{new Date(report.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full flex items-center gap-1 ${
                    report.acknowledged ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    <i className={`bx ${report.acknowledged ? 'bx-check-double' : 'bx-time'}`} />
                    {report.acknowledged ? t('reportAcknowledged') : t('reportPending')}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500">{t('moodLabel2')}</span>
                  <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-300">
                    {report.mood} {report.mood === 'happy' ? '😊' : report.mood === 'sad' ? '😢' : report.mood === 'energetic' ? '⚡' : report.mood === 'sleepy' ? '😴' : '😐'}
                  </span>
                </div>
              </div>

              <div className="p-5 flex-1 space-y-4">
                {/* Meals Summary */}
                <div className="grid grid-cols-3 gap-2">
                  {['breakfast', 'lunch', 'snack'].map(m => (
                    report.meals[m]?.provided && (
                      <div key={m} className="bg-slate-50 dark:bg-[#0d1520] rounded-xl p-2 text-center border border-slate-100 dark:border-teal-900/40/50">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">{t(m)}</p>
                        <p className="text-xs font-bold text-indigo-500 capitalize mt-0.5 text-truncate">{report.meals[m].ate}</p>
                      </div>
                    )
                  ))}
                </div>

                {/* Notes */}
                {report.teacherNotes && (
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">{t('teacherNoteSingular')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-indigo-50/50 dark:bg-indigo-500/5 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/10 italic">
                      "{report.teacherNotes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Acknowledge Button for Parents */}
              {user?.role === 'parent' && !report.acknowledged && (
                <div className="p-4 border-t border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]/50">
                  <button onClick={() => handleAcknowledge(report._id)}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 rounded-xl transition-colors text-sm">
                    {t('acknowledgeReport')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyReports;

