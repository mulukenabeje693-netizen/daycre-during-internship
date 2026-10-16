const assessChapaVerification = ({ responseData, txRef, amount, currency = 'ETB' }) => {
  const transaction = responseData?.data;
  if (responseData?.status !== 'success' || transaction?.status !== 'success') {
    const providerStatus = String(transaction?.status || responseData?.status || 'unverified').toLowerCase();
    const normalizedStatus = providerStatus === 'canceled' ? 'cancelled' : providerStatus;
    const status = ['pending', 'failed', 'cancelled', 'expired'].includes(normalizedStatus)
      ? normalizedStatus
      : 'unverified';
    return { verified: false, status, transaction };
  }

  const matches =
    transaction.tx_ref === txRef &&
    Number(transaction.amount) === Number(amount) &&
    String(transaction.currency).toUpperCase() === String(currency).toUpperCase();
  return { verified: matches, status: matches ? 'success' : 'mismatch', transaction };
};

module.exports = { assessChapaVerification };
