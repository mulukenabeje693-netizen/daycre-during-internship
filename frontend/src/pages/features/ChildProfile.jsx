import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';

/* ─── helpers ─────────────────────────────────────────── */
const ageLabel = (dob) => {
  if (!dob) return 'Unknown age';
  const birth = new Date(dob);
  const now   = new Date();
  let years   = now.getFullYear() - birth.getFullYear();
  let months  = now.getMonth()    - birth.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
    years -= 1; months += 12;
  }
  return years < 2 ? `${years * 12 + months} months` : `${years} yrs`;
};

const initials = (first = '', last = '') =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

const GRADIENTS = [
  'from-[#00ADB5] to-indigo-500',
  'from-rose-400 to-amber-400',
  'from-purple-400 to-pink-400',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-400',
];
const avatarGradient = (name = '') => {
  const code = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
};

const LS_LAST  = 'lastSelectedChildId';
const LS_SECTS = 'childProfileOpenSections';
const DEFAULT_SECTIONS = {
  overview: true, classroom: true, teacher: true, vaccination: true,
};

const Skeleton = () => (
  <div className="space-y-4 p-6 animate-pulse">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-700" />
    ))}
  </div>
);

/* ─── Avatar ──────────────────────────────────────────── */
const Avatar = ({ first, last, size = 'md', photoUrl }) => {
  const [imgError, setImgError] = useState(false);
  const sz = { sm: 'w-8 h-8 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-20 h-20 text-2xl' };
  
  if (photoUrl && !imgError) {
    return (
      <div className={`${sz[size]} rounded-full overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800`}>
        <img src={photoUrl} alt={`${first} ${last}`} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      </div>
    );
  }
  
  return (
    <div className={`${sz[size]} rounded-full bg-gradient-to-br ${avatarGradient((first||'')+(last||''))} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials(first, last)}
    </div>
  );
};

/* ─── Badge ───────────────────────────────────────────── */
const Badge = ({ label, variant = 'gray' }) => {
  const map = {
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    gray:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    rose:   'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    slate:  'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    teal:   'bg-[#00ADB5]/10 text-[#00ADB5]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[variant] || map.gray}`}>
      {label}
    </span>
  );
};

/* ─── InfoRow ─────────────────────────────────────────── */
const InfoRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    <span className="text-sm font-semibold text-slate-800 dark:text-white">{value || 'N/A'}</span>
  </div>
);

/* ─── Section card ────────────────────────────────────── */
const Section = ({ id, icon, title, color, bgColor, isOpen, onToggle, children }) => (
  <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-teal-900/30 overflow-hidden">
    <button
      onClick={() => onToggle(id)}
      className={`w-full flex items-center justify-between px-5 py-4 ${bgColor} transition-colors`}
    >
      <div className="flex items-center gap-3">
        <i className={`bx ${icon} text-xl ${color}`} />
        <span className={`font-bold text-sm ${color}`}>{title}</span>
      </div>
      <i className={`bx ${isOpen ? 'bx-chevron-up' : 'bx-chevron-down'} text-xl ${color}`} />
    </button>
    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  </div>
);

