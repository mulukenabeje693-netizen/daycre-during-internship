import AuthShell from "./AuthShell";

/**
 * PasswordChangedCard — Screen 6 (Success)
 * Shown after a successful password reset.
 * Redirects user to login.
 */
const PasswordChangedCard = ({ onGoToLogin }) => {
  return (
    <AuthShell title="Password Updated!" subtitle="">
      {(dark) => {
        const textColor = dark ? "#e2e8f0" : "#1a1a2e";
        const subColor  = dark ? "#94a3b8" : "#4b5563";

        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1.1rem" }}>
            {/* Animated success icon */}
            <div style={{
              width: "80px", height: "80px", borderRadius: "9999px",
              background: "linear-gradient(135deg, #16a34a, #22c55e)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 30px rgba(34,197,94,0.4)",
              animation: "pulse 2s infinite",
            }}>
              <svg width="38" height="38" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <div>
              <h2 style={{ color: textColor, fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px" }}>
                Password Updated Successfully
              </h2>
              <p style={{ color: subColor, fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
                Your password has been securely changed.<br />You can now sign in with your new password.
              </p>
            </div>

            {/* Security tips */}
            <div style={{
              width: "100%", background: dark ? "rgba(34,197,94,0.06)" : "rgba(22,163,74,0.06)",
              border: `1px solid ${dark ? "rgba(34,197,94,0.15)" : "rgba(22,163,74,0.15)"}`,
              borderRadius: "12px", padding: "12px 16px", textAlign: "left",
            }}>
              <p style={{ color: dark ? "#4ade80" : "#15803d", fontSize: "11px", fontWeight: 700, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Security reminder
              </p>
              {[
                "You have been signed out of all other devices.",
                "Never share your password with anyone.",
                "Use a unique password for each service.",
              ].map(tip => (
                <p key={tip} style={{ color: dark ? "#86efac" : "#166534", fontSize: "12px", margin: "0 0 3px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                  <span style={{ flexShrink: 0, marginTop: "1px" }}>•</span>{tip}
                </p>
              ))}
            </div>

            {/* Go to Login */}
            <button type="button" onClick={onGoToLogin}
              style={{ width: "100%", padding: "0.9rem", borderRadius: "9999px", background: "#1c3a82", color: "white", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer", boxShadow: "0 6px 20px rgba(28,58,130,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
              Go to Login
            </button>
          </div>
        );
      }}
    </AuthShell>
  );
};

export default PasswordChangedCard;
