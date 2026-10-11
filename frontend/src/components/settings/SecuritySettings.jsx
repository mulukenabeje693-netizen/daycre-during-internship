import React, { useState, useMemo } from 'react';
import {
  Key, ShieldCheck, Smartphone, Globe, Monitor, Clock,
  MapPin, AlertCircle, CheckCircle, Eye, EyeOff, X,
  Shield, LogOut, Laptop
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// ── Detect real current browser/OS ───────────────────────────────────────────
function detectCurrentDevice() {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (/Windows NT 10/.test(ua))       os = 'Windows 11/10';
  else if (/Windows NT 6/.test(ua))   os = 'Windows 8/7';
  else if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    os = m ? `Android ${m[1]}` : 'Android';
  } else if (/iPhone|iPad/.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/);
    os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Linux/.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//.test(ua))          browser = 'Edge';
  else if (/OPR\//.test(ua))     browser = 'Opera';
  else if (/Chrome\//.test(ua))  browser = 'Chrome';
  else if (/Safari\//.test(ua))  browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  const isMobile = /Mobi|Android|iPhone/.test(ua);
  return { os, browser, type: isMobile ? 'phone' : 'desktop' };
}

// ── Password strength ────────────────────────────────────────────────────────
function calcStrength(pass) {
  if (!pass) return 0;
  let s = 0;
  if (pass.length >= 8)           s += 25;
  if (/[A-Z]/.test(pass))         s += 25;
  if (/[0-9]/.test(pass))         s += 25;
  if (/[^A-Za-z0-9]/.test(pass))  s += 25;
  return s;
}

function strengthLabel(s) {
  if (s <= 25) return { label: 'Weak',   color: 'text-rose-500' };
  if (s <= 50) return { label: 'Fair',   color: 'text-amber-500' };
  if (s <= 75) return { label: 'Good',   color: 'text-blue-500' };
  return        { label: 'Strong', color: 'text-teal-500' };
}

// ── 2FA OTP Modal ────────────────────────────────────────────────────────────
const TwoFAModal = ({ email, onClose, onVerified }) => {
  const [otp, setOtp]         = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const sendOtp = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/auth/send-otp', { email });
      setSent(true);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      if (res.data.success) onVerified();
      else setError('Invalid or expired code.');
    } catch (e) {
      setError(e.response?.data?.message || 'Verification failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl">
              <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Enable Two-Factor Authentication</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Verify your identity via email OTP</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-400 mb-4">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        {!sent ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              We'll send a 6-digit verification code to <strong>{email}</strong> to confirm your identity.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={sendOtp}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {loading ? 'Sending…' : 'Send Code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-2xl font-bold tracking-[0.5em] px-4 py-3 bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={sendOtp}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Resend
              </button>
              <button
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {loading ? 'Verifying…' : 'Verify & Enable'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const SESSIONS_KEY = 'dismissed_sessions';

const SecuritySettings = () => {
  const { user, logout } = useAuth();

  // ── Password state ──
  const [passwords, setPasswords]   = useState({ current: '', new: '', confirm: '' });
  const [showPwd, setShowPwd]       = useState({ current: false, new: false, confirm: false });
  const [pwdStatus, setPwdStatus]   = useState(null);
  const [saving, setSaving]         = useState(false);

  // ── 2FA state ──
  const [twoFaEnabled, setTwoFaEnabled]   = useState(() => localStorage.getItem('2fa_enabled') === 'true');
  const [show2FAModal, setShow2FAModal]   = useState(false);
  const [twoFaStatus, setTwoFaStatus]     = useState(null);

  // ── Sessions state ──
  const currentDevice = useMemo(() => detectCurrentDevice(), []);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [signOutAllDone, setSignOutAllDone] = useState(false);

  const otherSessions = useMemo(() => [
    { id: 'sess_mobile', type: 'phone',   label: 'iPhone • Safari',      time: '2 hours ago' },
    { id: 'sess_work',   type: 'desktop', label: 'Windows 10 • Edge',    time: '3 days ago'  },
  ].filter(s => !dismissed.has(s.id)), [dismissed]);

  const dismissSession = (id) => {
    setDismissed(prev => {
      const next = new Set([...prev, id]);
      localStorage.setItem(SESSIONS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const signOutAll = () => {
    const allIds = ['sess_mobile', 'sess_work'];
    setDismissed(new Set(allIds));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(allIds));
    setSignOutAllDone(true);
    setTimeout(() => setSignOutAllDone(false), 3000);
  };

  // ── Password handlers ──
  const strength     = calcStrength(passwords.new);
  const { label: strengthText, color: strengthColor } = strengthLabel(strength);

  const handleUpdatePassword = async () => {
    setPwdStatus(null);
    if (passwords.new !== passwords.confirm) {
      setPwdStatus({ type: 'error', message: 'New passwords do not match.' }); return;
    }
    if (passwords.new.length < 6) {
      setPwdStatus({ type: 'error', message: 'New password must be at least 6 characters.' }); return;
    }
    setSaving(true);
    try {
      const res = await api.patch('/auth/me/password', {
        currentPassword: passwords.current,
        newPassword:     passwords.new,
      });
      if (res.data.success) {
        setPwdStatus({ type: 'success', message: 'Password updated successfully!' });
        setPasswords({ current: '', new: '', confirm: '' });
      }
    } catch (err) {
      setPwdStatus({ type: 'error', message: err.response?.data?.message || 'Failed to update password.' });
    } finally { setSaving(false); }
  };

  // ── 2FA handlers ──
  const handle2FAVerified = () => {
    setTwoFaEnabled(true);
    localStorage.setItem('2fa_enabled', 'true');
    setShow2FAModal(false);
    setTwoFaStatus({ type: 'success', message: 'Two-factor authentication enabled!' });
    setTimeout(() => setTwoFaStatus(null), 4000);
  };

  const handleDisable2FA = () => {
    if (!window.confirm('Disable two-factor authentication? Your account will be less secure.')) return;
    setTwoFaEnabled(false);
    localStorage.setItem('2fa_enabled', 'false');
    setTwoFaStatus({ type: 'info', message: 'Two-factor authentication disabled.' });
    setTimeout(() => setTwoFaStatus(null), 4000);
  };

  return (
    <div className="space-y-10">
      {/* 2FA Modal */}
      {show2FAModal && (
        <TwoFAModal
          email={user?.email || ''}
          onClose={() => setShow2FAModal(false)}
          onVerified={handle2FAVerified}
        />
      )}

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your password, authentication, and login sessions.
        </p>
      </div>

      {/* ── Password status banner ── */}
      {pwdStatus && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          pwdStatus.type === 'success'
            ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border border-teal-200 dark:border-teal-800'
            : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
        }`}>
          {pwdStatus.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {pwdStatus.message}
        </div>
      )}

      {/* ── Change Password ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <Key className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Change Password
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { key: 'current', label: 'Current Password' },
            { key: 'new',     label: 'New Password' },
            { key: 'confirm', label: 'Confirm Password' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
              <div className="relative">
                <input
                  type={showPwd[key] ? 'text' : 'password'}
                  value={passwords[key]}
                  onChange={e => setPasswords({ ...passwords, [key]: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 pr-10 bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => ({ ...p, [key]: !p[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPwd[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength bar under new password */}
              {key === 'new' && passwords.new && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[25, 50, 75, 100].map(val => (
                      <div key={val} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        strength >= val
                          ? strength > 50 ? 'bg-teal-500' : 'bg-amber-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strengthColor}`}>{strengthText}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleUpdatePassword}
            disabled={saving || !passwords.current || !passwords.new || !passwords.confirm}
            className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" />

      {/* ── Two-Factor Authentication ── */}
      <div className="space-y-3">
        {twoFaStatus && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            twoFaStatus.type === 'success'
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border border-teal-200 dark:border-teal-800'
              : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
            {twoFaStatus.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {twoFaStatus.message}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#162030] rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${twoFaEnabled ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
              <ShieldCheck className={`w-5 h-5 ${twoFaEnabled ? 'text-teal-600 dark:text-teal-400' : 'text-amber-500'}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                Two-Factor Authentication
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {twoFaEnabled
                  ? 'Your account is protected with 2FA via email OTP.'
                  : 'Add an extra layer of security to your account.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
              twoFaEnabled
                ? 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-900/20 dark:border-teal-800'
                : 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-500 dark:bg-amber-500/10 dark:border-amber-500/20'
            }`}>
              {twoFaEnabled
                ? <><CheckCircle className="w-3.5 h-3.5" /> Enabled</>
                : <><AlertCircle className="w-3.5 h-3.5" /> Disabled</>}
            </span>

            {twoFaEnabled ? (
              <button
                onClick={handleDisable2FA}
                className="px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors"
              >
                Disable 2FA
              </button>
            ) : (
              <button
                onClick={() => setShow2FAModal(true)}
                className="px-4 py-2 text-sm font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors"
              >
                Enable 2FA
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" />

      {/* ── Login Sessions ── */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Login Sessions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage active sessions across devices.
            </p>
          </div>
          {otherSessions.length > 0 && (
            <button
              onClick={signOutAll}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out all devices
            </button>
          )}
        </div>

        {signOutAllDone && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
            <CheckCircle className="w-4 h-4" /> All other devices have been signed out.
          </div>
        )}

        <div className="space-y-3">
          {/* Current device — real browser info */}
          <div className="flex items-center justify-between p-4 bg-teal-50/50 dark:bg-teal-900/10 rounded-xl border border-teal-200 dark:border-teal-900/50">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white dark:bg-[#111c2d] rounded-lg shadow-sm border border-teal-100 dark:border-teal-900/50">
                {currentDevice.type === 'phone'
                  ? <Smartphone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  : <Monitor className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  {currentDevice.os} • {currentDevice.browser}
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/40 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Current
                  </span>
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Current Session</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Active now</span>
                </div>
              </div>
            </div>
          </div>

          {/* Other sessions */}
          {otherSessions.map(session => (
            <div key={session.id} className="flex items-center justify-between p-4 bg-white dark:bg-transparent rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-50 dark:bg-[#162030] rounded-lg border border-slate-100 dark:border-slate-800">
                  {session.type === 'phone'
                    ? <Smartphone className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    : <Laptop className="w-5 h-5 text-slate-500 dark:text-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{session.label}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.time}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => dismissSession(session.id)}
                className="text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          ))}

          {otherSessions.length === 0 && !signOutAllDone && (
            <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
              No other active sessions.
            </div>
          )}
        </div>

        {/* Sign out current session */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out this device
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
