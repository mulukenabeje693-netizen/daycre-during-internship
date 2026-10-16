import React, { useMemo, useState } from 'react';

const initialStudents = [
  { id: 'S-101', fullName: 'Amara Lopez', classroom: 'Sunrise Room', photo: null, status: 'present', checkIn: '08:01 AM', checkOut: '03:30 PM' },
  { id: 'S-102', fullName: 'Ethan Carter', classroom: 'Sunrise Room', photo: null, status: 'late', checkIn: '08:18 AM', checkOut: '03:30 PM' },
  { id: 'S-103', fullName: 'Nia Hassan', classroom: 'Sunrise Room', photo: null, status: 'excused', checkIn: '-', checkOut: '-' },
  { id: 'S-104', fullName: 'Leo Nguyen', classroom: 'Sunrise Room', photo: null, status: 'absent', checkIn: '-', checkOut: '-' },
  { id: 'S-105', fullName: 'Mia Brooks', classroom: 'Sunrise Room', photo: null, status: 'present', checkIn: '07:55 AM', checkOut: '03:20 PM' },
  { id: 'S-106', fullName: 'Zara Patel', classroom: 'Sunrise Room', photo: null, status: 'present', checkIn: '07:59 AM', checkOut: '03:25 PM' },
];

const statusMeta = {
  present: { label: 'Present', accent: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-300' },
  late: { label: 'Late', accent: 'bg-amber-500/10 text-amber-300 border-amber-500/20', dot: 'bg-amber-300' },
  absent: { label: 'Absent', accent: 'bg-rose-500/10 text-rose-300 border-rose-500/20', dot: 'bg-rose-300' },
  excused: { label: 'Excused', accent: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', dot: 'bg-cyan-300' },
};

const StudentAttendance = () => {
  const [students, setStudents] = useState(initialStudents);
  const [classroom, setClassroom] = useState('Sunrise Room');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  const classrooms = useMemo(() => Array.from(new Set(students.map((student) => student.classroom))), [students]);

  const filteredStudents = useMemo(() => students.filter((student) => {
    const matchesClassroom = classroom === 'All Classrooms' || student.classroom === classroom;
    const matchesSearch = !search || student.fullName.toLowerCase().includes(search.toLowerCase()) || student.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All Statuses' || statusMeta[student.status].label === statusFilter;
    return matchesClassroom && matchesSearch && matchesStatus;
  }), [students, classroom, search, statusFilter]);

  const totals = useMemo(() => ({
    total: students.length,
    present: students.filter((student) => student.status === 'present').length,
    late: students.filter((student) => student.status === 'late').length,
    absent: students.filter((student) => student.status === 'absent').length,
    excused: students.filter((student) => student.status === 'excused').length,
  }), [students]);

  const attendanceRate = totals.total ? Math.round((totals.present / totals.total) * 100) : 0;

  const updateStatus = (studentId, status) => {
    setStudents((prev) => prev.map((entry) => {
      if (entry.id !== studentId) return entry;
      return {
        ...entry,
        status,
        checkIn: status === 'absent' || status === 'excused' ? '-' : (entry.checkIn === '-' ? '08:00 AM' : entry.checkIn),
        checkOut: status === 'absent' || status === 'excused' ? '-' : (entry.checkOut === '-' ? '03:20 PM' : entry.checkOut),
      };
    }));
  };

  const markAllPresent = () => {
    setStudents((prev) => prev.map((entry) => ({
      ...entry,
      status: 'present',
      checkIn: entry.checkIn === '-' ? '08:00 AM' : entry.checkIn,
      checkOut: entry.checkOut === '-' ? '03:20 PM' : entry.checkOut,
    })));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Teacher Dashboard</p>
            <h1 className="text-3xl font-semibold text-slate-100">Student Attendance</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/80 mt-2">Manage today’s classroom attendance, mark statuses with one tap, and keep the roster view clean and focused.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={markAllPresent}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 shadow-glow-success"
            >
              <i className="bx bx-check-square text-base" />
              Mark All Present
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-slate-950/90 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-slate-900"
            >
              <i className="bx bx-refresh text-base" />
              Refresh View
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          {[
            { label: 'Total Students', value: totals.total, accent: 'from-slate-900 to-slate-800', icon: 'bx-group' },
            { label: 'Present', value: totals.present, accent: 'from-emerald-900 to-emerald-700', icon: 'bx-user-check' },
            { label: 'Late', value: totals.late, accent: 'from-amber-900 to-amber-700', icon: 'bx-time' },
            { label: 'Absent', value: totals.absent, accent: 'from-rose-900 to-rose-700', icon: 'bx-user-x' },
            { label: 'Excused', value: totals.excused, accent: 'from-cyan-950 to-cyan-700', icon: 'bx-briefcase' },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-800/70 bg-slate-950/90 p-5 shadow-glow-primary">
              <div className={`mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r ${card.accent}`} />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-white">{card.value}</p>
                  <p className="text-sm text-white/70 mt-1">{card.label}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-cyan-200">
                  <i className={`bx ${card.icon} text-xl`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/90 p-5 shadow-glow-primary">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/70">Attendance overview</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Daily snapshot</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl bg-slate-900/90 px-4 py-3 text-sm text-white/70 ring-1 ring-slate-800/80">Rate <span className="font-semibold text-white">{attendanceRate}%</span></div>
              <div className="rounded-2xl bg-slate-900/90 px-4 py-3 text-sm text-white/70 ring-1 ring-slate-800/80">Classroom <span className="font-semibold text-white">{classroom}</span></div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-900/90 p-5 border border-slate-800/80">
              <p className="text-sm text-white/70">Attendance percentage</p>
              <p className="mt-3 text-3xl font-semibold text-white">{attendanceRate}%</p>
              <div className="mt-4 h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${attendanceRate}%` }} />
              </div>
            </div>
            <div className="rounded-3xl bg-slate-900/90 p-5 border border-slate-800/80">
              <p className="text-sm text-white/70">Daily attendance</p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                <li className="flex items-center justify-between">
                  <span>Present</span>
                  <span className="font-semibold text-emerald-300">{totals.present}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Late</span>
                  <span className="font-semibold text-amber-300">{totals.late}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Absent</span>
                  <span className="font-semibold text-rose-300">{totals.absent}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Excused</span>
                  <span className="font-semibold text-cyan-300">{totals.excused}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/90 p-5 shadow-glow-primary">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-white/70">
              <span className="text-white/70">Classroom</span>
              <select
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                className="w-full rounded-2xl border border-slate-800/90 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              >
                <option>All Classrooms</option>
                {classrooms.map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-white/70">
              <span className="text-white/70">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-800/90 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
          </div>
          <div className="mt-4 space-y-4">
            <label className="space-y-2 text-sm text-white/70">
              <span className="text-white/70">Search students</span>
              <input
                type="search"
                placeholder="Search by name or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-800/90 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-2 text-sm text-white/70">
              <span className="text-white/70">Attendance status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-800/90 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              >
                <option>All Statuses</option>
                <option>Present</option>
                <option>Late</option>
                <option>Absent</option>
                <option>Excused</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-800/70 bg-slate-950/90 shadow-glow-primary">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-slate-900/95 text-white/70">
            <tr>
              <th className="px-5 py-4 text-left font-semibold uppercase tracking-[0.16em]">Student</th>
              <th className="px-5 py-4 text-left font-semibold uppercase tracking-[0.16em]">Student ID</th>
              <th className="px-5 py-4 text-left font-semibold uppercase tracking-[0.16em]">Check-in</th>
              <th className="px-5 py-4 text-left font-semibold uppercase tracking-[0.16em]">Check-out</th>
              <th className="px-5 py-4 text-left font-semibold uppercase tracking-[0.16em]">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.id} className="border-t border-slate-800/80 hover:bg-slate-900/80 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/20">
                      <span className="text-base font-semibold">{student.fullName.split(' ').map((word) => word[0]).join('').slice(0,2)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100">{student.fullName}</p>
                      <p className="text-xs text-white/60">{student.classroom}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-200">{student.id}</td>
                <td className="px-5 py-4 text-slate-100">{student.checkIn}</td>
                <td className="px-5 py-4 text-slate-100">{student.checkOut}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta[student.status].accent}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[student.status].dot}`} />
                    {statusMeta[student.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentAttendance;
