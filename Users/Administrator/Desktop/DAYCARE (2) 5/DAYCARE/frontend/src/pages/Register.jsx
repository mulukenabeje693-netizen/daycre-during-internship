import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/useLanguage';
import { useIdScanner } from '../hooks/useIdScanner';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import PasswordStrengthChecker, { validatePassword } from '../components/shared/PasswordStrengthChecker';
import { validatePhonePair } from '../utils/phoneValidation';
import { usePhoneAvailability } from '../hooks/usePhoneAvailability';

const GOOGLE_CLIENT_ID = '436667905909-jocqfvjm8q27n7kskctt1flb35glutv8.apps.googleusercontent.com';

const IDCardIllustration = ({ variant }) => {
  const isFront = variant === 'front';

  return (
    <svg viewBox="0 0 380 240" className="h-full w-full p-2">
      {/* The main card background (Portrait) */}
      <rect x="125" y="20" width="130" height="200" rx="8" className="fill-[var(--surface)] dark:fill-[var(--card-bg)]" />

      {/* Ethiopian ID Header (Cyan) */}
      <rect x="125" y="20" width="130" height="20" rx="8" className="fill-[var(--primary)]" />
      <rect x="125" y="30" width="130" height="10" className="fill-[var(--primary)]" />

      {isFront ? (
        <>
          {/* Header Text */}
          <rect x="145" y="45" width="90" height="4" rx="2" className="fill-[var(--primary)]" />

          {/* Photo area background */}
          <rect x="150" y="55" width="50" height="55" rx="4" className="fill-[var(--white)] dark:fill-[var(--surface)]" />
          {/* Head (circle) - accent color */}
          <circle cx="175" cy="72" r="12" className="fill-[var(--accent)]" />
          {/* Shoulders (semi-circle) */}
          <path d="M 160 110 C 160 95, 190 95, 190 110 Z" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* Text area - Name */}
          <rect x="135" y="120" width="40" height="3" rx="1.5" className="fill-[var(--border)] dark:fill-[var(--glass-border)]" />
          <rect x="135" y="125" width="70" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* Text area - DOB */}
          <rect x="135" y="135" width="30" height="3" rx="1.5" className="fill-[var(--border)] dark:fill-[var(--glass-border)]" />
          <rect x="135" y="140" width="60" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* Text area - Sex */}
          <rect x="135" y="150" width="20" height="3" rx="1.5" className="fill-[var(--border)] dark:fill-[var(--glass-border)]" />
          <rect x="135" y="155" width="40" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* Text area - Expiry */}
          <rect x="135" y="165" width="35" height="3" rx="1.5" className="fill-[var(--border)] dark:fill-[var(--glass-border)]" />
          <rect x="135" y="170" width="60" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* Vertical text on right */}
          <rect x="240" y="60" width="3" height="80" rx="1.5" className="fill-[var(--border)] dark:fill-[var(--glass-border)]" />

          {/* Barcode at bottom */}
          <g className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]">
            <rect x="145" y="185" width="3" height="15" rx="0.5" />
            <rect x="150" y="185" width="2" height="15" rx="0.5" />
            <rect x="154" y="185" width="4" height="15" rx="0.5" />
            <rect x="160" y="185" width="2" height="15" rx="0.5" />
            <rect x="164" y="185" width="3" height="15" rx="0.5" />
            <rect x="169" y="185" width="2" height="15" rx="0.5" />
            <rect x="173" y="185" width="4" height="15" rx="0.5" />
            <rect x="179" y="185" width="3" height="15" rx="0.5" />
            <rect x="184" y="185" width="2" height="15" rx="0.5" />
            <rect x="188" y="185" width="4" height="15" rx="0.5" />
            <rect x="194" y="185" width="2" height="15" rx="0.5" />
            <rect x="198" y="185" width="3" height="15" rx="0.5" />
            <rect x="203" y="185" width="4" height="15" rx="0.5" />
            <rect x="209" y="185" width="2" height="15" rx="0.5" />
            <rect x="213" y="185" width="3" height="15" rx="0.5" />
          </g>
        </>
      ) : (
        <>
          {/* Large QR Code Area */}
          <rect x="135" y="45" width="110" height="110" rx="4" className="fill-[var(--border)] dark:fill-[var(--card-bg)]" />
          {/* Inner QR patterns */}
          <g className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]">
            {/* Top left anchor */}
            <rect x="140" y="50" width="15" height="15" rx="2" />
            <rect x="143" y="53" width="9" height="9" className="fill-[var(--muted-2)] dark:fill-[var(--muted-2)]" />
            <rect x="145" y="55" width="5" height="5" />

            {/* Top right anchor */}
            <rect x="225" y="50" width="15" height="15" rx="2" />
            <rect x="228" y="53" width="9" height="9" className="fill-[var(--muted-2)] dark:fill-[var(--muted-2)]" />
            <rect x="230" y="55" width="5" height="5" />

            {/* Bottom left anchor */}
            <rect x="140" y="135" width="15" height="15" rx="2" />
            <rect x="143" y="138" width="9" height="9" className="fill-[var(--muted-2)] dark:fill-[var(--muted-2)]" />
            <rect x="145" y="140" width="5" height="5" />

            {/* Random dots in QR */}
            <rect x="160" y="50" width="60" height="15" opacity="0.4" />
            <rect x="140" y="70" width="100" height="60" opacity="0.4" />
            <rect x="160" y="135" width="60" height="15" opacity="0.4" />
            <rect x="225" y="135" width="15" height="15" opacity="0.4" />
          </g>

          {/* Text area - Phone */}
          <rect x="135" y="165" width="30" height="3" rx="1.5" className="fill-[var(--muted-2)] dark:fill-[var(--muted-2)]" />
          <rect x="135" y="170" width="50" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* Text area - Nationality */}
          <rect x="135" y="180" width="25" height="3" rx="1.5" className="fill-[var(--muted-2)] dark:fill-[var(--muted-2)]" />
          <rect x="135" y="185" width="40" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* Text area - Address */}
          <rect x="135" y="195" width="20" height="3" rx="1.5" className="fill-[var(--muted-2)] dark:fill-[var(--muted-2)]" />
          <rect x="135" y="200" width="50" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />

          {/* FIN Text right */}
          <rect x="200" y="170" width="45" height="4" rx="2" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" />
        </>
      )}

      {/* Corner brackets (dark blue) for portrait layout */}
      <g strokeWidth="10" fill="none" strokeLinecap="square" strokeLinejoin="miter" className="stroke-[var(--primary-dark)] dark:stroke-[var(--primary-light)]">
        {/* Top left */}
        <polyline points="135,10 115,10 115,30" />
        {/* Top right */}
        <polyline points="245,10 265,10 265,30" />
        {/* Bottom left */}
        <polyline points="135,230 115,230 115,210" />
        {/* Bottom right */}
        <polyline points="245,230 265,230 265,210" />
      </g>
    </svg>
  );
};

