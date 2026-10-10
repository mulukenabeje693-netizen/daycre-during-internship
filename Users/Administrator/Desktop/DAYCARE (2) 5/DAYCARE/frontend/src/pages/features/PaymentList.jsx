import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { useSettings } from '../../context/SettingsContext';
import MakePayment from './MakePayment';
import AdminPaymentHistory from './AdminPaymentHistory';
import Pagination from '../../components/shared/Pagination';

const INPUT = 'w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500';

const getApiErrorMessage = (error) => {
  if (!error) return 'An unexpected error occurred.';
  const message = error.response?.data?.message ?? error.message ?? error.toString?.();
  if (typeof message === 'string') return message;
  if (typeof message === 'object') return JSON.stringify(message);
  return String(message);
};

const formatErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') return JSON.stringify(error);
  return String(error);
};

// ── Status badge helper ───────────────────────────────────────────────────────
const statusBadge = (s) => ({
  paid:      'bg-emerald-500/10 text-emerald-400',
  pending:   'bg-amber-500/10 text-amber-400',
  overdue:   'bg-rose-500/10 text-rose-400',
  cancelled: 'bg-slate-500/10 text-slate-400',
}[s] || 'bg-slate-500/10 text-slate-400');

// ── Real Chapa Modal — redirects to Chapa checkout ────────────────────────────
const ChapaModal = ({ payment, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const errorText = formatErrorMessage(error);

  const handlePay = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post(`/payments/${payment._id}/chapa-init`);
      if (res.data?.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setError('Failed to initialize Chapa payment. Try again.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Payment initialization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#0f1a2e', border: '1px solid rgba(13,148,136,0.25)' }}>
        <div className="relative px-6 pt-6 pb-5" style={{ background: 'linear-gradient(135deg,#0d9488 0%,#0891b2 60%,#6366f1 100%)' }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-xl"><i className="bx bx-x" /></button>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Pay Invoice</p>
          <p className="text-white text-3xl font-extrabold mt-1">{payment.amount?.toLocaleString()} ETB</p>
          <p className="text-white/70 text-sm mt-1">{payment.child?.firstName} {payment.child?.lastName} · {payment.invoiceNumber}</p>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div className="flex items-start gap-3 bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
            <i className="bx bx-shield-alt-2 text-teal-400 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-bold">Secure Chapa Checkout</p>
              <p className="text-slate-400 text-xs mt-1">You'll be redirected to Chapa's secure page. Supports TeleBirr, CBE Birr, Amole, cards and more.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[{icon:'📱',label:'TeleBirr'},{icon:'🏦',label:'CBE Birr'},{icon:'💳',label:'Card'},{icon:'🏛️',label:'Amole'}].map(p=>(
              <div key={p.label} className="flex items-center gap-1.5 bg-[#1a2840] rounded-xl px-3 py-2 text-xs text-white font-semibold">
                <span>{p.icon}</span>{p.label}
              </div>
            ))}
          </div>
          {errorText && <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl">{errorText}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl font-semibold text-slate-300 bg-[#1a2840] border border-slate-700/50 hover:border-slate-500 transition text-sm">Cancel</button>
            <button onClick={handlePay} disabled={loading}
              className="flex-1 py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:opacity-60 transition-all text-sm"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0891b2)' }}>
              {loading ? <><i className="bx bx-loader-alt animate-spin"/>Initializing…</> : <><i className="bx bx-credit-card text-base"/>Pay with Chapa</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── PaymentModal (card / bank / cash / check) ─────────────────────────────────
const METHODS = [
  { key: 'card',          label: 'Credit / Debit Card', icon: 'bx-credit-card'  },
  { key: 'bank-transfer', label: 'Bank Transfer',        icon: 'bx-transfer'     },
  { key: 'cash',          label: 'Cash',                 icon: 'bx-money'        },
  { key: 'check',         label: 'Check',                icon: 'bx-check-square' },
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

const PaymentModal = ({ invoice, onClose, onSuccess }) => {
  const [method,   setMethod]   = useState('card');
  const [cardNum,  setCardNum]  = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry,   setExpiry]   = useState('');
  const [cvv,      setCvv]      = useState('');
  const [bankName, setBankName] = useState('');
  const [bankRef,  setBankRef]  = useState('');
  const [notes,    setNotes]    = useState('');
  const [step,     setStep]     = useState('form');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const cardBrand = () => {
    const n = cardNum.replace(/\s/g,'');
    if (n.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n))  return 'Amex';
    if (n.startsWith('6')) return 'Discover';
    return 'Card';
  };
  const fmtCard   = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const fmtExpiry = v => { const d = v.replace(/\D/g,'').slice(0,4); return d.length>=3 ? d.slice(0,2)+'/'+d.slice(2) : d; };

  const isValid = () => {
    if (method === 'card') { const d = cardNum.replace(/\s/g,''); return d.length===16 && cardName.trim() && expiry.length===5 && cvv.length>=3; }
    if (method === 'bank-transfer') return bankName.trim().length > 0;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const payload = { method, notes };
      if (method === 'card')          { payload.cardLast4 = cardNum.replace(/\s/g,'').slice(-4); payload.cardBrand = cardBrand(); }
      if (method === 'bank-transfer') { payload.bankName = bankName; payload.notes = bankRef ? `Ref: ${bankRef}${notes?' · '+notes:''}` : notes; }
      await api.put(`/payments/${invoice._id}/parent-pay`, payload);
      setStep('success');
      setTimeout(() => { onSuccess(); onClose(); }, 2200);
    } catch (err) { setError(getApiErrorMessage(err) || 'Payment failed.'); setStep('form'); }
    finally { setLoading(false); }
  };

  if (step === 'success') return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
          <i className="bx bx-check-circle text-5xl text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Payment Successful!</h3>
        <p className="text-sm text-slate-500 mt-2">ETB {invoice.amount?.toLocaleString()} paid for {invoice.child?.firstName}'s {invoice.type?.replace(/-/g,' ')}</p>
      </div>
    </div>
  );

  if (step === 'confirm') return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-3xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-slate-100 dark:border-teal-900/30"><h3 className="text-lg font-bold text-slate-800 dark:text-white">Confirm Payment</h3></div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-3 text-sm">{error}</div>}
          <div className="bg-slate-50 dark:bg-[#0d1520] rounded-2xl p-5 space-y-3">
            {[
              { label:'Invoice', value: invoice.invoiceNumber },
              { label:'Child',   value: `${invoice.child?.firstName} ${invoice.child?.lastName}` },
              { label:'Amount',  value: `ETB ${invoice.amount?.toLocaleString()}`, bold: true },
              { label:'Method',  value: METHODS.find(m=>m.key===method)?.label },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-slate-400">{r.label}</span>
                <span className={r.bold ? 'font-bold text-indigo-400 text-base' : 'font-semibold text-slate-700 dark:text-slate-200'}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={() => setStep('form')} className="flex-1 py-3 font-semibold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl">Back</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 font-semibold text-sm text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Processing…</> : <><i className="bx bx-lock-alt"/>Pay ETB {invoice.amount?.toLocaleString()}</>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-teal-900/30 flex-shrink-0">
          <div><h3 className="text-lg font-bold text-slate-800 dark:text-white">Pay Invoice</h3>
            <p className="text-xs text-slate-400 mt-0.5">{invoice.invoiceNumber} · {invoice.child?.firstName} {invoice.child?.lastName}</p></div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-[#162030]"><i className="bx bx-x text-xl"/></button>
        </div>
        <div className="mx-6 mt-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div><p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Amount Due</p>
            <p className="text-3xl font-bold text-indigo-400 mt-0.5">ETB {invoice.amount?.toLocaleString()}</p></div>
          <div className="text-right"><p className="text-xs text-slate-400">Due date</p>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{new Date(invoice.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p></div>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(m => (
              <button key={m.key} type="button" onClick={() => setMethod(m.key)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${method===m.key ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-200 dark:border-teal-900/40 text-slate-500 hover:border-indigo-400/50'}`}>
                <i className={`bx ${m.icon} text-xl flex-shrink-0`}/><span className="text-sm font-semibold leading-tight">{m.label}</span>
                {method===m.key && <i className="bx bx-check-circle text-indigo-500 ml-auto flex-shrink-0"/>}
              </button>
            ))}
          </div>
          {method==='card' && (
            <div className="space-y-3">
              <div className="relative"><input type="text" placeholder="1234 5678 9012 3456" maxLength={19} value={cardNum} onChange={e=>setCardNum(fmtCard(e.target.value))} className={INPUT}/>
                {cardNum && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{cardBrand()}</span>}</div>
              <input type="text" placeholder="Cardholder Name" value={cardName} onChange={e=>setCardName(e.target.value)} className={INPUT}/>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="MM/YY" maxLength={5} value={expiry} onChange={e=>setExpiry(fmtExpiry(e.target.value))} className={INPUT}/>
                <input type="password" placeholder="CVV" maxLength={4} value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} className={INPUT}/>
              </div>
            </div>
          )}
          {method==='bank-transfer' && (
            <div className="space-y-3">
              <select value={bankName} onChange={e=>setBankName(e.target.value)} className={INPUT}>
                <option value="">Select a bank or mobile money…</option>
                {BANK_OPTIONS.map(b=><option key={b.id} value={b.label}>{b.label}</option>)}
              </select>
              <input type="text" placeholder="Transfer Reference (optional)" value={bankRef} onChange={e=>setBankRef(e.target.value)} className={INPUT}/>
            </div>
          )}
          {(method==='cash'||method==='check') && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-amber-400">{method==='cash'?'Cash Payment':'Check Payment'}</p>
              <p className="text-xs">{method==='cash'?'Bring exact change to the front desk.':'Make checks payable to Daycare. Bring to the front desk.'}</p>
            </div>
          )}
          <input type="text" placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} className={INPUT}/>
        </div>
        <div className="flex gap-3 px-6 py-5 border-t border-slate-100 dark:border-teal-900/30 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 font-semibold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl">Cancel</button>
          <button onClick={()=>setStep('confirm')} disabled={!isValid()} className="flex-1 py-3 font-semibold text-sm text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 disabled:opacity-40 flex items-center justify-center gap-2">
            <i className="bx bx-right-arrow-alt"/>Review &amp; Pay
          </button>
        </div>
      </div>
    </div>
  );
};

// ── TAB 1: Invoices ───────────────────────────────────────────────────────────
const InvoicesTab = ({ canManage }) => {
  const { t } = useLanguage();
  const { isFreeMode } = useSettings();
  const navigate = useNavigate();
  const [payments,     setPayments]     = useState([]);
  const [stats,        setStats]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage,  setCurrentPage]  = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const errorText = formatErrorMessage(error);
  const [chapaPayment, setChapaPayment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [children, setChildren] = useState([]);
  const [newInvoice, setNewInvoice] = useState({ childId: '', amount: '', type: 'monthly-fee', dueDate: '' });
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState('telebirr');
  const [mobile,   setMobile]   = useState('');
  const [email,    setEmail]    = useState('');
  const [demoMode, setDemoMode] = useState(true);

  const providers = [
    { id: 'telebirr', label: 'TeleBirr',       sub: 'Ethio Telecom',       icon: '📱', free: true },
    { id: 'cbe',      label: 'CBE / CSE Birr', sub: 'Commercial Bank',      icon: '🏦' },
    { id: 'other',    label: 'Other Bank',      sub: '',                     icon: '🏛️' },
    { id: 'chapa',    label: 'Chapa Pay',       sub: 'Local Cards/Wallets',  icon: '💳' },
  ];

  useEffect(() => {
    if (createModal && children.length === 0) {
      api.get('/children').then(r => setChildren(r.data.data || [])).catch(() => {});
    }
  }, [createModal, children.length]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newInvoice.childId || !newInvoice.amount) return setError('Please fill all required fields');
    const selectedChild = children.find(c => c._id === newInvoice.childId);
    const parentId = selectedChild?.parents?.[0]?._id;
    if (!parentId) return setError('Selected child has no parent assigned');

    try {
      setCreating(true);
      const res = await api.post('/payments', {
        child: newInvoice.childId,
        parent: parentId,
        amount: Number(newInvoice.amount),
        type: newInvoice.type,
        dueDate: newInvoice.dueDate || new Date().toISOString().split('T')[0]
      });
      const paymentId = res.data.data._id;
      
      // Automatically pay the invoice right after creating it
      await api.put(`/payments/${paymentId}/pay`, { method: 'bank-transfer' });
      
      setSuccess(`✅ Payment processed via ${provider.toUpperCase()}` + (demoMode ? ' (Demo Mode)' : ''));
      setCreateModal(false);
      setNewInvoice({ childId: '', amount: '', type: 'monthly-fee', dueDate: '' });
      setMobile(''); setEmail('');
      fetch(true);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Failed to process payment.');
    } finally {
      setCreating(false);
    }
  };

  const fetch = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const q = filterStatus !== 'all' ? `?status=${filterStatus}` : '';
      const r = await api.get(`/payments${q}`);
      setPayments(r.data.data || []); setStats(r.data.stats || {});
    } catch { if (!silent) setError('Failed to load payments.'); }
    finally  { if (!silent) setLoading(false); }
  }, [filterStatus]);

  // Initial load + real-time polling every 15 seconds
  useEffect(() => {
    fetch();
    api.put('/payments/check-overdue').catch(() => {});
    const interval = setInterval(() => fetch(true), 15000);
    return () => clearInterval(interval);
  }, [fetch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const totalPages = Math.ceil(payments.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPayments = payments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleMarkPaid = async (id) => {
    try { await api.put(`/payments/${id}/pay`, { method: 'cash' }); setSuccess('Payment recorded!'); fetch(true); setTimeout(() => setSuccess(''), 2000); }
    catch { setError('Failed to record payment.'); }
  };
  const handleVerifyChapa = async (txRef) => {
    try {
      setLoading(true);
      await api.get(`/payments/verify/${txRef}`);
      setSuccess('Chapa payment verified successfully!');
      fetch(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Failed to verify payment.');
      setLoading(false);
    }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await api.delete(`/payments/${deleteTarget}`); setPayments(p => p.filter(x => x._id !== deleteTarget)); setSuccess('Invoice deleted.'); setTimeout(() => setSuccess(''), 2000); }
    catch { setError('Delete failed.'); }
    finally { setDeleteTarget(null); setDeleteForEveryone(false); }
  };

  return (
    <div className="space-y-5">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e2535] shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Do you want to delete this?</h3>
              <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${deleteForEveryone ? 'bg-blue-500 border-blue-500' : 'border-slate-400 dark:border-slate-500'}`}
                  onClick={() => setDeleteForEveryone(p => !p)}
                >
                  {deleteForEveryone && <i className="bx bx-check text-white text-sm" />}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">Delete for everyone</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-1 px-4 pb-4">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteForEveryone(false); }}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {chapaPayment && <ChapaModal payment={chapaPayment} onClose={() => { setChapaPayment(null); fetch(true); }} />}

      {createModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 px-4 py-4">
          <div className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" style={{background:"#0f1a2e", border:"1px solid rgba(13,148,136,0.25)"}}>
            <div className="relative px-8 pt-7 pb-5 flex-shrink-0" style={{background:"linear-gradient(135deg,#0d9488 0%,#0891b2 60%,#6366f1 100%)"}}>
              <button onClick={() => setCreateModal(false)} className="absolute top-5 right-5 text-white/70 hover:text-white text-2xl">
                <i className="bx bx-x" />
              </button>
              <p className="text-white/70 text-sm font-semibold uppercase tracking-widest">New Payment</p>
              <p className="text-white text-3xl font-extrabold mt-1">Make Payment</p>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="px-8 py-6 space-y-5 overflow-y-auto flex-1 min-h-0">
              
              {/* Row 1: Demo mode and Child */}
              <div className="grid grid-cols-2 gap-5">
                <div className="flex items-center justify-between bg-[#1a2840] rounded-xl px-4 py-3 h-[52px] mt-4">
                  <div>
                    <p className="text-white text-sm font-bold">Chapa API Mode</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Marks paid instantly in demo</p>
                  </div>
                  <button type="button" onClick={() => setDemoMode(p => !p)} className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${demoMode ? 'bg-teal-500' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${demoMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                
                <div>
                  <label className="block text-slate-400 text-xs uppercase tracking-widest mb-1.5 font-semibold">Child *</label>
                  <select required value={newInvoice.childId} onChange={e => setNewInvoice({ ...newInvoice, childId: e.target.value })}
                    className="w-full h-[52px] bg-[#1a2840] border border-slate-700/50 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-teal-500">
                    <option value="" className="text-slate-500">Select Child...</option>
                    {children.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
                  </select>
                </div>
              </div>
              
              {/* Row 2: Amount and Type */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-slate-400 text-xs uppercase tracking-widest mb-1.5 font-semibold">Amount ($) *</label>
                  <input type="number" required min="0" value={newInvoice.amount} onChange={e => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    className="w-full h-[52px] bg-[#1a2840] border border-slate-700/50 rounded-xl px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs uppercase tracking-widest mb-1.5 font-semibold">Type *</label>
                  <select required value={newInvoice.type} onChange={e => setNewInvoice({ ...newInvoice, type: e.target.value })}
                    className="w-full h-[52px] bg-[#1a2840] border border-slate-700/50 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-teal-500">
                    <option value="monthly-fee">Monthly Fee</option>
                    <option value="registration">Registration</option>
                    <option value="activity">Activity</option>
                    <option value="meal">Meal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Provider & Info */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-2 font-semibold">Choose Provider</p>
                  <div className="grid grid-cols-2 gap-2">
                    {providers.map(p => (
                      <button type="button" key={p.id} onClick={() => setProvider(p.id)}
                        className={`rounded-xl p-2.5 flex flex-col items-center gap-1 border transition-all ${provider === p.id ? 'border-teal-500 bg-teal-500/10' : 'border-slate-700/50 bg-[#1a2840] hover:border-teal-700'}`}>
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-white text-[11px] font-bold text-center leading-tight">{p.label}</span>
                        {p.free && <span className="text-[9px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">FREE</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-end space-y-3">
                  <div>
                    <label className="block text-slate-400 text-xs uppercase tracking-widest mb-1.5 font-semibold">Contact Info</label>
                    <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile / Account Email"
                      className="w-full h-[52px] bg-[#1a2840] border border-slate-700/50 rounded-xl px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500" />
                  </div>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Confirmation Email (optional)"
                    className="w-full h-[52px] bg-[#1a2840] border border-slate-700/50 rounded-xl px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500" />
                </div>
              </div>
              
              <div className="pt-2">
                <button type="submit" disabled={creating} 
                  className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:opacity-60 transition-all shadow-lg"
                  style={{background:"linear-gradient(135deg,#0d9488,#0891b2)"}}>
                  <i className="bx bx-check-circle text-xl" />
                  {creating ? 'Processing...' : 'Pay Now via CHAPA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('invoicesTitle', 'Invoices')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {payments.length} {t('totalRecords', 'total records')}
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> Live
            </span>
          </p>
        </div>
        {!canManage && !isFreeMode && (
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/30"
          >
            <i className="bx bx-credit-card" />
            Make Payment
          </button>
        )}
      </div>

      {errorText && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-3 text-sm">{errorText}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 text-sm">{success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('collected', 'Collected'), amount: stats.totalPaid    || 0, color: 'emerald' },
          { label: t('pending', 'Pending'),   amount: stats.totalPending || 0, color: 'amber'   },
          { label: t('overdueFree', 'Free'),  amount: stats.totalOverdue || 0, color: 'rose'    },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-500/10 border border-${s.color}-500/20 rounded-2xl p-4`}>
            <p className={`text-xl font-bold text-${s.color}-400`}>ETB {s.amount.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {['all','pending','paid','overdue','cancelled'].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)}
            className={`text-xs font-semibold uppercase px-4 py-2 rounded-full transition-colors ${filterStatus===s?'bg-teal-600 text-white':'bg-slate-100 dark:bg-[#0d1520] text-slate-500 hover:bg-slate-200 dark:hover:bg-[#162030]'}`}>
            {s==='all'?'All':s==='overdue'?'Free':s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"/></div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-slate-400"><i className="bx bx-receipt text-4xl"/><p className="mt-2">{t('noPaymentsFound', 'No payments found.')}</p></div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-teal-900/30 bg-white dark:bg-[#111c2d] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-teal-900/30">
                  {[t('invoiceCol','Invoice'),t('childCol','Child'),t('parentCol','Parent'),t('typeCol','Type'),t('amountCol','Amount'),t('dueDateCol','Due Date'),t('statusCol','Status'),t('actionsCol','Actions')].map(h=>(
                    <th key={h} className="text-left px-3 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map(p=>(
                  <tr key={p._id} className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{p.invoiceNumber}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800 dark:text-white whitespace-nowrap">{p.child?.firstName} {p.child?.lastName}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.parent?.fullName}</td>
                    <td className="px-5 py-4"><span className="text-xs bg-slate-100 dark:bg-[#0d1520] text-slate-500 px-2 py-1 rounded-lg capitalize">{p.type?.replace('-',' ')}</span></td>
                    <td className="px-5 py-4 font-bold text-slate-800 dark:text-white">ETB {p.amount?.toLocaleString()}</td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{new Date(p.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusBadge(p.status)}`}>{p.status === 'overdue' ? 'Free' : p.status}</span>
                      {p.status === 'paid' && (
                        <div className="mt-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.method === 'chapa' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                            {p.method === 'chapa' ? 'Chapa Online' : 'Cash/Manual'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {!canManage && !isFreeMode && p.status !== 'paid' && p.status !== 'cancelled' && (
                          <button
                            onClick={() => navigate(`/dashboard/parent/make-payment`)}
                            className="text-xs font-bold text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:opacity-90"
                            style={{background:'linear-gradient(135deg,#00A884,#00C49A)'}}>
                            <i className="bx bx-credit-card text-sm"/>Pay
                          </button>
                        )}
                        {canManage&&p.status!=='paid'&&p.status!=='cancelled'&&(
                          p.chapaTxRef ? (
                            <button onClick={()=>handleVerifyChapa(p.chapaTxRef)} className="text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full hover:bg-indigo-500/20 font-semibold flex items-center gap-1">
                              <i className="bx bx-refresh"/>Verify Chapa
                            </button>
                          ) : (
                            <button onClick={()=>handleMarkPaid(p._id)} className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full hover:bg-emerald-500/20 font-semibold">{t('markPaid', 'Mark Paid')}</button>
                          )
                        )}
                        {canManage&&(
                          <button onClick={()=>setDeleteTarget(p._id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <i className="bx bx-trash text-base"/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-teal-900/30 bg-white dark:bg-[#0d1520]">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={payments.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel={t('invoices', 'invoices')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── TAB 2: Balance ────────────────────────────────────────────────────────────
const BalanceTab = () => {
  const { t } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [stats,    setStats]    = useState({ totalPaid:0, totalPending:0, totalOverdue:0 });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [payTarget,setPayTarget]= useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { api.put('/payments/check-overdue').catch(()=>{}); const r = await api.get('/payments'); setPayments(r.data.data||[]); setStats(r.data.stats||{totalPaid:0,totalPending:0,totalOverdue:0}); }
    catch { if (!silent) setError('Could not load balance information.'); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>;
  if (error)   return <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl p-6 text-center">{error}</div>;

  const pending  = payments.filter(p=>p.status==='pending');
  const overdue  = payments.filter(p=>p.status==='overdue');
  const paid     = payments.filter(p=>p.status==='paid');
  const totalDue = stats.totalPending + stats.totalOverdue;

  return (
    <div className="space-y-5">
      {payTarget && <PaymentModal invoice={payTarget} onClose={()=>setPayTarget(null)} onSuccess={load}/>}
      <div><h3 className="text-lg font-bold text-slate-800 dark:text-white">Balance &amp; Account Info</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          Your payment overview
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> Live
          </span>
        </p></div>
      {overdue.length>0&&(
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
          <i className="bx bx-error-circle text-rose-400 text-2xl flex-shrink-0"/>
          <div><p className="font-bold text-rose-400 text-sm">{overdue.length} overdue invoice{overdue.length>1?'s':''} — ETB {stats.totalOverdue.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Please pay as soon as possible.</p></div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {label:'Amount Due', amount:totalDue,          icon:'bx-time-five',    color:totalDue>0?'amber':'slate',   sub:`${pending.length+overdue.length} outstanding`},
          {label:'Total Paid', amount:stats.totalPaid,   icon:'bx-check-circle', color:'emerald',                    sub:`${paid.length} payment${paid.length!==1?'s':''} received`},
          {label:'Overdue',    amount:stats.totalOverdue,icon:'bx-error-circle', color:stats.totalOverdue>0?'rose':'slate', sub:`${overdue.length} past due`},
        ].map(s=>(
          <div key={s.label} className={`bg-${s.color}-500/10 border border-${s.color}-500/20 rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <i className={`bx ${s.icon} text-2xl text-${s.color}-400`}/>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-${s.color}-500/10 text-${s.color}-400`}>{s.label}</span>
            </div>
            <p className={`text-3xl font-bold text-${s.color}-400`}>ETB {s.amount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>
      {(pending.length>0||overdue.length>0)&&(
        <div className="overflow-hidden">
          <div className="px-0 py-3 flex items-center gap-2">
            <i className="bx bx-receipt text-amber-400"/><h4 className="font-bold text-slate-800 dark:text-white">Outstanding Invoices ({pending.length+overdue.length})</h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {[...overdue,...pending].map(p=>(
              <div key={p._id} className="flex items-center gap-4 py-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.status==='overdue'?'bg-rose-500/10':'bg-amber-500/10'}`}>
                  <i className={`bx bx-receipt text-xl ${p.status==='overdue'?'text-rose-400':'text-amber-400'}`}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{p.child?.firstName} {p.child?.lastName}</p>
                  <p className="text-xs text-slate-400">{p.invoiceNumber} · {p.type?.replace(/-/g,' ')} · Due {new Date(p.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-slate-800 dark:text-white">ETB {p.amount?.toLocaleString()}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.status==='overdue'?'bg-rose-500/10 text-rose-400':'bg-amber-500/10 text-amber-400'}`}>{p.status}</span>
                  </div>
                  <button onClick={()=>setPayTarget(p)} className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                    <i className="bx bx-credit-card text-sm"/>Pay Now
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="py-3 flex justify-between items-center border-t border-slate-100 dark:border-teal-900/30">
            <span className="text-sm text-slate-500">Total outstanding</span>
            <span className="text-lg font-bold text-amber-400">ETB {totalDue.toLocaleString()}</span>
          </div>
        </div>
      )}
      {totalDue===0&&(
        <div className="text-center py-12 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
          <i className="bx bx-check-shield text-5xl text-emerald-400 opacity-70"/>
          <p className="font-bold text-emerald-400 mt-3">Your account is fully paid up!</p>
        </div>
      )}
      {paid.length>0&&(
        <div className="overflow-hidden">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><i className="bx bx-check-circle text-emerald-400"/><h4 className="font-bold text-slate-800 dark:text-white">Recent Payments</h4></div>
            <span className="text-xs text-slate-400">{paid.length} total</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {paid.slice(0,6).map(p=>(
              <div key={p._id} className="flex items-center gap-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <i className={`bx ${p.method==='card'?'bx-credit-card':p.method==='bank-transfer'?'bx-transfer':p.method==='check'?'bx-check-square':'bx-money'} text-emerald-400`}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{p.child?.firstName} {p.child?.lastName} — {p.type?.replace(/-/g,' ')}</p>
                  <p className="text-xs text-slate-400">{p.paidDate?`Paid ${new Date(p.paidDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:p.invoiceNumber}</p>
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

// ── TAB 3: Receipts ───────────────────────────────────────────────────────────
const ReceiptsTab = () => {
  const { t } = useLanguage();
  const [payments,   setPayments]   = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(()=>{
    api.get('/payments?status=paid').then(r=>setPayments(r.data.data||[])).catch(()=>setError('Could not load receipts.')).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    let list = payments;
    if (yearFilter!=='all') list = list.filter(p=>{ const d=p.paidDate||p.createdAt; return d&&new Date(d).getFullYear().toString()===yearFilter; });
    if (search.trim()) { const q=search.toLowerCase(); list=list.filter(p=>p.invoiceNumber?.toLowerCase().includes(q)||p.child?.firstName?.toLowerCase().includes(q)||p.child?.lastName?.toLowerCase().includes(q)||p.type?.toLowerCase().includes(q)); }
    setFiltered(list);
    setCurrentPage(1);
  },[payments,search,yearFilter]);

  const years = [...new Set(payments.map(p=>p.paidDate||p.createdAt).filter(Boolean).map(d=>new Date(d).getFullYear()))].sort((a,b)=>b-a);
  const totalFiltered = filtered.reduce((s,p)=>s+(p.amount||0),0);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReceipts = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleCSV = () => {
    const rows = [['Invoice #','Child','Type','Amount','Paid Date','Method'],...filtered.map(p=>[p.invoiceNumber||'—',`${p.child?.firstName||''} ${p.child?.lastName||''}`.trim(),p.type?.replace(/-/g,' ')||'—',`ETB ${p.amount}`,p.paidDate?new Date(p.paidDate).toLocaleDateString():'—',p.method||'cash'])];
    const csv  = rows.map(r=>r.join(',')).join('\n');
    const a    = Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:`receipts-${yearFilter==='all'?'all-years':yearFilter}.csv`});
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>;
  if (error)   return <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl p-6 text-center">{error}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('receiptsHistoryTitle', 'Receipts History')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{payments.length} {t('paidInvoices', 'paid invoices')} · ${payments.reduce((s,p)=>s+(p.amount||0),0).toLocaleString()} {t('totalPaid', 'total paid')}</p></div>
        <button onClick={handleCSV} disabled={filtered.length===0} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold text-sm disabled:opacity-40">
          <i className="bx bx-download"/>{t('exportCsv', 'Export CSV')}
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" placeholder={t('searchReceipts', 'Search by invoice #, child name, or type…')} value={search} onChange={e=>setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
        <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)}
          className="border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">{t('allYears', 'All Years')}</option>{years.map(y=><option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      {filtered.length>0&&(
        <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-5 py-3">
          <span className="text-sm text-slate-500">{filtered.length} {t('receiptsShown', 'receipts shown')}</span>
          <span className="font-bold text-emerald-400 text-lg">ETB {totalFiltered.toLocaleString()}</span>
        </div>
      )}
      {filtered.length===0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-receipt text-5xl opacity-30"/><p className="mt-3 font-semibold">{t('noReceiptsFound', 'No receipts found')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-4 px-5 py-3.5 bg-slate-50 dark:bg-[#0d1520]/50 border-b border-slate-100 dark:border-teal-900/30">
            {['Invoice #','Child','Type','Amount','Paid Date',''].map(h=><span key={h} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</span>)}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {paginatedReceipts.map(p=>(
              <div key={p._id} className="flex flex-col md:grid md:grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 md:gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors items-start md:items-center">
                <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-[#0d1520] px-2 py-1 rounded-lg">{p.invoiceNumber||'—'}</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{p.child?.firstName?.charAt(0)||'?'}</div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{p.child?.firstName} {p.child?.lastName}</span>
                </div>
                <span className="text-xs text-slate-500 bg-slate-100 dark:bg-[#0d1520] px-2 py-1 rounded-lg capitalize w-fit">{p.type?.replace(/-/g,' ')||'—'}</span>
                <span className="font-bold text-emerald-400 text-base">ETB {p.amount?.toLocaleString()}</span>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{p.paidDate?new Date(p.paidDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'}</p>
                  {p.method&&<span className="text-[10px] text-slate-400 capitalize">{p.method}</span>}
                </div>
                <button onClick={()=>window.print()} title="Print receipt" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                  <i className="bx bx-printer text-lg"/>
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-teal-900/30 bg-white dark:bg-[#0d1520]">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel={t('receiptsCount', 'receipts')}
            />
          </div>

          <div className="px-5 py-3 bg-slate-50 dark:bg-[#0d1520]/50 border-t border-slate-100 dark:border-teal-900/30 flex justify-between items-center">
            <span className="text-sm text-slate-500 font-semibold">{t('totalReceipts', 'Total')} ({filtered.length} {t('receiptsCount', 'receipts')})</span>
            <span className="text-xl font-bold text-emerald-400">ETB {totalFiltered.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main unified Payments page ────────────────────────────────────────────────
const PARENT_TABS = [
  { key: 'makePayment', label: 'Make Payment',    icon: 'bx-credit-card' },
  { key: 'receipts',    label: 'receiptsHistory', icon: 'bx-download'    },
];

const ADMIN_TABS = [
  { key: 'invoices', label: 'All Invoices', icon: 'bx-receipt'  },
  { key: 'receipts', label: 'Receipts',     icon: 'bx-download' },
];

const PaymentList = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isFreeMode, togglePaymentMode } = useSettings();
  const location  = useLocation();
  const navigate  = useNavigate();
  const isAdmin   = ['admin', 'reception', 'staff'].includes(user?.role);
  const TABS      = isAdmin ? ADMIN_TABS : PARENT_TABS;
  const canManage = isAdmin;
  const [tab, setTab] = useState(isAdmin ? 'invoices' : 'makePayment');

  // Handle Chapa callback — verify payment then redirect to success page
  useEffect(() => {
    const params    = new URLSearchParams(location.search);
    const txRef     = params.get('chapa_tx');
    const invoiceId = params.get('invoice_id');
    if (!txRef) return;

    // Clear URL params immediately to avoid re-triggering
    window.history.replaceState(null, '', location.pathname);

    api.post('/payments/chapa-verify', { txRef })
      .then(() => {
        // Navigate to payment success page with the invoice ID
        navigate(`/dashboard/parent/payment-success${invoiceId ? `?invoice_id=${invoiceId}` : ''}`);
      })
      .catch(err => {
        console.error('Chapa verify failed:', err.response?.data?.message || err.message);
      });
  }, [location.search]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('paymentsTitle', 'Payments')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('paymentsSubtitle', 'Invoices and receipt history')}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Free Mode Toggle — admin/reception only */}
          {canManage && (
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
              isFreeMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <i className={`bx ${isFreeMode ? 'bx-gift text-emerald-500' : 'bx-credit-card text-amber-500'}`} />
                  {isFreeMode ? 'Free Mode' : 'Payment Mode'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isFreeMode ? 'Click to enable payments' : 'Click to enable free access'}
                </p>
              </div>
              <button
                onClick={async () => { try { await togglePaymentMode(); } catch(e) { console.error(e); } }}
                title="Toggle Free / Payment Mode"
                className={`relative inline-flex h-6 min-w-[2.75rem] items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  isFreeMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300 ${
                  isFreeMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          )}

          {!canManage && !isFreeMode && (
            <button
              onClick={() => navigate('/dashboard/parent/make-payment')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm shadow-lg shadow-[#00A884]/30 hover:-translate-y-0.5 transition-all flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #00A884 0%, #00C49A 100%)' }}
            >
              <i className="bx bx-credit-card text-base" /> Make Payment
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-[#111c2d] rounded-xl border border-slate-200 dark:border-teal-900/30 p-1.5 shadow-sm w-fit">
        {TABS.map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === tabItem.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <i className={`bx ${tabItem.icon}`} />
            {tabItem.key === 'receipts' ? t(tabItem.label, tabItem.label) : tabItem.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'makePayment' && <MakePayment embedded />}
      {tab === 'history'     && <AdminPaymentHistory />}
      {tab === 'invoices'    && <InvoicesTab canManage={canManage} />}
      {tab === 'receipts'    && <ReceiptsTab />}
    </div>
  );
};

export default PaymentList;
