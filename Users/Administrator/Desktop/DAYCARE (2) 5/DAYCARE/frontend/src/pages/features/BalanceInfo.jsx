import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ── Payment Modal ─────────────────────────────────────────────────────────────
const METHODS = [
  { key: 'card',          label: 'Credit / Debit Card', icon: 'bx-credit-card' },
  { key: 'bank-transfer', label: 'Bank Transfer',        icon: 'bx-transfer'    },
  { key: 'cash',          label: 'Cash',                 icon: 'bx-money'       },
  { key: 'check',         label: 'Check',                icon: 'bx-check-square'},
];

const BANK_OPTIONS = [
  { id: 'telebirr',    label: 'TeleBirr (Ethio Telecom)' },
  { id: 'cbe',         label: 'CBE Birr (Commercial Bank of Ethiopia)' },
  { id: 'amole',       label: 'Amole (Awash Bank)' },
  { id: 'abyssinia',   label: 'Bank of Abyssinia' },
  { id: 'awash',       label: 'Awash Bank' },
  { id: 'dashen',      label: 'Dashen Bank' },
  { id: 'united',      label: 'United Bank' },
  { id: 'berhan',      label: 'Berhan Bank' },
  { id: 'hibret',      label: 'Hibret Bank' },
  { id: 'wegagen',     label: 'Wegagen Bank' },
  { id: 'zemen',       label: 'Zemen Bank' },
  { id: 'nib',         label: 'Nib International Bank' },
  { id: 'cooperative', label: 'Cooperative Bank of Oromia' },
  { id: 'enat',        label: 'Enat Bank' },
  { id: 'oromia',      label: 'Oromia Bank' },
  { id: 'abay',        label: 'Abay Bank' },
  { id: 'adwa',        label: 'Addis International Bank' },
  { id: 'other',       label: 'Other' },
];

const INPUT = 'w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

