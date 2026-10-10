import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { useSettings } from '../../context/SettingsContext';
import SupportModal from '../../components/SupportModal';
import Pagination from '../../components/shared/Pagination';

const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtMonth = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—';
const initials = (name = '') =>
  name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

const STEPS = [
  { n: 1, label: 'selectInvoice' },
  { n: 2, label: 'paymentMethodTitle' },
  { n: 3, label: 'reviewAndPay' },
  { n: 4, label: 'paymentSuccess' },
];

const Stepper = ({ current }) => {
  const { t } = useLanguage();
  return (
  <div className="flex items-center mb-8">
    {STEPS.map((s, idx) => {
      const done = s.n < current; const active = s.n === current;
      return (
        <div key={s.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
              ${done ? 'bg-[#00A884] border-[#00A884] text-white' : active ? 'bg-[#00A884] border-[#00A884] text-white shadow-lg shadow-[#00A884]/40 scale-110' : 'bg-white border-slate-300 text-slate-400'}`}>
              {done ? <i className="bx bx-check text-base" /> : s.n}
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${active ? 'text-[#00A884] font-bold' : done ? 'text-[#00A884]' : 'text-slate-400'}`}>{t(s.label)}</span>
          </div>
          {idx < STEPS.length - 1 && <div className={`h-px flex-1 mx-3 mb-5 ${done ? 'bg-[#00A884]' : 'bg-slate-200'}`} />}
        </div>
      );
    })}
  </div>
  );
};

/* ── Invoice checkbox card ───────────────────────── */
const InvoiceCard = ({ invoice, isSelected, onToggle }) => {
  const { t } = useLanguage();
  const child = invoice.child || {};
  const name = `${child.firstName || ''} ${child.lastName || ''}`.trim();
  const isPaid = invoice.status === 'paid';
  
  return (
    <div onClick={() => !isPaid && onToggle(invoice)}
      className={`relative rounded-2xl border-2 p-4 flex items-center gap-4 transition-all duration-200
        ${isPaid ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50' : 
          isSelected ? 'border-[#00A884] bg-[#00A884]/5 shadow-md cursor-pointer' : 
          'border-slate-200 bg-white hover:border-[#00A884]/40 hover:shadow-sm cursor-pointer'}`}>
      <div className={`w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all
        ${isSelected ? 'border-[#00A884] bg-[#00A884]' : 
          isPaid ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'}`}>
        {(isSelected || isPaid) && <i className="bx bx-check text-white text-sm" />}
      </div>
      <div className="w-10 h-10 rounded-full bg-[#00A884] flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm">
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm">{name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{fmtMonth(invoice.dueDate)} &bull; Due {fmtDate(invoice.dueDate)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-base font-extrabold ${isPaid ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{fmtCurrency(invoice.amount)}</p>
        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
          ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
          {isPaid ? t('paid', 'Paid') : t('unpaid', 'Unpaid')}
        </span>
      </div>
      {isSelected && <div className="absolute inset-0 rounded-2xl ring-2 ring-[#00A884]/30 pointer-events-none" />}
    </div>
  );
};

