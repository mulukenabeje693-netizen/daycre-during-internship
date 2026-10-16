const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getTrialDurationDays = () => {
  const configuredDays = process.env.FREE_TRIAL_DAYS;
  const days = configuredDays === undefined ? 30 : Number(configuredDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('FREE_TRIAL_DAYS must be an integer between 1 and 365.');
  }
  return days;
};

const getMonthlyFee = () => {
  const amount = Number(process.env.DAYCARE_MONTHLY_FEE);
  if (!isMonthlyFeeConfigured()) {
    throw new Error('Set DAYCARE_MONTHLY_FEE to a positive monthly amount before trial expiry invoicing.');
  }
  return amount;
};

const isMonthlyFeeConfigured = () => {
  const amount = Number(process.env.DAYCARE_MONTHLY_FEE);
  return Number.isFinite(amount) && amount > 0;
};

const getTrialEligibility = ({ role, approvalStatus, childCount, subscription }) => {
  if (role !== 'parent') return { eligible: false, reason: 'Only parent accounts can start a trial.' };
  if (approvalStatus !== 'approved') return { eligible: false, reason: 'Your parent account must be approved before starting a trial.' };
  if (!childCount) return { eligible: false, reason: 'Link an active child to your account before starting a trial.' };
  if (subscription?.trialUsed || subscription) {
    return { eligible: false, reason: 'A trial or subscription has already been used for this account.' };
  }
  return { eligible: true, reason: null };
};

const isInvoiceOwnedBy = (invoice, userId) =>
  String(invoice?.parent?._id || invoice?.parent || '') === String(userId);

const addCalendarMonth = (date) => {
  const source = new Date(date);
  const result = new Date(source);
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(source.getDate(), lastDay));
  result.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return result;
};

const getMonthRange = (date) => {
  const value = new Date(date);
  return {
    start: new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999)
  };
};

const buildTrialInvoiceFilter = ({ parentId, childId, billingPeriodStart }) => ({
  parent: parentId,
  child: childId,
  type: 'monthly-fee',
  billingPeriodStart
});

module.exports = {
  DAY_IN_MS,
  getTrialDurationDays,
  getMonthlyFee,
  isMonthlyFeeConfigured,
  getTrialEligibility,
  isInvoiceOwnedBy,
  addCalendarMonth,
  getMonthRange,
  buildTrialInvoiceFilter
};
