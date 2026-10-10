import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import EmailVerificationInput from '../../components/shared/EmailVerificationInput';
import PasswordStrengthChecker, { validatePassword } from '../../components/shared/PasswordStrengthChecker';
import { validateEthPhone, validatePhonePair } from '../../utils/phoneValidation';
import { usePhoneAvailability } from '../../hooks/usePhoneAvailability';

/* ── shared field styles ─────────────────────────────── */
const INP =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 dark:border-slate-700 dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-[#00B4D8]';

const INP_ICON =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 dark:border-slate-700 dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-[#00B4D8]';

const INP_ICON_ERR =
  'mt-1.5 w-full rounded-xl border border-rose-400 bg-white pl-9 pr-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/15 dark:border-rose-500 dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500';

const INP_ERR =
  'mt-1.5 w-full rounded-xl border border-rose-400 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/15 dark:border-rose-500 dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500';

const LBL = 'block text-sm font-medium text-slate-600 dark:text-teal-400';

const EMPTY = {
  fullName: '', email: '', phone: '', password: '', role: 'teacher',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
};

const EMPTY_PHONE_ERRORS = { phone: '', emergencyContactPhone: '' };

const PHONE_MSGS = {
  taken: {
    en: 'This phone number is already registered! Please use a different number.',
    am: 'ይህ የስልክ ቁጥር አስቀድሞ ተመዝግቧል! ሌላ ቁጥር ይጠቀሙ።',
    om: 'Lakkoofsi bilbilaa kun duraan galmaameera! Lakkoofsa biraa fayyadami.',
    ti: 'ካብ ቁጽሪ ስልኪ ድሮ ተመዝጊቡ ኣሎ! ካልእ ቁጽሪ ተጠቐም።',
  },
  invalid: {
    en: 'Invalid Ethiopian phone number. Must start with +2519, +2517, 09, or 07 followed by 8 digits.',
    am: 'ልክ ያልሆነ የኢትዮጵያ ስልክ ቁጥር። +2519፣ +2517፣ 09 ወይ 07 ይጀምሩ።',
    om: 'Lakkoofsa bilbilaa Itoophiyaa sirrii miti. +2519, +2517, 09, ykn 07 waliin eegali.',
    ti: 'ቁጽሪ ስልኪ ኢትዮጵያ ቅኑዕ ኣይኮነን። ብ+2519፣ +2517፣ 09፣ ወይ 07 ጀምር።',
  },
};

const AddStaff = () => {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const phoneMsg = (type) => PHONE_MSGS[type][locale] || PHONE_MSGS[type]['en'];
  const [form, setForm]             = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState('');
  const [phoneErrors, setPhoneErrors] = useState(EMPTY_PHONE_ERRORS);
  const [success, setSuccess]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // System-wide uniqueness checks (debounced, fires after format is valid)
  const { checking: checkingPhone,   takenError: phoneTaken }   = usePhoneAvailability(form.phone,                 phoneErrors.phone);
  const { checking: checkingEmerg,   takenError: emergTaken }   = usePhoneAvailability(form.emergencyContactPhone, phoneErrors.emergencyContactPhone);

  // Merge format errors with taken errors
  const displayPhoneError = (phoneErrors.phone ? phoneMsg('invalid') : '') || (phoneTaken ? phoneMsg('taken') : '');
  const displayEmergError = (phoneErrors.emergencyContactPhone ? phoneMsg('invalid') : '') || (emergTaken ? phoneMsg('taken') : '');
  const hasPhoneError = displayPhoneError || displayEmergError || checkingPhone || checkingEmerg;

  /* Re-validate the phone pair whenever either phone field changes */
  const handlePhoneChange = (key, val) => {
    const updated = { ...form, [key]: val };
    setForm(updated);
    const primary   = key === 'phone'                 ? val : form.phone;
    const emergency = key === 'emergencyContactPhone' ? val : form.emergencyContactPhone;
    const { primaryError, emergencyError } = validatePhonePair(primary, emergency);
    setPhoneErrors({ phone: primaryError, emergencyContactPhone: emergencyError });
  };

  const set = (key) => (e) => {
    if (key === 'phone' || key === 'emergencyContactPhone') {
      handlePhoneChange(key, e.target.value);
    } else {
      setForm((p) => ({ ...p, [key]: e.target.value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isEmailVerified) {
      setError('Please verify the email address before adding the staff member.');
      return;
    }

    // Final phone validation on submit
    const { primaryError, emergencyError } = validatePhonePair(form.phone, form.emergencyContactPhone);
    if (primaryError || emergencyError) {
      setPhoneErrors({ phone: primaryError, emergencyContactPhone: emergencyError });
      setError('Please fix the phone number errors before submitting.');
      return;
    }

    // Password validation
    const pwdErr = validatePassword(form.password);
    if (pwdErr) { setError(pwdErr); return; }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName:  form.fullName,
        email:     form.email,
        phone:     form.phone,
        password:  form.password,
        role:      form.role,
        emergencyContact: {
          name:         form.emergencyContactName,
          phone:        form.emergencyContactPhone,
          relationship: form.emergencyContactRelationship,
        },
      });
      setSuccess(true);
      setPhoneErrors(EMPTY_PHONE_ERRORS);
      setIsEmailVerified(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add staff member.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Success state ─────────────────────────────────── */
  if (success) {
    return (
      <div className="min-h-full bg-slate-50 dark:bg-[#060d14] py-2 flex items-center justify-center">
        <div className="bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full max-w-md p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#00ADB5]/10 flex items-center justify-center">
            <i className="bx bx-check-circle text-4xl text-[#00ADB5]" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('staffMemberAdded', 'Staff Member Added!')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('staffAccountCreated', 'The new staff account has been created successfully.')}</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => { setSuccess(false); setForm(EMPTY); setPhoneErrors(EMPTY_PHONE_ERRORS); setIsEmailVerified(false); }}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t('addAnother', 'Add Another')}
            </button>
            <button
              onClick={() => navigate('/dashboard/admin/view-staff')}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#00ADB5] hover:bg-[#009aa1] rounded-xl transition-colors shadow-sm"
            >
              {t('viewStaff', 'View Staff')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main form ─────────────────────────────────────── */
  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#060d14] py-2">
      <div className="w-full">

        {/* White card */}
        <div className="bg-white dark:bg-[#0d1929] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

          {/* Card header */}
          <div className="flex items-center gap-4 px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-[#00ADB5]/10 flex items-center justify-center flex-shrink-0">
              <i className="bx bx-user-plus text-xl text-[#00ADB5]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t('addNewStaffMember')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('fillStaffDetails')}
              </p>
            </div>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">

            {/* Error alert */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                <i className="bx bx-error-circle text-base flex-shrink-0" />{error}
              </div>
            )}

            {/* Row 1 — Full Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={LBL}>{t('fullName', 'Full Name')} <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <i className="bx bx-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
                  <input
                    required type="text" value={form.fullName}
                    onChange={set('fullName')}
                    placeholder={t('egSarahJohnson', 'e.g. Sarah Johnson')}
                    className={INP_ICON}
                  />
                </div>
              </div>
              <div>
                <EmailVerificationInput
                  label={`${t('emailLabel', 'Email Address')} *`}
                  required
                  placeholder="admin@daycare.com"
                  value={form.email}
                  onChange={(val) => setForm(p => ({ ...p, email: val }))}
                  onVerified={() => setIsEmailVerified(true)}
                  onUnverified={() => setIsEmailVerified(false)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Row 2 — Phone + Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={LBL}>{t('phoneNumber', 'Phone Number')} <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <i className="bx bx-phone absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
                  <input
                    type="tel" value={form.phone}
                    onChange={set('phone')}
                    placeholder={locale === 'am' ? 'ለምሳሌ: 0911 234 567' : locale === 'om' ? 'Fkn. 0911 234 567' : locale === 'ti' ? 'ንኣብ: 0911 234 567' : 'e.g. 0911 234 567'}
                    className={displayPhoneError ? INP_ICON_ERR : INP_ICON}
                  />
                </div>
                {(displayPhoneError || checkingPhone) && (
                  <p className="mt-1.5 text-xs flex items-center gap-1">
                    {checkingPhone
                      ? <><i className="bx bx-loader-alt animate-spin text-sm text-slate-400" /><span className="text-slate-400">Checking availability…</span></>
                      : <><i className="bx bx-error-circle text-sm text-rose-500" /><span className="text-rose-500 dark:text-rose-400">{displayPhoneError}</span></>
                    }
                  </p>
                )}
              </div>
              <div>
                <label className={LBL}>{t('role', 'Role')} <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <i className="bx bx-badge-check absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
                  <select
                    value={form.role}
                    onChange={set('role')}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 dark:border-slate-700 dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-[#00B4D8] appearance-none"
                  >
                    <option value="teacher">{t('childcareProvider', 'Nanny')}</option>
                    <option value="reception">{t('reception', 'Reception')}</option>
                    <option value="staff">{t('supportStaff', 'Support Staff')}</option>
                    <option value="admin">{t('admin', 'Admin')}</option>
                  </select>
                  <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={LBL}>{t('password', 'Password')} <span className="text-rose-400">*</span></label>
              <div className="relative">
                <i className="bx bx-lock-alt absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder={t('enterSecurePassword', 'Min 8 chars, uppercase, number, special char')}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-11 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 dark:border-slate-700 dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-[#00B4D8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00ADB5] dark:hover:text-[#00B4D8] transition-colors"
                >
                  <i className={`bx ${showPassword ? 'bx-show' : 'bx-hide'} text-xl`} />
                </button>
              </div>
              <PasswordStrengthChecker password={form.password} />
            </div>

            {/* Emergency Contact Section */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#060d14] p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <i className="bx bx-phone-call text-amber-600 dark:text-amber-400 text-sm" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {locale === 'am' ? 'የአደጋ ጊዜ አድራሻ' : locale === 'om' ? 'Quunnamtii Yeroo Balaa' : locale === 'ti' ? 'ናይ ህጹጽ እዋን መወከሲ' : 'Emergency Contact'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Emergency Contact Name */}
                <div>
                  <label className={LBL}>
                    {locale === 'am' ? 'የእውቂያ ስም' : locale === 'om' ? 'Maqaa Quunnamtii' : locale === 'ti' ? 'ሽም መወከሲ' : 'Contact Name'}
                  </label>
                  <div className="relative">
                    <i className="bx bx-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
                    <input
                      type="text"
                      value={form.emergencyContactName}
                      onChange={set('emergencyContactName')}
                      placeholder={locale === 'am' ? 'ለምሳሌ: ሳራ ተስፋዬ' : locale === 'om' ? 'Fkn. Saara Tasfaayee' : locale === 'ti' ? 'ንኣብ: ሳራ ተስፋዬ' : 'e.g. Sara Tesfaye'}
                      className={INP_ICON}
                    />
                  </div>
                </div>

                {/* Emergency Contact Phone */}
                <div>
                  <label className={LBL}>
                    {locale === 'am' ? 'የእውቂያ ስልክ' : locale === 'om' ? 'Lakkoofsa Bilbilaa' : locale === 'ti' ? 'ቁጽሪ ስልኪ መወከሲ' : 'Contact Phone'}
                  </label>
                  <div className="relative">
                    <i className="bx bx-phone absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
                    <input
                      type="tel"
                      value={form.emergencyContactPhone}
                      onChange={set('emergencyContactPhone')}
                      placeholder={locale === 'am' ? 'ለምሳሌ: 0777 123 456' : locale === 'om' ? 'Fkn. 0777 123 456' : locale === 'ti' ? 'ንኣብ: 0777 123 456' : 'e.g. 0777 123 456'}
                      className={displayEmergError ? INP_ICON_ERR : INP_ICON}
                    />
                  </div>
                  {(displayEmergError || checkingEmerg) && (
                    <p className="mt-1.5 text-xs flex items-center gap-1">
                      {checkingEmerg
                        ? <><i className="bx bx-loader-alt animate-spin text-sm text-slate-400" /><span className="text-slate-400">{locale === 'am' ? 'በማረጋገጥ ላይ...' : locale === 'om' ? 'Mirkaneessaa...' : locale === 'ti' ? 'ይረጋገጽ ኣሎ...' : 'Checking availability…'}</span></>
                        : <><i className="bx bx-error-circle text-sm text-rose-500" /><span className="text-rose-500 dark:text-rose-400">{displayEmergError}</span></>
                      }
                    </p>
                  )}
                </div>

                {/* Relationship */}
                <div>
                  <label className={LBL}>
                    {locale === 'am' ? 'ዝምድና' : locale === 'om' ? 'Hidhata' : locale === 'ti' ? 'ዝምድና' : 'Relationship'}
                  </label>
                  <div className="relative">
                    <i className="bx bx-group absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
                    <input
                      type="text"
                      value={form.emergencyContactRelationship}
                      onChange={set('emergencyContactRelationship')}
                      placeholder={locale === 'am' ? 'ትዳርተኛ፣ ወላጅ፣ ወንድም/እህት...' : locale === 'om' ? 'Cima, Abbaa/Haadha, Obbolaa...' : locale === 'ti' ? 'ሰብ-ሓዳር፣ ወላዲ፣ ሓው/ሓፍቲ...' : 'Spouse, Parent, Sibling…'}
                      className={INP_ICON}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Info tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#060d14] px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-[#00ADB5]/10 flex items-center justify-center flex-shrink-0">
                  <i className="bx bx-shield-alt-2 text-[#00ADB5] text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('secureAccess')}</p>
                  <p className="text-xs text-slate-400 leading-snug mt-0.5">{t('staffCredentialsHint')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#060d14] px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-[#00ADB5]/10 flex items-center justify-center flex-shrink-0">
                  <i className="bx bx-group text-[#00ADB5] text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('roleBased')}</p>
                  <p className="text-xs text-slate-400 leading-snug mt-0.5">{t('permissionsHint')}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-slate-600 dark:text-slate-300 font-semibold text-sm px-6 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !isEmailVerified || !!hasPhoneError}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] text-white font-semibold text-sm px-6 py-2.5 transition-all shadow-sm hover:shadow-[0_4px_16px_rgba(0,173,181,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><i className="bx bx-loader-alt animate-spin text-lg" /> {t('adding', 'Adding...')}</>
                  : <><i className="bx bx-plus text-lg" /> {t('addStaff', 'Add Staff')}</>
                }
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default AddStaff;
