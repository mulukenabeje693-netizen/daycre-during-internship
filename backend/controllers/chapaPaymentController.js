const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ChapaPayment = require('../models/ChapaPayment');
const Child = require('../models/Child');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { activateSubscriptionForInvoice } = require('./subscriptionController');
const {
  getChapaEnvironment,
  getChapaBaseUrl,
  isChapaConfigured,
  getChapaConfigurationError,
  areOnlinePaymentsEnabledByEnvironment
} = require('../utils/chapaConfig');
const { isInvoiceOwnedBy } = require('../utils/subscriptionBilling');
const SystemSetting = require('../models/SystemSetting');
const {
  CURRENCY,
  toEtbCents,
  getInvoiceBalanceCents,
  getAttemptProviderAmountCents,
  isProviderAmountCents,
  fromEtbCents
} = require('../utils/chapaAmount');
const {
  CHAPA_REFERENCE_MAX_LENGTH,
  createChapaReference,
  isValidChapaReference
} = require('../utils/chapaReference');
const {
  getChapaCallbackUrl,
  getChapaReturnUrl,
  getFrontendOrigin
} = require('../utils/chapaCallbackUrl');

const CHAPA_TIMEOUT_MS = 30_000;
const TERMINAL_FAILURES = new Set(['failed', 'cancelled', 'expired', 'incomplete', 'blocked']);
const KNOWN_STATUSES = new Set([
  'pending',
  'processing',
  'success',
  'failed',
  'cancelled',
  'expired',
  'incomplete',
  'blocked',
  'auth_needed',
  'unverified'
]);

const classifyChapaTransportFailure = (providerError, operation) => {
  if (providerError.response || !providerError.isAxiosError) return null;

  const isDnsFailure = ['ENOTFOUND', 'EAI_AGAIN'].includes(providerError.code);
  if (!isDnsFailure && !['ECONNREFUSED', 'ECONNRESET'].includes(providerError.code)) {
    return null;
  }
  const code = isDnsFailure ? 'CHAPA_DNS_ERROR' : 'CHAPA_NETWORK_ERROR';
  const status = operation === 'verification' ? 'pending' : 'processing';
  const message = isDnsFailure
    ? `The backend could not resolve Chapa's official API hostname (DNS). Check backend DNS/network access and keep CHAPA_BASE_URL set to https://api.chapa.global/v2. The payment remains ${status} and has not been marked paid; retry status verification before starting another checkout.`
    : `The backend could not connect to Chapa's official API. Check backend network access and TLS connectivity. The payment remains ${status} and has not been marked paid; retry status verification before starting another checkout.`;

  return {
    statusCode: 503,
    code,
    providerStatus: status,
    message
  };
};

const getSecretKey = () => String(process.env.CHAPA_SECRET_KEY || '').trim();
const getMode = () => getChapaEnvironment(getSecretKey());
const normalizeStatus = (value) => {
  const status = String(value || 'unverified').toLowerCase();
  if (status === 'canceled') return 'cancelled';
  return KNOWN_STATUSES.has(status) ? status : 'unverified';
};

const getActiveAttempt = async (invoiceId) =>
  ChapaPayment.findOne({ activeInvoice: invoiceId });

const syncInvoiceAttempt = async (attempt, { checkoutUrl = null } = {}) =>
  Payment.updateOne(
    {
      _id: attempt.invoice,
      status: { $in: ['pending', 'overdue'] }
    },
    {
      $set: {
        chapaTxRef: attempt.merchantReference,
        chapaReference: attempt.chapaReference,
        chapaAmount: attempt.amount,
        chapaStatus: attempt.status,
        mode: attempt.mode,
        chapaCheckoutUrl: checkoutUrl
      }
    }
  );

const populateInvoiceResponse = async (invoice, attempt) => {
  const populated = await Payment.findById(invoice._id)
    .populate('parent', 'fullName email phone')
    .populate({
      path: 'child',
      select: 'firstName lastName classroom',
      populate: { path: 'classroom', select: 'name' }
    });
  const result = populated?.toObject ? populated.toObject() : { ...invoice };
  return {
    ...result,
    chapaTxRef: attempt.merchantReference,
    chapaReference: attempt.chapaReference,
    chapaAmount: attempt.amount,
    chapaStatus: attempt.status,
    verifiedAt: attempt.verifiedAt,
    receiptNumber: attempt.receiptNumber,
    receiptGeneratedAt: attempt.receiptGeneratedAt,
    paidDate: attempt.providerUpdatedAt || attempt.verifiedAt || result.paidDate,
    method: 'chapa',
    paymentMethod: attempt.paymentMethod || 'chapa',
    transactionReference: attempt.merchantReference
  };
};

const getInvoiceForParent = async (invoiceId, parentId) => {
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) return null;
  const invoice = await Payment.findById(invoiceId)
    .populate('parent', 'fullName email phone')
    .populate('child', 'firstName lastName parents');
  if (!invoice) return null;
  if (!isInvoiceOwnedBy(invoice, parentId)) {
    const error = new Error('Not authorized to pay this invoice.');
    error.statusCode = 403;
    throw error;
  }
  return invoice;
};

const assertOnlinePaymentsEnabled = async () => {
  const setting = await SystemSetting.findOne().select('onlinePaymentsEnabled').lean();
  if (!setting || setting.onlinePaymentsEnabled !== true) {
    const error = new Error('Online payments are disabled by the daycare administrator.');
    error.statusCode = 403;
    throw error;
  }
  if (!areOnlinePaymentsEnabledByEnvironment()) {
    const error = new Error('Online payments are disabled by the backend ONLINE_PAYMENTS_ENABLED safety setting.');
    error.statusCode = 503;
    error.code = 'ONLINE_PAYMENTS_ENVIRONMENT_DISABLED';
    throw error;
  }
  if (!isChapaConfigured()) {
    const error = new Error(getChapaConfigurationError());
    error.statusCode = 503;
    error.code = 'CHAPA_CREDENTIALS_MISSING';
    throw error;
  }
};

const isValidCheckoutUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['checkout.chapa.global', 'checkout.chapa.co'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const getProviderTransactionReference = (transaction) =>
  transaction?.chapa_reference || transaction?.reference || transaction?.ref_id || null;

const getChapaHeaders = () => {
  const secretKey = getSecretKey();
  if (!isChapaConfigured(secretKey)) {
    const error = new Error(getChapaConfigurationError());
    error.statusCode = 503;
    error.code = 'CHAPA_CREDENTIALS_MISSING';
    throw error;
  }
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json'
  };
};

const getHeadersForAttempt = (attempt) => {
  const headers = getChapaHeaders();
  if (getMode() !== attempt.mode) {
    const error = new Error('The configured Chapa credentials do not match this payment attempt environment.');
    error.statusCode = 503;
    error.code = 'CHAPA_ENVIRONMENT_MISMATCH';
    throw error;
  }
  return headers;
};

const verifyWithChapa = async (attempt) => {
  const headers = getHeadersForAttempt(attempt);
  if (!attempt.chapaReference) {
    const error = new Error('Chapa has not returned a provider reference yet. Wait for its webhook or retry verification shortly.');
    error.statusCode = 409;
    error.code = 'CHAPA_REFERENCE_PENDING';
    error.providerStatus = 'pending';
    throw error;
  }
  const endpoint = `${getChapaBaseUrl()}/payments/${encodeURIComponent(attempt.chapaReference)}/verify`;
  let response;
  try {
    response = await axios.get(
      endpoint,
      { headers, timeout: CHAPA_TIMEOUT_MS }
    );
  } catch (providerError) {
    const transportFailure = classifyChapaTransportFailure(providerError, 'verification');
    if (transportFailure) {
      const error = new Error(transportFailure.message);
      Object.assign(error, transportFailure);
      error.response = providerError.response;
      throw error;
    }
    if (providerError.response?.status === 401 || providerError.response?.status === 403) {
      const error = new Error('Chapa rejected the server credentials. Confirm the active key for this payment environment.');
      error.statusCode = 503;
      error.code = 'CHAPA_CREDENTIALS_REJECTED';
      error.response = providerError.response;
      throw error;
    }
    if (providerError.response?.status === 404) {
      const error = new Error('Chapa could not find this transaction reference.');
      error.statusCode = 409;
      error.code = 'CHAPA_REFERENCE_NOT_FOUND';
      error.response = providerError.response;
      throw error;
    }
    if (
      !providerError.response ||
      providerError.code === 'ECONNABORTED' ||
      providerError.code === 'ETIMEDOUT' ||
      providerError.response.status >= 500
    ) {
      const error = new Error('Chapa verification is temporarily unavailable. Retry verification shortly.');
      error.statusCode = 503;
      error.code = 'CHAPA_VERIFICATION_UNAVAILABLE';
      error.response = providerError.response;
      throw error;
    }
    throw providerError;
  }

  const transaction = response.data?.data;
  if (!transaction || response.data?.status !== 'success') {
    const error = new Error('Chapa did not return a verifiable payment.');
    error.statusCode = 502;
    error.code = 'CHAPA_INVALID_VERIFICATION_RESPONSE';
    throw error;
  }
  return { response: response.data, transaction };
};

const setAttemptStatus = async (attempt, status, extra = {}) => {
  const normalizedStatus = normalizeStatus(status);
  const terminalAttempt = TERMINAL_FAILURES.has(attempt.status);
  if (
    attempt.status === 'success' ||
    (attempt.status === 'unverified' && !TERMINAL_FAILURES.has(normalizedStatus)) ||
    (terminalAttempt && ['pending', 'processing', 'auth_needed'].includes(normalizedStatus))
  ) {
    return attempt;
  }
  const update = {
    $set: { status: normalizedStatus, ...extra },
    $unset: {}
  };
  if (TERMINAL_FAILURES.has(normalizedStatus) || normalizedStatus === 'success') {
    update.$unset.activeInvoice = '';
    update.$unset.initializationStartedAt = '';
    update.$unset.checkoutUrl = '';
  }
  if (!Object.keys(update.$unset).length) delete update.$unset;
  const blockedStatuses = ['success'];
  if (!TERMINAL_FAILURES.has(normalizedStatus)) blockedStatuses.push('unverified');
  if (['pending', 'processing', 'auth_needed'].includes(normalizedStatus)) {
    blockedStatuses.push(...TERMINAL_FAILURES);
  }
  const updated = await ChapaPayment.findOneAndUpdate(
    { _id: attempt._id, status: { $nin: blockedStatuses } },
    update,
    { new: true }
  );
  if (updated) {
    const invoiceUpdate = {
      $set: { chapaStatus: normalizedStatus },
      $unset: {}
    };
    if (extra.chapaReference) {
      invoiceUpdate.$set.chapaReference = extra.chapaReference;
    }
    if (TERMINAL_FAILURES.has(normalizedStatus)) {
      invoiceUpdate.$unset.chapaCheckoutUrl = '';
    }
    if (!Object.keys(invoiceUpdate.$unset).length) delete invoiceUpdate.$unset;
    await Payment.updateOne(
      { _id: attempt.invoice, chapaTxRef: attempt.merchantReference, status: { $ne: 'paid' } },
      invoiceUpdate
    );
  }
  return updated;
};

