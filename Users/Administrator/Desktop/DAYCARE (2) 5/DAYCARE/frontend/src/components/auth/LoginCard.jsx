import { useState, useEffect } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import loginBg from "../../assets/login.png";
import darkBg from "../../assets/darklogin.png";
import iconImg from "../../assets/icon.png";

/**
 * LoginCard
 * ─────────────────────────────────────────────────────────────────
 * • Light mode → login.png background
 * • Dark  mode → dark.png  background
 * • Toggle button top-right of the page
 * • Persists preference in localStorage
 * ─────────────────────────────────────────────────────────────────
 */
const LoginCard = ({ onBackToHome, onNavigateToRegister, onForgotPassword }) => {
  const { login, googleLogin, redirectUser } = useAuth();
  // ── Dark mode state ──
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Apply / remove the `dark` class on <html> and persist
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) setError(result.message || "Login failed. Please try again.");
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setError("");
        setLoading(true);
        const idToken = tokenResponse.credential || tokenResponse.access_token || tokenResponse.code;
        if (!idToken) throw new Error('No token received from Google');
        const result = await googleLogin(idToken);
        if (result.success) {
          redirectUser(result.user.role);
        } else {
          setError(result.message || 'Google login failed');
        }
      } catch (err) {
        setError(err.message || 'Google sign-in failed.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError("Google sign-in failed. Please try again."),
  });

  // ── Derived theme tokens ──────────────────────────────────────
  const t = {
    // page bg — replaced by background image below
    pageBg: dark ? "#0f1117" : "#e8d5b0",
    // card
    cardBg: dark ? "#1e2235" : "#f0f0f5",
    cardBorder: dark ? "#c9a845" : "#c9a845",
    // header (always stays navy-ish but slightly deeper in dark)
    headerBg: dark ? "#111a3a" : "#1c3a82",
    // notch corners (must match cardBg)
    notchBg: dark ? "#1e2235" : "#f0f0f5",
    // form body
    formBg: dark ? "#1e2235" : "#f0f0f5",
    // labels
    labelColor: dark ? "#e2e8f0" : "#111827",
    // inputs
    inputBg: dark ? "#2a3050" : "#ffffff",
    inputBorder: dark ? "#3a4570" : "#dde0e8",
    inputFocus: dark ? "#6b80e0" : "#1c3a82",
    inputColor: dark ? "#e2e8f0" : "#1a1a2e",
    placeholderColor: dark ? "#7080a0" : "#9ca3af",
    // icon color
    iconColor: dark ? "#7080a0" : "#9ca3af",
    // divider
    dividerColor: dark ? "#2e3a58" : "#d1d5db",
    dividerText: dark ? "#4a5a80" : "#9aa0b0",
    // button outlines
    outlineBtnBg: dark ? "#2a3050" : "#ffffff",
    outlineBtnBorder: dark ? "#3a4570" : "#dde0e8",
    outlineBtnText: dark ? "#e2e8f0" : "#1a1a2e",
    // forgot / back
    forgotColor: dark ? "#7b9ef0" : "#2a6dd9",
    backColor: dark ? "#c8d0e8" : "#1a1a2e",
    // security note
    noteColor: dark ? "#4a5a80" : "#9aa0b0",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 1rem",
        position: "relative",
        backgroundImage: `url(${dark ? darkBg : loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        transition: "background-image 0.4s ease",
      }}
    >
      {/* Overlay so card always reads clearly over the bg image */}
      <div style={{
        position: "absolute", inset: 0,
        background: dark ? "rgba(0,0,0,0.55)" : "transparent",
        transition: "background 0.4s",
      }} />

      {/* ── Dark / Light toggle button ── */}
      <button
        onClick={() => setDark(d => !d)}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          position: "fixed",
          top: "1.25rem",
          right: "1.25rem",
          zIndex: 100,
          width: "44px",
          height: "44px",
          borderRadius: "9999px",
          border: "1.5px solid",
          borderColor: dark ? "#4a5a80" : "#c9a845",
          background: dark ? "#1e2235" : "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          transition: "all 0.25s ease",
        }}
        aria-label="Toggle dark mode"
      >
        {dark ? (
          /* Sun icon */
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#f5d060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          /* Moon icon */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#1c3a82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
          </svg>
        )}
      </button>

      {/* ════════════════════════════════════════
          CARD
      ════════════════════════════════════════ */}
      <div style={{
        position: "relative",
        zIndex: 10,
        width: "100%",
        maxWidth: "380px",
        borderRadius: "2rem",
        border: `2.5px solid ${t.cardBorder}`,
        boxShadow: dark
          ? "0 30px 80px rgba(0,0,0,0.55)"
          : "0 30px 80px rgba(0,0,0,0.22)",
        background: t.cardBg,
        transition: "background 0.3s, border-color 0.3s",
      }}>

        {/* ══ NAVY HEADER ══ */}
        <div style={{
          position: "relative",
          textAlign: "center",
          padding: "2.5rem 2rem 3.5rem",
          background: t.headerBg,
          borderRadius: "1.75rem 1.75rem 0 0",
          transition: "background 0.3s",
        }}>
          {/* Logo box */}
          <div style={{
            margin: "0 auto 1.25rem",
            width: "72px", height: "72px",
            borderRadius: "1.2rem",
            background: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}>
            <img src={iconImg} alt="Daycare" style={{ width: "56px", height: "56px", objectFit: "contain", borderRadius: "0.7rem" }} />
          </div>

          <h1 style={{ color: "white", fontSize: "2rem", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Welcome Back
          </h1>
          <p style={{ color: "#a8bce8", fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", lineHeight: 1.6, margin: 0 }}>
            MINT DECLARE · MINISTRY OF<br />INNOVATION
          </p>

          {/* Corner notches */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "44px", height: "44px", background: t.notchBg, borderTopRightRadius: "9999px", transition: "background 0.3s" }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: "44px", height: "44px", background: t.notchBg, borderTopLeftRadius: "9999px", transition: "background 0.3s" }} />
        </div>

        {/* ══ CONCENTRIC BADGE ══ */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "-2.1rem", position: "relative", zIndex: 40 }}>
          <div style={{ width: "68px", height: "68px", borderRadius: "9999px", background: "linear-gradient(150deg, #d4a030, #f5d878, #b07820, #e8c040)", padding: "3px", boxShadow: "0 6px 24px rgba(160,110,20,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "9999px", background: "#1a3272", padding: "3.5px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "9999px", background: "#2a52b0", padding: "3.5px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "100%", height: "100%", borderRadius: "9999px", background: "#1e3e92", padding: "3px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "9999px", background: "#152d6a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f0d060" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2.944a11.955 11.955 0 018.618 3.04A12.02 12.02 0 0121 9c0 5.591-3.824 10.29-9 11.622C6.824 19.29 3 14.591 3 9a12.02 12.02 0 01.382-3.016A11.955 11.955 0 0112 2.944z" />
                      <line x1="12" y1="8" x2="12" y2="13" strokeWidth="2.2" />
                      <circle cx="12" cy="15.8" r="0.95" fill="#f0d060" stroke="none" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ FORM BODY ══ */}
        <div style={{ padding: "1.5rem 1.75rem 2rem", background: t.formBg, borderRadius: "0 0 1.75rem 1.75rem", transition: "background 0.3s" }}>

          {error && (
            <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px", borderRadius: "0.75rem", border: "1px solid #fca5a5", background: "#fef2f2", padding: "0.6rem 1rem", color: "#dc2626", fontSize: "12px" }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: t.labelColor, marginBottom: "8px", transition: "color 0.3s" }}>
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: t.iconColor, pointerEvents: "none" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  style={{ width: "100%", paddingLeft: "2.75rem", paddingRight: "1rem", paddingTop: "0.8rem", paddingBottom: "0.8rem", borderRadius: "9999px", border: `1.5px solid ${t.inputBorder}`, background: t.inputBg, color: t.inputColor, fontSize: "13px", outline: "none", transition: "all 0.3s", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = t.inputFocus}
                  onBlur={e => e.target.style.borderColor = t.inputBorder}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: t.labelColor, transition: "color 0.3s" }}>Password</label>
                <button type="button" onClick={onForgotPassword} style={{ color: t.forgotColor, fontSize: "13px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", transition: "color 0.3s" }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: t.iconColor, pointerEvents: "none" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: "100%", paddingLeft: "2.75rem", paddingRight: "3rem", paddingTop: "0.8rem", paddingBottom: "0.8rem", borderRadius: "9999px", border: `1.5px solid ${t.inputBorder}`, background: t.inputBg, color: t.inputColor, fontSize: "13px", outline: "none", transition: "all 0.3s", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = t.inputFocus}
                  onBlur={e => e.target.style.borderColor = t.inputBorder}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: t.iconColor, background: "none", border: "none", cursor: "pointer" }}
                  aria-label={showPass ? "Hide password" : "Show password"}>
                  {showPass ? (
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Sign In */}
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "0.9rem", borderRadius: "9999px", background: "#1c3a82", color: "white", fontWeight: 700, fontSize: "15px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 6px 20px rgba(28,58,130,0.4)", transition: "opacity 0.2s" }}>
              {loading ? (
                <>
                  <svg width="16" height="16" className="animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : <>Sign In →</>}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "1.25rem 0" }}>
            <div style={{ flex: 1, height: "1px", background: t.dividerColor, transition: "background 0.3s" }} />
            <span style={{ color: t.dividerText, fontSize: "12px", transition: "color 0.3s" }}>or continue with</span>
            <div style={{ flex: 1, height: "1px", background: t.dividerColor, transition: "background 0.3s" }} />
          </div>

          {/* Google */}
          <button type="button" onClick={handleGoogle}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "0.8rem 1rem", borderRadius: "9999px", border: `1.5px solid ${t.outlineBtnBorder}`, background: t.outlineBtnBg, color: t.outlineBtnText, fontWeight: 600, fontSize: "14px", cursor: "pointer", marginBottom: "10px", transition: "all 0.3s" }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Create Account */}
          <button type="button" onClick={onNavigateToRegister}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "0.8rem 1rem", borderRadius: "9999px", border: `1.5px solid ${t.outlineBtnBorder}`, background: t.outlineBtnBg, color: t.outlineBtnText, fontWeight: 600, fontSize: "14px", cursor: "pointer", transition: "all 0.3s" }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: t.iconColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Create Account
          </button>

          {/* Security note */}
          <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "1.25rem", color: t.noteColor, fontSize: "12px", transition: "color 0.3s" }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Your data is secure with us
          </p>

          {/* Back to Home */}
          <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
            <button type="button" onClick={onBackToHome}
              style={{ color: t.backColor, fontSize: "13px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", transition: "color 0.3s" }}>
              ← Back to Home
            </button>
          </div>
        </div>
        {/* end form body */}
      </div>
      {/* end card */}
    </div>
  );
};

export default LoginCard;
