import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';

const Av = ({ name, size = 8 }) => (
  <div
    className="rounded-full bg-[#00ADB5]/20 flex items-center justify-center text-[#00ADB5] font-bold flex-shrink-0"
    style={{ width: `${size * 4}px`, height: `${size * 4}px`, fontSize: `${size * 1.3}px` }}
  >
    {name?.charAt(0) || '?'}
  </div>
);

const StatCard = ({ icon, iconBg, label, value, sub }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm transition hover:-translate-y-0.5">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${iconBg}`}>
        <i className={`bx ${icon}`} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </div>
);

const dropdownCls =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060d14] px-4 py-3.5 text-left transition hover:border-[#00ADB5]/50 focus:outline-none focus:border-[#00ADB5]';

const AssignTeacher = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [teachers, setTeachers]             = useState([]);
  const [children, setChildren]             = useState([]);
  const [classrooms, setClassrooms]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');
  const [selectedTeacher, setSelectedTeacher]           = useState(null);
  const [selectedChildren, setSelectedChildren]         = useState([]);
  const [selectedClassroomState, setSelectedClassroomState] = useState(null);
  const [teacherOpen, setTeacherOpen]       = useState(false);
  const [childOpen, setChildOpen]           = useState(false);
  const [childSearch, setChildSearch]       = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [assigningClassroom, setAssigningClassroom] = useState(false);
  const [classroomOpen, setClassroomOpen]   = useState(false);

  const fetchAll = async () => {
    setError('');
    try {
      const [staffRes, childRes, classroomRes] = await Promise.all([
        api.get('/staff?role=teacher'),
        api.get('/children'),
        api.get('/classrooms?status=active'),
      ]);
      const staff = staffRes.data?.data;
      const childRecords = childRes.data?.data;
      const roomRecords = classroomRes.data?.data;
      if (
        staffRes.data?.success !== true || !Array.isArray(staff) ||
        childRes.data?.success !== true || !Array.isArray(childRecords) ||
        classroomRes.data?.success !== true || !Array.isArray(roomRecords)
      ) {
        throw new Error('The server returned an unexpected assignment-data response.');
      }
      setTeachers(staff.filter(s => s.role === 'teacher' && s.isBlocked !== true));
      setChildren(childRecords);
      setClassrooms(roomRecords.filter(room => room.status === 'active'));
      return true;
    } catch (loadError) {
      const message = loadError.response?.data?.message;
      const status = loadError.response?.status;
      const endpoint = loadError.config?.url;
      setError(
        message ||
        (status
          ? `Could not load ${endpoint || 'assignment data'} (HTTP ${status}). Check your access and retry.`
          : endpoint
            ? `Could not reach the backend while loading ${endpoint}. Check that the server is running and retry.`
            : loadError.message || t('failedToLoad', 'Failed to load assignment data.'))
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 3000); }
    else       { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
  };

  const getTeacherClassroom = teacher =>
    classrooms.find(r => r.teacher?._id === teacher._id || r.teacher === teacher._id);

  const getEnrolled = id =>
    children.filter(c => c.classroom?._id === id || c.classroom === id).length;

  const filteredChildren = children.filter(c =>
    !c.classroom &&
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(childSearch.toLowerCase())
  );

  const toggleChild = id =>
    setSelectedChildren(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleAssignClassroom = async () => {
    if (!selectedTeacher || !selectedClassroom) {
      return flash('Select a nanny and a classroom before saving the classroom assignment.', true);
    }

    const currentTeacherId = selectedClassroom.teacher?._id || selectedClassroom.teacher;
    if (currentTeacherId === selectedTeacher._id) {
      return flash(`${selectedClassroom.name} is already assigned to ${selectedTeacher.fullName}.`, true);
    }
    if (currentTeacherId) {
      const currentTeacher = teachers.find(teacher => teacher._id === currentTeacherId);
      const currentTeacherName = currentTeacher?.fullName || 'another nanny';
      if (!window.confirm(`Reassign ${selectedClassroom.name} from ${currentTeacherName} to ${selectedTeacher.fullName}?`)) {
        return;
      }
    }

    setAssigningClassroom(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.put(`/classrooms/${selectedClassroom._id}`, {
        teacher: selectedTeacher._id,
        confirmReassignment: Boolean(currentTeacherId)
      });
      const updatedClassroom = response.data?.data;
      if (response.data?.success !== true || !updatedClassroom?._id) {
        throw new Error(response.data?.message || 'The classroom assignment was not saved.');
      }

      setClassrooms(previous => previous.map(classroom =>
        classroom._id === updatedClassroom._id ? updatedClassroom : classroom
      ));
      setSelectedClassroomState(updatedClassroom);

      const refreshed = await fetchAll();
      if (!refreshed) {
        setError('The classroom assignment was saved, but the lists could not refresh. Retry to load the latest data.');
        return;
      }
      setSuccess(`${updatedClassroom.name} is now assigned to ${selectedTeacher.fullName}.`);
    } catch (assignmentError) {
      setError(
        assignmentError.response?.data?.message ||
        assignmentError.message ||
        'Could not save the classroom assignment. Please retry.'
      );
    } finally {
      setAssigningClassroom(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTeacher || selectedChildren.length === 0)
      return flash(t('selectTeacherAndChild', 'Please select a provider and at least one child.'), true);
    const room = selectedClassroomState || getTeacherClassroom(selectedTeacher);
    if (!room) return flash(t('noClassroomForProvider', 'Selected provider has no classroom assigned.'), true);
    if (room.status !== 'active') {
      return flash('Select an active classroom before assigning children.', true);
    }
    const availablePlaces = Number(room.capacity || 0) - getEnrolled(room._id);
    if (selectedChildren.length > availablePlaces) {
      return flash(`This classroom has room for ${Math.max(0, availablePlaces)} more children.`, true);
    }
    setSubmitting(true);
    try {
      const response = await api.post('/children/assign-classroom', {
        teacherId: selectedTeacher._id,
        classroomId: room._id,
        childIds: selectedChildren
      });
      if (response.data?.success !== true) {
        throw new Error(response.data?.message || 'The assignment was not saved.');
      }
      const count = selectedChildren.length;
      setSelectedChildren([]);
      const refreshed = await fetchAll();
      if (!refreshed) {
        setError('Assignments were saved, but the lists could not refresh. Retry to load the latest data.');
      }
      flash(`${t('assigned', 'Assigned')} ${count} ${t('childrenToProvider', 'child(ren) to')} ${selectedTeacher.fullName}.`);
    } catch (assignmentError) {
      flash(
        assignmentError.response?.data?.message ||
        assignmentError.message ||
        t('assignmentFailed', 'Assignment failed. Please try again.'),
        true
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-[#00ADB5] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const selectedClassroom = selectedClassroomState ||
    (selectedTeacher ? getTeacherClassroom(selectedTeacher) : null);
  const selectedCapacity  = selectedClassroom?.capacity || 0;
  const selectedEnrolled  = selectedClassroom ? getEnrolled(selectedClassroom._id) : 0;

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#060d14] space-y-6 py-2">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#00ADB5] mb-1">{t('daycare', 'Daycare')}</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('childAssignments', 'Child Assignments')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('assignChildrenDesc', 'Assign children to the right provider and classroom')}
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/admin/assign-classroom')}
          className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent px-4 py-2 text-sm font-semibold text-[#00ADB5] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          <i className="bx bx-buildings text-base" /> {t('manageClassroom', 'Manage Classroom')}
        </button>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          <span className="flex items-center gap-2"><i className="bx bx-error-circle flex-shrink-0" />{error}</span>
          <button type="button" onClick={() => { setLoading(true); fetchAll(); }} disabled={loading}
            className="rounded-lg border border-rose-300 dark:border-rose-500/40 px-3 py-1.5 font-semibold hover:bg-rose-100 dark:hover:bg-rose-500/10 disabled:opacity-50">
            {loading ? 'Loading…' : 'Retry'}
          </button>
        </div>
      )}
      {success && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"><i className="bx bx-check-circle flex-shrink-0"/>{success}</div>}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard icon="bxs-graduation" iconBg="bg-[#00ADB5]/10 text-[#00ADB5]"
          label={t('providers', 'Providers')} value={teachers.length} sub={t('availableProviders', 'Available providers')} />
        <StatCard icon="bx-user-check"  iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
          label={t('assignedChildren', 'Assigned Children')} value={children.filter(c => c.classroom).length} sub={t('currentlyAssigned', 'Currently assigned')} />
        <StatCard icon="bx-error-circle" iconBg="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
          label={t('unassignedChildren', 'Unassigned')} value={children.filter(c => !c.classroom).length} sub={t('needAssignment', 'Need assignment')} />
      </div>

      {/* ── Main 3-col grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Col 1: Provider + Classroom */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-6 shadow-sm space-y-5">

          {/* Provider picker */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">
              {t('providerName', 'Provider Name')}
            </p>
            <button
              onClick={() => { setTeacherOpen(p => !p); setChildOpen(false); setClassroomOpen(false); }}
              className={`${dropdownCls} shadow-sm`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedTeacher
                    ? <Av name={selectedTeacher.fullName} />
                    : <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-sm font-bold">P</div>
                  }
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${selectedTeacher ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                      {selectedTeacher ? selectedTeacher.fullName : t('selectTeacher', 'Select a provider')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {selectedTeacher ? t('providerProfileSelected', 'Provider profile selected') : t('tapToChoose', 'Tap to choose')}
                    </p>
                  </div>
                </div>
                <i className={`bx bx-chevron-down text-slate-400 transition-transform ${teacherOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {teacherOpen && (
              <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {teachers.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No eligible nannies are available.</p>
                ) : teachers.map(teacher => (
                  <button key={teacher._id}
                    onClick={() => { setSelectedTeacher(teacher); setTeacherOpen(false); setSelectedChildren([]); setSelectedClassroomState(getTeacherClassroom(teacher) || null); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#00ADB5]/5 transition-colors"
                  >
                    <Av name={teacher.fullName} size={8} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{teacher.fullName}</p>
                      <p className="text-xs text-slate-400">{t('roleProvider', 'Nanny')} · ID {String(teacher._id).slice(-6).toUpperCase()}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Classroom override */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">
              {t('selectClassroom', 'Select Classroom')}
            </p>
            <button
              onClick={() => { setClassroomOpen(p => !p); setTeacherOpen(false); setChildOpen(false); }}
              className={`${dropdownCls} shadow-sm`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${selectedClassroomState ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {selectedClassroomState ? selectedClassroomState.name : t('noClassroomSelected', 'No classroom selected')}
                  </p>
                  <p className="text-xs text-slate-400">{t('chooseClassroomOverride', 'Choose a classroom to override')}</p>
                </div>
                <i className={`bx bx-chevron-down text-slate-400 transition-transform ${classroomOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {classroomOpen && (
              <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {classrooms.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No active classrooms are available.</p>
                ) : classrooms.map(room => (
                  <button key={room._id}
                    onClick={() => { setSelectedClassroomState(room); setClassroomOpen(false); }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#00ADB5]/5 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{room.name}</p>
                      <p className="text-xs text-slate-400">
                        {room.ageGroup || 'N/A'} · {getEnrolled(room._id)}/{room.capacity} enrolled · {room.teacher?.fullName || 'Unassigned'}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 flex-shrink-0">{t('room', 'Room')}</span>
                  </button>
                ))}
                <button
                  onClick={() => { setSelectedClassroomState(null); setClassroomOpen(false); }}
                  className="w-full px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  {t('clearSelection', 'Clear selection')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Col 2: Child picker */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">
            {t('childName', 'Child Name')}
          </p>

          <button
            onClick={() => { setChildOpen(p => !p); setTeacherOpen(false); setClassroomOpen(false); }}
            className={`${dropdownCls} shadow-sm`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${selectedChildren.length ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {selectedChildren.length
                    ? `${selectedChildren.length} ${t('childrenSelected', 'children selected')}`
                    : t('chooseChildrenToAssign', 'Choose children to assign')}
                </p>
                <p className="text-xs text-slate-400">{t('multiSelectSearch', 'Multi-select with search')}</p>
              </div>
              <i className={`bx bx-chevron-down text-slate-400 transition-transform ${childOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {childOpen && (
            <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] shadow-lg p-3">
              <div className="relative mb-3">
                <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={childSearch}
                  onChange={e => setChildSearch(e.target.value)}
                  placeholder={t('searchChildren', 'Search children…')}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060d14] py-2.5 pl-9 pr-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredChildren.length === 0 ? (
                  <p className="text-sm text-center text-slate-400 py-4">
                    {childSearch ? t('noChildrenFound') : t('noUnassignedChildren')}
                  </p>
                ) : filteredChildren.map(child => {
                  const checked = selectedChildren.includes(child._id);
                  return (
                    <label key={child._id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition ${
                        checked ? 'border-[#00ADB5] bg-[#00ADB5]/5' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleChild(child._id)}
                        className="h-4 w-4 rounded accent-[#00ADB5]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                          {child.firstName} {child.lastName}
                        </p>
                        <p className="text-xs text-slate-400">
                          ID {String(child._id).slice(-6).toUpperCase()} · {t('age', 'Age')} {child.age != null ? child.age : 'N/A'}
                        </p>
                      </div>
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        {t('unassigned', 'Unassigned')}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selection chips */}
          <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#060d14] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400 mb-2.5">
              {t('selection', 'Selection')}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedChildren.length === 0 ? (
                <span className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-400">
                  {t('noChildrenSelected', 'No children selected')}
                </span>
              ) : selectedChildren.map(id => {
                const child = children.find(x => x._id === id);
                return child ? (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#00ADB5]/10 border border-[#00ADB5]/20 px-3 py-1 text-xs font-semibold text-[#00ADB5]">
                    {child.firstName}
                    <button onClick={() => toggleChild(id)} className="ml-0.5 hover:text-rose-400 transition-colors">
                      <i className="bx bx-x text-sm" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </div>

        {/* Col 3: Preview + Assign */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">
              {t('previewAssignment', 'Preview Assignment')}
            </p>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#060d14] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {selectedTeacher?.fullName || t('providerNotSelected', 'Provider not selected')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedClassroom ? selectedClassroom.name : t('selectTeacherPreview', 'Select a provider to preview room')}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {selectedChildren.length} {t('selected', 'selected')}
                </span>
              </div>

              {/* Capacity */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] p-3">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400 mb-2">
                  {t('roomCapacity', 'Room Capacity')}
                </p>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {selectedEnrolled}/{selectedCapacity} {t('enrolled', 'enrolled')}
                  </p>
                  <p className="text-xs text-slate-400 flex-shrink-0">
                    {selectedClassroom
                      ? `${selectedCapacity - selectedEnrolled} ${t('spotsLeft', 'spots left')}`
                      : t('na', 'N/A')}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-[#00ADB5] transition-all"
                    style={{ width: selectedCapacity ? `${Math.min((selectedEnrolled / selectedCapacity) * 100, 100)}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Assign button */}
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleAssignClassroom}
              disabled={assigningClassroom || submitting || !selectedTeacher || !selectedClassroom}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#00ADB5] px-5 py-3 text-sm font-bold text-[#00ADB5] transition hover:bg-[#00ADB5]/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {assigningClassroom
                ? <><i className="bx bx-loader-alt animate-spin text-lg" /> Saving classroom...</>
                : <><i className="bx bx-buildings text-lg" /> Assign nanny to classroom</>
              }
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={submitting || assigningClassroom || !selectedTeacher || selectedChildren.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-[0_4px_16px_rgba(0,173,181,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? <><i className="bx bx-loader-alt animate-spin text-lg" /> {t('assigning', 'Assigning...')}</>
                : <><i className="bx bx-check text-lg" /> Assign selected children</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignTeacher;
