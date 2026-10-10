import { useState, useRef, useEffect } from "react";
import AuthShell from "./AuthShell";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

/**
 * EmailSentCard — OTP Verification Screen
 * Shows target email and a 6-digit OTP input grid.
 * Auto-submits on the 6th digit.
 */
const EmailSentCard = ({ email = "your email", onBackToLogin, initialOtp = null }) => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [devOtp, setDevOtp] = useState(initialOtp); // shown in dev mode
  
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef([]);

  useEffect(() => {
    // Auto-focus the first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleVerifyOtp = async (currentOtp) => {
    const otpCode = currentOtp.join('');
    if (otpCode.length !== 6) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/verify-reset-otp", { email, otp: otpCode });
      const token = res.data?.token || res.data?.resetToken || otpCode;
      navigate(`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP code.');
      setOtp(["", "", "", "", "", ""]);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e, index) => {
    const value = e.target.value;
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }

    if (value && index === 5) {
      handleVerifyOtp(newOtp);
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).replace(/[^0-9]/g, "");
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    
    const focusIndex = pastedData.length < 6 ? pastedData.length : 5;
    inputRefs.current[focusIndex].focus();

    if (pastedData.length === 6) {
      handleVerifyOtp(newOtp);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setDevOtp(null);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      if (res.data?.otp) setDevOtp(res.data.otp);
      setResent(true);
      let t = 60;
      setCountdown(t);
      const interval = setInterval(() => {
        t -= 1;
        setCountdown(t);
        if (t <= 0) { clearInterval(interval); setResent(false); setCountdown(0); }
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell title="Check Your Email" subtitle="">
      {(dark) => {
        const textColor   = dark ? 'var(--text-2)' : '#1a1a2e';
        const subColor    = dark ? 'var(--muted)' : '#4b5563';
        const emailColor  = dark ? 'var(--primary-light)' : '#1c3a82';
        const backColor   = dark ? 'var(--text)' : '#1a1a2e';
        const divColor    = dark ? 'rgba(255,255,255,0.03)' : '#e5e7eb';
        const inputBg     = dark ? 'rgba(255,255,255,0.05)' : '#fff';
        const inputBorder = dark ? 'rgba(255,255,255,0.1)' : '#d1d5db';
        const focusBorder = 'var(--primary)';
        const errorBorder = '#ef4444';

        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem" }}>
            {/* Big icon */}
            <div style={{ fontSize: "56px", lineHeight: 1, marginBottom: "0.5rem" }}>📩</div>

            <h2 style={{ color: textColor, fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
              Check Your Email
            </h2>

            <p style={{ color: subColor, fontSize: "13px", lineHeight: 1.6, margin: 0, maxWidth: "280px" }}>
              We've sent a secure password reset OTP to
            </p>
            <span style={{ color: emailColor, fontSize: "13px", fontWeight: 700, wordBreak: "break-all" }}>
              {email}
            </span>

            {/* Dev-mode OTP Hint Banner */}
            {devOtp && (
              <div style={{
                background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)',
                borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
                color: '#b45309', fontWeight: 700, textAlign: 'center', width: '100%'
              }}>
                🔑 Dev OTP: <span style={{ letterSpacing: '4px', fontSize: '16px' }}>{devOtp}</span>
              </div>
            )}

            {/* OTP Input Grid */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", margin: "1rem 0", position: "relative" }}>
              {loading && (
                <div style={{ 
                  position: "absolute", inset: "-10px", background: dark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.7)", 
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, borderRadius: "12px", backdropFilter: "blur(2px)" 
                }}>
                  <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  disabled={loading}
                  style={{
                    width: "42px", height: "52px",
                    textAlign: "center", fontSize: "20px", fontWeight: 700,
                    color: textColor, background: inputBg,
                    border: `2px solid ${error ? errorBorder : inputBorder}`,
                    borderRadius: "10px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = error ? errorBorder : focusBorder}
                  onBlur={(e) => e.target.style.borderColor = error ? errorBorder : inputBorder}
                />
              ))}
            </div>

            {error && (
              <p style={{ color: errorBorder, fontSize: "12px", fontWeight: 600, margin: "-0.5rem 0 0 0" }}>
                {error}
              </p>
            )}

            <div style={{ width: "100%", height: "1px", background: divColor, margin: "0.25rem 0" }} />

            {/* Resend */}
            {resent ? (
              <p style={{ color: "var(--success)", fontSize: "12px", fontWeight: 600 }}>
                ✓ OTP resent! Check your inbox.
              </p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resending || countdown > 0}
                style={{ background: "none", border: "none", color: countdown > 0 ? "#9ca3af" : emailColor, fontSize: "13px", fontWeight: 600, cursor: countdown > 0 ? "not-allowed" : "pointer" }}>
                {resending ? "Sending…" : countdown > 0 ? `Resend Link (${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')})` : "Resend Link"}
              </button>
            )}

            {/* Back to Login */}
            <button type="button" onClick={onBackToLogin}
              style={{ color: backColor, fontSize: "13px", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
              ← Back to Login
            </button>

            {/* Security note */}
            <p style={{ color: dark ? 'var(--muted)' : "#9ca3af", fontSize: "11px", marginTop: "0.25rem" }}>
              Didn't get the email? Check your spam folder.
            </p>
          </div>
        );
      }}
    </AuthShell>
  );
};

export default EmailSentCard;

