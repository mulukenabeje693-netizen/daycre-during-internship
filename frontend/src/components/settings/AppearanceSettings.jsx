import React from 'react';
import { Palette, Type, Sun, Moon, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const AppearanceSettings = () => {
  const { theme, setTheme, accent, setAccent, fontSize, setFontSize } = useTheme();

  const themes = [
    {
      id: 'light',
      label: 'Light',
      icon: Sun,
      preview: {
        bg: 'bg-slate-100',
        sidebar: 'bg-teal-800',
        card: 'bg-white',
        bar1: 'bg-slate-200',
        bar2: 'bg-slate-200',
      },
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: Moon,
      preview: {
        bg: 'bg-slate-900',
        sidebar: 'bg-teal-950',
        card: 'bg-slate-800',
        bar1: 'bg-slate-600',
        bar2: 'bg-slate-700',
      },
    },
  ];

  const accents = [
    { id: 'teal',   color: 'bg-teal-500',   ring: 'ring-teal-300',   label: 'Teal'   },
    { id: 'indigo', color: 'bg-indigo-500', ring: 'ring-indigo-300', label: 'Indigo' },
    { id: 'rose',   color: 'bg-rose-500',   ring: 'ring-rose-300',   label: 'Rose'   },
    { id: 'amber',  color: 'bg-amber-500',  ring: 'ring-amber-300',  label: 'Amber'  },
    { id: 'blue',   color: 'bg-blue-500',   ring: 'ring-blue-300',   label: 'Blue'   },
  ];

  const fonts = [
    { id: 'small',  label: 'Aa', desc: 'Small',  style: { fontSize: '0.8rem' }  },
    { id: 'medium', label: 'Aa', desc: 'Medium', style: { fontSize: '1.1rem' }  },
    { id: 'large',  label: 'Aa', desc: 'Large',  style: { fontSize: '1.5rem' }  },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Appearance</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize the interface, colors, and text size. Changes apply instantly.
        </p>
      </div>

      {/* ── Theme Mode ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <Moon className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Theme Mode
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {themes.map((t) => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                aria-pressed={isActive}
                className={`relative group p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                  isActive
                    ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10 shadow-md'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                }`}
              >
                {isActive && (
                  <span className="absolute top-3 right-3 bg-teal-500 text-white rounded-full p-0.5 shadow-sm">
                    <Check className="w-3 h-3" />
                  </span>
                )}

                {/* Mini UI preview */}
                <div className={`w-full h-20 rounded-lg mb-3 overflow-hidden flex ${t.preview.bg}`}>
                  {/* Sidebar strip */}
                  <div className={`w-6 h-full flex-shrink-0 ${t.preview.sidebar}`} />
                  {/* Content area */}
                  <div className={`flex-1 p-2 flex flex-col gap-1.5 ${t.preview.card}`}>
                    <div className={`h-2 w-3/4 rounded-sm ${t.preview.bar1}`} />
                    <div className={`h-1.5 w-1/2 rounded-sm ${t.preview.bar2}`} />
                    <div className={`h-1.5 w-2/3 rounded-sm mt-auto ${t.preview.bar2}`} />
                  </div>
                </div>

                <p className={`text-sm font-semibold flex items-center gap-2 ${
                  isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  <Icon className="w-4 h-4" /> {t.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      {/* ── Accent Color ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <Palette className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Accent Color
        </h3>
        <div className="flex gap-3 flex-wrap">
          {accents.map((c) => {
            const isActive = accent === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setAccent(c.id)}
                title={c.label}
                aria-label={`Set accent to ${c.label}`}
                aria-pressed={isActive}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${c.color} ${
                  isActive
                    ? `ring-4 ${c.ring} dark:ring-offset-slate-900 ring-offset-2 scale-110 shadow-lg`
                    : 'hover:scale-110 shadow-sm opacity-70 hover:opacity-100'
                }`}
              >
                {isActive && <Check className="w-5 h-5 text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Accent color affects buttons, links, and active states throughout the app.
        </p>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      {/* ── Font Size ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <Type className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Font Size
        </h3>
        <div className="flex gap-4">
          {fonts.map((f) => {
            const isActive = fontSize === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFontSize(f.id)}
                aria-pressed={isActive}
                className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                  isActive
                    ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10 text-teal-700 dark:text-teal-400 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="font-bold leading-none" style={f.style}>
                  {f.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{f.desc}</span>
                {isActive && <Check className="w-3.5 h-3.5 text-teal-500" />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Changes apply immediately and are saved for your next visit.
        </p>
      </div>
    </div>
  );
};

export default AppearanceSettings;
