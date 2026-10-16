import React, { useState } from 'react';
import { Bell, Mail, Smartphone, AlertTriangle, MessageCircle, FileText, UserCheck, CheckCircle } from 'lucide-react';

const STORAGE_KEY = 'notification_preferences';

const DEFAULT_SETTINGS = {
  arrivals: true,
  messages: true,
  reports: false,
  emergency: true,
  email: true,
  push: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    aria-pressed={checked}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-[#111c2d] ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${checked ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

const NotificationSettings = () => {
  const [settings, setSettings] = useState(() => loadSettings());
  const [saved, setSaved] = useState(false);

  const toggle = (key) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Persist immediately on every toggle
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    // Brief confirmation flash
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const categories = [
    {
      title: 'In-App Alerts',
      icon: <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
      items: [
        {
          key: 'arrivals',
          icon: <UserCheck className="w-4 h-4" />,
          label: 'Child Arrival Alerts',
          desc: 'Notify me when a child checks in or out.',
        },
        {
          key: 'messages',
          icon: <MessageCircle className="w-4 h-4" />,
          label: 'Parent Messages',
          desc: 'Receive alerts for new direct messages.',
        },
        {
          key: 'reports',
          icon: <FileText className="w-4 h-4" />,
          label: 'Daily Report Reminder',
          desc: 'Remind me to submit daily reports.',
        },
        {
          key: 'emergency',
          icon: <AlertTriangle className="w-4 h-4" />,
          label: 'Emergency Alerts',
          desc: 'Critical system and health alerts (cannot be disabled).',
          disabled: true,
        },
      ],
    },
    {
      title: 'Delivery Methods',
      icon: <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
      items: [
        {
          key: 'email',
          icon: <Mail className="w-4 h-4" />,
          label: 'Email Notifications',
          desc: 'Receive daily summaries and offline alerts via email.',
        },
        {
          key: 'push',
          icon: <Smartphone className="w-4 h-4" />,
          label: 'Push Notifications',
          desc: 'Receive instant notifications on this device.',
        },
      ],
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Notification Preferences</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Control how and when you receive alerts.</p>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </div>
        )}
      </div>

      <div className="space-y-8">
        {categories.map((category, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              {category.icon} {category.title}
            </h3>
            <div className="bg-white dark:bg-transparent rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/50">
              {category.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-[#162030]/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-[#1a2638] rounded-lg text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{item.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 leading-snug max-w-[280px] sm:max-w-md">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={settings[item.key]}
                    onChange={() => !item.disabled && toggle(item.key)}
                    disabled={item.disabled}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationSettings;
