import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { useSettings } from '../../context/useSettings';
import Pagination from '../../components/shared/Pagination';
import { sortAttendanceChildren } from './attendanceSorting';

const toLocalDateInputValue = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const AttendanceTracker = ({ readOnly: propReadOnly } = {}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  // Admin and Reception are view-only. Only teacher/nanny has full mark permissions.
  const isReadOnly = Boolean(propReadOnly || user?.role === 'admin' || user?.role === 'reception');
  const isTeacher  = user?.role === 'teacher';

  const [attendance, setAttendance] = useState({ records: [], absentChildren: [], summary: {} });
  const [teacherChildren, setTeacherChildren] = useState([]);
  const [teacherRosterError, setTeacherRosterError] = useState('');
  const [teacherAssignmentStatus, setTeacherAssignmentStatus] = useState('');
  const [teacherPendingCount, setTeacherPendingCount] = useState(0);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInputValue(new Date()));
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [attendanceNotes, setAttendanceNotes] = useState({});
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('nameAsc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { isFreeMode } = useSettings();
  const [payments, setPayments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedClassroom && selectedClassroom !== 'all') params.set('classroomId', selectedClassroom);
      const query = `?${params.toString()}`;

      const requests = [
        api.get(`/attendance/today${query}`),
        api.get('/payments/summary')
      ];
      if (isTeacher) requests.push(api.get('/children'));
      const [attendanceResult, paymentsResult, childrenResult] = await Promise.allSettled(requests);

      if (attendanceResult.status === 'fulfilled') {
        const data = attendanceResult.value.data?.data;
        if (!data || !Array.isArray(data.records) || !Array.isArray(data.absentChildren)) {
          setAttendance({ records: [], absentChildren: [], summary: {} });
          setError('The attendance service returned an invalid response. Please retry.');
        } else {
          setAttendance(data);

        }
      } else {
        setAttendance({ records: [], absentChildren: [], summary: {} });
        setError(
          attendanceResult.reason.response?.data?.message ||
          'Could not load today’s attendance. Check your connection and retry.'
        );
      }

      if (paymentsResult.status === 'fulfilled') {
        setPayments(paymentsResult.value.data?.data || []);
      }
      if (isTeacher) {
        if (
          childrenResult.status === 'fulfilled' &&
          childrenResult.value.data?.success === true &&
          Array.isArray(childrenResult.value.data.data)
        ) {
          setTeacherChildren(childrenResult.value.data.data);
          setTeacherRosterError('');
          setTeacherAssignmentStatus(childrenResult.value.data.assignmentStatus || '');
          setTeacherPendingCount(Number(childrenResult.value.data.pendingCount) || 0);
        } else {
          setTeacherChildren([]);
          setTeacherAssignmentStatus('');
          setTeacherPendingCount(0);
          setTeacherRosterError(
            childrenResult.status === 'rejected'
              ? childrenResult.reason.response?.data?.message || 'Could not load your classroom roster. Please retry.'
              : 'The classroom roster service returned an invalid response. Please retry.'
          );
        }
      }
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Could not load attendance data. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadClassrooms = async () => {
      if (['admin', 'reception'].includes(user?.role)) {
        try {
          const res = await api.get('/classrooms');
          setClassrooms(res.data.data || []);
        } catch {
          // ignore classroom load error
        }
      }
    };
    loadClassrooms();
  }, [user]);

  useEffect(() => {
    fetchAttendance();
  }, [selectedClassroom, selectedDate, isTeacher]);

  useEffect(() => {
    setAttendanceNotes({});
    setAttendanceDrafts({});
  }, [selectedDate]);

  const unpaidChildrenIds = new Set(
    payments
      .filter(p => ['pending', 'overdue', 'unpaid'].includes(p.status?.toLowerCase()))
      .map(p => p.child?._id || (typeof p.child === 'string' ? p.child : null))
      .filter(Boolean)
  );

  const handleSetStatus = async (childId, classroomId, status, notes = '') => {
    if (!status) return;
    if (!isFreeMode && status === 'present' && unpaidChildrenIds.has(childId)) {
      if (!window.confirm('WARNING: This child has pending/overdue payments. Verify cash/receipt before allowing check-in.\n\nProceed with check-in?')) {
        return;
      }
    }

    setActionLoading(childId);
    setError('');
    try {
      if (status === 'present') {
        await api.post('/attendance/checkin', { childId, classroomId, date: selectedDate, notes });
      } else {
        await api.post('/attendance/absence', { childId, classroomId, date: selectedDate, status, notes });
      }

      setAttendanceDrafts(prev => {
        const next = { ...prev };
        delete next[childId];
        return next;
      });
      setSuccess(`Attendance saved as ${status}.`);
      await fetchAttendance();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save attendance. Please retry.');
    } finally {
      setActionLoading('');
    }
  };

  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Helpers for birth year & age calculation
  const getBirthYear = (dob) => {
    if (!dob) return null;
    const d = new Date(dob);
    return isNaN(d.getTime()) ? null : d.getFullYear();
  };

  const getAge = (dob) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return Math.max(0, age);
  };

  // Derive unified list of all students
  const allStudents = useMemo(() => {
    if (isTeacher) {
      const recordsByChildId = new Map(
        (attendance?.records || [])
          .filter(record => record.child?._id)
          .map(record => [String(record.child._id), record])
      );
      return teacherChildren.map(child => ({
        ...child,
        classroom: child.classroom?._id || child.classroom || '',
        classroomName: child.classroom?.name || '',
        record: recordsByChildId.get(String(child._id)) || null
      }));
    }

    const list = [];
    const seen = new Set();
    if (attendance?.records) {
      attendance.records.forEach(r => {
        if (r.child && !seen.has(String(r.child._id))) {
          seen.add(String(r.child._id));
          list.push({
            _id: r.child._id,
            firstName: r.child.firstName,
            lastName: r.child.lastName,
            dateOfBirth: r.child.dateOfBirth,
            createdAt: r.child.createdAt || r.child.enrollmentDate,
            classroom: r.classroom?._id || r.classroom,
            classroomName: r.classroom?.name || (typeof r.classroom === 'string' ? r.classroom : ''),
            record: r
          });
        }
      });
    }
    if (attendance?.absentChildren) {
      attendance.absentChildren.forEach(c => {
        if (seen.has(String(c._id))) return;
        seen.add(String(c._id));
        list.push({
          _id: c._id,
          firstName: c.firstName,
          lastName: c.lastName,
          dateOfBirth: c.dateOfBirth,
          createdAt: c.createdAt || c.enrollmentDate,
          classroom: c.classroom,
          classroomName: c.classroom?.name || (typeof c.classroom === 'string' ? c.classroom : ''),
          record: null
        });
      });
    }
    return list;
  }, [attendance, isTeacher, teacherChildren]);

  // Filter students by search and status
  const filteredStudents = useMemo(() => {
    return allStudents.filter(student => {
      const q = search.toLowerCase().trim();
      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase();
      const matchSearch = !q || fullName.includes(q) || String(student._id || '').toLowerCase().includes(q);

      const currentStatus = student.record?.status || 'notMarked';
      const normalizedStatus = (currentStatus === 'authorized-absence' || currentStatus === 'excused') ? 'permission' : currentStatus;
      const matchStatus = filterStatus === 'all' || normalizedStatus === filterStatus;

      return matchSearch && matchStatus;
    });
  }, [allStudents, search, filterStatus]);

  // Sort students
  const sortedStudents = useMemo(() => {
    return sortAttendanceChildren(filteredStudents, sortBy);
  }, [filteredStudents, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(sortedStudents.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStudents = sortedStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Students not yet marked today (teacher/nanny view only)
  const unmarkedCount = isTeacher
    ? allStudents.filter(s => !s.record?.status).length
    : 0;
  const allMarkedToday = isTeacher && allStudents.length > 0 && unmarkedCount === 0;
  const displayError = error || teacherRosterError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('attendanceTracker', 'Attendance Tracker')}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedDateLabel}</p>
            <label className="sr-only" htmlFor="attendance-date">{t('attendanceDate', 'Attendance date')}</label>
            <input
              id="attendance-date"
              type="date"
              value={selectedDate}
              onChange={event => {
                setSelectedDate(event.target.value);
                setAttendanceDrafts({});
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1929] px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-200"
            />
            <button
              type="button"
              onClick={() => {
                setSelectedDate(toLocalDateInputValue(new Date()));
                setAttendanceDrafts({});
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200"
            >
              {t('today', 'Today')}
            </button>
            <button
              type="button"
              onClick={() => {
                const date = new Date(`${selectedDate}T00:00:00`);
                date.setDate(date.getDate() - 1);
                setSelectedDate(toLocalDateInputValue(date));
                setAttendanceDrafts({});
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200"
            >
              {t('previousDay', 'Previous day')}
            </button>
            <button
              type="button"
              onClick={() => {
                const date = new Date(`${selectedDate}T00:00:00`);
                date.setDate(date.getDate() + 1);
                setSelectedDate(toLocalDateInputValue(date));
                setAttendanceDrafts({});
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200"
            >
              {t('nextDay', 'Next day')}
            </button>
          </div>
        </div>
      </div>

      {/* View Only info banner for Admin & Reception */}
      {isReadOnly && (
        <div className="flex items-center gap-3 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/40 rounded-2xl px-4 py-3 text-xs text-indigo-700 dark:text-indigo-300">
          <i className="bx bx-show text-lg text-indigo-500 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{t('viewOnlyAttendance', 'View Only')}:</strong>{' '}
            {user?.role === 'reception'
              ? 'Child attendance is recorded by nannies/teachers. Reception view is read-only.'
              : t('viewOnlyDesc', 'Child attendance is recorded by teachers and reception desk. Admin view is read-only.')}
          </p>
        </div>
      )}

      {/* Teacher progress banner */}
      {isTeacher && !loading && allStudents.length > 0 && (
        allMarkedToday ? (
          <div className="flex items-center gap-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
            <i className="bx bx-check-circle text-lg text-emerald-500 flex-shrink-0" />
            <p><strong className="font-semibold">All children marked!</strong> Attendance for the selected date is complete.</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
            <i className="bx bx-time text-lg text-amber-500 flex-shrink-0" />
            <p>
              <strong className="font-semibold">{unmarkedCount} children</strong> still need to be marked for this date ·{' '}
              <span className="text-amber-500">{allStudents.length - unmarkedCount} of {allStudents.length} done</span>
            </p>
          </div>
        )
      )}

      {/* Alerts */}
      {displayError && (
        <div role="alert" className="flex flex-col gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>{displayError}</span>
          <button
            type="button"
            onClick={fetchAttendance}
            disabled={loading}
            className="self-start rounded-lg border border-rose-400/40 px-3 py-1.5 font-semibold hover:bg-rose-500/10 disabled:opacity-50 sm:self-auto"
          >
            {loading ? t('loading', 'Loading…') : t('retry', 'Retry')}
          </button>
        </div>
      )}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: t('present', 'Present'), value: loading || displayError ? '—' : attendance.summary?.present || 0,
            icon: 'bx-user-check',
            bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('absent', 'Absent'),  value: loading || displayError ? '—' : attendance.summary?.absent || 0,
            icon: 'bx-user-x',
            bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
          { label: t('late', 'Late'),    value: loading || displayError ? '—' : attendance.summary?.late || 0,
            icon: 'bx-time',
            bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
          { label: t('permission', 'Permission'), value: loading || displayError ? '—' : attendance.summary?.permission || 0,
            icon: 'bx-badge-check',
            bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200 dark:border-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400' },
          { label: t('sick', 'Sick'),    value: loading || displayError ? '—' : attendance.summary?.sick || 0,
            icon: 'bx-plus-medical',
            bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4 sm:p-5 shadow-sm`}>
            <i className={`bx ${s.icon} text-xl ${s.text}`} />
            <p className={`text-xl sm:text-2xl font-bold ${s.text} mt-2`}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters & Sorting */}
      <div className="bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('searchChildren', 'Search child name...')}
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
            />
          </div>

          {/* Classroom filter for Admin/Reception */}
          {['admin', 'reception'].includes(user?.role) && classrooms.length > 0 && (
            <div className="relative">
              <select
                value={selectedClassroom}
                onChange={e => { setSelectedClassroom(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none px-4 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
              >
                <option value="">{t('allClassrooms', 'All Classrooms')}</option>
                {classrooms.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none px-4 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
            >
              <option value="all">{t('allStatuses', 'All Statuses')}</option>
              <option value="present">{t('present', 'Present')}</option>
              <option value="absent">{t('absent', 'Absent')}</option>
              <option value="late">{t('late', 'Late')}</option>
              <option value="permission">{t('permission', 'Permission')}</option>
              <option value="sick">{t('sick', 'Sick')}</option>
              <option value="notMarked">{t('notMarked', 'Not Marked')}</option>
            </select>
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort By */}
          <div className="relative">
            <select
              aria-label={t('sortStudents', 'Sort students')}
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="relative z-[1] w-full appearance-none cursor-pointer pl-9 pr-8 py-2.5 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm bg-slate-50 dark:bg-[#0d1929] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all font-medium"
            >
              <option value="nameAsc">{t('sortNameAsc', 'Name (A–Z)')}</option>
              <option value="nameDesc">{t('sortNameDesc', 'Name (Z–A)')}</option>
              <option value="yearYoungest">{t('sortYearYoungest', 'Age (Youngest First)')}</option>
              <option value="yearOldest">{t('sortYearOldest', 'Age (Oldest First)')}</option>
              <option value="dateNewest">{t('sortDateNewest', 'Newest First')}</option>
              <option value="dateOldest">{t('sortDateOldest', 'Oldest First')}</option>
            </select>
            <i className="bx bx-sort absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i className="bx bx-group text-indigo-400" /> {displayError
                ? t('attendanceUnavailable', 'Attendance unavailable')
                : `${t('allStudents', 'All Students')} (${sortedStudents.length})`}
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {t('showingCount', 'Showing')} {paginatedStudents.length} / {sortedStudents.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {paginatedStudents.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-12">
                {displayError
                  ? t('attendanceUnavailable', 'Attendance data is unavailable. Retry after resolving the error above.')
                  : isTeacher && teacherAssignmentStatus === 'unassigned'
                    ? t('noClassroomAssigned', 'No active classroom is assigned to your nanny account. Contact an administrator.')
                    : isTeacher && teacherAssignmentStatus === 'inactive_classroom'
                      ? t('inactiveClassroomAssigned', 'Your assigned classroom is inactive. Contact an administrator.')
                      : isTeacher && teacherAssignmentStatus === 'pending'
                        ? t(
                            'childrenAwaitingApproval',
                            `${teacherPendingCount} ${teacherPendingCount === 1 ? 'child is' : 'children are'} awaiting administrator approval. Approved children will appear here.`
                          )
                      : isTeacher
                        ? t('noAssignedStudents', 'No active or approved students are currently assigned to your classroom.')
                        : t('noStudentsFound', 'No students found.')}
              </p>
            ) : (
              paginatedStudents.map(student => {
                const currentStatus = attendanceDrafts[student._id] || student.record?.status;
                const birthYear = getBirthYear(student.dateOfBirth);
                const age = getAge(student.dateOfBirth);

                return (
                  <div key={student._id} className={`flex flex-col lg:flex-row lg:items-center justify-between px-6 py-4 gap-4 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors ${
                    isTeacher && !student.record?.status ? 'border-l-4 border-amber-400' : ''
                  }`}>
                    <div className="flex items-center gap-4">
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={`${student.firstName || ''} ${student.lastName || ''}`.trim()}
                          className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-base font-bold shadow-sm flex-shrink-0">
                          {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-bold text-slate-800 dark:text-white">
                            {student.firstName} {student.lastName}
                          </p>
                          {birthYear && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                              {t('born', 'Born')} {birthYear} ({age} {t('yrs', 'yrs')})
                            </span>
                          )}
                          {student.createdAt && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              • {t('registered', 'Reg')}: {new Date(student.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {student.classroomName && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {student.classroomName}
                          </p>
                        )}
                        {student.record?.checkIn?.time && (
                          <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1">
                            <i className="bx bx-time-five" /> 
                            {t('checkedInAt', 'Checked in at')} {new Date(student.record.checkIn.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {isReadOnly ? (
                      <div className="flex items-center flex-wrap gap-2">
                        {currentStatus === 'present' && (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <i className="bx bx-user-check text-base" /> {t('present', 'Present')}
                          </span>
                        )}
                        {currentStatus === 'absent' && (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <i className="bx bx-user-x text-base" /> {t('absent', 'Absent')}
                          </span>
                        )}
                        {currentStatus === 'late' && (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <i className="bx bx-time text-base" /> {t('late', 'Late')}
                          </span>
                        )}
                        {currentStatus === 'sick' && (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            <i className="bx bx-plus-medical text-base" /> {t('sick', 'Sick')}
                          </span>
                        )}
                        {(currentStatus === 'permission' || currentStatus === 'authorized-absence' || currentStatus === 'excused') && (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                            <i className="bx bx-badge-check text-base" /> {t('permission', 'Permission')}
                          </span>
                        )}
                        {!currentStatus && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <i className="bx bx-minus text-base" /> {t('notMarked', 'Not Marked')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {[
                          { id: 'present', label: t('present', 'Present'), icon: 'bx-user-check', activeClass: 'bg-emerald-500 text-white shadow-emerald-500/40', inactiveClass: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20' },
                          { id: 'absent',  label: t('absent', 'Absent'),  icon: 'bx-user-x',     activeClass: 'bg-rose-500 text-white shadow-rose-500/40',    inactiveClass: 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20' },
                          { id: 'late',    label: t('late', 'Late'),    icon: 'bx-time',       activeClass: 'bg-amber-500 text-white shadow-amber-500/40',  inactiveClass: 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20' },
                          { id: 'permission', label: t('permission', 'Permission'), icon: 'bx-badge-check', activeClass: 'bg-cyan-500 text-white shadow-cyan-500/40', inactiveClass: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:hover:bg-cyan-500/20' },
                          { id: 'sick',    label: t('sick', 'Sick'),    icon: 'bx-plus-medical',activeClass: 'bg-purple-500 text-white shadow-purple-500/40',inactiveClass: 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20' }
                        ].map(opt => {
                          const isActive = currentStatus === opt.id || (opt.id === 'permission' && (currentStatus === 'authorized-absence' || currentStatus === 'excused'));
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={currentStatus === opt.id || (opt.id === 'permission' && ['authorized-absence', 'excused'].includes(currentStatus))}
                              onClick={() => setAttendanceDrafts(prev => ({ ...prev, [student._id]: opt.id }))}
                              disabled={actionLoading === student._id}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                                isActive 
                                  ? `${opt.activeClass} shadow-lg scale-105`
                                  : `${opt.inactiveClass} hover:scale-105`
                              } ${actionLoading === student._id ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                            >
                              <i className={`bx ${opt.icon} text-sm`} />
                              {opt.label}
                            </button>
                          );
                        })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            aria-label={`Attendance notes for ${student.firstName || ''} ${student.lastName || ''}`.trim()}
                            value={attendanceNotes[student._id] ?? student.record?.notes ?? ''}
                            onChange={event => setAttendanceNotes(prev => ({ ...prev, [student._id]: event.target.value }))}
                            maxLength={1000}
                            placeholder={t('attendanceNotesOptional', 'Optional attendance note')}
                            className="w-full sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1929] px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleSetStatus(
                              student._id,
                              student.classroom,
                              attendanceDrafts[student._id],
                              attendanceNotes[student._id] ?? student.record?.notes ?? ''
                            )}
                            disabled={!attendanceDrafts[student._id] || actionLoading === student._id}
                            className="rounded-lg bg-[#00B4D8] px-3 py-2 text-xs font-bold text-white hover:bg-[#009bb9] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actionLoading === student._id ? t('saving', 'Saving…') : t('saveAttendance', 'Save Attendance')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0d1929]">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sortedStudents.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel={t('childrenLabel', 'children')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;
