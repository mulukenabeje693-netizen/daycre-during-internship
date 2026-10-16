const CHAPA_CHECKOUT_HOSTS = new Set(['checkout.chapa.global', 'checkout.chapa.co']);

export const getChapaReturnPath = (search) => {
  const params = new URLSearchParams(search);
  const txRef = params.get('tx_ref') || params.get('trx_ref') || params.get('chapa_tx');
  return txRef
    ? `/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(txRef)}`
    : null;
};

export const getChapaCheckoutUrl = (value) => {
  try {
    const checkoutUrl = new URL(value);
    if (checkoutUrl.protocol === 'https:' && CHAPA_CHECKOUT_HOSTS.has(checkoutUrl.hostname.toLowerCase())) {
      return checkoutUrl.href;
    }
  } catch {
    // Invalid provider URLs are rejected below with one safe error.
  }
  throw new Error('Chapa returned an unexpected checkout address. Please contact the administrator.');
};

export const redirectToChapaCheckout = (value, location = window.location) => {
  location.assign(getChapaCheckoutUrl(value));
};

export const getChapaInitializationError = error => {
  const backendMessage = error?.response?.data?.message;
  if (typeof backendMessage === 'string' && backendMessage.trim()) return backendMessage;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return 'Payment initialization failed.';
};
