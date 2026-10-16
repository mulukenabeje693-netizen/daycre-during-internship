import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ChildList from './ChildList';
import UpdateParentInfo from './UpdateParentInfo';
import { useLanguage } from '../../context/useLanguage';

/* ─────────────────────────────────────────────────────────────
   Badge color map
───────────────────────────────────────────────────────────── */
const badgeColors = {
  amber: {
    active:   'bg-amber-500 text-white',
    inactive: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
  cyan: {
    active:   'bg-cyan-500 text-white',
    inactive: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
  },
};

/* ─────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────── */
const UpdateInfoTabs = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.hash === '#parent' ? 'parent' : 'child'
  );

  const TABS = [
    {
      id: 'child',
      label: t('childInfoTab'),
      icon: 'bx-child',
      badge: { text: t('activeTab'), color: 'amber' },
      description: t('viewUpdateEnrolledChildren'),
    },
    {
      id: 'parent',
      label: t('parentInfoTab'),
      icon: 'bx-group',
      badge: { text: t('updatedTab'), color: 'cyan' },
      description: t('manageRegisteredParents'),
    },
  ];

  /* sync if hash changes (e.g. back-navigation) */
  useEffect(() => {
    if (location.hash === '#parent') setActiveTab('parent');
    else if (location.hash === '#child') setActiveTab('child');
  }, [location.hash]);

  return (
    <div className="space-y-5">

      {/* ── Page heading ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">
          {t('receptionUpdateRecords')}
        </p>
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">
          {t('updateInformation')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('updateInfoSubtitle')}
        </p>
      </div>

      {/* ── Tab switcher card ── */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">

        {/* Tab bar */}
        <div className="flex p-2 gap-2 border-b border-slate-100 dark:border-slate-800">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const bc = badgeColors[tab.badge.color];

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left
                  transition-all duration-200 group outline-none
                  focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1
                  ${isActive
                    ? 'bg-cyan-50/80 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/25 shadow-sm'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                  }
                `}
                aria-selected={isActive}
                role="tab"
              >
                {/* Icon */}
                <span
                  className={`
                    w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                    ${isActive
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-500'
                    }
                  `}
                >
                  <i className={`bx ${tab.icon} text-lg`} />
                </span>

                {/* Label + description */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-bold transition-colors ${
                        isActive
                          ? 'text-cyan-700 dark:text-cyan-300'
                          : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </span>

                    {/* Badge */}
                    <span
                      className={`
                        text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full
                        transition-colors leading-none
                        ${isActive ? bc.active : bc.inactive}
                      `}
                    >
                      {tab.badge.text}
                    </span>
                  </div>

                  {/* Description — hidden on small screens */}
                  <p
                    className={`hidden sm:block text-xs mt-0.5 truncate transition-colors ${
                      isActive
                        ? 'text-cyan-600/70 dark:text-cyan-400/60'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {tab.description}
                  </p>
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        <div className="p-5">
          {activeTab === 'child'  && (
            <div
              key="child"
              className="animate-in fade-in slide-in-from-left-3 duration-200"
            >
              <ChildList />
            </div>
          )}
          {activeTab === 'parent' && (
            <div
              key="parent"
              className="animate-in fade-in slide-in-from-right-3 duration-200"
            >
              <UpdateParentInfo />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateInfoTabs;
