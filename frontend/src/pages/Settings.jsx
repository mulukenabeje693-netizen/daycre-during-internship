import React, { useState } from 'react';
import { User, Shield, Bell, Palette, Globe, Lock, Smartphone } from 'lucide-react';
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import LanguagePrivacySettings from '../components/settings/LanguagePrivacySettings';
import DevicesSettings from '../components/settings/DevicesSettings';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'privacy', label: 'Privacy', icon: Lock },
  { id: 'devices', label: 'Connected Devices', icon: Smartphone },
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#080d16] p-6 lg:p-8 flex flex-col font-['Inter',sans-serif]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your account, preferences, and security.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1">
        {/* Left Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden sticky top-8">
            <nav className="flex flex-col p-2 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative
                      ${isActive
                        ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162030] hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-teal-500 rounded-r-full" />
                    )}
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 group-hover:text-slate-500'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 bg-white dark:bg-[#111c2d] rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-8">
            {activeTab === 'profile'       && <ProfileSettings />}
            {activeTab === 'security'      && <SecuritySettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'appearance'    && <AppearanceSettings />}
            {activeTab === 'language'      && <LanguagePrivacySettings type="language" />}
            {activeTab === 'privacy'       && <LanguagePrivacySettings type="privacy" />}
            {activeTab === 'devices'       && <DevicesSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
