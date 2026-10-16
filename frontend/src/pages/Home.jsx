import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/useLanguage';
import TranslatorIcon from '../components/common/TranslatorIcon';

/* ── circuit board SVG pattern (teal lines on dark) ── */
const CIRCUIT_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg stroke='%2300C4C7' stroke-width='0.8' fill='none' opacity='0.6'%3E%3Cpath d='M0 30 h40 M60 30 h60 M30 0 v40 M30 60 v60 M0 90 h25 M45 90 h75 M90 0 v25 M90 45 v75 M60 60 h30 M60 60 v30'/%3E%3Ccircle cx='30' cy='30' r='3' fill='%2300C4C7'/%3E%3Ccircle cx='90' cy='90' r='3' fill='%2300C4C7'/%3E%3Ccircle cx='90' cy='30' r='2' fill='%2300C4C7'/%3E%3Ccircle cx='30' cy='90' r='2' fill='%2300C4C7'/%3E%3Ccircle cx='60' cy='60' r='4' fill='%2300C4C7'/%3E%3Ccircle cx='0' cy='30' r='2' fill='%2300C4C7'/%3E%3Ccircle cx='30' cy='0' r='2' fill='%2300C4C7'/%3E%3C/g%3E%3C/svg%3E")`;

const Home = () => {
  const [theme, setTheme] = useState('light');
  const { locale, setLocale, t, LANGUAGE_OPTIONS } = useLanguage();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const isDark = theme === 'dark';

  return (
    <div
      className="min-h-screen transition-colors duration-200 relative"
      style={{
        background: isDark ? 'var(--bg)' : 'var(--bg)',
      }}
    >
      {/* ── circuit pattern — dark mode full page, light mode hero only via section ── */}
      {isDark && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: CIRCUIT_SVG,
            backgroundSize: '120px 120px',
            opacity: 0.08,
          }}
        />
      )}

      <div className="relative z-10">

        {/* ════════════════════════════════════════════
            NAVBAR
        ════════════════════════════════════════════ */}
        <nav
          className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 border-b"
          style={{
            background: isDark ? 'var(--surface-2)' : 'var(--white)',
            borderColor: isDark ? 'var(--border)' : 'var(--border)',
            backdropFilter: isDark ? 'blur(8px)' : 'none',
          }}
        >
          {/* Logo — MiNT official logo image + text */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src="/assets/optimized/mint-logo.webp"
              alt="MiNT Logo"
              className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <span className="block font-bold text-xs sm:text-sm leading-tight truncate"
                style={{ color: 'var(--primary-light)' }}>
                የኢኖቬሽንና ቴክኖሎጂ ሚኒስቴር
              </span>
              <span className="hidden sm:block font-bold text-xs sm:text-sm leading-tight truncate"
                style={{ color: 'var(--primary-light)' }}>
                Ministry of Innovation and Technology
              </span>
            </div>
          </div>

          {/* Desktop Nav links */}
          <div className="hidden md:flex items-center gap-5 text-xs font-semibold flex-shrink-0">
            <Link
              to="/"
              className="pb-0.5 border-b-2"
              style={{ color: 'var(--primary-light)', borderColor: 'var(--primary-light)' }}
            >{t('navHome')}</Link>
            <a href="#features"
              style={{ color: isDark ? 'var(--white)' : 'var(--primary-dark)' }}
              className="hover:text-[var(--primary-light)] transition-colors">{t('navFeatures')}</a>
            <a href="#how-it-works"
              style={{ color: isDark ? 'var(--white)' : 'var(--primary-dark)' }}
              className="hover:text-[var(--primary-light)] transition-colors">{t('navHowItWorks')}</a>
            <Link to="/login"
              style={{ color: isDark ? 'var(--white)' : 'var(--primary-dark)' }}
              className="hover:text-[var(--primary-light)] transition-colors">{t('navLogin')}</Link>

            {/* Theme toggle — amber sun in light mode */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-all"
              style={{
                background: isDark ? 'var(--surface)' : 'transparent',
                color: 'var(--accent)',
              }}
              title="Toggle theme"
            >
              <i className="bx bx-sun text-lg"></i>
            </button>

            {/* Language selector */}
            <div className="relative ml-2 flex items-center">
              <div className="pointer-events-none absolute left-2.5 z-10 flex items-center">
                <TranslatorIcon className="w-4 h-4" />
              </div>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="appearance-none h-9 rounded-xl border pl-8 pr-8 text-sm font-semibold shadow-sm outline-none transition-all cursor-pointer"
                style={{
                  background: isDark ? 'var(--surface)' : 'var(--white)',
                  color: isDark ? 'var(--white)' : 'var(--primary-dark)',
                  borderColor: isDark ? 'var(--border)' : 'var(--border)'
                }}
                title="Switch language"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center" style={{ color: isDark ? 'var(--white)' : 'var(--primary-dark)' }}>
                <i className="bx bx-chevron-down text-base" />
              </div>
            </div>

            <Link
              to="/register"
              className="px-4 py-2 rounded-xl font-bold text-white shadow hover:-translate-y-0.5 transition-all"
              style={{ background: 'var(--accent)' }}
            >
              {t('navGetStarted')}
            </Link>
          </div>

          {/* Mobile Nav actions */}
          <div className="flex md:hidden items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl text-[var(--accent)]"
              title="Toggle theme"
            >
              <i className="bx bx-sun text-lg"></i>
            </button>

            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-2 z-10 flex items-center">
                <TranslatorIcon className="w-3.5 h-3.5" />
              </div>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="appearance-none h-8 rounded-lg border pl-6 pr-6 text-xs font-semibold shadow-sm outline-none cursor-pointer"
                style={{
                  background: isDark ? 'var(--surface)' : 'var(--white)',
                  color: isDark ? 'var(--white)' : 'var(--primary-dark)',
                  borderColor: isDark ? 'var(--border)' : 'var(--border)'
                }}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label.slice(0, 3)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center" style={{ color: isDark ? 'var(--white)' : 'var(--primary-dark)' }}>
                <i className="bx bx-chevron-down text-xs" />
              </div>
            </div>

            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow"
              style={{ background: 'var(--accent)' }}
            >
              {t('navLogin')}
            </Link>
          </div>
        </nav>

        {/* ════════════════════════════════════════════
            HERO
        ════════════════════════════════════════════ */}
        <section
          className="pt-20 pb-32 px-4 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #006B70 0%, #004F59 45%, #006B70 100%)',
          }}
        >
          {/* Background Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
            style={{
              filter: 'brightness(0.75)',
            }}
          >
            <source src="/assets/images/gemini_generated_video_9f8fb85b.mp4" type="video/mp4" />
          </video>

          {/* High-contrast brand overlay to preserve text readability */}
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              background: 'linear-gradient(160deg, rgba(0, 107, 112, 0.78) 0%, rgba(0, 75, 80, 0.85) 50%, rgba(0, 107, 112, 0.80) 100%)',
            }}
          />

          {/* circuit pattern for hero */}
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{ backgroundImage: CIRCUIT_SVG, backgroundSize: '120px 120px', opacity: 0.05 }}
          />

          <div className="relative max-w-4xl mx-auto space-y-7 z-10">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full border text-xs font-semibold"
              style={{ borderColor: 'var(--primary-border)', background: 'var(--primary-soft)', color: 'var(--primary-light)' }}
            >
              <i className="bx bx-building text-sm"></i>
              {t('heroBadge')}
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
              {t('heroTitle1')} <br />
              <span style={{ color: 'var(--primary-light)' }}>{t('heroTitle2')}</span>
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-white/75">
              {t('heroSubtitle')}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
              <Link
                to="/register"
                className="w-full sm:w-auto px-9 py-4 font-bold rounded-xl text-white hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                style={{
                  background: 'var(--accent)',
                  boxShadow: 'var(--shadow-glow-warning)',
                }}
              >
                {t('heroBtnStart')}
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-9 py-4 font-bold rounded-xl border text-white hover:bg-white/10 transition-colors"
                style={{ borderColor: 'var(--white-soft)' }}
              >
                {t('heroBtnLogin')}
              </Link>
            </div>
          </div>

          {/* Wave bottom divider */}
          <div className="absolute bottom-0 left-0 right-0 w-full pointer-events-none z-10" style={{ height: 70 }}>
            <svg viewBox="0 0 1440 70" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full block">
              <path d="M0,35 C360,90 1080,-10 1440,35 L1440,70 L0,70 Z" fill={isDark ? 'var(--bg)' : 'var(--white)'} />
            </svg>
          </div>
        </section>

        {/* ════════════════════════════════════════════
            TRUST BAR — white card on light, dark on dark
        ════════════════════════════════════════════ */}
        <div
          className="px-4 py-1"
          style={{ background: isDark ? 'var(--bg)' : 'var(--white)' }}
        >
          <div
            className="max-w-5xl mx-auto rounded-2xl px-8 py-6 flex items-center justify-center gap-8 md:gap-14 flex-wrap text-sm font-semibold shadow-sm"
            style={{
              background: isDark ? 'var(--surface)' : 'var(--white)',
              border: isDark ? '1px solid var(--border)' : '1px solid var(--border)',
            }}
          >
            {[
              { icon: 'bx-lock-alt', label: t('trustSSL') },
              { icon: 'bx-group', label: t('trustChildren') },
              { icon: 'bx-bolt-circle', label: t('trustRealtime') },
              { icon: 'bx-shield-alt-2', label: t('trustSecure') },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2" style={{ color: isDark ? 'var(--white)' : 'var(--primary-dark)' }}>
                <i className={`bx ${icon} text-xl`} style={{ color: 'var(--primary-light)' }}></i>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            FEATURES
        ════════════════════════════════════════════ */}
        <section id="features" className="py-20 px-4 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <span
              className="text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full border"
              style={{ color: isDark ? 'var(--primary-light)' : 'var(--primary-dark)', background: 'var(--primary-soft)', borderColor: 'var(--primary-border)' }}
            >
              {t('platformFeatures')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: isDark ? 'var(--white)' : 'var(--text)' }}>
              {t('everythingYouNeed')}
            </h2>
            <p className="text-sm text-slate-400">
              {t('featuresDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: '📋', title: t('feature1Title'), desc: t('feature1Desc') },
              { icon: '🔍', title: t('feature2Title'), desc: t('feature2Desc') },
              { icon: '🔒', title: t('feature3Title'), desc: t('feature3Desc') },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="border p-8 rounded-2xl shadow-sm hover:shadow-md transition-all"
                style={{
                  background: isDark ? 'var(--primary-soft)' : 'var(--surface)',
                  borderColor: isDark ? 'var(--border)' : 'var(--border)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-6"
                  style={{ background: isDark ? 'var(--primary-soft)' : 'var(--surface)' }}
                >{icon}</div>
                <h3 className="font-bold text-lg mb-2" style={{ color: isDark ? 'var(--white)' : 'var(--primary-dark)' }}>{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════
            HOW IT WORKS
        ════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          className="py-20 px-4"
          style={{ background: isDark ? 'var(--bg)' : 'var(--bg)' }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <span
                className="text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full border"
                style={{ color: isDark ? 'var(--primary-light)' : 'var(--primary-dark)', background: 'var(--primary-soft)', borderColor: 'var(--primary-border)' }}
              >
                {t('simpleProcess')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: isDark ? 'var(--white)' : 'var(--text)' }}>
                {t('howItWorksTitle')}
              </h2>
              <p className="text-sm text-slate-400">
                {t('processDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { n: 1, title: t('step1Title'), desc: t('step1Desc') },
                { n: 2, title: t('step2Title'), desc: t('step2Desc') },
                { n: 3, title: t('step3Title'), desc: t('step3Desc') },
                { n: 4, title: t('step4Title'), desc: t('step4Desc') },
              ].map(({ n, title, desc }) => (
                <div
                  key={n}
                  className="p-6 rounded-2xl shadow-sm border relative"
                  style={{
                    background: isDark ? 'var(--card-bg)' : 'var(--white)',
                    borderColor: 'var(--primary-border)',
                  }}
                >
                  <div
                    className="absolute -top-4 left-6 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white"
                    style={{ background: 'var(--primary-light)' }}
                  >{n}</div>
                  <h3 className="font-bold text-base mb-2 pt-4" style={{ color: isDark ? 'var(--white)' : 'var(--text)' }}>{title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════
            FOOTER
        ════════════════════════════════════════════ */}
        <footer
          className="py-12 px-4 border-t"
          style={{
            background: 'var(--primary-dark)',
            borderColor: 'var(--primary-border)',
          }}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src="/assets/optimized/mint-logo.webp" alt="MiNT Daycare" className="h-9 w-9 rounded-full object-contain" />
              <span className="font-bold text-lg text-white tracking-tight">MiNT Daycare</span>
            </div>
            <p className="text-xs text-slate-500">
              {t('footerRights')}
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default Home;
