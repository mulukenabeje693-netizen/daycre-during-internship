import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'app_theme';
const ACCENT_KEY = 'app_accent';
const FONT_SIZE_KEY = 'app_fontSize';

// Accent color CSS variable map
const ACCENT_VARS = {
  teal: { '--accent-500': '#14b8a6', '--accent-600': '#0d9488', '--accent-100': '#ccfbf1', '--accent-50': '#f0fdfa' },
  indigo: { '--accent-500': '#6366f1', '--accent-600': '#4f46e5', '--accent-100': '#e0e7ff', '--accent-50': '#eef2ff' },
  rose: { '--accent-500': '#f43f5e', '--accent-600': '#e11d48', '--accent-100': '#ffe4e6', '--accent-50': '#fff1f2' },
  amber: { '--accent-500': '#f59e0b', '--accent-600': '#d97706', '--accent-100': '#fef3c7', '--accent-50': '#fffbeb' },
  blue: { '--accent-500': '#3b82f6', '--accent-600': '#2563eb', '--accent-100': '#dbeafe', '--accent-50': '#eff6ff' },
};


function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function applyAccent(accent) {
  const root = document.documentElement;
  const vars = ACCENT_VARS[accent] || ACCENT_VARS.teal;
  Object.entries(vars).forEach(([key, val]) => root.style.setProperty(key, val));
}

// Font size — update the CSS variable used by style.css
function applyFontSize(size) {
  const root = document.documentElement;
  const sizeMap = { small: '13px', medium: '14px', large: '16px' };
  root.style.setProperty('--font-size', sizeMap[size] || '14px');
  root.setAttribute('data-font-size', size);
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'light');
  const [accent, setAccentState] = useState(() => localStorage.getItem(ACCENT_KEY) || 'teal');
  const [fontSize, setFontSizeState] = useState(() => localStorage.getItem(FONT_SIZE_KEY) || 'medium');

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
    applyAccent(accent);
    applyFontSize(fontSize);
  }, []);


  const setTheme = (mode) => {
    setThemeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
  };

  const setAccent = (color) => {
    setAccentState(color);
    localStorage.setItem(ACCENT_KEY, color);
    applyAccent(color);
  };

  const setFontSize = (size) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
    applyFontSize(size);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
