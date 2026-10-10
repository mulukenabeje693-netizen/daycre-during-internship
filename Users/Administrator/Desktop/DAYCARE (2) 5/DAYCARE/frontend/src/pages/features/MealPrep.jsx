import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';

const MEAL_TYPE_KEYS = [
  { value: 'breakfast', labelKey: 'breakfast', icon: 'bx-coffee',  color: 'amber'   },
  { value: 'lunch',     labelKey: 'lunch',     icon: 'bx-bowl-hot',color: 'emerald' },
  { value: 'snack',     labelKey: 'snack',     icon: 'bx-cookie',  color: 'purple'  },
  { value: 'dinner',    labelKey: 'dinner',    icon: 'bx-dish',    color: 'rose'    },
];

const todayStr = () => new Date().toISOString().split('T')[0];
const dateStr  = (d) => new Date(d).toISOString().split('T')[0];

const EMPTY = {
  name: '', type: 'breakfast',
  date: todayStr(), time: '',
  items: '', allergies: '', notes: '',
  children: [],
};

/* ── Multi-select dropdown component ─────────────────────── */
const MultiStudentSelect = ({ children, selected, onChange, t }) => {
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
                <i className="bx bx-search-alt text-2xl block mb-1" />
                {t('noStudentsAvailable')}
              </li>
            ) : filtered.map(child => {
              const isChecked = selected.includes(child._id);
              return (
                <li key={child._id}>
                  <button
                    type="button"
                    onClick={() => toggle(child._id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#0d1520] ${isChecked ? 'bg-indigo-500/5' : ''}`}
                  >
                    {/* Custom checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isChecked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {isChecked && <i className="bx bx-check text-white text-xs" />}
                    </div>
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
                  </button>
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
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  // form
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);   // null = create, id = update
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);

  // delete
  const [deleteModal,       setDeleteModal]       = useState(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(true);
  const [deleting,          setDeleting]          = useState(false);

  const flash = (setter, msg, ms = 3000) => { setter(msg); setTimeout(() => setter(''), ms); };

  /* ── fetch ───────────────────────────────────────────────── */
  const fetchMeals = async () => {
    try {
      setLoading(true);
      const res = await api.get('/meals');
      setMeals(res.data.data || []);
    } catch { setError('Failed to load meals.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    fetchMeals();
    api.get('/children').then(r => setChildren(r.data.data || [])).catch(() => {});
  }, []);

  /* ── permissions ─────────────────────────────────────────── */
  // teachers, admins AND staff can manage meals
  const canEdit = ['admin', 'staff', 'teacher'].includes(user?.role);

  /* ── open form ───────────────────────────────────────────── */
  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY);
    setError('');
    setShowForm(true);
  };

  const openEdit = (meal) => {
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
    });
    setError('');
    setShowForm(true);
  };

  /* ── save (create or update) ─────────────────────────────── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(t('mealNameRequired'));
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.put(`/meals/${editId}`, form);
        flash(setSuccess, `✅ ${t('scheduleMealBtn')}!`);
      } else {
        await api.post('/meals', form);
        flash(setSuccess, `✅ ${t('scheduleMealBtn')}!`);
      }
      setShowForm(false);
      setForm(EMPTY);
      setEditId(null);
      fetchMeals();
    } catch (err) {
      setError(err.response?.data?.message || t('mealNameRequired'));
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
    } catch { flash(setError, 'Delete failed.'); }
    finally {
      setDeleting(false);
      setDeleteModal(null);
      setDeleteForEveryone(true);
    }
  };

  /* ── split today / upcoming / past ──────────────────────── */
  const today    = todayStr();
  const todayMeals    = meals.filter(m => dateStr(m.date) === today);
  const upcomingMeals = meals.filter(m => dateStr(m.date) >  today);
  const pastMeals     = meals.filter(m => dateStr(m.date) <  today);

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

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('mealPreparationTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('mealPreparationSubtitle')}</p>
        </div>
        {canEdit && (
          <button onClick={() => showForm ? setShowForm(false) : openCreate()}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
            <i className={`bx ${showForm ? 'bx-x' : 'bx-plus'}`} />
            {showForm ? t('cancel') : t('scheduleMeal')}
          </button>
        )}
      </div>

      {/* ── ALERTS ───────────────────────────────────────────── */}
      {error   && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">{success}</div>}

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
                children={children}
                selected={form.children}
                onChange={ids => setForm({ ...form, children: ids })}
                t={t}
              />
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
                  {meals.filter(m => m.type === t.value).length}
                </p>
                <p className="text-xs text-slate-500">{t.label}</p>
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
        ) : todayMeals.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">{t('noMealsToday')}</div>
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
                      <p className="text-xs text-slate-400">{meal.time} · {meal.items}</p>
                      {meal.allergies && <p className="text-xs text-rose-400 mt-0.5">⚠️ {meal.allergies}</p>}
                      {meal.notes && <p className="text-xs text-slate-400 italic mt-0.5">{meal.notes}</p>}
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
                      <button onClick={() => openEdit(meal)}
                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                        <i className="bx bx-edit-alt text-lg" />
                      </button>
                      <button onClick={() => { setDeleteForEveryone(true); setDeleteModal(meal); }}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <i className="bx bx-trash text-lg" />
                      </button>
                    </div>
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
        {upcomingMeals.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">{t('noUpcomingMeals')}</div>
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
                        {new Date(meal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{meal.time}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs max-w-[180px] truncate">{meal.items}</td>
                      <td className="px-6 py-4 text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(meal)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                              <i className="bx bx-edit-alt" />
                            </button>
                            <button onClick={() => { setDeleteForEveryone(true); setDeleteModal(meal); }}
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
      {pastMeals.length > 0 && (
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
                        {new Date(meal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {meal.time}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => { setDeleteForEveryone(true); setDeleteModal(meal); }}
                      className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                      <i className="bx bx-trash" />
                    </button>
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
