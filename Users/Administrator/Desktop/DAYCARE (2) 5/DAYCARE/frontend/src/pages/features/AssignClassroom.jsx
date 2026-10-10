import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';

const Av = ({ name, size = 8 }) => (
  <div
    className="rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0"
    style={{ width: `${size * 4}px`, height: `${size * 4}px`, fontSize: `${size * 1.5}px` }}
  >
    {name?.charAt(0) || '?'}
  </div>
);

const Donut = ({ value, max, color = 'var(--primary)', size = 48 }) => {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-white">
        {value}/{max}
      </span>
    </div>
  );
};

const StatCard = ({ icon, iconBg, label, value, sub, sparkColor = '#00ADB5' }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-4 flex items-center gap-4 shadow-sm">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${iconBg}`}>
      <i className={`bx ${icon}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 truncate">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
    </div>
    <svg width="48" height="24" viewBox="0 0 48 24" className="flex-shrink-0 opacity-60">
      <polyline points="0,20 8,14 16,16 24,8 32,12 40,6 48,10"
        fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const ROOM_ICONS = ['bx-sun', 'bxs-star', 'bx-leaf', 'bx-water'];
const ROOM_COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6'];

const AssignClassroom = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [children, setChildren] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [childSearch, setChildSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = async () => {
    try {
      const [childrenRes, classroomsRes] = await Promise.all([
        api.get('/children'),
        api.get('/classrooms'),
      ]);
      setChildren(childrenRes.data.data);
      setClassrooms(classroomsRes.data.data);
    } catch {
      setError('Failed to load assignment data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const flash = (message, isError = false) => {
    if (isError) {
      setError(message);
      setTimeout(() => setError(''), 3000);
    } else {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const getEnrolled = classroomId =>
    children.filter(child => child.classroom?._id === classroomId || child.classroom === classroomId).length;

  const toggleChild = id =>
    setSelectedChildren(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);

  const handleAssign = async () => {
    if (!selectedClassroom || selectedChildren.length === 0) {
      return flash('Select a classroom and at least one child.', true);
    }

    const selectedCount = selectedChildren.length;
    const selectedNames = selectedChildren
      .map(id => children.find(child => child._id === id))
      .filter(Boolean)
      .map(child => `${child.firstName} ${child.lastName}`);

    setSubmitting(true);
    try {
      await Promise.all(
        selectedChildren.map(id => api.put(`/children/${id}/classroom`, { classroomId: selectedClassroom._id }))
      );

      setRecentAssignments(prev => [
        {
          classroom: selectedClassroom,
          children: selectedNames,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ].slice(0, 4));

      setSelectedChildren([]);
      await fetchAll();
      flash(`${selectedCount} child(ren) assigned to ${selectedClassroom.name}.`);
    } catch {
      flash('Assignment failed. Please try again.', true);
    } finally {
      setSubmitting(false);
    }
  };

  const assignedChildren = children.filter(child => child.classroom);
  const unassignedChildren = children.filter(child => !child.classroom);
  const totalCapacity = classrooms.reduce((sum, room) => sum + (room.capacity || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredChildren = children.filter(child => {
    const name = `${child.firstName} ${child.lastName}`.toLowerCase();
    const matchesName = name.includes(childSearch.toLowerCase());
    const matchesFilter = statusFilter === 'all'
      || (statusFilter === 'unassigned' ? !child.classroom : !!child.classroom);
    return matchesName && matchesFilter;
  });

  const classroomTeachers = classrooms.filter(room => room.teacher).slice(0, 4);

  return (
    <div className="space-y-6 px-2 pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">{t('childAssignments', 'Child Assignments')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('assignChildrenDesc', 'Assign children to teachers and classrooms')}</p>
        </div>
      </div>

      {error && <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">✅ {success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard icon="bx-group" iconBg="bg-[#00ADB5]/10 text-[#00ADB5]" label={t('totalChildren', 'Total Children')} value={children.length} sub="View all children ›" sparkColor="#00ADB5" />
        <StatCard icon="bx-check-circle" iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300" label={t('assignedChildren', 'Assigned Children')} value={assignedChildren.length} sub={`${children.length ? Math.round(assignedChildren.length / children.length * 100) : 0}% assigned`} sparkColor="#10b981" />
        <StatCard icon="bx-error-circle" iconBg="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300" label={t('unassignedChildren', 'Unassigned Children')} value={unassignedChildren.length} sub="Need assignment" sparkColor="#f59e0b" />
        <StatCard icon="bxs-graduation" iconBg="bg-[#00ADB5]/10 text-[#00ADB5]" label={t('providers', 'Providers')} value={classroomTeachers.length} sub="Active providers" sparkColor="#00ADB5" />
        <StatCard icon="bx-buildings" iconBg="bg-[#00ADB5]/10 text-[#00ADB5]" label={t('classrooms', 'Classrooms')} value={classrooms.length} sub="Active rooms" sparkColor="#00ADB5" />
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 dark:bg-slate-900/80 p-2 border border-slate-200 dark:border-slate-700/70 w-fit">
        <button className="rounded-xl bg-[#00ADB5] px-6 py-2 text-sm font-semibold text-white shadow-sm"
          onClick={() => navigate('/dashboard/admin/assign-teacher')}>
          <i className="bx bxs-graduation" /> {t('teacherAssignment', 'Teacher Assignment')}
        </button>
        <button className="rounded-xl bg-white dark:bg-slate-800 px-6 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[#00ADB5] dark:hover:text-white transition-colors border border-slate-200 dark:border-transparent">
          <i className="bx bx-buildings" /> {t('classroomAssignment', 'Classroom Assignment')}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('selectClassroom', 'Select Classroom')}</p>
              <p className="text-xs text-slate-400">{t('chooseClassroomPrompt', 'Choose a classroom to assign children')}</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-900/70 px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400">Step 1</span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {classrooms.map((room, index) => {
              const enrolled = getEnrolled(room._id);
              const capacity = room.capacity || 0;
              const filled = capacity > 0 ? Math.min(Math.round(enrolled / capacity * 100), 100) : 0;
              const color = ROOM_COLORS[index % ROOM_COLORS.length];
              const icon = ROOM_ICONS[index % ROOM_ICONS.length];
              const isSelected = selectedClassroom?._id === room._id;

              return (
                <button
                  key={room._id}
                  onClick={() => { setSelectedClassroom(room); setSelectedChildren([]); }}
                  className={`w-full rounded-xl border px-4 py-4 text-left transition ${isSelected ? 'border-[#00ADB5] bg-[#00ADB5]/5' : 'border-slate-200 dark:border-slate-700/60 hover:border-[#00ADB5]/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                        style={{ background: `${color}18`, color }}>
                        <i className={`bx ${icon}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{room.name}</p>
                        <p className="text-[11px] text-slate-400">Teacher: {room.teacher?.fullName || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{room.ageGroup}</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-white">{enrolled}/{capacity}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2 rounded-full" style={{ width: `${filled}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color }}>{filled}%</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/90 py-3 text-sm font-semibold text-slate-600 dark:text-slate-200 hover:border-[#00ADB5] hover:text-[#00ADB5] transition-colors">View all classrooms ›</button>
        </div>

        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('chooseChildren', 'Select Children')}</p>
              <p className="text-xs text-slate-400">{t('chooseChildrenDesc', 'Choose children to assign to the selected classroom')}</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-900/70 px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400">Step 2</span>
          </div>

          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={childSearch}
                onChange={e => setChildSearch(e.target.value)}
                placeholder="Search children..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-900/90 py-2.5 pl-11 pr-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full max-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-900/90 py-2.5 px-4 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15"
            >
              <option value="all">{t('allStatus', 'All Status')}</option>
              <option value="unassigned">{t('unassigned', 'Unassigned')}</option>
              <option value="assigned">{t('assigned', 'Assigned')}</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredChildren.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-6 text-center text-sm text-slate-400">No children found</div>
            ) : filteredChildren.map(child => {
              const isChecked = selectedChildren.includes(child._id);
              const assigned = !!child.classroom;
              return (
                <label key={child._id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${isChecked ? 'border-[#00ADB5] bg-[#00ADB5]/5' : 'border-slate-100 dark:border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleChild(child._id)}
                    className="h-4 w-4 rounded accent-[#00ADB5]"
                  />
                  <Av name={`${child.firstName} ${child.lastName}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{child.firstName} {child.lastName}</p>
                    <p className="text-xs text-slate-400">Age: {child.age != null ? child.age : 'N/A'} · ID: {child._id.slice(-5)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${assigned ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                    {assigned ? 'Assigned' : 'Unassigned'}
                  </span>
                </label>
              );
            })}
          </div>

          <button
            onClick={handleAssign}
            disabled={submitting || !selectedClassroom || selectedChildren.length === 0}
            className="absolute -right-5 top-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[#00ADB5] text-white shadow-lg shadow-[#00ADB5]/25 transition disabled:opacity-50"
          >
            <i className="bx bx-right-arrow-alt text-xl" />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('previewAssignment', 'Preview Assignment')}</p>
              <p className="text-xs text-slate-400">{t('reviewAssignmentDesc', 'Review children to be assigned')}</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-900/70 px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400">Step 3</span>
          </div>

          {selectedClassroom ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedClassroom.name}</p>
                    <p className="text-[11px] text-slate-400">{selectedClassroom.ageGroup} · Teacher: {selectedClassroom.teacher?.fullName || 'Unassigned'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Capacity</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{getEnrolled(selectedClassroom._id)}/{selectedClassroom.capacity}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedChildren.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-8 text-center text-sm text-slate-400">No children selected yet</div>
                ) : selectedChildren.map(id => {
                  const child = children.find(item => item._id === id);
                  return child ? (
                    <div key={id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 px-4 py-3">
                      <Av name={`${child.firstName} ${child.lastName}`} size={9} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-slate-400">Age {child.age != null ? child.age : 'N/A'} years</p>
                      </div>
                      <button onClick={() => toggleChild(id)} className="text-rose-500 text-xs font-semibold hover:text-rose-600">Remove</button>
                    </div>
                  ) : null;
                })}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Room Capacity After Assignment</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedChildren.length + getEnrolled(selectedClassroom._id)} / {selectedClassroom.capacity}</p>
                  </div>
                  <Donut value={selectedChildren.length + getEnrolled(selectedClassroom._id)} max={selectedClassroom.capacity} color="#00ADB5" size={52} />
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-2 rounded-full bg-[#00ADB5]" style={{ width: `${selectedClassroom.capacity > 0 ? Math.min((selectedChildren.length + getEnrolled(selectedClassroom._id)) / selectedClassroom.capacity * 100, 100) : 0}%` }} />
                </div>
                <p className="mt-3 text-[11px] text-slate-400">{Math.max(selectedClassroom.capacity - (selectedChildren.length + getEnrolled(selectedClassroom._id)), 0)} spots left · {Math.min(Math.round((selectedChildren.length + getEnrolled(selectedClassroom._id)) / (selectedClassroom.capacity || 1) * 100), 100)}% full</p>
              </div>

              <button
                onClick={handleAssign}
                disabled={submitting || selectedChildren.length === 0}
                className="w-full rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('assigning', 'Assigning...') : t('assignToClassroom', 'Assign to Classroom')}
              </button>
              <p className="text-xs text-slate-400 text-center">{selectedChildren.length} child(ren) will be assigned to {selectedClassroom.name}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-8 text-center text-sm text-slate-400">
              Select a classroom to preview assignment details.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('teacherOverview', 'Teacher Overview')}</p>
            <button className="text-xs text-[#00ADB5] hover:underline">View all ›</button>
          </div>
          <div className="space-y-3">
            {classroomTeachers.map((room, i) => {
              const enrolled = getEnrolled(room._id);
              const color = ROOM_COLORS[i % ROOM_COLORS.length];
              return (
                <div key={room._id} className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-4">
                  <div className="flex items-center gap-3">
                    <Av name={room.teacher.fullName} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{room.teacher.fullName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{room.name}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: `${color}18`, color }}>{enrolled}/{room.capacity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('classroomOverview', 'Classroom Overview')}</p>
            <button className="text-xs text-[#00ADB5] hover:underline">View all ›</button>
          </div>
          <div className="space-y-3">
            {classrooms.slice(0, 4).map((room, i) => {
              const enrolled = getEnrolled(room._id);
              const color = ROOM_COLORS[i % ROOM_COLORS.length];
              return (
                <div key={room._id} className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{room.name}</p>
                      <p className="text-[10px] text-slate-400">{room.ageGroup}</p>
                    </div>
                    <Donut value={enrolled} max={room.capacity} color={color} size={44} />
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-2 rounded-full" style={{ width: `${room.capacity > 0 ? Math.min(enrolled / room.capacity * 100, 100) : 0}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('recentAssignments', 'Recent Assignments')}</p>
            <button className="text-xs text-[#00ADB5] hover:underline">View all ›</button>
          </div>
          <div className="space-y-3">
            {recentAssignments.length === 0 ? (
              <div className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-6 text-center text-sm text-slate-400">No assignment activity yet</div>
            ) : recentAssignments.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{item.classroom.name}</p>
                  <span className="text-[10px] text-slate-400">{item.time}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">{item.children.join(', ')}</p>
                <span className="inline-flex rounded-full bg-[#00ADB5]/10 px-2 py-1 text-[10px] text-[#00ADB5]">{item.children.length} assigned</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1929] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('unassignedChildren', 'Unassigned Children')}</p>
            <button className="text-xs text-[#00ADB5] hover:underline">View all ›</button>
          </div>
          <div className="space-y-3">
            {unassignedChildren.slice(0, 5).map(child => (
              <div key={child._id} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/80 px-4 py-3">
                <Av name={`${child.firstName} ${child.lastName}`} />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{child.firstName} {child.lastName}</p>
                  <p className="text-[11px] text-slate-400">Age {child.age != null ? child.age : 'N/A'}</p>
                </div>
                <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">Unassigned</span>
              </div>
            ))}
            {unassignedChildren.length === 0 && <p className="text-sm text-slate-400">Everyone is assigned.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignClassroom;
