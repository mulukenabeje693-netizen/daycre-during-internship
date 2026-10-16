import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import ChildSelectDropdown from '../../components/ChildSelectDropdown';

const ACTIVITY_TYPE_KEYS = [
  { value: 'art',      labelKey: 'artCraft',    icon: 'bx-palette',     color: 'purple',  category: 'art'     },
  { value: 'outdoor',  labelKey: 'outdoorPlay', icon: 'bx-run',         color: 'emerald', category: 'outdoor' },
  { value: 'story',    labelKey: 'storyTime',   icon: 'bx-book-open',   color: 'cyan',    category: 'reading' },
  { value: 'music',    labelKey: 'musicDance',  icon: 'bx-music',       color: 'rose',    category: 'music'   },
  { value: 'learning', labelKey: 'learning',    icon: 'bxs-graduation', color: 'amber',   category: 'science' },
  { value: 'exercise', labelKey: 'exercise',    icon: 'bx-dumbbell',    color: 'indigo',  category: 'social'  },
  { value: 'other',    labelKey: 'other',       icon: 'bx-star',        color: 'slate',   category: 'other'   },
];

const normalizeActivityCategory = activity => {
  const category = String(activity?.category || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const source = `${category} ${activity?.name || ''}`
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (category === 'other') return 'other';

  const categoryMatches = [
    ['art', /\b(art|craft|creative)\b/],
    ['outdoor', /\b(outdoor|outside|playground|nature)\b/],
    ['story', /\b(story|stories|reading|literacy|book)\b/],
    ['music', /\b(music|dance|singing|rhythm)\b/],
    ['exercise', /\b(exercise|physical|fitness|movement|social)\b/],
    ['learning', /\b(learning|math|science|stem|academic)\b/]
  ];
  const knownCategory = categoryMatches.find(([, pattern]) => pattern.test(category));
  if (knownCategory) return knownCategory[0];
  const nameCategory = categoryMatches.find(([, pattern]) => pattern.test(source));
  if (nameCategory) return nameCategory[0];
  return 'other';
};

const extractLegacyActivities = report => {
  const match = String(report.teacherNotes || '').match(/^\[Activities\]\s*([^.]+)(?:\.\s*([\s\S]*))?/);
  if (!match) return [];
  return match[1].split(',').map(name => ({
    name: name.trim(),
    category: name.trim(),
    description: match[2]?.trim() || ''
  })).filter(activity => activity.name);
};

const ActivitiesList = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const ACTIVITY_TYPES = ACTIVITY_TYPE_KEYS.map(a => ({ ...a, label: t(a.labelKey) }));
  const [reports, setReports] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterChild, setFilterChild] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    childrenIds: [],
    activities: [],
    activityNotes: '',
    mood: 'happy',
    teacherNotes: ''
  };
  const [form, setForm] = useState(emptyForm);

  const isTeacherOrAdmin = ['admin', 'teacher'].includes(user?.role);

  const fetchReports = useCallback(async signal => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/reports', signal ? { signal } : undefined);
      if (signal?.aborted) return;
      if (res.data?.success !== true || !Array.isArray(res.data.data)) {
        throw new Error(res.data?.message || 'The activity service returned an invalid response.');
      }
      setReports(res.data.data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err.response?.data?.message || err.message || 'Failed to load activity reports.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchReports(controller.signal);
    if (isTeacherOrAdmin) {
      api.get('/children', { signal: controller.signal }).then(response => {
        if (controller.signal.aborted) return;
        if (response.data?.success !== true || !Array.isArray(response.data.data)) {
          throw new Error('The child service returned an invalid response.');
        }
        setChildren(response.data.data);
      }).catch(childError => {
        if (controller.signal.aborted) return;
        setError(childError.response?.data?.message || childError.message || 'Failed to load children for activity recording.');
      });
    }
    return () => controller.abort();
  }, [fetchReports, isTeacherOrAdmin]);

  const toggleActivity = (type) => {
    setForm(prev => ({
      ...prev,
      activities: prev.activities.includes(type)
        ? prev.activities.filter(a => a !== type)
        : [...prev.activities, type]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!form.childrenIds || form.childrenIds.length === 0) return setError(t('selectChild', 'Select a child.'));
    if (form.activities.length === 0) return setError(t('activitiesToday', 'Select at least one activity.').replace(' *', ''));
    setSaving(true);
    try {
      // build activities array in the shape the model expects: { name, category }
      const activitiesPayload = form.activities.map(val => {
        const type = ACTIVITY_TYPES.find(t => t.value === val);
        return { name: type?.label || val, category: type?.category || 'other' };
      });

      await Promise.all(form.childrenIds.map(async (childId) => {
        const childObj = children.find(c => c._id === childId);
        if (!childObj) throw new Error('A selected child is no longer available. Reload the child list and try again.');
        const classroomId = childObj?.classroom?._id || childObj?.classroom || null;
        if (!classroomId) throw new Error(`Child ${childObj.firstName} has no classroom assigned.`);

        await api.post('/reports', {
          child: childId,
          classroom: classroomId,
          activities: activitiesPayload,
          mood: form.mood,
          teacherNotes: form.activityNotes
            ? `[Activities] ${form.activities.join(', ')}. ${form.activityNotes}`
            : `[Activities] ${form.activities.join(', ')}`
        });
      }));

      setSuccess('Activity report saved!');
      setShowForm(false);
      setForm(emptyForm);
      fetchReports();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save activity report.');
    } finally {
      setSaving(false);
    }
  };

  const activityReports = reports.flatMap(report => {
    const storedActivities = Array.isArray(report.activities) ? report.activities : [];
    const activities = storedActivities.length > 0
      ? storedActivities
      : extractLegacyActivities(report);
    const legacyMatch = String(report.teacherNotes || '').match(/^\[Activities\]\s*[^.]+(?:\.\s*([\s\S]*))?/);
    const reportNotes = legacyMatch ? legacyMatch[1]?.trim() : String(report.teacherNotes || '').trim();

    return activities.map((activity, index) => ({
      report,
      activity,
      category: normalizeActivityCategory(activity),
      description: String(activity.description || reportNotes || '').trim(),
      key: `${report._id}-${index}`
    }));
  });

  const childFilteredActivities = filterChild
    ? activityReports.filter(item => String(item.report.child?._id) === filterChild)
    : activityReports;
  const filtered = filterCategory
    ? childFilteredActivities.filter(item => item.category === filterCategory)
    : childFilteredActivities;

  // Stats
  const activityCounts = ACTIVITY_TYPES.map(type => ({
    ...type,
    count: childFilteredActivities.filter(activity => activity.category === type.value).length
  }));

  const handleAcknowledge = async reportId => {
    try {
      await api.put(`/reports/${reportId}/acknowledge`);
      setReports(previous => previous.map(report =>
        report._id === reportId ? { ...report, parentAcknowledged: true } : report
      ));
    } catch (acknowledgeError) {
      setError(acknowledgeError.response?.data?.message || acknowledgeError.message || 'Failed to acknowledge this report.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('activitiesListTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('activitiesListSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchReports()}
            disabled={loading}
            className="flex items-center gap-2 border border-slate-200 dark:border-teal-900/40 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-[#111c2d] disabled:opacity-50"
          >
            <i className={`bx bx-refresh ${loading ? 'animate-spin' : ''}`} />
            {t('refresh', 'Refresh')}
          </button>
          {isTeacherOrAdmin && (
            <button
              onClick={() => { setShowForm(!showForm); setForm(emptyForm); }}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors"
            >
              <i className={`bx ${showForm ? 'bx-x' : 'bx-palette'}`} />
              {showForm ? t('cancel') : t('logActivity')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => fetchReports()} disabled={loading} className="px-3 py-1.5 rounded-lg bg-rose-500/10 font-semibold hover:bg-rose-500/20 disabled:opacity-50">
            {loading ? t('loading', 'Loading…') : t('retry', 'Retry')}
          </button>
        </div>
      )}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Activity Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {activityCounts.map(type => (
          <button
            type="button"
            key={type.value}
            aria-pressed={filterCategory === type.value}
            onClick={() => setFilterCategory(current => current === type.value ? '' : type.value)}
            className={`bg-white dark:bg-[#111c2d] rounded-2xl border p-4 text-center transition-colors ${
              filterCategory === type.value
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-teal-900/30 hover:border-indigo-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl bg-${type.color}-500/10 flex items-center justify-center mx-auto mb-2`}>
              <i className={`bx ${type.icon} text-xl text-${type.color}-400`} />
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{(loading || (error && reports.length === 0)) ? '—' : type.count}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{type.label}</p>
          </button>
        ))}
      </div>

      {/* Log Activity Form */}
      {showForm && isTeacherOrAdmin && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-5">{t('logActivityTitle')}</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('childLabel')}</label>
                <ChildSelectDropdown 
                  childrenList={children}
                  selectedIds={form.childrenIds}
                  onChange={ids => setForm({ ...form, childrenIds: ids })}
                  label={t('selectChild')}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('childMood')}</label>
                <select
                  value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}
                  className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="happy">{t('moodHappy')}</option>
                  <option value="energetic">{t('moodEnergetic')}</option>
                  <option value="sleepy">{t('moodSleepy')}</option>
                  <option value="cranky">{t('moodCranky')}</option>
                  <option value="sad">{t('moodSad')}</option>
                </select>
              </div>
            </div>

            {/* Activity selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 block">
                {t('activitiesToday')} <span className="text-indigo-400">({form.activities.length} {t('selected')})</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {ACTIVITY_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => toggleActivity(type.value)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      form.activities.includes(type.value)
                        ? `border-indigo-500 bg-indigo-500/10`
                        : 'border-slate-200 dark:border-teal-900/40 bg-white dark:bg-[#0d1520] hover:border-indigo-300'
                    }`}
                  >
                    <i className={`bx ${type.icon} text-2xl ${form.activities.includes(type.value) ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className={`text-[10px] font-semibold text-center leading-tight ${form.activities.includes(type.value) ? 'text-indigo-400' : 'text-slate-500'}`}>
                      {type.label}
                    </span>
                    {form.activities.includes(type.value) && (
                      <i className="bx bx-check-circle text-indigo-400 text-sm" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('activityNotes')}</label>
              <textarea
                rows={2} value={form.activityNotes}
                onChange={e => setForm({ ...form, activityNotes: e.target.value })}
                placeholder={t('activityNotesPlaceholder')}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors">
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50">
                {saving ? t('saving', 'Saving…') : t('saveActivityLog')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      {(children.length > 0 || filterCategory) && (
        <div className="flex flex-wrap items-center gap-3">
          {children.length > 0 && (
            <>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('filterByChild')}</label>
              <select
                value={filterChild} onChange={e => setFilterChild(e.target.value)}
                className="border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2 text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t('allChildrenOption')}</option>
                {children.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </>
          )}
          <button type="button" onClick={() => setFilterCategory('')} className="rounded-xl px-4 py-2 text-sm font-semibold text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20">
            {t('all', 'All Activities')}
          </button>
        </div>
      )}

      {/* Activity Reports */}
      {loading ? (
        <div role="status" aria-live="polite" className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : error && reports.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-rose-200 dark:border-rose-900/30">
          <i className="bx bx-error-circle text-4xl text-rose-400" />
          <p className="text-sm mt-2">{t('activityLoadFailed', 'Could not load activity records. Please retry.')}</p>
          <button type="button" onClick={() => fetchReports()} className="mt-4 text-sm text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-xl hover:bg-indigo-500/20 transition-colors">
            {t('retry', 'Retry')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-palette text-4xl" />
          <p className="text-sm mt-2">{activityReports.length === 0
            ? t('noActivityRecords')
            : t('noMatchingActivities', 'No activity records match the selected filters.')}</p>
          {activityReports.length === 0 && user?.role === 'parent' && (
            <p className="text-xs mt-2 px-4">{t('activitiesRecordedByStaff', 'Authorized teachers or administrators can record activities in Daily Reports or Activities.')}</p>
          )}
          {isTeacherOrAdmin && (
            <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-xl hover:bg-indigo-500/20 transition-colors">
              {t('logFirstActivity')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(({ report, activity, category, description, key }) => {
            const type = ACTIVITY_TYPES.find(item => item.value === category) || ACTIVITY_TYPES[6];
            const activityName = String(activity.name || '').trim() || type.label;
            const dateLabel = report.date && !Number.isNaN(new Date(report.date).getTime())
              ? new Date(report.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              : '—';
            const recordedAt = report.createdAt && !Number.isNaN(new Date(report.createdAt).getTime())
              ? new Date(report.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : '';
            return (
              <div key={key} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
                {/* Child header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {report.child?.firstName?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{report.child?.firstName} {report.child?.lastName}</p>
                    <p className="text-xs text-slate-400">
                      {dateLabel}{recordedAt ? ` · Logged ${recordedAt}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-${type.color}-500/10 text-${type.color}-400`}>
                    <i className={`bx ${type.icon} text-sm`} />
                    {type.label}
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{activityName}</span>
                </div>

                {description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0d1520] rounded-xl p-3 italic">
                    "{description}"
                  </p>
                )}
                {report.mood && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                    {t('childMood', 'Child mood')}: <span className="capitalize">{report.mood}</span>
                  </p>
                )}

                {/* Reporter */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-teal-900/30">
                  <span className="text-xs text-slate-400">By {report.createdBy?.fullName || 'Teacher'}</span>
                  {user?.role === 'parent' && !report.parentAcknowledged && (
                    <button
                      onClick={() => handleAcknowledge(report._id)}
                      className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg hover:bg-emerald-500/20 transition-colors"
                    >
                      {t('acknowledge')}
                    </button>
                  )}
                  {report.parentAcknowledged && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <i className="bx bx-check-double" /> {t('acknowledged')}
                    </span>
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

export default ActivitiesList;
