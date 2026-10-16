const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const CHAPA_REQUEST_TIMEOUT_MS = 40_000;

const CHAPA_REQUEST_PATHS = [
  /^\/api\/payments\/(?:chapa-webhook|chapa-verify|initialize)$/,
  /^\/api\/payments\/verify(?:\/[^/]+)?$/,
  /^\/api\/payments\/[^/]+\/chapa-(?:prepare|init)$/
];

const getRequestTimeoutMs = (requestUrl = '') => {
  const pathname = String(requestUrl).split('?')[0];
  return CHAPA_REQUEST_PATHS.some(pattern => pattern.test(pathname))
    ? CHAPA_REQUEST_TIMEOUT_MS
    : DEFAULT_REQUEST_TIMEOUT_MS;
};

module.exports = {
  DEFAULT_REQUEST_TIMEOUT_MS,
  CHAPA_REQUEST_TIMEOUT_MS,
  getRequestTimeoutMs
};
