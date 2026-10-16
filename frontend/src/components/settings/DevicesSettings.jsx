import React, { useMemo, useState } from 'react';
import { Laptop, Smartphone, Monitor, MapPin, Clock, ShieldAlert, X, Globe } from 'lucide-react';

// ── Detect real current device info from the browser ────────────────────────

function detectDevice() {
  const ua = navigator.userAgent;

  // OS detection
  let os = 'Unknown OS';
  if (/Windows NT 10/.test(ua)) os = 'Windows 11/10';
  else if (/Windows NT 6/.test(ua)) os = 'Windows 8/7';
  else if (/Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X ([\d_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Android/.test(ua)) {
    const match = ua.match(/Android ([\d.]+)/);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    const match = ua.match(/OS ([\d_]+)/);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Linux/.test(ua)) os = 'Linux';

  // Browser detection
  let browser = 'Unknown Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  // Device type
  const isMobile = /Mobi|Android|iPhone|iPad/.test(ua);
  const isTablet = /iPad/.test(ua);
  const type = isTablet ? 'tablet' : isMobile ? 'phone' : 'desktop';

  return { os, browser, type };
}

function DeviceIcon({ type }) {
  if (type === 'phone') return <Smartphone className="w-6 h-6" />;
  if (type === 'tablet') return <Globe className="w-6 h-6" />;
  if (type === 'desktop') return <Monitor className="w-6 h-6" />;
  return <Laptop className="w-6 h-6" />;
}

// ── Component ────────────────────────────────────────────────────────────────

const DevicesSettings = () => {
  const currentDevice = useMemo(() => detectDevice(), []);

  // Store of dismissed "other" sessions (simulated — in a real app these would
  // come from a sessions collection in the backend)
  const [dismissed, setDismissed] = useState(new Set());

  // Simulated past sessions (static placeholders to demonstrate the UI)
  // In production these would come from GET /api/auth/sessions
  const pastSessions = useMemo(() => [
    { id: 'session_mobile', type: 'phone', os: 'iOS 17', browser: 'Safari', lastActive: '2 hours ago' },
    { id: 'session_work',   type: 'desktop', os: 'Windows 10', browser: 'Edge', lastActive: '3 days ago' },
  ], []);

  const visiblePast = pastSessions.filter((s) => !dismissed.has(s.id));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Connected Devices</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Devices that are currently or recently logged into your account.
          </p>
        </div>
        {visiblePast.length > 0 && (
          <button
            onClick={() => setDismissed(new Set(pastSessions.map((s) => s.id)))}
            className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors whitespace-nowrap border border-rose-200/50 dark:border-rose-500/20"
          >
            Sign out all other devices
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* ── Current Device (real browser info) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border bg-teal-50/30 dark:bg-[#131f30] border-teal-200 dark:border-teal-900/50 transition-all">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
              <DeviceIcon type={currentDevice.type} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                  {currentDevice.os} • {currentDevice.browser}
                </h3>
                <span className="text-[10px] font-bold text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  This Device
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Current Session
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Active now
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Other Sessions ── */}
        {visiblePast.map((session) => (
          <div
            key={session.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border bg-white dark:bg-transparent border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-slate-100 text-slate-500 dark:bg-[#162030] dark:text-slate-400">
                <DeviceIcon type={session.type} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                  {session.os} • {session.browser}
                </h3>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {session.lastActive}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, session.id]))}
              className="mt-4 sm:mt-0 self-start sm:self-auto flex items-center justify-center p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors group"
              title="Sign out this device"
              aria-label="Sign out this device"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        ))}

        {visiblePast.length === 0 && (
          <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
            No other active sessions.
          </div>
        )}
      </div>

      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-amber-800 dark:text-amber-400">Unrecognized device?</h4>
          <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1">
            If you see a device you don't recognize, remove it and change your password immediately.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DevicesSettings;
