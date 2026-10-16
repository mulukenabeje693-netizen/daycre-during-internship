import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import SupportModal from '../../components/SupportModal';
import PaymentProgress from '../../components/shared/PaymentProgress';
import api from '../../services/api';

/* ─── helpers ──────────────────────────────────────── */
const fmtCurrency = (n, currency = 'ETB') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* ─── Confetti dot ──────────────────────────────────── */
const CONFETTI_COLORS = ['#00A884','#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7'];

const Confetti = () => {
  const dots = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    x: Math.random() * 200 - 100,
    y: -(Math.random() * 80 + 40),
    size: Math.random() * 6 + 4,
    delay: Math.random() * 0.5,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
      {dots.map(d => (
        <div
          key={d.id}
          className="absolute rounded-full animate-confetti"
          style={{
            width: d.size,
            height: d.size,
            background: d.color,
            transform: `translate(${d.x}px, ${d.y}px)`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

/* ─── Row in receipt ────────────────────────────────── */
const ReceiptRow = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500">{label}</span>
    <span className={`text-xs font-semibold ${highlight ? 'text-[#00A884] text-sm font-bold' : 'text-slate-800'}`}>{value}</span>
  </div>
);

/* ─── Main component ────────────────────────────────── */
const PaymentSuccess = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [retryCooldownSeconds, setRetryCooldownSeconds] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [refreshError, setRefreshError] = useState('');
  const [show,    setShow]    = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const verificationInFlight = useRef(false);
  const automaticVerificationRef = useRef('');
  const params = new URLSearchParams(location.search);
  const invoiceId = params.get('invoice_id');
  const txRef = params.get('tx_ref')?.trim() || null;

  const loadPayment = useCallback(async () => {
    if (verificationInFlight.current || retryCooldownSeconds > 0) return;
    verificationInFlight.current = true;
    setLoading(true);
    setPayment(null);
    setLoadError('');
    setVerificationStatus(txRef ? 'pending-verification' : '');

    try {
      if (txRef) {
        if (!/^MINT-[A-Za-z0-9-]{1,45}$/.test(txRef)) {
          setVerificationStatus('not-found');
          setLoadError('The transaction reference in the return URL is invalid. The invoice has not been marked paid.');
          return;
        }
        const response = await api.post('/payments/verify', { txRef });
        const verifiedPayment = response.data?.data;
        setPayment(verifiedPayment || null);
        setVerificationStatus(verifiedPayment?.status === 'paid' ? 'success' : verifiedPayment?.status || 'unverified');
        if (verifiedPayment?.status === 'paid') {
          if (user?._id) sessionStorage.removeItem(`daycare-payment-invoice:${user._id}`);
          Promise.all([api.get('/payments/invoices'), api.get('/payments')])
            .then(([invoicesResponse, paymentsResponse]) => {
              const invoices = invoicesResponse.data?.data || [];
              setRecentPayments((paymentsResponse.data?.data || []).slice(0, 3));
              setOutstandingBalance(invoices.reduce(
                (total, invoice) => total + Number(invoice.outstandingBalance ?? invoice.amount ?? 0),
                0
              ));
            })
            .catch(() => setRefreshError('Payment is verified, but invoice balances could not be refreshed. Reopen Payments to retry.'));
        }
        if (verifiedPayment?.status !== 'paid') {
          setLoadError('Chapa has not confirmed this payment yet. You can retry verification or check the invoice status.');
        }
      } else if (invoiceId) {
        const response = await api.get(`/payments/${invoiceId}`);
        setPayment(response.data.data);
      } else {
        setLoadError('No invoice or transaction was provided for this receipt.');
      }
    } catch (err) {
      setPayment(null);
      const code = err.response?.data?.code;
      const responseStatus = err.response?.status;
      const isNetworkError = !err.response;
      const providerStatus = err.response?.data?.status;
      const isPending = [
        'CHAPA_TRANSACTION_PENDING',
        'CHAPA_REFERENCE_PENDING',
        'CHAPA_REFERENCE_UNAVAILABLE'
      ].includes(code) && ['pending', 'processing', 'auth_needed'].includes(providerStatus);
      const isUnverified = providerStatus === 'unverified';
      const isTerminal = ['failed', 'cancelled', 'expired'].includes(providerStatus);
      setVerificationStatus(
        isPending || isUnverified ? 'pending' :
        isTerminal ? providerStatus :
        responseStatus === 429 ? 'verification-delayed' :
        code === 'CHAPA_REFERENCE_NOT_FOUND' || responseStatus === 404 ? 'not-found' :
        code === 'CHAPA_INVOICE_MISMATCH' ||
          (responseStatus === 409 && !isPending && !isUnverified && code !== 'CHAPA_TRANSACTION_TERMINAL') ? 'conflict' :
        providerStatus ||
        (responseStatus === 401 || responseStatus === 403 ? 'authentication-error' :
          code || isNetworkError ? 'verification-error' : 'unverified')
      );
      const errorMessages = {
        CHAPA_CREDENTIALS_MISSING: 'Chapa credentials are not configured on the server. Your invoice remains unpaid; please contact the daycare administrator.',
        CHAPA_CREDENTIALS_REJECTED: 'Chapa rejected the server credentials. Your invoice remains unpaid; please contact the daycare administrator.',
        CHAPA_ENVIRONMENT_MISMATCH: 'This transaction was started in a different Chapa environment than the active server credentials. Contact the daycare administrator.',
        CHAPA_REFERENCE_NOT_FOUND: 'Chapa could not find this transaction reference. The invoice has not been marked paid.',
        CHAPA_REFERENCE_PENDING: 'Chapa has not provided its transaction reference yet. Your invoice remains unpaid; retry verification after a short wait.',
        CHAPA_REFERENCE_UNAVAILABLE: 'Chapa has not provided its verification reference yet. The invoice remains unpaid; contact the daycare administrator to configure the payment callback.',
        CHAPA_INVOICE_MISMATCH: 'This transaction does not match the stored invoice. No payment was recorded; contact the daycare administrator.',
        CHAPA_VERIFICATION_UNAVAILABLE: 'Chapa verification is temporarily unavailable. Your invoice remains unpaid; retry verification shortly.',
        CHAPA_INVALID_VERIFICATION_RESPONSE: 'Chapa returned an invalid verification response. Your invoice remains unpaid; retry verification or contact support.',
        PAYMENT_RATE_LIMITED: 'Too many verification requests. Please wait before retrying; the invoice remains unpaid until Chapa confirms payment.',
        AUTH_SERVICE_UNAVAILABLE: 'Your session could not be checked because the authentication service is temporarily unavailable. Retry verification; you do not need to sign in again.',
      };
      if (responseStatus === 429) {
        const retryAfterHeader = Number(err.response?.headers?.['retry-after']);
        const retryAfterBody = Number(err.response?.data?.retryAfterSeconds);
        const retryAfterSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader
          : Number.isFinite(retryAfterBody) && retryAfterBody > 0
            ? retryAfterBody
            : 60;
        setRetryCooldownSeconds(Math.ceil(retryAfterSeconds));
      } else if (isPending) {
        setRetryCooldownSeconds(5);
      } else if (code === 'CHAPA_VERIFICATION_UNAVAILABLE' || isNetworkError) {
        setRetryCooldownSeconds(10);
      }
      setLoadError(
        errorMessages[code] ||
        (isNetworkError
          ? 'Could not reach the payment service to verify this transaction. Your invoice remains unpaid; retry when the connection is available.'
          : responseStatus === 401 || responseStatus === 403
            ? 'Your session is not authorized to verify this payment. Sign in with the parent account that started checkout.'
            : responseStatus === 404
              ? 'The payment transaction was not found. Check the transaction reference or return to your invoices.'
              : responseStatus === 409
                ? err.response?.data?.message || 'The payment conflicts with the current invoice state. The invoice remains unpaid; contact the daycare administrator.'
              : err.response?.data?.message || 'Could not verify or load the payment receipt. Please retry.')
      );
    } finally {
      verificationInFlight.current = false;
      setLoading(false);
      setShow(true);
    }
  }, [invoiceId, retryCooldownSeconds, txRef, user?._id]);

  useEffect(() => {
    const verificationTarget = `${user?._id || 'anonymous'}:${txRef || `invoice:${invoiceId || 'missing'}`}`;
    if (automaticVerificationRef.current === verificationTarget) return;
    automaticVerificationRef.current = verificationTarget;
    loadPayment();
  }, [invoiceId, loadPayment, txRef, user?._id]);

  useEffect(() => {
    if (retryCooldownSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRetryCooldownSeconds(current => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCooldownSeconds > 0]);

  const data = payment ? {
    receiptNumber: payment.receiptNumber || '—',
    txId:          payment.chapaTxRef || payment.bankTransferProviderReference || '—',
    providerReference: payment.chapaReference || '—',
    childName:     `${payment.child?.firstName || ''} ${payment.child?.lastName || ''}`.trim() || 'N/A',
    parentName:    payment.parent?.fullName || user?.fullName || 'Parent',
    classroom:     payment.child?.classroom?.name || '—',
    invoiceNumber: payment.invoiceNumber || '—',
    paymentDate:   fmtDate(payment.paidDate),
    method:        payment.paymentMethod || payment.method || '—',
    amountPaid:    payment.chapaAmount ?? payment.amount ?? 0,
    currency:      payment.currency || 'ETB',
    nextDue:       new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    type:          payment.type?.replace(/-/g,' ') || 'Monthly Fee',
    parentEmail:   payment.parent?.email || user?.email || '',
    invoiceBalanceRemaining: Math.max(
      0,
      Number(payment.amount || 0) - (payment.status === 'paid' ? Number(payment.amount || 0) : Number(payment.amountPaid || 0))
    ),
  } : null;
  const paymentConfirmed =
    payment?.status === 'paid' &&
    Boolean(payment.verifiedAt) &&
    Boolean(payment.receiptNumber) &&
    (
      (payment.method === 'chapa' && Boolean(txRef) && payment.chapaTxRef === txRef) ||
      (payment.method === 'bank-transfer' && payment.bankTransferStatus === 'verified' && Boolean(invoiceId))
    );
  const canStartNewCheckout = Boolean(txRef) &&
    ['failed', 'expired', 'cancelled'].includes(verificationStatus);
  const retryPaymentsPath = (() => {
    const selectedInvoiceId = user?._id
      ? sessionStorage.getItem(`daycare-payment-invoice:${user._id}`)
      : null;
    return selectedInvoiceId
      ? `/dashboard/parent/payments?invoiceId=${encodeURIComponent(selectedInvoiceId)}`
      : '/dashboard/parent/payments';
  })();

  const handleDownload = () => {
    const lines = [
      `MINT Daycare - Payment Receipt`,
      `================================`,
      `Receipt No:    ${data.receiptNumber}`,
      `Transaction:   ${data.txId}`,
      `Chapa Ref:     ${data.providerReference}`,
      `Child:         ${data.childName}`,
      `Parent:        ${data.parentName}`,
      `Classroom:     ${data.classroom}`,
      `Invoice No:    ${data.invoiceNumber}`,
      `Payment Date:  ${data.paymentDate}`,
      `Method:        ${data.method}`,
      `Amount Paid:   ${fmtCurrency(data.amountPaid, data.currency)}`,
      `Next Due:      ${data.nextDue}`,
      `================================`,
      `Thank you for your payment!`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${data.receiptNumber}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center h-64 gap-3 text-sm text-slate-600">
      <div className="w-10 h-10 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin" />
      <span>{txRef ? 'Verifying your payment with Chapa. This can take a few moments.' : 'Loading payment receipt…'}</span>
    </div>
  );

  if (!paymentConfirmed) {
    const statusMessage = verificationStatus === 'pending'
      ? 'Payment Pending. We are verifying your transaction. Please check again later.'
      : verificationStatus === 'cancelled'
        ? 'Payment Cancelled. No payment was recorded. You can return to your invoice and try again.'
        : ['failed', 'expired'].includes(verificationStatus)
        ? 'Payment Failed. Your payment was not completed. Please try again.'
        : verificationStatus === 'verification-error'
          ? loadError || 'The verification service is unavailable. Your invoice remains unpaid; retry verification shortly.'
          : verificationStatus === 'authentication-error'
            ? loadError || 'Sign in with the parent account that started this payment.'
            : verificationStatus === 'conflict'
              ? loadError || 'The transaction conflicts with the current invoice state. The invoice remains unpaid; contact the daycare administrator.'
            : verificationStatus === 'not-found'
              ? loadError || 'The transaction reference was not found.'
        : loadError || 'Payment not confirmed. We could not verify this transaction. Please check again later.';
    const canRetryVerification = Boolean(txRef) &&
      !['failed', 'expired', 'cancelled', 'authentication-error', 'not-found', 'conflict'].includes(verificationStatus);

    return (
      <div className="min-h-screen bg-slate-50 -m-6 px-8 py-8 flex items-center justify-center">
        <div className="max-w-3xl w-full">
          <PaymentProgress
            currentStep={paymentConfirmed ? 4 : txRef ? 3 : 1}
            resultStatus={verificationStatus}
          />
          <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <i className="bx bx-time-five text-5xl text-amber-500" />
            <h1 className="mt-4 text-2xl font-bold text-slate-800">
              {verificationStatus === 'pending' ? 'Payment Pending' : verificationStatus === 'cancelled' ? 'Payment Cancelled' : ['failed', 'expired'].includes(verificationStatus) ? 'Payment Failed' : verificationStatus === 'conflict' ? 'Payment Needs Review' : 'Payment not confirmed'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{statusMessage}</p>
            {canRetryVerification && (
              <button
                type="button"
                onClick={loadPayment}
                disabled={loading || retryCooldownSeconds > 0}
                className="mt-6 mr-2 rounded-xl border border-[#00A884] px-5 py-3 text-sm font-semibold text-[#00A884] disabled:opacity-60"
              >
                {loading
                  ? 'Checking with Chapa…'
                  : retryCooldownSeconds > 0
                    ? `Retry verification in ${retryCooldownSeconds}s`
                    : 'Retry verification'}
              </button>
            )}
            {canStartNewCheckout && (
              <button
                type="button"
                onClick={() => navigate(retryPaymentsPath)}
                className="mt-6 mr-2 rounded-xl bg-[#00A884] px-5 py-3 text-sm font-semibold text-white"
              >
                Try Again
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard/parent/payments')}
              className="mt-6 rounded-xl bg-[#00A884] px-5 py-3 text-sm font-semibold text-white"
            >
              View Invoices
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 -m-6 px-8 py-8">
      {/* Breadcrumb */}
      <p className="text-xs text-slate-400 mb-2">
        <span className="hover:text-[#00A884] cursor-pointer" onClick={() => navigate('/dashboard/parent/payments')}>{t('payments', 'Payments')}</span>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600 font-semibold">{t('makeAPayment', 'Make Payment')}</span>
      </p>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Payment Successful! Your daycare fee has been paid successfully.</h1>
      </div>

      {/* Stepper — all complete */}
      <PaymentProgress currentStep={4} successful />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">

        {/* ── LEFT: success card + receipt ── */}
        <div className="space-y-5">

          {/* Animated success card */}
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center relative overflow-hidden transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Confetti />
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#00A884]/10 border-4 border-[#00A884]/20 mb-5 mx-auto">
              <div className="w-16 h-16 rounded-full bg-[#00A884] flex items-center justify-center shadow-lg shadow-[#00A884]/40">
                <i className="bx bx-check text-4xl text-white font-bold" />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">{t('thankYou', 'Thank You!')}</h2>
            <p className="text-slate-500 text-sm">{t('thankYouDesc', 'Your payment has been completed successfully.')}</p>
          </div>

          {/* Receipt card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <ReceiptRow label={t('receiptNumber', 'Receipt Number')}  value={data.receiptNumber} />
            <ReceiptRow label={t('transactionId', 'Transaction ID')}  value={data.txId} />
            {payment.method === 'chapa' && <ReceiptRow label="Chapa provider reference" value={data.providerReference} />}
            {payment.method === 'bank-transfer' && <ReceiptRow label="Bank transaction reference" value={data.txId} />}
            <ReceiptRow label={t('invoiceNumber', 'Invoice Number')}  value={data.invoiceNumber} />
            <ReceiptRow label={t('childName', 'Child Name')}      value={data.childName} />
            <ReceiptRow label={t('paymentFor', 'Payment For')}     value={data.type} />
            <ReceiptRow label={t('amountPaid', 'Amount Paid')}     value={fmtCurrency(data.amountPaid, data.currency)} highlight />
            <ReceiptRow label={t('paymentStatus', 'Payment Status')} value={t('paid', 'Paid')} />
            <ReceiptRow label={t('paymentMethod', 'Payment Method')}  value={data.method} />
            <ReceiptRow label={t('datePaid', 'Payment Date')}    value={data.paymentDate} />
            <ReceiptRow label={t('nextDueDate', 'Next Due Date')}   value={data.nextDue} />
            <ReceiptRow label="Remaining balance on this invoice" value={fmtCurrency(data.invoiceBalanceRemaining, data.currency)} />
            </div>

            {outstandingBalance !== null && (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <p className="text-xs text-slate-500">Total outstanding across other unpaid invoices</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{fmtCurrency(outstandingBalance, data.currency)}</p>
              </div>
          )}
          {refreshError && <p role="status" className="text-xs text-amber-700">{refreshError}</p>}
          {recentPayments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-800">Recently refreshed payment history</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {recentPayments.map(record => (
                  <li key={record._id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="text-slate-600">{record.invoiceNumber}</span>
                    <span className="font-semibold text-slate-800">{fmtCurrency(record.amount, record.currency)}</span>
                    <span className={record.status === 'paid' ? 'font-semibold text-emerald-700' : 'text-slate-500'}>
                      {record.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Email receipt banner */}
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
            <i className="bx bx-check-circle text-[#00A884] text-xl flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Payment recorded successfully.</p>
              <p className="text-xs text-slate-500 mt-0.5">{data.parentEmail}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-300 text-slate-700 font-semibold text-sm hover:border-[#00A884] hover:text-[#00A884] transition"
            >
              <i className="bx bx-download text-lg" /> {t('downloadReceipt', 'Download Receipt')}
            </button>
            <button
              onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-300 text-slate-700 font-semibold text-sm hover:border-[#00A884] hover:text-[#00A884] transition"
            >
              <i className="bx bx-printer text-lg" /> {t('printReceipt', 'Print Receipt')}
            </button>
            <button
              onClick={() => navigate('/dashboard/parent/payments')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-300 text-slate-700 font-semibold text-sm hover:border-[#00A884] hover:text-[#00A884] transition"
            >
              <i className="bx bx-receipt text-lg" /> {t('viewInvoices', 'View Invoices')}
            </button>
            <button
              onClick={() => navigate('/dashboard/parent/payments?tab=receipts')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-[#00A884] text-[#00A884] font-semibold text-sm hover:bg-[#00A884]/5 transition"
            >
              <i className="bx bx-history text-lg" /> {t('receiptsHistory', 'Next: Receipt History')}
              <i className="bx bx-right-arrow-alt text-lg" />
            </button>
            <button
              onClick={() => navigate('/dashboard/parent')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-sm shadow-lg shadow-[#00A884]/30 hover:-translate-y-0.5 transition-all"
              style={{ background: 'linear-gradient(135deg, #00A884 0%, #00C49A 100%)' }}
            >
              <i className="bx bx-home text-lg" /> {t('backToDashboard', 'Back to Dashboard')}
            </button>
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-400 text-center pt-2">© 2026 Daycare Center. All rights reserved.</p>
        </div>

        {/* ── RIGHT: sidebar ── */}
        <div className="space-y-4">

          {/* Payment summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">{t('paymentSummary', 'Payment Summary')}</h3>

            {/* Child */}
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials(data.childName)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{data.childName}</p>
                <p className="text-xs text-slate-400">{data.type}</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5 mb-4">
              {[
                { label: t('monthlyFee', 'Monthly Fee'),      amount: data.amountPaid },
                { label: t('lateFee', 'Late Fee'),         amount: 0 },
                { label: t('discount', 'Discount'),         amount: 0, negative: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{row.label}</span>
                  <span className={`font-semibold ${row.negative ? 'text-emerald-500' : 'text-slate-700'}`}>
                    {row.negative ? `-${fmtCurrency(row.amount, data.currency)}` : fmtCurrency(row.amount, data.currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">{t('totalAmount', 'Total Amount')}</span>
                <span className="text-2xl font-extrabold text-[#00A884]">{fmtCurrency(data.amountPaid, data.currency)}</span>
              </div>
            </div>
          </div>

          {/* Security card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <i className="bx bx-shield-alt-2 text-[#00A884] text-xl" />
              <h4 className="font-bold text-slate-800 text-sm">{t('yourPaymentIsSecure', 'Your payment is secure')}</h4>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2"><i className="bx bx-check text-[#00A884]" /> {t('sslEncrypted', 'SSL Encrypted')}</div>
              <div className="flex items-center gap-2"><i className="bx bx-check text-[#00A884]" /> {payment.method === 'chapa' ? 'Verified by Chapa' : 'Confirmed by daycare'}</div>
              <div className="flex items-center gap-2"><i className="bx bx-check text-[#00A884]" /> {t('paymentSuccessful', 'Payment Completed')}</div>
            </div>
          </div>

          {/* Need Help */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <i className="bx bx-headphone text-[#00A884] text-xl" />
              <h4 className="font-bold text-slate-800 text-sm">{t('needHelp', 'Need Help?')}</h4>
            </div>
            <p className="text-xs text-slate-500 mb-4">{t('ifYouFaceIssues', 'If you face any issues with payment, please contact our support team.')}</p>
            <button 
              onClick={() => setIsSupportModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#00A884] text-[#00A884] text-xs font-semibold hover:bg-[#00A884]/5 transition"
            >
              <i className="bx bx-support" /> {t('contactSupport', 'Contact Support')} <i className="bx bx-link-external text-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* Confetti CSS */}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 1; }
          100% { transform: translate(calc(var(--tx) * 1.5), calc(var(--ty) + 120px)) scale(0.3) rotate(360deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti-fall 1.5s ease-out forwards; }
      `}</style>

      <SupportModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} />
    </div>
  );
};

export default PaymentSuccess;
