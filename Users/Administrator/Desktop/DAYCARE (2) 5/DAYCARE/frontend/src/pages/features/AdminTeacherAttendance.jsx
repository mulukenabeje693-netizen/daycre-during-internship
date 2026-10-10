import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import Pagination from '../../components/shared/Pagination';

/* ── seed data (used when API is unavailable) ─────────────── */
const SEED = [
  { id: 't-01', fullName: 'Maya Johnson',  role: 'Lead Teacher',        classroom: 'Sunrise Room',    status: 'present',  checkIn: '07:42 AM', checkOut: '03:30 PM' },
  { id: 't-02', fullName: 'Lina Patel',    role: 'Assistant Teacher',   classroom: 'Rainbow Room',    status: 'late',     checkIn: '08:18 AM', checkOut: '04:00 PM' },
  { id: 't-03', fullName: 'Noah Carter',   role: 'Special Needs Guide', classroom: 'Garden Room',     status: 'on-leave', checkIn: '-',        checkOut: '-' },
  { id: 't-04', fullName: 'Ava Kim',       role: 'Floating Teacher',    classroom: 'Discovery Room',  status: 'absent',   checkIn: '-',        checkOut: '-' },
  { id: 't-05', fullName: 'Ethan Brooks',  role: 'Toddler Lead',        classroom: 'Little Stars',    status: 'present',  checkIn: '07:55 AM', checkOut: '03:20 PM' },
  { id: 't-06', fullName: 'Sara Mekonnen', role: 'Lead Teacher',        classroom: 'Sunshine Room',   status: 'present',  checkIn: '08:00 AM', checkOut: '03:45 PM' },
  { id: 't-07', fullName: 'James Tefera',  role: 'Assistant Teacher',   classroom: 'Moonlight Room',  status: 'absent',   checkIn: '-',        checkOut: '-' },
];

