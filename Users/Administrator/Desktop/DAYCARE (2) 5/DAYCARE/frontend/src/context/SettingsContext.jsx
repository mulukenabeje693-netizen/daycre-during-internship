import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [isFreeMode, setIsFreeMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    // Only fetch if a token exists — avoids unauthenticated calls on Netlify static hosting
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/settings');
      if (res.data.success) {
        setIsFreeMode(res.data.data.isFreeMode);
      }
    } catch (error) {
      // Silently fail — settings will use defaults (isFreeMode = false)
      console.warn('Settings fetch skipped or failed:', error?.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentMode = async () => {
    try {
      const res = await api.post('/settings/toggle-payment-mode');
      if (res.data.success) {
        setIsFreeMode(res.data.data.isFreeMode);
        return res.data.data.isFreeMode;
      }
    } catch (error) {
      console.error('Failed to toggle payment mode:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ isFreeMode, loading, togglePaymentMode, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
