import React, { useState } from 'react';
import AttendanceTracker from './AttendanceTracker';
import AdminTeacherAttendance from './AdminTeacherAttendance';
import { useLanguage } from '../../context/useLanguage';

/* ── Tab configuration moved inside component to access t() ────────────────────────────────────── */

/* ── Badge color variants ─────────────────────────────────── */
const BADGE = {
  amber: {
    active:   'bg-amber-500 text-white',
    inactive: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
  cyan: {
    active:   'bg-[#00ADB5] text-white',
    inactive: 'bg-[#00ADB5]/10 text-[#00ADB5]',
  },
};

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
const AttendanceDashboard = () => {
  const [activeTab, setActiveTab] = useState('child');
  const { t } = useLanguage();

  const TABS = [
    {
      id: 'child',
      label: t('childAttendance', 'Child Attendance'),
      subtitle: t('childAttendanceSub', 'Track daily child check-ins and attendance'),
      icon: 'bx-child',
      badge: { text: t('active', 'Active'), color: 'amber' },
    },
    {
      id: 'teacher',
      label: t('childcareProviderAttendance', 'Nanny Attendance'),
      subtitle: t('providerAttendanceSub', 'Monitor Nanny presence synced from reception'),
      icon: 'bx-user-check',
      badge: { text: t('live', 'Live'), color: 'cyan' },
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── Page heading ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#00ADB5] mb-1">
            {t('adminPortalAttendance', 'Admin Portal · Attendance')}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white leading-tight">
            {t('attendanceDashboardTitle', 'Attendance Dashboard')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
          <i className="bx bx-show text-sm text-[#00ADB5]" />
          <span>{t('viewOnlyAttendance', 'View Only')}</span>
        </div>
      </div>

      {/* ── Tab switcher ──────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0d1929] rounded-2xl p-2 flex flex-col sm:flex-row gap-2 border border-slate-200 dark:border-slate-800 shadow-sm">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const bc = BADGE[tab.badge.color];

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`
                relative flex-1 flex items-center gap-4 px-5 py-4 rounded-xl text-left
                transition-all duration-200 outline-none
                focus-visible:ring-2 focus-visible:ring-[#00ADB5] focus-visible:ring-offset-2
                ${isActive
                  ? 'bg-[#00ADB5]/8 border border-[#00ADB5]/40 shadow-sm dark:bg-[#00ADB5]/10 dark:border-[#00ADB5]/30'
                  : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'
                }
              `}
            >
              {/* Icon */}
              <span className={`
                w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                ${isActive
                  ? 'bg-[#00ADB5]/15 text-[#00ADB5] shadow-[0_0_12px_rgba(0,173,181,0.15)]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }
              `}>
                <i className={`bx ${tab.icon} text-xl`} />
              </span>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`text-sm font-bold transition-colors ${
                    isActive
                      ? 'text-[#00ADB5]'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {tab.label}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full leading-none ${
                    isActive ? bc.active : bc.inactive
                  }`}>
                    {tab.badge.text}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 truncate transition-colors ${
                  isActive
                    ? 'text-[#00ADB5]/60'
                    : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {tab.subtitle}
                </p>
              </div>

              {/* Active dot */}
              {isActive && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#00ADB5] shadow-[0_0_6px_rgba(0,173,181,0.6)] animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ───────────────────────────────────── */}
      <div>
        {activeTab === 'child' && (
          <div key="child" className="animate-in fade-in slide-in-from-left-3 duration-200">
            <AttendanceTracker readOnly />
          </div>
        )}
        {activeTab === 'teacher' && (
          <div key="teacher" className="animate-in fade-in slide-in-from-right-3 duration-200">
            <AdminTeacherAttendance />
          </div>
        )}
      </div>

    </div>
  );
};

export default AttendanceDashboard;