/* ─── Child sidebar card ──────────────────────────────── */
const ChildCard = ({ child, isSelected, onClick, t }) => {
  const active = (child.status || 'active').toLowerCase() === 'active';
  return (
    <button
      onClick={() => onClick(child)}
      className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-[#00ADB5]/10
        ${isSelected ? 'border-l-4 border-[#00ADB5] bg-[#00ADB5]/10 pl-2' : 'border-l-4 border-transparent'}`}
    >
      <Avatar first={child.firstName} last={child.lastName} size="md" photoUrl={child.photoUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{child.firstName} {child.lastName}</p>
        <p className="text-xs text-slate-400 mt-0.5">{ageLabel(child.dateOfBirth)}</p>
        <p className="text-xs text-[#00ADB5] truncate">{child.classroom?.name || t('unassigned')}</p>
      </div>
      <span className={`flex-shrink-0 w-2 h-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-400'}`} />
    </button>
  );
};

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
const ChildProfile = () => {
  const { t } = useLanguage();
  const [children,     setChildren]     = useState([]);
  const [classrooms,   setClassrooms]   = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [sections, setSections] = useState(() => {
    try {
      const s = localStorage.getItem(LS_SECTS);
      return s ? { ...DEFAULT_SECTIONS, ...JSON.parse(s) } : DEFAULT_SECTIONS;
    } catch { return DEFAULT_SECTIONS; }
  });

  const toggleSection = useCallback((id) => {
    setSections(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(LS_SECTS, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleAvatarUpload = async (e, childId) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setUploadingAvatar(true);
      const res = await api.put(`/children/${childId}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updatedChild = res.data.data || res.data;
      
      setChildren(prev => prev.map(c => c._id === childId ? { ...c, photoUrl: updatedChild.photoUrl } : c));
      if (selected?._id === childId) {
        setSelected(prev => ({ ...prev, photoUrl: updatedChild.photoUrl }));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  /* fetch */
  useEffect(() => {
    const load = async () => {
      try {
        const [cR, clR] = await Promise.all([api.get('/children'), api.get('/classrooms')]);
        const childList = cR.data.data  || cR.data  || [];
        const classList = clR.data.data || clR.data || [];
        setChildren(childList);
        setClassrooms(classList);
        const lastId  = localStorage.getItem(LS_LAST);
        const initial = (lastId && childList.find(c => c._id === lastId)) || childList[0] || null;
        setSelected(initial);
      } catch (err) {
        console.error(err);
        setError('Unable to load child profile information.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSelect = useCallback((child) => {
    setSelected(child);
    try { localStorage.setItem(LS_LAST, child._id); } catch {}
    setSidebarOpen(false);
  }, []);

  /* derived */
  const filtered = children.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );
  const selectedClassroom = selected
    ? classrooms.find(r => r._id === (selected.classroom?._id || selected.classroom))
    : null;
  const teacher      = selectedClassroom?.teacher ?? null;
  const vaccStatus   = selected?.vaccinationStatus || 'unknown';
  const vaccBadge    = vaccStatus === 'up-to-date' ? 'green' : vaccStatus === 'incomplete' ? 'yellow' : 'gray';
  const isActive     = (selected?.status || 'active').toLowerCase() === 'active';

  if (loading) return <Skeleton />;

  if (error) return (
    <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700 rounded-2xl p-8 text-center text-rose-600 dark:text-rose-400">
      <i className="bx bx-error text-4xl" /><p className="mt-3 font-medium">{error}</p>
    </div>
  );

  return (
    <div className="relative flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-50 dark:bg-[#0d1520]">

      {/* Mobile: dropdown selector */}
      <div className="md:hidden px-4 pt-4 pb-3 bg-white dark:bg-[#111c2d] border-b border-slate-200 dark:border-teal-900/30 flex-shrink-0">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t('cpSelectChild')}</label>
        <select
          className="w-full rounded-xl border border-slate-200 dark:border-teal-900/40 bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00ADB5]"
          value={selected?._id || ''}
          onChange={e => { const c = children.find(x => x._id === e.target.value); if (c) handleSelect(c); }}
        >
          {children.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
        </select>
      </div>

      {/* Tablet: toggle button */}
      <div className="hidden md:flex lg:hidden px-4 pt-3 pb-2 flex-shrink-0 bg-white dark:bg-[#111c2d] border-b border-slate-200 dark:border-teal-900/30">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#00ADB5] text-[#00ADB5] text-sm font-semibold hover:bg-[#00ADB5]/10 transition"
        >
          <i className="bx bx-list-ul text-lg" />
          {sidebarOpen ? t('cpHideChildren') : t('cpAllChildren')}
        </button>
      </div>

      {/* LEFT SIDEBAR */}
      <aside className={`
        hidden md:flex flex-col flex-shrink-0
        bg-white dark:bg-[#111c2d]
        border-r border-slate-200 dark:border-teal-900/30
        transition-all duration-300 overflow-hidden
        lg:w-[280px] lg:static lg:translate-x-0 lg:flex
        ${sidebarOpen ? 'absolute inset-y-0 left-0 z-30 w-72 flex shadow-2xl' : 'lg:flex hidden'}
      `} style={{ height: '100%' }}>
        {/* sidebar header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0 border-b border-slate-100 dark:border-teal-900/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('cpMyChildren')}</h2>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <i className="bx bx-x text-xl" />
            </button>
          </div>
          <div className="relative">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
            <input
              type="text" placeholder={t('cpSearchChildren')}
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-[#0d1520] border border-transparent focus:border-[#00ADB5] focus:outline-none text-sm text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>
        {/* child list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {filtered.length === 0
            ? <div className="text-center py-10 text-slate-400 text-sm"><i className="bx bx-search-alt text-3xl block mb-2" />{t('cpNoChildrenFound')}</div>
            : filtered.map(child => <ChildCard key={child._id} child={child} isSelected={selected?._id === child._id} onClick={handleSelect} t={t} />)
          }
        </div>
      </aside>

      {/* sidebar backdrop */}
      {sidebarOpen && <div className="lg:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setSidebarOpen(false)} />}

      {/* RIGHT DETAILS PANEL */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <i className="bx bx-child text-6xl block mb-3 opacity-40" />
              <p className="font-medium">{t('cpNoChildSelected')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Sticky header */}
            <div className="flex-shrink-0 bg-white dark:bg-[#111c2d] border-b border-slate-200 dark:border-teal-900/30 px-6 py-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative group inline-block">
                    <Avatar first={selected.firstName} last={selected.lastName} size="lg" photoUrl={selected.photoUrl} />
                    <label className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full transition-opacity cursor-pointer ${uploadingAvatar ? 'opacity-100 cursor-wait' : 'opacity-0 group-hover:opacity-100'}`}>
                      {uploadingAvatar ? (
                        <i className="bx bx-loader-alt animate-spin text-xl" />
                      ) : (
                        <i className="bx bx-camera text-xl" />
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAvatarUpload(e, selected._id)} disabled={uploadingAvatar} />
                    </label>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                      {selected.firstName} {selected.lastName}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge label={ageLabel(selected.dateOfBirth)} variant="slate" />
                      <Badge label={isActive ? t('cpActive') : t('cpInactive')} variant={isActive ? 'green' : 'gray'} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable sections */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* 1. Overview */}
              <Section id="overview" icon="bx-detail" title={t('cpOverview')} color="text-[#00ADB5]" bgColor="bg-[#00ADB5]/10" isOpen={sections.overview} onToggle={toggleSection}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <InfoRow label={t('cpDateOfBirth')} value={selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : null} />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('cpAllergies')}</p>
                    {selected.allergies ? <Badge label={selected.allergies} variant="rose" /> : <span className="text-sm font-semibold text-slate-700 dark:text-white">{t('cpAllergyNone')}</span>}
                  </div>
                  <InfoRow label={t('cpMedicalNotes')} value={selected.medicalNotes || t('cpAllergyNone')} />
                  <InfoRow label={t('cpEnrollmentDate')} value={selected.enrollmentDate ? new Date(selected.enrollmentDate).toLocaleDateString() : null} />
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#0d1520] border border-slate-100 dark:border-teal-900/20 p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('cpEmergencyContact')}</p>
                  <div className="flex flex-wrap gap-6">
                    <InfoRow label={t('cpName')}         value={selected.emergencyContact?.name} />
                    <InfoRow label={t('cpPhone')}        value={selected.emergencyContact?.phone} />
                    <InfoRow label={t('cpRelationship')} value={selected.emergencyContact?.relationship} />
                  </div>
                </div>
              </Section>

              {/* 2. Classroom */}
              <Section id="classroom" icon="bx-door-open" title={t('cpClassroom')} color="text-indigo-500" bgColor="bg-indigo-50 dark:bg-indigo-900/20" isOpen={sections.classroom} onToggle={toggleSection}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <InfoRow label={t('cpClassName')} value={selectedClassroom?.name    || t('unassigned')} />
                  <InfoRow label={t('cpAgeGroup')}  value={selectedClassroom?.ageGroup || 'N/A'} />
                  <InfoRow label={t('cpCapacity')}  value={selectedClassroom?.capacity ?? 'N/A'} />
                  <InfoRow label={t('cpSchedule')}  value={selectedClassroom?.schedule  || t('cpScheduleDefault')} />
                </div>
                {selectedClassroom?.children?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('cpClassmates')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {selectedClassroom.children.slice(0, 8).map((child, idx) => (
                        <div key={child._id || idx} className="flex items-center gap-2 bg-slate-50 dark:bg-[#0d1520] rounded-xl px-3 py-2">
                          <Avatar first={child.firstName || String(child)} last={child.lastName || ''} size="sm" photoUrl={child.photoUrl} />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{child.firstName || String(child)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* 3. Teacher */}
              <Section id="teacher" icon="bx-user" title={t('cpTeacher')} color="text-amber-500" bgColor="bg-amber-50 dark:bg-amber-900/20" isOpen={sections.teacher} onToggle={toggleSection}>
                {teacher ? (
                  <div className="flex items-start gap-5">
                    <Avatar first={teacher.fullName?.split(' ')[0] || ''} last={teacher.fullName?.split(' ')[1] || ''} size="lg" photoUrl={teacher.photoUrl} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                      <InfoRow label={t('cpTeacherName')} value={teacher.fullName} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('cpEmail')}</p>
                        {teacher.email ? <a href={`mailto:${teacher.email}`} className="text-sm font-semibold text-[#00ADB5] hover:underline">{teacher.email}</a> : <span className="text-sm font-semibold text-slate-700 dark:text-white">—</span>}
                      </div>
                      <InfoRow label={t('cpPhone')} value={teacher.phone} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">{t('cpNoTeacher')}</p>
                )}
              </Section>

              {/* 4. Vaccination */}
              <Section id="vaccination" icon="bx-shield-plus" title={t('cpVaccination')} color="text-rose-500" bgColor="bg-rose-50 dark:bg-rose-900/20" isOpen={sections.vaccination} onToggle={toggleSection}>
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('cpVaccStatus')}</p>
                  <Badge label={vaccStatus.replace('-', ' ')} variant={vaccBadge} />
                </div>
                {(selected.vaccinationLog || []).length === 0 ? (
                  <p className="text-sm text-slate-400 italic">{t('cpNoVaccRecords')}</p>
                ) : (
                  <div className="space-y-2">
                    {(selected.vaccinationLog || []).map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-[#0d1520] rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-white">{entry.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{t('cpDose')} {entry.dose}{entry.dateGiven ? ` · ${new Date(entry.dateGiven).toLocaleDateString()}` : ''}</p>
                        </div>
                        {entry.provider && <span className="text-xs text-slate-500 flex-shrink-0">{entry.provider}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

            </div>{/* end scrollable sections */}
          </>
        )}
      </main>

      {/* Toast */}
    </div>
  );
};

export default ChildProfile;
