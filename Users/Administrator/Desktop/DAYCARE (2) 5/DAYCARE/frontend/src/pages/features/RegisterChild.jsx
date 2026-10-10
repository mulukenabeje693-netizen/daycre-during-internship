import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import EmailVerificationInput from '../../components/shared/EmailVerificationInput';
import PasswordStrengthChecker, { validatePassword } from '../../components/shared/PasswordStrengthChecker';
import { validatePhonePair } from '../../utils/phoneValidation';
import { usePhoneAvailability } from '../../hooks/usePhoneAvailability';

/* ── age validator ─────────────────────────────────────── */
const getChildAge = (dob) => {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime()) || d > new Date()) return null;
  let y = new Date().getFullYear() - d.getFullYear();
  const m = new Date().getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) y--;
  return y;
};

const INP =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 dark:border-slate-700 dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-[#00B4D8]';
const LBL = 'block text-sm font-medium text-slate-600 dark:text-teal-400';
const SEL =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 dark:border-slate-700 dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-[#00B4D8] appearance-none';

const emptyChild = () => ({
  id: Date.now() + Math.random(),
  childFirstName: '', childLastName: '', dateOfBirth: '', gender: 'male',
  allergies: '', medicalNotes: '',
});

const EMPTY_PARENT = {
  parentFullName: '', parentEmail: '', parentPhone: '',
  parentOrganization: '', parentPassword: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
};

/* ─── Single child card (Step 1) ──────────────────────── */
const ChildCard = ({ child, index, total, onChange, onRemove, t, locale, error }) => {
  const set = (key) => (e) => onChange(child.id, key, e.target.value);
  const L = locale || 'en';
  const lx = (en, am, om, ti) => L === 'am' ? am : L === 'om' ? om : L === 'ti' ? ti : en;
  return (
    <div className="bg-slate-50 dark:bg-[#0d1929]/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#00ADB5] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t('childDetails')} {total > 1 ? `#${index + 1}` : ''}
          </h4>
        </div>
        {total > 1 && (
          <button type="button" onClick={() => onRemove(child.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
            <i className="bx bx-x text-lg" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          <i className="bx bx-error-circle text-base flex-shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LBL}>{t('firstName')}</label>
          <input value={child.childFirstName} onChange={set('childFirstName')} className={INP} placeholder={lx('First name', 'ስም', 'Maqaa', 'ሽም')} />
        </div>
        <div>
          <label className={LBL}>{t('lastName')}</label>
          <input value={child.childLastName} onChange={set('childLastName')} className={INP} placeholder={lx('Last name', 'የአባት ስም', 'Maqaa Abbaa', 'ሽም ኣቦ')} />
        </div>
        <div>
          <label className={LBL}>{t('dateOfBirth')}</label>
          <input type="date" value={child.dateOfBirth} onChange={set('dateOfBirth')}
            className={`${INP} [color-scheme:light] dark:[color-scheme:dark]`} />
        </div>
        <div>
          <label className={LBL}>{t('genderLabel')}</label>
          <div className="relative">
            <select value={child.gender} onChange={set('gender')} className={SEL}>
              <option value="male">{t('male')}</option>
              <option value="female">{t('female')}</option>
              <option value="other">{t('other')}</option>
            </select>
            <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={LBL}>{t('allergiesLabel')}</label>
          <input value={child.allergies} onChange={set('allergies')} className={INP} placeholder={lx('Peanuts, dairy, etc.', 'ለምሳሌ: ለውዝ፣ ወተት', 'Fkn. Lootii, Aannan', 'ንኣብ: ሕብሲ፣ ጸባ')} />
        </div>
        <div>
          <label className={LBL}>{t('medicalNotesLabel')}</label>
          <input value={child.medicalNotes} onChange={set('medicalNotes')} className={INP} placeholder={lx('Asthma, special care, etc.', 'ለምሳሌ: አስም፣ ልዩ ክብካቤ', 'Fkn. Asimaa, kunuunsa addaa', 'ንኣብ: ኣዝማ፣ ፍሉይ ሓልዮት')} />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════ */
const RegisterChild = () => {
  const { t, locale } = useLanguage();
  const L = locale || 'en';
  const lx = (en, am, om, ti) => L === 'am' ? am : L === 'om' ? om : L === 'ti' ? ti : en;
  const [step, setStep]         = useState(1);
  const [showPwd, setShowPwd]   = useState(false);
  const [children, setChildren] = useState([emptyChild()]);
  const [cardErrors, setCardErrors] = useState({});
  const [parent, setParent]     = useState(EMPTY_PARENT);
  const [phoneErrors, setPhoneErrors] = useState({ parentPhone: '', emergencyContactPhone: '' });
  const [loading, setLoading]   = useState(false);

  /* ── Existing parents dropdown ──────────────────────── */
  const [registeredParents, setRegisteredParents] = useState([]);
  const [selectedParentId, setSelectedParentId]   = useState('');   // '' = new parent
  const [parentsLoading, setParentsLoading]        = useState(false);

  useEffect(() => {
    const fetchParents = async () => {
      setParentsLoading(true);
      try {
        const res = await api.get('/staff/parents');
        setRegisteredParents(res.data.data || []);
      } catch (_) {
        // silently fail — dropdown just won't have existing parents
      } finally {
        setParentsLoading(false);
      }
    };
    fetchParents();
  }, []);

  // System-wide uniqueness checks (debounced)
  const { checking: checkingPhone, takenError: phoneTaken } = usePhoneAvailability(parent.parentPhone,            phoneErrors.parentPhone);
  const { checking: checkingEmerg, takenError: emergTaken } = usePhoneAvailability(parent.emergencyContactPhone,  phoneErrors.emergencyContactPhone);

  const displayParentPhoneError = phoneErrors.parentPhone           || phoneTaken;
  const displayEmergPhoneError  = phoneErrors.emergencyContactPhone || emergTaken;
  const hasPhoneError = !!(displayParentPhoneError || displayEmergPhoneError || checkingPhone || checkingEmerg);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  /* ── ID card upload state ─────────────────────────────── */
  const idFrontRef = useRef(null);
  const idBackRef  = useRef(null);
  const [idFrontFile,    setIdFrontFile]    = useState(null);
  const [idBackFile,     setIdBackFile]     = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState('');
  const [idBackPreview,  setIdBackPreview]  = useState('');

  const handleIdFileChange = (side, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('ID card images must be valid image files (JPG, PNG, etc.).');
      return;
    }
    const url = URL.createObjectURL(file);
    if (side === 'front') {
      if (idFrontPreview) URL.revokeObjectURL(idFrontPreview);
      setIdFrontFile(file);
      setIdFrontPreview(url);
    } else {
      if (idBackPreview) URL.revokeObjectURL(idBackPreview);
      setIdBackFile(file);
      setIdBackPreview(url);
    }
    // Clear ID-related error when user uploads a file
    setError(prev => prev.includes('ID') ? '' : prev);
  };

  const setP = (key) => (e) => {
    const val = e.target.value;
    setParent(p => ({ ...p, [key]: val }));
    // Real-time phone pair validation
    if (key === 'parentPhone' || key === 'emergencyContactPhone') {
      const primary   = key === 'parentPhone'           ? val : parent.parentPhone;
      const emergency = key === 'emergencyContactPhone' ? val : parent.emergencyContactPhone;
      const { primaryError, emergencyError } = validatePhonePair(primary, emergency);
      setPhoneErrors({ parentPhone: primaryError, emergencyContactPhone: emergencyError });
    }
  };

  /* ── child field change ─────────────────────────────── */
  const handleChildChange = (id, key, value) => {
    setChildren(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));
    setCardErrors(prev => ({ ...prev, [id]: '' }));
    setError('');
  };

  const addChild = () => setChildren(prev => [...prev, emptyChild()]);
  const removeChild = (id) => {
    setChildren(prev => prev.filter(c => c.id !== id));
    setCardErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  /* ── Step 1 validation ──────────────────────────────── */
  const validateChildren = () => {
    const errors = {};
    let valid = true;
    children.forEach(c => {
      if (!c.childFirstName.trim() || !c.childLastName.trim() || !c.dateOfBirth || !c.gender) {
        errors[c.id] = lx('Please complete first name, last name, date of birth, and gender.', 'ስም፣ የአባት ስም፣ የልደት ቀን እና ጾታ ያስገቡ።', 'Maqaa, maqaa abbaa, guyyaa dhalootaa fi saala galchi.', 'ሽም፣ ሽም ኣቦ፣ ዕለት ልደትን ጾታን ኣቲ።');
        valid = false;
      } else {
        const age = getChildAge(c.dateOfBirth);
        if (age === null) { errors[c.id] = 'Please enter a valid date of birth.'; valid = false; }
        else if (age > 18) { errors[c.id] = 'Child must be 18 years or younger.'; valid = false; }
      }
    });
    setCardErrors(errors);
    return valid;
  };

  /* ── Submit with existing parent (skip Step 2) ──────── */
  const handleExistingParentSubmit = async () => {
    setError(''); setSuccess('');
    if (!validateChildren()) return;

    const existingParent = registeredParents.find(p => (p._id || p.id) === selectedParentId);
    if (!existingParent) { setError('Selected parent not found.'); return; }

    setLoading(true);
    try {
      for (const c of children) {
        await api.post('/children', {
          firstName:    c.childFirstName.trim(),
          lastName:     c.childLastName.trim(),
          dateOfBirth:  c.dateOfBirth,
          gender:       c.gender,
          parentName:   existingParent.fullName,
          parents:      [existingParent._id || existingParent.id],
          allergies:    c.allergies.trim(),
          medicalNotes: c.medicalNotes.trim(),
          emergencyContact: existingParent.emergencyContact || {},
        });
      }
      const childNames = children.map(c => c.childFirstName).join(', ');
      setSuccess(
        children.length === 1
          ? `${children[0].childFirstName} registered under parent ${existingParent.fullName} successfully.`
          : `${childNames} registered under parent ${existingParent.fullName} successfully.`
      );
      setChildren([emptyChild()]);
      setSelectedParentId('');
      setCardErrors({});
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setError('');
    if (!validateChildren()) return;
    // If existing parent chosen — do not proceed to Step 2
    if (selectedParentId) {
      handleExistingParentSubmit();
      return;
    }
    setStep(2);
  };

  /* ── Submit ─────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!parent.parentFullName.trim() || !parent.parentEmail.trim() || !parent.parentPassword) {
      setError('Parent name, email and password are required.'); return;
    }
    if (!isEmailVerified) {
      setError('Please verify the parent email address before submitting.'); return;
    }

    // ID card validation — both sides required
    if (!idFrontFile || !idBackFile) {
      setError('ID verification is required. Please upload both sides of your ID card to complete registration.');
      return;
    }

    // Block if a uniqueness check is still in flight or failed
    if (hasPhoneError) {
      setError('Please fix the phone number errors before submitting.');
      return;
    }

    // Password validation — strict 5-rule check
    const pwdErr = validatePassword(parent.parentPassword);
    if (pwdErr) { setError(pwdErr); return; }

    // Phone pair validation (format + duplicate check)
    const { primaryError, emergencyError } = validatePhonePair(parent.parentPhone, parent.emergencyContactPhone);
    if (primaryError || emergencyError) {
      setPhoneErrors({ parentPhone: primaryError, emergencyContactPhone: emergencyError });
      setError('Please fix the phone number errors before submitting.');
      return;
    }

    setLoading(true);
    try {
      // 1. Register parent account using FormData (needed for file upload)
      const formData = new FormData();
      formData.append('fullName',     parent.parentFullName.trim());
      formData.append('email',        parent.parentEmail.trim().toLowerCase());
      formData.append('phone',        parent.parentPhone.trim());
      formData.append('organization', parent.parentOrganization.trim());
      formData.append('password',     parent.parentPassword);
      formData.append('role',         'parent');
      formData.append('emergencyContact', JSON.stringify({
        name:         parent.emergencyContactName.trim(),
        phone:        parent.emergencyContactPhone.trim(),
        relationship: parent.emergencyContactRelationship.trim(),
      }));
      formData.append('idFront', idFrontFile, idFrontFile.name || 'id-front.jpg');
      formData.append('idBack',  idBackFile,  idBackFile.name  || 'id-back.jpg');

      const parentRes = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const parentId = parentRes.data.user.id || parentRes.data.user._id;

      // 2. Register all children under same parent
      for (const c of children) {
        await api.post('/children', {
          firstName:    c.childFirstName.trim(),
          lastName:     c.childLastName.trim(),
          dateOfBirth:  c.dateOfBirth,
          gender:       c.gender,
          parentName:   parent.parentFullName.trim(),
          parents:      [parentId],
          allergies:    c.allergies.trim(),
          medicalNotes: c.medicalNotes.trim(),
          emergencyContact: {
            name:         parent.emergencyContactName.trim(),
            phone:        parent.emergencyContactPhone.trim(),
            relationship: parent.emergencyContactRelationship.trim(),
          },
        });
      }

      const childNames = children.map(c => c.childFirstName).join(', ');
      setSuccess(
        children.length === 1
          ? `${children[0].childFirstName} and parent ${parent.parentFullName} registered successfully.`
          : `${childNames} and parent ${parent.parentFullName} registered successfully.`
      );

      // Reset all state
      setChildren([emptyChild()]);
      setParent(EMPTY_PARENT);
      setCardErrors({});
      setIsEmailVerified(false);
      setPhoneErrors({ parentPhone: '', emergencyContactPhone: '' });
      setIdFrontFile(null); setIdBackFile(null);
      setIdFrontPreview(''); setIdBackPreview('');
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#060d14] py-2">
      <div className="w-full">
        <div className="bg-white dark:bg-[#0d1929] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t('registerParentTitle')}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                {t('registerParentSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
              {children.length > 1 && (
                <div className="flex items-center gap-2 bg-[#00ADB5]/10 text-[#00ADB5] text-sm font-semibold px-3 py-1.5 rounded-full border border-[#00ADB5]/20">
                  <i className="bx bx-group text-base" />
                  {children.length} {t('childrenLabel')}
                </div>
              )}
              <Link
                to="/dashboard/reception/update-info#parent"
                className="self-start inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent px-4 py-2 text-sm font-semibold text-[#00ADB5] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
              >
                <i className="bx bx-user text-base" />
                {t('viewRegisteredParents')}
              </Link>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 py-7 bg-white dark:bg-[#0d1929]">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                step > 1
                  ? 'bg-[#00ADB5] border-[#00ADB5] text-white shadow-[0_0_12px_rgba(0,173,181,0.35)]'
                  : 'border-[#00ADB5] text-[#00ADB5] bg-white dark:bg-[#0d1929]'
              }`}>
                {step > 1 ? <i className="bx bx-check text-lg" /> : '1'}
              </div>
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${step === 1 ? 'text-[#00ADB5]' : 'text-slate-400'}`}>
                {t('childDetails')} {children.length > 1 ? `(${children.length})` : ''}
              </span>
            </div>
            <div className={`w-20 h-px mb-4 transition-colors ${step === 2 ? 'bg-[#00ADB5]' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                step === 2
                  ? 'border-[#00ADB5] text-[#00ADB5] bg-white dark:bg-[#0d1929]'
                  : 'border-slate-300 text-slate-400 bg-white dark:bg-[#0d1929]'
              }`}>2</div>
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${step === 2 ? 'text-[#00ADB5]' : 'text-slate-400'}`}>
                {t('parentDetails')}
              </span>
            </div>
          </div>

          {/* Alerts */}
          {(error || success) && (
            <div className="px-8 pb-2">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                  <i className="bx bx-error-circle text-base flex-shrink-0" />{error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <i className="bx bx-check-circle text-base flex-shrink-0" />{success}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-8 pb-8">

            {/* ── STEP 1: Child Cards ── */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                {/* ── Parent selector ──────────────────────────── */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1929]/60 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <i className="bx bx-user-circle text-[#00ADB5] text-xl" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {lx('Parent / Guardian', 'ወላጅ / አሳዳጊ', 'Maatii / Eegaa', 'ወላዲ / ሓላዊ')}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                      {lx('Select existing or leave blank to register a new parent', 'ካለ ምረጥ ወይም ባዶ ተወ', 'Filii ykn duwwaa dhiisi', 'ዘሎ ምረጽ ወይ ባዶ ሓድጎ')}
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedParentId}
                      onChange={e => { setSelectedParentId(e.target.value); setError(''); }}
                      disabled={parentsLoading}
                      className={`${SEL} pr-10`}
                    >
                      <option value="">
                        {parentsLoading ? lx('Loading parents…', 'ወላጆች እየተጫኑ ነው…', 'Maatii fe\'amaa jira…', 'ወለዲ ይጽዓን ኣሎ…') : lx('— Register a new parent (go to Step 2) —', '— አዲስ ወላጅ ምዝገባ (ወደ ደረጃ 2) —', '— Maatii haaraa galmeessi (Tarreee 2 deemi) —', '— ሓድሽ ወላዲ ምዝጋብ (ናብ ስጉምቲ 2) —')}
                      </option>
                      {registeredParents.map(p => (
                        <option key={p._id || p.id} value={p._id || p.id}>
                          {p.fullName}{p.phone ? ` · ${p.phone}` : ''}{p.email ? ` · ${p.email}` : ''}
                        </option>
                      ))}
                    </select>
                    <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Selected parent info badge */}
                  {selectedParentId && (() => {
                    const p = registeredParents.find(x => (x._id || x.id) === selectedParentId);
                    return p ? (
                      <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#00ADB5]/8 border border-[#00ADB5]/20 px-4 py-3">
                        <div className="w-9 h-9 rounded-full bg-[#00ADB5] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {p.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{p.fullName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.email}{p.phone ? ` · ${p.phone}` : ''}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0">
                          <i className="bx bx-check-circle text-sm" /> {lx('Already registered', 'አስቀድሞ ተመዝግቧል', 'Duraan galmaameera', 'ድሮ ተመዝጊቡ')}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* ── Child Cards ──────────────────────────────── */}
                {children.map((child, idx) => (
                  <ChildCard
                    key={child.id}
                    child={child}
                    index={idx}
                    total={children.length}
                    onChange={handleChildChange}
                    onRemove={removeChild}
                    t={t}
                    locale={L}
                    error={cardErrors[child.id]}
                  />
                ))}


                {/* Add Another Child */}
                <button
                  type="button"
                  onClick={addChild}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#00ADB5]/40 text-[#00ADB5] font-semibold text-sm hover:border-[#00ADB5] hover:bg-[#00ADB5]/5 transition-all duration-200 group"
                >
                  <span className="w-6 h-6 rounded-full bg-[#00ADB5]/10 group-hover:bg-[#00ADB5]/20 flex items-center justify-center transition-colors">
                    <i className="bx bx-plus text-sm" />
                  </span>
                  {lx('Add Another Child', 'ሌላ ልጅ ጨምር', "Daa'ima Biraa Dabaluu", 'ካልእ ቆልዓ ወስኽ')}
                </button>

                {/* Next */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-400">
                    {children.length === 1
                      ? lx('1 child will be registered', '1 ልጅ ይመዘገባል', 'Daa\'ima 1 ni galmaawa', '1 ቆልዓ ክምዝገብ እዩ')
                      : lx(`${children.length} children will be registered`, `${children.length} ልጆች ይመዘገባሉ`, `Daa\'ima ${children.length} ni galmaawu`, `${children.length} ቆልዑ ክምዝገቡ እዮም`)}
                  </p>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] text-white font-semibold text-sm px-7 py-2.5 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><i className="bx bx-loader-alt animate-spin text-lg" /> Registering…</>
                    ) : selectedParentId ? (
                      <><i className="bx bx-check text-lg" /> Finish Registration</>
                    ) : (
                      <>{t('nextBtn')} <i className="bx bx-right-arrow-alt text-lg" /></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Parent Details ── */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">{t('registerParentTitle')}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={LBL}>{t('fullName')}</label>
                    <input value={parent.parentFullName} onChange={setP('parentFullName')} className={INP} placeholder={lx('John Parent', 'ለምሳሌ: ዮሐንስ ወላጅ', 'Fkn. Yohaannis Maatii', 'ንኣብ: ዮሃንስ ወላዲ')} />
                  </div>
                  <div>
                    <EmailVerificationInput
                      label={t('emailLabel')}
                      required
                      placeholder="parent@email.com"
                      value={parent.parentEmail}
                      onChange={(val) => setParent(p => ({ ...p, parentEmail: val }))}
                      onVerified={() => setIsEmailVerified(true)}
                      onUnverified={() => setIsEmailVerified(false)}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className={LBL}>{t('phoneNumber')}</label>
                    <input
                      type="tel"
                      value={parent.parentPhone}
                      onChange={setP('parentPhone')}
                      className={`${INP} ${displayParentPhoneError ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/15' : ''}`}
                      placeholder={lx('e.g. 0911 234 567', 'ለምሳሌ: 0911 234 567', 'Fkn. 0911 234 567', 'ንኣብ: 0911 234 567')}
                    />
                    {(displayParentPhoneError || checkingPhone) && (
                      <p className="mt-1 text-xs flex items-center gap-1">
                        {checkingPhone
                          ? <><i className="bx bx-loader-alt animate-spin text-sm text-slate-400" /><span className="text-slate-400">Checking availability…</span></>
                          : <><i className="bx bx-error-circle text-sm text-rose-500" /><span className="text-rose-500">{displayParentPhoneError}</span></>
                        }
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={LBL}>{t('orgOptional')}</label>
                    <input value={parent.parentOrganization} onChange={setP('parentOrganization')} className={INP} placeholder={lx('Workplace or school', 'ስራ ቦታ ወይ ትምህርት ቤት', 'Iddoo hojii ykn mana barumsaa', 'ቦታ ስራ ወይ ቤት ትምህርቲ')} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={LBL}>{t('accountPassword')}</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={parent.parentPassword}
                        onChange={setP('parentPassword')}
                        className={`${INP} mt-1.5 pr-12`}
                        placeholder={lx('Min 8 chars, uppercase, number, special char', 'ቢያንስ 8 ፊደሎች፣ ካፒታል፣ ቁጥር፣ ምልክት', 'Min. qubee 8, qubee guddaa, lakk., mallattoo', 'ዝወሓደ 8 ፊደላት፣ ዓቢ ፊደል፣ ቁጽሪ፣ ምልክት')}
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00ADB5] transition-colors">
                        <i className={`bx ${showPwd ? 'bx-hide' : 'bx-show'} text-xl`} />
                      </button>
                    </div>
                    <PasswordStrengthChecker password={parent.parentPassword} />
                  </div>
                </div>

                {/* ── ID Card Verification ───────────────────────────────── */}
                <div className="rounded-2xl border border-[#005d68]/25 dark:border-[#005d68]/40 bg-[#005d68]/[0.03] dark:bg-[#005d68]/10 overflow-hidden">

                  {/* Card header */}
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-[#005d68]/15 dark:border-[#005d68]/30">
                    <div className="w-11 h-11 rounded-full bg-[#005d68] flex items-center justify-center flex-shrink-0 shadow-md">
                      <i className="bx bx-id-card text-white text-xl" />
                    </div>
                    <div>
                    <p className="text-sm font-bold text-[#005d68] dark:text-teal-300">{lx('ID Card Verification', 'የመታወቂያ ካርድ ማረጋገጫ', 'Mirkaneessa Kaardii Eenyummaa', 'ምርግጋጽ ካርድ መንነት')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lx("Please upload clear images of both sides of the parent's government-issued ID card.", 'የወላጁን መታወቂያ ሁለቱን ጎን ይስቀሉ።', "Bifa lamaanuu kaardii maatii galchi.", 'ክልቲኡ ሸነኽ ናይ መንነት ካርድ ወላዲ ስቐል።')}
                      </p>
                    </div>
                  </div>

                  {/* Upload slots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">

                    {/* Front side */}
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                        <i className="bx bx-credit-card text-[#005d68] dark:text-teal-400" />
                        {lx('ID Front Side', 'የፊት ገጽ', 'Bifa Fuula', 'ቅድሚ ሸነኽ')}
                        <span className="text-rose-400 ml-0.5">*</span>
                      </p>
                      <input
                        ref={idFrontRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleIdFileChange('front', e.target.files?.[0])}
                      />
                      {idFrontFile ? (
                        /* Uploaded state */
                        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                          <img
                            src={idFrontPreview}
                            alt="ID Front"
                            className="w-full h-28 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-1">
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow">
                              <i className="bx bx-check-circle text-sm" /> {lx('ID Uploaded', 'ተጭኗል', 'Fe\'ameera', 'ተሰቒሉ')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => idFrontRef.current?.click()}
                            className="absolute top-2 right-2 w-6 h-6 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-slate-600 transition-colors shadow"
                            title="Replace"
                          >
                            <i className="bx bx-refresh text-sm" />
                          </button>
                        </div>
                      ) : (
                        /* Empty dropzone */
                        <button
                          type="button"
                          onClick={() => idFrontRef.current?.click()}
                          className="w-full h-28 rounded-xl border-2 border-dashed border-[#005d68]/30 dark:border-[#005d68]/50 hover:border-[#005d68] dark:hover:border-teal-400 bg-white dark:bg-[#0d1929] hover:bg-[#005d68]/5 dark:hover:bg-[#005d68]/10 transition-all group flex flex-col items-center justify-center gap-2"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#005d68]/10 group-hover:bg-[#005d68]/20 flex items-center justify-center transition-colors">
                            <i className="bx bx-upload text-[#005d68] dark:text-teal-400 text-lg" />
                          </div>
                          <span className="text-xs font-semibold text-[#005d68] dark:text-teal-400">{lx('Upload Front Side', 'የፊት ገጽ ስቀል', 'Bifa Fuula Galchi', 'ቅድሚ ሸነኽ ስቐል')}</span>
                          <span className="text-[10px] text-slate-400">{lx('JPG, PNG up to 5 MB', 'JPG, PNG እስከ 5 MB', 'JPG, PNG hanga 5 MB', 'JPG, PNG ክሳብ 5 MB')}</span>
                        </button>
                      )}
                    </div>

                    {/* Back side */}
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                        <i className="bx bx-credit-card-front text-[#005d68] dark:text-teal-400" />
                        {lx('ID Back Side', 'የኋላ ገጽ', 'Bifa Duubaa', 'ኋላ ሸነኽ')}
                        <span className="text-rose-400 ml-0.5">*</span>
                      </p>
                      <input
                        ref={idBackRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleIdFileChange('back', e.target.files?.[0])}
                      />
                      {idBackFile ? (
                        /* Uploaded state */
                        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                          <img
                            src={idBackPreview}
                            alt="ID Back"
                            className="w-full h-28 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-1">
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow">
                              <i className="bx bx-check-circle text-sm" /> {lx('ID Uploaded', 'ተጭኗል', 'Fe\'ameera', 'ተሰቒሉ')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => idBackRef.current?.click()}
                            className="absolute top-2 right-2 w-6 h-6 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-slate-600 transition-colors shadow"
                            title="Replace"
                          >
                            <i className="bx bx-refresh text-sm" />
                          </button>
                        </div>
                      ) : (
                        /* Empty dropzone */
                        <button
                          type="button"
                          onClick={() => idBackRef.current?.click()}
                          className="w-full h-28 rounded-xl border-2 border-dashed border-[#005d68]/30 dark:border-[#005d68]/50 hover:border-[#005d68] dark:hover:border-teal-400 bg-white dark:bg-[#0d1929] hover:bg-[#005d68]/5 dark:hover:bg-[#005d68]/10 transition-all group flex flex-col items-center justify-center gap-2"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#005d68]/10 group-hover:bg-[#005d68]/20 flex items-center justify-center transition-colors">
                            <i className="bx bx-upload text-[#005d68] dark:text-teal-400 text-lg" />
                          </div>
                          <span className="text-xs font-semibold text-[#005d68] dark:text-teal-400">{lx('Upload Back Side', 'የኋላ ገጽ ስቀል', 'Bifa Duubaa Galchi', 'ኋላ ሸነኽ ስቐል')}</span>
                          <span className="text-[10px] text-slate-400">{lx('JPG, PNG up to 5 MB', 'JPG, PNG እስከ 5 MB', 'JPG, PNG hanga 5 MB', 'JPG, PNG ክሳብ 5 MB')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress indicator */}
                  <div className="px-5 pb-4 flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full transition-colors ${idFrontFile ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <span className={`text-[11px] font-medium transition-colors ${idFrontFile ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {idFrontFile ? lx('Front ✓', 'ፊት ✓', 'Fuula ✓', 'ቅድሚ ✓') : lx('Front pending', 'ፊት በመጠባበቅ', 'Fuula eegamaa', 'ቅድሚ ይጸበ')}
                      </span>
                    </div>
                    <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full transition-colors ${idBackFile ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <span className={`text-[11px] font-medium transition-colors ${idBackFile ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {idBackFile ? lx('Back ✓', 'ኋላ ✓', 'Duubaa ✓', 'ኋላ ✓') : lx('Back pending', 'ኋላ በመጠባበቅ', 'Duubaa eegamaa', 'ኋላ ይጸበ')}
                      </span>
                    </div>
                    <div className="flex-1" />
                    {/* Security note */}
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                      <i className="bx bx-shield-quarter text-[#005d68] dark:text-teal-500 text-sm" />
                      {lx('Your ID data is encrypted and stored securely', 'የታወቂያ መረጃዎ ተመስጥሮ ደህንነቱ ተጠብቆ ይቀመጣል', 'Deetaan eenyummaa kee ni iccitii ti', 'ናይ ID ዳታካ ምስጢራዊ ኮይኑ ኣሎ')}
                    </span>
                  </div>
                </div>

                {/* Emergency contact */}
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mt-2">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">{t('emergencyContact')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className={LBL}>{t('contactName')}</label>
                    <input value={parent.emergencyContactName} onChange={setP('emergencyContactName')} className={INP} placeholder={lx('Guardian name', 'የሞግዚት ስም', 'Maqaa Eegaa', 'ሽም ሓላዊ')} />
                  </div>
                  <div>
                    <label className={LBL}>{t('contactPhone')}</label>
                    <input
                      value={parent.emergencyContactPhone}
                      onChange={setP('emergencyContactPhone')}
                      className={`${INP} ${displayEmergPhoneError ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/15' : ''}`}
                      placeholder={lx('Phone number', 'ስልክ ቁጥር', 'Lakkoofsa Bilbilaa', 'ቁጽሪ ስልኪ')}
                    />
                    {(displayEmergPhoneError || checkingEmerg) && (
                      <p className="mt-1 text-xs flex items-center gap-1">
                        {checkingEmerg
                          ? <><i className="bx bx-loader-alt animate-spin text-sm text-slate-400" /><span className="text-slate-400">Checking availability…</span></>
                          : <><i className="bx bx-error-circle text-sm text-rose-500" /><span className="text-rose-500">{displayEmergPhoneError}</span></>
                        }
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={LBL}>{t('relationshipLabel')}</label>
                    <div className="relative">
                      <select value={parent.emergencyContactRelationship} onChange={setP('emergencyContactRelationship')} className={`${SEL} mt-1.5`}>
                        <option value="">{t('selectRelationship')}</option>
                        <option value="Mother">{t('relationMother')}</option>
                        <option value="Father">{t('relationFather')}</option>
                        <option value="Aunt">{t('relationAunt')}</option>
                        <option value="Uncle">{t('relationUncle')}</option>
                        <option value="Grandparent">{t('relationGrandparent')}</option>
                        <option value="Sibling">{t('relationSibling')}</option>
                        <option value="Other">{t('relationOther')}</option>
                      </select>
                      <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button" onClick={() => { setError(''); setStep(1); }} disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-slate-600 dark:text-slate-300 font-semibold text-sm px-7 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    <i className="bx bx-left-arrow-alt text-lg" /> {t('backBtn')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !isEmailVerified || !idFrontFile || !idBackFile || hasPhoneError}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] text-white font-semibold text-sm px-8 py-2.5 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? <><i className="bx bx-loader-alt animate-spin text-lg" /> {t('registering')}</>
                      : <><i className="bx bx-check text-lg" />
                        {children.length === 1 ? t('submitRegistration') : `Submit ${children.length} + Parent`}
                      </>
                    }
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Info footer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px border-t border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
            {[
              { icon: 'bx-shield-alt-2', titleKey: 'securePrivate',    descKey: 'securePrivateDesc' },
              { icon: 'bx-bolt-circle',  titleKey: 'quickRegistration', descKey: 'quickRegistrationDesc' },
              { icon: 'bx-bell',         titleKey: 'stayUpdated',       descKey: 'stayUpdatedDesc' },
            ].map(item => (
              <div key={item.titleKey} className="flex items-start gap-3 bg-white dark:bg-[#0d1929] px-6 py-5">
                <div className="w-8 h-8 rounded-lg bg-[#00ADB5]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={`bx ${item.icon} text-[#00ADB5] text-base`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(item.titleKey)}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t(item.descKey)}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default RegisterChild;
