const CURRENCY = 'ETB';
const MINOR_UNITS_PER_ETB = 100n;

const amountError = (message) => {
  const error = new Error(message);
  error.code = 'CHAPA_INVALID_AMOUNT';
  error.statusCode = 400;
  return error;
};

const toEtbCents = (value, { allowZero = false } = {}) => {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'number' && !Number.isFinite(value))) {
    throw amountError('The ETB amount must be a valid number with no more than two decimal places.');
  }

  const amount = String(value).trim();
  const match = amount.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match || match[1] === '-' || (match[3] && match[3].length > 2)) {
    throw amountError('The ETB amount must be a valid number with no more than two decimal places.');
  }

  const wholeEtb = BigInt(match[2]);
  const fractionalCents = BigInt((match[3] || '').padEnd(2, '0') || '0');
  const cents = wholeEtb * MINOR_UNITS_PER_ETB + fractionalCents;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw amountError('The ETB amount is outside the supported payment range.');
  }
  if (!allowZero && cents <= 0n) {
    throw amountError('The ETB amount must be greater than zero.');
  }

  return Number(cents);
};

const getInvoiceBalanceCents = (invoice) => {
  if (String(invoice.currency || '').toUpperCase() !== CURRENCY) {
    throw amountError(`Chapa checkout only supports ${CURRENCY} invoices.`);
  }

  const totalCents = toEtbCents(invoice.amount);
  const paidCents = toEtbCents(invoice.amountPaid ?? 0, { allowZero: true });
  if (invoice.status === 'paid') return 0;
  return Math.max(0, totalCents - Math.min(totalCents, paidCents));
};

const getAttemptProviderAmountCents = (attempt) => {
  const expectedCents = toEtbCents(attempt.amount);
  if (
    attempt.providerAmountCents !== undefined &&
    attempt.providerAmountCents !== null &&
    attempt.providerAmountCents !== expectedCents
  ) {
    throw amountError('The stored Chapa amount does not match the invoice amount.');
  }
  return expectedCents;
};

const isProviderAmountCents = (value, expectedCents) =>
  (typeof value === 'number' && Number.isSafeInteger(value) && value === expectedCents) ||
  (typeof value === 'string' && /^\d+$/.test(value) && Number(value) === expectedCents);

const fromEtbCents = cents => Number((cents / 100).toFixed(2));

module.exports = {
  CURRENCY,
  toEtbCents,
  getInvoiceBalanceCents,
  getAttemptProviderAmountCents,
  isProviderAmountCents,
  fromEtbCents
};
