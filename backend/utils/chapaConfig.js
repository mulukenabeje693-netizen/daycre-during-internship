
const DEFAULT_CHAPA_BASE_URL = 'https://api.chapa.global/v2';

const getChapaEnvironment = (
  secretKey = process.env.CHAPA_SECRET_KEY || ''
) => {
  const normalizedKey = String(secretKey).trim();

  if (!normalizedKey) {
    return 'unknown';
  }

  if (/^(?:CHAPA_TEST_|CHASECK_TEST-).+/i.test(normalizedKey)) {
    return 'test';
  }

  if (/^(?:CHAPA_LIVE_|CHASECK-).+/i.test(normalizedKey)) {
    return 'live';
  }

  return 'unknown';
};

const getChapaBaseUrl = () =>
  String(
    process.env.CHAPA_BASE_URL || DEFAULT_CHAPA_BASE_URL
  )
    .trim()
    .replace(/\/+$/, '');

const isValidChapaBaseUrl = (
  baseUrl = getChapaBaseUrl()
) => {
  try {
    const url = new URL(baseUrl);

    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'api.chapa.global' &&
      url.pathname.replace(/\/+$/, '') === '/v2' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
};

const isChapaConfigured = () => {
  const secretKey = String(
    process.env.CHAPA_SECRET_KEY || ''
  ).trim();

  const environment = getChapaEnvironment(secretKey);

  const isPlaceholderKey =
    /(?:replace|placeholder|your[_ -]?|insert|example)/i.test(
      secretKey
    );

  return (
    environment !== 'unknown' &&
    !isPlaceholderKey &&
    !(
      process.env.NODE_ENV === 'production' &&
      environment === 'test'
    ) &&
    isValidChapaBaseUrl()
  );
};

const getChapaConfigurationError = () => {
  const secretKey = String(
    process.env.CHAPA_SECRET_KEY || ''
  ).trim();

  const environment = getChapaEnvironment(secretKey);

  if (environment === 'unknown') {
    return 'CHAPA_SECRET_KEY is missing or its format is not recognized. Check the key in your Chapa merchant dashboard.';
  }

  if (
    /(?:replace|placeholder|your[_ -]?|insert|example)/i.test(
      secretKey
    )
  ) {
    return 'Replace the sample CHAPA_SECRET_KEY with your actual Chapa secret key.';
  }

  if (
    process.env.NODE_ENV === 'production' &&
    environment === 'test'
  ) {
    return 'A Chapa live secret key is required in production.';
  }

  if (!isValidChapaBaseUrl()) {
    return 'Set CHAPA_BASE_URL to https://api.chapa.global/v2.';
  }

  return '';
};

const areOnlinePaymentsEnabledByEnvironment = () =>
  String(process.env.ONLINE_PAYMENTS_ENABLED || '')
    .trim()
    .toLowerCase() === 'true';

const getChapaSandboxInvoiceAmount = () => {
  const environment = getChapaEnvironment();

  const testModeEnabled =
    ['development', 'test'].includes(process.env.NODE_ENV) &&
    process.env.ALLOW_TEST_INVOICES === 'true' &&
    environment === 'test';

  const amount = Number(
    process.env.CHAPA_TEST_INVOICE_AMOUNT
  );

  return (
    testModeEnabled &&
    Number.isFinite(amount) &&
    amount > 0
  )
    ? amount
    : null;
};

module.exports = {
  DEFAULT_CHAPA_BASE_URL,
  getChapaSandboxInvoiceAmount,
  getChapaEnvironment,
  getChapaBaseUrl,
  isValidChapaBaseUrl,
  isChapaConfigured,
  getChapaConfigurationError,
  areOnlinePaymentsEnabledByEnvironment
};