const createVerifiedReceipt = async (attempt, transaction) => {
  const invoice = await Payment.findById(attempt.invoice);
  if (!invoice) {
    const error = new Error('The invoice for this verified payment no longer exists. Contact the daycare administrator.');
    error.statusCode = 409;
    throw error;
  }
  if (
    String(invoice.parent?._id || invoice.parent) !== String(attempt.parent) ||
    String(invoice.child?._id || invoice.child) !== String(attempt.child)
  ) {
    await setAttemptStatus(attempt, 'unverified');
    const error = new Error('The payment attempt does not match its invoice. Contact the daycare administrator.');
    error.statusCode = 409;
    throw error;
  }

  const providerAmountCents = getAttemptProviderAmountCents(attempt);
  const currency = String(transaction.currency || '').toUpperCase();
  const merchantReference = transaction.merchant_reference || transaction.tx_ref;
  const chapaReference = getProviderTransactionReference(transaction);
  const verifiedStatus = normalizeStatus(transaction.status);

  if (
    verifiedStatus !== 'success' ||
    merchantReference !== attempt.merchantReference ||
    !chapaReference ||
    chapaReference !== attempt.chapaReference ||
    !isProviderAmountCents(transaction.amount, providerAmountCents) ||
    currency !== attempt.currency
  ) {
    await setAttemptStatus(attempt, 'unverified');
    const error = new Error('Chapa payment reference, amount, currency, or status does not match the stored payment.');
    error.statusCode = 400;
    throw error;
  }

  const currentBalanceCents = getInvoiceBalanceCents(invoice);
  if (
    invoice.status !== 'paid' &&
    currentBalanceCents !== toEtbCents(attempt.amount)
  ) {
    await setAttemptStatus(attempt, 'unverified');
    const error = new Error('The invoice balance changed after checkout was created. This payment needs administrator review.');
    error.statusCode = 409;
    throw error;
  }

  const alreadySettledByAttempt =
    invoice.status === 'paid' &&
    invoice.method === 'chapa' &&
    invoice.chapaTxRef === attempt.merchantReference;
  if (invoice.status === 'paid' && !alreadySettledByAttempt) {
    await setAttemptStatus(attempt, 'unverified');
    const error = new Error('The invoice was settled by a different payment. This transaction needs administrator review.');
    error.statusCode = 409;
    throw error;
  }

  const verifiedAt = new Date();
  const receiptNumber = attempt.receiptNumber ||
    `RCT-${String(invoice.invoiceNumber || invoice._id).replace(/[^A-Za-z0-9-]/g, '').slice(-16)}-${attempt.merchantReference.slice(-16).toUpperCase()}`;
  const providerUpdatedAt = transaction.updated_at ? new Date(transaction.updated_at) : verifiedAt;
  let settledInvoice = invoice;
  if (!alreadySettledByAttempt) {
    settledInvoice = await Payment.findOneAndUpdate(
      {
        _id: invoice._id,
        parent: attempt.parent,
        amount: invoice.amount,
        status: { $in: ['pending', 'overdue'] },
        $or: [
          { amountPaid: Number(invoice.amountPaid) || 0 },
          { amountPaid: { $exists: false } }
        ]
      },
      {
        $set: {
          status: 'paid',
          amountPaid: invoice.amount,
          paidDate: providerUpdatedAt,
          method: 'chapa',
          chapaTxRef: attempt.merchantReference,
          chapaAmount: attempt.amount,
          chapaStatus: 'success',
          chapaReference: chapaReference || attempt.chapaReference,
          verifiedAt,
          receiptNumber,
          receiptGeneratedAt: verifiedAt
        },
        $unset: { chapaCheckoutUrl: '' }
      },
      { new: true }
    );
    if (!settledInvoice) {
      const current = await Payment.findById(invoice._id);
      if (current?.status !== 'paid' || current.method !== 'chapa' || current.chapaTxRef !== attempt.merchantReference) {
        await setAttemptStatus(attempt, 'unverified');
        const error = new Error('Chapa verified the payment, but the invoice changed before it could be marked paid. Contact the administrator.');
        error.statusCode = 409;
        throw error;
      }
      settledInvoice = current;
    }
  }

  if (settledInvoice.subscriptionId) {
    await activateSubscriptionForInvoice(settledInvoice);
  }

  const attemptUpdate = await ChapaPayment.findOneAndUpdate(
    { _id: attempt._id, status: { $ne: 'success' } },
    {
      $set: {
        status: 'success',
        chapaReference: chapaReference || attempt.chapaReference,
        paymentMethod: transaction.payment_method || null,
        serviceFee: transaction.service_fee != null && Number.isFinite(Number(transaction.service_fee))
          ? Number(transaction.service_fee)
          : null,
        verifiedAt,
        providerCreatedAt: transaction.created_at ? new Date(transaction.created_at) : null,
        providerUpdatedAt,
        receiptNumber,
        receiptGeneratedAt: verifiedAt
      },
      $unset: { activeInvoice: '', initializationStartedAt: '', checkoutUrl: '' }
    },
    { new: true }
  );

  const finalAttempt = attemptUpdate || await ChapaPayment.findById(attempt._id);
  if (
    !finalAttempt ||
    finalAttempt.status !== 'success' ||
    !finalAttempt.verifiedAt ||
    !finalAttempt.receiptNumber
  ) {
    const error = new Error('The payment attempt changed while verification was being saved. Retry verification.');
    error.statusCode = 409;
    throw error;
  }
  const finalInvoice = await Payment.findById(invoice._id);
  if (
    finalInvoice?.status !== 'paid' ||
    finalInvoice.method !== 'chapa' ||
    finalInvoice.chapaTxRef !== attempt.merchantReference
  ) {
    const error = new Error('Chapa verified the payment, but the invoice is not confirmed as paid.');
    error.statusCode = 409;
    throw error;
  }
  return populateInvoiceResponse(finalInvoice, finalAttempt);
};

const verifyAttemptAndApply = async (attempt) => {
  await validateAttemptInvoice(attempt);
  const { transaction } = await verifyWithChapa(attempt);
  const status = normalizeStatus(transaction.status);
  if (status !== 'success') {
    await setAttemptStatus(attempt, status, {
      chapaReference: transaction.chapa_reference || attempt.chapaReference,
      paymentMethod: transaction.payment_method || null
    });
    const error = new Error(`Chapa reports this payment as ${status}.`);
    error.statusCode = 409;
    error.providerStatus = status;
    if (['pending', 'processing', 'auth_needed', 'unverified'].includes(status)) {
      error.code = 'CHAPA_TRANSACTION_PENDING';
    } else if (TERMINAL_FAILURES.has(status)) {
      error.code = 'CHAPA_TRANSACTION_TERMINAL';
    }
    throw error;
  }
  return createVerifiedReceipt(attempt, transaction);
};