const Register = () => {
  const { signup, googleLogin, user, redirectUser } = useAuth();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { isModelsLoaded, isAnalyzing, validateFrontId, validateBackId, clearError } = useIdScanner();

  // Theme state â€” sync with login-theme key, default dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('login-theme') || 'dark';
  });

  const isDark = theme === 'dark';
  const colors = {
    cardBg: isDark ? '#0c1a1f' : '#ffffff',
    cardBorder: isDark ? 'rgba(45, 212, 191, 0.12)' : 'rgba(0,0,0,0.08)',
    leftGlassBg: isDark ? 'rgba(6, 26, 33, 0.35)' : 'rgba(255, 255, 255, 0.65)',
    leftBorder: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    leftText: isDark ? '#ffffff' : '#1f2937',
    textMain: isDark ? '#F5FAFA' : '#111827',
    textMuted: isDark ? '#8EA5AA' : '#6b7280',
    inputBg: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb',
    inputBgEmerg: isDark ? 'rgba(0,0,0,0.25)' : '#f3f4f6',
    inputBorder: isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(20, 184, 166, 0.4)',
    inputBorderEmerg: isDark ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.3)',
    inputText: isDark ? '#F5FAFA' : '#1f2937',
    divider: isDark ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.1)',
    googleBtnBg: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff',
  };

  // Locale-aware validation messages
  const msgs = {
    invalidEmail: {
      en: 'Please enter a valid email address first.',
      am: 'ትክክለኛ ኢሜይል አድራሻ ያስገቡ። (Please enter a valid email address)',
      om: 'Teessoo email sirrii galchi.',
      ti: 'á‰…áŠ‘á‹• áŠ¢-áˆ˜á‹­áˆ áŠ¨á‰° áŠ£á‰²áŠ¹ á¢',
    },
    emailExists: {
      en: 'This email is already registered! Please use a different email or login.',
      am: 'ይህ ኢሜይል አስቀድሞ ተመዝግቧል! ሌላ ኢሜይል ይጠቀሙ ወይም ይግቡ። (Email already exists)',
      om: 'Email kun duraan galmaameera! Email biraa fayyadami ykn seeni.',
      ti: 'áŠ¥á‹š áŠ¢-áˆ˜á‹­áˆ á‹µáˆ® á‰°áˆ˜á‹áŒŠá‰¡ áŠ£áˆŽ! áŠ«áˆáŠ¥ áŠ¢-áˆ˜á‹­áˆ á‰°áŒ á‰áˆ á‹ˆá‹­ áŠ£á‰²á¢',
    },
    otpSent: {
      en: 'Verification code sent to your email! Check your inbox.',
      am: 'የማረጋገጫ ኮድ ወደ ኢሜይልዎ ተልኳል! ኢንቦክስዎን ይፈትሹ። (Verification code sent)',
      om: 'Koodii mirkaneessaa gara email keetti ergame! Saanduqa seeni.',
      ti: 'áŠ®á‹µ áˆáˆ­áŒáŒ‹áŒ½ áŠ“á‰¥ áŠ¢-áˆ˜á‹­áˆáŠ« á‰°áˆ°á‹²á‹±! áŠ¢áŠ•á‰¦áŠ­áˆµáŠ« áˆ­áŠ á¢',
    },
    invalidOtp: {
      en: 'Please enter the 6-digit code.',
      am: '6 አሃዝ ያለው ኮድ ያስገቡ። (Please enter the 6-digit code)',
      om: 'Lakkoofsa lakkoobsa 6 galchi.',
      ti: '6-áŠ£áˆƒá‹ áŠ®á‹µ áŠ£á‰²á¢',
    },
    invalidPhone: {
      en: 'Invalid Ethiopian phone number. Must start with +2519, +2517, 09, or 07 followed by 8 digits.',
      am: 'ልክ ያልሆነ የኢትዮጵያ ስልክ ቁጥር። +2519፣ +2517፣ 09 ወይ 07 ይጀምሩ። (Invalid Ethiopian phone)',
      om: 'Lakkoofsa bilbilaa Itoophiyaa sirrii miti. +2519, +2517, 09, ykn 07 waliin eegali.',
      ti: 'á‰áŒ½áˆª áˆµáˆáŠª áŠ¢á‰µá‹®áŒµá‹« á‰…áŠ‘á‹• áŠ£á‹­áŠ®áŠáŠ•á¢ á‰¥+2519á£ +2517á£ 09á£ á‹ˆá‹­ 07 áŒ€áˆáˆ­á¢',
    },
    phoneTaken: {
      en: 'This phone number is already registered! Please use a different number.',
      am: 'ይህ የስልክ ቁጥር አስቀድሞ ተመዝግቧል! ሌላ ቁጥር ይጠቀሙ።',
      om: 'Lakkoofsi bilbilaa kun duraan galmaameera! Lakkoofsa biraa fayyadami.',
      ti: 'áŠ«á‰¥ á‰áŒ½áˆª áˆµáˆáŠª á‹µáˆ® á‰°áˆ˜á‹áŒŠá‰¡ áŠ£áˆŽ! áŠ«áˆáŠ¥ á‰áŒ½áˆª á‰°áŒ á‰áˆá¢',
    },
  };
  const m = (key) => msgs[key][locale] || msgs[key]['en'];


  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [idFrontPreview, setIdFrontPreview] = useState('');
  const [idBackPreview, setIdBackPreview] = useState('');
  const [idFrontName, setIdFrontName] = useState('');
  const [idBackName, setIdBackName] = useState('');
  const idFrontFileRef = useRef(null); // stores the actual File/Blob for upload
  const idBackFileRef = useRef(null);

  // Emergency contact state
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [phoneErrors, setPhoneErrors] = useState({ phone: '', emergencyContactPhone: '' });

  // Scanning States
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [activeIdSide, setActiveIdSide] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState({ lighting: false, position: false, clearness: false });

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, width: '0%', color: 'var(--muted-2)' });
  const [legalModal, setLegalModal] = useState(null);

  // Email OTP verification states
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendTimerRef = useRef(null);

  // Sync theme changes with DOM
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('login-theme', theme);
  }, [theme]);

  // If already logged in, redirect user directly
  useEffect(() => {
    if (user) {
      redirectUser(user.role);
    }
  }, [user, redirectUser]);

  // Monitor password changes to calculate strength
  useEffect(() => {
    calculatePasswordStrength(password);
  }, [password]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // â”€â”€ Email OTP helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Reset verification whenever the user edits the email field
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (isEmailVerified || otpSent) {
      setIsEmailVerified(false);
      setOtpSent(false);
      setOtpValue('');
      setOtpError('');
      setOtpSuccess('');
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      setResendCountdown(0);
    }
  };

  // Phone change helpers â€” re-run pair validation on every keystroke
  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    const { primaryError, emergencyError } = validatePhonePair(val, emergencyContactPhone);
    setPhoneErrors({ phone: primaryError, emergencyContactPhone: emergencyError });
  };

  const handleEmergencyPhoneChange = (e) => {
    const val = e.target.value;
    setEmergencyContactPhone(val);
    const { primaryError, emergencyError } = validatePhonePair(phone, val);
    setPhoneErrors({ phone: primaryError, emergencyContactPhone: emergencyError });
  };

  const hasPhoneError = !!(phoneErrors.phone || phoneErrors.emergencyContactPhone);

  // System-wide uniqueness checks (debounced â€” fires only after format passes)
  const { checking: checkingPhone, takenError: phoneTaken } = usePhoneAvailability(phone, phoneErrors.phone);
  const { checking: checkingEmerg, takenError: emergTaken } = usePhoneAvailability(emergencyContactPhone, phoneErrors.emergencyContactPhone);

  const displayPhoneError = (phoneErrors.phone ? m('invalidPhone') : '') || (phoneTaken ? m('phoneTaken') : '');
  const displayEmergError = (phoneErrors.emergencyContactPhone ? m('invalidPhone') : '') || (emergTaken ? m('phoneTaken') : '');
  const hasAnyPhoneError = !!(displayPhoneError || displayEmergError || checkingPhone || checkingEmerg);

  const startResendCountdown = () => {
    setResendCountdown(60);
    resendTimerRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(resendTimerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setOtpError(m('invalidEmail'));
      return;
    }
    setOtpError('');
    setOtpSuccess('');
    setOtpLoading(true);
    try {
      await api.post('/auth/send-otp', { email: trimmed });
      setOtpSent(true);
      setOtpSuccess(m('otpSent'));
      startResendCountdown();
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('already exists') || err.response?.status === 409 || err.response?.status === 400) {
        setOtpError(m('emailExists'));
      } else {
        setOtpError(msg || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) { setOtpError(m('invalidOtp')); return; }
    setOtpError('');
    setOtpLoading(true);
    try {
      await api.post('/auth/verify-otp', { email: email.trim(), otp: otpValue });
      setIsEmailVerified(true);
      setOtpSent(false);
      setOtpSuccess('');
      setOtpError('');
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      setResendCountdown(0);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current); }, []);

  const openScanMethod = (side) => {
    setActiveIdSide(side);
    setShowOptionsModal(true);
  };

  const handleIdUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file for your ID.');
      return;
    }

    setShowOptionsModal(false);
    clearError();

    const validation = activeIdSide === 'front'
      ? await validateFrontId(file)
      : await validateBackId(file);

    if (!validation.success) {
      setErrorMsg(`ID validation failed: ${validation.message}`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    if (activeIdSide === 'front') {
      if (idFrontPreview?.startsWith('blob:')) URL.revokeObjectURL(idFrontPreview);
      setIdFrontPreview(previewUrl);
      setIdFrontName(file.name);
      idFrontFileRef.current = file;
      setSuccessMsg('Front of ID verified. Choose how to verify the back.');
      openScanMethod('back');
    } else {
      if (idBackPreview?.startsWith('blob:')) URL.revokeObjectURL(idBackPreview);
      setIdBackPreview(previewUrl);
      setIdBackName(file.name);
      idBackFileRef.current = file;
      setSuccessMsg('Both sides of your ID have been verified.');
    }
  }, [idFrontPreview, idBackPreview, activeIdSide, validateFrontId, validateBackId, clearError]);

  const startCamera = async (side = activeIdSide) => {
    setActiveIdSide(side);
    setShowOptionsModal(false);
    setShowCameraModal(true);
    setErrorMsg('');
    setIsAutoScanning(true);
    setScanStatus({ lighting: false, position: false, clearness: false });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMsg('âš ï¸ Unable to access camera. Please check permissions.');
      setShowCameraModal(false);
      setIsAutoScanning(false);
    }
  };

  const stopCamera = () => {
    setIsAutoScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCameraModal(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        stopCamera();
        clearError();

        const validation = activeIdSide === 'front'
          ? await validateFrontId(blob)
          : await validateBackId(blob);

        if (!validation.success) {
          setErrorMsg(`âš ï¸ ID Validation Failed: ${validation.message}`);
          return;
        }

        const previewUrl = URL.createObjectURL(blob);
        const fileName = `camera_capture_${new Date().getTime()}.jpg`;

        if (activeIdSide === 'front') {
          if (idFrontPreview?.startsWith('blob:')) URL.revokeObjectURL(idFrontPreview);
          setIdFrontPreview(previewUrl);
          setIdFrontName(fileName);
          idFrontFileRef.current = new File([blob], fileName, { type: 'image/jpeg' });
          setSuccessMsg('Front of ID verified. Choose how to verify the back.');
          openScanMethod('back');
        } else {
          if (idBackPreview?.startsWith('blob:')) URL.revokeObjectURL(idBackPreview);
          setIdBackPreview(previewUrl);
          setIdBackName(fileName);
          idBackFileRef.current = new File([blob], fileName, { type: 'image/jpeg' });
          setSuccessMsg('Both sides of your ID have been verified.');
        }
      }, 'image/jpeg', 0.9);
    }
  };

  useEffect(() => {
    if (!isAutoScanning || !showCameraModal || !isModelsLoaded) return;

    const performAutoScan = async () => {
      if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Calculate lighting brightness
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let colorSum = 0;
      let count = 0;
      for (let x = 0; x < data.length; x += 16) {
        colorSum += (data[x] + data[x + 1] + data[x + 2]) / 3;
        count++;
      }
      let brightness = Math.floor(colorSum / count);
      const isLightingGood = brightness > 50 && brightness < 240;

      setScanStatus(prev => ({ ...prev, lighting: isLightingGood }));

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // Use silent=true to not trigger the full overlay
        const validation = activeIdSide === 'front'
          ? await validateFrontId(blob, true)
          : await validateBackId(blob, true);

        if (validation.success) {
          // Success! Update UI
          setScanStatus(prev => ({ ...prev, position: true, clearness: true }));

          setTimeout(() => {
            stopCamera();
            clearError();

            const previewUrl = URL.createObjectURL(blob);
            const fileName = `auto_scan_${new Date().getTime()}.jpg`;

            if (activeIdSide === 'front') {
              if (idFrontPreview?.startsWith('blob:')) URL.revokeObjectURL(idFrontPreview);
              setIdFrontPreview(previewUrl);
              setIdFrontName(fileName);
              idFrontFileRef.current = new File([blob], fileName, { type: 'image/jpeg' });
              setSuccessMsg('Front of ID verified. Choose how to verify the back.');
              openScanMethod('back');
            } else {
              if (idBackPreview?.startsWith('blob:')) URL.revokeObjectURL(idBackPreview);
              setIdBackPreview(previewUrl);
              setIdBackName(fileName);
              idBackFileRef.current = new File([blob], fileName, { type: 'image/jpeg' });
              setSuccessMsg('Both sides of your ID have been verified.');
            }
          }, 800); // 800ms delay to show the green checkmarks before closing
        } else {
          setScanStatus(prev => ({ ...prev, position: false, clearness: false }));
        }
      }, 'image/jpeg', 0.8);
    };

    scanIntervalRef.current = setInterval(performAutoScan, 2000); // Check every 2 seconds to save performance

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isAutoScanning, showCameraModal, isModelsLoaded, activeIdSide, validateFrontId, validateBackId, clearError, idFrontPreview, idBackPreview]);

  const startPremiumVerification = () => {
    setErrorMsg('');
    setSuccessMsg('');
    openScanMethod('front');
  };

  useEffect(() => {
    return () => {
      if (idFrontPreview?.startsWith('blob:')) URL.revokeObjectURL(idFrontPreview);
      if (idBackPreview?.startsWith('blob:')) URL.revokeObjectURL(idBackPreview);
    };
  }, [idFrontPreview, idBackPreview]);

  // Callback that handles the credential returned by Google
  const handleGoogleCredential = async (response) => {
    if (response.credential) {
      const result = await googleLogin(response.credential);
      if (!result.success) {
        setErrorMsg(result.message || 'Google sign-in failed.');
      }
    } else {
      setErrorMsg('Google sign-in was cancelled.');
    }
    setIsGoogleLoading(false);
  };

  // Initialize GIS and render the real Google button into our hidden ref div
  useEffect(() => {
    const tryRender = () => {
      if (window.google && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          cancel_on_tap_outside: false,
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          size: 'large',
          text: 'signup_with',
          shape: 'rectangular',
          width: 320,
        });
      } else {
        setTimeout(tryRender, 300);
      }
    };
    tryRender();
  }, []);

  const handleGoogleLogin = () => {
    setErrorMsg('');
    if (!window.google) {
      setErrorMsg('Google Sign-In is not loaded yet. Please refresh the page.');
      return;
    }
    setIsGoogleLoading(true);
    // Click the hidden Google-rendered button â€” opens Google's real account chooser popup
    const btn = googleBtnRef.current?.querySelector('div[role="button"], button');
    if (btn) {
      btn.click();
    } else {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setErrorMsg('Google sign-in unavailable. Please refresh the page and try again.');
          setIsGoogleLoading(false);
        }
      });
    }
  };

  const calculatePasswordStrength = (val) => {
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const colors = ['var(--danger)', 'var(--warning)', 'var(--warning)', 'var(--success)', 'var(--success)'];
    const widths = ['20%', '40%', '60%', '80%', '100%'];

    setPasswordStrength({
      score,
      width: widths[score - 1] || '0%',
      color: colors[score - 1] || 'var(--muted-2)'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg('âš ï¸ All required fields (*) must be filled.');
      return;
    }

    if (!emailPattern.test(email)) {
      setErrorMsg('âš ï¸ Email must be a valid email address (e.g., name@example.com).');
      return;
    }

    if (!isEmailVerified) {
      setErrorMsg('âš ï¸ Please verify your email address before creating your account.');
      return;
    }

    // Phone pair validation (primary + emergency, format + duplicate check)
    const { primaryError, emergencyError } = validatePhonePair(phone, emergencyContactPhone);
    if (primaryError || emergencyError) {
      setPhoneErrors({ phone: primaryError, emergencyContactPhone: emergencyError });
      setErrorMsg('âš ï¸ Please fix the phone number errors before submitting.');
      return;
    }

    // Block if a uniqueness check is still in-flight or failed
    if (hasAnyPhoneError) {
      setErrorMsg('âš ï¸ Please fix the phone number errors before submitting.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('âš ï¸ Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('âš ï¸ Passwords do not match.');
      return;
    }

    // Strict 5-rule password check
    const pwdErr = validatePassword(password);
    if (pwdErr) { setErrorMsg(`âš ï¸ ${pwdErr}`); return; }
    if (!agree) {
      setErrorMsg('âš ï¸ Please agree to the terms to continue.');
      return;
    }

    // ID verification is required â€” both front and back must be uploaded and validated
    if (!idFrontFileRef.current || !idBackFileRef.current) {
      setErrorMsg('âš ï¸ ID verification is required. Please complete the Premium ID Verification step (both front and back sides) before creating your account.');
      return;
    }

    setIsSubmitting(true);
    const result = await signup(fullName, email, phone, organization, password, idFrontFileRef.current, idBackFileRef.current, {
      name: emergencyContactName,
      phone: emergencyContactPhone,
      relationship: emergencyContactRelationship,
    });
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg('✅ Account created successfully! Logging you in...');
      setTimeout(() => {
        navigate('/dashboard/parent');
      }, 1500);
    } else {
      setErrorMsg(`❌ ${result.message}`);
    }
  };

  return (
    <>
      <div className="min-h-screen w-full max-w-full relative flex items-center justify-center px-2 sm:px-4 py-6 sm:py-8 overflow-x-hidden">
        {/* Full screen background */}
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${theme === 'dark' ? '/assets/optimized/darkmode.webp' : '/assets/optimized/registerz.webp'}')`, filter: isDark ? 'brightness(0.65)' : 'none' }} />

        {/* OVERLAPPING CARD CONTAINER */}
        <div className="relative z-10 flex items-stretch justify-center w-full max-w-[1020px] px-1 sm:px-4">

          {/* LEFT PANEL - Glass (Slightly shorter, sits behind right panel) */}
          <div className="hidden lg:flex flex-col items-center justify-center relative z-10 w-full max-w-[420px] rounded-l-[32px] p-8 text-center my-6"
            style={{
              background: colors.leftGlassBg,
              border: `1px solid ${colors.leftBorder}`,
              borderLeft: '1px solid rgba(130, 240, 255, 0.25)',
              borderTop: '1px solid rgba(130, 240, 255, 0.25)',
              boxShadow: 'inset 2px 2px 10px rgba(130, 240, 255, 0.05)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0.1) 85%, rgba(0, 0, 0, 0) 100%)',
              maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0.1) 85%, rgba(0, 0, 0, 0) 100%)',
              marginRight: '-40px', /* Pull it exactly under the right panel */
            }}>

            <div className="w-[100px] h-[100px] mx-auto mb-6 rounded-[24px] overflow-hidden border border-teal-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative z-10" style={{ background: isDark ? '#0a1d24' : '#ffffff' }}>
              <img src="/assets/optimized/icon.webp" alt="DaycareHQ" className="w-full h-full object-contain p-2" />
            </div>

            <h1 className="font-black text-[28px] leading-[1.3] mb-4 relative z-10" style={{ color: colors.leftText }}>
              {locale === 'en' ? 'Welcome to Daycare' :
                locale === 'am' ? 'እንኳን ወደ Daycare' :
                  locale === 'om' ? 'Baga nagaan dhuftan Daycare' : 'እንቋዕ ብደሓን መጻእኩም Daycare'}<br />
              <span style={{ color: isDark ? '#D9B84A' : '#b4952d' }}>
                {locale === 'en' ? '' :
                  locale === 'am' ? 'በደህና መጡ!' :
                    locale === 'om' ? '' : 'ብደሓን መጻእኩም!'}
              </span>
            </h1>

            <p className="text-[12px] leading-[1.8] mb-8 relative z-10 px-2" style={{ color: colors.leftText }}>
              {locale === 'en' ? 'Register to manage your child\'s daycare and activities.' :
                locale === 'am' ? 'የልጅዎን መዋዕለ ለማስተዳደር እና ምርመራን አሰላሰት ለማሻሻት እባክዎን ይመዝገቡ።' :
                  locale === 'om' ? 'Daa\'ima keessan bulchuuf galmaa\'aa.' :
                    'ውሉድኩም ንምምሕዳር ተመዝገቡ።'}
            </p>

            <div className="flex items-center gap-4 relative z-10 opacity-70 w-[60%] mx-auto">
              <div className="flex-1 h-[1px]" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
              <i className="bx bxs-leaf text-base" style={{ color: isDark ? '#D9B84A' : '#b4952d' }} />
              <div className="flex-1 h-[1px]" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            </div>
          </div>

          {/* RIGHT PANEL - Form Container (Taller, overlaps left panel) */}
          <div className="flex-1 w-full max-w-[520px] px-4 sm:px-8 py-6 sm:py-8 relative z-20 rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}` }}>

            {/* Alerts */}
            {(errorMsg || successMsg) && (
              <div className="mb-5">
                {errorMsg && <div className="p-3 mb-2 rounded-xl text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>{errorMsg}</div>}
                {successMsg && <div className="p-3 rounded-xl text-xs font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>{successMsg}</div>}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Row 1: Full Name + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] font-bold mb-1.5" style={{ color: colors.textMain }}>{t('fullName')}</label>
                  <div className="relative">
                    <i className="bx bx-user absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: colors.textMuted }} />
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
                      placeholder={t('fullNamePlaceholder')}
                      className="w-full pl-9 pr-3 py-2.5 text-[11px] rounded-[12px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, color: colors.textMain }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1.5" style={{ color: colors.textMain }}>{t('phoneNumber')}</label>
                  <div className="relative">
                    <i className="bx bx-phone absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: colors.textMuted }} />
                    <input type="tel" value={phone} onChange={handlePhoneChange}
                      placeholder={t('phonePlaceholder')}
                      className="w-full pl-9 pr-3 py-2.5 text-[11px] rounded-[12px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBg, border: `1px solid ${displayPhoneError ? '#ef4444' : colors.inputBorder}`, color: colors.textMain }} />
                  </div>
                  {/* Format or duplicate error */}
                  {(displayPhoneError || checkingPhone) && (
                    <p className="flex items-center gap-1 text-[10px] mt-1">
                      {checkingPhone
                        ? <><i className="bx bx-loader-alt animate-spin text-[11px]" style={{ color: '#8EA5AA' }} /><span style={{ color: '#8EA5AA' }}>Checking…</span></>
                        : <><i className="bx bx-error-circle text-[11px]" style={{ color: '#ef4444' }} /><span style={{ color: '#ef4444' }}>{displayPhoneError}</span></>
                      }
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Email + Organization */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 sm:flex-[3] min-w-0">
                  <label className="block text-[11px] font-bold mb-1.5" style={{ color: colors.textMain }}>{t('emailLabel')} <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <i className="bx bx-envelope absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: colors.textMuted }} />
                      <input type="email" value={email} onChange={handleEmailChange} disabled={isEmailVerified} required
                        placeholder={t('emailPlaceholder')}
                        className="w-full pl-9 pr-3 py-2.5 text-[11px] rounded-[12px] outline-none transition-all focus:border-teal-400"
                        style={{ background: isEmailVerified ? 'rgba(16,185,129,0.08)' : colors.inputBg, border: `1px solid `, color: colors.textMain }} />
                    </div>
                    {isEmailVerified ? (
                      <span className="shrink-0 flex items-center px-2.5 rounded-[12px] text-[10px] font-bold whitespace-nowrap"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid #059669' }}>✓ Verified</span>
                    ) : (
                      <button type="button" onClick={handleSendOtp}
                        disabled={otpLoading || resendCountdown > 0}
                        className="shrink-0 px-3 py-2 rounded-[12px] text-[10px] font-bold whitespace-nowrap disabled:opacity-50 transition hover:opacity-90"
                        style={{ background: '#0d9488', color: '#fff' }}>
                        {otpLoading && !otpSent ? '…' : otpSent && resendCountdown > 0 ? `${resendCountdown}s` : otpSent ? 'Resend' : 'Verify Email'}
                      </button>
                    )}
                  </div>
                  {otpSent && !isEmailVerified && (
                    <div className="flex gap-1.5 mt-1.5">
                      <input type="text" inputMode="numeric" maxLength={6} value={otpValue}
                        onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                        placeholder="6-digit OTP"
                        className="flex-1 px-3 py-2 text-[11px] rounded-[12px] outline-none tracking-widest font-mono"
                        style={{ background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, color: colors.textMain }} />
                      <button type="button" onClick={handleVerifyOtp}
                        disabled={otpLoading || otpValue.length !== 6}
                        className="px-3 py-2 rounded-[12px] text-[10px] font-bold disabled:opacity-50"
                        style={{ background: '#059669', color: '#fff' }}>{otpLoading ? '…' : 'OK'}</button>
                    </div>
                  )}
                  {otpError && <p className="flex items-center gap-1 text-[10px] mt-1"><i className="bx bx-error-circle text-[11px]" style={{ color: '#ef4444' }} /><span style={{ color: '#ef4444' }}>{otpError}</span></p>}
                  {otpSuccess && !isEmailVerified && <p className="flex items-center gap-1 text-[10px] mt-1"><i className="bx bx-check-circle text-[11px]" style={{ color: '#6ee7b7' }} /><span style={{ color: '#6ee7b7' }}>{otpSuccess}</span></p>}
                </div>
                <div className="flex-1 sm:flex-[1] min-w-0">
                  <label className="block text-[11px] font-bold mb-1.5" style={{ color: colors.textMain }}>{t('organization')}</label>
                  <div className="relative">
                    <i className="bx bx-building absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: colors.textMuted }} />
                    <input type="text" value={organization} onChange={e => setOrganization(e.target.value)}
                      placeholder={t('organization')}
                      className="w-full pl-9 pr-3 py-2.5 text-[11px] rounded-[12px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, color: colors.textMain }} />
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color: isDark ? '#00d8d6' : '#111827' }}>{t('contactName') || 'Emergency Name'}</label>
                  <div className="relative">
                    <i className="bx bx-user absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: colors.textMuted }} />
                    <input type="text" value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)}
                      placeholder={locale === 'am' ? 'ለምሳሌ: ሳራ' : 'e.g. Sara'}
                      className="w-full pl-8 pr-2 py-2 text-[10px] rounded-[10px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBgEmerg, border: `1px solid ${colors.inputBorderEmerg}`, color: colors.textMain }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color: isDark ? '#00d8d6' : '#111827' }}>{t('contactPhone') || 'Emergency Phone'}</label>
                  <div className="relative">
                    <i className="bx bx-phone absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: colors.textMuted }} />
                    <input type="tel" value={emergencyContactPhone} onChange={handleEmergencyPhoneChange}
                      placeholder={locale === 'am' ? 'ለምሳሌ: 0777...' : 'e.g. 0777...'}
                      className="w-full pl-8 pr-2 py-2 text-[10px] rounded-[10px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBgEmerg, border: `1px solid ${displayEmergError ? '#ef4444' : colors.inputBorderEmerg}`, color: colors.textMain }} />
                  </div>
                  {(displayEmergError || checkingEmerg) && (
                    <p className="flex items-center gap-1 text-[10px] mt-1">
                      {checkingEmerg
                        ? <><i className="bx bx-loader-alt animate-spin text-[11px]" style={{ color: '#8EA5AA' }} /><span style={{ color: '#8EA5AA' }}>Checking…</span></>
                        : <><i className="bx bx-error-circle text-[11px]" style={{ color: '#ef4444' }} /><span style={{ color: '#ef4444' }}>{displayEmergError}</span></>
                      }
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color: isDark ? '#00d8d6' : '#111827' }}>{t('relationshipLabel') || 'Relationship'}</label>
                  <div className="relative">
                    <i className="bx bx-group absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: colors.textMuted }} />
                    <input type="text" value={emergencyContactRelationship} onChange={e => setEmergencyContactRelationship(e.target.value)}
                      placeholder={locale === 'am' ? 'እናት, አባት...' : 'Mother, Father...'}
                      className="w-full pl-8 pr-2 py-2 text-[10px] rounded-[10px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBgEmerg, border: `1px solid ${colors.inputBorderEmerg}`, color: colors.textMain }} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 rounded-[14px]" style={{ background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(13,148,136,0.05)', border: '1px solid rgba(20, 184, 166, 0.15)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#0d9488' }}>
                  <i className="bx bx-crown text-white text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold" style={{ color: '#14b8a6' }}>{t('idVerification') || 'Premium ID Verification'}</p>
                  <p className="text-[10px]" style={{ color: colors.textMuted }}>{locale === 'am' ? 'መለያዎን በፈገግታ እና በማንነት ማረጋገጫ ያስጠብቁ።' : 'Secure your account with face and identity verification.'}</p>
                  {(idFrontPreview || idBackPreview) && (
                    <p className="text-[10px] mt-0.5" style={{ color: idFrontPreview && idBackPreview ? '#6ee7b7' : (isDark ? '#D9B84A' : '#b4952d') }}>
                      {idFrontPreview && idBackPreview ? '✓ Both sides verified' : '⚠️ Front uploaded — upload back side'}
                    </p>
                  )}
                </div>
                <button type="button" onClick={startPremiumVerification}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[11px] font-bold hover:opacity-90 transition"
                  style={{ background: '#00d8d6', color: '#001A1A' }}>
                  <i className="bx bx-scan text-sm font-bold" />
                  {idFrontPreview && !idBackPreview ? (locale === 'am' ? 'ቀጥል →' : 'Continue →') : (locale === 'am' ? 'ጀምር →' : 'Start →')}
                </button>
              </div>

              {/* Password Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold mb-1.5" style={{ color: colors.textMain }}>{t('passwordLabel')} <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="relative">
                    <i className="bx bx-lock-alt absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: colors.textMuted }} />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••"
                      className="w-full pl-9 pr-8 py-2.5 text-[11px] rounded-[12px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, color: colors.textMain }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
                      <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-[13px]`} />
                    </button>
                  </div>
                  <PasswordStrengthChecker password={password} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1.5" style={{ color: colors.textMain }}>{locale === 'am' ? 'የይለፍ ቃል አረጋግጥ' : 'Confirm Password'} <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="relative">
                    <i className="bx bx-lock-alt absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: colors.textMuted }} />
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                      placeholder="••••••••"
                      className="w-full pl-9 pr-8 py-2.5 text-[11px] rounded-[12px] outline-none transition-all focus:border-teal-400"
                      style={{ background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, color: colors.textMain }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
                      <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-[13px]`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2 pt-1">
                <input type="checkbox" id="agree" checked={agree} onChange={e => setAgree(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 cursor-pointer" style={{ accentColor: '#0d9488' }} />
                <label htmlFor="agree" className="text-[10px] leading-relaxed cursor-pointer" style={{ color: colors.textMuted }}>
                  {locale === 'am' ? 'እኔ እስማማለሁ በ ' : 'I agree to the '}
                  <button type="button" onClick={() => setLegalModal('terms')} className="font-bold hover:underline" style={{ color: '#14b8a6' }}>{t('termsOfService')}</button>
                  {locale === 'am' ? ' እና ' : ' and '}
                  <button type="button" onClick={() => setLegalModal('privacy')} className="font-bold hover:underline" style={{ color: '#14b8a6' }}>{t('privacyPolicy')}</button>
                  {locale === 'am' ? ' እንዲሁም ሁሉም መረጃ ትክክለኛ መሆኑን አረጋግጣለሁ።' : ' and confirm that all information provided is accurate and truthful.'}
                </label>
              </div>

              {/* Create Account Button - Full Width */}
              <button type="submit" disabled={isSubmitting || hasAnyPhoneError}
                className="w-full py-3 text-[13px] font-black rounded-full flex items-center justify-center gap-2 transition disabled:opacity-50 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff', boxShadow: '0 4px 20px rgba(13, 148, 136, 0.3)' }}>
                {isSubmitting ? t('creatingAccount') : t('createAccountBtn')}
                <i className="bx bx-right-arrow-alt text-base" />
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[1px]" style={{ background: colors.divider }} />
                <span className="text-[10px]" style={{ color: colors.textMuted }}>{t('orContinueWith')}</span>
                <div className="flex-1 h-[1px]" style={{ background: colors.divider }} />
              </div>

              {/* Google Button with transparent GIS overlay */}
              <div className="relative w-full overflow-hidden rounded-[12px]">
                <div
                  ref={googleBtnRef}
                  className="absolute inset-0 z-10 flex items-center justify-center opacity-[0.0001] cursor-pointer overflow-hidden"
                  style={{ transform: 'scale(1.2)' }}
                />
                <button type="button" onClick={handleGoogleLogin} disabled={isGoogleLoading}
                  className={`w-full py-2.5 text-[11px] font-bold rounded-[12px] flex items-center justify-center gap-2 transition ${isDark ? 'hover:bg-[#112328]' : 'hover:bg-gray-50'}`}
                  style={{ background: colors.googleBtnBg, border: `1px solid ${colors.divider}`, color: colors.textMain }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  {isGoogleLoading ? t('signingIn') : t('continueWithGoogle')}
                </button>
              </div>

              {/* Already have account */}
              <p className="text-center text-[10px]" style={{ color: colors.textMuted }}>{t('alreadyHaveAccount')}</p>

              {/* Sign In Button */}
              <button type="button" onClick={() => navigate('/login')}
                className={`w-full py-2.5 text-[11px] font-bold rounded-[12px] flex items-center justify-center gap-2 transition ${isDark ? 'hover:bg-[#112328]' : 'hover:bg-gray-50'}`}
                style={{ background: colors.googleBtnBg, border: `1px solid ${colors.divider}`, color: colors.textMain }}>
                <i className="bx bx-log-in text-sm" />
                {t('signIn')}
              </button>

              {/* Home Link */}
              <Link to="/" className="flex items-center justify-center gap-1 text-[10px] font-medium hover:underline" style={{ color: colors.textMuted }}>
                ← {t('navHome')}
              </Link>

            </form>
          </div>
        </div>

        {/* Hidden Google button ref */}
        <div ref={googleBtnRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '320px' }} aria-hidden="true" />

        {/* Scan Method Modal */}
        {showOptionsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[var(--card-bg)]">
              <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-teal-900/40">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">
                    {activeIdSide === 'front' ? 'Upload Front Face' : 'Upload Back Face'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {activeIdSide === 'front' ? 'Upload the front of your ID first' : 'Now upload the back of your ID'}
                  </p>
                </div>
                <button type="button" onClick={() => setShowOptionsModal(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="bx bx-x text-2xl"></i>
                </button>
              </div>
              <div className="space-y-4 p-6">
                <button
                  type="button"
                  onClick={() => startCamera(activeIdSide)}
                  className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-teal-900/40 dark:hover:bg-slate-700"
                >
                  <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                    <i className="bx bx-camera text-xl"></i>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-slate-800 dark:text-slate-200">Scan by Camera</div>
                    <div className="text-xs text-slate-500">Take a photo using your device</div>
                  </div>
                </button>

                <label className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-teal-900/40 dark:hover:bg-slate-700">
                  <input type="file" accept="image/*" className="hidden" onChange={handleIdUpload} />
                  <div className="rounded-lg bg-teal-100 p-3 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                    <i className="bx bx-upload text-xl"></i>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {activeIdSide === 'front' ? 'Upload Front Face' : 'Upload Back Face'}
                    </div>
                    <div className="text-xs text-slate-500">Choose an image from your device</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )
        }

        {/* Analyzing Overlay */}
        {isAnalyzing && (
          <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[var(--bg)]/90 backdrop-blur-md">
            <div className="w-16 h-16 border-4 border-[var(--primary-light)] border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold text-white">Analyzing ID Image...</h2>
            <p className="text-slate-300 text-sm mt-2 text-center max-w-xs">Checking for valid face positioning and extracting document details</p>
          </div>
        )
        }

        {/* Camera Modal */}
        {showCameraModal && (
          <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--bg)] overflow-hidden font-sans">
            <style>{`
            @keyframes scan {
              0% { top: 5%; opacity: 0; }
              15% { opacity: 1; }
              85% { opacity: 1; }
              100% { top: 95%; opacity: 0; }
            }
          `}</style>

            {/* Header */}
            <div className="w-full px-8 py-6 flex justify-between items-center z-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center p-1.5 border border-white/20">
                  <img src="/assets/optimized/icon.webp" alt="logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-white font-bold text-xl tracking-tight">DaycareHQ</span>
              </div>
              <button type="button" onClick={stopCamera} className="w-10 h-10 rounded-xl bg-[var(--card-bg)] border border-[var(--white)]/10 text-[var(--white)] flex items-center justify-center hover:bg-[var(--white)]/10 transition-colors">
                <i className="bx bx-x text-xl"></i>
              </button>
            </div>

            <div className="relative flex-grow flex w-full h-full">

              {/* Left Panel */}
              <div className="hidden lg:flex absolute left-8 top-12 w-[320px] flex-col gap-8 z-40">
                <div>
                  <h2 className="text-white text-3xl font-bold mb-2">Scan {activeIdSide === 'front' ? 'Front' : 'Back'} Face</h2>
                  <p className="text-slate-400 text-sm mb-5">Align your ID in the frame to begin scanning</p>
                  {isAutoScanning && (
                    <div className="inline-flex items-center gap-2 bg-[var(--primary-dark)]/25 border border-[var(--primary-light)]/25 text-[var(--primary-light)] px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest">
                      <div className="w-2 h-2 bg-[var(--primary-light)] rounded-full animate-pulse shadow-[0_0_8px_rgba(22,196,201,0.6)]"></div>
                      AUTO-SCANNING
                    </div>
                  )}
                </div>

                <div className="bg-[var(--card-bg)]/80 backdrop-blur-md rounded-2xl p-6 border border-[var(--white)]/10 flex flex-col gap-6 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-[var(--primary-dark)]/30 flex items-center justify-center text-[var(--primary-light)] border border-[var(--primary-light)]/20 shadow-[0_0_15px_rgba(22,196,201,0.15)]">
                      <i className="bx bx-target-lock text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-slate-200 text-sm font-semibold mb-0.5">Good Lighting</h4>
                      <p className="text-slate-500 text-xs">Well lit environment detected</p>
                    </div>
                    <div className={scanStatus.lighting ? "text-[var(--primary-light)]" : "text-slate-600"}>
                      <i className={scanStatus.lighting ? "bx bx-check-circle text-xl" : "bx bx-loader-alt bx-spin text-xl"}></i>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-[var(--primary-dark)]/30 flex items-center justify-center text-[var(--primary-light)] border border-[var(--primary-light)]/20 shadow-[0_0_15px_rgba(22,196,201,0.15)]">
                      <i className="bx bx-face text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-slate-200 text-sm font-semibold mb-0.5">{activeIdSide === 'front' ? 'Face Position' : 'ID Position'}</h4>
                      <p className="text-slate-500 text-xs">{activeIdSide === 'front' ? 'Face properly aligned' : 'ID properly aligned'}</p>
                    </div>
                    <div className={scanStatus.position ? "text-[var(--primary-light)]" : "text-slate-600"}>
                      <i className={scanStatus.position ? "bx bx-check-circle text-xl" : "bx bx-loader-alt bx-spin text-xl"}></i>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-[var(--primary-dark)]/30 flex items-center justify-center text-[var(--primary-light)] border border-[var(--primary-light)]/20 shadow-[0_0_15px_rgba(22,196,201,0.15)]">
                      <i className="bx bx-show text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-slate-200 text-sm font-semibold mb-0.5">Clear View</h4>
                      <p className="text-slate-500 text-xs">No obstructions detected</p>
                    </div>
                    <div className={scanStatus.clearness ? "text-[var(--primary-light)]" : "text-slate-600"}>
                      <i className={scanStatus.clearness ? "bx bx-check-circle text-xl" : "bx bx-loader-alt bx-spin text-xl"}></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel */}
              <div className="hidden lg:block absolute right-8 top-12 w-[320px] z-40">
                <div className="bg-[var(--card-bg)]/80 backdrop-blur-md rounded-2xl p-6 border border-[var(--white)]/10 shadow-xl">
                  <h3 className="text-white font-semibold mb-6 flex items-center gap-2 text-sm tracking-wide">
                    <i className="bx bx-bulb text-[var(--primary-light)] text-lg"></i>
                    <span className="text-[var(--primary-light)]">Scanning</span> Tips
                  </h3>

                  <div className="flex flex-col gap-6">
                    <div className="flex items-start gap-4">
                      <i className="bx bx-sun text-[var(--primary-light)] mt-0.5 text-lg"></i>
                      <div>
                        <h4 className="text-slate-200 text-sm font-medium mb-1">Ensure good lighting</h4>
                        <p className="text-slate-500 text-xs leading-relaxed">Natural light works best</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <i className="bx bx-camera text-[var(--primary-light)] mt-0.5 text-lg"></i>
                      <div>
                        <h4 className="text-slate-200 text-sm font-medium mb-1">Look directly at the camera</h4>
                        <p className="text-slate-500 text-xs leading-relaxed">Keep your head straight</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <i className="bx bx-glasses text-[var(--primary-light)] mt-0.5 text-lg"></i>
                      <div>
                        <h4 className="text-slate-200 text-sm font-medium mb-1">Remove glasses or accessories</h4>
                        <p className="text-slate-500 text-xs leading-relaxed">For best results</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Camera Area */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <div className="relative flex flex-col items-center justify-center">

                  <div className="relative w-[360px] h-[360px] md:w-[480px] md:h-[480px]">
                    {/* Corner Brackets */}
                    <div className="absolute -inset-10 pointer-events-none hidden md:block">
                      <div className="absolute top-0 left-0 w-16 h-16 border-t-[3px] border-l-[3px] border-[var(--primary-light)] rounded-tl-3xl opacity-80 drop-shadow-[0_0_12px_rgba(22,196,201,0.6)]"></div>
                      <div className="absolute top-0 right-0 w-16 h-16 border-t-[3px] border-r-[3px] border-[var(--primary-light)] rounded-tr-3xl opacity-80 drop-shadow-[0_0_12px_rgba(22,196,201,0.6)]"></div>
                      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[3px] border-l-[3px] border-[var(--primary-light)] rounded-bl-3xl opacity-80 drop-shadow-[0_0_12px_rgba(22,196,201,0.6)]"></div>
                      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[3px] border-r-[3px] border-[var(--primary-light)] rounded-br-3xl opacity-80 drop-shadow-[0_0_12px_rgba(22,196,201,0.6)]"></div>
                    </div>

                    {/* Inner Glowing Ring */}
                    <div className="absolute inset-0 rounded-full border-[6px] border-[var(--primary-light)]/20 shadow-[0_0_40px_rgba(22,196,201,0.25)]"></div>

                    {/* The actual video element clipped to a circle */}
                    <div className="absolute inset-1 rounded-full overflow-hidden bg-slate-900 shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />

                      {/* Laser Scanner */}
                      {isAutoScanning && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div
                            className="w-full h-[2px] bg-[var(--primary-light)]/40 absolute left-0"
                            style={{
                              boxShadow: '0 0 20px 6px var(--primary-glow)',
                              animation: 'scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Instruction Text below camera */}
                  <div className="mt-14 text-center z-20">
                    <p className="text-white/90 font-medium tracking-wide">Position the {activeIdSide} of your ID within the frame</p>
                    <p className="text-slate-500 text-xs mt-2">Ensure good lighting and avoid glare</p>
                  </div>

                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Bottom Capture Button */}
              <div className="absolute bottom-8 w-full flex justify-center items-center z-50">
                <div className="relative flex items-center justify-center group cursor-pointer pointer-events-auto" onClick={captureImage}>
                  <div className="absolute w-[72px] h-[72px] rounded-full border-2 border-[var(--primary-light)]/40 group-hover:border-[var(--primary-light)] transition-colors shadow-[0_0_15px_rgba(22,196,201,0.2)]"></div>
                  <button
                    type="button"
                    className="w-14 h-14 rounded-full bg-[var(--card-bg)] flex items-center justify-center group-hover:bg-[var(--surface-2)] transition-all text-[var(--white)] border border-[var(--primary-light)]/30 group-active:scale-95"
                  >
                    <i className="bx bx-camera text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"></i>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
        }

        {/* Legal Document Modal */}
        {
          legalModal && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
              <div className="flex max-h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--primary-dark)]/50 bg-[var(--card-bg)] text-slate-200 shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between border-b border-[var(--primary-light)]/40 px-6 py-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary-light)]">DaycareHQ</p>
                    <h2 id="legal-modal-title" className="mt-1 text-xl font-bold text-white">
                      {legalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLegalModal(null)}
                    aria-label="Close legal document"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-[var(--white)]/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  >
                    <i className="bx bx-x text-2xl"></i>
                  </button>
                </div>

                <div className="overflow-y-auto px-6 py-5 text-sm leading-7 text-slate-300">
                  {legalModal === 'terms' ? (
                    <div className="space-y-5">
                      <p className="text-slate-400">Please review these terms before creating your DaycareHQ account. By using the service, you agree to follow these rules.</p>
                      <section>
                        <h3 className="mb-1 font-bold text-white">1. User Account Responsibility</h3>
                        <p>You are responsible for providing a valid email address, keeping your password confidential, and all activity performed through your account. Notify the daycare administrator promptly if you suspect unauthorized access.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">2. Data Accuracy</h3>
                        <p>You agree to provide accurate, current information about yourself and the children in your care. Keep contact, emergency, health, and authorized pickup information updated so staff can support children safely.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">3. Service Rules</h3>
                        <p>Use DaycareHQ only for lawful daycare administration and communication. Do not impersonate another person, misuse another user&apos;s information, interfere with the service, or upload harmful or misleading content. We may suspend access when necessary to protect children, families, staff, or the service.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">4. Liability Limitations</h3>
                        <p>DaycareHQ provides digital tools for daycare operations and does not replace supervision, medical advice, or emergency services. To the extent permitted by law, DaycareHQ is not liable for indirect losses caused by outages, inaccurate information supplied by a user, or events outside our reasonable control.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">5. Payment Terms</h3>
                        <p>Where paid daycare services or account features are enabled, you agree to provide accurate billing details and pay applicable charges by their due dates. Fees, refunds, and cancellations are governed by the daycare&apos;s published policies. We will not charge a payment method without the applicable authorization.</p>
                      </section>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <p className="text-slate-400">This policy explains how DaycareHQ handles information used to provide safe and reliable daycare services.</p>
                      <section>
                        <h3 className="mb-1 font-bold text-white">1. Information We Handle</h3>
                        <p>We may handle parent or guardian account details, child profiles, attendance, health and emergency details, authorized pickup information, messages, payments, and records needed to operate daycare services.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">2. National ID and Passport Scans</h3>
                        <p>National ID, passport, and other identity-document scans are confidential verification data. Access is limited to authorized personnel who need it for identity, safety, or compliance purposes. We do not publish these scans or use them for advertising, and we retain them only as long as needed for the stated purpose or a legal requirement.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">3. Encryption and Protection</h3>
                        <p>We use access controls and encryption in transit and at rest where supported by the service infrastructure. Passwords are stored using secure one-way hashing, and staff access is limited according to role. No online system can guarantee absolute security, so please protect your account credentials.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">4. How Information Is Used</h3>
                        <p>Information is used to manage enrollment, verify identity, coordinate attendance and pickup, communicate with families, process authorized payments, maintain records, and respond to safety or legal needs. We do not sell personal or child data.</p>
                      </section>
                      <section>
                        <h3 className="mb-1 font-bold text-white">5. Your Choices and Requests</h3>
                        <p>You may ask the daycare administrator to review, correct, or delete information where permitted by law and operational recordkeeping requirements. Questions about a child&apos;s data should be raised by the parent or legal guardian through the daycare&apos;s designated contact.</p>
                      </section>
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-[var(--primary-light)]/40 px-6 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setLegalModal(null)}
                    className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAgree(true);
                      setLegalModal(null);
                    }}
                    className="rounded-xl bg-[var(--primary-dark)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[0_20px_60px_rgba(22,196,201,0.2)] transition hover:bg-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  >
                    Accept &amp; Close
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Floating Theme Slide-Toggle in Bottom Right */}
        <div className="fixed bottom-6 right-6 z-55 flex items-center gap-2 bg-white/40 dark:bg-[var(--card-bg)]/40 p-2.5 rounded-full backdrop-blur-md shadow-md border border-[var(--white)]/50 dark:border-[var(--primary-dark)]/30">
          <i className={`bx ${theme === 'dark' ? 'bx-sun text-[var(--accent)]' : 'bx-moon text-slate-600'} text-lg`}></i>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={theme === 'dark'}
              onChange={toggleTheme}
            />
            <div className="w-10 h-5 bg-slate-300 dark:bg-indigo-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner"></div>
          </label>
        </div>

      </div>

    </>
  );
};

export default Register;