import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';

const formatAmount = (amount, currency = 'ETB') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : '—';

const STATUS_STYLES = {
  success: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-sky-100 text-sky-700',
  failed: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-600',
  incomplete: 'bg-orange-100 text-orange-700',
  blocked: 'bg-rose-100 text-rose-700',
  auth_needed: 'bg-violet-100 text-violet-700',
  unverified: 'bg-amber-100 text-amber-700'
};

const ParentPaymentHistory = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [chapaResponse, paymentsResponse] = await Promise.all([
        api.get('/payments/history'),
        api.get('/payments')
      ]);
      if (
        chapaResponse.data?.success !== true ||
        !Array.isArray(chapaResponse.data.data) ||
        paymentsResponse.data?.success !== true ||
        !Array.isArray(paymentsResponse.data.data)
      ) {
        throw new Error('The payment history service returned an invalid response.');
      }
      const chapaRecords = chapaResponse.data.data.map(record => ({
        ...record,
        invoiceId: record.invoice?._id || record.invoice,
        transactionReference: record.merchantReference,
        paymentMethod: record.method || 'chapa',
        description: record.invoiceDetails?.notes || record.type?.replace(/-/g, ' ') || 'Invoice'
      }));
      const otherPaymentRecords = paymentsResponse.data.data
        .filter(payment =>
          payment.method &&
          payment.method !== 'chapa' &&
          (payment.status === 'paid' || ['pending_verification', 'verified', 'rejected'].includes(payment.bankTransferStatus))
        )
        .map(payment => ({
          ...payment,
          _id: `invoice-payment-${payment._id}`,
          invoiceId: payment._id,
          status: payment.bankTransferStatus === 'pending_verification'
            ? 'pending'
            : payment.bankTransferStatus === 'rejected'
              ? 'failed'
              : payment.status === 'paid'
                ? 'paid'
                : payment.status,
          paymentMethod: payment.method,
          merchantReference: payment.bankTransferProviderReference || payment.bankTransferReference || '',
          transactionReference: payment.bankTransferProviderReference || payment.bankTransferReference || '',
          createdAt: payment.bankTransferSubmittedAt || payment.paidDate || payment.createdAt,
          description: payment.notes || payment.type?.replace(/-/g, ' ') || 'Invoice'
        }));
      setRecords([...chapaRecords, ...otherPaymentRecords].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      ));
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || 'Could not load payment history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your payment history…</div>;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p>{error}</p>
        <button type="button" onClick={loadHistory} className="mt-3 rounded-lg border border-rose-300 px-4 py-2 font-semibold">Retry</button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t('paymentHistoryHeader', 'Payment history')}</h2>
          <p className="text-sm text-slate-500">{t('paymentHistoryDescription', 'Your verified payments and recorded checkout attempts.')}</p>
        </div>
        <button type="button" onClick={loadHistory} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-teal-500 hover:text-teal-700">{t('refresh', 'Refresh')}</button>
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          {t('paymentHistoryEmpty', 'No payment attempts or recorded payments are available yet.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-teal-900/30 dark:bg-[#111c2d]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#0d1520]">
              <tr>
                <th className="px-4 py-3">{t('invoiceChildLabel', 'Invoice / Child')}</th>
                <th className="px-4 py-3">{t('descriptionMethodLabel', 'Description / Method')}</th>
                <th className="px-4 py-3">{t('amountLabel', 'Amount')}</th>
                <th className="px-4 py-3">{t('statusLabel', 'Status')}</th>
                <th className="px-4 py-3">{t('transactionReferenceLabel', 'Transaction reference')}</th>
                <th className="px-4 py-3">{t('dateLabel', 'Date')}</th>
                <th className="px-4 py-3">{t('receiptLabel', 'Receipt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-teal-900/30">
              {records.map(record => (
                <tr key={record._id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 dark:text-white">{record.invoiceNumber || 'Invoice'}</p>
                    <p className="text-xs text-slate-500">{record.child?.firstName} {record.child?.lastName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700 dark:text-slate-200">{record.description || 'Invoice'}</p>
                    <p className="text-xs capitalize text-slate-500">{record.paymentMethod || 'Chapa'}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{formatAmount(record.amount, record.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_STYLES[record.status] || STATUS_STYLES.unverified}`}>
                      {record.status === 'success' || record.status === 'paid'
                        ? t('paymentStatusPaid', 'Paid')
                        : record.status === 'pending'
                          ? t('paymentStatusPending', 'Pending')
                          : record.status === 'failed'
                            ? t('paymentStatusFailed', 'Failed')
                            : record.status === 'cancelled'
                              ? t('paymentStatusCancelled', 'Cancelled')
                              : record.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{record.transactionReference || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(record.verifiedAt || record.createdAt)}</td>
                  <td className="px-4 py-3">
                    {['success', 'paid'].includes(record.status) && record.receiptNumber ? (
                      <button
                        type="button"
                        onClick={() => navigate(record.paymentMethod === 'chapa'
                          ? `/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(record.merchantReference)}`
                          : `/dashboard/parent/payments/success?invoice_id=${encodeURIComponent(record.invoiceId)}`)}
                        className="font-semibold text-teal-700 underline"
                      >
                        {record.receiptNumber}
                      </button>
                    ) : <span className="text-xs text-slate-400">{t('receiptAvailableAfterVerification', 'Available after verification')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ParentPaymentHistory;