const verifyExistingAttempt = async (attempt) => {
  try {
    return { payment: await verifyAttemptAndApply(attempt) };
  } catch (error) {
    if (TERMINAL_FAILURES.has(error.providerStatus)) {
      return { status: error.providerStatus };
    }
    if (
      error.code === 'CHAPA_REFERENCE_NOT_FOUND' &&
      !['success', 'unverified'].includes(attempt.status)
    ) {
      if (!attempt.chapaReference) {
        return { status: 'pending', pending: true };
      }
      await setAttemptStatus(attempt, 'failed');
      return { status: 'failed', referenceNotFound: true };
    }
    if (error.code === 'CHAPA_REFERENCE_PENDING') {
      return { status: 'pending', pending: true };
    }
    if (error.code === 'CHAPA_TRANSACTION_PENDING') {
      return { status: error.providerStatus, pending: true };
    }
    throw error;
  }
};

const getAttemptForParent = async (merchantReference, user) => {
  if (!isValidChapaReference(merchantReference)) {
    const error = new Error(`The payment transaction reference is invalid. It must be at most ${CHAPA_REFERENCE_MAX_LENGTH} characters.`);
    error.statusCode = 400;
    throw error;
  }
  const attempt = await ChapaPayment.findOne({ merchantReference });
  if (!attempt) {
    const error = new Error('Payment transaction was not found.');
    error.statusCode = 404;
    throw error;
  }
  const canManageAllPayments = ['admin', 'reception', 'staff'].includes(user.role);
  if (!canManageAllPayments && !isInvoiceOwnedBy({ parent: attempt.parent }, user._id)) {
    const error = new Error('Not authorized to access this payment transaction.');
    error.statusCode = 403;
    throw error;
  }
  return attempt;
};

const validateAttemptInvoice = async (attempt) => {
  const invoice = await Payment.findById(attempt.invoice);
  if (!invoice) {
    const error = new Error('The invoice for this payment transaction was not found.');
    error.statusCode = 404;
    error.code = 'CHAPA_INVOICE_NOT_FOUND';
    throw error;
  }

  const sameOwner =
    String(invoice.parent?._id || invoice.parent) === String(attempt.parent);
  const sameChild =
    String(invoice.child?._id || invoice.child) === String(attempt.child);
  const sameReference = invoice.chapaTxRef === attempt.merchantReference;
  const sameAmount = toEtbCents(invoice.chapaAmount) === toEtbCents(attempt.amount);
  const sameCurrency =
    String(invoice.currency || '').toUpperCase() === String(attempt.currency).toUpperCase();
  const sameOutstandingBalance =
    invoice.status === 'paid' &&
    invoice.method === 'chapa' &&
    invoice.chapaTxRef === attempt.merchantReference
      ? true
      : ['pending', 'overdue'].includes(invoice.status) &&
      getInvoiceBalanceCents(invoice) === toEtbCents(attempt.amount);

  if (
    !sameOwner ||
    !sameChild ||
    !sameReference ||
    !sameAmount ||
    !sameCurrency ||
    !sameOutstandingBalance
  ) {
    const error = new Error('This payment transaction no longer matches its invoice. The invoice remains unpaid; contact the daycare administrator.');
    error.statusCode = 409;
    error.code = 'CHAPA_INVOICE_MISMATCH';
    throw error;
  }
  return invoice;
};

const sanitizeProviderError = (providerBody) => {
  const sanitizeProviderText = (value) =>
    String(value)
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/(?:CHAPA_(?:TEST|LIVE)_|CHASECK(?:_TEST)?-)[A-Za-z0-9_-]+/gi, '[REDACTED]')
      .slice(0, 300);
  const safeProviderError = {};
  if (typeof providerBody === 'string') {
    safeProviderError.message = sanitizeProviderText(providerBody);
  } else if (providerBody && typeof providerBody === 'object') {
    for (const key of ['message', 'error', 'status', 'code']) {
      const value = providerBody[key];
      if (typeof value === 'string' || typeof value === 'number') {
        safeProviderError[key] = sanitizeProviderText(value);
      }
    }
  }
  return safeProviderError;
};

const handleError = (res, error, fallback) => {
  if (error.response || error.providerResponse || error.providerEndpoint) {
    console.error('Chapa API request failed:', JSON.stringify({
      endpoint: error.providerEndpoint || error.config?.url || error.response?.config?.url || null,
      status: error.response?.status || error.providerHttpStatus || null,
      code: error.code || null,
      providerError: sanitizeProviderError(error.response?.data || error.providerResponse)
    }));
  } else {
    console.error(
      'Chapa payment operation failed:',
      String(error.message)
        .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[MongoDB connection redacted]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/(?:CHAPA_(?:TEST|LIVE)_|CHASECK(?:_TEST)?-)[A-Za-z0-9_-]+/gi, '[REDACTED]')
        .slice(0, 300)
    );
  }
  const isProviderError = Boolean(error.isAxiosError || error.response);
  const providerMessage = sanitizeProviderError(error.response?.data || error.providerResponse).message;
  const rejectedCredentials =
    error.code === 'CHAPA_CREDENTIALS_REJECTED' &&
    [401, 403].includes(error.response?.status || error.providerHttpStatus);
  const configuredEnvironment = getMode();
  const environmentLabel = configuredEnvironment === 'test'
    ? 'test/sandbox'
    : configuredEnvironment === 'live'
      ? 'live'
      : 'configured';
  const message = rejectedCredentials
    ? `Chapa rejected the server credentials for the configured ${environmentLabel} environment. In the Chapa merchant dashboard, copy or regenerate the secret key for this same ${environmentLabel} account and set it as backend CHAPA_SECRET_KEY. Check that the backend process is not overriding backend/.env, then restart the backend. Key values are never returned. No payment was made.`
    : error.providerResponse || error.response?.data
      ? providerMessage || fallback
    : error.statusCode
      ? error.message
      : fallback;
  return res.status(error.statusCode || (isProviderError ? 502 : 500)).json({
    success: false,
    status: error.providerStatus,
    code: error.code,
    message
  });
};

