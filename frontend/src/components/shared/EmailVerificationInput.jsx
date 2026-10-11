import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';

/**
 * EmailVerificationInput
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable email + OTP verification widget.
 *
 * Props:
 *   value          {string}   — controlled email value
 *   onChange       {fn}       — (newEmail) => void  — called on every keystroke
 *   onVerified     {fn}       — (email) => void     — called once OTP is confirmed
 *   onUnverified   {fn?}      — () => void          — called if email is edited after verification
 *   disabled       {bool?}    — disable the whole widget
 *   inputClassName {string?}  — extra classes for the email <input>
 *   label          {string?}  — field label  (default "Email Address")
 *   required       {bool?}    — adds * to label
 *   placeholder    {string?}
 *
 * Usage:
 *   <EmailVerificationInput
 *     value={email}
 *     onChange={setEmail}
 *     onVerified={(email) => setIsEmailVerified(true)}
 *     onUnverified={() => setIsEmailVerified(false)}
 *     required
 *   />
 */
const EmailVerificationInput = ({
  value = '',
  onChange,
  onVerified,
  onUnverified,
  disabled = false,
  inputClassName = '',
  label = 'Email Address',
  required = false,
  placeholder = 'Enter email address',
}) => {
  const { locale } = useLanguage();
  const L = locale || 'en';
  const lx = (en, am, om, ti) => L === 'am' ? am : L === 'om' ? om : L === 'ti' ? ti : en;
  const [otpSent,       setOtpSent]       = useState(false);
  const [otpValue,      setOtpValue]      = useState('');
  const [verified,      setVerified]      = useState(false);
  const [sending,       setSending]       = useState(false);
  const [verifying,     setVerifying]     = useState(false);
  const [otpError,      setOtpError]      = useState('');
  const [countdown,     setCountdown]     = useState(0);
  const timerRef = useRef(null);
  const otpInputRef = useRef(null);

  // ── cleanup timer on unmount ───────────────────────────────────────────────
  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── auto-focus OTP input when it appears ──────────────────────────────────
  useEffect(() => {
    if (otpSent && otpInputRef.current) otpInputRef.current.focus();
  }, [otpSent]);

  const startCountdown = useCallback(() => {
    setCountdown(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const resetVerification = useCallback(() => {
    setOtpSent(false);
    setOtpValue('');
    setVerified(false);
    setOtpError('');
    clearInterval(timerRef.current);
    setCountdown(0);
    onUnverified?.();
  }, [onUnverified]);

  const handleEmailChange = useCallback((e) => {
    const newVal = e.target.value;
    onChange?.(newVal);
    if (verified || otpSent) resetVerification();
  }, [verified, otpSent, onChange, resetVerification]);

  const handleSendOtp = useCallback(async () => {
    const email = value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOtpError(lx('Please enter a valid email address.', 'ትክክለኛ ኢሜይል ያስገቡ።', 'Teessoo email sirrii galchi.', 'ቅኑዕ ኢ-መይል ኣቲ።'));
      return;
    }
    setOtpError('');
    setSending(true);
    try {
      console.log('Sending OTP to:', email);
      await api.post('/auth/send-otp', { email });
      setOtpSent(true);
      setOtpValue('');
      startCountdown();
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('already exists') || err.response?.status === 400) {
        setOtpError(lx('This email is already registered! Please use a different email or login.', 'ይህ ኢሜይል አስቀድሞ ተመዝግቧል! ሌላ ኢሜይል ይጠቀሙ ወይም ይግቡ።', 'Email kun duraan galmaameera! Email biraa fayyadami ykn seeni.', 'እዚ ኢ-መይል ድሮ ተመዝጊቡ ኣሎ! ካልእ ተጠቐም ወይ ኣቲ።'));
      } else {
        setOtpError(msg || lx('Failed to send OTP. Please try again.', 'OTP መላክ አልተቻለም። እንደገና ይሞክሩ።', 'OTP erguun hin danda\'amne. Irra deebi\'i yaali.', 'OTP ምስዳድ ኣይተኻእለን። ደጊምካ ፈትን።'));
      }
    } finally {
      setSending(false);
    }
  }, [value, startCountdown]);

  const handleVerifyOtp = useCallback(async () => {
    const email = value.trim();
    if (otpValue.length !== 6) { setOtpError(lx('Enter the 6-digit code sent to your email.', '6 ቁጥር ያለው ኮድ ያስገቡ።', 'Koodii lakkoobsa 6 galchi.', '6-ኣሃዝ ኮድ ኣቲ።')); return; }
    setOtpError('');
    setVerifying(true);
    try {
      await api.post('/auth/verify-otp', { email, otp: otpValue });
      setVerified(true);
      setOtpSent(false);
      clearInterval(timerRef.current);
      setCountdown(0);
      onVerified?.(email);
    } catch (err) {
      setOtpError(err.response?.data?.message || lx('Incorrect or expired code. Please try again.', 'ኮዱ ተሳስቷል ወይም ጊዜው አልፏል። እንደገና ይሞክሩ።', 'Koodiin dogoggoraa ykn yeroon isaa darbee jira. Irra deebi\'i yaali.', 'ኮድ ጌጉ ወይ ግዜ ሓሊፉ ኣሎ። ደጊምካ ፈትን።'));
      setOtpValue('');
      otpInputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }, [value, otpValue, onVerified]);

  // ── base input class (shared across both dashboards' style) ───────────────
  const baseInput = [
    'w-full rounded-xl border bg-white pl-9 pr-4 py-2.5 text-sm text-slate-800 outline-none transition',
    'placeholder:text-slate-400',
    'focus:border-[#005d68] focus:ring-2 focus:ring-[#005d68]/15',
    'dark:border-slate-700 dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500',
    'dark:focus:border-[#00B4D8]',
    inputClassName,
  ].join(' ');

  return (
    <div className="space-y-2">
      {/* ── Label ── */}
      {label && (
        <label className="block text-sm font-medium text-slate-600 dark:text-teal-400">
          {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
      )}

      {/* ── Email row ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <i className="bx bx-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
          <input
            type="email"
            value={value}
            onChange={handleEmailChange}
            disabled={disabled || verified}
            placeholder={placeholder}
            required={required}
            className={[
              baseInput,
              verified
                ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 cursor-not-allowed opacity-90'
                : 'border-slate-200',
            ].join(' ')}
          />
        </div>

        {/* Verified badge OR Send/Resend button */}
        {verified ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
            bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400
            text-xs font-bold border border-emerald-300 dark:border-emerald-700/40 whitespace-nowrap">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Verified ✓
          </span>
        ) : (
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={disabled || sending || countdown > 0}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
              bg-[#005d68] hover:bg-[#004d57] text-white text-xs font-bold
              transition-all shadow-sm hover:shadow-[0_4px_12px_rgba(0,93,104,0.35)]
              disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {sending ? (
              <><i className="bx bx-loader-alt animate-spin text-sm" /> {lx('Sending…', 'እየተላከ ነው…', 'Ergamaa jira…', 'ይስደድ ኣሎ…')}</>
            ) : countdown > 0 ? (
              <><i className="bx bx-time-five text-sm" /> {lx(`Resend (${countdown}s)`, `እንደገና ላክ (${countdown}ሴ)`, `Irra ergii (${countdown}s)`, `ደጊምካ ስደድ (${countdown}s)`)}</>
            ) : otpSent ? (
              <><i className="bx bx-refresh text-sm" /> {lx('Resend OTP', 'OTP እንደገና ላክ', 'OTP Irra Ergii', 'OTP ደጊምካ ስደድ')}</>
            ) : (
              <><i className="bx bx-shield-quarter text-sm" /> {lx('Verify Email', 'ኢሜይል አረጋግጥ', 'Email Mirkaneessi', 'ኢ-መይል ኣረጋግጽ')}</>
            )}
          </button>
        )}
      </div>

      {/* ── OTP input row — visible after OTP is sent ── */}
      {otpSent && !verified && (
        <div className="flex items-center gap-2 mt-1">
          <div className="relative flex-1 min-w-0">
            <i className="bx bx-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base pointer-events-none" />
            <input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpValue}
              onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyOtp(); } }}
              placeholder={lx('Enter 6-digit OTP', '6 ቁጥር ያለው ኮድ ያስገቡ', 'Koodii lakkoobsa 6 galchi', '6-ኣሃዝ ኮድ ኣቲ')}
              className={[
                baseInput,
                'tracking-[0.35em] font-mono border-[#005d68]/40',
                otpError ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-200' : '',
              ].join(' ')}
            />
          </div>
          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={verifying || otpValue.length !== 6}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
              bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold
              transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {verifying ? (
              <><i className="bx bx-loader-alt animate-spin text-sm" /> {lx('Checking…', 'እየተረጋገጠ ነው…', 'Mirkaneessaa…', 'ይረጋገጽ ኣሎ…')}</>
            ) : (
              <><i className="bx bx-check text-sm" /> {lx('Verify Code', 'ኮዱን አረጋግጥ', 'Koodii Mirkaneessi', 'ኮድ ኣረጋግጽ')}</>
            )}
          </button>
        </div>
      )}

      {/* ── Feedback messages ── */}
      {otpError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
          <i className="bx bx-error-circle text-sm" />{otpError}
        </p>
      )}
      {otpSent && !verified && !otpError && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <i className="bx bx-info-circle text-sm text-[#005d68]" />
          {lx('OTP sent to', 'OTP ተልኳል ወደ', 'OTP ergame gara', 'OTP ተሰዲዱ ናብ')} <strong className="text-slate-700 dark:text-slate-200">{value}</strong> — {lx('check your inbox & spam folder. Expires in 5 min.', 'ኢንቦክስዎን እና ስፓምን ይፈትሹ። በ5 ደቂቃ ያልፋል።', 'Saanduqa seeni. Daqiiqaa 5 booda darba.', 'ኢንቦክስካ ፈትሽ። ብ5 ደቓይቕ ይወድቕ።')}
        </p>
      )}
    </div>
  );
};

export default EmailVerificationInput;
