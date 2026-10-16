import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import Pagination from '../../components/shared/Pagination';

const VACCINES = [
  'Hepatitis B',
  'DTaP (Diphtheria, Tetanus, Pertussis)',
  'Hib (Haemophilus influenzae)',
  'PCV15 / PCV20 (Pneumococcal)',
  'IPV (Polio)',
  'Influenza (Flu)',
  'MMR (Measles, Mumps, Rubella)',
  'Varicella (Chickenpox)',
  'Hepatitis A',
  'COVID-19'
];
const PAGE_SIZE = 10;
const STATUS_OPTIONS = ['Up to Date', 'Upcoming', 'Overdue'];

const toDateInput = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const ageInYears = dateOfBirth => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  if (
    now.getMonth() < birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())
  ) age -= 1;
  return age >= 0 ? age : null;
};

const localDay = value => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const VaccinationLog = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [childFilter, setChildFilter] = useState('');
  const [vaccineFilter, setVaccineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('dateNewest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    childId: '',
    name: '',
    customName: '',
    doseNumber: '',
    dateGiven: '',
    nextDueDate: '',
    status: '',
    provider: '',
    givenBy: user?.fullName || '',
    notes: ''
  });

  const canEdit = ['admin', 'reception', 'teacher'].includes(user?.role);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/vaccinations');
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('The vaccination service returned an invalid response.');
      }
      setChildren(response.data.data);
    } catch (loadError) {
      setChildren([]);
      setError(
        loadError.response?.data?.message ||
        loadError.message ||
        'Could not load vaccination data. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const allLogs = useMemo(() => children.flatMap(child =>
    (Array.isArray(child.vaccinationLog) ? child.vaccinationLog : []).map(log => ({ child, log }))
  ), [children]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = localDay(dateFrom);
    const to = localDay(dateTo);
    return allLogs.filter(({ child, log }) => {
      const childName = `${child.firstName || ''} ${child.lastName || ''}`.toLowerCase();
      const vaccineName = String(log.name || '').toLowerCase();
      const matchesSearch = !query || childName.includes(query) || vaccineName.includes(query);
      const matchesChild = !childFilter || String(child._id) === childFilter;
      const matchesVaccine = !vaccineFilter || log.name === vaccineFilter;
      const matchesStatus = !statusFilter || log.status === statusFilter;
      const given = log.dateGiven ? new Date(log.dateGiven) : null;
      const validGivenDate = given && !Number.isNaN(given.getTime());
      const matchesFrom = !from || (validGivenDate && given >= from);
      const matchesTo = !to || (validGivenDate && given < new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1));
      return matchesSearch && matchesChild && matchesVaccine && matchesStatus && matchesFrom && matchesTo;
    }).sort((a, b) => {
      const nameA = `${a.child.firstName || ''} ${a.child.lastName || ''}`.trim();
      const nameB = `${b.child.firstName || ''} ${b.child.lastName || ''}`.trim();
      const dateA = a.log.dateGiven ? new Date(a.log.dateGiven).getTime() : null;
      const dateB = b.log.dateGiven ? new Date(b.log.dateGiven).getTime() : null;
      const ageA = ageInYears(a.child.dateOfBirth);
      const ageB = ageInYears(b.child.dateOfBirth);
      if (sortBy === 'childAsc') return nameA.localeCompare(nameB);
      if (sortBy === 'childDesc') return nameB.localeCompare(nameA);
      if (sortBy === 'ageYoungest') return (ageA ?? Infinity) - (ageB ?? Infinity);
      if (sortBy === 'ageOldest') return (ageB ?? -Infinity) - (ageA ?? -Infinity);
      if (sortBy === 'vaccineAsc') return String(a.log.name || '').localeCompare(String(b.log.name || ''));
      if (sortBy === 'statusAsc') return String(a.log.status || '').localeCompare(String(b.log.status || ''));
      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return sortBy === 'dateOldest' ? dateA - dateB : dateB - dateA;
    });
  }, [allLogs, search, childFilter, vaccineFilter, statusFilter, dateFrom, dateTo, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pageLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const childrenWithStatus = status => new Set(
    allLogs.filter(({ log }) => log.status === status).map(({ child }) => String(child._id))
  ).size;
  const summary = {
    total: children.length,
    current: childrenWithStatus('Up to Date'),
    upcoming: childrenWithStatus('Upcoming'),
    overdue: childrenWithStatus('Overdue')
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      childId: '',
      name: '',
      customName: '',
      doseNumber: '',
      dateGiven: '',
      nextDueDate: '',
      status: '',
      provider: '',
      givenBy: user?.fullName || '',
      notes: ''
    });
    setFormError('');
  };

  const openEdit = item => {
    setEditing(item);
    setForm({
      childId: String(item.child._id),
      name: VACCINES.includes(item.log.name) ? item.log.name : 'Other',
      customName: VACCINES.includes(item.log.name) ? '' : item.log.name || '',
      doseNumber: item.log.doseNumber || '',
      dateGiven: toDateInput(item.log.dateGiven),
      nextDueDate: toDateInput(item.log.nextDueDate),
      status: item.log.status || '',
      provider: item.log.provider || '',
      givenBy: item.log.givenBy || '',
      notes: item.log.notes || ''
    });
    setFormError('');
    setShowForm(true);
  };

  const saveRecord = async event => {
    event.preventDefault();
    if (saving) return;
    const name = form.name === 'Other' ? form.customName.trim() : form.name;
    if (!form.childId || !name || !form.dateGiven || !form.status) {
      setFormError('Select a child, vaccine, administration date, and status.');
      return;
    }
    const administered = localDay(form.dateGiven);
    const nextDue = localDay(form.nextDueDate);
    if (!administered || administered > new Date(new Date().setHours(23, 59, 59, 999))) {
      setFormError('Enter a valid administration date that is not in the future.');
      return;
    }
    if (form.nextDueDate && (!nextDue || nextDue < administered)) {
      setFormError('Next due date must be a valid date on or after the administration date.');
      return;
    }

    setSaving(true);
    setFormError('');
    setError('');
    const body = {
      name,
      dateGiven: form.dateGiven,
      nextDueDate: form.nextDueDate || undefined,
      doseNumber: form.doseNumber || undefined,
      status: form.status,
      provider: form.provider,
      givenBy: form.givenBy,
      notes: form.notes
    };
    try {
      if (editing) {
        await api.put(`/vaccinations/${editing.child._id}/${editing.log._id}`, body);
        setSuccess('Vaccination record updated.');
      } else {
        await api.post('/vaccinations', { ...body, childId: form.childId });
        setSuccess('Vaccination record saved.');
      }
      setShowForm(false);
      resetForm();
      await loadData();
    } catch (saveError) {
      setFormError(saveError.response?.data?.message || 'Could not save this vaccination record. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async item => {
    if (!window.confirm(`Delete the ${item.log.name || 'vaccination'} record for ${item.child.firstName || 'this child'}?`)) return;
    setError('');
    try {
      await api.delete(`/vaccinations/${item.child._id}/${item.log._id}`);
      setSuccess('Vaccination record deleted.');
      await loadData();
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete this vaccination record. Please retry.');
    }
  };

  const flashStatus = status => {
    if (status === 'Up to Date') return 'bg-emerald-500/10 text-emerald-500';
    if (status === 'Upcoming') return 'bg-amber-500/10 text-amber-500';
    if (status === 'Overdue') return 'bg-rose-500/10 text-rose-500';
    return 'bg-slate-100 text-slate-500';
  };

  const formatDate = value => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('vaccinationLogTitle', 'Vaccination Log')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('vaccinationLogSubtitle', 'Immunisation records and schedule')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            aria-label="Search child or vaccine"
            placeholder={t('searchChildPlaceholder', 'Search child or vaccine')}
            value={search}
            onChange={event => { setSearch(event.target.value); setCurrentPage(1); }}
            className="w-full sm:w-64 rounded-full border border-slate-200 dark:border-teal-900/30 bg-white dark:bg-[#111c2d] py-2 pl-4 pr-4 text-sm text-slate-800 dark:text-white"
          />
          {canEdit && (
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(true); }}
              disabled={children.length === 0}
              className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('addRecord', 'Add Record')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadData} disabled={loading} className="self-start rounded-lg border border-rose-400/40 px-3 py-1.5 font-semibold disabled:opacity-50 sm:self-auto">
            {loading ? t('loading', 'Loading…') : t('retry', 'Retry')}
          </button>
        </div>
      )}
      {success && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-500">{success}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Eligible Children', value: loading || error ? '—' : summary.total, color: 'text-blue-500' },
          { label: 'Children with Up-to-date Records', value: loading || error ? '—' : summary.current, color: 'text-emerald-500' },
          { label: 'Children with Upcoming Doses', value: loading || error ? '—' : summary.upcoming, color: 'text-amber-500' },
          { label: 'Children with Overdue Doses', value: loading || error ? '—' : summary.overdue, color: 'text-rose-500' }
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-teal-900/30 dark:bg-[#111c2d]">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`mt-2 text-2xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Status counts reflect explicitly recorded vaccination entries; no vaccination schedule is configured, so missing history is not assumed current or overdue.
      </p>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-teal-900/30 dark:bg-[#111c2d]">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 dark:border-teal-900/30 sm:grid-cols-2 lg:grid-cols-6">
          <select aria-label="Filter child" value={childFilter} onChange={event => { setChildFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
            <option value="">All children</option>
            {children.map(child => <option key={child._id} value={child._id}>{child.firstName} {child.lastName}</option>)}
          </select>
          <select aria-label="Filter vaccine" value={vaccineFilter} onChange={event => { setVaccineFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
            <option value="">All vaccines</option>
            {[...new Set(allLogs.map(item => item.log.name).filter(Boolean))].sort().map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select aria-label="Filter status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <input aria-label="Date from" type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
          <input aria-label="Date to" type="date" value={dateTo} onChange={event => { setDateTo(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
          <select aria-label="Sort vaccination records" value={sortBy} onChange={event => { setSortBy(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
            <option value="dateNewest">Date (newest)</option>
            <option value="dateOldest">Date (oldest)</option>
            <option value="childAsc">Child (A–Z)</option>
            <option value="childDesc">Child (Z–A)</option>
            <option value="ageYoungest">Age (youngest)</option>
            <option value="ageOldest">Age (oldest)</option>
            <option value="vaccineAsc">Vaccine (A–Z)</option>
            <option value="statusAsc">Status (A–Z)</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-teal-900/20">
            <thead className="bg-slate-50/80 dark:bg-[#0d1520]/80">
              <tr>
                {['Child', 'Age', 'Vaccine / Dose', 'Date given', 'Next due', 'Status', 'Provider / recorded by', ...(canEdit ? ['Actions'] : [])].map(title => (
                  <th key={title} className="whitespace-nowrap px-5 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-teal-900/20">
              {loading ? (
                <tr><td colSpan={canEdit ? 8 : 7} className="py-12 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" /></td></tr>
              ) : error ? (
                <tr><td colSpan={canEdit ? 8 : 7} className="py-12 text-center text-sm text-slate-500">Vaccination data could not be loaded. Use Retry above.</td></tr>
              ) : pageLogs.length === 0 ? (
                <tr><td colSpan={canEdit ? 8 : 7} className="px-6 py-16 text-center text-sm text-slate-400">
                  <i className="bx bx-injection text-4xl opacity-40" />
                  <p className="mt-2">{allLogs.length === 0
                    ? children.length > 0 ? 'No vaccination records are saved for eligible children yet.' : 'No eligible children are available in your authorized classroom scope.'
                    : 'No vaccination records match the selected search and filters.'}</p>
                  {allLogs.length === 0 && children.length > 0 && canEdit && (
                    <button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="mt-3 font-semibold text-teal-600 hover:text-teal-700">Add the first record</button>
                  )}
                </td></tr>
              ) : pageLogs.map(({ child, log }) => (
                <tr key={`${child._id}-${log._id}`} className="hover:bg-slate-50/50 dark:hover:bg-[#162030]/50">
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex items-center gap-3">
                      {child.photoUrl
                        ? <img src={child.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                        : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-[#0d1520] dark:text-slate-300">{child.firstName?.[0] || '?'}{child.lastName?.[0] || ''}</div>}
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-slate-400">{child.classroom?.name || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ageInYears(child.dateOfBirth) ?? '—'}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{log.name || '—'}{log.doseNumber ? ` · Dose ${log.doseNumber}` : ''}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{formatDate(log.dateGiven)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{formatDate(log.nextDueDate)}</td>
                  <td className="whitespace-nowrap px-5 py-4"><span className={`rounded-full px-3 py-1 text-[11px] font-bold ${flashStatus(log.status)}`}>{log.status || 'Unknown'}</span></td>
                  <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{log.provider || log.givenBy || '—'}</td>
                  {canEdit && <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex gap-2">
                      <button type="button" aria-label={`View ${log.name} record`} onClick={() => setViewing({ child, log })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-teal-500 dark:border-slate-700 dark:text-slate-300">View</button>
                      <button type="button" aria-label={`Edit ${log.name} record`} onClick={() => openEdit({ child, log })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-teal-500 dark:border-slate-700 dark:text-slate-300">Edit</button>
                      <button type="button" aria-label={`Delete ${log.name} record`} onClick={() => deleteRecord({ child, log })} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900/50">Delete</button>
                    </div>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && filteredLogs.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredLogs.length} itemsPerPage={PAGE_SIZE} itemLabel="records" />
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="vaccination-form-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-teal-900/30 dark:bg-[#111c2d]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-teal-900/30">
              <h3 id="vaccination-form-title" className="font-bold text-slate-800 dark:text-white">{editing ? 'Edit vaccination record' : 'Add vaccination record'}</h3>
              <button type="button" aria-label="Close" onClick={() => { setShowForm(false); resetForm(); }} className="text-xl text-slate-400">×</button>
            </div>
            <form onSubmit={saveRecord} className="space-y-4 p-6">
              {formError && <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500">{formError}</p>}
              <label className="block text-xs font-bold text-slate-500">CHILD *
                <select required disabled={Boolean(editing)} value={form.childId} onChange={event => setForm(prev => ({ ...prev, childId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
                  <option value="">Select eligible child</option>
                  {children.map(child => <option key={child._id} value={child._id}>{child.firstName} {child.lastName}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-500">VACCINE *
                <select required value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
                  <option value="">Select vaccine</option>
                  {VACCINES.map(name => <option key={name} value={name}>{name}</option>)}
                  <option value="Other">Other</option>
                </select>
              </label>
              {form.name === 'Other' && <label className="block text-xs font-bold text-slate-500">VACCINE NAME *
                <input required value={form.customName} onChange={event => setForm(prev => ({ ...prev, customName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
              </label>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-500">DOSE NUMBER
                  <input type="number" min="1" max="100" value={form.doseNumber} onChange={event => setForm(prev => ({ ...prev, doseNumber: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
                </label>
                <label className="block text-xs font-bold text-slate-500">DATE GIVEN *
                  <input type="date" required max={toDateInput(new Date())} value={form.dateGiven} onChange={event => setForm(prev => ({ ...prev, dateGiven: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
                </label>
                <label className="block text-xs font-bold text-slate-500">NEXT DUE DATE
                  <input type="date" min={form.dateGiven || undefined} value={form.nextDueDate} onChange={event => setForm(prev => ({ ...prev, nextDueDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
                </label>
                <label className="block text-xs font-bold text-slate-500">STATUS *
                  <select required value={form.status} onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white">
                    <option value="">Select recorded status</option>
                    {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-500">PROVIDER
                <input maxLength={120} value={form.provider} onChange={event => setForm(prev => ({ ...prev, provider: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
              </label>
              <label className="block text-xs font-bold text-slate-500">RECORDED BY
                <input readOnly value={form.givenBy} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
              </label>
              <label className="block text-xs font-bold text-slate-500">NOTES
                <textarea maxLength={1000} rows={3} value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-[#0d1520] dark:text-white" />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Update record' : 'Save record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="vaccination-detail-title" className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#111c2d]">
            <h3 id="vaccination-detail-title" className="text-lg font-bold text-slate-800 dark:text-white">{viewing.log.name} · {viewing.child.firstName} {viewing.child.lastName}</h3>
            <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div>Date given: {formatDate(viewing.log.dateGiven)}</div>
              <div>Next due: {formatDate(viewing.log.nextDueDate)}</div>
              <div>Dose: {viewing.log.doseNumber || '—'}</div>
              <div>Status: {viewing.log.status || 'Unknown'}</div>
              <div>Provider: {viewing.log.provider || '—'}</div>
              <div>Recorded by: {viewing.log.givenBy || '—'}</div>
              <div>Notes: {viewing.log.notes || '—'}</div>
            </dl>
            <button type="button" onClick={() => setViewing(null)} className="mt-5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaccinationLog;
