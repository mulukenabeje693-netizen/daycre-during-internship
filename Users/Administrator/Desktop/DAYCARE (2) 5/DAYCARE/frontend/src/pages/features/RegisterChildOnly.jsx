import React, { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';

const getChildAge = (dob) => {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime()) || d > new Date()) return null;
  let y = new Date().getFullYear() - d.getFullYear();
  const m = new Date().getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) y--;
  return y;
};

/* ── Ethiopian phone validator ─────────────────────────── */
const ETH_PHONE_RE = /^(?:(?:\+251|251|0)[97]\d{8})$/;
const validateEthPhone = (val) => {
  if (!val || !val.trim()) return null; // optional — empty is fine
  const cleaned = val.trim().replace(/\s+/g, '');
  if (!ETH_PHONE_RE.test(cleaned)) {
    return 'Enter a valid Ethiopian number (e.g. 0911234567 or +251911234567)';
  }
  return null;
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
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
});

/* ─── Single child card ──────────────────────────────────── */
const ChildCard = ({ child, index, total, onChange, onRemove, t, error, phoneError }) => {
  const set = (key) => (e) => onChange(child.id, key, e.target.value);

  return (
    <div className="bg-slate-50 dark:bg-[#0d1929]/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 relative">

      {/* Card header */}
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
          <button
            type="button"
            onClick={() => onRemove(child.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            title="Remove this child"
          >
            <i className="bx bx-x text-lg" />
          </button>
        )}
      </div>

      {/* Per-card error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          <i className="bx bx-error-circle text-base flex-shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LBL}>{t('firstName')}</label>
          <input value={child.childFirstName} onChange={set('childFirstName')} className={INP} placeholder="First name" />
        </div>
        <div>
          <label className={LBL}>{t('lastName')}</label>
          <input value={child.childLastName} onChange={set('childLastName')} className={INP} placeholder="Last name" />
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
          <input value={child.allergies} onChange={set('allergies')} className={INP} placeholder="Peanuts, dairy, etc." />
        </div>
        <div>
          <label className={LBL}>{t('medicalNotesLabel')}</label>
          <input value={child.medicalNotes} onChange={set('medicalNotes')} className={INP} placeholder="Asthma, special care, etc." />
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm font-bold text-[#00ADB5] mb-3 flex items-center gap-2">
          <i className="bx bx-phone-call text-base" />
          {t('emergencyContact')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={LBL}>{t('contactName')}</label>
            <input value={child.emergencyContactName} onChange={set('emergencyContactName')}
              className={INP} placeholder="Guardian name" />
          </div>
          <div>
            <label className={LBL}>{t('contactPhone')}</label>
            <input value={child.emergencyContactPhone} onChange={set('emergencyContactPhone')}
              className={`${INP} ${phoneError ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/15' : ''}`}
              placeholder="e.g. 0911 234 567" />
            {phoneError && (
              <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                <i className="bx bx-error-circle text-sm" />{phoneError}
              </p>
            )}
          </div>
          <div>
            <label className={LBL}>{t('relationshipLabel')}</label>
            <div className="relative">
              <select value={child.emergencyContactRelationship} onChange={set('emergencyContactRelationship')}
                className={SEL}>
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
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
const RegisterChildOnly = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [children, setChildren] = useState([emptyChild()]);
  const [loading, setLoading]   = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [cardErrors, setCardErrors]   = useState({});
  const [phoneErrors, setPhoneErrors] = useState({});  // { [child.id]: string }
  const [success, setSuccess]         = useState('');

  /* ── field change ─────────────────────────────────────── */
  const handleChange = (id, key, value) => {
    setChildren(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));
    setCardErrors(prev => ({ ...prev, [id]: '' }));
    if (key === 'emergencyContactPhone') {
      setPhoneErrors(prev => ({ ...prev, [id]: validateEthPhone(value) || '' }));
    }
    setGlobalError('');
  };

  /* ── add child ─────────────────────────────────────────── */
  const addChild = () => {
    setChildren(prev => [...prev, emptyChild()]);
    setSuccess('');
    setGlobalError('');
  };

  /* ── remove child ──────────────────────────────────────── */
  const removeChild = (id) => {
    setChildren(prev => prev.filter(c => c.id !== id));
    setCardErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  /* ── validate all ──────────────────────────────────────── */
  const validate = () => {
    const errors = {};
    const pErrors = {};
    let valid = true;
    children.forEach(c => {
      if (!c.childFirstName.trim() || !c.childLastName.trim() || !c.dateOfBirth || !c.gender) {
        errors[c.id] = 'Please complete first name, last name, date of birth, and gender.';
        valid = false;
      } else {
        const age = getChildAge(c.dateOfBirth);
        if (age === null) { errors[c.id] = 'Please enter a valid date of birth.'; valid = false; }
        else if (age > 18) { errors[c.id] = 'Child must be 18 years or younger.'; valid = false; }
      }
      const phoneErr = validateEthPhone(c.emergencyContactPhone);
      if (phoneErr) { pErrors[c.id] = phoneErr; valid = false; }
    });
    setCardErrors(errors);
    setPhoneErrors(pErrors);
    return valid;
  };

  /* ── submit ────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError(''); setSuccess('');
    if (!validate()) return;

    setLoading(true);
    const registered = [];
    const failed = [];

    for (const c of children) {
      try {
        await api.post('/children', {
          firstName:    c.childFirstName.trim(),
          lastName:     c.childLastName.trim(),
          dateOfBirth:  c.dateOfBirth,
          gender:       c.gender,
          parentName:   user?.fullName || '',
          parents:      user?._id ? [user._id] : [],
          allergies:    c.allergies.trim(),
          medicalNotes: c.medicalNotes.trim(),
          emergencyContact: {
            name:         c.emergencyContactName.trim(),
            phone:        c.emergencyContactPhone.trim(),
            relationship: c.emergencyContactRelationship.trim(),
          },
        });
        registered.push(`${c.childFirstName} ${c.childLastName}`);
      } catch (err) {
        failed.push(`${c.childFirstName} ${c.childLastName}: ${err.response?.data?.message || 'failed'}`);
      }
    }

    setLoading(false);

    if (failed.length > 0) {
      setGlobalError(`Some registrations failed: ${failed.join('; ')}`);
    }
    if (registered.length > 0) {
      setSuccess(
        registered.length === 1
          ? `${registered[0]} registered successfully and sent for admin review.`
          : `${registered.join(', ')} registered successfully and sent for admin review.`
      );
      // Reset only successfully registered children
      if (failed.length === 0) {
        setChildren([emptyChild()]);
      }
    }
  };

  /* ── render ────────────────────────────────────────────── */
  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#060d14] py-2">
      <div className="w-full">
        <div className="bg-white dark:bg-[#0d1929] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t('registerChild')}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                {t('securePrivateDesc')}
              </p>
            </div>

            {/* Children count badge */}
            {children.length > 1 && (
              <div className="self-start flex items-center gap-2 bg-[#00ADB5]/10 text-[#00ADB5] text-sm font-semibold px-4 py-2 rounded-full border border-[#00ADB5]/20">
                <i className="bx bx-group text-base" />
                {children.length} {t('childrenLabel')}
              </div>
            )}
          </div>

          {/* Global alerts */}
          {(globalError || success) && (
            <div className="px-8 pt-4 space-y-2">
              {globalError && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                  <i className="bx bx-error-circle text-base flex-shrink-0 mt-0.5" />{globalError}
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <i className="bx bx-check-circle text-base flex-shrink-0 mt-0.5" />{success}
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">

            {/* Child cards */}
            {children.map((child, idx) => (
              <ChildCard
                key={child.id}
                child={child}
                index={idx}
                total={children.length}
                onChange={handleChange}
                onRemove={removeChild}
                t={t}
                error={cardErrors[child.id]}
                phoneError={phoneErrors[child.id] || ''}
              />
            ))}

            {/* Add Another Child button */}
            <button
              type="button"
              onClick={addChild}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#00ADB5]/40 text-[#00ADB5] font-semibold text-sm hover:border-[#00ADB5] hover:bg-[#00ADB5]/5 transition-all duration-200 group"
            >
              <span className="w-6 h-6 rounded-full bg-[#00ADB5]/10 group-hover:bg-[#00ADB5]/20 flex items-center justify-center transition-colors">
                <i className="bx bx-plus text-sm" />
              </span>
              Add Another Child
            </button>

            {/* Submit row */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400">
                {children.length === 1
                  ? '1 child will be registered'
                  : `${children.length} children will be registered`}
              </p>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] text-white font-semibold text-sm px-8 py-2.5 transition-all shadow-sm hover:shadow-[0_4px_16px_rgba(0,173,181,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><i className="bx bx-loader-alt animate-spin text-lg" /> {t('registering')}</>
                  : <><i className="bx bx-check text-lg" />
                    {children.length === 1 ? t('submitRegistration') : `Submit ${children.length} Registrations`}
                  </>
                }
              </button>
            </div>
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

export default RegisterChildOnly;
