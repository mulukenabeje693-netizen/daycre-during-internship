const net = require('node:net');

const WEBHOOK_PATH = '/api/payments/chapa-webhook';
const FRONTEND_PAYMENT_RETURN_PATH = '/dashboard/parent/payments/success';
const INVALID_FRONTEND_ORIGIN_MESSAGE =
  'Set FRONTEND_URL to the public HTTPS frontend origin only (for example, https://your-deployed-frontend-domain). ' +
  'Deploy the frontend or use a secure HTTPS tunnel for local checkout; localhost cannot receive Chapa returns.';
const INVALID_CHAPA_RETURN_URL_MESSAGE =
  `CHAPA_RETURN_URL must be the public HTTPS frontend callback route ${FRONTEND_PAYMENT_RETURN_PATH} ` +
  'without credentials, query, or fragment, and must use the same origin as FRONTEND_URL.';
const PRIVATE_HOST_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'lan',
  'home',
  'home.arpa',
  'test',
  'example',
  'invalid',
  'onion',
  'corp'
];

const callbackConfigurationError = (message, code) => {
  const error = new Error(message);
  error.statusCode = 503;
  error.code = code;
  return error;
};

const isPublicHostname = hostname => {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, '');
  if (!normalizedHostname.includes('.') || net.isIP(normalizedHostname)) return false;
  return !PRIVATE_HOST_SUFFIXES.some(suffix =>
    normalizedHostname === suffix || normalizedHostname.endsWith(`.${suffix}`)
  );
};

const getChapaCallbackUrl = (
  callbackValue = process.env.CHAPA_CALLBACK_URL,
  webhookSecretValue = process.env.CHAPA_WEBHOOK_SECRET
) => {
  const callbackUrl = String(callbackValue || '').trim();
  if (!callbackUrl) return null;

  if (!String(webhookSecretValue || '').trim()) {
    throw callbackConfigurationError(
      'CHAPA_WEBHOOK_SECRET is required when CHAPA_CALLBACK_URL is configured.',
      'CHAPA_WEBHOOK_SECRET_MISSING'
    );
  }

  let url;
  try {
    if (/[\u0000-\u0020\u007f]/.test(callbackUrl)) throw new Error('Whitespace or control character in URL.');
    url = new URL(callbackUrl);
  } catch {
    throw callbackConfigurationError(
      'CHAPA_CALLBACK_URL must be a valid public HTTPS URL for the Chapa webhook endpoint.',
      'CHAPA_CALLBACK_URL_INVALID'
    );
  }

  if (
    url.protocol !== 'https:' ||
    !isPublicHostname(url.hostname) ||
    url.pathname !== WEBHOOK_PATH ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw callbackConfigurationError(
      'CHAPA_CALLBACK_URL must be a public HTTPS URL for /api/payments/chapa-webhook without credentials or a fragment.',
      'CHAPA_CALLBACK_URL_INVALID'
    );
  }

  return url.href;
};

const getFrontendOrigin = (frontendValue = process.env.FRONTEND_URL) => {
  const frontendUrl = String(frontendValue || '').trim();
  let url;
  try {
    if (!frontendUrl || /[\u0000-\u0020\u007f]/.test(frontendUrl)) {
      throw new Error('Missing or malformed frontend URL.');
    }
    url = new URL(frontendUrl);
  } catch {
    throw callbackConfigurationError(
      INVALID_FRONTEND_ORIGIN_MESSAGE,
      'CHAPA_RETURN_URL_INVALID'
    );
  }

  if (
    url.protocol !== 'https:' ||
    !isPublicHostname(url.hostname) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw callbackConfigurationError(
      INVALID_FRONTEND_ORIGIN_MESSAGE,
      'CHAPA_RETURN_URL_INVALID'
    );
  }

  return url.origin;
};

const getChapaReturnUrl = (
  returnValue = process.env.CHAPA_RETURN_URL,
  transactionReference
) => {
  const frontendOrigin = getFrontendOrigin();
  const configuredReturnUrl = String(returnValue || '').trim();
  let url;

  if (configuredReturnUrl) {
    try {
      if (/[\u0000-\u0020\u007f]/.test(configuredReturnUrl)) {
        throw new Error('Whitespace or control character in URL.');
      }
      url = new URL(configuredReturnUrl);
    } catch {
      throw callbackConfigurationError(
        INVALID_CHAPA_RETURN_URL_MESSAGE,
        'CHAPA_RETURN_URL_INVALID'
      );
    }
  } else {
    url = new URL(FRONTEND_PAYMENT_RETURN_PATH, frontendOrigin);
  }

  if (
    url.protocol !== 'https:' ||
    !isPublicHostname(url.hostname) ||
    url.origin !== frontendOrigin ||
    url.pathname !== FRONTEND_PAYMENT_RETURN_PATH ||
    url.search ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw callbackConfigurationError(
      INVALID_CHAPA_RETURN_URL_MESSAGE,
      'CHAPA_RETURN_URL_INVALID'
    );
  }

  if (transactionReference !== undefined) {
    if (typeof transactionReference !== 'string' || !transactionReference.trim()) {
      throw callbackConfigurationError(
        'A valid Chapa transaction reference is required for the payment return URL.',
        'CHAPA_RETURN_URL_INVALID'
      );
    }
    url.searchParams.set('tx_ref', transactionReference.trim());
  }

  return url.href;
};

module.exports = {
  getChapaCallbackUrl,
  getChapaReturnUrl,
  getFrontendOrigin
};
