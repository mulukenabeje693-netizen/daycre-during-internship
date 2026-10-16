import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';
import { getLocalDateKey } from '../../utils/localDate';

const MEAL_TYPE_KEYS = [
  { value: 'breakfast', labelKey: 'breakfast', icon: 'bx-coffee',  color: 'amber'   },
  { value: 'lunch',     labelKey: 'lunch',     icon: 'bx-bowl-hot',color: 'emerald' },
  { value: 'snack',     labelKey: 'snack',     icon: 'bx-cookie',  color: 'purple'  },
  { value: 'dinner',    labelKey: 'dinner',    icon: 'bx-dish',    color: 'rose'    },
];

const todayStr = () => getLocalDateKey();
const dateStr = value => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return getLocalDateKey(value);
};
const formatMealDate = value => {
  const [year, month, day] = dateStr(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const emptyMealForm = () => ({
  name: '', type: 'breakfast',
  date: todayStr(), time: '',
  items: '', allergies: '', notes: '',
  children: [], classroom: '', servings: '', status: 'scheduled',
});

const isValidLocalDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/* ── Multi-select dropdown component ─────────────────────── */
const MultiStudentSelect = ({ children, selected, onChange, t, loading, error, onRetry, emptyMessage }) => {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const ref                   = useRef(null);

  // close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = children.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const selectAll  = () => onChange(children.map(c => c._id));
  const clearAll   = () => onChange([]);

  const selectedNames = children.filter(c => selected.includes(c._id));

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[42px] border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2 text-sm bg-white dark:bg-[#0d1520] text-left flex items-start gap-2 flex-wrap focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
      >
        {selectedNames.length === 0 ? (
          <span className="text-slate-400 py-0.5">{t('selectStudentsPlaceholder')}</span>
        ) : (
          <>
            {selectedNames.map(c => (
              <span key={c._id}
                className="inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                  {c.firstName?.charAt(0) || '?'}
                </span>
                {c.firstName} {c.lastName}
                <button type="button" onClick={e => { e.stopPropagation(); toggle(c._id); }}
                  className="ml-0.5 text-indigo-400 hover:text-rose-400 transition-colors">
                  <i className="bx bx-x text-sm" />
                </button>
              </span>
            ))}
          </>
        )}
        <i className={`bx bx-chevron-down ml-auto text-slate-400 text-base transition-transform duration-200 self-center flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Counter badge */}
      {selectedNames.length > 0 && (
        <span className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
          {selectedNames.length}
        </span>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] bg-white dark:bg-[#111c2d] border border-slate-200 dark:border-teal-900/40 rounded-2xl shadow-2xl overflow-hidden"
          style={{ animation: 'fadeSlideIn 0.15s ease' }}>
          {/* Search */}
          <div className="p-3 border-b border-slate-100 dark:border-teal-900/30">
            <div className="relative">
              <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchChildren')}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-teal-900/40 rounded-xl bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Select all / Clear all */}
          {children.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-teal-900/30">
              <button type="button" onClick={selectAll}
                className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors">
                <i className="bx bx-check-double mr-1" />{t('selectAll')}
              </button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button type="button" onClick={clearAll}
                className="text-xs font-semibold text-rose-400 hover:text-rose-500 transition-colors">
                <i className="bx bx-x mr-1" />{t('clearAll')}
              </button>
            </div>
          )}

          {/* List */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-slate-400 text-sm">
                {loading ? (
                  <><i className="bx bx-loader-alt bx-spin text-2xl block mb-1" />{t('loading', 'Loading eligible children…')}</>
                ) : error ? (
                  <>
                    <i className="bx bx-error-circle text-2xl block mb-1 text-rose-400" />
                    <span>{error}</span>
                    <button type="button" onClick={onRetry} className="mt-2 block mx-auto text-indigo-500 font-semibold">
                      {t('retry', 'Retry')}
                    </button>
                  </>
                ) : children.length === 0 ? (
                  <>
                    <i className="bx bx-group text-2xl block mb-1" />
                    {emptyMessage || t('noEligibleMealChildren', 'No active or approved children in an active classroom are available. Pending registrations must be approved and assigned first.')}
                  </>
                ) : (
                  <><i className="bx bx-search-alt text-2xl block mb-1" />{t('noMatchingStudents', 'No children match your search.')}</>
                )}
              </li>
            ) : filtered.map(child => {
              const isChecked = selected.includes(child._id);
              return (
                <li key={child._id}>
                  <label
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#0d1520] ${isChecked ? 'bg-indigo-500/5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(child._id)}
                      className="h-5 w-5 flex-shrink-0 rounded accent-indigo-500"
                      aria-label={`Assign ${child.firstName} ${child.lastName} to this meal`}
                    />
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {child.firstName?.charAt(0) || '?'}
                    </div>
                    {/* Name + classroom */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isChecked ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>
                        {child.firstName} {child.lastName}
                      </p>
                      {child.classroom?.name && (
                        <p className="text-[10px] text-slate-400 truncate">{child.classroom.name}</p>
                      )}
                    </div>
                    {isChecked && <i className="bx bx-check-circle text-indigo-500 text-base flex-shrink-0" />}
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Footer summary */}
          {selected.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-teal-900/30 bg-indigo-500/5 flex items-center justify-between">
              <span className="text-xs text-indigo-600 dark:text-indigo-300 font-semibold">
                {selected.length} {t('studentsSelected')}
              </span>
              <button type="button" onClick={() => setOpen(false)}
                className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-3 py-1 rounded-lg transition-colors">
                {t('done')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dropdown animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const MealPrep = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const MEAL_TYPES = MEAL_TYPE_KEYS.map(m => ({ ...m, label: t(m.labelKey) }));
  const [meals,    setMeals]    = useState([]);
  const [children, setChildren] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [classroomsLoading, setClassroomsLoading] = useState(true);
  const [classroomsError, setClassroomsError] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState('');
  const studentsRequestId = useRef(0);
  const [error,    setError]    = useState('');
  const [loadError, setLoadError] = useState('');
  const [success,  setSuccess]  = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [viewMeal, setViewMeal] = useState(null);
  const [intakeMeal, setIntakeMeal] = useState(null);
  const [intakeRecords, setIntakeRecords] = useState([]);
  const [intakeSaving, setIntakeSaving] = useState(false);

  // form
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);   // null = create, id = update
  const [form,      setForm]      = useState(emptyMealForm);
  const [saving,    setSaving]    = useState(false);

  // delete
  const [deleteModal,       setDeleteModal]       = useState(null);
  const [deleting,          setDeleting]          = useState(false);

  const flash = (setter, msg, ms = 3000) => { setter(msg); setTimeout(() => setter(''), ms); };

  /* ── fetch ───────────────────────────────────────────────── */
  const fetchMeals = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get('/meals?limit=500');
      if (res.data?.success !== true || !Array.isArray(res.data.data)) {
        throw new Error('The meal service returned an invalid response.');
      }
      setMeals(res.data.data);
    } catch (fetchError) {
      setLoadError(fetchError.response?.data?.message || fetchError.message || 'Failed to load meals. Please retry.');
      setMeals([]);
    }
    finally { setLoading(false); }
  };

  const fetchClassrooms = async () => {
    setClassroomsLoading(true);
    setClassroomsError('');
    try {
      const response = await api.get('/classrooms?status=active');
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('The classroom service returned an invalid response.');
      }
      setClassrooms(response.data.data);
    } catch (fetchError) {
      setClassrooms([]);
      setClassroomsError(
        fetchError.response?.data?.message ||
        fetchError.message ||
        'Could not load classrooms assigned to your account.'
      );
    } finally {
      setClassroomsLoading(false);
    }
  };

  const fetchMealStudents = async classroomId => {
    const requestId = ++studentsRequestId.current;
    setStudentsLoading(true);
    setStudentsError('');
    setChildren([]);
    try {
      const response = await api.get('/meals/students', {
        params: classroomId ? { classroomId } : undefined
      });
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('The eligible child list could not be loaded.');
      }
      if (requestId !== studentsRequestId.current) return;
      setChildren(response.data.data);
    } catch (fetchError) {
      if (requestId !== studentsRequestId.current) return;
      setChildren([]);
      setStudentsError(
        fetchError.response?.data?.message ||
        'Could not load eligible children. Check your access or connection, then retry.'
      );
    } finally {
      if (requestId === studentsRequestId.current) setStudentsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeals();
    fetchClassrooms();
  }, []);

  /* ── permissions ─────────────────────────────────────────── */
  // teachers, admins AND staff can manage meals
  const canEdit = ['admin', 'staff', 'teacher'].includes(user?.role);

  /* ── open form ───────────────────────────────────────────── */
  const openCreate = () => {
    setEditId(null);
    setForm(emptyMealForm());
    setError('');
    setShowForm(true);
  };

  const openEdit = (meal) => {
    const classroomId = meal.classroom?._id || meal.classroom || meal.children?.[0]?.classroom?._id || '';
    setEditId(meal._id);
    setForm({
      name:      meal.name      || '',
      type:      meal.type      || 'breakfast',
      date:      dateStr(meal.date),
      time:      meal.time      || '',
      items:     meal.items     || '',
      allergies: meal.allergies || '',
      notes:     meal.notes     || '',
      children:  (meal.children || []).map(c => c._id || c),
      classroom: classroomId,
      servings:  meal.servings || '',
      status:    meal.status === 'cancelled' ? 'scheduled' : meal.status || 'scheduled',
    });
    setError('');
    setShowForm(true);
    if (classroomId) fetchMealStudents(classroomId);
  };

  /* ── save (create or update) ─────────────────────────────── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.items.trim() || !form.date || !form.time) {
      return setError('Meal name, menu items, date, and time are required.');
    }
    if (!isValidLocalDate(form.date)) {
      return setError('Enter a valid meal date.');
    }
    if (!form.classroom) return setError('Select the classroom this meal is assigned to.');
    if (!form.children.length) return setError('Select at least one eligible child for this meal.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) return setError('Enter a valid meal time.');
    if (form.servings && (!Number.isInteger(Number(form.servings)) || Number(form.servings) < 1 || Number(form.servings) > 1000)) {
      return setError('Servings must be a whole number from 1 to 1000.');
    }
    setSaving(true);
    setError('');
    const payload = { ...form, name: form.name.trim(), items: form.items.trim(), servings: form.servings ? Number(form.servings) : undefined };
    try {
      if (editId) {
        await api.put(`/meals/${editId}`, payload);
        flash(setSuccess, `✅ ${t('scheduleMealBtn')}!`);
      } else {
        await api.post('/meals', payload);
        flash(setSuccess, `✅ ${t('scheduleMealBtn')}!`);
      }
      setShowForm(false);
      setForm(emptyMealForm());
      setEditId(null);
      await fetchMeals();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this meal. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  /* ── delete ──────────────────────────────────────────────── */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/meals/${deleteModal._id}`);
      setMeals(prev => prev.filter(m => m._id !== deleteModal._id));
      flash(setSuccess, `🗑️ "${deleteModal.name}" removed.`);
    } catch (deleteError) { flash(setError, deleteError.response?.data?.message || 'Delete failed.'); }
    finally {
      setDeleting(false);
      setDeleteModal(null);
    }
  };

  const openIntake = meal => {
    setIntakeMeal(meal);
    setIntakeRecords((meal.children || []).map(child => {
      const existing = (meal.intake || []).find(entry =>
        String(entry.child?._id || entry.child) === String(child._id)
      );
      return {
        childId: child._id,
        status: existing?.status || '',
        quantity: existing?.quantity ?? '',
        notes: existing?.notes || ''
      };
    }));
  };

  const saveIntake = async event => {
    event.preventDefault();
    if (!intakeMeal || intakeSaving) return;
    if (intakeRecords.some(record => !record.status)) {
      setError('Choose an intake status for each assigned child before saving.');
      return;
    }
    setIntakeSaving(true);
    setError('');
    try {
      const response = await api.put(`/meals/${intakeMeal._id}/intake`, { records: intakeRecords });
      if (!response.data?.success || !response.data.data) {
        throw new Error('The meal intake service returned an invalid response.');
      }
      setMeals(current => current.map(meal => meal._id === intakeMeal._id ? response.data.data : meal));
      setIntakeMeal(null);
      flash(setSuccess, 'Meal intake saved.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || saveError.message || 'Could not save meal intake. Please retry.');
    } finally {
      setIntakeSaving(false);
    }
  };

  /* ── split today / upcoming / past ──────────────────────── */
  const today = todayStr();
  const filterMeals = meals.filter(meal => {
    const name = String(meal.name || '').toLowerCase();
    const menu = String(meal.items || '').toLowerCase();
    const childrenNames = (meal.children || []).map(child => `${child.firstName || ''} ${child.lastName || ''}`).join(' ').toLowerCase();
    const classroomName = String(meal.classroom?.name || '').toLowerCase();
    const query = search.trim().toLowerCase();
    const date = dateStr(meal.date);
    return (!query || name.includes(query) || menu.includes(query) || childrenNames.includes(query) || classroomName.includes(query)) &&
      (!filterType || meal.type === filterType) &&
      (!filterStatus || (meal.status || 'scheduled') === filterStatus) &&
      (!filterDateFrom || date >= filterDateFrom) &&
      (!filterDateTo || date <= filterDateTo);
  });
  const sortMealTime = (a, b) => dateStr(a.date).localeCompare(dateStr(b.date)) || String(a.time || '').localeCompare(String(b.time || ''));
  const todayMeals = filterMeals.filter(m => dateStr(m.date) === today).sort(sortMealTime);
  const upcomingMeals = filterMeals.filter(m => dateStr(m.date) > today).sort(sortMealTime);
  const pastMeals = filterMeals.filter(m => dateStr(m.date) < today).sort((a, b) => sortMealTime(b, a));
  const scheduledToday = meals.filter(m => dateStr(m.date) === today && (m.status || 'scheduled') !== 'cancelled');
  const mealClassrooms = classrooms.filter(classroom => classroom.status === 'active');
  const formChildren = form.classroom
    ? children.filter(child => String(child.classroom?._id || child.classroom) === String(form.classroom))
    : [];
  const refreshMealData = () => {
    fetchMeals();
    fetchClassrooms();
    if (form.classroom) fetchMealStudents(form.classroom);
  };
  const formStatusOptions = !editId ? ['scheduled']
    : form.status === 'scheduled' ? ['scheduled', 'prepared', 'cancelled']
      : form.status === 'prepared' ? ['prepared', 'served', 'cancelled']
        : form.status === 'served' ? ['served']
          : ['scheduled', 'cancelled'];
  const selectedChildren = children.filter(child => form.children.includes(child._id));
  const allergyWarnings = selectedChildren.flatMap(child => {
    const allergies = String(child.allergies || '').split(/[,;]+/).map(value => value.trim()).filter(Boolean);
    return allergies.map(allergy => ({
      child: `${child.firstName || ''} ${child.lastName || ''}`.trim(),
      allergy,
      conflict: form.items.toLowerCase().includes(allergy.toLowerCase())
    }));
  });

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── DELETE MODAL ──────────────────────────────────────── */}
      <DeleteConfirmModal
        isOpen={!!deleteModal}
        title="Delete Meal"
        description={deleteModal ? `Remove "${deleteModal.name}" from the meal list?` : ''}
        warning="This action cannot be undone."
        onCancel={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel={deleting ? t('deleting') : t('delete')}
        cancelLabel={t('cancel')}
      />

      {viewMeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="meal-view-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111c2d]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="meal-view-title" className="text-lg font-bold text-slate-800 dark:text-white">{viewMeal.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{viewMeal.type} · {formatMealDate(viewMeal.date)} · {viewMeal.time}</p>
              </div>
              <button type="button" aria-label="Close meal details" onClick={() => setViewMeal(null)} className="text-xl text-slate-400">×</button>
            </div>
            <dl className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div><dt className="font-semibold">Menu items</dt><dd>{viewMeal.items || '—'}</dd></div>
              <div><dt className="font-semibold">Servings</dt><dd>{viewMeal.servings || 'Not specified'}</dd></div>
              <div><dt className="font-semibold">Status</dt><dd>{viewMeal.status || 'scheduled'}</dd></div>
              <div><dt className="font-semibold">Allergy information</dt><dd>{viewMeal.allergies || 'None entered on this meal schedule. This does not confirm the meal is safe for every child.'}</dd></div>
              <div><dt className="font-semibold">Preparation notes</dt><dd>{viewMeal.notes || '—'}</dd></div>
              <div><dt className="font-semibold">Classroom</dt><dd>{viewMeal.classroom?.name || 'Not specified'}</dd></div>
              {viewMeal.children?.length > 0 && <div><dt className="font-semibold">Assigned children</dt><dd>{viewMeal.children.map(child => `${child.firstName || ''} ${child.lastName || ''}`.trim()).filter(Boolean).join(', ') || 'No assigned child names available in your scope.'}</dd></div>}
              {viewMeal.intake?.length > 0 && <div><dt className="font-semibold">Recorded intake</dt><dd>{viewMeal.intake.map(entry => `${entry.child?.firstName || 'Child'}: ${entry.status.replaceAll('_', ' ')}${entry.quantity !== undefined ? ` (${entry.quantity}%)` : ''}`).join('; ')}</dd></div>}
            </dl>
            <button type="button" onClick={() => setViewMeal(null)} className="mt-5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">Close</button>
          </div>
        </div>
      )}

      {intakeMeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={saveIntake} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111c2d]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Record meal intake</h3>
                <p className="mt-1 text-sm text-slate-500">{intakeMeal.name} · {formatMealDate(intakeMeal.date)}</p>
              </div>
              <button type="button" aria-label="Close intake form" onClick={() => setIntakeMeal(null)} className="text-xl text-slate-400">×</button>
            </div>
            <div className="mt-5 max-h-[60vh] space-y-4 overflow-y-auto">
              {intakeRecords.map((record, index) => {
                const child = intakeMeal.children?.find(item => String(item._id) === String(record.childId));
                return (
                  <div key={record.childId} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 dark:border-teal-900/40 sm:grid-cols-3">
                    <div className="self-center text-sm font-semibold text-slate-700 dark:text-slate-200">{child ? `${child.firstName} ${child.lastName}` : 'Assigned child'}</div>
                    <select aria-label={`Intake status for ${child?.firstName || 'child'}`} required value={record.status}
                      onChange={event => setIntakeRecords(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value } : item))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
                      <option value="">Select intake status</option>
                      <option value="eaten">Eaten</option>
                      <option value="partially_eaten">Partially eaten</option>
                      <option value="not_eaten">Not eaten</option>
                      <option value="refused">Refused</option>
                    </select>
                    <input type="number" min="0" max="100" aria-label={`Eaten quantity percentage for ${child?.firstName || 'child'}`}
                      placeholder="Quantity % (optional)" value={record.quantity}
                      onChange={event => setIntakeRecords(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
                    <input type="text" maxLength="500" aria-label={`Intake notes for ${child?.firstName || 'child'}`}
                      placeholder="Notes (optional)" value={record.notes}
                      onChange={event => setIntakeRecords(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white sm:col-span-3" />
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setIntakeMeal(null)} disabled={intakeSaving} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-[#0d1520] dark:text-slate-300">Cancel</button>
              <button type="submit" disabled={intakeSaving || intakeRecords.length === 0} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{intakeSaving ? 'Saving…' : 'Save intake'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('mealPreparationTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('mealPreparationSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refreshMealData} disabled={loading || classroomsLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-teal-900/40 dark:text-slate-300 dark:hover:bg-white/5">
            <i className={`bx bx-refresh ${loading ? 'bx-spin' : ''}`} />
            {loading ? t('loading', 'Refreshing…') : 'Refresh'}
          </button>
        {canEdit && (
          <button onClick={() => showForm ? setShowForm(false) : openCreate()}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
            <i className={`bx ${showForm ? 'bx-x' : 'bx-plus'}`} />
            {showForm ? t('cancel') : t('scheduleMeal')}
          </button>
        )}
        </div>
      </div>

      {/* ── ALERTS ───────────────────────────────────────────── */}
      {error   && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">{success}</div>}
      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={refreshMealData} disabled={loading || classroomsLoading} className="self-start rounded-lg border border-rose-400/40 px-3 py-1.5 font-semibold disabled:opacity-50 sm:self-auto">
            {loading ? t('loading', 'Loading…') : t('retry', 'Retry')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-teal-900/30 dark:bg-[#111c2d] sm:grid-cols-2 lg:grid-cols-5">
        <input aria-label="Search meals" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search meals or menu items" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
        <select aria-label="Filter meal type" value={filterType} onChange={event => setFilterType(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
          <option value="">All meal types</option>
          {MEAL_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <select aria-label="Filter meal status" value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
          <option value="">All statuses</option>
          {(editId
            ? form.status === 'scheduled' ? ['scheduled', 'prepared', 'cancelled']
              : form.status === 'prepared' ? ['prepared', 'served', 'cancelled']
                : form.status === 'served' ? ['served']
                  : ['scheduled', 'cancelled']
            : ['scheduled']
          ).map(status => <option key={status} value={status}>{status}</option>)}
        </select>
        <input aria-label="Filter meals from date" type="date" value={filterDateFrom} onChange={event => setFilterDateFrom(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
        <input aria-label="Filter meals to date" type="date" min={filterDateFrom || undefined} value={filterDateTo} onChange={event => setFilterDateTo(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
      </div>

      {/* ── ADD / EDIT FORM ──────────────────────────────────── */}
      {showForm && canEdit && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-5">
            {editId ? t('editMeal') : t('scheduleNewMeal')}
          </h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* name */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('mealNameLabel')}</label>
              <input type="text" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Morning Oatmeal"
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {/* type */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('mealTypeLable')}</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {MEAL_TYPES.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
              </select>
            </div>
            {/* date */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('dateLabel')}</label>
              <input type="date" required value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {/* time */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('timeLabel')}</label>
              <input type="time" required value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Servings (optional)</label>
              <input type="number" min="1" max="1000" value={form.servings}
                onChange={e => setForm({ ...form, servings: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Preparation status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {formStatusOptions.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Assigned classroom</label>
              <select required value={form.classroom}
                onChange={e => {
                  const classroomId = e.target.value;
                  setForm(current => ({ ...current, classroom: classroomId, children: [] }));
                  if (classroomId) fetchMealStudents(classroomId);
                  else {
                    studentsRequestId.current += 1;
                    setChildren([]);
                    setStudentsError('');
                    setStudentsLoading(false);
                  }
                }}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select a classroom</option>
                        {mealClassrooms.map(classroom => <option key={classroom._id} value={classroom._id}>{classroom.name}{classroom.room ? ` · ${classroom.room}` : ''}</option>)}
              </select>
                      {classroomsLoading && <p className="mt-1 text-xs text-slate-400">Loading assigned active classrooms…</p>}
                      {classroomsError && <div role="alert" className="mt-1 text-xs text-rose-500">{classroomsError} Ask an administrator to check the classroom assignment, then <button type="button" onClick={fetchClassrooms} className="font-semibold underline">retry</button>.</div>}
                      {!classroomsLoading && !classroomsError && mealClassrooms.length === 0 && <p className="mt-1 text-xs text-rose-500">No active classroom is assigned to this nanny account. Ask an administrator to assign an existing active classroom.</p>}
                      {form.classroom && studentsError && <p role="alert" className="mt-1 text-xs text-rose-500">{studentsError}</p>}
                      {form.classroom && !studentsLoading && !studentsError && formChildren.length === 0 && <p className="mt-1 text-xs text-amber-600">No active or approved children are linked to this classroom. Ask an administrator to approve eligible registrations and assign those children to this classroom.</p>}
            </div>
            {/* items */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('menuItems')}</label>
              <input type="text" required value={form.items}
                onChange={e => setForm({ ...form, items: e.target.value })}
                placeholder="e.g. Oatmeal, Fresh Fruits, Milk"
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {/* allergies */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('allergyNotes')}</label>
              <input type="text" value={form.allergies}
                onChange={e => setForm({ ...form, allergies: e.target.value })}
                placeholder="e.g. Contains nuts, Dairy-free options available"
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {/* notes */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('additionalNotes')}</label>
              <textarea rows={2} value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder={t('notesPlaceholder')}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            {/* students multi-select */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2">
                <i className="bx bx-group text-indigo-400" />
                {t('selectStudents')}
                {form.children.length > 0 && (
                  <span className="ml-1 text-[10px] font-bold bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                    {form.children.length}
                  </span>
                )}
              </label>
              <MultiStudentSelect
                children={formChildren}
                selected={form.children}
                onChange={ids => setForm({ ...form, children: ids })}
                t={t}
                loading={studentsLoading}
                error={studentsError}
                emptyMessage={form.classroom
                  ? `No eligible children are linked to this active classroom. Children must be active or approved and assigned to the selected classroom. Ask an administrator to check each child's approval status and classroom assignment.`
                  : 'Choose an active classroom to load its eligible children.'}
                onRetry={() => fetchMealStudents(form.classroom)}
              />
              {selectedChildren.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-amber-600 dark:text-amber-400">Review recorded dietary restrictions before scheduling. Missing information does not confirm a meal is safe.</p>
                  {allergyWarnings.length === 0 ? (
                    <p className="mt-1">No allergy information is recorded for the selected children.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {allergyWarnings.map((warning, index) => (
                        <li key={`${warning.child}-${warning.allergy}-${index}`} className={warning.conflict ? 'font-semibold text-rose-500' : ''}>
                          {warning.child}: {warning.allergy}{warning.conflict ? ' — possible menu text match; verify before serving.' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {/* actions */}
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors">
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50">
                {saving ? t('saving') : editId ? t('saveChanges') : t('scheduleMealBtn')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── STATS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {MEAL_TYPES.map(t => (
          <div key={t.value} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-${t.color}-500/10 flex items-center justify-center`}>
                <i className={`bx ${t.icon} text-xl text-${t.color}-400`} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {loading || loadError ? '—' : scheduledToday.filter(m => m.type === t.value).length}
                </p>
                <p className="text-xs text-slate-500">Today's {t.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── TODAY'S MEALS ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-teal-900/30 bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bx bx-calendar text-emerald-400" /> {t('todaysMeals')} ({todayMeals.length})
          </h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-10 text-rose-400 text-sm">Today's meals are unavailable until the meal schedule can be loaded.</div>
        ) : todayMeals.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">{filterMeals.some(m => dateStr(m.date) === today) ? 'No meals match the current filters.' : t('noMealsToday')}</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {todayMeals.map(meal => {
              const t = MEAL_TYPES.find(x => x.value === meal.type);
              return (
                <div key={meal._id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl bg-${t?.color || 'indigo'}-500/10 flex items-center justify-center flex-shrink-0`}>
                      <i className={`bx ${t?.icon || 'bx-bowl-hot'} text-2xl text-${t?.color || 'indigo'}-400`} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white">{meal.name}</p>
                      <p className="text-xs text-slate-400">{meal.time} · {meal.items}{meal.servings ? ` · ${meal.servings} servings` : ''}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${(meal.status || 'scheduled') === 'served' ? 'bg-emerald-500/10 text-emerald-500' : (meal.status || 'scheduled') === 'cancelled' ? 'bg-slate-500/10 text-slate-400' : (meal.status || 'scheduled') === 'prepared' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'}`}>{meal.status || 'scheduled'}</span>
                      {meal.allergies && <p className="text-xs text-rose-400 mt-0.5">⚠️ {meal.allergies}</p>}
                      {meal.notes && <p className="text-xs text-slate-400 italic mt-0.5">{meal.notes}</p>}
                      {meal.classroom?.name && <p className="text-xs text-slate-400 mt-0.5">Classroom: {meal.classroom.name}</p>}
                      {/* assigned students */}
                      {meal.children && meal.children.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <i className="bx bx-group text-xs text-indigo-400" />
                          {meal.children.slice(0, 4).map((c, i) => (
                            <span key={i} className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">
                              {c.firstName ? `${c.firstName} ${c.lastName}` : c}
                            </span>
                          ))}
                          {meal.children.length > 4 && (
                            <span className="text-[10px] text-slate-400">+{meal.children.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button type="button" onClick={() => setViewMeal(meal)} aria-label={`View ${meal.name}`} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                        <i className="bx bx-show text-lg" />
                      </button>
                      {(meal.status || 'scheduled') !== 'served' && <button type="button" onClick={() => openEdit(meal)}
                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                        <i className="bx bx-edit-alt text-lg" />
                      </button>}
                      <button onClick={() => setDeleteModal(meal)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <i className="bx bx-trash text-lg" />
                      </button>
                    </div>
                  )}
                  {user?.role === 'teacher' && meal.children?.length > 0 && meal.status === 'served' && (
                    <button type="button" onClick={() => openIntake(meal)} className="ml-3 flex-shrink-0 rounded-lg bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-500 hover:bg-indigo-500/20">
                      Record intake
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── UPCOMING MEALS ───────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-teal-900/30">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bx bx-calendar-star text-indigo-400" /> {t('upcomingMeals')} ({upcomingMeals.length})
          </h3>
        </div>
        {loading || loadError || upcomingMeals.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">{loading ? t('loading', 'Loading meals…') : loadError ? 'Upcoming meals are unavailable until the schedule can be loaded.' : t('noUpcomingMeals')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]/50">
                  {[t('mealCol'), t('typeColMeal'), t('dateCol2'), t('timeCol'), t('itemsCol'), ''].map((h, i) => (
                    <th key={i} className={`px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcomingMeals.map(meal => {
                  const t = MEAL_TYPES.find(x => x.value === meal.type);
                  return (
                    <tr key={meal._id} className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-white">{meal.name}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-lg bg-${t?.color || 'indigo'}-500/10 text-${t?.color || 'indigo'}-400`}>
                          {t?.label || meal.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {formatMealDate(meal.date)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{meal.time}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs max-w-[180px] truncate">{meal.items}{meal.servings ? ` · ${meal.servings} servings` : ''}<br /><span className="text-[10px]">{meal.status || 'scheduled'}{meal.classroom?.name ? ` · ${meal.classroom.name}` : ''}</span></td>
                      <td className="px-6 py-4 text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" aria-label={`View ${meal.name}`} onClick={() => setViewMeal(meal)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                              <i className="bx bx-show" />
                            </button>
                            {(meal.status || 'scheduled') !== 'served' && <button type="button" onClick={() => openEdit(meal)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                              <i className="bx bx-edit-alt" />
                            </button>}
                            <button onClick={() => setDeleteModal(meal)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                              <i className="bx bx-trash" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PAST MEALS (collapsed) ────────────────────────────── */}
      {!loading && !loadError && pastMeals.length > 0 && (
        <details className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
          <summary className="px-6 py-4 cursor-pointer font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2 select-none">
            <i className="bx bx-history text-slate-400" /> {t('pastMeals')} ({pastMeals.length})
          </summary>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {pastMeals.slice().reverse().map(meal => {
              const t = MEAL_TYPES.find(x => x.value === meal.type);
              return (
                <div key={meal._id} className="flex items-center justify-between px-6 py-3 opacity-70">
                  <div className="flex items-center gap-3">
                    <i className={`bx ${t?.icon || 'bx-bowl-hot'} text-lg text-${t?.color || 'indigo'}-400`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{meal.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatMealDate(meal.date)} · {meal.time} · {meal.status || 'scheduled'}{meal.servings ? ` · ${meal.servings} servings` : ''}{meal.classroom?.name ? ` · ${meal.classroom.name}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meal.items || 'No menu items recorded.'}</p>
                      {meal.children?.length > 0 && <p className="mt-1 text-xs text-slate-400">Children: {meal.children.map(child => `${child.firstName || ''} ${child.lastName || ''}`.trim()).filter(Boolean).join(', ')}</p>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`View ${meal.name}`} onClick={() => setViewMeal(meal)} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg"><i className="bx bx-show" /></button>
                      {(meal.status || 'scheduled') !== 'served' && <button type="button" aria-label={`Edit ${meal.name}`} onClick={() => openEdit(meal)} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg"><i className="bx bx-edit-alt" /></button>}
                      <button type="button" aria-label={`Delete ${meal.name}`} onClick={() => setDeleteModal(meal)} className="p-1.5 text-slate-300 hover:text-rose-400 rounded-lg"><i className="bx bx-trash" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}

    </div>
  );
};

export default MealPrep;
