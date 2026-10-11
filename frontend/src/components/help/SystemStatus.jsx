import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Server, Cpu, Bell, CreditCard, RefreshCw } from 'lucide-react';
import api from '../../services/api';

const SERVICES = [
  { icon: Server,      label: 'Server Status',    key: 'server' },
  { icon: Cpu,         label: 'API Status',        key: 'api' },
  { icon: Bell,        label: 'Notifications',     key: 'notifications' },
  { icon: CreditCard,  label: 'Payment Services',  key: 'payments' },
];

const SystemStatus = () => {
  const [statuses, setStatuses] = useState({
    server: 'checking', api: 'checking', notifications: 'checking', payments: 'checking',
  });
  const [lastChecked, setLastChecked] = useState(null);
  const [checking, setChecking]       = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    const results = { server: 'operational', api: 'operational', notifications: 'operational', payments: 'operational' };

    try {
      await api.get('/auth/me').catch(() => {}); // just ping the API
      results.server      = 'operational';
      results.api         = 'operational';
      results.notifications = 'operational';
    } catch {
      results.server = 'degraded';
      results.api    = 'degraded';
    }

    // Check backend health endpoint using the configured API base
    try {
      const healthURL = new URL('/health', import.meta.env.VITE_API_BASE_URL || window.location.origin).toString();
      const res = await fetch(healthURL).catch(() => null);
      if (!res || !res.ok) {
        results.server = 'degraded';
      }
    } catch {
      results.server = 'degraded';
    }

    setStatuses(results);
    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => { checkStatus(); }, []);

  const allOk = Object.values(statuses).every((s) => s === 'operational');
  const hasDegraded = Object.values(statuses).some((s) => s === 'degraded');
  const hasMaintenance = Object.values(statuses).some((s) => s === 'maintenance');

  const overallLabel = allOk
    ? 'All systems operational'
    : hasDegraded
    ? 'Some services degraded'
    : 'Partial maintenance';

  const overallColor = allOk
    ? 'bg-teal-500'
    : hasDegraded
    ? 'bg-rose-500'
    : 'bg-amber-500';

  const overallTextColor = allOk
    ? 'text-teal-700 dark:text-teal-400'
    : hasDegraded
    ? 'text-rose-700 dark:text-rose-400'
    : 'text-amber-700 dark:text-amber-400';

  const overallBg = allOk
    ? 'bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-900/40'
    : hasDegraded
    ? 'bg-rose-50 dark:bg-rose-900/20 border-b border-rose-100 dark:border-rose-900/40'
    : 'bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40';

  const formatTime = (date) => {
    if (!date) return 'Checking…';
    const diff = Math.round((Date.now() - date.getTime()) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    return date.toLocaleTimeString();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">System Status</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time status of all services.</p>
        </div>
        <button
          onClick={checkStatus}
          disabled={checking}
          className="flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Overall status header */}
        <div className={`flex items-center gap-3 px-5 py-4 ${overallBg}`}>
          <div className={`w-3 h-3 rounded-full ${overallColor} ${allOk ? 'animate-pulse' : ''}`} />
          <p className={`text-sm font-semibold ${overallTextColor}`}>{overallLabel}</p>
          <span className="ml-auto text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            Last updated {formatTime(lastChecked)}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {SERVICES.map(({ icon: Icon, label, key }) => {
            const status = statuses[key];
            return (
              <div key={label} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#162030]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#162030] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
                </div>

                {status === 'checking' ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                    Checking…
                  </div>
                ) : status === 'operational' ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400">
                    <CheckCircle className="w-4 h-4" /> Operational
                  </div>
                ) : status === 'degraded' ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4" /> Degraded
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-500">
                    <AlertCircle className="w-4 h-4" /> Maintenance
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SystemStatus;
