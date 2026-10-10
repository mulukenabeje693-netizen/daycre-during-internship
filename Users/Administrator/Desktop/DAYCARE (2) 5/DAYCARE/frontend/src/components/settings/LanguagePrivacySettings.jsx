import React, { useState } from 'react';
import { Globe, Clock, Shield, EyeOff, Eye, Download, Trash2, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIVACY_KEY = 'privacy_preferences';
const TZ_KEY = 'user_timezone';

const DEFAULT_PRIVACY = {
  hideEmail: true,
  hidePhone: false,
  activityVisibility: true,
};

function loadPrivacy() {
  try {
    const raw = localStorage.getItem(PRIVACY_KEY);
    return raw ? { ...DEFAULT_PRIVACY, ...JSON.parse(raw) } : { ...DEFAULT_PRIVACY };
  } catch {
    return { ...DEFAULT_PRIVACY };
  }
}

// ── Toggle component ──────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    aria-pressed={checked}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-[#111c2d] ${
      checked ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

// ── Language view ─────────────────────────────────────────────────────────────

const LanguageView = () => {
  const { locale, setLocale, LANGUAGE_OPTIONS } = useLanguage();

  // Timezone — persisted to localStorage
  const [timezone, setTimezone] = useState(
    () => localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Addis_Ababa'
  );
  const [tzSaved, setTzSaved] = useState(false);

  const timezones = [
    'Africa/Addis_Ababa',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Asia/Dubai',
  ];

  const handleTimezoneChange = (tz) => {
    setTimezone(tz);
    localStorage.setItem(TZ_KEY, tz);
    setTzSaved(true);
    setTimeout(() => setTzSaved(false), 1500);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Language &amp; Region</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Set your preferred language and local timezone.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Language Selector */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Interface Language
          </label>
          <div className="relative">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full appearance-none px-4 py-3 bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all cursor-pointer font-medium"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This will change the language used throughout the application.
          </p>
        </div>

        {/* Timezone Selector */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Timezone
            {tzSaved && (
              <span className="ml-auto flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </label>
          <div className="relative">
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full appearance-none px-4 py-3 bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all cursor-pointer font-medium"
            >
              {timezones.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Affects how dates and times are displayed.</p>
        </div>
      </div>
    </div>
  );
};

// ── Privacy view ──────────────────────────────────────────────────────────────

const PrivacyView = () => {
  const { user } = useAuth();
  const [privacy, setPrivacy] = useState(() => loadPrivacy());
  const [privSaved, setPrivSaved] = useState(false);

  const [deleteStatus, setDeleteStatus] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState(null);

  const togglePrivacy = (key) => {
    setPrivacy((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(next));
      return next;
    });
    setPrivSaved(true);
    setTimeout(() => setPrivSaved(false), 1500);
  };

  const handleDownload = () => {
    if (!user) return;
    setDownloadStatus('loading');
    try {
      // Build a JSON export of the user's own data
      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: {
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          joinedAt: user.createdAt,
        },
        privacyPreferences: privacy,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadStatus('done');
      setTimeout(() => setDownloadStatus(null), 2000);
    } catch {
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus(null), 2000);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete your account? This action cannot be undone.'
    );
    if (!confirmed) return;
    setDeleteStatus('loading');
    try {
      await api.delete('/auth/me');
      // Clear local storage and redirect to login
      localStorage.clear();
      window.location.href = '/login';
    } catch (err) {
      setDeleteStatus('error');
      setTimeout(() => setDeleteStatus(null), 3000);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Privacy &amp; Data</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage what information is visible and control your data.</p>
        </div>
        {privSaved && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </div>
        )}
      </div>

      {/* Profile Visibility */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Profile Visibility
        </h3>
        <div className="bg-white dark:bg-transparent rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/50">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-2">
                {privacy.hideEmail ? (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                ) : (
                  <Eye className="w-4 h-4 text-teal-500" />
                )}{' '}
                Hide Email Address
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                Prevent other staff members from seeing your email.
              </p>
            </div>
            <Toggle checked={privacy.hideEmail} onChange={() => togglePrivacy('hideEmail')} />
          </div>

          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-2">
                {privacy.hidePhone ? (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                ) : (
                  <Eye className="w-4 h-4 text-teal-500" />
                )}{' '}
                Hide Phone Number
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                Keep your phone number private from other users.
              </p>
            </div>
            <Toggle checked={privacy.hidePhone} onChange={() => togglePrivacy('hidePhone')} />
          </div>

          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-2">
                {privacy.activityVisibility ? (
                  <Eye className="w-4 h-4 text-teal-500" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}{' '}
                Show Online Status
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                Let others know when you are actively using the app.
              </p>
            </div>
            <Toggle checked={privacy.activityVisibility} onChange={() => togglePrivacy('activityVisibility')} />
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" />

      {/* Data Management */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Data Management</h3>

        {deleteStatus === 'error' && (
          <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Failed to delete account. Please contact support.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleDownload}
            disabled={downloadStatus === 'loading'}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-slate-50 dark:bg-[#162030] hover:bg-slate-100 dark:hover:bg-[#1a2638] border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-60"
          >
            {downloadStatus === 'loading' ? (
              <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : downloadStatus === 'done' ? (
              <CheckCircle className="w-4 h-4 text-teal-500" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {downloadStatus === 'done' ? 'Downloaded!' : 'Download My Data'}
          </button>

          <button
            onClick={handleDeleteAccount}
            disabled={deleteStatus === 'loading'}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 rounded-xl text-sm font-medium text-rose-700 dark:text-rose-400 transition-colors disabled:opacity-60 group"
          >
            {deleteStatus === 'loading' ? (
              <div className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-500 rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
            {deleteStatus === 'loading' ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main export ───────────────────────────────────────────────────────────────

const LanguagePrivacySettings = ({ type }) => {
  if (type === 'language') return <LanguageView />;
  return <PrivacyView />;
};

export default LanguagePrivacySettings;
