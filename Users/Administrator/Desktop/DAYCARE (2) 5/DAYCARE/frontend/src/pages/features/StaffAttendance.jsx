import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const StaffAttendance = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [present, setPresent] = useState([]);
  const [absent, setAbsent] = useState([]);
  const [allStaff, setAllStaff] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Try to fetch reception-provided staff attendance first
        const attRes = await api.get('/staff/attendance').catch(() => null);
        if (attRes && attRes.data && attRes.data.data) {
          setPresent(attRes.data.data.present || []);
          setAbsent(attRes.data.data.absent || []);
        } else {
          // Fallback: fetch staff list and show as unknown (all in present list for visibility)
          const staffRes = await api.get('/staff?role=staff');
          setAllStaff(staffRes.data.data || staffRes.data || []);
        }
      } catch (err) {
        setError('Failed to load staff attendance.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Staff Attendance</h2>
        <p className="text-sm text-slate-500">Showing present and absent staff (reception feed)</p>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}

      {present.length === 0 && absent.length === 0 && allStaff.length === 0 && (
        <div className="text-slate-400">No staff attendance data available from reception.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 dark:text-white">Present ({present.length || allStaff.length})</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30 max-h-96 overflow-y-auto">
            {(present.length ? present : allStaff).map(s => (
              <div key={s._id || s.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">{(s.fullName||s.name||'').charAt(0)}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.fullName || s.name}</p>
                    <p className="text-xs text-slate-400">{s.role || 'staff'}</p>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-semibold">Present</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 dark:text-white">Absent ({absent.length})</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30 max-h-96 overflow-y-auto">
            {absent.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No absent staff reported by reception.</p>
            ) : (
              absent.map(s => (
                <div key={s._id || s.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">{(s.fullName||s.name||'').charAt(0)}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.fullName || s.name}</p>
                      <p className="text-xs text-slate-400">{s.role || 'staff'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-rose-400 font-semibold">Absent</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffAttendance;

