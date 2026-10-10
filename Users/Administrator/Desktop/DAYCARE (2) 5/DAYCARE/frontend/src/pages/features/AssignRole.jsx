import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Av = ({ name, size = 8 }) => (
  <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
    {name?.charAt(0) || '?'}
  </div>
);

const Donut = ({ value, max, color = '#6366f1' }) => {
  const r = 15; const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{value}/{max}</span>
    </div>
  );
};

const StatCard = ({ icon, iconBg, label, value, sub }) => (
  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex items-center gap-3">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${iconBg}`}>
      <i className={`bx ${icon}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-slate-400 truncate">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
    </div>
  </div>
);

const ROOM_ICONS = ['bx-sun', 'bxs-star', 'bx-leaf', 'bx-water'];
const ROOM_COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6'];

const AssignRole = () => {
  const [tab, setTab] = useState('teacher');
  const [teachers, setTeachers] = useState([]);
  const [children, setChildren] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentAssignments, setRecentAssignments] = useState([]);

  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [childSearch, setChildSearch] = useState('');
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [teacherSubmitting, setTeacherSubmitting] = useState(false);

  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [classChildSearch, setClassChildSearch] = useState('');
  const [classStatusFilter, setClassStatusFilter] = useState('all');
  const [classSelectedChildren, setClassSelectedChildren] = useState([]);
  const [classSubmitting, setClassSubmitting] = useState(false);

  const fetchAll = async () => {
    try {
      const [staffRes, childrenRes, classroomsRes] = await Promise.all([
        api.get('/staff'), api.get('/children'), api.get('/classrooms'),
      ]);
      setTeachers(staffRes.data.data.filter(s => s.role === 'teacher'));
      setChildren(childrenRes.data.data);
      setClassrooms(classroomsRes.data.data);
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 3000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
  };

  const getTC = (t) => classrooms.find(c => c.teacher?._id === t._id || c.teacher === t._id);
  const getEnrolled = (clId) => children.filter(ch => ch.classroom?._id === clId || ch.classroom === clId).length;
  const toggleChild = (id, setArr) => setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAssignToTeacher = async () => {
    if (!selectedTeacher || selectedChildren.length === 0) return flash('Select a teacher and at least one child.', true);
    const tc = getTC(selectedTeacher);
    if (!tc) return flash('This teacher has no classroom assigned yet.', true);
    setTeacherSubmitting(true);
    try {
      await Promise.all(selectedChildren.map(id => api.put(`/children/${id}/classroom`, { classroomId: tc._id })));
      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const entries = selectedChildren.map(id => {
        const ch = children.find(c => c._id === id);
        return { childName: `${ch.firstName} ${ch.lastName}`, teacherName: selectedTeacher.fullName, time: `Today, ${time}` };
      });
      setRecentAssignments(p => [...entries, ...p].slice(0, 10));
      setSelectedChildren([]);
      await fetchAll();
      flash(`${entries.length} child(ren) assigned to ${selectedTeacher.fullName}.`);
    } catch { flash('Assignment failed.', true); }
    finally { setTeacherSubmitting(false); }
  };

  const handleAssignToClassroom = async () => {
    if (!selectedClassroom || classSelectedChildren.length === 0) return flash('Select a classroom and at least one child.', true);
    setClassSubmitting(true);
    try {
      await Promise.all(classSelectedChildren.map(id => api.put(`/children/${id}/classroom`, { classroomId: selectedClassroom._id })));
      setClassSelectedChildren([]);
      await fetchAll();
      flash(`${classSelectedChildren.length} child(ren) assigned to ${selectedClassroom.name}.`);
    } catch { flash('Assignment failed.', true); }
    finally { setClassSubmitting(false); }
  };

  const assignedChildren = children.filter(c => c.classroom);
  const unassignedChildren = children.filter(c => !c.classroom);
  const totalCapacity = classrooms.reduce((s, c) => s + (c.capacity || 0), 0);

  if (loading) return <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {tab === 'teacher' ? 'Child Assignments' : 'Classroom Assignment'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {tab === 'teacher' ? 'Assign children to teachers and classrooms' : 'Assign children to classrooms and manage room capacity'}
        </p>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-3 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 text-sm">✅ {success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon="bx-group" iconBg="bg-purple-500/20 text-purple-400" label="Total Children" value={children.length} sub="View all children ›" />
        <StatCard icon="bx-check-circle" iconBg="bg-emerald-500/20 text-emerald-400" label="Assigned Children" value={assignedChildren.length} sub={`${children.length ? Math.round(assignedChildren.length/children.length*100) : 0}% assigned`} />
        <StatCard icon="bx-error-circle" iconBg="bg-amber-500/20 text-amber-400" label="Unassigned Children" value={unassignedChildren.length} sub="Need assignment" />
        <StatCard icon="bxs-graduation" iconBg="bg-cyan-500/20 text-cyan-400" label="Teachers" value={teachers.length} sub="Active teachers" />
        {tab === 'teacher'
          ? <StatCard icon="bx-buildings" iconBg="bg-indigo-500/20 text-indigo-400" label="Classrooms" value={classrooms.length} sub="Active classrooms" />
          : <StatCard icon="bx-sort-a-z" iconBg="bg-pink-500/20 text-pink-400" label="Total Capacity" value={totalCapacity} sub="Overall capacity" />
        }
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 dark:bg-[#0d1520]/60 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('teacher')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'teacher' ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          <i className="bx bxs-graduation" /> Teacher Assignment
        </button>
        <button onClick={() => setTab('classroom')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'classroom' ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          <i className="bx bx-buildings" /> Classroom Assignment
        </button>
      </div>

      {/* ══ TEACHER TAB ══ */}
      {tab === 'teacher' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Col 1 – Select Teacher */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Select Teacher</p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {teachers.map(t => {
                  const tc = getTC(t);
                  const enrolled = tc ? getEnrolled(tc._id) : 0;
                  const cap = tc?.capacity || 0;
                  const isSel = selectedTeacher?._id === t._id;
                  return (
                    <button key={t._id} onClick={() => { setSelectedTeacher(t); setSelectedChildren([]); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${isSel ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-100 dark:border-teal-900/30 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                      <div className="flex items-center gap-2">
                        <Av name={t.fullName} size={9} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{t.fullName}</p>
                            <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">Lead Teacher</span>
                          </div>
                          <p className="text-xs text-slate-400 truncate">{tc?.name || 'No classroom'} {tc ? `(${tc.ageGroup})` : ''}</p>
                        </div>
                        <i className="bx bx-chevron-down text-slate-400 flex-shrink-0" />
                      </div>
                      {tc && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Ratio 1:{cap > 0 ? Math.ceil(cap/Math.max(enrolled,1)) : '—'} · {enrolled} / {cap} Children</span>
                            <span>{cap - enrolled} spots left</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 dark:bg-[#0d1520] rounded-full">
                            <div className="h-1 rounded-full bg-indigo-500" style={{ width: `${cap > 0 ? Math.min(enrolled/cap*100,100) : 0}%` }} />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedTeacher && (() => {
                const tc = getTC(selectedTeacher);
                if (!tc) return null;
                const enrolled = getEnrolled(tc._id);
                const cap = tc.capacity || 0;
                return (
                  <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-center gap-4">
                    <Donut value={enrolled} max={cap} />
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Room Capacity</p>
                      <p className="text-xs text-indigo-400">{enrolled} Children Assigned</p>
                      <p className="text-xs text-emerald-400">{cap - enrolled} spots available</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Col 2 – Available Children */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Available Children</p>
              <div className="relative">
                <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input type="text" placeholder="Search children..." value={childSearch} onChange={e => setChildSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-teal-900/40 bg-transparent text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {children.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(childSearch.toLowerCase())).map(c => {
                  const checked = selectedChildren.includes(c._id);
                  return (
                    <label key={c._id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer ${checked ? 'bg-indigo-500/5 border border-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-[#162030]/50 border border-transparent'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleChild(c._id, setSelectedChildren)} className="accent-indigo-500 w-4 h-4 flex-shrink-0" />
                      <Av name={`${c.firstName} ${c.lastName}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-slate-400">{c.age != null ? c.age : 'N/A'} years</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Col 3 – Selected Children */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 flex flex-col gap-3">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Selected Children ({selectedChildren.length})</p>
              <div className="flex-1 space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedChildren.length === 0
                  ? <p className="text-xs text-slate-400 text-center py-10">No children selected yet</p>
                  : selectedChildren.map(id => {
                    const c = children.find(ch => ch._id === id);
                    return c ? (
                      <div key={id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0d1520]/50">
                        <Av name={`${c.firstName} ${c.lastName}`} />
                        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-white truncate">{c.firstName} {c.lastName}</span>
                        <button onClick={() => toggleChild(id, setSelectedChildren)} className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center text-sm">×</button>
                      </div>
                    ) : null;
                  })}
              </div>
              <button onClick={handleAssignToTeacher} disabled={teacherSubmitting || !selectedTeacher || selectedChildren.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 transition-all">
                <i className="bx bx-send" />
                {teacherSubmitting ? 'Assigning...' : 'Assign to Teacher'}
              </button>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Teacher Overview */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Teacher Overview</p>
              <div className="grid grid-cols-1 gap-3">
                {teachers.slice(0,3).map((t, i) => {
                  const tc = getTC(t);
                  const enrolled = tc ? getEnrolled(tc._id) : 0;
                  const cap = tc?.capacity || 0;
                  const clChildren = tc ? children.filter(ch => ch.classroom?._id === tc._id || ch.classroom === tc._id).slice(0,4) : [];
                  return (
                    <div key={t._id} className="p-3 rounded-xl border border-slate-100 dark:border-teal-900/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <Av name={t.fullName} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{t.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{tc?.name || 'No classroom'}</p>
                        </div>
                        <Donut value={enrolled} max={cap} color={ROOM_COLORS[i % ROOM_COLORS.length]} />
                      </div>
                      {tc && <>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{enrolled} Children</span>
                          <span className="text-emerald-400">{cap - enrolled} spots left</span>
                        </div>
                        <div className="flex gap-1">
                          {clChildren.map(c => <div key={c._id} className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[8px] font-bold">{c.firstName?.charAt(0) || '?'}</div>)}
                          {enrolled > 4 && <span className="text-[10px] text-slate-400">+{enrolled-4}</span>}
                        </div>
                      </>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Assignments */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Recent Assignments</p>
              {recentAssignments.length === 0
                ? <p className="text-xs text-slate-400 text-center py-10">No assignments yet this session</p>
                : recentAssignments.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-teal-900/30 last:border-0">
                    <Av name={r.childName} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{r.childName}</p>
                      <p className="text-xs text-slate-400">→ {r.teacherName} · {r.time}</p>
                    </div>
                    <i className="bx bx-check-circle text-emerald-400 text-lg flex-shrink-0" />
                  </div>
                ))}
            </div>

            {/* Unassigned */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Unassigned Children</p>
              {unassignedChildren.length === 0
                ? <p className="text-xs text-emerald-400 text-center py-10">All children are assigned ✓</p>
                : unassignedChildren.slice(0,5).map(c => (
                  <div key={c._id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-teal-900/30 last:border-0">
                    <Av name={`${c.firstName} ${c.lastName}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-slate-400">{c.age != null ? c.age : 'N/A'} years</p>
                    </div>
                    <i className="bx bx-error text-amber-400 text-lg flex-shrink-0" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ CLASSROOM TAB ══ */}
      {tab === 'classroom' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Col 1 – Select Classroom */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Select Classroom</p>
              </div>
              <p className="text-xs text-slate-400">Choose a classroom to assign children</p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {classrooms.map((cl, i) => {
                  const enrolled = getEnrolled(cl._id);
                  const isSel = selectedClassroom?._id === cl._id;
                  const color = ROOM_COLORS[i % ROOM_COLORS.length];
                  return (
                    <button key={cl._id} onClick={() => { setSelectedClassroom(cl); setClassSelectedChildren([]); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${isSel ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-100 dark:border-teal-900/30 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{ background: `${color}22`, color }}>
                            <i className={`bx ${ROOM_ICONS[i % ROOM_ICONS.length]}`} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-white">{cl.name}</p>
                            <p className="text-xs text-slate-400">{cl.teacher?.fullName || 'No teacher'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Donut value={enrolled} max={cl.capacity} color={color} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">Capacity: {cl.capacity} children</p>
                      <div className="mt-1.5 w-full h-1 bg-slate-100 dark:bg-[#0d1520] rounded-full">
                        <div className="h-1 rounded-full transition-all" style={{ width: `${cl.capacity > 0 ? Math.min(enrolled/cl.capacity*100,100) : 0}%`, backgroundColor: color }} />
                      </div>
                      <p className="text-[10px] mt-1" style={{ color }}>{cl.capacity - enrolled} spots left · Enrolled</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Col 2 – Select Children */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Select Children</p>
              </div>
              <p className="text-xs text-slate-400">{selectedClassroom ? `Choose children to assign to ${selectedClassroom.name}` : 'Select a classroom first'}</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                  <input type="text" placeholder="Search children..." value={classChildSearch} onChange={e => setClassChildSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-teal-900/40 bg-transparent text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <select value={classStatusFilter} onChange={e => setClassStatusFilter(e.target.value)}
                  className="border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2 text-xs bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none">
                  <option value="all">All Status</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned</option>
                </select>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {children.filter(c => {
                  const nm = `${c.firstName} ${c.lastName}`.toLowerCase().includes(classChildSearch.toLowerCase());
                  const st = classStatusFilter === 'all' || (classStatusFilter === 'unassigned' ? !c.classroom : !!c.classroom);
                  return nm && st;
                }).map(c => {
                  const checked = classSelectedChildren.includes(c._id);
                  const isAss = !!c.classroom;
                  return (
                    <label key={c._id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer ${checked ? 'bg-indigo-500/5 border border-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-[#162030]/50 border border-transparent'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleChild(c._id, setClassSelectedChildren)} className="accent-indigo-500 w-4 h-4 flex-shrink-0" />
                      <Av name={`${c.firstName} ${c.lastName}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-slate-400">Age: {c.age != null ? c.age : 'N/A'} yrs · ID: {c._id.slice(-5)}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${isAss ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {isAss ? 'Assigned' : 'Unassigned'}
                      </span>
                    </label>
                  );
                })}
              </div>
              {classSelectedChildren.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-indigo-400">{classSelectedChildren.length} selected</span>
                  <button onClick={() => setClassSelectedChildren([])} className="text-slate-400 hover:text-slate-600">Clear</button>
                </div>
              )}
            </div>

            {/* Col 3 – Preview */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Preview Assignment</p>
              </div>
              <p className="text-xs text-slate-400">Review children to be assigned</p>
              {selectedClassroom && (() => {
                const i = classrooms.findIndex(c => c._id === selectedClassroom._id);
                const color = ROOM_COLORS[i % ROOM_COLORS.length];
                return (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: `${color}44`, background: `${color}11` }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}22`, color }}>
                      <i className={`bx ${ROOM_ICONS[i % ROOM_ICONS.length]} text-sm`} />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-white flex-1">Assigning to: {selectedClassroom.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>{selectedClassroom.ageGroup}</span>
                  </div>
                );
              })()}
              <div className="flex-1 space-y-2 max-h-48 overflow-y-auto pr-1">
                {classSelectedChildren.length === 0
                  ? <p className="text-xs text-slate-400 text-center py-8">No children selected</p>
                  : classSelectedChildren.map(id => {
                    const c = children.find(ch => ch._id === id);
                    return c ? (
                      <div key={id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0d1520]/50">
                        <Av name={`${c.firstName} ${c.lastName}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-slate-400">{c.age != null ? c.age : 'N/A'} years</p>
                        </div>
                        <button onClick={() => toggleChild(id, setClassSelectedChildren)} className="text-rose-400 text-xs font-semibold hover:text-rose-500">Remove</button>
                      </div>
                    ) : null;
                  })}
              </div>
              {selectedClassroom && (() => {
                const enrolled = getEnrolled(selectedClassroom._id);
                const after = enrolled + classSelectedChildren.length;
                const cap = selectedClassroom.capacity;
                const over = after > cap;
                return (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1520]/50 space-y-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Room Capacity After Assignment</p>
                    <div className="flex items-center gap-3">
                      <Donut value={after} max={cap} color={over ? '#ef4444' : '#6366f1'} />
                      <div>
                        <p className="text-xs text-slate-400">Available Spots</p>
                        <p className={`text-sm font-bold ${over ? 'text-rose-400' : 'text-white'}`}>{over ? 'Over!' : `${cap - after} spot${cap-after!==1?'s':''} left`}</p>
                        <p className="text-xs text-slate-400">{Math.min(Math.round(after/cap*100),100)}% full</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full">
                      <div className={`h-1.5 rounded-full transition-all ${over ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(after/cap*100,100)}%` }} />
                    </div>
                  </div>
                );
              })()}
              <button onClick={handleAssignToClassroom} disabled={classSubmitting || !selectedClassroom || classSelectedChildren.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 transition-all">
                <i className="bx bx-check-circle" />
                {classSubmitting ? 'Assigning...' : 'Assign to Classroom'}
              </button>
              {selectedClassroom && classSelectedChildren.length > 0 && (
                <p className="text-[11px] text-slate-400 text-center">{classSelectedChildren.length} child(ren) will be assigned to {selectedClassroom.name}</p>
              )}
            </div>
          </div>

          {/* Classroom Overview */}
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4">
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-4">Classroom Overview</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {classrooms.map((cl, i) => {
                const enrolled = getEnrolled(cl._id);
                const color = ROOM_COLORS[i % ROOM_COLORS.length];
                const clChildren = children.filter(ch => ch.classroom?._id === cl._id || ch.classroom === cl._id).slice(0, 4);
                return (
                  <div key={cl._id} className="p-4 rounded-xl border border-slate-100 dark:border-teal-900/30 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: `${color}22`, color }}>
                          <i className={`bx ${ROOM_ICONS[i % ROOM_ICONS.length]}`} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-white">{cl.name}</p>
                          <p className="text-xs text-slate-400">{cl.teacher?.fullName || 'No teacher'}</p>
                        </div>
                      </div>
                      <Donut value={enrolled} max={cl.capacity} color={color} />
                    </div>
                    <div className="w-full h-1 bg-slate-100 dark:bg-[#0d1520] rounded-full">
                      <div className="h-1 rounded-full transition-all" style={{ width: `${cl.capacity > 0 ? Math.min(enrolled/cl.capacity*100,100) : 0}%`, backgroundColor: color }} />
                    </div>
                    <div className="flex items-center gap-1">
                      {clChildren.map(c => <div key={c._id} className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[8px] font-bold">{c.firstName?.charAt(0) || '?'}</div>)}
                      {enrolled > 4 && <span className="text-xs text-slate-400">+{enrolled-4}</span>}
                    </div>
                    <p className="text-xs" style={{ color }}>{cl.capacity - enrolled} spots left</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
        <i className="bx bx-info-circle text-indigo-400 text-base flex-shrink-0" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Tip: Maintain healthy teacher-child ratios for better learning outcomes and personalized attention.</p>
        <button className="ml-auto text-xs text-indigo-400 whitespace-nowrap hover:underline">View Ratio Guide</button>
      </div>
    </div>
  );
};

export default AssignRole;

