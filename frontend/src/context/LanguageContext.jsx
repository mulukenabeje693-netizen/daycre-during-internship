import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../translations';

export const LanguageContext = createContext(null);

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'አማርኛ' },
  { code: 'om', label: 'Oromiffa' },
  { code: 'ti', label: 'ትግርኛ' },
];

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('locale') : null;
    return stored || 'am';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('locale', locale);
    }
  }, [locale]);

  const t = useMemo(() => (key, fallbackText) => {
    if (!key) return '';
    return translations[locale]?.[key] ?? translations.en?.[key] ?? fallbackText ?? key;
  }, [locale]);

  const contextValue = useMemo(
    () => ({ locale, setLocale, t, LANGUAGE_OPTIONS }),
    [locale, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

// Convenience hook — exported here so components can import from one place
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