const prepareChapaPayment = async (req, res) => {
  try {
    await assertOnlinePaymentsEnabled();
    getChapaHeaders();
    const invoice = await getInvoiceForParent(req.params.id, req.user._id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.status === 'paid') return res.status(409).json({ success: false, message: 'Invoice is already paid.' });
    if (invoice.status === 'cancelled') return res.status(409).json({ success: false, message: 'A cancelled invoice cannot be paid.' });
    if (invoice.method && invoice.method !== 'chapa') {
      return res.status(409).json({ success: false, message: 'A manual payment is awaiting staff confirmation.' });
    }

    const amountCents = getInvoiceBalanceCents(invoice);
    const amount = fromEtbCents(amountCents);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || invoice.currency !== CURRENCY) {
      return res.status(400).json({ success: false, message: 'This invoice has no valid ETB balance for Chapa checkout.' });
    }

    const active = await getActiveAttempt(invoice._id);
    if (active) {
      if (!isValidChapaReference(active.merchantReference) && active.status !== 'success') {
        await setAttemptStatus(active, 'expired');
      } else {
        if (
          toEtbCents(active.amount) !== amountCents ||
          active.currency !== invoice.currency ||
          getAttemptProviderAmountCents(active) !== amountCents
        ) {
          return res.status(409).json({
            success: false,
            status: active.status,
            message: 'An earlier checkout is still active, but the invoice balance has changed. Contact the administrator before starting another payment.'
          });
        }

        if (
          active.status === 'success' &&
          invoice.status === 'paid' &&
          invoice.method === 'chapa' &&
          invoice.chapaTxRef === active.merchantReference
        ) {
          return res.status(200).json({
            success: true,
            alreadyPaid: true,
            invoiceId: invoice._id,
            txRef: active.merchantReference
          });
        }

        if (TERMINAL_FAILURES.has(active.status)) {
          await setAttemptStatus(active, active.status);
        } else {
          const recentInitialization =
            active.status === 'processing' &&
            active.initializationStartedAt &&
            Date.now() - new Date(active.initializationStartedAt).getTime() < 2 * 60 * 1000;
          if (recentInitialization) {
            return res.status(409).json({
              success: false,
              status: 'processing',
              message: 'Chapa checkout is being initialized. Wait briefly before retrying.'
            });
          }

          const needsProviderCheck = Boolean(
            active.checkoutUrl ||
            active.initializedAt ||
            active.status === 'processing' ||
            active.status === 'success' ||
            active.status === 'unverified'
          );
          if (needsProviderCheck) {
            const existingResult = await verifyExistingAttempt(active);
            if (existingResult.payment) {
              return res.status(200).json({
                success: true,
                alreadyPaid: true,
                invoiceId: invoice._id,
                txRef: active.merchantReference
              });
            }
            if (existingResult.pending) {
              return res.status(409).json({
                success: false,
                code: 'CHAPA_TRANSACTION_PENDING',
                status: existingResult.status,
                invoiceId: invoice._id,
                txRef: active.merchantReference,
                message: 'Chapa still reports this transaction as pending. Retry verification; do not start another payment.'
              });
            }
          } else {
            await syncInvoiceAttempt(active);
            return res.status(200).json({
              success: true,
              invoiceId: invoice._id,
              txRef: active.merchantReference,
              amount: active.amount,
              currency: active.currency,
              checkoutReady: false
            });
          }
        }
      }
    }

    const attempt = await ChapaPayment.create({
      parent: invoice.parent._id || invoice.parent,
      child: invoice.child._id || invoice.child,
      invoice: invoice._id,
      activeInvoice: invoice._id,
      merchantReference: createChapaReference(),
      amount,
      providerAmountCents: amountCents,
      currency: invoice.currency,
      status: 'pending',
      mode: getMode()
    });
    await syncInvoiceAttempt(attempt);
    return res.status(200).json({
      success: true,
      invoiceId: invoice._id,
      txRef: attempt.merchantReference,
      amount: attempt.amount,
      currency: attempt.currency
    });
  } catch (error) {
    if (error.code === 11000) {
      try {
        const active = await getActiveAttempt(req.params.id);
        if (active && String(active.parent) === String(req.user._id)) {
          await syncInvoiceAttempt(active, { checkoutUrl: active.checkoutUrl });
          return res.status(200).json({
            success: true,
            invoiceId: active.invoice,
            txRef: active.merchantReference,
            amount: active.amount,
            currency: active.currency,
            checkoutReady: Boolean(active.checkoutUrl)
          });
        }
      } catch (lookupError) {
        return handleError(res, lookupError, 'Could not safely prepare Chapa checkout. Please retry.');
      }
    }
    return handleError(res, error, 'Could not safely prepare Chapa checkout. Please retry.');
  }
};

