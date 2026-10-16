import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { getLocalDateKey } from '../../utils/localDate';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: 'bx-coffee' },
  { value: 'lunch', label: 'Lunch', icon: 'bx-bowl-hot' },
  { value: 'snack', label: 'Snack', icon: 'bx-cookie' },
  { value: 'dinner', label: 'Dinner', icon: 'bx-dish' },
];
const MEAL_STATUSES = ['scheduled', 'prepared', 'served', 'cancelled'];
const INTAKE_STATUSES = ['eaten', 'partially_eaten', 'not_eaten', 'refused'];
const INTAKE_LABELS = {
  eaten: 'Eaten',
  partially_eaten: 'Partially eaten',
  not_eaten: 'Not eaten',
  refused: 'Refused',
};
const dateKey = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value
  : getLocalDateKey(value);
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};
const formatDate = value => {
  const [year, month, day] = dateKey(value).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
const childName = child => `${child?.firstName || ''} ${child?.lastName || ''}`.trim() || 'Child';
const formatRecordedAt = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const ParentMealsIntake = () => {
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState('');
  const [meals, setMeals] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [childrenError, setChildrenError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [counterDate, setCounterDate] = useState(getLocalDateKey());
  const [pastExpanded, setPastExpanded] = useState(false);
  const requestId = useRef(0);

  const loadChildren = useCallback(async () => {
    setChildrenLoading(true);
    setChildrenError('');
    try {
      const response = await api.get('/children');
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('The child service returned an invalid response.');
      }
      setChildren(response.data.data);
      setChildId(current => current && response.data.data.some(child => String(child._id) === current) ? current : '');
    } catch (loadError) {
      setChildren([]);
      setChildrenError(loadError.response?.data?.message || loadError.message || 'Could not load your linked children.');
    } finally {
      setChildrenLoading(false);
    }
  }, []);

  const loadMeals = useCallback(async selectedChildId => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/meals', {
        params: { limit: 500, ...(selectedChildId ? { childId: selectedChildId } : {}) },
      });
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('The meal service returned an invalid response.');
      }
      if (currentRequest === requestId.current) setMeals(response.data.data);
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setMeals([]);
      setError(loadError.response?.data?.message || loadError.message || 'Could not load meal schedules. Please retry.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    loadMeals(childId);
  }, [childId, loadMeals]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadMeals(childId);
    };
    const interval = window.setInterval(() => loadMeals(childId), 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [childId, loadMeals]);

  const refresh = () => {
    loadChildren();
    loadMeals(childId);
  };

  const rangeError = (dateFrom && !validDate(dateFrom)) ||
    (dateTo && !validDate(dateTo)) ||
    (dateFrom && dateTo && dateFrom > dateTo)
    ? 'Choose a valid date range with the start date on or before the end date.'
    : '';

  const filteredMeals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return meals.filter(meal => {
      const mealDate = dateKey(meal.date);
      const text = [
        meal.name,
        meal.items,
        ...(meal.children || []).map(childName),
        ...(meal.children || []).map(child => child.allergies || ''),
      ].join(' ').toLocaleLowerCase();
      return (!query || text.includes(query)) &&
        (!type || meal.type === type) &&
        (!status ||
          (MEAL_STATUSES.includes(status)
            ? (meal.status || 'scheduled') === status
            : (meal.intake || []).some(entry => entry.status === status))) &&
        (!dateFrom || mealDate >= dateFrom) &&
        (!dateTo || mealDate <= dateTo);
    });
  }, [dateFrom, dateTo, meals, search, status, type]);

  const today = getLocalDateKey();
  const todayMeals = filteredMeals.filter(meal => dateKey(meal.date) === today).sort((a, b) => a.time.localeCompare(b.time));
  const upcomingMeals = filteredMeals.filter(meal => dateKey(meal.date) > today)
    .sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || a.time.localeCompare(b.time));
  const pastMeals = filteredMeals.filter(meal => dateKey(meal.date) < today)
    .sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)) || b.time.localeCompare(a.time));
  const selectedDateMeals = filteredMeals.filter(meal => dateKey(meal.date) === counterDate && (meal.status || 'scheduled') !== 'cancelled');

  const renderMeal = meal => {
    const intakeByChild = new Map((meal.intake || []).map(entry => [String(entry.child?._id || entry.child), entry]));
    return (
      <article key={meal._id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-teal-900/40 dark:bg-[#0d1520]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-white">{meal.name}</h4>
            <p className="mt-1 text-xs capitalize text-slate-500 dark:text-slate-400">
              {meal.type} · {formatDate(meal.date)} · {meal.time}
            </p>
          </div>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium capitalize text-indigo-500">
            {meal.status || 'scheduled'}
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{meal.items || 'No menu items recorded.'}</p>
        {meal.allergies && <p className="mt-2 text-xs text-rose-500">Meal allergy information: {meal.allergies}</p>}
        {meal.notes && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{meal.notes}</p>}
        {meal.createdByName && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Recorded by {meal.createdByName}</p>}
        <div className="mt-3 space-y-2">
          {(meal.children || []).map(child => {
            const intake = intakeByChild.get(String(child._id));
            return (
              <div key={child._id} className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{childName(child)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {intake ? INTAKE_LABELS[intake.status] || intake.status : 'Intake not recorded'}
                    {intake?.quantity !== undefined ? ` · ${intake.quantity}% eaten` : ''}
                  </span>
                </div>
                {child.allergies && <p className="mt-1 text-xs text-rose-500">Child allergies: {child.allergies}</p>}
                {intake?.notes && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Nanny note: {intake.notes}</p>}
                {intake?.recordedAt && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Recorded {formatRecordedAt(intake.recordedAt)}
                    {intake.recordedByName ? ` by ${intake.recordedByName}` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </article>
    );
  };

  const renderSection = (title, icon, entries, emptyText) => (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-teal-900/30 dark:bg-[#111c2d]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-teal-900/30">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <i className={`bx ${icon} text-indigo-400`} />{title}
        </h3>
        <span className="text-sm text-slate-500">{entries.length}</span>
      </div>
      {entries.length
        ? <div className="space-y-3 p-4">{entries.map(renderMeal)}</div>
        : <p className="px-5 py-8 text-center text-sm text-slate-500">{emptyText}</p>}
    </section>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Meals Intake</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Meal schedules and recorded intake for your linked children.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading || childrenLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-teal-900/40 dark:text-slate-300 dark:hover:bg-white/5">
          <i className={`bx bx-refresh ${loading || childrenLoading ? 'bx-spin' : ''}`} />Refresh
        </button>
      </header>

      {(error || childrenError) && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500">
          <span>{error || childrenError}</span>
          <button type="button" onClick={refresh} className="font-semibold underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-teal-900/30 dark:bg-[#111c2d] sm:grid-cols-2 lg:grid-cols-6">
        <select aria-label="Filter meals by child" value={childId} onChange={event => setChildId(event.target.value)}
          disabled={childrenLoading} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
          <option value="">All my children</option>
          {children.map(child => <option key={child._id} value={child._id}>{childName(child)}</option>)}
        </select>
        <input aria-label="Search meals or menu items" type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Search meals or menu items" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
        <select aria-label="Filter meal type" value={type} onChange={event => setType(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
          <option value="">All meal types</option>
          {MEAL_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select aria-label="Filter meal status" value={status} onChange={event => setStatus(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
          <option value="">All statuses</option>
          <optgroup label="Meal status">
            {MEAL_STATUSES.map(item => <option key={item} value={item}>{item}</option>)}
          </optgroup>
          <optgroup label="Intake status">
            {INTAKE_STATUSES.map(item => <option key={item} value={item}>{INTAKE_LABELS[item]}</option>)}
          </optgroup>
        </select>
        <input aria-label="Filter meals from date" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
        <input aria-label="Filter meals to date" type="date" min={dateFrom || undefined} value={dateTo} onChange={event => setDateTo(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
      </div>
      {rangeError && <p role="alert" className="text-sm text-rose-500">{rangeError}</p>}
      {!childrenLoading && !childrenError && children.length === 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600">No children are linked to your account yet, so there are no meal records to show.</p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-teal-900/30 dark:bg-[#111c2d]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">Scheduled meals by type</h3>
            <p className="text-xs text-slate-500">Counts are meal schedules, excluding cancelled meals; active filters apply.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Count date
            <input type="date" value={counterDate} onChange={event => setCounterDate(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {MEAL_TYPES.map(item => (
            <div key={item.value} className="rounded-xl bg-slate-50 p-4 text-center dark:bg-[#0d1520]">
              <i className={`bx ${item.icon} text-xl text-amber-500`} />
              <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">
                {selectedDateMeals.filter(meal => meal.type === item.value).length}
              </p>
              <p className="text-xs text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {loading ? (
        <div role="status" className="py-10 text-center text-sm text-slate-500">Loading meals…</div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-slate-500">Meal records are unavailable until the request succeeds.</div>
      ) : rangeError ? null : (
        <>
          {filteredMeals.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-teal-900/30 dark:bg-[#111c2d]">
              {meals.length === 0
                ? 'No meal records yet for your linked children.'
                : 'No meal records match the selected child and filters.'}
            </p>
          ) : (
            <>
          {renderSection('Today’s Meals', 'bx-calendar', todayMeals, 'No meal records are scheduled for today.')}
          {renderSection('Upcoming Meals', 'bx-calendar-star', upcomingMeals, 'No upcoming meal records are scheduled.')}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-teal-900/30 dark:bg-[#111c2d]">
            <button type="button" aria-expanded={pastExpanded} onClick={() => setPastExpanded(expanded => !expanded)}
              className="flex w-full items-center justify-between px-5 py-4 text-left font-bold text-slate-700 dark:text-slate-200">
              <span className="flex items-center gap-2"><i className="bx bx-history text-slate-400" />Past Meals ({pastMeals.length})</span>
              <i className={`bx ${pastExpanded ? 'bx-chevron-up' : 'bx-chevron-down'}`} />
            </button>
            {pastExpanded && (
              pastMeals.length
                ? <div className="space-y-3 border-t border-slate-100 p-4 dark:border-teal-900/30">{pastMeals.map(renderMeal)}</div>
                : <p className="border-t border-slate-100 px-5 py-8 text-center text-sm text-slate-500 dark:border-teal-900/30">No past meal records were found.</p>
            )}
          </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ParentMealsIntake;
