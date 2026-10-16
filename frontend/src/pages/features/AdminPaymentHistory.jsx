import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useSettings } from '../../context/useSettings';

const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const csvCell = (value) => {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const buildHistoryParams = (page, limit, filters) => {
  const params = new URLSearchParams({ page, limit });
  if (filters.status !== 'all') params.append('status', filters.status);
  if (filters.method !== 'all') params.append('method', filters.method);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.search.trim()) params.append('search', filters.search.trim());
  return params;
};

const STATUS_BADGE = {
  success:   'bg-emerald-100 text-emerald-700',
  paid:      'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-600',
  processing:'bg-sky-100 text-sky-700',
  failed:    'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
  incomplete:'bg-orange-100 text-orange-700',
  blocked:   'bg-rose-100 text-rose-700',
  unverified:'bg-amber-100 text-amber-700',
  overdue:   'bg-rose-100 text-rose-600',
};

const AdminPaymentHistory = () => {
  const {
    onlinePaymentsEnabled,
    paymentSettingEnabled,
    onlinePaymentsDisabledReason,
    chapaConfigured,
    setOnlinePaymentsEnabled
  } = useSettings();
  const [payments,   setPayments]   = useState([]);
  const [stats,      setStats]      = useState({});
  const [invoiceStats, setInvoiceStats] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState(false);
  const [error,      setError]      = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('all');
  const [method,     setMethod]     = useState('all');
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [togglingMode, setTogglingMode] = useState(false);
  const [manualTransfers, setManualTransfers] = useState([]);
  const [manualTransferNotes, setManualTransferNotes] = useState({});
  const [reviewingTransfer, setReviewingTransfer] = useState('');
  const LIMIT = 20;

  const handleToggleFreeMode = async () => {
    setTogglingMode(true);
    try { await setOnlinePaymentsEnabled(!paymentSettingEnabled); }
    catch (e) { setError(e.response?.data?.message || 'Could not update online payment setting.'); }
    finally { setTogglingMode(false); }
  };

  const fetchHistory = useCallback(async (p = 1) => {
    setLoading(true); setError('');
    try {
      const filters = { status, method, startDate, endDate, search };
      const [res, invoiceSummary] = await Promise.all([
        api.get(`/payments/history?${buildHistoryParams(p, LIMIT, filters)}`),
        api.get('/payments/summary')
      ]);
      setPayments(res.data.data   || []);
      setStats(res.data.stats     || {});
      setInvoiceStats(invoiceSummary.data.stats || {});
      setTotal(res.data.total     || 0);
      setTotalPages(res.data.pages || 1);
      setPage(p);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payment history.');
    } finally {
      setLoading(false);
    }
  }, [search, status, method, startDate, endDate]);

  useEffect(() => { fetchHistory(1); }, [fetchHistory]);

  const fetchManualTransfers = useCallback(async () => {
    try {
      const response = await api.get('/payments/manual-transfers');
      if (response.data?.success !== true || !Array.isArray(response.data.data)) {
        throw new Error('Invalid manual transfer review response.');
      }
      setManualTransfers(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load transfers awaiting verification.');
    }
  }, []);

  useEffect(() => { fetchManualTransfers(); }, [fetchManualTransfers]);

  const reviewManualTransfer = async (transfer, decision) => {
    const note = String(manualTransferNotes[transfer._id] || '').trim();
    if (note.length < 5) {
      setError('Enter a review note of at least 5 characters before approving or rejecting a transfer.');
      return;
    }
    setReviewingTransfer(transfer._id);
    setError('');
    try {
      await api.post(`/payments/${transfer._id}/manual-transfer-review`, { decision, note });
      setManualTransferNotes(current => ({ ...current, [transfer._id]: '' }));
      await Promise.all([fetchManualTransfers(), fetchHistory(page)]);
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${decision} this bank transfer.`);
    } finally {
      setReviewingTransfer('');
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setError('');
    try {
      const filters = { status, method, startDate, endDate, search };
      const firstPage = await api.get(`/payments/history?${buildHistoryParams(1, 100, filters)}`);
      const allPayments = [...(firstPage.data.data || [])];
      for (let currentPage = 2; currentPage <= (firstPage.data.pages || 1); currentPage += 1) {
        const response = await api.get(`/payments/history?${buildHistoryParams(currentPage, 100, filters)}`);
        allPayments.push(...(response.data.data || []));
      }
      const rows = [
        ['Receipt #','Invoice #','Merchant reference','Chapa reference','Parent','Child','Type','Transaction amount','Currency','Invoice total','Amount paid','Outstanding balance','Invoice status','Payment status','Method','Date'],
        ...allPayments.map(p => {
          const invoice = p.invoiceDetails || {};
          const invoiceTotal = Number(invoice.amount) || 0;
          const amountPaid = invoice.status === 'paid'
            ? invoiceTotal
            : Math.min(invoiceTotal, Number(invoice.amountPaid) || 0);
          return [
            p.receiptNumber || '—',
            p.invoiceNumber || '—',
            p.merchantReference || '—',
            p.chapaReference || '—',
            p.parent?.fullName || '—',
            `${p.child?.firstName || ''} ${p.child?.lastName || ''}`.trim() || '—',
            p.type?.replace(/-/g,' ') || '—',
            p.amount || 0,
            p.currency || invoice.currency || 'ETB',
            invoiceTotal,
            amountPaid,
            Math.max(0, invoiceTotal - amountPaid),
            invoice.status || '—',
            p.status || '—',
            p.paymentMethod || p.method || 'Chapa',
            fmtDate(p.verifiedAt || p.createdAt)
          ];
        })
      ];
      const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `payment-history-${new Date().toISOString().split('T')[0]}.csv`
      });
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export payment history.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Payment Mode Toggle */}
      <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border ${
        paymentSettingEnabled ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
      }`}>
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className={`bx ${paymentSettingEnabled ? 'bx-credit-card text-amber-500' : 'bx-gift text-emerald-500'} text-lg`} />
            {paymentSettingEnabled ? 'Online payments enabled' : 'Online payments disabled'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {paymentSettingEnabled
              ? 'Parents can pay outstanding invoices securely with Chapa.'
              : 'Parents can view invoices and receipt history; Chapa checkout is disabled.'}
          </p>
          {!chapaConfigured && <p className="text-xs text-amber-600 mt-1">Configure the Chapa secret key on the backend before enabling online payments.</p>}
          {paymentSettingEnabled && !onlinePaymentsEnabled && onlinePaymentsDisabledReason && (
            <p className="text-xs text-amber-600 mt-1">Checkout is blocked: {onlinePaymentsDisabledReason}</p>
          )}
        </div>
        <button
          onClick={handleToggleFreeMode}
          disabled={togglingMode}
          title="Enable or disable Chapa online payments"
          className={`relative inline-flex h-7 min-w-[3.25rem] items-center rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-60 ${
            paymentSettingEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
          aria-label={paymentSettingEnabled ? 'Disable online payments' : 'Enable online payments'}
          aria-pressed={paymentSettingEnabled}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${
            paymentSettingEnabled ? 'translate-x-7' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { icon: 'bx-money',        label: 'Verified Chapa Collected', value: fmtCurrency(stats.totalPaid), cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { icon: 'bx-receipt',      label: 'Total Invoices', value: invoiceStats.totalInvoices || 0, cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
          { icon: 'bx-check-circle', label: 'Paid Invoices', value: invoiceStats.paidInvoices || 0, cls: 'bg-teal-50 border-teal-200 text-teal-700' },
          { icon: 'bx-time-five',    label: 'Unpaid Invoices', value: invoiceStats.unpaidInvoices || 0, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
          { icon: 'bx-adjust',       label: 'Partially Paid', value: invoiceStats.partiallyPaidInvoices || 0, cls: 'bg-sky-50 border-sky-200 text-sky-700' },
          { icon: 'bx-transfer',     label: 'Matching Chapa Transactions', value: total, cls: 'bg-slate-50 border-slate-200 text-slate-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-5 border ${s.cls}`}>
            <i className={`bx ${s.icon} text-2xl mb-2 block`} />
            <p className="text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs mt-1 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl px-5 py-4 text-sm font-medium">
          <i className="bx bx-error-circle mr-2" />{error}
        </div>
      )}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Bank transfers awaiting verification</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Match each submitted transaction against actual bank records before approving it. Approval marks the invoice paid and creates its receipt.
            </p>
          </div>
          <button type="button" onClick={fetchManualTransfers} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900">
            Refresh
          </button>
        </div>
        {manualTransfers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No transfers are awaiting verification.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {manualTransfers.map(transfer => (
              <article key={transfer._id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-teal-900/30 dark:bg-[#111c2d]">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>Parent: <strong>{transfer.parent?.fullName || '—'}</strong> ({transfer.parent?.email || '—'})</p>
                  <p>Child: <strong>{transfer.child ? `${transfer.child.firstName} ${transfer.child.lastName}` : '—'}</strong></p>
                  <p>Invoice: <strong>{transfer.invoiceNumber}</strong></p>
                  <p>Amount: <strong>{fmtCurrency(transfer.amount)} {transfer.currency}</strong></p>
                  <p>Daycare transfer reference: <span className="font-mono">{transfer.bankTransferReference}</span></p>
                  <p>Bank transaction reference: <span className="font-mono">{transfer.bankTransferProviderReference}</span></p>
                </div>
                <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={`transfer-review-${transfer._id}`}>
                  Bank-record verification note
                </label>
                <input
                  id={`transfer-review-${transfer._id}`}
                  value={manualTransferNotes[transfer._id] || ''}
                  onChange={event => setManualTransferNotes(current => ({ ...current, [transfer._id]: event.target.value }))}
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-teal-900/40 dark:bg-[#0d1520] dark:text-white"
                  placeholder="For example: matched bank statement entry on date..."
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={reviewingTransfer === transfer._id} onClick={() => reviewManualTransfer(transfer, 'approve')} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                    Confirm funds received
                  </button>
                  <button type="button" disabled={reviewingTransfer === transfer._id} onClick={() => reviewManualTransfer(transfer, 'reject')} className="rounded-lg border border-rose-300 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-60">
                    Reject transfer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Filters */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search parent, invoice, receipt or transaction reference..."
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchHistory(1)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-teal-900/40 bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white text-sm focus:outline-none focus:border-[#00A884]" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-teal-900/40 px-4 py-2.5 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none">
            <option value="all">All Status</option>
            <option value="success">Successful</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
            <option value="incomplete">Incomplete</option>
            <option value="blocked">Blocked</option>
            <option value="unverified">Unverified</option>
          </select>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-teal-900/40 px-4 py-2.5 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none">
            <option value="all">All Methods</option>
            <option value="card">Card</option>
            <option value="telebirr">Telebirr</option>
            <option value="cbe_birr">CBE Birr</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-teal-900/40 px-3 py-2 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">To Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-teal-900/40 px-3 py-2 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <button onClick={() => fetchHistory(1)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#009070] text-white font-semibold text-sm transition">
              <i className="bx bx-filter-alt" /> Apply Filters
            </button>
            <button onClick={() => { setSearch(''); setStatus('all'); setMethod('all'); setStartDate(''); setEndDate(''); }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-teal-900/30 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-[#0d1520] transition">
              Reset
            </button>
          </div>
          <div className="flex justify-start sm:justify-end">
            <button onClick={handleExportCSV} disabled={total === 0 || exporting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition disabled:opacity-40">
              <i className={`bx ${exporting ? 'bx-loader-alt animate-spin' : 'bx-download'}`} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
          {selectedPayment && (() => {
            const invoice = selectedPayment.invoiceDetails || {};
            const invoiceAmount = Number(invoice.amount) || 0;
            const amountPaid = invoice.status === 'paid'
              ? invoiceAmount
              : Math.min(invoiceAmount, Number(invoice.amountPaid) || 0);
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
                role="presentation" onClick={event => event.target === event.currentTarget && setSelectedPayment(null)}>
                <section role="dialog" aria-modal="true" aria-labelledby="payment-detail-title"
                  className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111c2d] shadow-2xl">
                  <header className="flex items-center justify-between border-b border-slate-100 dark:border-teal-900/30 px-6 py-4">
                    <div>
                      <h2 id="payment-detail-title" className="text-lg font-bold text-slate-800 dark:text-white">Payment transaction</h2>
                      <p className="text-xs text-slate-500">{selectedPayment.invoiceNumber || 'Invoice'} · {selectedPayment.receiptNumber || 'No receipt'}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedPayment(null)} aria-label="Close transaction details"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#0d1520]">
                      <i className="bx bx-x text-xl" />
                    </button>
                  </header>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payer</p>
                      <p className="mt-1 font-semibold text-slate-800 dark:text-white">{selectedPayment.parent?.fullName || '—'}</p>
                      <p className="text-xs text-slate-500">{selectedPayment.parent?.email || ''}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Child</p>
                      <p className="mt-1 font-semibold text-slate-800 dark:text-white">
                        {selectedPayment.child ? `${selectedPayment.child.firstName} ${selectedPayment.child.lastName}` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Transaction reference</p>
                      <p className="mt-1 break-all font-mono text-sm text-slate-700 dark:text-slate-200">{selectedPayment.merchantReference || '—'}</p>
                      {selectedPayment.chapaReference && <p className="mt-1 break-all font-mono text-xs text-slate-500">Chapa: {selectedPayment.chapaReference}</p>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment status / method</p>
                      <p className="mt-1 capitalize text-slate-800 dark:text-white">{selectedPayment.status} · {selectedPayment.paymentMethod || 'Chapa'}</p>
                      <p className="text-xs text-slate-500">Updated {fmtDate(selectedPayment.verifiedAt || selectedPayment.providerUpdatedAt || selectedPayment.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Transaction amount</p>
                      <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white">{fmtCurrency(selectedPayment.amount)} {selectedPayment.currency || 'ETB'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Receipt</p>
                      <p className="mt-1 font-mono text-sm text-slate-800 dark:text-white">{selectedPayment.receiptNumber || 'Not issued'}</p>
                      <p className="text-xs text-slate-500">{fmtDate(selectedPayment.receiptGeneratedAt)}</p>
                    </div>
                    <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4 dark:bg-[#0d1520]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice accounting</p>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div><p className="text-xs text-slate-500">Invoice total</p><p className="font-semibold text-slate-800 dark:text-white">{fmtCurrency(invoiceAmount)}</p></div>
                        <div><p className="text-xs text-slate-500">Amount paid</p><p className="font-semibold text-slate-800 dark:text-white">{fmtCurrency(amountPaid)}</p></div>
                        <div><p className="text-xs text-slate-500">Outstanding</p><p className="font-semibold text-slate-800 dark:text-white">{fmtCurrency(Math.max(0, invoiceAmount - amountPaid))}</p></div>
                        <div><p className="text-xs text-slate-500">Invoice status</p><p className="font-semibold capitalize text-slate-800 dark:text-white">{invoice.status || '—'}</p></div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <i className="bx bx-receipt text-5xl block mb-3 opacity-30" />
            <p className="font-medium">No payment records found</p>
            <p className="text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]">
                  {['Receipt / Invoice','Transaction reference','Parent','Child','Type','Transaction amount','Invoice / balance','Status','Method','Date',''].map(h => (
                    <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p._id} className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                      <p>{p.receiptNumber || '—'}</p>
                      <p className="text-[10px] text-slate-400">{p.invoiceNumber || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-400 max-w-[130px] truncate" title={p.chapaTxRef}>{p.chapaTxRef || '—'}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800 dark:text-white whitespace-nowrap">{p.parent?.fullName || '—'}</p>
                      <p className="text-xs text-slate-400">{p.parent?.email}</p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {p.child ? `${p.child.firstName} ${p.child.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-slate-100 dark:bg-[#0d1520] text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg capitalize">
                        {p.type?.replace(/-/g,' ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                      {fmtCurrency(p.amount)}
                      <span className="block text-[10px] font-normal text-slate-400">{p.currency || 'ETB'}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {(() => {
                        const invoice = p.invoiceDetails || {};
                        const invoiceAmount = Number(invoice.amount) || 0;
                        const amountPaid = invoice.status === 'paid'
                          ? invoiceAmount
                          : Math.min(invoiceAmount, Number(invoice.amountPaid) || 0);
                        const balance = Math.max(0, invoiceAmount - amountPaid);
                        return (
                          <>
                            <p className="font-semibold text-slate-800 dark:text-white">{fmtCurrency(invoiceAmount)}</p>
                            <p className="text-[10px] text-slate-400">Paid {fmtCurrency(amountPaid)} · Due {fmtCurrency(balance)}</p>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_BADGE[p.status] || STATUS_BADGE.cancelled}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 capitalize">{p.paymentMethod || p.method || 'Chapa'}</td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(p.verifiedAt || p.paidDate || p.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <button type="button" onClick={() => setSelectedPayment(p)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-teal-900/30 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0d1520]">
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-teal-900/20">
            <span className="text-xs text-slate-500">Page {page} of {totalPages} · {total} total records</span>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchHistory(page - 1)} disabled={page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d1520] disabled:opacity-40 transition">
                <i className="bx bx-chevron-left" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={pg} onClick={() => fetchHistory(pg)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition ${
                      pg === page ? 'bg-[#00A884] text-white' : 'border border-slate-200 dark:border-teal-900/30 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d1520]'
                    }`}>{pg}
                  </button>
                );
              })}
              <button onClick={() => fetchHistory(page + 1)} disabled={page >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d1520] disabled:opacity-40 transition">
                <i className="bx bx-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentHistory;
