import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import SettingsContext from './settingsContextStore';

export const SettingsProvider = ({ children }) => {
  const [isFreeMode, setIsFreeMode] = useState(true);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabledState] = useState(false);
  const [paymentSettingEnabled, setPaymentSettingEnabled] = useState(false);
  const [onlinePaymentsEnvironmentEnabled, setOnlinePaymentsEnvironmentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [chapaConfigured, setChapaConfigured] = useState(false);
  const [chapaConfigurationError, setChapaConfigurationError] = useState('');
  const [onlinePaymentsDisabledReason, setOnlinePaymentsDisabledReason] = useState('');
  const [chapaEnvironment, setChapaEnvironment] = useState('unknown');
  const [testInvoiceEnabled, setTestInvoiceEnabled] = useState(false);

  const fetchSettings = useCallback(async () => {
    setSettingsError('');
    try {
      const res = await api.get('/settings');
      const paymentSettings = res.data?.data;
      if (
        !res.data?.success ||
        typeof paymentSettings?.isFreeMode !== 'boolean' ||
        typeof paymentSettings?.onlinePaymentsEnabled !== 'boolean' ||
        typeof paymentSettings?.paymentSettingEnabled !== 'boolean' ||
        typeof paymentSettings?.onlinePaymentsEnvironmentEnabled !== 'boolean' ||
        typeof paymentSettings?.chapaConfigured !== 'boolean'
      ) {
        throw new Error('The payment settings API is outdated or incomplete. Update and restart the backend before enabling online payments.');
      }

      setIsFreeMode(!paymentSettings.onlinePaymentsEnabled);
      setOnlinePaymentsEnabledState(paymentSettings.onlinePaymentsEnabled);
      setPaymentSettingEnabled(paymentSettings.paymentSettingEnabled);
      setOnlinePaymentsEnvironmentEnabled(paymentSettings.onlinePaymentsEnvironmentEnabled);
      setChapaConfigured(paymentSettings.chapaConfigured);
      setChapaConfigurationError(paymentSettings.chapaConfigurationError || '');
      setOnlinePaymentsDisabledReason(paymentSettings.onlinePaymentsDisabledReason || '');
      setChapaEnvironment(paymentSettings.chapaEnvironment || 'unknown');
      setTestInvoiceEnabled(paymentSettings.testInvoiceEnabled === true);
    } catch (error) {
      setIsFreeMode(true);
      setOnlinePaymentsEnabledState(false);
      setPaymentSettingEnabled(false);
      setOnlinePaymentsEnvironmentEnabled(false);
      setChapaConfigured(false);
      setChapaConfigurationError('');
      setOnlinePaymentsDisabledReason('');
      setChapaEnvironment('unknown');
      setTestInvoiceEnabled(false);
      setSettingsError(
        error.response?.data?.message ||
        error.message ||
        'Could not load payment settings. Online checkout is disabled for safety.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const togglePaymentMode = async () => {
    try {
      const res = await api.post('/settings/toggle-payment-mode');
      if (!res.data?.success || typeof res.data.data?.isFreeMode !== 'boolean') {
        throw new Error('Payment mode update response was invalid.');
      }
      setIsFreeMode(res.data.data.isFreeMode);
      setOnlinePaymentsEnabledState(res.data.data.onlinePaymentsEnabled === true);
      setPaymentSettingEnabled(res.data.data.paymentSettingEnabled === true);
      setOnlinePaymentsEnvironmentEnabled(res.data.data.onlinePaymentsEnvironmentEnabled === true);
      setChapaConfigured(res.data.data.chapaConfigured === true);
      setChapaConfigurationError(res.data.data.chapaConfigurationError || '');
      setOnlinePaymentsDisabledReason(res.data.data.onlinePaymentsDisabledReason || '');
      setSettingsError('');
      return res.data.data.isFreeMode;
    } catch (error) {
      setSettingsError(error.response?.data?.message || 'Failed to update payment mode.');
      throw error;
    }
  };

  const setOnlinePaymentsEnabled = async (enabled) => {
    try {
      const res = await api.put('/settings/online-payments', { enabled });
      if (!res.data?.success || typeof res.data.data?.onlinePaymentsEnabled !== 'boolean') {
        throw new Error('Online payment setting response was invalid.');
      }
      setOnlinePaymentsEnabledState(res.data.data.onlinePaymentsEnabled);
      setPaymentSettingEnabled(res.data.data.paymentSettingEnabled === true);
      setIsFreeMode(!res.data.data.onlinePaymentsEnabled);
      setOnlinePaymentsEnvironmentEnabled(res.data.data.onlinePaymentsEnvironmentEnabled === true);
      setChapaConfigured(res.data.data.chapaConfigured === true);
      setChapaConfigurationError(res.data.data.chapaConfigurationError || '');
      setOnlinePaymentsDisabledReason(res.data.data.onlinePaymentsDisabledReason || '');
      setChapaEnvironment(res.data.data.chapaEnvironment || 'unknown');
      setSettingsError('');
      return res.data.data.onlinePaymentsEnabled;
    } catch (error) {
      setSettingsError(error.response?.data?.message || 'Failed to update online payment setting.');
      throw error;
    }
  };

  useEffect(() => {
    fetchSettings();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchSettings();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider value={{
      isFreeMode,
      onlinePaymentsEnabled,
      paymentSettingEnabled,
      onlinePaymentsEnvironmentEnabled,
      loading,
      settingsError,
      chapaConfigured,
      chapaConfigurationError,
      onlinePaymentsDisabledReason,
      chapaEnvironment,
      testInvoiceEnabled,
      togglePaymentMode,
      setOnlinePaymentsEnabled,
      refreshSettings: fetchSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