const initializeChapaPayment = async (req, res) => {
  let lockedAttempt;
  const lockTime = new Date();
  try {
    await assertOnlinePaymentsEnabled();
    const callbackUrl = getChapaCallbackUrl();
    const frontendUrl = getFrontendOrigin();
    const merchantReference = req.body?.txRef || req.body?.merchant_reference;
    if (typeof merchantReference !== 'string' || !merchantReference.trim()) {
      return res.status(400).json({ success: false, message: 'A prepared merchant reference is required.' });
    }

    const attempt = await getAttemptForParent(merchantReference, req.user);
    const invoice = await Payment.findById(attempt.invoice)
      .populate('parent', 'fullName email phone')
      .populate('child', 'firstName lastName');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (
      !isInvoiceOwnedBy(invoice, req.user._id) ||
      !isInvoiceOwnedBy(invoice, attempt.parent)
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to initialize payment for this invoice.' });
    }
    if (String(invoice.child?._id || invoice.child) !== String(attempt.child)) {
      return res.status(409).json({ success: false, message: 'The payment attempt no longer matches its invoice. Contact the administrator.' });
    }
    if (
      attempt.status === 'success' &&
      invoice.status === 'paid' &&
      invoice.method === 'chapa' &&
      invoice.chapaTxRef === attempt.merchantReference
    ) {
      return res.status(200).json({ success: true, alreadyPaid: true, txRef: attempt.merchantReference });
    }
    if (TERMINAL_FAILURES.has(attempt.status)) {
      return res.status(409).json({
        success: false,
        code: 'CHAPA_TRANSACTION_TERMINAL',
        status: attempt.status,
        message: 'This checkout attempt cannot be restarted. Prepare a new checkout after reviewing its status.'
      });
    }
    if (attempt.status === 'unverified') {
      const existingResult = await verifyExistingAttempt(attempt);
      if (existingResult.payment) {
        return res.status(200).json({
          success: true,
          alreadyPaid: true,
          txRef: attempt.merchantReference
        });
      }
      if (existingResult.pending) {
        return res.status(409).json({
          success: false,
          code: 'CHAPA_TRANSACTION_PENDING',
          status: existingResult.status,
          txRef: attempt.merchantReference,
          message: 'Chapa still reports this transaction as pending. Retry verification; do not start another payment.'
        });
      }
      return res.status(409).json({
        success: false,
        code: existingResult.referenceNotFound
          ? 'CHAPA_REFERENCE_NOT_FOUND'
          : 'CHAPA_TRANSACTION_TERMINAL',
        status: existingResult.status,
        txRef: attempt.merchantReference,
        message: 'Chapa confirmed the previous checkout is no longer usable. Prepare a new checkout before paying again.'
      });
    }
    const chapaHeaders = getHeadersForAttempt(attempt);

    const recentInitialization =
      attempt.status === 'processing' &&
      attempt.initializationStartedAt &&
      Date.now() - new Date(attempt.initializationStartedAt).getTime() < 2 * 60 * 1000;
    if (recentInitialization) {
      return res.status(409).json({
        success: false,
        status: 'processing',
        message: 'Chapa checkout is currently being initialized. Wait briefly, then retry.'
      });
    }

    if (attempt.checkoutUrl || attempt.initializedAt || attempt.status === 'processing' || attempt.status === 'success') {
      const existingResult = await verifyExistingAttempt(attempt);
      if (existingResult.payment) {
        return res.status(200).json({
          success: true,
          alreadyPaid: true,
          txRef: attempt.merchantReference
        });
      }
      if (existingResult.pending) {
        return res.status(409).json({
          success: false,
          code: 'CHAPA_TRANSACTION_PENDING',
          status: existingResult.status,
          txRef: attempt.merchantReference,
          message: 'Chapa still reports this transaction as pending. Retry verification; do not start another payment.'
        });
      }
      return res.status(409).json({
        success: false,
        code: existingResult.referenceNotFound ? 'CHAPA_REFERENCE_NOT_FOUND' : 'CHAPA_TRANSACTION_TERMINAL',
        status: existingResult.status,
        txRef: attempt.merchantReference,
        message: 'The previous Chapa checkout is no longer usable. Prepare a new checkout before paying again.'
      });
    }
    if (invoice.status !== 'pending' && invoice.status !== 'overdue') {
      return res.status(409).json({ success: false, message: 'The invoice is no longer payable.' });
    }
    if (invoice.method && invoice.method !== 'chapa') {
      return res.status(409).json({ success: false, message: 'A manual payment is awaiting staff confirmation.' });
    }
    if (attempt.currency !== CURRENCY || attempt.currency !== invoice.currency) {
      return res.status(409).json({ success: false, message: 'The payment currency no longer matches the invoice.' });
    }
    const currentBalanceCents = getInvoiceBalanceCents(invoice);
    const attemptAmountCents = getAttemptProviderAmountCents(attempt);
    if (currentBalanceCents !== attemptAmountCents) {
      return res.status(409).json({ success: false, message: 'The invoice balance changed. Prepare checkout again.' });
    }

    const hasRequestedPhone = Object.prototype.hasOwnProperty.call(req.body || {}, 'phone_number');
    const requestedPhone = hasRequestedPhone
      ? req.body.phone_number
      : invoice.parent?.phone || req.user.phone;
    let checkoutPhone = null;
    if (requestedPhone !== undefined && requestedPhone !== null && requestedPhone !== '') {
      if (typeof requestedPhone !== 'string' && hasRequestedPhone) {
        return res.status(400).json({ success: false, message: 'Enter a valid Ethiopian phone number.' });
      }
      if (typeof requestedPhone === 'string') {
        const { validateEthiopianPhone } = require('../utils/validatePhone');
        const validation = validateEthiopianPhone(requestedPhone);
        if (!validation.valid && hasRequestedPhone) {
          return res.status(400).json({
            success: false,
            message: 'Enter a valid Ethiopian phone number (09xxxxxxxx, 07xxxxxxxx, or +251...).'
          });
        }
        if (validation.valid) checkoutPhone = validation.normalized;
      }
    }

    const lockExpires = new Date(Date.now() - 2 * 60 * 1000);
    lockedAttempt = await ChapaPayment.findOneAndUpdate(
      {
        _id: attempt._id,
        status: { $in: ['pending', 'processing'] },
        checkoutUrl: null,
        $or: [
          { initializationStartedAt: null },
          { initializationStartedAt: { $exists: false } },
          { initializationStartedAt: { $lt: lockExpires } }
        ]
      },
      {
        $set: { status: 'processing', initializationStartedAt: lockTime }
      },
      { new: true }
    );
    if (!lockedAttempt) {
      return res.status(409).json({
        success: false,
        status: 'processing',
        message: 'Chapa checkout is already being initialized. Wait briefly, then retry.'
      });
    }
    await syncInvoiceAttempt(lockedAttempt);

    const parentName = invoice.parent?.fullName || req.user.fullName || 'Parent';
    const nameParts = parentName.trim().split(/\s+/);
    const returnUrl = getChapaReturnUrl(undefined, attempt.merchantReference);
    const payload = {
      amount: attemptAmountCents,
      currency: attempt.currency,
      merchant_reference: attempt.merchantReference,
      customer: {
        first_name: nameParts[0] || 'Parent',
        last_name: nameParts.slice(1).join(' ') || 'User',
        email: invoice.parent?.email || req.user.email
      },
      return_url: returnUrl,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      meta: {
        invoice_id: String(invoice._id),
        invoice_number: invoice.invoiceNumber,
        child_id: String(attempt.child)
      }
    };

    if (checkoutPhone) {
      payload.phone_number = checkoutPhone;
      payload.customer.phone_number = checkoutPhone;
    }

    const chapaApiBase = getChapaBaseUrl();
    const response = await axios.post(`${chapaApiBase}/payments/hosted`, payload, {
      headers: chapaHeaders,
      timeout: CHAPA_TIMEOUT_MS
    });
    const responseData = response.data?.data;
    const checkoutUrl = responseData?.checkout_url;
    if (response.data?.status !== 'success') {
      const error = new Error('Chapa did not accept the hosted checkout request.');
      error.statusCode = 502;
      error.code = 'CHAPA_INITIALIZATION_FAILED';
      error.providerStatus = 'initialization_failed';
      error.providerHttpStatus = response.status;
      error.providerResponse = response.data;
      throw error;
    }

    const chapaReference =
      getProviderTransactionReference(responseData);
    if (!isValidCheckoutUrl(checkoutUrl)) {
      await setAttemptStatus(lockedAttempt, 'unverified', {
        ...(chapaReference ? { chapaReference } : {})
      });
      lockedAttempt = null;
      return res.status(502).json({
        success: false,
        code: 'CHAPA_CHECKOUT_UNAVAILABLE',
        status: 'pending',
        txRef: attempt.merchantReference,
        message: 'Chapa acknowledged the transaction but did not return a valid hosted checkout URL. The payment is being held for server-side verification; do not submit another checkout.'
      });
    }

    if (!chapaReference && !callbackUrl) {
      await setAttemptStatus(lockedAttempt, 'unverified');
      lockedAttempt = null;
      return res.status(503).json({
        success: false,
        code: 'CHAPA_REFERENCE_UNAVAILABLE',
        status: 'pending',
        txRef: attempt.merchantReference,
        message: 'Chapa accepted checkout but did not return its verification reference. A public HTTPS CHAPA_CALLBACK_URL is required to finish verification. No checkout link was issued and the invoice remains unpaid.'
      });
    }

    await ChapaPayment.updateOne(
      { _id: attempt._id, initializationStartedAt: lockTime },
      {
        $set: {
          checkoutUrl,
          ...(chapaReference ? { chapaReference } : {}),
          status: 'pending',
          initializedAt: new Date()
        },
        $unset: { initializationStartedAt: '' }
      }
    );
    await Payment.updateOne(
      { _id: attempt.invoice, chapaTxRef: attempt.merchantReference, status: { $in: ['pending', 'overdue'] } },
      {
        $set: {
          chapaCheckoutUrl: checkoutUrl,
          ...(chapaReference ? { chapaReference } : {}),
          chapaStatus: 'pending'
        }
      }
    );
    lockedAttempt = null;
    return res.status(200).json({
      success: true,
      checkoutUrl,
      txRef: attempt.merchantReference
    });
  } catch (error) {
    if (lockedAttempt) {
      const isDefinitiveFailure = Boolean(
        (error.response && error.response.status < 500) ||
        error.code === 'CHAPA_INITIALIZATION_FAILED'
      );
      const nextStatus = isDefinitiveFailure ? 'failed' : 'processing';
      const update = {
        $set: { status: nextStatus },
        $unset: { initializationStartedAt: '' }
      };
      if (isDefinitiveFailure) update.$unset.activeInvoice = '';
      await ChapaPayment.updateOne(
        { _id: lockedAttempt._id, initializationStartedAt: lockTime },
        update
      );
      await Payment.updateOne(
        { _id: lockedAttempt.invoice, chapaTxRef: lockedAttempt.merchantReference, status: { $ne: 'paid' } },
        {
          $set: { chapaStatus: nextStatus },
          ...(isDefinitiveFailure ? { $unset: { chapaCheckoutUrl: '' } } : {})
        }
      );
      if (error.isAxiosError || error.response) {
        error.providerResponse = error.response?.data;
        error.providerHttpStatus = error.response?.status;
        const transportFailure = classifyChapaTransportFailure(error, 'initialization');
        if (transportFailure) {
          Object.assign(error, transportFailure);
        } else if ([401, 403].includes(error.response?.status)) {
          error.statusCode = 503;
          error.code = 'CHAPA_CREDENTIALS_REJECTED';
          error.providerStatus = 'initialization_failed';
        } else if (isDefinitiveFailure) {
          error.statusCode = 502;
          error.code = 'CHAPA_INITIALIZATION_FAILED';
          error.providerStatus = 'initialization_failed';
        } else {
          error.statusCode = 503;
          error.code = 'CHAPA_INITIALIZATION_UNAVAILABLE';
          error.providerStatus = 'processing';
        }
      }
    }
    return handleError(res, error, 'Chapa checkout initialization failed. Retry safely using the same prepared payment.');
  }
};

