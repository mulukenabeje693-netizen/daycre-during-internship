import React, { useState } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import EmailVerificationInput from '../../components/shared/EmailVerificationInput';
import PasswordStrengthChecker, { validatePassword } from '../../components/shared/PasswordStrengthChecker';
import { validatePhonePair } from '../../utils/phoneValidation';
import { usePhoneAvailability } from '../../hooks/usePhoneAvailability';

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

const ReceptionRegisterParent = () => {
  const { locale } = useLanguage();
  const phoneMsg = (type) => PHONE_MSGS[type][locale] || PHONE_MSGS[type]['en'];
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    organization: '',
    password: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [phoneErrors, setPhoneErrors] = useState({ phone: '', emergencyContactPhone: '' });

  // System-wide uniqueness checks
  const { checking: checkingPhone, takenError: phoneTaken } = usePhoneAvailability(form.phone,                 phoneErrors.phone);
  const { checking: checkingEmerg, takenError: emergTaken } = usePhoneAvailability(form.emergencyContactPhone, phoneErrors.emergencyContactPhone);

  const displayPhoneError = (phoneErrors.phone ? phoneMsg('invalid') : '') || (phoneTaken ? phoneMsg('taken') : '');
  const displayEmergError = (phoneErrors.emergencyContactPhone ? phoneMsg('invalid') : '') || (emergTaken ? phoneMsg('taken') : '');
  const hasPhoneError = !!(displayPhoneError || displayEmergError || checkingPhone || checkingEmerg);

  const handlePhoneChange = (key, val) => {
    const updated = { ...form, [key]: val };
    setForm(updated);
    const primary   = key === 'phone'                 ? val : form.phone;
    const emergency = key === 'emergencyContactPhone' ? val : form.emergencyContactPhone;
    const { primaryError, emergencyError } = validatePhonePair(primary, emergency);
    setPhoneErrors({ phone: primaryError, emergencyContactPhone: emergencyError });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Full name, email and password are required.');
      return;
    }

    if (!isEmailVerified) {
      setError('Please verify the email address before registering.');
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
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        organization: form.organization.trim(),
        password: form.password,
        role: 'parent',
        emergencyContact: {
          name: form.emergencyContactName.trim(),
          phone: form.emergencyContactPhone.trim(),
          relationship: form.emergencyContactRelationship.trim()
        }
      });
      setSuccess('Parent registered successfully. They can log in with email and password.');
      setForm({
        fullName: '',
        email: '',
        phone: '',
        organization: '',
        password: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelationship: ''
      });
      setIsEmailVerified(false);
      setPhoneErrors({ phone: '', emergencyContactPhone: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to register parent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Register Parent</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Add a new parent account for the portal and capture their emergency contact details.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            {locale === 'am' ? 'ሙሉ ስም' : locale === 'om' ? 'Maqaa Guutuu' : locale === 'ti' ? 'ምሉእ ሽም' : 'Full Name'}
            <input
              value={form.fullName}
              onChange={(e) => setForm(prev => ({ ...prev, fullName: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              placeholder={locale === 'am' ? 'ለምሳሌ: ዮሐንስ ወላጅ' : locale === 'om' ? 'Fkn. Yohaannis' : locale === 'ti' ? 'ንኣብ: ዮሃንስ' : 'John Parent'}
            />
          </label>
          <div>
            <EmailVerificationInput
              label={locale === 'am' ? 'ኢሜይል አድራሻ' : locale === 'om' ? 'Teessoo Email' : locale === 'ti' ? 'ኣድራሻ ኢ-መይል' : 'Email Address'}
              required
              placeholder={locale === 'am' ? 'parent@email.com' : locale === 'om' ? 'parent@email.com' : locale === 'ti' ? 'parent@email.com' : 'parent@email.com'}
              value={form.email}
              onChange={(val) => setForm(prev => ({ ...prev, email: val }))}
              onVerified={() => setIsEmailVerified(true)}
              onUnverified={() => setIsEmailVerified(false)}
              disabled={loading}
            />
          </div>
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            {locale === 'am' ? 'ስልክ ቁጥር' : locale === 'om' ? 'Lakkoofsa Bilbilaa' : locale === 'ti' ? 'ቁጽሪ ስልኪ' : 'Phone'}
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handlePhoneChange('phone', e.target.value)}
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${displayPhoneError ? 'border-rose-400 bg-rose-50 focus:border-rose-400 focus:ring-rose-200' : 'border-slate-200 bg-slate-50 focus:border-indigo-400 focus:ring-indigo-200'}`}
              placeholder={locale === 'am' ? 'ለምሳሌ: 0911 234 567' : locale === 'om' ? 'Fkn. 0911 234 567' : locale === 'ti' ? 'ንኣብ: 0911 234 567' : 'e.g. 0911 234 567'}
            />
            {(displayPhoneError || checkingPhone) && (
              <p className="mt-1 text-xs flex items-center gap-1">
                {checkingPhone
                  ? <><i className="bx bx-loader-alt animate-spin text-sm text-slate-400" /><span className="text-slate-400">{locale === 'am' ? 'በማረጋገጥ ላይ...' : locale === 'om' ? 'Mirkaneessaa...' : locale === 'ti' ? 'ይረጋገጽ ኣሎ...' : 'Checking availability…'}</span></>
                  : <><i className="bx bx-error-circle text-sm text-rose-500" /><span className="text-rose-500">{displayPhoneError}</span></>
                }
              </p>
            )}
          </label>
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            {locale === 'am' ? 'ድርጅት' : locale === 'om' ? 'Dhaabbata' : locale === 'ti' ? 'ትካል' : 'Organization'}
            <input
              value={form.organization}
              onChange={(e) => setForm(prev => ({ ...prev, organization: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              placeholder={locale === 'am' ? 'ምርጫ' : locale === 'om' ? 'Filannoo' : locale === 'ti' ? 'ወሃቢ' : 'Optional'}
            />
          </label>
          <label className="block text-sm text-slate-700 dark:text-slate-200 md:col-span-2">
            {locale === 'am' ? 'የይለፍ ቃል' : locale === 'om' ? 'Jecha Darbii' : locale === 'ti' ? 'ምስጢር ቃል' : 'Password'}
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              placeholder={locale === 'am' ? 'ቢያንስ 8 ፊደሎች፣ ካፒታል፣ ቁጥር፣ ምልክት' : locale === 'om' ? 'Min. qubee 8, qubee guddaa, lakk., mallattoo' : locale === 'ti' ? 'ዝወሓደ 8 ፊደላት፣ ዓቢ ፊደል፣ ቁጽሪ፣ ምልክት' : 'Min 8 chars, uppercase, number, special char'}
            />
            <PasswordStrengthChecker password={form.password} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            {locale === 'am' ? 'የአደጋ ጊዜ የእውቂያ ስም' : locale === 'om' ? 'Maqaa Quunnamtii Yeroo Balaa' : locale === 'ti' ? 'ሽም ናይ ህጹጽ እዋን መወከሲ' : 'Emergency Contact Name'}
            <input
              value={form.emergencyContactName}
              onChange={(e) => setForm(prev => ({ ...prev, emergencyContactName: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              placeholder={locale === 'am' ? 'ለምሳሌ: ሳራ ተስፋዬ' : locale === 'om' ? 'Fkn. Saara Tasfaayee' : locale === 'ti' ? 'ንኣብ: ሳራ ተስፋዬ' : 'Guardian name'}
            />
          </label>
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            {locale === 'am' ? 'የአደጋ ጊዜ ስልክ' : locale === 'om' ? 'Bilbila Quunnamtii Yeroo Balaa' : locale === 'ti' ? 'ስልኪ ናይ ህጹጽ እዋን መወከሲ' : 'Emergency Contact Phone'}
            <input
              value={form.emergencyContactPhone}
              onChange={(e) => handlePhoneChange('emergencyContactPhone', e.target.value)}
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${displayEmergError ? 'border-rose-400 bg-rose-50 focus:border-rose-400 focus:ring-rose-200' : 'border-slate-200 bg-slate-50 focus:border-indigo-400 focus:ring-indigo-200'}`}
              placeholder={locale === 'am' ? 'ለምሳሌ: 0911 234 567' : locale === 'om' ? 'Fkn. 0911 234 567' : locale === 'ti' ? 'ንኣብ: 0911 234 567' : 'e.g. 0911 234 567'}
            />
            {(displayEmergError || checkingEmerg) && (
              <p className="mt-1 text-xs flex items-center gap-1">
                {checkingEmerg
                  ? <><i className="bx bx-loader-alt animate-spin text-sm text-slate-400" /><span className="text-slate-400">{locale === 'am' ? 'በማረጋገጥ ላይ...' : locale === 'om' ? 'Mirkaneessaa...' : locale === 'ti' ? 'ይረጋገጽ ኣሎ...' : 'Checking availability…'}</span></>
                  : <><i className="bx bx-error-circle text-sm text-rose-500" /><span className="text-rose-500">{displayEmergError}</span></>
                }
              </p>
            )}
          </label>
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            {locale === 'am' ? 'ዝምድና' : locale === 'om' ? 'Hidhata' : locale === 'ti' ? 'ዝምድና' : 'Relationship'}
            <input
              value={form.emergencyContactRelationship}
              onChange={(e) => setForm(prev => ({ ...prev, emergencyContactRelationship: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              placeholder={locale === 'am' ? 'እናት፣ አባት፣ አክስት...' : locale === 'om' ? 'Haadha, Abbaa, Obboleettii...' : locale === 'ti' ? 'ኣደ፣ ኣቦ፣ ኣሞ...' : 'Mother, father, aunt...'}
            />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !isEmailVerified || hasPhoneError}
            className="inline-flex items-center justify-center rounded-2xl bg-[#005d68] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#004d57] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (locale === 'am' ? 'በመመዝገብ ላይ...' : locale === 'om' ? 'Galmeessaa...' : locale === 'ti' ? 'ይምዝገብ ኣሎ...' : 'Registering...') : (locale === 'am' ? 'ወላጅ መዝግብ' : locale === 'om' ? 'Maatii Galmeessi' : locale === 'ti' ? 'ወላዲ መዝግብ' : 'Register Parent')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReceptionRegisterParent;
