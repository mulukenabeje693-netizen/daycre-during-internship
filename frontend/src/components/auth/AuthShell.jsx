import { useState, useEffect } from "react";

/**
 * AuthShell — shared wrapper for all auth pages.
 * Handles dark/light toggle, background image, card header, badge.
 * Children receive `dark` and are rendered in the white form body.
 */
const AuthShell = ({ title, subtitle, children }) => {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const t = {
    cardBg: dark ? "var(--card-bg)" : "transparent",
    headerBg: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
    notchBg: dark ? "var(--card-bg)" : "var(--white)",
    formBg: dark ? "var(--card-bg)" : "var(--white)",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "3rem 1rem", position: "relative",
      backgroundImage: `url(${dark ? "/assets/optimized/dark.webp" : "/assets/optimized/login.webp"})`,
      backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
    }}>
      {/* Overlay */}
      <div style={{ position: "absolute", inset: 0, background: dark ? "rgba(0,0,0,0.55)" : "transparent", transition: "background 0.4s" }} />

      {/* Dark/Light toggle */}
      <button onClick={() => setDark(d => !d)}
        style={{ position: "fixed", top: "1.25rem", right: "1.25rem", zIndex: 100, width: "44px", height: "44px", borderRadius: "9999px", border: `1.5px solid ${dark ? "rgba(22,196,201,0.3)" : "rgba(255,255,255,0.6)"}`, background: dark ? "var(--card-bg)" : "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}
        aria-label="Toggle dark mode">
        {dark
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" /></svg>
        }
      </button>

      {/* Card */}
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "420px", borderRadius: "28px", overflow: "visible", border: `1px solid ${dark ? "rgba(22,196,201,0.25)" : "rgba(255,255,255,0.5)"}`, boxShadow: dark ? "0 4px 6px rgba(0,0,0,0.2), 0 20px 60px rgba(0,0,0,0.4)" : "0 4px 6px rgba(15,23,42,0.06), 0 20px 60px rgba(15,23,42,0.18), 0 0 0 6px rgba(255,255,255,0.25)", background: t.cardBg }}>

        {/* Navy header */}
        <div style={{ position: "relative", textAlign: "center", padding: "2.5rem 2rem 7rem", background: t.headerBg, borderRadius: "28px 28px 0 0" }}>
          <div style={{ margin: "0 auto 1rem", width: "80px", height: "80px", borderRadius: "1rem", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
            <img src="/assets/optimized/icon.webp" alt="Daycare" style={{ width: "50px", height: "50px", objectFit: "contain" }} />
          </div>
          <h1 style={{ color: "white", fontSize: "1.6rem", fontWeight: 800, margin: "0 0 5px", letterSpacing: "-0.02em" }}>{title}</h1>
          {subtitle && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, margin: 0, lineHeight: 1.5, padding: "0 1rem" }}>{subtitle}</p>}
          {/* Corner notches */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "44px", height: "44px", background: t.notchBg, borderTopRightRadius: "9999px" }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: "44px", height: "44px", background: t.notchBg, borderTopLeftRadius: "9999px" }} />
        </div>

        {/* Badge */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "-2rem", position: "relative", zIndex: 40 }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "9999px", background: "linear-gradient(135deg, var(--primary), var(--primary-dark))", border: "2.5px solid var(--primary-light)", boxShadow: "0 4px 16px rgba(0,107,112,0.35), 0 0 0 4px rgba(22,196,201,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 11v4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
        </div>

        {/* Form body */}
        <div style={{ marginTop: "-60px", position: "relative", zIndex: 20, padding: "3.5rem 2rem 2rem", background: t.formBg, borderTop: "4px solid rgba(22,196,201,0.8)", borderRadius: "40px 40px 28px 28px", boxShadow: "0 -8px 20px rgba(0,0,0,0.12)" }}>
          {children(dark)}
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
