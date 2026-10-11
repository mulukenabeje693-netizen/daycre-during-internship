import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import SupportModal from '../../components/SupportModal';
import api from '../../services/api';

/* ─── helpers ──────────────────────────────────────── */
const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* ─── Stepper ──────────────────────────────────────── */
const STEPS = [
  { n: 1, label: 'selectInvoice' },
  { n: 2, label: 'paymentMethodTitle' },
  { n: 3, label: 'reviewAndPay' },
  { n: 4, label: 'paymentSuccess' },
];

const Stepper = () => {
  const { t } = useLanguage();
  return (
  <div className="flex items-center gap-0 mb-8">
    {STEPS.map((s, idx) => (
      <div key={s.n} className="flex items-center flex-1 last:flex-none">
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-[#00A884] border-[#00A884] text-white shadow-lg shadow-[#00A884]/30 transition-all">
            <i className="bx bx-check text-lg" />
          </div>
          <span className={`text-xs font-semibold whitespace-nowrap ${s.n === 4 ? 'text-[#00A884] font-bold' : 'text-[#00A884]'}`}>
            {t(s.label)}
          </span>
        </div>
        {idx < STEPS.length - 1 && (
          <div className="h-0.5 flex-1 mx-2 mb-5 bg-[#00A884] transition-all" />
        )}
      </div>
    ))}
  </div>
  );
};

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
  const [show,    setShow]    = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // Try to get payment data from:
  // 1. Navigation state (passed from MakePayment)
  // 2. URL param ?invoice_id=xxx
  // 3. Fallback mock
  useEffect(() => {
    const params     = new URLSearchParams(location.search);
    const invoiceId  = params.get('invoice_id');

    if (invoiceId) {
      api.get(`/payments/${invoiceId}`)
        .then(r => setPayment(r.data.data))
        .catch(() => setPayment(null))
        .finally(() => { setLoading(false); setTimeout(() => setShow(true), 100); });
    } else {
      setLoading(false);
      setTimeout(() => setShow(true), 100);
    }
  }, [location.search]);

  const data = payment ? {
    receiptNumber: `RCPT-2026-${String(payment.invoiceNumber || '').replace('INV-','')}`,
    txId:          payment.chapaTxRef || `tx_${payment._id?.slice(-12)}`,
    childName:     `${payment.child?.firstName || ''} ${payment.child?.lastName || ''}`.trim() || 'N/A',
    parentName:    payment.parent?.fullName || user?.fullName || 'Parent',
    classroom:     payment.child?.classroom?.name || '—',
    invoiceNumber: payment.invoiceNumber || '—',
    paymentDate:   fmtDate(payment.paidDate || new Date()),
    method:        'Chapa',
    amountPaid:    payment.amount || 0,
    nextDue:       new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    type:          payment.type?.replace(/-/g,' ') || 'Monthly Fee',
    parentEmail:   payment.parent?.email || user?.email || '',
  } : {
    receiptNumber: 'RCPT-2026-000124',
    txId:          'tx_77b9a2c8e1d2b4c',
    childName:     'Kal Grima',
    parentName:    user?.fullName || 'John Parent',
    classroom:     'Nursery A',
    invoiceNumber: 'INV-2026-00124',
    paymentDate:   fmtDate(new Date()),
    method:        'Chapa',
    amountPaid:    800,
    nextDue:       new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    type:          'Monthly Fee – August 2026',
    parentEmail:   user?.email || 'john.parent@email.com',
  };

  const handleDownload = () => {
    const lines = [
      `MINT Daycare - Payment Receipt`,
      `================================`,
      `Receipt No:    ${data.receiptNumber}`,
      `Transaction:   ${data.txId}`,
      `Child:         ${data.childName}`,
      `Parent:        ${data.parentName}`,
      `Classroom:     ${data.classroom}`,
      `Invoice No:    ${data.invoiceNumber}`,
      `Payment Date:  ${data.paymentDate}`,
      `Method:        ${data.method}`,
      `Amount Paid:   ${fmtCurrency(data.amountPaid)}`,
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
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('paymentSuccessful', 'Payment Successful!')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('paymentProcessed', 'Your payment has been processed successfully.')}</p>
      </div>

      {/* Stepper — all complete */}
      <Stepper />

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
            <ReceiptRow label={t('childName', 'Child Name')}      value={data.childName} />
            <ReceiptRow label={t('paymentFor', 'Payment For')}     value={data.type} />
            <ReceiptRow label={t('amountPaid', 'Amount Paid')}     value={fmtCurrency(data.amountPaid)} highlight />
            <ReceiptRow label={t('paymentMethod', 'Payment Method')}  value={data.method} />
            <ReceiptRow label={t('datePaid', 'Payment Date')}    value={data.paymentDate} />
            <ReceiptRow label={t('nextDueDate', 'Next Due Date')}   value={data.nextDue} />
          </div>

          {/* Email receipt banner */}
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
            <i className="bx bx-check-circle text-[#00A884] text-xl flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{t('receiptSent', 'A receipt has been sent to your email.')}</p>
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
              onClick={() => navigate('/dashboard/parent/payments')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-300 text-slate-700 font-semibold text-sm hover:border-[#00A884] hover:text-[#00A884] transition"
            >
              <i className="bx bx-receipt text-lg" /> {t('viewInvoices', 'View Invoices')}
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
                    {row.negative ? `-${fmtCurrency(row.amount)}` : fmtCurrency(row.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">{t('totalAmount', 'Total Amount')}</span>
                <span className="text-2xl font-extrabold text-[#00A884]">{fmtCurrency(data.amountPaid)}</span>
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
              <div className="flex items-center gap-2"><i className="bx bx-check text-[#00A884]" /> Verified by Chapa</div>
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
