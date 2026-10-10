import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const VAX_COLOR = {
  'up-to-date': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'incomplete':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'unknown':     'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

const STATUS_COLOR = {
  active:   'bg-emerald-500/10 text-emerald-400',
  inactive: 'bg-slate-500/10 text-slate-400',
  waitlist: 'bg-amber-500/10 text-amber-400'
};

const AVATAR_COLORS = [
  'from-indigo-400 to-purple-500',
  'from-cyan-400 to-blue-500',
  'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500'
];

const ProfileCard = () => {
  const { user } = useAuth();
  const [children, setChildren]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/children');
        const list = res.data.data || [];
        setChildren(list);
        if (list.length > 0) setSelected(list[0]);
      } catch {
        setError('Could not load children profiles.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const calcAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const now   = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const adj   = months < 0 || (months === 0 && now.getDate() < birth.getDate()) ? 1 : 0;
    const age   = years - adj;
    const m     = ((months + 12) % 12);
    return age < 2 ? `${age * 12 + m} months` : `${age} years`;
  };

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

  if (children.length === 0) return (
    <div className="text-center py-20 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
      <i className="bx bx-child text-5xl opacity-30" />
      <p className="mt-3 font-semibold">No children linked to your account</p>
      <p className="text-sm mt-1 opacity-60">Contact reception to enroll a child.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Child Profiles</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{children.length} child{children.length !== 1 ? 'ren' : ''} enrolled</p>
      </div>

      {/* Child selector tabs */}
      {children.length > 1 && (
        <div className="flex gap-3 flex-wrap">
          {children.map((c, i) => (
            <button
              key={c._id}
              onClick={() => setSelected(c)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                selected?._id === c._id
                  ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : 'bg-white dark:bg-[#111c2d] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-teal-900/40 hover:border-indigo-400'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-[10px] font-bold`}>
                {c.firstName?.charAt(0) || '?'}
              </div>
              {c.firstName || 'Unknown'}
            </button>
          ))}
        </div>
      )}

      {selected && (() => {
        const idx = children.findIndex(c => c._id === selected._id);
        const gradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];
        const age = calcAge(selected.dateOfBirth);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — avatar + key info */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6 flex flex-col items-center text-center">
              <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-4xl font-bold shadow-xl mb-4`}>
                {selected.firstName?.charAt(0) || '?'}
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {selected.firstName} {selected.lastName}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">{age ? `${age} old` : ''} · {selected.gender}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${STATUS_COLOR[selected.status] || STATUS_COLOR.inactive}`}>
                  {selected.status}
                </span>
                <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${VAX_COLOR[selected.vaccinationStatus] || VAX_COLOR.unknown}`}>
                  <i className="bx bx-shield-quarter mr-1" />
                  {selected.vaccinationStatus?.replace('-', ' ')}
                </span>
              </div>

              <div className="w-full mt-6 space-y-3 text-left">
                {[
                  { icon: 'bx-cake',       label: 'Date of Birth', value: selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { icon: 'bx-buildings',  label: 'Classroom',     value: selected.classroom?.name || 'Unassigned' },
                  { icon: 'bx-group',      label: 'Age Group',     value: selected.classroom?.ageGroup || 'N/A' }
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0d1520] rounded-xl">
                    <i className={`bx ${item.icon} text-lg text-indigo-400`} />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — detailed info */}
            <div className="lg:col-span-2 space-y-4">
              {/* Medical Info */}
              <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                  <i className="bx bx-plus-medical text-rose-400" /> Medical Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-[#0d1520] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Allergies</p>
                    {selected.allergies ? (
                      <div className="flex items-center gap-2">
                        <i className="bx bx-error-circle text-rose-400" />
                        <p className="text-sm font-semibold text-rose-400">{selected.allergies}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">None reported</p>
                    )}
                  </div>
                  <div className="bg-slate-50 dark:bg-[#0d1520] rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Vaccination</p>
                    <p className={`text-sm font-semibold capitalize ${
                      selected.vaccinationStatus === 'up-to-date' ? 'text-emerald-400' :
                      selected.vaccinationStatus === 'incomplete' ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      {selected.vaccinationStatus?.replace('-', ' ') || 'Unknown'}
                    </p>
                  </div>
                  {selected.medicalNotes && (
                    <div className="md:col-span-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-xs font-semibold text-amber-400 uppercase mb-1">Medical Notes</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{selected.medicalNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              {selected.emergencyContact?.name && (
                <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
                  <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <i className="bx bx-phone-call text-amber-400" /> Emergency Contact
                  </h4>
                  <div className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <i className="bx bx-user text-2xl text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-white">{selected.emergencyContact.name}</p>
                      <p className="text-sm text-slate-500">{selected.emergencyContact.relationship}</p>
                      <a href={`tel:${selected.emergencyContact.phone}`}
                        className="text-sm text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 mt-1">
                        <i className="bx bx-phone" /> {selected.emergencyContact.phone}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Parents */}
              {selected.parents?.length > 0 && (
                <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
                  <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <i className="bx bx-group text-cyan-400" /> Parents / Guardians
                  </h4>
                  <div className="space-y-3">
                    {selected.parents.map(parent => (
                      <div key={parent._id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0d1520] rounded-xl">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold flex-shrink-0">
                          {parent.fullName?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{parent.fullName}</p>
                          <p className="text-xs text-slate-400 truncate">{parent.email}</p>
                        </div>
                        {parent.phone && (
                          <a href={`tel:${parent.phone}`} className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg flex-shrink-0">
                            <i className="bx bx-phone" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ProfileCard;

