import { useState } from "react";
import AuthShell from "./AuthShell";
import api from "../../services/api";

/**
 * ForgotPasswordCard — Screen 2
 * Validates email format, calls POST /api/auth/forgot-password
 * On success → navigate to EmailSent page
 */
const ForgotPasswordCard = ({ onBackToLogin, onEmailSent }) => {
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!email.trim()) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      // Only advance to OTP screen on explicit success
      if (res.data?.success) {
        onEmailSent(email, res.data?.otp || null);
      } else {
        setError(res.data?.message || "Unable to send the reset request. Please try again.");
      }
    } catch (err) {
      // Show the server's message (e.g. 404 "No account found…") directly in the form
      setError(err.response?.data?.message || err.message || "Unable to send the reset request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot Password?"
      subtitle="Enter your registered email address and we'll send you a secure password reset link."
    >
      {(dark) => {
        const labelColor   = dark ? "var(--white)" : "var(--text)";
        const inputBg      = dark ? "var(--surface)" : "var(--surface)";
        const inputBorder  = dark ? "rgba(22,196,201,0.18)" : "var(--border)";
        const inputFocus   = "var(--primary-light)";
        const inputColor   = dark ? "var(--white)" : "var(--text)";
        const iconColor    = "var(--muted-2)";
        const backColor    = "var(--primary-dark)";

        return (
          <>
            {error && (
              <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px", borderRadius: "0.75rem", border: "1px solid rgba(245,168,0,0.3)", background: "rgba(245,168,0,0.12)", padding: "0.6rem 1rem", color: "var(--accent)", fontSize: "12px" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: labelColor, marginBottom: "8px" }}>
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: iconColor, pointerEvents: "none" }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  </span>
                  <input
                    type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                    placeholder="you@example.com" required autoFocus
                    style={{ width: "100%", paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.85rem", paddingBottom: "0.85rem", borderRadius: "9999px", border: `1.5px solid ${inputBorder}`, background: inputBg, color: inputColor, fontSize: "13px", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = inputFocus}
                    onBlur={e => e.target.style.borderColor = inputBorder}
                  />
                </div>
              </div>

              {/* Send Reset Link button */}
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "0.9rem", borderRadius: "9999px", background: "var(--primary)", color: "var(--white)", fontWeight: 700, fontSize: "15px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 6px 20px rgba(0,107,112,0.35)", transition: "opacity 0.2s" }}>
                {loading ? (
                  <><svg width="16" height="16" className="animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending…</>
                ) : (
                  <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Send Reset Link</>
                )}
              </button>
            </form>

            {/* Back to Login */}
            <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
              <button type="button" onClick={onBackToLogin}
                style={{ color: backColor, fontSize: "13px", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                ← Back to Login
              </button>
            </div>
          </>
        );
      }}
    </AuthShell>
  );
};

export default ForgotPasswordCard;