/* ── Summary sidebar shared across steps ─────────── */
const SummarySidebar = ({ selected, user, onContactSupport, step, onContinue }) => {
  const { t } = useLanguage();
  const total = selected.reduce((s, i) => s + (i.amount || 0), 0);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6">
        <h3 className="text-base font-bold text-slate-800 mb-4">{t('paymentSummary', 'Payment Summary')}</h3>
        {selected.length > 0 ? (
          <>
            {selected.map(inv => {
              const n = `${inv.child?.firstName || ''} ${inv.child?.lastName || ''}`.trim();
              return (
                <div key={inv._id} className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 last:border-0 last:mb-0 last:pb-0">
                  <div className="w-9 h-9 rounded-full bg-[#00A884] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{initials(n)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{n}</p>
                    <p className="text-xs text-slate-400">{fmtMonth(inv.dueDate)}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-700 flex-shrink-0">{fmtCurrency(inv.amount)}</p>
                </div>
              );
            })}
            <div className="space-y-2 mt-4 mb-4 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">{t('monthlyFee', 'Monthly Fee')}</span><span className="font-semibold text-slate-700">{fmtCurrency(total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('lateFee', 'Late Fee')}</span><span className="font-semibold text-slate-700">{fmtCurrency(0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('discount', 'Discount')}</span><span className="font-semibold text-emerald-500">-{fmtCurrency(0)}</span></div>
            </div>
            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
              <span className="font-bold text-slate-800">{t('totalAmount', 'Total Amount')}</span>
              <span className="text-2xl font-extrabold text-[#00A884]">{fmtCurrency(total)}</span>
            </div>
            {onContinue && (
              <button
                onClick={onContinue}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white text-sm shadow-md shadow-[#00A884]/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}
              >
                <span>{step === 1 ? t('nextPaymentMethod', 'Next: Payment Method') : t('nextReviewAndPay', 'Next: Review & Pay')}</span>
                <i className="bx bx-right-arrow-alt text-lg" />
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            <i className="bx bx-receipt text-3xl block mb-2 opacity-40" />{t('selectInvoice', 'Select an invoice')}
          </div>
        )}
      </div>
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 text-xs text-slate-600 dark:text-amber-200">
        <div className="flex items-start gap-2"><i className="bx bx-info-circle text-amber-500 dark:text-amber-400 text-base flex-shrink-0 mt-0.5" />
          <p>{t('redirectedToChapa', 'Payment is processed securely by Chapa. You will be redirected to complete your payment.')}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2"><i className="bx bx-headphone text-[#00A884] text-xl" /><h4 className="font-bold text-slate-800 text-sm">{t('needHelp', 'Need Help?')}</h4></div>
        <p className="text-xs text-slate-500 mb-3">{t('ifYouFaceIssues', 'If you face any issues with payment, please contact our support team.')}</p>
        <button 
          onClick={onContactSupport}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#00A884] text-[#00A884] text-xs font-semibold hover:bg-[#00A884]/5 transition"
        >
          <i className="bx bx-support" /> {t('contactSupport', 'Contact Support')}
        </button>
      </div>
    </div>
  );
};

/* ── STEP 1: Select Invoice ────────────────────────── */
const Step1 = ({ invoices, selected, setSelected, onContinue, embedded, onBack, onGenerateTest }) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(invoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = invoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleInvoice = (inv) =>
    setSelected(prev => prev.some(s => s._id === inv._id) ? prev.filter(s => s._id !== inv._id) : [...prev, inv]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{t('selectInvoice', 'Select Invoice')}</h2>
            <p className="text-xs text-[#00A884] mt-0.5">{t('chooseInvoiceToPay', 'Choose an invoice to pay')}</p>
          </div>
          {selected.length > 0 && (
            <button
              onClick={onContinue}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}
            >
              <span>{t('next', 'Next')}</span>
              <i className="bx bx-right-arrow-alt text-base" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-3">
          {invoices.length === 0 ? (
            /* Empty state INSIDE the card — stepper still visible above */
            <div className="text-center py-10">
              <i className="bx bx-check-shield text-5xl text-emerald-400 block mb-3" />
              <p className="font-bold text-slate-700 text-base">{t('allInvoicesArePaidUp', 'All invoices are paid up!')}</p>
              <p className="text-slate-400 text-sm mt-1 mb-5">{t('youHaveNoOutstandingInvoices', 'You have no outstanding invoices at this time.')}</p>
              {onGenerateTest && (
                <button onClick={onGenerateTest}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-[#00A884] text-[#00A884] text-sm font-semibold hover:bg-[#00A884]/5 transition">
                  <i className="bx bx-plus-circle text-lg" /> {t('generateTestInvoice', 'Generate Test Invoice')}
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-[#00A884] mb-3">{t('youCanSelectOneOrMoreInvoices', 'You can select one or more invoices.')}</p>
              {paginatedInvoices.map(inv => <InvoiceCard key={inv._id} invoice={inv} isSelected={selected.some(s => s._id === inv._id)} onToggle={toggleInvoice} />)}
              {invoices.length > ITEMS_PER_PAGE && (
                <div className="pt-2">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={invoices.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    itemLabel={t('invoices', 'invoices')}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-start gap-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-5 py-4">
        <i className="bx bx-shield-alt-2 text-[#00A884] dark:text-emerald-400 text-xl flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-200"><span className="font-bold text-slate-800 dark:text-white block mb-0.5">{t('yourPaymentIsSecure', 'Your payment is secure')}</span>{t('allTransactionsAreEncrypted', 'All transactions are encrypted and processed securely by Chapa.')}</p>
      </div>
      <div className="flex items-center justify-between pt-1">
        {!embedded ? <button onClick={onBack} className="px-6 py-3 rounded-2xl border-2 border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">{t('cancel', 'Cancel')}</button> : <div />}
        <button onClick={onContinue} disabled={selected.length === 0}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-50 hover:-translate-y-0.5 shadow-lg shadow-[#00A884]/30 transition-all"
          style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}>
          <i className="bx bx-right-arrow-alt text-base" /> {t('continueToPaymentMethod', 'Continue to Payment Method')}
        </button>
      </div>
    </div>
  );
};

/* ── STEP 2: Payment Method ────────────────────────── */
const Step2 = ({ selected, onContinue, onBack }) => {
  const { t } = useLanguage();
  return (
  <div className="space-y-5">
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">{t('paymentMethodTitle', 'Payment Method')}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{t('selectYourPaymentMethod', 'Select your payment method')}</p>
      </div>
      <div className="p-6 space-y-4">
        {/* Chapa option — selected */}
        <div className="rounded-2xl border-2 border-[#00A884] bg-[#00A884]/5 p-5">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 rounded-full border-2 border-[#00A884] bg-[#00A884] flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-extrabold text-[#00A884] tracking-tight">chapa</span>
                <span className="text-[10px] font-bold bg-[#00A884] text-white px-2 py-0.5 rounded-full">{t('recommended', 'Recommended')}</span>
              </div>
              <p className="text-sm text-slate-600">{t('paySecurelyUsingChapa', 'Pay securely using Chapa payment gateway')}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1"><i className="bx bx-lock-alt text-[#00A884]" />{t('sslEncrypted', 'SSL Encrypted')}</span>
                <span>•</span><span>{t('secure', 'Secure')}</span><span>•</span><span>{t('fast', 'Fast')}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 flex-shrink-0">
              {['📱','🏦','💳','🏛️','📲'].map((icon, i) => (
                <div key={i} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm shadow-sm">{icon}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-5 py-4">
          <i className="bx bx-shield-alt-2 text-[#00A884] dark:text-emerald-400 text-xl flex-shrink-0 mt-0.5" />
          <div><p className="text-sm font-bold text-slate-800 dark:text-white">{t('yourPaymentIsSecure', 'Your payment is secure')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">{t('allTransactionsAreEncrypted', 'All transactions are encrypted and processed securely by Chapa.')}</p>
          </div>
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between pt-1">
      <button onClick={onBack} className="px-6 py-3 rounded-2xl border-2 border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">← {t('backBtn', 'Back')}</button>
      <button onClick={onContinue} className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white text-sm hover:-translate-y-0.5 shadow-lg shadow-[#00A884]/30 transition-all" style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}>
        <i className="bx bx-right-arrow-alt text-base" /> {t('continueToReview', 'Continue to Review')}
      </button>
    </div>
  </div>
  );
};

/* ── STEP 3: Review & Pay ──────────────────────────── */
const Step3 = ({ selected, paying, onPay, onBack }) => {
  const { t } = useLanguage();
  const total = selected.reduce((s, i) => s + (i.amount || 0), 0);
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{t('reviewAndPay', 'Review & Pay')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('reviewPaymentDetails', 'Review your payment details before proceeding')}</p>
        </div>
        <div className="p-6 space-y-4">
          {selected.map(inv => {
            const n = `${inv.child?.firstName || ''} ${inv.child?.lastName || ''}`.trim();
            return (
              <div key={inv._id} className="flex items-center gap-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="w-11 h-11 rounded-full bg-[#00A884] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{initials(n)}</div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{n}</p>
                  <p className="text-xs text-slate-400">{inv.invoiceNumber} &bull; {fmtMonth(inv.dueDate)}</p>
                </div>
                <p className="text-lg font-extrabold text-[#00A884]">{fmtCurrency(inv.amount)}</p>
              </div>
            );
          })}
          <div className="rounded-2xl bg-[#00A884]/5 border border-[#00A884]/20 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{t('paymentMethodTitle', 'Payment Method')}</span><span className="font-bold text-slate-800 flex items-center gap-1"><span className="text-[#00A884] font-extrabold">chapa</span></span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('processing', 'Processing')}</span><span className="font-semibold text-slate-700">{t('instant', 'Instant')}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-[#00A884]/20 pt-2 mt-2">
              <span className="text-slate-800">{t('totalLabel', 'Total')}</span><span className="text-[#00A884] text-xl">{fmtCurrency(total)}</span>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-4 py-3">
            <i className="bx bx-lock-alt text-[#00A884] dark:text-emerald-400 text-base flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300">{t('redirectedToChapa', "You will be redirected to Chapa's secure checkout page to complete your payment.")}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button onClick={onBack} className="px-6 py-3 rounded-2xl border-2 border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">← {t('backBtn', 'Back')}</button>
        <button onClick={onPay} disabled={paying}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-60 hover:-translate-y-0.5 shadow-lg shadow-[#00A884]/30 transition-all"
          style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}>
          {paying ? <><i className="bx bx-loader-alt animate-spin" /> {t('processingProcessing', 'Processing...')}</> : <><i className="bx bx-lock-alt text-base" /> {t('payNowViaChapa', 'Pay Now via Chapa')}</>}
        </button>
      </div>
    </div>
  );
};

/* ── MAIN COMPONENT ────────────────────────────────── */
const MakePayment = ({ embedded = false }) => {
  const { user }   = useAuth();
  const { t }      = useLanguage();
  const { isFreeMode } = useSettings();
  const navigate   = useNavigate();
  const [step,     setStep]     = useState(1);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [paying,   setPaying]   = useState(false);
  const [error,    setError]    = useState('');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  useEffect(() => {
    api.get('/payments')
      .then(r => {
        const list = (r.data.data || []).filter(p => p.status !== 'cancelled');
        setInvoices(list);
        const unpaids = list.filter(p => p.status !== 'paid');
        if (unpaids.length > 0) setSelected([unpaids[0]]);
      })
      .catch(() => setError('Failed to load invoices.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePay = async () => {
    if (!selected.length) return;
    setPaying(true); setError('');
    try {
      const res = await api.post(`/payments/${selected[0]._id}/chapa-init`);
      if (res.data?.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setError('Failed to initialize Chapa payment. Please try again.');
        setPaying(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Payment initialization failed.');
      setPaying(false);
    }
  };

  const generateTestInvoice = async () => {
    setError('');
    try {
      const res = await api.post('/payments/generate-test');
      if (res.data?.success) {
        const newInv = res.data.data;
        setInvoices(prev => [newInv, ...prev]);
        setSelected([newInv]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate test invoice.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const wrapper = embedded ? 'space-y-6 pt-2' : 'min-h-screen bg-slate-50 -m-6 px-8 py-8';

  if (isFreeMode) {
    return (
      <div className={wrapper}>
        <div className="flex flex-col items-center justify-center h-64 text-center mt-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <i className="bx bx-gift text-3xl text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">Free Trial Active</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Enjoy complimentary access to all daycare features during this period. No payments are required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      {!embedded && (
        <>
          <p className="text-xs text-slate-400 mb-2">
            <span className="hover:text-[#00A884] cursor-pointer" onClick={() => navigate(-1)}>{t('payments', 'Payments')}</span>
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="text-slate-600 font-semibold">{t('makeAPayment', 'Make Payment')}</span>
          </p>
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('makeAPayment', 'Make a Payment')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('securePaymentPoweredByChapa', 'Secure payment powered by Chapa')}</p>
          </div>
        </>
      )}

      <Stepper current={step} />

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl px-5 py-3.5 text-sm font-medium mb-4">
          <i className="bx bx-error-circle text-xl flex-shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div>
            {step === 1 && <Step1 invoices={invoices} selected={selected} setSelected={setSelected} onContinue={() => setStep(2)} embedded={embedded} onBack={() => navigate(-1)} onGenerateTest={generateTestInvoice} />}
            {step === 2 && <Step2 selected={selected} onContinue={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && <Step3 selected={selected} paying={paying} onPay={handlePay} onBack={() => setStep(2)} />}
          </div>
          <SummarySidebar
            selected={selected}
            user={user}
            onContactSupport={() => setIsSupportModalOpen(true)}
            step={step}
            onContinue={step < 3 && selected.length > 0 ? () => setStep(s => s + 1) : null}
          />
        </div>

      {!embedded && step < 4 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-4 mt-4 border-t border-slate-200">
          <span>© 2026 Daycare Center. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span className="cursor-pointer hover:text-slate-600">{t('termsOfService', 'Terms of Service')}</span>
            <span className="cursor-pointer hover:text-slate-600">{t('privacyPolicy', 'Privacy Policy')}</span>
            <span className="flex items-center gap-1"><i className="bx bx-lock-alt text-[#00A884]" />Powered by Chapa</span>
          </div>
        </div>
      )}

      <SupportModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} />
    </div>
  );
};

export default MakePayment;
