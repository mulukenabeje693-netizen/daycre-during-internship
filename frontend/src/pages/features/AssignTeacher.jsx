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
  const [classroomOpen, setClassroomOpen]   = useState(false);

  const fetchAll = async () => {
    try {
      const [staffRes, childRes, classroomRes] = await Promise.all([
        api.get('/staff'),
        api.get('/children'),
        api.get('/classrooms'),
      ]);
      setTeachers(staffRes.data.data.filter(s => s.role === 'teacher'));
      setChildren(childRes.data.data);
      setClassrooms(classroomRes.data.data);
    } catch {
      setError(t('failedToLoad', 'Failed to load assignment data.'));
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

  const handleAssign = async () => {
    if (!selectedTeacher || selectedChildren.length === 0)
      return flash(t('selectTeacherAndChild', 'Please select a provider and at least one child.'), true);
    const room = selectedClassroomState || getTeacherClassroom(selectedTeacher);
    if (!room) return flash(t('noClassroomForProvider', 'Selected provider has no classroom assigned.'), true);
    setSubmitting(true);
    try {
      await Promise.all(selectedChildren.map(id =>
        api.put(`/children/${id}/classroom`, { classroomId: room._id })
      ));

      // Ensure the classroom is assigned to the selected teacher (nanny)
      // so that the provider's dashboard (`/classrooms/my-classroom`) will return it.
      if (selectedTeacher && room && (!room.teacher || (room.teacher && room.teacher._id && room.teacher._id !== selectedTeacher._id && room.teacher !== selectedTeacher._id))) {
        try {
          await api.put(`/classrooms/${room._id}`, { teacher: selectedTeacher._id });
        } catch (err) {
          // Non-fatal: continue but show a warning
          flash(t('failedToAssignTeacherToRoom', 'Assigned children but failed to set provider for room.'), true);
        }
      }
      const count = selectedChildren.length;
      setSelectedChildren([]);
      await fetchAll();
      flash(`${t('assigned', 'Assigned')} ${count} ${t('childrenToProvider', 'child(ren) to')} ${selectedTeacher.fullName}.`);
    } catch {
      flash(t('assignmentFailed', 'Assignment failed. Please try again.'), true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-[#00ADB5] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const selectedClassroom = selectedTeacher ? getTeacherClassroom(selectedTeacher) : null;
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
      {error   && <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400"><i className="bx bx-error-circle flex-shrink-0"/>{error}</div>}
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
                {teachers.map(teacher => (
                  <button key={teacher._id}
                    onClick={() => { setSelectedTeacher(teacher); setTeacherOpen(false); setSelectedChildren([]); setSelectedClassroomState(getTeacherClassroom(teacher) || null); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#00ADB5]/5 transition-colors"
                  >
                    <Av name={teacher.fullName} size={8} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{teacher.fullName}</p>
    <p className="text-xs text-slate-400">{t('roleProvider', 'Nanny')}</p>
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
                {classrooms.map(room => (
                  <button key={room._id}
                    onClick={() => { setSelectedClassroomState(room); setClassroomOpen(false); }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#00ADB5]/5 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{room.name}</p>
                      <p className="text-xs text-slate-400">{room.ageGroup || 'N/A'}</p>
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
                        <p className="text-xs text-slate-400">{t('age', 'Age')} {child.age != null ? child.age : 'N/A'}</p>
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
          <button
            onClick={handleAssign}
            disabled={submitting || !selectedTeacher || selectedChildren.length === 0}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-[0_4px_16px_rgba(0,173,181,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? <><i className="bx bx-loader-alt animate-spin text-lg" /> {t('assigning', 'Assigning...')}</>
              : <><i className="bx bx-check text-lg" /> {t('assignToClassroom', 'Assign')}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignTeacher;
