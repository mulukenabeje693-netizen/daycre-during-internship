import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/useLanguage';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

const GOOGLE_CLIENT_ID = '436667905909-jocqfvjm8q27n7kskctt1flb35glutv8.apps.googleusercontent.com';

const Login = () => {
  const { login, googleLogin, user, redirectUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Theme state
  // Theme state — dark by default. Only use saved preference if user explicitly toggled to light on this page.
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('login-theme');
    return saved || 'dark';
  });

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(null); // kept for UI compat, always null locally
  const googleBtnRef = useRef(null);

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

  // Handle query params like session expired
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setErrorMsg('⚠️ Your session has expired. Please sign in again.');
    }
  }, [searchParams]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Callback that handles the credential returned by Google
  const handleGoogleCredential = async (response) => {
    if (response.credential) {
      const result = await googleLogin(response.credential);
      if (!result.success) {
        setErrorMsg(result.message || 'Google sign-in failed.');
      } else if (result.user) {
        redirectUser(result.user.role);
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
          text: 'signin_with',
          shape: 'rectangular',
          width: 320,
        });
      } else {
        setTimeout(tryRender, 300);
      }
    };
    tryRender();
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    if (!window.google) {
      setErrorMsg('Google Sign-In is not loaded yet. Please refresh the page.');
      setIsGoogleLoading(false);
      return;
    }
    setIsGoogleLoading(true);

    // Click the hidden Google-rendered button — this opens Google's real account chooser popup
    const btn = googleBtnRef.current?.querySelector('div[role="button"], button');
    if (btn) {
      btn.click();
      // Loading state will be cleared in handleGoogleCredential callback
      return;
    }

    if (window.google?.accounts?.id?.prompt) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setErrorMsg('Google sign-in unavailable. Please refresh the page and try again.');
          setIsGoogleLoading(false);
        }
      });
    } else {
      setErrorMsg('Google Sign-In is not available right now. Please refresh the page.');
      setIsGoogleLoading(false);
    }
  };

  // ⚡ Preload protected dashboard bundles in the background on interaction
  const preloadDashboards = () => {
    import('../pages/dashboards/AdminDashboard').catch(() => {});
    import('../pages/dashboards/ParentDashboard').catch(() => {});
    import('../pages/dashboards/TeacherDashboard').catch(() => {});
    import('../pages/dashboards/ReceptionDashboard').catch(() => {});
  };

  // Clears any running retry countdown (no-op locally — kept for safety)
  const clearRetry = () => {
    setRetryCountdown(null);
  };

  // scheduleRetry removed — server runs locally and is always available.
  // Network errors now show a plain message instead of an auto-retry loop.

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearRetry();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('⚠️ Please enter both your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        console.error('Login failed:', result);
        const msg = result.status === 401
          ? `❌ ${result.message} — try resetting your password.`
          : `❌ ${result.message || 'Login failed. Please try again.'}`;
        setErrorMsg(msg);
        setPassword('');
      } else if (result.user) {
        redirectUser(result.user.role);
      }
    } catch (error) {
      console.error('Login exception:', error);
      setErrorMsg(`❌ ${error.message || 'Login failed. Please try again.'}`);
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="auth-page min-h-screen w-full max-w-full flex items-center justify-center py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative overflow-x-hidden transition-colors duration-200">

      {/* Background Image Layer (Light or Dark swap) */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center no-repeat transition-all duration-500 scale-[1.05]"
        style={{
          backgroundImage: `url('${theme === 'dark' ? '/assets/optimized/darkmode.webp' : '/assets/optimized/login.webp'}')`,
          filter: theme === 'dark' ? 'none' : 'brightness(1.15)',
        }}
      />

      {/* Light airy overlay (Light Mode Only) */}
      {theme !== 'dark' && (
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 60% 20%, rgba(22,196,201,0.12) 0%, transparent 55%),
              radial-gradient(ellipse at 20% 80%, rgba(22,196,201,0.08) 0%, transparent 50%),
              linear-gradient(160deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.12) 100%)
            `
          }}
        />
      )}

      {/* Center Auth Card */}
      <div className="auth-box relative z-10 w-full max-w-[420px] rounded-[28px] overflow-visible bg-transparent border border-[var(--white-soft)] dark:border-[var(--glass-border)] shadow-[0_4px_6px_rgba(15,23,42,0.06),0_20px_60px_rgba(15,23,42,0.18),0_0_0_6px_rgba(255,255,255,0.25)] dark:shadow-[0_4px_6px_rgba(0,0,0,0.2),0_20px_60px_rgba(0,0,0,0.4)]">

        {/* Teal Header */}
        <div className="auth-header rounded-t-[28px] pt-10 pb-28 px-8 text-center relative"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(135deg, #2a7a7a, #1a5c5c)'
              : 'linear-gradient(135deg, var(--primary), var(--primary-dark))'
          }}>
          <div className="ministry-logo w-20 h-20 mx-auto mb-4 bg-white/15 border border-white/30 rounded-2xl flex items-center justify-center p-2 shadow-lg">
            <img
              src="/assets/optimized/icon.webp"
              alt="Logo"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight m-0 mb-1">{t('welcomeBack')}</h1>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider m-0">{t('mintDeclare')}</p>
        </div>

        {/* Body Container */}
        <div className="auth-body relative rounded-t-[40px] rounded-b-[28px] pt-14 pb-8 px-8 -mt-[60px] border-t-4 shadow-[0_-8px_20px_rgba(0,0,0,0.12)] z-20 transition-colors"
          style={{ background: theme === 'dark' ? '#0B151C' : '#ffffff', borderColor: '#F5C518' }}>

          {/* Teal shield badge on the seam */}
          <div className="auth-shield-badge absolute -top-[26px] left-1/2 -translate-x-1/2 w-[52px] h-[52px] rounded-full flex items-center justify-center z-30"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', border: '2.5px solid #F5C518', boxShadow: '0 4px 16px rgba(245,197,24,0.45), 0 0 0 4px rgba(245,197,24,0.18)' }}>
            <svg className="w-[22px] h-[22px] text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="M12 11v4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </div>

          {/* Alert Message Box */}
          {errorMsg && (
            <div className="p-4 mb-4 rounded-xl text-xs leading-relaxed border text-left font-semibold"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
              {errorMsg}
              {retryCountdown !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-grow h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.12)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${(retryCountdown / 5) * 100}%`,
                        background: 'var(--danger)'
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: 'var(--danger)' }}>
                    Retrying in {retryCountdown}s…
                  </span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="email"
                className="block text-[13px] font-bold login-label"
                style={{ color: theme === 'dark' ? '#ffffff' : 'var(--text)', WebkitTextFillColor: theme === 'dark' ? '#ffffff' : undefined }}>
                {t('emailLabel')}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
                  style={{ color: theme === 'dark' ? '#94a3b8' : 'var(--muted)' }}>
                  <i className="bx bx-envelope text-lg"></i>
                </span>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 border rounded-[2rem] text-[0.9rem] focus:outline-none focus:ring-4 transition-all duration-200"
                  style={{
                    background: theme === 'dark' ? '#0d1e2c' : '#ffffff',
                    color: theme === 'dark' ? '#F5F7F8' : 'var(--text)',
                    borderColor: theme === 'dark' ? 'rgba(0,174,181,0.25)' : 'var(--border)',
                  }}
                  placeholder={t('emailPlaceholder')}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label htmlFor="password"
                  className="block text-[13px] font-bold login-label"
                  style={{ color: theme === 'dark' ? '#ffffff' : 'var(--text)', WebkitTextFillColor: theme === 'dark' ? '#ffffff' : undefined }}>
                  {t('passwordLabel')}
                </label>
                <Link to="/forgot-password" className="text-xs font-bold hover:underline"
                  style={{ color: theme === 'dark' ? '#ffffff' : 'var(--primary-dark)' }}>
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
                  style={{ color: theme === 'dark' ? '#94a3b8' : 'var(--muted)' }}>
                  <i className="bx bx-lock-alt text-lg"></i>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-2.5 border rounded-[2rem] text-[0.9rem] focus:outline-none focus:ring-4 transition-all duration-200"
                  style={{
                    background: theme === 'dark' ? '#0d1e2c' : '#ffffff',
                    color: theme === 'dark' ? '#F5F7F8' : 'var(--text)',
                    borderColor: theme === 'dark' ? 'rgba(0,174,181,0.25)' : 'var(--border)',
                  }}
                  placeholder={t('passwordPlaceholder')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center hover:transition-colors focus:outline-none"
                  style={{ color: theme === 'dark' ? '#94a3b8' : 'var(--muted)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <i className="bx bx-hide text-lg"></i> : <i className="bx bx-show text-lg"></i>}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              onMouseEnter={preloadDashboards}
              onFocus={preloadDashboards}
              onTouchStart={preloadDashboards}
              className="w-full py-3.5 text-[15px] font-bold text-white rounded-[2rem] bg-[var(--primary-dark)] border-none shadow-[0_4px_14px_rgba(0,107,112,0.35)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,107,112,0.45)] active:translate-y-0 transition-all duration-200 focus:outline-none flex items-center justify-center gap-2"
              style={{ boxShadow: 'var(--shadow-glow-secondary)' }}
            >
              {isSubmitting ? t('signingIn') : t('loginBtn')}
              <i className="bx bx-right-arrow-alt text-xl"></i>
            </button>

            {/* Continue with section */}
            <div className="flex items-center my-4">
              <div className="flex-grow border-t" style={{ borderColor: theme === 'dark' ? 'rgba(0,174,181,0.2)' : 'var(--border)' }}></div>
              <span className="px-3 text-[11px]" style={{ color: theme === 'dark' ? '#ffffff' : 'var(--muted)' }}>
                {t('orContinueWith')}
              </span>
              <div className="flex-grow border-t" style={{ borderColor: theme === 'dark' ? 'rgba(0,174,181,0.2)' : 'var(--border)' }}></div>
            </div>

            {/* Social Google Login Button with transparent GIS overlay */}
            <div className="relative w-full overflow-hidden rounded-[2rem]">
              <div
                ref={googleBtnRef}
                className="absolute inset-0 z-10 flex items-center justify-center opacity-[0.0001] cursor-pointer overflow-hidden"
                style={{ transform: 'scale(1.2)' }}
              />
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full py-3 text-xs font-bold border rounded-[2rem] shadow-sm transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: theme === 'dark' ? '#0d1e2c' : '#ffffff',
                  color: theme === 'dark' ? '#e2e8f0' : '#374151',
                  borderColor: theme === 'dark' ? 'rgba(0,174,181,0.25)' : 'var(--border)',
                }}
              >
                {/* Real Google logo SVG with brand colors */}
                <svg className="w-4 h-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                {isGoogleLoading ? t('signingIn') : t('continueWithGoogle')}
              </button>
            </div>

            {/* Create Account Link */}
            <Link
              to="/register"
              className="w-full py-3 text-xs font-bold border rounded-[2rem] shadow-sm transition-all flex items-center justify-center gap-2"
              style={{
                background: theme === 'dark' ? '#0d1e2c' : '#ffffff',
                color: theme === 'dark' ? '#F5F7F8' : 'var(--text)',
                borderColor: theme === 'dark' ? 'rgba(0,174,181,0.25)' : 'var(--border)',
              }}
            >
              <i className="bx bx-user-plus text-lg" style={{ color: theme === 'dark' ? '#94a3b8' : '#475569' }}></i>
              {t('createAccount')}
            </Link>



            <div className="flex items-center justify-center gap-1.5 text-xs mt-4"
              style={{ color: theme === 'dark' ? '#ffffff' : '#94a3b8' }}>
              <i className="bx bx-lock-alt text-sm"></i> Your data is secure with us
            </div>

            <Link
              to="/"
              className="block text-center text-[13px] font-semibold hover:underline mt-4"
              style={{ color: theme === 'dark' ? '#ffffff' : 'var(--primary-light)' }}
            >
              &#8592; {t('navHome')}
            </Link>
          </form>
        </div>
      </div>

      {/* Floating Theme Slide-Toggle in Bottom Right */}
      <div className="fixed bottom-6 right-6 z-55 flex items-center gap-2 bg-white/40 dark:bg-[var(--card-bg)]/40 p-2.5 rounded-full backdrop-blur-md shadow-md border border-white/50 dark:border-[var(--glass-border)]">
        <i className={`bx ${theme === 'dark' ? 'bx-sun text-[var(--primary-light)]' : 'bx-moon text-[var(--primary-dark)]'} text-lg`}></i>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
          <div className="w-10 h-5 bg-[var(--border)] dark:bg-[var(--primary-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner"></div>
        </label>
      </div>

    </div>
  );
};

export default Login;