/* ── status config ────────────────────────────────────────── */
const STATUS = {
  present:  { label: 'Present',  dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', ring: 'ring-emerald-500/40' },
  late:     { label: 'Late',     dot: 'bg-amber-400',   pill: 'bg-amber-500/15  text-amber-400  border-amber-500/30',   ring: 'ring-amber-500/40'   },
  absent:   { label: 'Absent',   dot: 'bg-rose-400',    pill: 'bg-rose-500/15   text-rose-400   border-rose-500/30',    ring: 'ring-rose-500/40'    },
  'on-leave':{ label: 'On Leave',dot: 'bg-purple-400',  pill: 'bg-purple-500/15 text-purple-400 border-purple-500/30',  ring: 'ring-purple-500/40'  },
};

const STATUSES = Object.keys(STATUS);

/* ── avatar initials ──────────────────────────────────────── */
const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
const AdminTeacherAttendance = () => {
  const { t } = useLanguage();
  const [teachers, setTeachers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [lastSync, setLastSync]     = useState(null);

  /* filters & pagination */
  const [search, setSearch]         = useState('');
  const [filterClassroom, setFilterClassroom] = useState('all');
  const [filterStatus, setFilterStatus]       = useState('all');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [sortBy, setSortBy]         = useState('nameAsc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  /* ── fetch ─────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/teacher-attendance');
      const data = res.data?.data || [];
      setTeachers(Array.isArray(data) ? data : SEED);
      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to load teacher attendance:', err);
      // Fallback to seed data if API fails
      setTeachers(SEED);
      setLastSync(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (setter, msg, ms = 3500) => { setter(msg); setTimeout(() => setter(''), ms); };

  /* ── derived data ──────────────────────────────────────── */
  const classrooms = useMemo(() => ['all', ...new Set(teachers.map(t => t.classroom).filter(Boolean))], [teachers]);

  const filtered = useMemo(() => teachers.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || t.fullName?.toLowerCase().includes(q) || t.classroom?.toLowerCase().includes(q) || t.role?.toLowerCase().includes(q);
    const matchC = filterClassroom === 'all' || t.classroom === filterClassroom;
    const matchS = filterStatus === 'all' || t.status === filterStatus;
    return matchQ && matchC && matchS;
  }), [teachers, search, filterClassroom, filterStatus]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortBy === 'nameAsc') {
        return (a.fullName || '').localeCompare(b.fullName || '');
      }
      if (sortBy === 'nameDesc') {
        return (b.fullName || '').localeCompare(a.fullName || '');
      }
      if (sortBy === 'dateNewest' || sortBy === 'dateOldest') {
        const getTs = (item) => {
          if (item.createdAt) return new Date(item.createdAt).getTime();
          const idStr = String(item.id || item._id || '');
          if (idStr.length === 24) return parseInt(idStr.substring(0, 8), 16) * 1000;
          return 0;
        };
        const diff = getTs(b) - getTs(a);
        return sortBy === 'dateNewest' ? diff : -diff;
      }
      return 0;
    });
    return list;
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTeachers = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const totals = useMemo(() => ({
    total:   teachers.length,
    present: teachers.filter(t => t.status === 'present').length,
    late:    teachers.filter(t => t.status === 'late').length,
    absent:  teachers.filter(t => t.status === 'absent').length,
    onLeave: teachers.filter(t => t.status === 'on-leave').length,
  }), [teachers]);

  /* ── loading ───────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 border-4 border-[#00B4D8] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">{t('syncingFromReception', 'Syncing from Reception Desk...')}</p>
    </div>
  );

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#00B4D8] mb-1">
            {t('adminPortalLiveFeed', 'Admin Portal · Live Feed')}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white leading-tight">
            {t('childcareProviderAttendance', 'Nanny Attendance')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            &ensp;·&ensp;
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              {t('syncedFromReception', 'Synced from Reception Desk')}
              {lastSync && <span className="text-slate-600 dark:text-slate-500 ml-1">{t('at', 'at')} {lastSync.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>}
            </span>
          </p>
        </div>
        <button
          onClick={load}
          className="self-start inline-flex items-center gap-2 bg-[#00B4D8] hover:bg-[#0096B4] text-[#0B1724] font-bold text-sm px-5 py-2.5 rounded-2xl transition-all shadow-[0_4px_20px_rgba(0,180,216,0.25)] hover:shadow-[0_4px_24px_rgba(0,180,216,0.4)]"
        >
          <i className="bx bx-refresh text-lg" /> {t('refresh', 'Refresh')}
        </button>
      </div>

      {/* ── Alerts & View Only notice ──────────────────────── */}
      <div className="flex items-center gap-3 bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/40 rounded-2xl px-4 py-3 text-xs text-cyan-800 dark:text-cyan-300">
        <i className="bx bx-show text-lg text-[#00B4D8] flex-shrink-0" />
        <p>
          <strong className="font-semibold">{t('viewOnlyAttendance', 'View Only')}:</strong>{' '}
          {t('providerAttendanceNotice', 'Nanny attendance is recorded live by the Reception Desk. Admin view is synchronized and read-only.')}
        </p>
      </div>

      {error   && <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl p-4 text-sm"><i className="bx bx-error-circle text-lg"/>{error}</div>}
      {success && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl p-4 text-sm"><i className="bx bx-check-circle text-lg"/>{success}</div>}

      {/* ── Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: t('totalProviders', 'Total Providers'), value: totals.total,   icon: 'bx-group',    bg: 'bg-[#00B4D8]/10', text: 'text-[#00B4D8]', border: 'border-[#00B4D8]/20', bar: 'bg-[#00B4D8]' },
          { label: t('present', 'Present'),        value: totals.present, icon: 'bx-user-check',bg:'bg-emerald-500/10',text:'text-emerald-400',border:'border-emerald-500/20',bar:'bg-emerald-400'},
          { label: t('late', 'Late'),           value: totals.late,    icon: 'bx-time',      bg:'bg-amber-500/10',  text:'text-amber-400',  border:'border-amber-500/20',  bar:'bg-amber-400'  },
          { label: t('absent', 'Absent'),         value: totals.absent,  icon: 'bx-user-x',    bg:'bg-rose-500/10',   text:'text-rose-400',   border:'border-rose-500/20',   bar:'bg-rose-400'   },
          { label: t('onLeave', 'On Leave'),       value: totals.onLeave, icon: 'bx-briefcase', bg:'bg-purple-500/10', text:'text-purple-400', border:'border-purple-500/20', bar:'bg-purple-400' },
        ].map(s => (
          <div key={s.label} className={`relative overflow-hidden rounded-2xl border ${s.border} bg-white dark:bg-[#0d1929] p-5 flex flex-col gap-3 shadow-sm`}>
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`bx ${s.icon} text-xl ${s.text}`} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white leading-none">{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${s.bar} opacity-60`} />
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('searchTeacher', 'Search teacher, role, classroom...')}
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
            />
          </div>
          {/* Date */}
          <input
            type="date"
            value={filterDate}
            onChange={e => { setFilterDate(e.target.value); setCurrentPage(1); }}
            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] [color-scheme:dark] transition-all"
          />
          {/* Classroom */}
          <div className="relative">
            <select
              value={filterClassroom}
              onChange={e => { setFilterClassroom(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none px-4 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
            >
              <option value="all">{t('allClassrooms', 'All Classrooms')}</option>
              {classrooms.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {/* Status */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none px-4 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
            >
              <option value="all">{t('allStatuses', 'All Statuses')}</option>
              {STATUSES.map(s => <option key={s} value={s}>{t(s, STATUS[s].label)}</option>)}
            </select>
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {/* Sort By */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-9 pr-8 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all font-medium"
            >
              <option value="nameAsc">{t('sortNameAsc', 'Name (A–Z)')}</option>
              <option value="nameDesc">{t('sortNameDesc', 'Name (Z–A)')}</option>
              <option value="dateNewest">{t('sortDateNewest', 'Registered (Newest)')}</option>
              <option value="dateOldest">{t('sortDateOldest', 'Registered (Oldest)')}</option>
            </select>
            <i className="bx bx-sort absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* table header row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-base">
            <span className="w-7 h-7 rounded-lg bg-[#00B4D8]/10 flex items-center justify-center">
              <i className="bx bx-calendar-check text-[#00B4D8] text-sm" />
            </span>
            {t('providerList', 'Provider List')}
            <span className="text-xs font-semibold text-slate-400 ml-1">
              ({sorted.length} of {teachers.length})
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#060d14] border-b border-slate-100 dark:border-slate-800">
                {[
                  { key: 'providerTh', default: 'Provider' },
                  { key: 'role', default: 'Role' },
                  { key: 'classroomTh', default: 'Classroom' },
                  { key: 'checkInTh', default: 'Check-in' },
                  { key: 'checkOutTh', default: 'Check-out' },
                  { key: 'statusTh', default: 'Status' }
                ].map(h => (
                  <th key={h.key} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide whitespace-nowrap">{t(h.key, h.default)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedTeachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
                    <i className="bx bx-search text-4xl opacity-30 block mb-2" />
                    {t('noTeachersMatch', 'No teachers match the current filters.')}
                  </td>
                </tr>
              ) : paginatedTeachers.map(teacher => {
                const cfg = STATUS[teacher.status] || STATUS.absent;
                return (
                  <tr key={teacher.id || teacher._id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-[#060d14]/60 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-[#00B4D8]/10 ring-2 ${cfg.ring} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-sm font-bold text-[#00B4D8]">{initials(teacher.fullName || '?')}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{teacher.fullName}</p>
                          <p className="text-xs text-slate-400">{teacher.id || teacher._id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{teacher.role || '—'}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-[#00B4D8] bg-[#00B4D8]/10 px-2.5 py-1 rounded-lg whitespace-nowrap">{teacher.classroom || t('unassigned', 'Unassigned')}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">{teacher.checkIn === '-' ? '—' : teacher.checkIn}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">{teacher.checkOut === '-' ? '—' : teacher.checkOut}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${cfg.pill} whitespace-nowrap`}>
                        <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                        {t(teacher.status, cfg.label)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0d1929]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={sorted.length}
            itemsPerPage={ITEMS_PER_PAGE}
            itemLabel={t('childcareProviders', 'Nannies')}
          />
        </div>
      </div>

    </div>
  );
};

export default AdminTeacherAttendance;
