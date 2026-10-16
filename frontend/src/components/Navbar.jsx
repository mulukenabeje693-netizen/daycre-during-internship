import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/useLanguage';
import { useSidebar } from '../context/SidebarContext';
import api from '../services/api';
import NotificationDropdown from './NotificationDropdown';
import ProfilePanel from './ProfilePanel';
import UserAvatar from './common/UserAvatar';
import TranslatorIcon from './common/TranslatorIcon';

const Navbar = ({ pageTitle = 'Dashboard' }) => {
  const { user, logout, setUser } = useAuth();
  const { toggle: toggleSidebar } = useSidebar();
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  /* ── Dark / Light toggle ── */
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  /* ── Profile dropdown ── */
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { locale, setLocale, t, LANGUAGE_OPTIONS } = useLanguage();

  const handleSignOut = () => {
    setProfileOpen(false);
    logout();
    navigate('/login');
  };

  const dateLocales = {
    am: 'am-ET',
    om: 'om-ET',
    ti: 'ti-ET',
    en: 'en-US',
  };
  const formattedDate = new Date().toLocaleDateString(dateLocales[locale] || 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const roleKeyMap = {
    admin: 'admin',
    teacher: 'nanny',
    parent: 'parent',
    reception: 'receptionRole',
    receptionist: 'receptionRole',
    staff: 'staff',
  };
  const roleLabel = t(roleKeyMap[user?.role] || user?.role || '');

  const displayFullName = user?.fullName === 'System Administrator'
    ? t('systemAdministrator')
    : user?.fullName;

  const dashboardBase = `/dashboard/${user?.role}`;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await api.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data && res.data.success) {
        const updated = res.data.user;
        setUser && setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Avatar upload failed', err?.response?.data || err.message || err);
    } finally {
      e.target.value = '';
    }
  };

  const [profilePanelOpen, setProfilePanelOpen] = useState(false);

  const menuItems = [
    { icon: 'bx-user', label: t('myProfile'), action: () => { setProfileOpen(false); setProfilePanelOpen(true); } },
    { icon: 'bx-bell', label: t('notificationsTitle'), action: () => { setProfileOpen(false); window.dispatchEvent(new CustomEvent('openNotifications')); }, badge: null },
    { icon: 'bx-cog', label: t('settings'), action: () => { setProfileOpen(false); navigate(`/dashboard/${user?.role}/settings`); } },
    { icon: 'bx-adjust', label: t('appearance'), action: toggleTheme, extra: isDark ? t('darkMode') : t('lightMode') },
    { icon: 'bx-help-circle', label: t('helpAndSupport'), action: () => { setProfileOpen(false); navigate(`/dashboard/${user?.role}/help`); } },
  ];

  return (
    <header className="
      flex items-center justify-between w-full h-[64px] px-3 sm:px-6 md:px-8
      bg-white dark:bg-[#0A1218]
      border-b border-slate-200 dark:border-[#1E2C35]
      sticky top-0 z-30
      transition-all duration-200
      shadow-sm
    ">
      {/* Left — Hamburger button (mobile) + breadcrumb + title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-[#0F1D26] border border-slate-200 dark:border-[#1E2C35] text-slate-700 dark:text-slate-200 hover:text-[#00ADB5] hover:border-[#00ADB5]/40 transition-all flex-shrink-0"
          aria-label="Toggle navigation menu"
        >
          <i className="bx bx-menu text-2xl" />
        </button>

        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ADB5] leading-none mb-0.5">
            {t('daycare')}
          </span>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight m-0 truncate max-w-[130px] sm:max-w-none">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 flex-shrink-0">

        {/* Date pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-[#0F1D26] border border-slate-200 dark:border-[#1E2C35] text-sm font-semibold text-slate-700 dark:text-white/80">
          <i className="bx bx-calendar text-base text-[#00ADB5]" />
          <span>{formattedDate}</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-[#0F1D26] border border-slate-200 dark:border-[#1E2C35] text-slate-500 dark:text-white/70 hover:text-[#00ADB5] hover:border-[#00ADB5]/40 transition-all flex-shrink-0"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i className={`bx ${isDark ? 'bx-sun' : 'bx-moon'} text-lg`} />
        </button>

        {/* Language selector */}
        <div className="relative flex-shrink-0 flex items-center">
          <div className="pointer-events-none absolute left-2 sm:left-2.5 z-10 flex items-center">
            <TranslatorIcon className="w-4 h-4" />
          </div>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="appearance-none h-9 rounded-xl border border-slate-200 dark:border-[#1E2C35] bg-white dark:bg-[#0F1D26] pl-7 sm:pl-8 pr-7 sm:pr-8 text-xs sm:text-sm font-semibold text-slate-700 dark:text-white shadow-sm outline-none transition-all hover:border-[#00ADB5]/40 min-w-[88px] sm:min-w-[115px] cursor-pointer"
            title="Switch language"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-1.5 sm:right-2 flex items-center text-slate-400">
            <i className="bx bx-chevron-down text-base" />
          </div>
        </div>

        {/* Notifications */}
        <NotificationDropdown role={user?.role} />

        {/* ── Profile pill + dropdown ── */}
        {user && (
          <div className="relative" ref={profileRef}>

            {/* Trigger button */}
            <button
              onClick={() => setProfileOpen(p => !p)}
              className="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-[#1E2C35] focus:outline-none"
            >
              {/* Avatar */}
              <UserAvatar
                user={user}
                size="md"
                showOnline={true}
                ring="ring-2 ring-white dark:ring-[#0A1218]"
              />

              {/* Name + badge */}
              <div className="hidden sm:flex flex-col text-left">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                    {displayFullName}
                  </span>
                  <i className={`bx bx-chevron-down text-slate-400 dark:text-slate-500 text-base transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#00ADB5]/10 text-[#00ADB5] border border-[#00ADB5]/30 w-fit mt-0.5">
                  {roleLabel}
                </span>
              </div>
            </button>

            {/* ── Dropdown panel ── */}
            {profileOpen && (
              <div
                className="absolute right-0 top-[calc(100%+12px)] w-[260px] max-w-[calc(100vw-24px)] bg-white dark:bg-[#111c2d] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[200] overflow-hidden"
                style={{ animation: 'fadeSlideIn 0.18s cubic-bezier(0.16,1,0.3,1)' }}
              >
                {/* Up caret */}
                <div className="absolute -top-2 right-6 w-4 h-4 bg-white dark:bg-[#111c2d] border-l border-t border-slate-100 dark:border-slate-800 rotate-45" />

                {/* User info header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative flex-shrink-0">
                    <UserAvatar
                      user={user}
                      size="lg"
                      showOnline={true}
                      ring="ring-2 ring-white dark:ring-[#111c2d]"
                    />

                    {/* Camera button to upload new avatar */}
                    <button
                      onClick={handleAvatarClick}
                      title="Change avatar"
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-[#0A1218] border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-[#00ADB5] shadow-sm z-10"
                    >
                      <i className="bx bx-camera text-[14px]" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{displayFullName}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{roleLabel}</p>
                  </div>
                </div>

                {/* hidden file input for avatar upload */}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />

                {/* Menu items */}
                <div className="py-2">
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-[#00ADB5]/8 dark:hover:bg-[#00ADB5]/10 hover:text-[#00ADB5] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-[#00ADB5]/15 transition-colors">
                          <i className={`bx ${item.icon} text-base text-slate-500 dark:text-slate-400 group-hover:text-[#00ADB5] transition-colors`} />
                        </div>
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {item.badge != null && item.badge > 0 && (
                        <span className="min-w-[20px] h-5 px-1 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full">
                          {item.badge}
                        </span>
                      )}
                      {item.extra && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          {item.extra}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Sign out */}
                <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-3">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-sm font-semibold group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-100 dark:group-hover:bg-rose-500/20 transition-colors">
                      <i className="bx bx-log-out text-base text-rose-500" />
                    </div>
                    {t('signOut')}
                  </button>
                </div>
              </div>
            )}

            {/* Profile panel modal */}
            <ProfilePanel open={profilePanelOpen} onClose={() => setProfilePanelOpen(false)} />

          </div>
        )}
      </div>

      {/* Dropdown animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