const PaymentModal = ({ invoice, onClose, onSuccess }) => {
  const [method,    setMethod]    = useState('card');
  const [cardNum,   setCardNum]   = useState('');
  const [cardName,  setCardName]  = useState('');
  const [expiry,    setExpiry]    = useState('');
  const [cvv,       setCvv]       = useState('');
  const [bankName,  setBankName]  = useState('');
  const [bankRef,   setBankRef]   = useState('');
  const [notes,     setNotes]     = useState('');
  const [step,      setStep]      = useState('form'); // 'form' | 'confirm' | 'success'
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const cardBrand = () => {
    const n = cardNum.replace(/\s/g, '');
    if (n.startsWith('4'))           return 'Visa';
    if (/^5[1-5]/.test(n))          return 'Mastercard';
    if (/^3[47]/.test(n))           return 'Amex';
    if (n.startsWith('6'))           return 'Discover';
    return 'Card';
  };

  const formatCardNum = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const isFormValid = () => {
    if (method === 'card') {
      const digits = cardNum.replace(/\s/g, '');
      return digits.length === 16 && cardName.trim() && expiry.length === 5 && cvv.length >= 3;
    }
    if (method === 'bank-transfer') return bankName.trim().length > 0;
    return true; // cash / check — no extra fields required
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = { method, notes };
      if (method === 'card') {
        payload.cardLast4  = cardNum.replace(/\s/g, '').slice(-4);
        payload.cardBrand  = cardBrand();
      }
      if (method === 'bank-transfer') {
        payload.bankName = bankName;
        payload.notes    = bankRef ? `Ref: ${bankRef}${notes ? ' · ' + notes : ''}` : notes;
      }
      await api.put(`/payments/${invoice._id}/parent-pay`, payload);
      setStep('success');
      setTimeout(() => { onSuccess(); onClose(); }, 2200);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl border border-slate-200 dark:border-teal-900/30">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
          <i className="bx bx-check-circle text-5xl text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Payment Successful!</h3>
        <p className="text-sm text-slate-500 mt-2">
          ${invoice.amount?.toLocaleString()} paid for {invoice.child?.firstName}'s {invoice.type?.replace(/-/g, ' ')}
        </p>
        <p className="text-xs text-slate-400 mt-4">Redirecting…</p>
      </div>
    </div>
  );

  // ── Confirm screen ──────────────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-teal-900/30">
        <div className="p-6 border-b border-slate-100 dark:border-teal-900/30">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Confirm Payment</h3>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-3 text-sm">{error}</div>
          )}
          <div className="bg-slate-50 dark:bg-[#0d1520] rounded-2xl p-5 space-y-3">
            {[
              { label: 'Invoice',  value: invoice.invoiceNumber },
              { label: 'Child',    value: `${invoice.child?.firstName} ${invoice.child?.lastName}` },
              { label: 'Type',     value: invoice.type?.replace(/-/g, ' ') },
              { label: 'Amount',   value: `ETB ${invoice.amount?.toLocaleString()}`, bold: true },
              { label: 'Method',   value: METHODS.find(m => m.key === method)?.label },
              ...(method === 'card'
                ? [{ label: 'Card', value: `${cardBrand()} ···· ${cardNum.replace(/\s/g,'').slice(-4)}` }]
                : []),
              ...(method === 'bank-transfer' && bankName
                ? [{ label: 'Bank', value: bankName }]
                : []),
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-slate-400">{r.label}</span>
                <span className={`${r.bold ? 'font-bold text-indigo-400 text-base' : 'font-semibold text-slate-700 dark:text-slate-200'} capitalize`}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={() => setStep('form')} disabled={loading}
            className="flex-1 py-3 font-semibold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">
            Back
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-3 font-semibold text-sm text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
              : <><i className="bx bx-lock-alt" /> Pay ETB {invoice.amount?.toLocaleString()}</>
            }
          </button>
        </div>
      </div>
    </div>
  );

  // ── Form screen ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-teal-900/30 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-teal-900/30 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Pay Invoice</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {invoice.invoiceNumber} · {invoice.child?.firstName} {invoice.child?.lastName}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#162030] transition-colors">
            <i className="bx bx-x text-xl" />
          </button>
        </div>

        {/* Amount banner */}
        <div className="mx-6 mt-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Amount Due</p>
            <p className="text-3xl font-bold text-indigo-400 mt-0.5">ETB {invoice.amount?.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Due date</p>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
              {new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Method selector */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => (
                <button key={m.key} type="button" onClick={() => setMethod(m.key)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    method === m.key
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-slate-200 dark:border-teal-900/40 text-slate-500 hover:border-indigo-400/50'
                  }`}>
                  <i className={`bx ${m.icon} text-xl flex-shrink-0`} />
                  <span className="text-sm font-semibold leading-tight">{m.label}</span>
                  {method === m.key && (
                    <i className="bx bx-check-circle text-indigo-500 ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Card fields */}
          {method === 'card' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Card Details</p>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Card Number *</label>
                <div className="relative">
                  <input type="text" placeholder="1234 5678 9012 3456" maxLength={19}
                    value={cardNum} onChange={e => setCardNum(formatCardNum(e.target.value))}
                    className={INPUT} />
                  {cardNum && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {cardBrand()}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Cardholder Name *</label>
                <input type="text" placeholder="Name on card"
                  value={cardName} onChange={e => setCardName(e.target.value)}
                  className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Expiry *</label>
                  <input type="text" placeholder="MM/YY" maxLength={5}
                    value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))}
                    className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">CVV *</label>
                  <input type="password" placeholder="···" maxLength={4}
                    value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className={INPUT} />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <i className="bx bx-lock-alt text-slate-400" />
                Your card details are encrypted and never stored.
              </p>
            </div>
          )}

          {/* Bank transfer fields */}
          {method === 'bank-transfer' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Details</p>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Bank / Wallet *</label>
                <select value={bankName} onChange={e => setBankName(e.target.value)} className={INPUT}>
                  <option value="">Select a bank or mobile money…</option>
                  {BANK_OPTIONS.map(b => (
                    <option key={b.id} value={b.label}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Transfer Reference (optional)</label>
                <input type="text" placeholder="e.g. TXN-20260716"
                  value={bankRef} onChange={e => setBankRef(e.target.value)}
                  className={INPUT} />
              </div>
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-cyan-400 flex items-center gap-1.5"><i className="bx bx-info-circle" /> Transfer Instructions</p>
                <p>Send payment via <strong className="text-slate-700 dark:text-slate-200">{bankName || 'your selected bank / wallet'}</strong> to the daycare account.</p>
                <p>Reference: <strong className="text-indigo-400">{invoice.invoiceNumber}</strong></p>
                <p className="text-[11px] text-slate-400">Payment is confirmed once staff verify the transfer reference.</p>
              </div>
            </div>
          )}

          {/* Cash / Check info */}
          {(method === 'cash' || method === 'check') && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                <i className={`bx ${method === 'cash' ? 'bx-money' : 'bx-check-square'}`} />
                {method === 'cash' ? 'Cash Payment' : 'Check Payment'}
              </p>
              <p className="text-xs">
                {method === 'cash'
                  ? 'Please bring exact change to the front desk. A receipt will be issued upon payment.'
                  : 'Make checks payable to DaycareHQ. Bring to the front desk or mail to our address.'}
              </p>
              <p className="text-xs text-slate-400">
                Clicking "Confirm" records your intent to pay. Staff will verify and finalise your payment.
              </p>
            </div>
          )}

          {/* Optional notes */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
            <input type="text" placeholder="Any additional notes…"
              value={notes} onChange={e => setNotes(e.target.value)}
              className={INPUT} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5 border-t border-slate-100 dark:border-teal-900/30 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 font-semibold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={() => setStep('confirm')} disabled={!isFormValid()}
            className="flex-1 py-3 font-semibold text-sm text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            <i className="bx bx-right-arrow-alt" /> Review & Pay
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main BalanceInfo page ─────────────────────────────────────────────────────
const BalanceInfo = () => {
  const [payments,  setPayments]  = useState([]);
  const [stats,     setStats]     = useState({ totalPaid: 0, totalPending: 0, totalOverdue: 0 });
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [payTarget, setPayTarget] = useState(null); // invoice being paid

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Auto-check overdue silently
      api.put('/payments/check-overdue').catch(() => {});
      const res = await api.get('/payments');
      setPayments(res.data.data  || []);
      setStats(res.data.stats    || { totalPaid: 0, totalPending: 0, totalOverdue: 0 });
    } catch {
      setError('Could not load balance information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl p-6 text-center">
      <i className="bx bx-error text-3xl" /><p className="mt-2">{error}</p>
    </div>
  );

  const pending  = payments.filter(p => p.status === 'pending');
  const overdue  = payments.filter(p => p.status === 'overdue');
  const paid     = payments.filter(p => p.status === 'paid');
  const totalDue = stats.totalPending + stats.totalOverdue;

  return (
    <div className="space-y-6">
      {payTarget && (
        <PaymentModal
          invoice={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={load}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Balance & Account Info</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Your payment overview</p>
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
          <i className="bx bx-error-circle text-rose-400 text-2xl flex-shrink-0" />
          <div>
            <p className="font-bold text-rose-400 text-sm">
              {overdue.length} overdue invoice{overdue.length > 1 ? 's' : ''} — ETB {stats.totalOverdue.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Please pay as soon as possible to avoid further charges.</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Amount Due',  amount: totalDue,          icon: 'bx-time-five',    color: totalDue > 0 ? 'amber' : 'slate', sub: `${pending.length + overdue.length} outstanding` },
          { label: 'Total Paid',  amount: stats.totalPaid,   icon: 'bx-check-circle', color: 'emerald',                        sub: `${paid.length} payment${paid.length !== 1 ? 's' : ''} received` },
          { label: 'Overdue',     amount: stats.totalOverdue,icon: 'bx-error-circle', color: stats.totalOverdue > 0 ? 'rose' : 'slate', sub: `${overdue.length} past due` },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-500/10 border border-${s.color}-500/20 rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <i className={`bx ${s.icon} text-2xl text-${s.color}-400`} />
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-${s.color}-500/10 text-${s.color}-400`}>{s.label}</span>
            </div>
            <p className={`text-3xl font-bold text-${s.color}-400`}>ETB {s.amount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Outstanding invoices — each has a Pay Now button */}
      {(pending.length > 0 || overdue.length > 0) && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-teal-900/30 flex items-center gap-2">
            <i className="bx bx-receipt text-amber-400" />
            <h3 className="font-bold text-slate-800 dark:text-white">
              Outstanding Invoices ({pending.length + overdue.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {[...overdue, ...pending].map(p => (
              <div key={p._id} className="flex items-center gap-4 px-5 py-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  p.status === 'overdue' ? 'bg-rose-500/10' : 'bg-amber-500/10'
                }`}>
                  <i className={`bx bx-receipt text-xl ${p.status === 'overdue' ? 'text-rose-400' : 'text-amber-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {p.child?.firstName} {p.child?.lastName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.invoiceNumber} · {p.type?.replace(/-/g, ' ')} · Due {new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-slate-800 dark:text-white">ETB {p.amount?.toLocaleString()}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      p.status === 'overdue' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{p.status}</span>
                  </div>
                  <button
                    onClick={() => setPayTarget(p)}
                    className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95"
                  >
                    <i className="bx bx-credit-card text-sm" /> Pay Now
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-slate-50 dark:bg-[#0d1520]/50 border-t border-slate-100 dark:border-teal-900/30 flex justify-between items-center">
            <span className="text-sm text-slate-500">Total outstanding</span>
            <span className="text-lg font-bold text-amber-400">ETB {totalDue.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* All clear */}
      {totalDue === 0 && (
        <div className="text-center py-12 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
          <i className="bx bx-check-shield text-5xl text-emerald-400 opacity-70" />
          <p className="font-bold text-emerald-400 mt-3">Your account is fully paid up!</p>
          <p className="text-xs text-slate-400 mt-1">No outstanding balance.</p>
        </div>
      )}

      {/* Recent payments */}
      {paid.length > 0 && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-teal-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="bx bx-check-circle text-emerald-400" />
              <h3 className="font-bold text-slate-800 dark:text-white">Recent Payments</h3>
            </div>
            <span className="text-xs text-slate-400">{paid.length} total</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {paid.slice(0, 6).map(p => (
              <div key={p._id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <i className={`bx ${
                    p.method === 'card' ? 'bx-credit-card' :
                    p.method === 'bank-transfer' ? 'bx-transfer' :
                    p.method === 'check' ? 'bx-check-square' : 'bx-money'
                  } text-emerald-400`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {p.child?.firstName} {p.child?.lastName} — {p.type?.replace(/-/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.paidDate
                      ? `Paid ${new Date(p.paidDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : p.invoiceNumber}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </p>
                </div>
                <p className="font-bold text-emerald-400 flex-shrink-0">ETB {p.amount?.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BalanceInfo;