const verifyChapaPayment = async (req, res) => {
  try {
    const merchantReference =
      req.body?.txRef ||
      req.body?.merchant_reference ||
      req.body?.tx_ref ||
      req.query?.tx_ref ||
      req.query?.merchant_reference;
    if (typeof merchantReference !== 'string' || !merchantReference.trim()) {
      return res.status(400).json({ success: false, message: 'merchant_reference is required.' });
    }

    const attempt = await getAttemptForParent(merchantReference, req.user);
    const invoice = await validateAttemptInvoice(attempt);
    if (attempt.status === 'success' && attempt.verifiedAt) {
      if (
        invoice?.status === 'paid' &&
        invoice.method === 'chapa' &&
        invoice.chapaTxRef === attempt.merchantReference
      ) {
        const data = await populateInvoiceResponse(invoice, attempt);
        return res.status(200).json({ success: true, data });
      }
    }

    const data = await verifyAttemptAndApply(attempt);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'Could not verify the Chapa payment. Retry shortly; do not pay again until its status is checked.');
  }
};

const handleChapaWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).send('Webhook verification is not configured.');
    }
    if (!Buffer.isBuffer(req.rawBody)) {
      return res.status(400).send('Raw webhook body is required for signature verification.');
    }
    const eventSignature = req.headers['x-chapa-signature'];
    if (typeof eventSignature !== 'string' || !/^[a-f0-9]{64}$/i.test(eventSignature)) {
      return res.status(400).send('Invalid webhook signature.');
    }
    const validEventSignature =
      crypto.timingSafeEqual(
        Buffer.from(eventSignature, 'hex'),
        crypto.createHmac('sha256', webhookSecret).update(req.rawBody).digest()
      );
    if (!validEventSignature) {
      return res.status(400).send('Invalid webhook signature.');
    }

    const event = req.body;
    const transaction = event?.data && typeof event.data === 'object' ? event.data : event;
    if (!transaction || typeof transaction !== 'object') {
      return res.status(400).send('Webhook transaction details are required.');
    }
    const merchantReference = transaction.merchant_reference || transaction.tx_ref;
    const chapaReference = getProviderTransactionReference(transaction);
    if (typeof merchantReference !== 'string' || !merchantReference) {
      return res.status(400).send('Webhook payment references are required.');
    }

    const attempt = await ChapaPayment.findOne({ merchantReference });
    if (!attempt) return res.status(404).send('Payment reference not found.');
    if (
      !isProviderAmountCents(
        transaction.amount,
        getAttemptProviderAmountCents(attempt)
      ) ||
      String(transaction.currency || '').toUpperCase() !== attempt.currency ||
      (transaction.mode && String(transaction.mode).toLowerCase() !== attempt.mode) ||
      !chapaReference ||
      (attempt.chapaReference && chapaReference !== attempt.chapaReference)
    ) {
      await setAttemptStatus(attempt, 'unverified');
      return res.status(400).send('Webhook details do not match the stored payment.');
    }

    const eventStatus = normalizeStatus(transaction.status);
    const eventName = typeof event.event === 'string' ? event.event : '';
    if (eventStatus === 'success' || eventName === 'payment.success') {
      await ChapaPayment.updateOne(
        { _id: attempt._id, status: { $ne: 'success' } },
        { $set: { ...(chapaReference ? { chapaReference } : {}), lastWebhookEvent: eventName || eventStatus } }
      );
      const refreshedAttempt = await ChapaPayment.findById(attempt._id);
      await verifyAttemptAndApply(refreshedAttempt);
      return res.status(200).send('Payment webhook verified.');
    }

    if (TERMINAL_FAILURES.has(eventStatus) || eventStatus === 'pending' || eventStatus === 'processing' || eventStatus === 'auth_needed') {
      await setAttemptStatus(attempt, eventStatus, {
        ...(chapaReference ? { chapaReference } : {}),
        paymentMethod: transaction.payment_method || null,
        lastWebhookEvent: eventName || eventStatus
      });
    }
    return res.status(200).send('Payment webhook received.');
  } catch (error) {
    console.error('Chapa v2 webhook processing failed:', error.response?.status || error.message);
    return res.status(error.statusCode || 503).send('Webhook processing failed; retry delivery.');
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = {};
    if (req.user.role === 'parent') {
      query.parent = req.user._id;
    } else if (['admin', 'staff', 'reception'].includes(req.user.role)) {
      // Admin scope intentionally includes all parent records.
    } else {
      return res.status(403).json({ success: false, message: 'Only parents and administrators can access Chapa payment history.' });
    }

    const status = String(req.query.status || 'all').toLowerCase();
    const allowedStatuses = new Set([
      'all', 'paid', 'success', 'pending', 'processing', 'failed',
      'cancelled', 'expired', 'incomplete', 'blocked', 'auth_needed', 'unverified'
    ]);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status filter.' });
    }
    if (status !== 'all') query.status = status === 'paid' ? 'success' : status;

    const method = String(req.query.method || 'all').trim().toLowerCase();
    if (method.length > 40 || (method && !/^[a-z0-9_-]+$/.test(method))) {
      return res.status(400).json({ success: false, message: 'Invalid payment method filter.' });
    }
    if (method && !['all', 'chapa'].includes(method)) {
      query.paymentMethod = new RegExp(`^${method}$`, 'i');
    }
    const dateRange = {};
    if (req.query.startDate) {
      const start = new Date(req.query.startDate);
      if (Number.isNaN(start.getTime())) return res.status(400).json({ success: false, message: 'Invalid start date.' });
      dateRange.$gte = start;
    }
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      if (Number.isNaN(end.getTime())) return res.status(400).json({ success: false, message: 'Invalid end date.' });
      end.setHours(23, 59, 59, 999);
      dateRange.$lte = end;
    }
    if (dateRange.$gte && dateRange.$lte && dateRange.$gte > dateRange.$lte) {
      return res.status(400).json({ success: false, message: 'Start date must be on or before end date.' });
    }
    if (Object.keys(dateRange).length) query.createdAt = dateRange;

    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search && req.user.role !== 'parent') {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [parents, children, invoices] = await Promise.all([
        User.find({ $or: [{ fullName: regex }, { email: regex }] }).select('_id').lean(),
        Child.find({ $or: [{ firstName: regex }, { lastName: regex }] }).select('_id').lean(),
        Payment.find({ invoiceNumber: regex }).select('_id').lean()
      ]);
      const candidates = [
        ...parents.map(record => ({ parent: record._id })),
        ...children.map(record => ({ child: record._id })),
        ...invoices.map(record => ({ invoice: record._id })),
        { merchantReference: regex },
        { chapaReference: regex },
        { receiptNumber: regex }
      ];
      query.$or = candidates;
    }

    const [records, total, stats] = await Promise.all([
      ChapaPayment.find(query)
        .populate('parent', 'fullName email')
        .populate('child', 'firstName lastName')
        .populate('invoice', 'invoiceNumber type amount amountPaid currency status method dueDate paidDate notes')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ChapaPayment.countDocuments(query),
      ChapaPayment.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            paidCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0] } }
          }
        }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: records.map(record => ({
        ...record,
        invoiceNumber: record.invoice?.invoiceNumber || '',
        type: record.invoice?.type || 'monthly-fee',
        invoiceDetails: record.invoice || null,
        chapaTxRef: record.merchantReference,
        method: record.paymentMethod || 'chapa',
        paidDate: record.verifiedAt || record.providerUpdatedAt || null
      })),
      stats: stats[0] || { totalCount: 0, paidCount: 0, totalPaid: 0 },
      total,
      pages: Math.ceil(total / limit),
      page
    });
  } catch (error) {
    console.error('Chapa payment history failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load payment history.' });
  }
};

module.exports = {
  prepareChapaPayment,
  initializeChapaPayment,
  verifyChapaPayment,
  handleChapaWebhook,
  getPaymentHistory
};
