import { useState } from "react";
import AuthShell from "./AuthShell";
import api from "../../services/api";

/**
 * ResetPasswordCard — Screen 5
 * - Verifies token (from URL in real app, simulated here)
 * - Password strength meter: Weak / Medium / Strong / Excellent
 * - Rules checklist: 8 chars, uppercase, lowercase, number, special char
 * - POST /api/auth/reset-password  { token, password }
 */

// ── Password strength calculator ──
const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8)                  score++;
  if (/[A-Z]/.test(pw))               score++;
  if (/[a-z]/.test(pw))               score++;
  if (/[0-9]/.test(pw))               score++;
  if (/[^A-Za-z0-9]/.test(pw))        score++;
  return score; // 0-5
};

const strengthLabel = [null, "Weak", "Weak", "Medium", "Strong", "Excellent"];
const strengthColor = [null, 'var(--danger)', 'var(--danger)', 'var(--accent)', 'var(--success)', 'var(--primary)'];
const strengthWidth = [0, 20, 40, 60, 80, 100];

const rules = [
  { label: "Minimum 8 characters",     test: pw => pw.length >= 8 },
  { label: "Uppercase letter (A–Z)",   test: pw => /[A-Z]/.test(pw) },
  { label: "Lowercase letter (a–z)",   test: pw => /[a-z]/.test(pw) },
  { label: "Number (0–9)",             test: pw => /[0-9]/.test(pw) },
  { label: "Special character (!@#…)", test: pw => /[^A-Za-z0-9]/.test(pw) },
];

const ResetPasswordCard = ({ token, onSuccess, onSendNewLink }) => {
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const strength = getStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (strength < 3) { setError("Password is too weak. Please meet all requirements."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Expired token screen ──
  return (
    <AuthShell title="Create New Password" subtitle="Choose a strong password to secure your account.">
      {(dark) => {
        const labelColor  = dark ? 'var(--text-2)' : '#111827';
        const inputBg     = dark ? 'var(--card-bg)' : '#ffffff';
        const inputBorder = dark ? 'var(--glass-border)' : '#dde0e8';
        const inputFocus  = dark ? 'var(--primary-light)' : '#1c3a82';
        const inputColor  = dark ? 'var(--text)' : '#1a1a2e';
        const iconColor   = dark ? 'var(--muted)' : '#9ca3af';
        const ruleOk      = dark ? 'var(--success)' : '#16a34a';
        const ruleFail    = dark ? 'var(--muted)' : '#d1d5db';

        return (
          <>
            {error && (
              <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px", borderRadius: "0.75rem", border: "1px solid var(--danger-border)", background: "var(--danger-light)", padding: "0.6rem 1rem", color: "var(--danger)", fontSize: "12px" }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* New Password */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: labelColor, marginBottom: "6px" }}>New Password</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: iconColor, pointerEvents: "none" }}>
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </span>
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" required
                    style={{ width: "100%", paddingLeft: "2.6rem", paddingRight: "3rem", paddingTop: "0.8rem", paddingBottom: "0.8rem", borderRadius: "9999px", border: `1.5px solid ${inputBorder}`, background: inputBg, color: inputColor, fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = inputFocus} onBlur={e => e.target.style.borderColor = inputBorder} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: iconColor, background: "none", border: "none", cursor: "pointer" }}>
                    {showPass ? <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg> : <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
                  </button>
                </div>

                {/* Strength meter */}
                {password.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                      <div style={{ height: "4px", background: dark ? "rgba(255,255,255,0.03)" : "#e5e7eb", borderRadius: "9999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${strengthWidth[strength]}%`, background: strengthColor[strength], borderRadius: "9999px", transition: "all 0.3s" }} />
                    </div>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: strengthColor[strength], marginTop: "4px" }}>
                      {strengthLabel[strength]}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: labelColor, marginBottom: "6px" }}>Confirm Password</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: iconColor, pointerEvents: "none" }}>
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  </span>
                  <input type={showConfirm ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" required
                    style={{ width: "100%", paddingLeft: "2.6rem", paddingRight: "3rem", paddingTop: "0.8rem", paddingBottom: "0.8rem", borderRadius: "9999px", border: `1.5px solid ${confirm && confirm !== password ? 'var(--danger)' : inputBorder}`, background: inputBg, color: inputColor, fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = inputFocus} onBlur={e => e.target.style.borderColor = confirm && confirm !== password ? 'var(--danger)' : inputBorder} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: iconColor, background: "none", border: "none", cursor: "pointer" }}>
                    {showConfirm ? <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg> : <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
                  </button>
                </div>
                {confirm && confirm !== password && <p style={{ color: "var(--danger)", fontSize: "11px", marginTop: "4px", paddingLeft: "4px" }}>Passwords do not match</p>}
              </div>

              {/* Rules checklist */}
              <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(28,58,130,0.04)", borderRadius: "12px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {rules.map(r => {
                  const ok = r.test(password);
                  return (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: ok ? ruleOk : ruleFail, fontSize: "13px", flexShrink: 0 }}>{ok ? "✓" : "○"}</span>
                      <span style={{ fontSize: "12px", color: ok ? ruleOk : (dark ? 'var(--muted)' : '#9ca3af') }}>{r.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "0.9rem", borderRadius: "9999px", background: strength >= 3 ? 'var(--primary)' : 'rgba(138,154,163,0.28)', color: "var(--text)", fontWeight: 700, fontSize: "14px", border: "none", cursor: loading || strength < 3 ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: strength >= 3 ? "0 6px 20px rgba(0,196,199,0.18)" : "none", transition: "all 0.3s" }}>
                {loading ? <><svg width="16" height="16" className="animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Updating…</> : "Update Password →"}
              </button>
            </form>
          </>
        );
      }}
    </AuthShell>
  );
};

export default ResetPasswordCard;
