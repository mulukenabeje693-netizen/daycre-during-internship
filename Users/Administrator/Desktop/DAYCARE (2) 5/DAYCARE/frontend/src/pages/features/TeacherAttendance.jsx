import React, { useMemo, useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import Pagination from '../../components/shared/Pagination';

const fmt = (v) => (!v || v === '-' ? '—' : v);
const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const to12h = (t) => {
  if (!t || t === '-') return '-';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const TeacherAttendance = () => {
  const { t } = useLanguage();

  const STATUS_CONFIG = {
    present:    { label: t('present'),  accent: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
    late:       { label: t('late'),     accent: 'bg-amber-50  text-amber-700  border-amber-200',     dot: 'bg-amber-400'  },
    absent:     { label: t('absent'),   accent: 'bg-rose-50   text-rose-600   border-rose-200',      dot: 'bg-rose-400'   },
    'on-leave': { label: t('onLeave'),  accent: 'bg-cyan-50   text-cyan-700   border-cyan-200',      dot: 'bg-cyan-400'   },
  };
  const STATUS_OPTIONS = [
    { key: 'present',  label: t('present')  },
    { key: 'late',     label: t('late')     },
    { key: 'absent',   label: t('absent')   },
    { key: 'on-leave', label: t('onLeave')  },
  ];

  const [teachers, setTeachers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [currentDate, setCurrentDate]         = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch]                   = useState('');
  const [classroomFilter, setClassroomFilter] = useState('__ALL__');
  const [statusFilter, setStatusFilter]       = useState('__ALL__');
  const [currentPage, setCurrentPage]         = useState(1);
  const ITEMS_PER_PAGE = 5;

  /* modal — single record */
  const [modalOpen, setModalOpen]   = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selStatus, setSelStatus]   = useState('present');
  const [selCheckIn, setSelCheckIn] = useState('08:00');
  const [selCheckOut, setSelCheckOut] = useState('15:00');

  /* modal multi-select */
  const [modalSelected, setModalSelected] = useState(new Set());

  /* recent submissions */
  const [recentRecords, setRecentRecords] = useState([]);

  /* ── bulk selection ─────────────────────────────────────── */
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [bulkStatus, setBulkStatus]     = useState('present');
  const [bulkCheckIn, setBulkCheckIn]   = useState('08:00');
  const [bulkCheckOut, setBulkCheckOut] = useState('15:00');
  const [bulkSaving, setBulkSaving]     = useState(false);

  const toggleSelect = (id) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  /* marked-today tracking */
  const todayStr = new Date().toDateString();
  const [markedTodayIds, setMarkedTodayIds] = useState(() => {
    try {
      const saved = sessionStorage.getItem('markedTodayIds');
      if (!saved) return new Set();
      const { date, ids } = JSON.parse(saved);
      if (date !== new Date().toDateString()) return new Set();
      return new Set(ids);
    } catch { return new Set(); }
  });

  /* ── load ───────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const staffRes = await api.get('/staff', { params: { role: 'teacher' } });
      const staffList = staffRes.data?.data || staffRes.data || [];

      let attendanceMap = {};
      const alreadyMarked = new Set();
      try {
        const attRes = await api.get('/teacher-attendance');
        (attRes.data?.data || []).forEach(r => {
          const rid = String(r.id || r._id);
          attendanceMap[rid] = r;
          if (r.markedAt) {
            if (new Date(r.markedAt).toDateString() === new Date().toDateString())
              alreadyMarked.add(rid);
          }
        });
      } catch { /* no attendance yet */ }

      const merged = staffList.map(te => {
        const tid   = String(te._id || te.id);
        const saved = attendanceMap[tid];
        return {
          id:        tid,
          fullName:  te.fullName || te.name || 'Unknown',
          role:      te.role     || 'Nanny',
          classroom: saved?.classroom || te.classroom || 'Unassigned',
          status:    saved?.status    || 'absent',
          checkIn:   saved?.checkIn   || '-',
          checkOut:  saved?.checkOut  || '-',
        };
      });

      setTeachers(merged);
      setMarkedTodayIds(prev => new Set([...prev, ...alreadyMarked]));
    } catch (err) {
      console.error('Failed to load teachers:', err);
      setError('Could not load teachers. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      sessionStorage.setItem('markedTodayIds', JSON.stringify({ date: todayStr, ids: [...markedTodayIds] }));
    } catch { /* ignore */ }
  }, [markedTodayIds, todayStr]);

  const flash = (setter, msg) => { setter(msg); setTimeout(() => setter(''), 3500); };

  const unmarkedTeachers = useMemo(
    () => teachers.filter(te => !markedTodayIds.has(te.id)),
    [teachers, markedTodayIds]
  );

  /* ── derived / filter ───────────────────────────────────── */
  const classroomOptions = useMemo(() => [
    '__ALL__',
    ...Array.from(new Set(teachers.map(te => te.classroom).filter(Boolean))),
  ], [teachers]);

  const filtered = useMemo(() => teachers.filter(te => {
    const q = search.toLowerCase();
    const matchQ = !q || te.fullName.toLowerCase().includes(q) || te.role.toLowerCase().includes(q) || te.classroom.toLowerCase().includes(q);
    const matchC = classroomFilter === '__ALL__' || te.classroom === classroomFilter;
    const matchS = statusFilter === '__ALL__' || STATUS_CONFIG[te.status]?.label === statusFilter;
    return matchQ && matchC && matchS;
  }), [teachers, search, classroomFilter, statusFilter, STATUS_CONFIG]);

  useEffect(() => { setCurrentPage(1); }, [search, classroomFilter, statusFilter, currentDate]);

  const totalPages       = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginatedTeachers = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  /* select-all helpers — depend on paginatedTeachers */
  const allPageIds       = paginatedTeachers.map(te => te.id);
  const allPageSelected  = allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));
  const somePageSelected = allPageIds.some(id => selectedIds.has(id));
  const toggleSelectAll  = () => {
    if (allPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); allPageIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => new Set([...prev, ...allPageIds]));
    }
  };

  const totals = useMemo(() => ({
    total:   teachers.length,
    present: teachers.filter(te => te.status === 'present').length,
    late:    teachers.filter(te => te.status === 'late').length,
    absent:  teachers.filter(te => te.status === 'absent').length,
    onLeave: teachers.filter(te => te.status === 'on-leave').length,
  }), [teachers]);

  /* ── open single modal ──────────────────────────────────── */
  const openModal = (teacherId) => {
    const te = teachers.find(x => x.id === teacherId);
    if (!te) return;
    setSelectedId(teacherId);
    setSelStatus(te.status === 'absent' ? 'present' : te.status);
    setSelCheckIn(te.checkIn   === '-' ? '08:00' : te.checkIn);
    setSelCheckOut(te.checkOut === '-' ? '15:00' : te.checkOut);
    // Pre-select this single nanny in the modal list
    setModalSelected(new Set([teacherId]));
    setModalOpen(true);
  };

  const openModalFirst = () => {
    if (unmarkedTeachers.length === 0) { flash(setSuccessMsg, 'All nannies/providers have been marked for today!'); return; }
    // Pre-select the first unmarked nanny when opening
    setModalSelected(new Set([unmarkedTeachers[0].id]));
    setModalOpen(true);
  };

  /* ── save single ────────────────────────────────────────── */
  const saveAttendance = async () => {
    if (modalSelected.size === 0) return;

    const noTime      = selStatus === 'absent' || selStatus === 'on-leave';
    const checkInVal  = noTime ? '-' : to12h(selCheckIn  || '08:00');
    const checkOutVal = noTime ? '-' : to12h(selCheckOut || '15:00');

    setSaving(true);

    // Optimistic UI for all selected
    setTeachers(prev => prev.map(te =>
      modalSelected.has(te.id) ? { ...te, status: selStatus, checkIn: checkInVal, checkOut: checkOutVal } : te
    ));

    try {
      if (modalSelected.size === 1) {
        // Single save
        const [tid] = [...modalSelected];
        await api.post('/teacher-attendance', { teacherId: tid, status: selStatus, checkIn: checkInVal, checkOut: checkOutVal });
      } else {
        // Bulk save
        await api.post('/teacher-attendance/bulk', {
          records: [...modalSelected].map(id => ({ teacherId: id, status: selStatus, checkIn: checkInVal, checkOut: checkOutVal })),
        });
      }

      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setRecentRecords(prev => {
        const newRecs = [...modalSelected].map(id => {
          const te = teachers.find(x => x.id === id);
          return { id, fullName: te?.fullName || id, classroom: te?.classroom || '', status: selStatus, checkIn: checkInVal, checkOut: checkOutVal, savedAt: now };
        });
        return [...newRecs, ...prev.filter(r => !modalSelected.has(r.id))].slice(0, 10);
      });

      setMarkedTodayIds(prev => new Set([...prev, ...modalSelected]));
      flash(setSuccessMsg, `${modalSelected.size} nanny attendance record${modalSelected.size > 1 ? 's' : ''} saved successfully.`);
      setModalOpen(false);
      setModalSelected(new Set());
      await load();
    } catch (err) {
      console.error('Save failed:', err.response?.data || err.message);
      flash(setError, err.response?.data?.message || 'Failed to save. Please try again.');
      load();
    } finally {
      setSaving(false);
    }
  };

  /* ── save bulk ──────────────────────────────────────────── */
  const saveBulkAttendance = async () => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    const noTime      = bulkStatus === 'absent' || bulkStatus === 'on-leave';
    const checkInVal  = noTime ? '-' : to12h(bulkCheckIn  || '08:00');
    const checkOutVal = noTime ? '-' : to12h(bulkCheckOut || '15:00');

    setTeachers(prev => prev.map(te =>
      selectedIds.has(te.id) ? { ...te, status: bulkStatus, checkIn: checkInVal, checkOut: checkOutVal } : te
    ));

    try {
      await api.post('/teacher-attendance/bulk', {
        records: [...selectedIds].map(id => ({ teacherId: id, status: bulkStatus, checkIn: checkInVal, checkOut: checkOutVal })),
      });

      setMarkedTodayIds(prev => new Set([...prev, ...selectedIds]));

      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setRecentRecords(prev => {
        const newRecs = [...selectedIds].map(id => {
          const te = teachers.find(x => x.id === id);
          return { id, fullName: te?.fullName || id, classroom: te?.classroom || '', status: bulkStatus, checkIn: checkInVal, checkOut: checkOutVal, savedAt: now };
        });
        return [...newRecs, ...prev.filter(r => !selectedIds.has(r.id))].slice(0, 10);
      });

      flash(setSuccessMsg, `${selectedIds.size} nanny attendance records saved successfully.`);
      clearSelection();
      await load();
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Bulk save failed. Please try again.');
      load();
    } finally {
      setBulkSaving(false);
    }
  };

  /* ── loading ────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">{t('loadingTeachers')}</p>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-600/80">{t('receptionDeskLabel')}</p>
          <h1 className="text-3xl font-bold text-slate-950">{t('providerAttendanceTitle')}</h1>
          <p className="max-w-2xl text-slate-500 mt-1 text-sm">{t('providerAttendanceSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openModalFirst}
          className="self-start inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-300"
        >
          <i className="bx bx-check-square text-base" />
          {t('markAttendance')}
        </button>
      </div>

      {/* Alerts */}
      {error      && <div className="rounded-xl bg-rose-50    border border-rose-200    text-rose-600    p-4 text-sm flex items-center gap-2"><i className="bx bx-error-circle text-lg" />{error}</div>}
      {successMsg && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 text-sm flex items-center gap-2"><i className="bx bx-check-circle text-lg" />{successMsg}</div>}

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: t('totalProviders'), value: totals.total,   accent: 'from-slate-900 to-slate-700',    icon: 'bx-group'      },
          { label: t('present'),        value: totals.present, accent: 'from-emerald-900 to-emerald-600', icon: 'bx-user-check' },
          { label: t('late'),           value: totals.late,    accent: 'from-amber-900 to-amber-600',    icon: 'bx-time'       },
          { label: t('absent'),         value: totals.absent,  accent: 'from-rose-900 to-rose-600',      icon: 'bx-user-x'     },
          { label: t('onLeave'),        value: totals.onLeave, accent: 'from-cyan-900 to-cyan-600',      icon: 'bx-briefcase'  },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-3 h-1.5 w-14 rounded-full bg-gradient-to-r ${c.accent}`} />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-950">{c.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-teal-600">
                <i className={`bx ${c.icon} text-lg`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <input
            type="date"
            value={currentDate}
            onChange={e => setCurrentDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-cyan-400 [color-scheme:light]"
          />
          <div className="relative">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={t('searchTeacher')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-950 outline-none focus:border-cyan-400"
            />
          </div>
          <div className="relative">
            <select value={classroomFilter} onChange={e => setClassroomFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-cyan-400">
              {classroomOptions.map(r => (
                <option key={r} value={r}>{r === '__ALL__' ? t('allClassrooms') : r}</option>
              ))}
            </select>
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-cyan-400">
              <option value="__ALL__">{t('allStatuses')}</option>
              {STATUS_OPTIONS.map(s => <option key={s.key} value={STATUS_CONFIG[s.key].label}>{STATUS_CONFIG[s.key].label}</option>)}
            </select>
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <i className="bx bx-group text-4xl opacity-30" />
            <p className="text-sm">
              {teachers.length === 0 ? t('noProvidersFound') : `${t('noProvidersFound')} ${t('tryFilters')}`}
            </p>
            {teachers.length === 0 && (
              <button onClick={load} className="mt-2 text-xs font-semibold text-cyan-600 hover:underline">
                {t('retryBtn')}
              </button>
            )}
          </div>
        ) : (
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[t('providerTh'), t('roleProvider'), t('classroom'), t('checkInLabel'), t('checkOutLabel'), t('statusTh'), t('thActions')].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-semibold uppercase tracking-[0.12em] text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedTeachers.map(te => {
                const cfg = STATUS_CONFIG[te.status] || STATUS_CONFIG.absent;
                return (
                  <tr key={te.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    {/* Provider name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 ring-1 ring-cyan-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-cyan-700">{initials(te.fullName)}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{te.fullName}</p>
                          <p className="text-xs text-slate-400">{te.id}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      {te.role === 'teacher' ? t('roleTeacher') : te.role}
                    </td>
                    {/* Classroom */}
                    <td className="px-5 py-4">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg whitespace-nowrap">
                        {te.classroom === 'Unassigned' ? t('unassigned') : te.classroom}
                      </span>
                    </td>
                    {/* Check-in */}
                    <td className="px-5 py-4 text-slate-600 font-mono text-xs">{fmt(te.checkIn)}</td>
                    {/* Check-out */}
                    <td className="px-5 py-4 text-slate-600 font-mono text-xs">{fmt(te.checkOut)}</td>
                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.accent}`}>
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    {/* Update button */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openModal(te.id)}
                        className="rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition"
                      >
                        {t('updateBtn')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="border-t border-slate-100 p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel={t('roleProvider', 'providers')}
            />
          </div>
        )}
      </div>

      {/* Mark Attendance Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-teal-900/40 bg-white dark:bg-[#111c2d] shadow-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-teal-900/30">
              <div>
                <p className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400">{t('receptionDeskLabel')}</p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{t('markAttendance')}</h2>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0d1520] transition">
                <i className="bx bx-x text-xl" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Provider multi-select list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('providerLabel')}
                  </label>
                  <span className="text-xs text-slate-400">
                    {unmarkedTeachers.length} remaining · {markedTodayIds.size} marked today
                  </span>
                </div>

                {/* Select All row */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-t-xl border border-slate-200 dark:border-teal-900/40 bg-slate-100 dark:bg-[#0a0f1a]">
                  <input
                    type="checkbox"
                    id="modal-select-all"
                    checked={unmarkedTeachers.length > 0 && unmarkedTeachers.every(te => modalSelected.has(te.id))}
                    ref={el => {
                      if (el) {
                        const some = unmarkedTeachers.some(te => modalSelected.has(te.id));
                        const all  = unmarkedTeachers.length > 0 && unmarkedTeachers.every(te => modalSelected.has(te.id));
                        el.indeterminate = some && !all;
                      }
                    }}
                    onChange={e => {
                      if (e.target.checked) {
                        setModalSelected(new Set(unmarkedTeachers.map(te => te.id)));
                      } else {
                        setModalSelected(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-cyan-500"
                  />
                  <label htmlFor="modal-select-all" className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                    Select All
                  </label>
                  {modalSelected.size > 0 && (
                    <span className="ml-auto text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                      {modalSelected.size} selected
                    </span>
                  )}
                </div>

                {/* Scrollable nanny list */}
                <div className="border border-t-0 border-slate-200 dark:border-teal-900/40 rounded-b-xl overflow-y-auto max-h-52">
                  {unmarkedTeachers.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-xs text-slate-400">
                      All providers marked for today ✓
                    </div>
                  ) : (
                    unmarkedTeachers.map((te, idx) => (
                      <label
                        key={te.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          modalSelected.has(te.id)
                            ? 'bg-cyan-50 dark:bg-cyan-500/10'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5'
                        } ${idx > 0 ? 'border-t border-slate-100 dark:border-teal-900/30' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={modalSelected.has(te.id)}
                          onChange={() => {
                            setModalSelected(prev => {
                              const next = new Set(prev);
                              next.has(te.id) ? next.delete(te.id) : next.add(te.id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-cyan-500 flex-shrink-0"
                        />
                        <div className="w-7 h-7 rounded-lg bg-cyan-50 ring-1 ring-cyan-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-cyan-700">{initials(te.fullName)}</span>
                        </div>
                        <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                          {te.fullName}
                          <span className="text-xs text-slate-400 ml-1.5">— {te.classroom}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Status picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('statusPickerLabel')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.key} type="button" onClick={() => setSelStatus(opt.key)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        selStatus === opt.key
                          ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-teal-900/40 bg-slate-50 dark:bg-[#0d1520] text-slate-600 dark:text-slate-300 hover:border-cyan-300'
                      }`}>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_CONFIG[opt.key].dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Times */}
              {selStatus !== 'absent' && selStatus !== 'on-leave' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('checkInLabel')}</label>
                    <input type="time" value={selCheckIn} onChange={e => setSelCheckIn(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-teal-900/40 bg-slate-50 dark:bg-[#0d1520] px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('checkOutLabel')}</label>
                    <input type="time" value={selCheckOut} onChange={e => setSelCheckOut(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-teal-900/40 bg-slate-50 dark:bg-[#0d1520] px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-400" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-teal-900/30">
              <button type="button" onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-teal-900/40 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0d1520] transition">
                {t('cancel')}
              </button>
              <button type="button" onClick={saveAttendance} disabled={saving || modalSelected.size === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sm font-bold text-slate-950 transition disabled:opacity-60">
                {saving
                  ? <><i className="bx bx-loader-alt animate-spin" /> {t('saving')}</>
                  : <><i className="bx bx-check" /> {t('saveRecord')}{modalSelected.size > 1 ? ` (${modalSelected.size})` : ''}</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherAttendance;
