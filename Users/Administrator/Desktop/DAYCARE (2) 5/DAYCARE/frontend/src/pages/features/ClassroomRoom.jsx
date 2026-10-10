import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ClassroomRoom = () => {
  const [children,   setChildren]   = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [childRes, roomRes] = await Promise.all([
          api.get('/children'),
          api.get('/classrooms')
        ]);
        setChildren(childRes.data.data   || []);
        setClassrooms(roomRes.data.data  || []);
      } catch {
        setError('Could not load classroom information.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl p-6 text-center">
      <i className="bx bx-error text-3xl" /><p className="mt-2">{error}</p>
    </div>
  );

  // For each child, find their classroom details
  const childRooms = children.map(child => {
    const room = classrooms.find(r => r._id === (child.classroom?._id || child.classroom));
    return { child, room: room || child.classroom };
  });

  const uniqueRooms = [...new Map(
    childRooms.filter(cr => cr.room).map(cr => [cr.room._id, cr.room])
  ).values()];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Classroom Information</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Your children's assigned rooms and details</p>
      </div>

      {childRooms.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-buildings text-5xl opacity-30" />
          <p className="mt-3 font-semibold">No children enrolled</p>
        </div>
      ) : (
        <>
          {/* Per-child room card */}
          {childRooms.map(({ child, room }, i) => (
            <div key={child._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
              {/* Room header banner */}
              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-slate-100 dark:border-teal-900/30 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                    <i className="bx bx-buildings text-xl text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">
                      {room?.name || 'Unassigned'}
                    </p>
                    <p className="text-xs text-slate-500">{room?.ageGroup || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full font-semibold">
                  <i className="bx bx-child" />
                  {child.firstName} {child.lastName}
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Stats */}
                {[
                  { icon: 'bx-group',    label: 'Enrolled',  value: room?.children?.length ?? 'N/A', color: 'indigo' },
                  { icon: 'bx-expand',   label: 'Capacity',  value: room?.capacity ?? 'N/A',          color: 'cyan'   },
                  { icon: 'bxs-graduation', label: 'Teacher', value: room?.teacher?.fullName || 'Not assigned', color: 'emerald', wide: true }
                ].map(s => (
                  <div key={s.label} className={`bg-slate-50 dark:bg-[#0d1520] rounded-xl p-4 ${s.wide ? 'md:col-span-1' : ''}`}>
                    <i className={`bx ${s.icon} text-xl text-${s.color}-400`} />
                    <p className="text-xs text-slate-400 uppercase font-semibold mt-2">{s.label}</p>
                    <p className="font-bold text-slate-800 dark:text-white mt-0.5 truncate">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Live Video Camera Feed for Rainbow Room */}
              {(room?.name || '').toLowerCase().includes('rainbow') && (
                <div className="px-6 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      Live Classroom Camera Feed
                    </span>
                    <span className="text-[11px] font-mono text-emerald-500 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Camera Active
                    </span>
                  </div>
                  <div className="relative rounded-2xl overflow-hidden aspect-video bg-black max-w-lg border border-slate-200 dark:border-teal-900/40 shadow-sm">
                    <video
                      src="/assets/images/rein%20bow%20room.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5 bg-red-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      LIVE
                    </div>
                    <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-md border border-white/10">
                      {room.name} – Camera 01
                    </div>
                  </div>
                </div>
              )}

              {/* Capacity bar */}
              {room?.capacity && (
                <div className="px-6 pb-5">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Room capacity</span>
                    <span>{room.children?.length || 0} / {room.capacity}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-[#0d1520] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ((room.children?.length || 0) / room.capacity) >= 0.9
                          ? 'bg-rose-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(((room.children?.length || 0) / room.capacity) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Room schedule / info */}
              {room?.schedule && (
                <div className="px-6 pb-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Schedule</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#0d1520] rounded-xl p-3">{room.schedule}</p>
                </div>
              )}

              {/* Classmates preview */}
              {room?.children?.length > 0 && (
                <div className="px-6 pb-6">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Classmates</p>
                  <div className="flex flex-wrap gap-2">
                    {room.children.slice(0, 12).map((c, j) => (
                      <div key={j} className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0d1520] px-2.5 py-1.5 rounded-lg">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold">
                          {(c.firstName || c).charAt(0)}
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-300">{c.firstName || c}</span>
                      </div>
                    ))}
                    {room.children.length > 12 && (
                      <div className="flex items-center px-2.5 py-1.5 bg-indigo-500/10 rounded-lg">
                        <span className="text-xs text-indigo-400 font-semibold">+{room.children.length - 12} more</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default ClassroomRoom;

