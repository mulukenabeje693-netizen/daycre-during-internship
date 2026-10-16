import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { useSettings } from '../../context/useSettings';
import { getLocalDateKey } from '../../utils/localDate';

const getChildAge = (dobString) => {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  if (dob > now) return null;
  let years = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years;
};

const ParentDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isFreeMode } = useSettings();
  const [children, setChildren]       = useState([]);
  const [payments, setPayments]       = useState([]);
  const [reports, setReports]         = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [messages, setMessages]       = useState({ unreadCount: 0 });
  const [meals, setMeals]             = useState([]);
  const [attendance, setAttendance]   = useState({ records: [], summary: {} });
  const [subscription, setSubscription] = useState(null);
  const [trialDurationDays, setTrialDurationDays] = useState(30);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [trialEligibilityReason, setTrialEligibilityReason] = useState('');
  const [subscriptionLoadError, setSubscriptionLoadError] = useState('');
  const [trialError, setTrialError] = useState('');
  const [trialLoading, setTrialLoading] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [childForm, setChildForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    allergies: '',
    medicalNotes: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: ''
  });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          childrenRes,
          paymentsRes,
          reportsRes,
          apptsRes,
          mealsRes,
          attendanceRes,
          subscriptionRes
        ] = await Promise.all([
          api.get('/children').catch(err => {
            console.warn('⚠️ /children failed:', err.message);
            return { data: { data: [] } };
          }),
          api.get('/payments/summary').catch(err => {
            console.warn('⚠️ /payments/summary failed:', err.message);
            return { data: { stats: {}, data: [] } };
          }),
          // Fetch only today's report (limit=1) instead of full history
          api.get('/reports?limit=1').catch(err => {
            console.warn('⚠️ /reports failed:', err.message);
            return { data: { data: [] } };
          }),
          api.get('/appointments/upcoming').catch(err => {
            console.warn('⚠️ /appointments/upcoming failed:', err.message);
            return { data: { data: [] } };
          }),
          api.get('/meals').catch(err => {
            console.warn('⚠️ /meals failed:', err.message);
            return { data: { data: [] } };
          }),
          api.get('/attendance/today').catch(err => {
            console.warn('⚠️ /attendance/today failed:', err.message);
            return { data: { data: { records: [], summary: {} } } };
          }),
          api.get('/subscriptions/me').catch(err => {
            setSubscriptionLoadError(err.response?.data?.message || 'Subscription details could not be loaded.');
            return { data: { data: { subscription: null, canStartTrial: false, invoices: [] } } };
          })
        ]);

        setChildren(childrenRes.data?.data || []);
        const summaryPayments = paymentsRes.data?.data || [];
        const trialInvoices = subscriptionRes.data?.data?.invoices || [];
        setPayments([
          ...summaryPayments,
          ...trialInvoices.filter(invoice => !summaryPayments.some(item => item._id === invoice._id))
        ]);
        setSubscription(subscriptionRes.data?.data?.subscription || null);
        setTrialDurationDays(subscriptionRes.data?.data?.trialDurationDays || 30);
        setCanStartTrial(subscriptionRes.data?.data?.canStartTrial === true);
        setTrialEligibilityReason(subscriptionRes.data?.data?.ineligibilityReason || '');
        setReports(reportsRes.data?.data || []);
        setAppointments(apptsRes.data?.data || []);
        setMeals(mealsRes.data?.data || []);
        setAttendance(attendanceRes.data?.data || { records: [], summary: {} });
      } catch (err) {
        console.error('Parent dashboard error:', err);
        setError('Some data could not be loaded. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleStartTrial = async () => {
    if (trialLoading) return;
    setTrialLoading(true);
    setTrialError('');
    try {
      const response = await api.post('/subscriptions/trial');
      setSubscription(response.data?.data?.subscription || null);
      setTrialDurationDays(response.data?.data?.trialDurationDays || trialDurationDays);
      setCanStartTrial(false);
      setTrialEligibilityReason('');
    } catch (requestError) {
      setTrialError(requestError.response?.data?.message || 'Could not start your trial. Please try again.');
    } finally {
      setTrialLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingPayments = payments.filter(p => ['pending', 'overdue', 'unpaid'].includes(p.status?.toLowerCase()));
  const overduePayments = payments.filter(p => p.status?.toLowerCase() === 'overdue');
  const todayReport     = reports[0];
  const todayMeals      = meals.filter(m => m.date === getLocalDateKey());
  const subscriptionPeriodEnd = subscription?.currentPeriodEnd &&
    Number.isFinite(Date.parse(subscription.currentPeriodEnd))
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  const unpaidChildrenIds = new Set(
    pendingPayments
      .map(p => p.child?._id || (typeof p.child === 'string' ? p.child : null))
      .filter(Boolean)
  );
  const unpaidChildrenList = children.filter(c => unpaidChildrenIds.has(c._id));

  return (
    <div className="space-y-6">

      {/* ── Welcome ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {t('welcome')}, {user?.fullName?.split(' ')[0]} 👋
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </p>
      </div>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3">
          <i className="bx bx-error text-rose-400 text-xl" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* ── Alert banners ────────────────────────────────────── */}
      {trialError && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-500">
          {trialError}
        </div>
      )}

      {subscriptionLoadError && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-500">
          {subscriptionLoadError}
        </div>
      )}

      {subscription?.status === 'trialing' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <i className="bx bx-gift text-emerald-400 text-xl" />
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Your free trial is active</p>
            <p className="text-xs text-slate-500">
              {Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))} days remaining · Ends {new Date(subscription.trialEndsAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {subscription?.status === 'expired' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Your free trial has ended</p>
            <p className="text-xs text-slate-500">Review the monthly invoice to continue with paid service.</p>
          </div>
          <Link to="/dashboard/parent/payments" className="text-sm font-semibold text-amber-600 underline">View invoice</Link>
        </div>
      )}

      {subscription && ['active', 'past_due', 'cancelled'].includes(subscription.status) && (
        <div className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
          subscription.status === 'active'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : subscription.status === 'past_due'
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-slate-500/10 border-slate-500/30'
        }`}>
          <div>
            <p className={`text-sm font-semibold ${
              subscription.status === 'active'
                ? 'text-emerald-600 dark:text-emerald-400'
                : subscription.status === 'past_due'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400'
            }`}>
              {subscription.status === 'active'
                ? 'Your subscription is active'
                : subscription.status === 'past_due'
                  ? 'A subscription payment is overdue'
                  : 'Your subscription is cancelled'}
            </p>
            <p className="text-xs text-slate-500">
              {subscriptionPeriodEnd
                ? `${subscription.status === 'active' && subscription.cancelAtPeriodEnd ? 'Scheduled to end' : 'Current period ends'} ${subscriptionPeriodEnd}`
                : 'Subscription details are available in your account.'}
            </p>
          </div>
          {subscription.status === 'past_due' && (
            <Link to="/dashboard/parent/payments" className="text-sm font-semibold text-rose-600 underline">
              View invoice
            </Link>
          )}
        </div>
      )}

      {canStartTrial && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Start your free trial</p>
            <p className="text-xs text-slate-500">A one-time {trialDurationDays}-day trial is available for this approved parent account.</p>
          </div>
          <button type="button" onClick={handleStartTrial} disabled={trialLoading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {trialLoading ? 'Starting…' : 'Start free trial'}
          </button>
        </div>
      )}

      {!subscription && !canStartTrial && !subscriptionLoadError && (
        <div className="bg-slate-500/5 border border-slate-500/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No subscription is currently associated with this account.</p>
          <p className="text-xs text-slate-500 mt-1">
            {trialEligibilityReason || 'A subscription will appear here after it has been created for your account.'}
          </p>
        </div>
      )}

      {!isFreeMode && overduePayments.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3">
          <i className="bx bx-error-circle text-rose-400 text-xl" />
          <div>
            <p className="text-sm font-semibold text-rose-500 dark:text-rose-400">
              {overduePayments.length} Overdue Payment{overduePayments.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-slate-500">
              Please settle outstanding invoices.{' '}
              <Link to="/dashboard/parent/invoices" className="underline text-rose-400">Pay now →</Link>
            </p>
          </div>
        </div>
      )}

      {!isFreeMode && pendingPayments.length > 0 && overduePayments.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <i className="bx bx-error text-amber-400 text-xl" />
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{t('paymentDue')}</p>
            <p className="text-xs text-slate-500">
              {t('youHave')} {pendingPayments.length} {t('outstandingPayments')}{' '}
              <Link to="/dashboard/parent/invoices" className="underline text-amber-400">{t('viewNow')} →</Link>
            </p>
          </div>
        </div>
      )}

      {messages.unreadCount > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-center gap-3">
          <i className="bx bx-envelope text-indigo-400 text-xl" />
          <div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {messages.unreadCount} Unread Message{messages.unreadCount > 1 ? 's' : ''}
            </p>
            <Link to="/dashboard/parent/messages" className="text-xs underline text-indigo-400">
              Open inbox →
            </Link>
          </div>
        </div>
      )}

      {/* ── Unpaid Children List ─────────────────────────────── */}
      {!isFreeMode && unpaidChildrenList.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-rose-500 dark:text-rose-400 mb-3 flex items-center gap-2">
            <i className="bx bx-error-circle" /> {t('unpaidChildrenList') || 'Unpaid Children List'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unpaidChildrenList.map(child => (
              <div key={child._id} className="bg-white/60 dark:bg-[#111c2d]/60 rounded-xl p-3 border border-rose-500/20 flex items-center gap-3 transition hover:bg-white dark:hover:bg-[#111c2d]">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 font-bold text-sm">
                  {child.firstName?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">
                    {child.firstName} {child.lastName}
                  </p>
                  <Link to="/dashboard/parent/invoices" className="text-xs text-rose-500 dark:text-rose-400 hover:underline">
                    {t('viewInvoices') || 'View Invoices'} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary stat strip ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: t('myChildren'),
            value: children.length,
            icon: 'bx-child',
            color: 'indigo',
            path: '/dashboard/parent/profile-card'
          },
          {
            label: t('present'),
            value: attendance.summary?.present ?? attendance.records?.filter(r => r.status === 'present').length ?? 0,
            icon: 'bx-user-check',
            color: 'emerald',
            path: '/dashboard/parent/attendance'
          },
          !isFreeMode && {
            label: t('pending'),
            value: pendingPayments.length,
            icon: 'bx-receipt',
            color: pendingPayments.length > 0 ? 'amber' : 'slate',
            path: '/dashboard/parent/invoices'
          },
          {
            label: t('upcomingAppointments'),
            value: appointments.length,
            icon: 'bx-calendar',
            color: 'cyan',
            path: '/dashboard/parent/appointments'
          }
        ].filter(Boolean).map(s => (
          <Link
            key={s.label}
            to={s.path}
            className={`bg-card rounded-2xl border border-glass p-3.5 sm:p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
          >
            <i className={`bx ${s.icon} text-xl`} style={{ color: 'var(--primary-light)' }} />
            <p className="text-xl sm:text-2xl font-bold text-primary mt-1.5 sm:mt-2">{s.value}</p>
            <p className="text-xs text-muted truncate">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* ── My Children cards ────────────────────────────────── */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className="bx bx-child text-indigo-400" /> {t('myChildren')}
          </h3>
          <button
            onClick={() => {
              setShowRegisterForm(prev => !prev);
              setCreateError('');
              setCreateSuccess('');
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 text-white px-4 py-2 text-xs font-semibold transition hover:bg-indigo-600"
          >
            <i className="bx bx-plus" />
            {showRegisterForm ? t('cancel') : t('registerChild')}
          </button>
        </div>

        {showRegisterForm && (
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white">{t('registerChild')}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('registerChildDesc')}
                </p>
              </div>
            </div>

            {createError && (
              <div className="mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-600">
                {createError}
              </div>
            )}

            {createSuccess && (
              <div className="mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600">
                {createSuccess}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCreateLoading(true);
                setCreateError('');
                setCreateSuccess('');

                if (!childForm.firstName.trim() || !childForm.lastName.trim() || !childForm.dateOfBirth || !childForm.gender) {
                  setCreateError('Please complete the child name, birth date, and gender.');
                  setCreateLoading(false);
                  return;
                }

                const age = getChildAge(childForm.dateOfBirth);
                if (age === null) {
                  setCreateError('Please enter a valid date of birth.');
                  setCreateLoading(false);
                  return;
                }
                if (age > 18) {
                  setCreateError('Child age must be 18 years or younger.');
                  setCreateLoading(false);
                  return;
                }

                try {
                  const payload = {
                    firstName: childForm.firstName.trim(),
                    lastName: childForm.lastName.trim(),
                    dateOfBirth: childForm.dateOfBirth,
                    gender: childForm.gender,
                    allergies: childForm.allergies.trim(),
                    medicalNotes: childForm.medicalNotes.trim(),
                    emergencyContact: {
                      name: childForm.emergencyContactName.trim(),
                      phone: childForm.emergencyContactPhone.trim(),
                      relationship: childForm.emergencyContactRelationship.trim()
                    }
                  };

                  const res = await api.post('/children', payload);
                  setChildren(prev => [res.data.data, ...prev]);
                  setCreateSuccess('Child registered successfully and sent for admin review.');
                  setChildForm({
                    firstName: '',
                    lastName: '',
                    dateOfBirth: '',
                    gender: 'male',
                    allergies: '',
                    medicalNotes: '',
                    emergencyContactName: '',
                    emergencyContactPhone: '',
                    emergencyContactRelationship: ''
                  });
                } catch (err) {
                  setCreateError(err.response?.data?.message || 'Unable to register child.');
                } finally {
                  setCreateLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('firstName')}
                  <input
                    value={childForm.firstName}
                    onChange={e => setChildForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={t('firstName')}
                  />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('lastName')}
                  <input
                    value={childForm.lastName}
                    onChange={e => setChildForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={t('lastName')}
                  />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('dateOfBirth')}
                  <input
                    type="date"
                    value={childForm.dateOfBirth}
                    onChange={e => setChildForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('gender')}
                  <select
                    value={childForm.gender}
                    onChange={e => setChildForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="male">{t('male')}</option>
                    <option value="female">{t('female')}</option>
                    <option value="other">{t('other')}</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('allergies')}
                  <input
                    value={childForm.allergies}
                    onChange={e => setChildForm(prev => ({ ...prev, allergies: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={t('allergiesPlaceholder')}
                  />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('medicalNotes')}
                  <input
                    value={childForm.medicalNotes}
                    onChange={e => setChildForm(prev => ({ ...prev, medicalNotes: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={t('medicalNotesPlaceholder')}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('emergencyContactName')}
                  <input
                    value={childForm.emergencyContactName}
                    onChange={e => setChildForm(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={t('emergencyContactName')}
                  />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('emergencyContactPhone')}
                  <input
                    value={childForm.emergencyContactPhone}
                    onChange={e => setChildForm(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={t('phoneNumber')}
                  />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  {t('relationship')}
                  <input
                    value={childForm.emergencyContactRelationship}
                    onChange={e => setChildForm(prev => ({ ...prev, emergencyContactRelationship: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={t('relationshipPlaceholder')}
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="inline-flex items-center justify-center rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {createLoading ? t('registering') : t('registerChild')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
                >
                  {t('close')}
                </button>
              </div>
            </form>
          </div>
        )}

        {children.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
            <i className="bx bx-child text-4xl" />
            <p className="mt-2">{t('noChildrenEnrolled')}</p>
            <p className="text-xs mt-1">{t('contactReceptionToStart')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children.map(child => {
              const record = attendance.records?.find(
                r => r.child?._id === child._id || r.child === child._id
              );
              return (
                <div
                  key={child._id}
                  className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow flex-shrink-0">
                      {child.firstName?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 dark:text-white truncate">
                        {child.firstName} {child.lastName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {child.age ? `${child.age} yrs` : child.dateOfBirth
                          ? `${new Date().getFullYear() - new Date(child.dateOfBirth).getFullYear()} yrs`
                          : '—'}{' '}
                        · {child.gender}
                      </p>
                      <p className="text-xs text-indigo-400 mt-0.5 truncate">
                        {child.classroom?.name || 'Unassigned'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        child.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {child.status}
                      </span>
                      {record && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          record.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : record.status === 'late'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {record.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags row */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {child.allergies && (
                      <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-lg px-3 py-1.5">
                        <i className="bx bx-error-circle" /> {child.allergies}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 dark:bg-[#0d1520] rounded-lg px-3 py-1.5">
                      <i className="bx bx-shield-quarter text-emerald-400" />
                      {child.vaccinationStatus || 'Vaccination: N/A'}
                    </div>
                    {child.classroom?.teacher && (
                      <div className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-500/10 rounded-lg px-3 py-1.5">
                        <i className="bxs-graduation" />
                        {child.classroom.teacher?.fullName || 'Teacher assigned'}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
                    <Link
                      to="/dashboard/parent/daily-report"
                      className="text-center text-xs font-semibold text-indigo-400 bg-indigo-500/10 rounded-lg py-2 hover:bg-indigo-500/20 transition-colors"
                    >
                      Report
                    </Link>
                    <Link
                      to="/dashboard/parent/attendance"
                      className="text-center text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-[#0d1520] rounded-lg py-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Attendance
                    </Link>
                    <Link
                      to="/dashboard/parent/sleep-naps"
                      className="text-center text-xs font-semibold text-purple-400 bg-purple-500/10 rounded-lg py-2 hover:bg-purple-500/20 transition-colors"
                    >
                      Sleep Log
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Latest Daily Report */}
        {todayReport ? (
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bx bx-file text-indigo-400" /> Latest Daily Report
              </h3>
              <Link to="/dashboard/parent/daily-report" className="text-xs text-indigo-400 hover:underline">
                All reports →
              </Link>
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {todayReport.child?.firstName}'s Day
            </p>
            <p className="text-xs text-slate-400 mb-3">
              {new Date(todayReport.date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
              })}
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['breakfast', 'lunch', 'snack'].map(meal => (
                <div key={meal} className="text-center bg-slate-50 dark:bg-[#0d1520] rounded-xl p-2">
                  <p className="text-xs text-slate-400 capitalize">{meal}</p>
                  <p className="text-sm font-bold text-indigo-400 mt-1">
                    {todayReport.meals?.[meal]?.ate || '—'}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Mood:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                {todayReport.mood} 😊
              </span>
            </div>
            {todayReport.teacherNotes && (
              <p className="text-xs text-slate-500 bg-slate-50 dark:bg-[#0d1520] rounded-xl p-3 mt-3 italic">
                "{todayReport.teacherNotes}"
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5 flex flex-col items-center justify-center text-slate-400 min-h-[180px]">
            <i className="bx bx-file text-4xl opacity-30" />
            <p className="text-sm mt-2">{t('noDailyReportYet')}</p>
            <p className="text-xs mt-1 opacity-60">{t('checkBackAfterDropOff')}</p>
          </div>
        )}

        {/* Upcoming Appointments */}
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i className="bx bx-calendar text-indigo-400" /> {t('appointments')}
            </h3>
            <Link to="/dashboard/parent/appointments" className="text-xs text-indigo-400 hover:underline">
              + {t('schedule')}
            </Link>
          </div>
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <i className="bx bx-calendar-x text-3xl opacity-30" />
              <p className="text-sm mt-2">{t('noUpcomingAppointments')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a._id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#0d1520]">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <i className="bx bx-calendar-event text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{a.title}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(a.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(a.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                    a.status === 'confirmed'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Meals */}
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i className="bx bx-restaurant text-amber-400" /> {t('todaysMeals')}
            </h3>
            <Link to="/dashboard/parent/meals-intake" className="text-xs text-indigo-400 hover:underline">
              {t('viewAll')} →
            </Link>
          </div>
          {todayMeals.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <i className="bx bx-bowl-hot text-3xl opacity-30" />
              <p className="text-sm mt-2">{t('noMealsScheduledToday')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayMeals.slice(0, 4).map(meal => (
                <div key={meal._id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#0d1520]">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <i className="bx bx-bowl-hot text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{meal.name}</p>
                    <p className="text-xs text-slate-400">{meal.time} · {meal.type}</p>
                  </div>
                  {meal.allergies && (
                    <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      ⚠ Allergy
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Invoices */}
        {!isFreeMode && (
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bx bx-receipt text-emerald-400" /> {t('paymentSummary')}
              </h3>
              <Link to="/dashboard/parent/invoices" className="text-xs text-indigo-400 hover:underline">
                {t('allInvoices')} →
              </Link>
            </div>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <i className="bx bx-wallet text-3xl opacity-30" />
                <p className="text-sm mt-2">{t('noInvoicesFound')}</p>
              </div>
            ) : (
              <>
                {/* Summary pills */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    {
                      label: 'Paid',
                      count: payments.filter(p => p.status === 'paid').length,
                      color: 'emerald'
                    },
                    {
                      label: 'Pending',
                      count: payments.filter(p => p.status === 'pending').length,
                      color: 'amber'
                    },
                    {
                      label: 'Overdue',
                      count: payments.filter(p => p.status === 'overdue').length,
                      color: 'rose'
                    }
                  ].map(s => (
                    <div
                      key={s.label}
                      className={`bg-${s.color}-500/10 rounded-xl p-3 text-center`}
                    >
                      <p className={`text-lg font-bold text-${s.color}-400`}>{s.count}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {/* Recent invoices */}
                <div className="space-y-2">
                  {payments.slice(0, 4).map(p => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-teal-900/30 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                          {p.child?.firstName} {p.child?.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{p.invoiceNumber || p.type}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">ETB {p.amount}</p>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          p.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : p.status === 'overdue'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
        <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <i className="bx bx-grid-alt text-indigo-400" /> Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Messages',       icon: 'bx-message-square',  path: '/dashboard/parent/messages',     color: 'indigo' },
            { label: 'Invoices',       icon: 'bx-receipt',         path: '/dashboard/parent/invoices',     color: 'emerald' },
            { label: 'Daily Report',   icon: 'bx-file',            path: '/dashboard/parent/daily-report', color: 'cyan' },
            { label: 'Attendance',     icon: 'bx-calendar-check',  path: '/dashboard/parent/attendance',   color: 'purple' },
            { label: 'Sleep Log',      icon: 'bx-moon',            path: '/dashboard/parent/sleep-naps',   color: 'violet' },
            { label: 'Meals',          icon: 'bx-restaurant',      path: '/dashboard/parent/meals-intake', color: 'amber' },
            { label: 'Appointments',   icon: 'bx-calendar-plus',   path: '/dashboard/parent/appointments', color: 'rose' },
            { label: 'Child Profile',  icon: 'bx-child',           path: '/dashboard/parent/profile-card', color: 'slate' }
          ].map(action => (
            <Link
              key={action.label}
              to={action.path}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-[#0d1520] hover:bg-indigo-500/10 dark:hover:bg-indigo-500/10 transition-all duration-200 group"
            >
              <i className={`bx ${action.icon} text-2xl text-slate-400 group-hover:text-indigo-400 transition-colors`} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-indigo-400 text-center">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ParentDashboard;
