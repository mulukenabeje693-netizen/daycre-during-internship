import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { useSettings } from '../../context/useSettings';
import SupportModal from '../../components/SupportModal';
import Pagination from '../../components/shared/Pagination';
import PaymentProgress from '../../components/shared/PaymentProgress';
import { getChapaInitializationError, redirectToChapaCheckout } from '../../utils/chapaCheckout';
import { isValidChapaReference } from '../../utils/chapaReference';

const fmtCurrency = (n, currency = 'ETB') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtMonth = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—';
const toMinorUnits = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const match = String(value).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const minorUnits = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
};
const outstandingFor = (invoice) => {
  const explicitBalanceCents = toMinorUnits(invoice?.outstandingBalance);
  if (explicitBalanceCents !== null) return explicitBalanceCents / 100;

  const amountCents = toMinorUnits(invoice?.amount);
  const paidCents = toMinorUnits(invoice?.amountPaid ?? 0);
  if (amountCents === null || paidCents === null) return 0;
  return Math.max(0, amountCents - paidCents) / 100;
};
const initials = (name = '') =>
  name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const invoiceChildId = (invoice) => {
  const child = invoice?.child;
  return String(child?._id || child || '');
};

/* ── Invoice checkbox card ───────────────────────── */
const InvoiceCard = ({ invoice, isSelected, onToggle }) => {
  const { t } = useLanguage();
  const child = invoice.child || {};
  const name = `${child.firstName || ''} ${child.lastName || ''}`.trim();
  const outstanding = outstandingFor(invoice);
  const isPaid = invoice.status === 'paid' || outstanding <= 0;

  return (
    <button type="button" onClick={() => !isPaid && onToggle(invoice)} disabled={isPaid}
      aria-pressed={isSelected}
      className={`relative w-full text-left rounded-2xl border-2 p-4 flex items-center gap-4 transition-all duration-200
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
        <p className="text-xs text-slate-500 mt-0.5">{invoice.invoiceNumber} &bull; {invoice.notes || invoice.type?.replace(/-/g, ' ') || 'Invoice'}</p>
        {invoice.sandboxTestInvoice && (
          <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">
            Chapa sandbox test invoice
          </span>
        )}
        <p className="text-xs text-slate-400 mt-0.5">
          Billing {fmtMonth(invoice.billingPeriodStart || invoice.dueDate)} &bull; Due {fmtDate(invoice.dueDate)}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Original {fmtCurrency(invoice.amount, invoice.currency)} &bull; Paid {fmtCurrency(invoice.amountPaid, invoice.currency)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-base font-extrabold ${isPaid ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{fmtCurrency(outstanding, invoice.currency)}</p>
        <p className="mt-1 text-[10px] text-slate-500">Outstanding</p>
        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
          ${isPaid ? 'bg-emerald-100 text-emerald-600' : invoice.status === 'overdue' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
          {isPaid ? t('paid', 'Paid') : invoice.status === 'overdue' ? t('overdue', 'Overdue') : t('unpaid', 'Unpaid')}
        </span>
      </div>
      {isSelected && <div className="absolute inset-0 rounded-2xl ring-2 ring-[#00A884]/30 pointer-events-none" />}
    </button>
  );
};

/* ── Summary sidebar shared across steps ─────────── */
const SummarySidebar = ({ selected, user, onContactSupport, step, onContinue }) => {
  const { t } = useLanguage();
  const total = selected.reduce((sum, invoice) => sum + outstandingFor(invoice), 0);
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
                      <p className="text-xs text-slate-400">{inv.invoiceNumber} · {fmtMonth(inv.billingPeriodStart || inv.dueDate)}</p>
                  </div>
                    <p className="text-sm font-bold text-slate-700 flex-shrink-0">{fmtCurrency(outstandingFor(inv), inv.currency)}</p>
                </div>
              );
            })}
            <div className="space-y-2 mt-4 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{selected[0].type?.replace(/-/g, ' ') || t('invoiceAmount', 'Invoice amount')}</span>
                <span className="font-semibold text-slate-700">{fmtCurrency(outstandingFor(selected[0]), selected[0].currency)}</span>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
              <span className="font-bold text-slate-800">{t('totalAmount', 'Total Amount')}</span>
              <span className="text-2xl font-extrabold text-[#00A884]">{fmtCurrency(total, selected[0].currency)}</span>
            </div>
            {onContinue && (
              <button
                onClick={onContinue}
                type="button"
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white text-sm shadow-md shadow-[#00A884]/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}
              >
                <span>{step === 1 ? t('confirmPaymentDetails', 'Confirm Payment Details') : t('nextReviewAndPay', 'Next: Review & Pay')}</span>
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
          <p>{t('paymentCheckoutHelp', 'Choose an available payment method during checkout. Chapa payments are verified online; bank transfers remain unpaid until an administrator confirms them.')}</p>
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
const Step1 = ({ invoices, hasPaidInvoices, testInvoiceState, selected, setSelected, onContinue, onViewReceipts, embedded, onBack, onGenerateTest, generatingTestInvoice, invoiceLoadError, onRetryInvoices }) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [selectedChildId, setSelectedChildId] = useState('');
  const children = [...new Map(
    invoices
      .filter(invoice => invoiceChildId(invoice))
      .map(invoice => [invoiceChildId(invoice), invoice.child])
  ).entries()]
    .map(([id, child]) => ({
      id,
      name: `${child?.firstName || ''} ${child?.lastName || ''}`.trim() || t('child', 'Child')
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const childInvoices = selectedChildId
    ? invoices.filter(invoice => invoiceChildId(invoice) === selectedChildId)
    : [];
  const childIds = children.map(child => child.id).join('|');
  const totalPages = Math.ceil(childInvoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = childInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    const selectedInvoiceChildId = invoiceChildId(selected[0]);
    if (selectedInvoiceChildId && selectedInvoiceChildId !== selectedChildId) {
      setSelectedChildId(selectedInvoiceChildId);
    }
  }, [selected, selectedChildId]);

  useEffect(() => {
    if (children.length && !children.some(child => child.id === selectedChildId)) {
      setSelectedChildId(children[0].id);
      setCurrentPage(1);
    }
  }, [childIds, selectedChildId]);

  const toggleInvoice = (inv) =>
    setSelected(selected.some(s => s._id === inv._id) ? [] : [inv]);

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
          {!invoiceLoadError && invoices.length > 0 && (
            <div className="mb-4">
              <label htmlFor="payment-child-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('selectChildLabel', 'Select Child')}
              </label>
              <select
                id="payment-child-select"
                value={selectedChildId}
                onChange={event => {
                  setSelectedChildId(event.target.value);
                  setCurrentPage(1);
                  setSelected([]);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#00A884] focus:ring-2 focus:ring-[#00A884]/20"
              >
                <option value="">{t('selectChild', 'Select Child')}</option>
                {children.map(child => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </div>
          )}
          {invoiceLoadError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-6 text-center">
              <i className="bx bx-error-circle text-3xl text-rose-500" />
              <p className="mt-2 font-semibold text-rose-800">Invoices could not be loaded</p>
              <p className="mt-1 text-sm text-rose-700">{invoiceLoadError}</p>
              <button
                type="button"
                onClick={onRetryInvoices}
                className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          ) : invoices.length === 0 ? (
            /* Empty state INSIDE the card — stepper still visible above */
            <div className="text-center py-10">
              <i className="bx bx-check-shield text-5xl text-emerald-400 block mb-3" />
              <p className="font-bold text-slate-700 text-base">
                {t('youHaveNoOutstandingInvoices', 'You have no outstanding invoices at this time.')}
              </p>
              <p className="text-slate-400 text-sm mt-1 mb-5">
                {hasPaidInvoices
                  ? 'You can review previously paid invoices in Receipt History.'
                  : t('contactDaycareForInvoice', 'Contact the daycare if you expected an invoice.')}
              </p>
              {!hasPaidInvoices && (
                <p className="mx-auto -mt-3 mb-5 max-w-lg text-xs text-slate-500">
                  {t('invoiceGenerationHelp', 'Invoices are created by daycare administrators in Payments for children linked to your account. No invoice is created automatically.')}
                </p>
              )}
              {hasPaidInvoices && (
                <button
                  type="button"
                  onClick={onViewReceipts}
                  className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[#00A884] px-4 py-2 text-sm font-semibold text-[#00A884] hover:bg-[#00A884]/5"
                >
                  <i className="bx bx-receipt" /> {t('receiptsHistory', 'Receipt History')}
                </button>
              )}
              {onGenerateTest && testInvoiceState === 'available' && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-slate-500">Sandbox test invoice only; it creates a real record in this non-production database.</p>
                  <button onClick={onGenerateTest} disabled={generatingTestInvoice}
                    aria-busy={generatingTestInvoice}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-[#00A884] text-[#00A884] text-sm font-semibold hover:bg-[#00A884]/5 transition">
                    <i className={`bx ${generatingTestInvoice ? 'bx-loader-alt animate-spin' : 'bx-plus-circle'} text-lg`} />
                    {generatingTestInvoice ? t('generating', 'Generating...') : t('generateTestInvoice', 'Generate Test Invoice')}
                  </button>
                </div>
              )}
              {onGenerateTest && testInvoiceState === 'already-issued' && (
                <p role="status" className="mx-auto mt-4 max-w-lg text-xs text-amber-700">
                  A sandbox test invoice has already been issued for each active child. None is currently payable; no duplicate was created. Contact the daycare administrator if you expected a balance.
                </p>
              )}
              {onGenerateTest && testInvoiceState === 'no-active-children' && (
                <p role="status" className="mx-auto mt-4 max-w-lg text-xs text-amber-700">
                  No active child is linked to this parent account. Contact the daycare administrator to update the child link.
                </p>
              )}
            </div>
          ) : (
            <>
              {!selectedChildId ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  {t('selectChildToViewInvoices', 'Select a child to view their outstanding invoices.')}
                </p>
              ) : childInvoices.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  {t('youHaveNoOutstandingInvoices', 'This child has no outstanding invoices.')}
                </p>
              ) : (
                <>
                  <p className="text-xs text-[#00A884] mb-3">{t('chooseInvoiceToPay', 'Choose one invoice to pay.')}</p>
                  {paginatedInvoices.map(inv => <InvoiceCard key={inv._id} invoice={inv} isSelected={selected.some(s => s._id === inv._id)} onToggle={toggleInvoice} />)}
                  {childInvoices.length > ITEMS_PER_PAGE && (
                    <div className="pt-2">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={childInvoices.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        itemLabel={t('invoices', 'invoices')}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-start gap-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-5 py-4">
        <i className="bx bx-shield-alt-2 text-[#00A884] dark:text-emerald-400 text-xl flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-200"><span className="font-bold text-slate-800 dark:text-white block mb-0.5">{t('yourPaymentIsSecure', 'Your payment is secure')}</span>{t('paymentCheckoutHelp', 'Choose an available payment method during checkout. Chapa payments are verified online; bank transfers remain unpaid until an administrator confirms them.')}</p>
      </div>
      <div className="flex items-center justify-between pt-1">
        {!embedded ? <button onClick={onBack} className="px-6 py-3 rounded-2xl border-2 border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">{t('cancel', 'Cancel')}</button> : <div />}
        <button onClick={onContinue} disabled={Boolean(invoiceLoadError) || selected.length !== 1}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-50 hover:-translate-y-0.5 shadow-lg shadow-[#00A884]/30 transition-all"
          style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}>
          <i className="bx bx-right-arrow-alt text-base" /> {t('continueToPaymentMethod', 'Continue to Payment Method')}
        </button>
      </div>
    </div>
  );
};

const InvoiceConfirmation = ({ invoice, onBack, onContinue }) => {
  const { t } = useLanguage();
  const childName = `${invoice?.child?.firstName || ''} ${invoice?.child?.lastName || ''}`.trim();

  if (!invoice) return null;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{t('confirmPaymentDetails', 'Confirm Payment Details')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('reviewPaymentDetails', 'Review your payment details before proceeding')}</p>
      </div>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {[
          [t('invoiceNumber', 'Invoice Number'), invoice.invoiceNumber],
          [t('childName', 'Child'), childName || t('child', 'Child')],
          [t('description', 'Description'), invoice.notes || invoice.type?.replace(/-/g, ' ') || t('invoice', 'Invoice')],
          [t('dueDate', 'Due Date'), fmtDate(invoice.dueDate)],
          [t('paymentStatus', 'Payment Status'), invoice.status === 'overdue' ? t('overdue', 'Overdue') : t('pending', 'Pending')]
        ].map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2 px-4 py-4 text-base">
          <dt className="font-bold text-slate-800">{t('totalAmount', 'Total Amount')}</dt>
          <dd className="font-extrabold text-[#00A884]">{fmtCurrency(outstandingFor(invoice), invoice.currency)}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="rounded-xl border-2 border-slate-300 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          {t('backBtn', 'Back')}
        </button>
        <button type="button" onClick={onContinue} className="rounded-xl bg-[#00A884] px-6 py-3 text-sm font-bold text-white hover:bg-[#00845F]">
          {t('continue', 'Continue')} <i className="bx bx-right-arrow-alt" />
        </button>
      </div>
    </section>
  );
};

/* ── STEP 3: Payment Method ────────────────────────── */
const Step2 = ({
  selected,
  onContinue,
  onBack,
  selectedMethod,
  setSelectedMethod,
  preparing,
  userPhone,
  onPhoneChange,
  chapaAvailable,
  manualBankTransfer,
  bankTransferSettingsError,
  settingsLoading,
  settingsError,
  isFreeMode,
  retryingChapa,
  credentialRejected
}) => {
  const { t } = useLanguage();
  const [phoneError, setPhoneError] = useState('');
  const [phone, setPhone] = useState(userPhone || '');
  const methods = [
    ...(chapaAvailable ? [{
      id: 'chapa',
      label: 'Chapa hosted checkout',
      icon: '💳',
      description: 'Pay through Chapa. Available payment methods are shown by Chapa for your merchant account.',
    }] : []),
    ...(manualBankTransfer?.available ? [{
      id: 'bank-transfer',
      label: `Manual bank transfer · ${manualBankTransfer.bankName}`,
      icon: '🏦',
      description: 'Submit your bank transaction reference. The invoice stays unpaid until an administrator verifies the deposit.',
    }] : [])
  ];

  const handleContinue = () => {
    if (selectedMethod === 'bank-transfer' && manualBankTransfer?.available) {
      setPhoneError('');
      onContinue('bank-transfer');
      return;
    }
    if (!chapaAvailable || selectedMethod !== 'chapa') return;
    const normalizedPhone = phone.trim().replace(/\s+/g, '');
    if (normalizedPhone && !/^(?:(?:\+251|251|0)[97]\d{8})$/.test(normalizedPhone)) {
      setPhoneError('Enter a valid Ethiopian phone number (09xxxxxxxx, 07xxxxxxxx, or +251...).');
      return;
    }
    setPhoneError('');
    onPhoneChange(normalizedPhone);
    onContinue(normalizedPhone, retryingChapa);
  };

  return (
  <div className="space-y-5">
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">{t('paymentMethodTitle', 'Payment Method')}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{t('selectYourPaymentMethod', 'Select your payment method')}</p>
      </div>
      <div className="p-6 space-y-4">
        {methods.map(method => (
          <button
            key={method.id}
            type="button"
            onClick={() => setSelectedMethod(method.id)}
            aria-pressed={selectedMethod === method.id}
            className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${
              selectedMethod === method.id
                ? 'border-[#00A884] bg-[#00A884]/5 shadow-md cursor-pointer'
                : 'border-slate-200 bg-white hover:border-[#00A884]/40 hover:shadow-sm cursor-pointer'
            }`}
          >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#00A884]/10 text-[#00A884] text-2xl">
                  {method.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-extrabold text-slate-800">{method.label}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{method.description}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  selectedMethod === method.id ? 'border-[#00A884] bg-[#00A884]' : 'border-slate-300 bg-white'
                }`}>
                  {selectedMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                </div>
              </div>
          </button>
        ))}
        {settingsLoading && (
          <p role="status" className="text-sm text-slate-500">Checking Chapa availability…</p>
        )}
        {!settingsLoading && settingsError && (
          <p role="alert" className="text-sm text-rose-600">{settingsError}</p>
        )}
        {!settingsLoading && bankTransferSettingsError && (
          <p role="alert" className="text-sm text-rose-600">{bankTransferSettingsError}</p>
        )}
        {!settingsLoading && !settingsError && !chapaAvailable && !manualBankTransfer?.available && (
          <p role="status" className="text-sm text-amber-700">
            {isFreeMode
              ? 'Online payments are disabled by the daycare administrator.'
              : 'Chapa checkout is not configured. Please contact the daycare administrator.'}
          </p>
        )}
        {retryingChapa && (
          <p role="status" className="text-sm text-amber-700">
            The previous attempt remains in your payment history. {credentialRejected
              ? 'Chapa rejected the server credentials. Ask the administrator to replace CHAPA_SECRET_KEY and restart the backend, then select Try Payment Again to retry with a fresh transaction reference.'
              : 'Try Payment Again checks the previous attempt, prepares a fresh reference, and redirects to Chapa if checkout initialization succeeds.'}
          </p>
        )}
      </div>
    </div>
    {selected[0] && (
      <div className="rounded-2xl border border-[#00A884]/20 bg-[#00A884]/5 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected invoice</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-800">{selected[0].invoiceNumber} · {selected[0].child?.firstName} {selected[0].child?.lastName}</p>
            <p className="mt-1 text-xs text-slate-500">{selected[0].notes || selected[0].type?.replace(/-/g, ' ') || 'Invoice'} · {fmtMonth(selected[0].billingPeriodStart || selected[0].dueDate)}</p>
          </div>
          <p className="text-xl font-extrabold text-[#00A884]">{fmtCurrency(outstandingFor(selected[0]), selected[0].currency)}</p>
        </div>
        <p className="mt-3 text-xs text-slate-500">Continue to securely prepare this invoice for Chapa checkout. The invoice amount is confirmed by the server.</p>
      </div>
    )}
    {selectedMethod === 'chapa' && <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <label htmlFor="chapa-phone" className="block text-sm font-bold text-slate-800">
        Phone number <span className="font-normal text-slate-500">(optional)</span>
      </label>
      <input
        id="chapa-phone"
        type="tel"
        value={phone}
        onChange={event => {
          setPhone(event.target.value);
          setPhoneError('');
        }}
        placeholder="09xxxxxxxx or +251912345678"
        aria-invalid={Boolean(phoneError)}
        aria-describedby={phoneError ? 'chapa-phone-error' : undefined}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 focus:border-[#00A884] focus:outline-none focus:ring-2 focus:ring-[#00A884]/20"
      />
      {phoneError && <p id="chapa-phone-error" role="alert" className="mt-2 text-xs text-rose-600">{phoneError}</p>}
    </div>}
    <div className="flex items-center justify-between pt-1">
      <button onClick={onBack} className="px-6 py-3 rounded-2xl border-2 border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">← {t('backBtn', 'Back')}</button>
      <button
        onClick={handleContinue}
        disabled={!selectedMethod || selected.length !== 1 || preparing ||
          (selectedMethod === 'chapa' && !chapaAvailable) ||
          (selectedMethod === 'bank-transfer' && !manualBankTransfer?.available)}
        className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-50 hover:-translate-y-0.5 shadow-lg shadow-[#00A884]/30 transition-all"
        style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}
      >
        {preparing ? <><i className="bx bx-loader-alt animate-spin" /> Preparing…</> : <><i className="bx bx-right-arrow-alt text-base" /> {retryingChapa && selectedMethod === 'chapa' ? 'Try Payment Again' : t('continueToReview', 'Continue to Review')}</>}
      </button>
    </div>
  </div>
  );
};

/* ── STEP 4: Complete Payment ──────────────────────── */
const Step3 = ({
  selected,
  paying,
  onPay,
  onBack,
  selectedMethod,
  checkoutPhone,
  isFreeMode,
  settingsLoading,
  settingsError,
  chapaConfigured,
  chapaEnvironment,
  preparedTxRef,
  paymentProgressStatus,
  onCheckStatus,
  onRefreshSettings,
  manualBankTransfer,
  bankTransferProviderReference,
  onBankTransferProviderReferenceChange,
  onCheckBankTransferStatus
}) => {
  const { t } = useLanguage();
  const total = selected.reduce((sum, invoice) => sum + outstandingFor(invoice), 0);
  const methodLabel = selectedMethod === 'chapa' ? 'Chapa' : t('manualBankTransfer', 'Manual bank transfer');
  const paymentStatus = paymentProgressStatus || 'pending';
  const paymentStatusMessage = selectedMethod === 'bank-transfer' && paymentStatus === 'pending_verification'
    ? 'Pending Verification. The invoice remains unpaid until an administrator confirms the transfer against the daycare bank records.'
    : paymentStatus === 'pending'
    ? 'Payment is pending. Checkout has not been submitted yet; no payment is recorded until Chapa confirms it with the backend.'
    : paymentStatus === 'processing'
      ? 'Chapa is processing this transaction. The invoice remains unpaid until backend verification succeeds.'
      : ['failed', 'cancelled', 'expired'].includes(paymentStatus)
        ? `This checkout attempt ended as ${paymentStatus}. The invoice remains unpaid; prepare a new checkout before retrying.`
      : `Chapa reports this transaction as ${paymentStatus}. The invoice has not been marked paid.`;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{t('completePayment', 'Complete Payment')}</h2>
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
                  <p className="text-xs text-slate-400">{inv.invoiceNumber} &bull; {inv.type?.replace(/-/g, ' ') || 'Invoice'} &bull; Billing {fmtMonth(inv.billingPeriodStart || inv.dueDate)}</p>
                </div>
                <p className="text-lg font-extrabold text-[#00A884]">{fmtCurrency(outstandingFor(inv), inv.currency)}</p>
              </div>
            );
          })}
          <div className="rounded-2xl bg-[#00A884]/5 border border-[#00A884]/20 p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Invoice</span><span className="font-bold text-slate-800">{selected[0]?.invoiceNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Currency</span><span className="font-bold text-slate-800">{selected[0]?.currency || 'ETB'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t('paymentMethodTitle', 'Payment Method')}</span><span className="font-bold text-slate-800">{methodLabel}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('processing', 'Processing')}</span><span className="font-semibold text-slate-700">{selectedMethod === 'chapa' ? t('instant', 'Instant') : t('manualReview', 'Manual review')}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-[#00A884]/20 pt-2 mt-2">
              <span className="text-slate-800">{t('totalLabel', 'Total')}</span><span className="text-[#00A884] text-xl">{fmtCurrency(total, selected[0]?.currency)}</span>
            </div>
          </div>
          {preparedTxRef && selectedMethod === 'chapa' && (
            <>
              <div
                role={['failed', 'cancelled', 'expired', 'unverified'].includes(paymentStatus) ? 'alert' : 'status'}
                className={`rounded-xl border px-4 py-3 text-xs ${
                  ['failed', 'cancelled', 'expired', 'unverified'].includes(paymentStatus)
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <p className="font-bold">Payment status: {paymentStatus}</p>
                <p className="mt-1">{paymentStatusMessage}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {selectedMethod === 'bank-transfer' ? 'Transfer reference to include in payment:' : 'Prepared transaction reference:'}{' '}
                  <span className="font-mono">{preparedTxRef}</span>
                </p>
                <button
                  type="button"
                  onClick={selectedMethod === 'bank-transfer' ? onCheckBankTransferStatus : onCheckStatus}
                  className="text-xs font-semibold text-[#00845F] underline"
                >
                  Check payment status
                </button>
              </div>
              {selectedMethod === 'bank-transfer' && manualBankTransfer && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-bold text-slate-800">{manualBankTransfer.bankName}</p>
                  <p>Account name: <span className="font-semibold">{manualBankTransfer.accountName}</span></p>
                  <p>Account number: <span className="font-mono font-semibold">{manualBankTransfer.accountNumber}</span></p>
                  {manualBankTransfer.instructions && <p className="text-slate-600">{manualBankTransfer.instructions}</p>}
                  <label htmlFor="bank-provider-reference" className="block font-semibold text-slate-800">
                    Bank transaction reference
                  </label>
                  <input
                    id="bank-provider-reference"
                    value={bankTransferProviderReference}
                    onChange={event => onBankTransferProviderReferenceChange(event.target.value)}
                    maxLength={100}
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm"
                    placeholder="Reference from your bank receipt"
                    required
                  />
                  <p className="text-xs text-amber-800">
                    Submitting a reference does not confirm payment. An administrator will verify receipt of funds.
                  </p>
                </div>
              )}
            </>
          )}
          
          {selectedMethod === 'chapa' && checkoutPhone && (
            <p className="text-xs text-slate-500">Checkout phone: <span className="font-medium text-slate-700">{checkoutPhone}</span></p>
          )}

          <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-4 py-3">
            <i className="bx bx-lock-alt text-[#00A884] dark:text-emerald-400 text-base flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300">{selectedMethod === 'chapa'
              ? t('redirectedToChapa', "You will be redirected to Chapa's secure checkout page to complete your payment.")
              : 'This payment method requires manual confirmation by the daycare team before it is marked as paid.'}
            </p>
          </div>
          {settingsLoading && (
            <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              Checking payment availability…
            </div>
          )}
          {!settingsLoading && settingsError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {settingsError}{' '}
              <button type="button" onClick={onRefreshSettings} className="font-bold underline">Retry</button>
            </div>
          )}
          {!settingsLoading && !settingsError && isFreeMode && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Online payments are disabled. You can review the invoice, but checkout is unavailable until the daycare administrator enables payments.
            </div>
          )}
          {!settingsLoading && !settingsError && !isFreeMode && !chapaConfigured && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              Chapa checkout is not configured on the daycare server. Please contact the administrator.
            </div>
          )}
          {!settingsLoading && chapaConfigured && chapaEnvironment === 'test' && (
            <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
              This checkout is set to use Chapa test mode. Chapa validates the server credentials when checkout is initialized; no payment is made unless Chapa returns a valid hosted checkout.
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button onClick={onBack} className="px-6 py-3 rounded-2xl border-2 border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">← {t('backBtn', 'Back')}</button>
        <button onClick={() => onPay()} disabled={paying || settingsLoading || !!settingsError ||
          (selectedMethod === 'chapa' && (isFreeMode || !chapaConfigured)) ||
          (selectedMethod === 'bank-transfer' && (!manualBankTransfer?.available || !bankTransferProviderReference.trim())) ||
          selected.length !== 1 || !preparedTxRef}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-60 hover:-translate-y-0.5 shadow-lg shadow-[#00A884]/30 transition-all"
          style={{ background: 'linear-gradient(135deg,#00A884,#00C49A)' }}>
          {paying ? <><i className="bx bx-loader-alt animate-spin" /> {t('processingProcessing', 'Processing...')}</> : <><i className="bx bx-lock-alt text-base" /> {selectedMethod === 'chapa' ? t('payNowViaChapa', 'Pay Now via Chapa') : 'Submit transfer for verification'}</>}
        </button>
      </div>
    </div>
  );
};

/* ── MAIN COMPONENT ────────────────────────────────── */
const MakePayment = ({ embedded = false }) => {
  const { user }   = useAuth();
  const { t }      = useLanguage();
  const {
    isFreeMode,
    loading: settingsLoading,
    settingsError,
    chapaConfigured,
    onlinePaymentsDisabledReason,
    chapaEnvironment,
    testInvoiceEnabled,
    refreshSettings
  } = useSettings();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [step,     setStep]     = useState(1);
  const [invoices, setInvoices] = useState([]);
  const [hasPaidInvoices, setHasPaidInvoices] = useState(false);
  const [testInvoiceState, setTestInvoiceState] = useState('');
  const [selected, setSelected] = useState([]);
  const [preparedTxRef, setPreparedTxRef] = useState('');
  const [bankTransferProviderReference, setBankTransferProviderReference] = useState('');
  const [manualBankTransfer, setManualBankTransfer] = useState({ available: false });
  const [bankTransferSettingsError, setBankTransferSettingsError] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState(user?.phone || '');
  const [preparing, setPreparing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('chapa');
  const [loading,  setLoading]  = useState(true);
  const [invoiceLoadError, setInvoiceLoadError] = useState('');
  const [invoiceReload, setInvoiceReload] = useState(0);
  const [paying,   setPaying]   = useState(false);
  const [paymentProgressStatus, setPaymentProgressStatus] = useState('');
  const [chapaCredentialRejected, setChapaCredentialRejected] = useState(false);
  const [generatingTestInvoice, setGeneratingTestInvoice] = useState(false);
  const payingRef = useRef(false);
  const preparingRef = useRef(false);
  const [error,    setError]    = useState('');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const selectionStorageKey = user?._id ? `daycare-payment-invoice:${user._id}` : null;
  const progressStorageKey = invoiceId =>
    selectionStorageKey && invoiceId ? `${selectionStorageKey}:step:${invoiceId}` : null;

  useEffect(() => {
    let active = true;
    if (user?.role !== 'parent') {
      setManualBankTransfer({ available: false });
      return () => { active = false; };
    }
    api.get('/settings/payment-methods')
      .then(response => {
        if (!active) return;
        const config = response.data?.data?.manualBankTransfer;
        if (response.data?.success !== true || typeof config?.available !== 'boolean') {
          throw new Error('Payment method configuration response was invalid.');
        }
        setManualBankTransfer(config);
        setBankTransferSettingsError('');
      })
      .catch(error => {
        if (!active) return;
        setManualBankTransfer({ available: false });
        setBankTransferSettingsError(error.response?.data?.message || error.message || 'Could not load configured bank transfer details.');
      });
    return () => { active = false; };
  }, [user?.role]);

  const confirmInvoiceSelection = () => {
    const invoice = selected.length === 1 ? selected[0] : null;
    const validInvoice = invoice &&
      ['pending', 'overdue'].includes(invoice.status) &&
      outstandingFor(invoice) > 0 &&
      invoice.currency === 'ETB';
    if (!validInvoice) {
      setError('Select one eligible unpaid ETB invoice before continuing.');
      return;
    }

    const key = progressStorageKey(invoice._id);
    if (key) sessionStorage.setItem(key, '2');
    setPaymentProgressStatus('');
    setError('');
    setStep(2);
  };

  const continueToPaymentMethod = () => {
    if (selected.length !== 1 || outstandingFor(selected[0]) <= 0) {
      setError('Select one eligible unpaid invoice before choosing a payment method.');
      setStep(1);
      return;
    }
    setError('');
    setStep(3);
  };

  const updateSelectedInvoice = (nextSelected) => {
    const oldInvoiceId = selected[0]?._id;
    if (oldInvoiceId && oldInvoiceId !== nextSelected[0]?._id) {
      const oldProgressKey = progressStorageKey(oldInvoiceId);
      if (oldProgressKey) sessionStorage.removeItem(oldProgressKey);
    }
    setSelected(nextSelected);
    if (new URLSearchParams(location.search).has('invoiceId')) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('invoiceId');
      window.history.replaceState(window.history.state, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
    if (selectionStorageKey) {
      const invoiceId = nextSelected[0]?._id;
      if (invoiceId) sessionStorage.setItem(selectionStorageKey, invoiceId);
      else sessionStorage.removeItem(selectionStorageKey);
    }
    setPreparedTxRef('');
    setPaymentProgressStatus('');
    setChapaCredentialRejected(false);
    setCheckoutPhone(user?.phone || '');
    setError('');
    setStep(1);
  };

  useEffect(() => {
    let active = true;
    const loadInvoices = async () => {
      setLoading(true);
      setInvoiceLoadError('');
      setStep(1);
      setSelected([]);
      setPreparedTxRef('');
      setCheckoutPhone(user?.phone || '');
      try {
        const response = await api.get('/payments/invoices');
        const list = response.data?.data;
        if (response.data?.success !== true || !Array.isArray(list)) {
          throw new Error(response.data?.message || 'The invoice service returned an invalid response. Please retry.');
        }
        if (!active) return;
        setHasPaidInvoices(Boolean(response.data.hasPaidInvoices) && list.length === 0);
        setTestInvoiceState(response.data.testInvoiceState || '');
        setInvoices(list);
        const requestedInvoiceId = new URLSearchParams(location.search).get('invoiceId') ||
          (selectionStorageKey && sessionStorage.getItem(selectionStorageKey));
        const requestedInvoice = list.find(invoice =>
          invoice._id === requestedInvoiceId && outstandingFor(invoice) > 0
        );
        if (requestedInvoice) {
          setSelected([requestedInvoice]);
          if (selectionStorageKey) sessionStorage.setItem(selectionStorageKey, requestedInvoice._id);
          const savedStep = Number(
            sessionStorage.getItem(progressStorageKey(requestedInvoice._id))
          );
          setStep(savedStep === 2 ? 2 : 1);
          try {
            const statusResponse = await api.get(`/payments/${requestedInvoice._id}/status`);
            const payment = statusResponse.data?.data;
            if (statusResponse.data?.success !== true || !payment) {
              throw new Error('The payment status service returned an invalid response.');
            }
            if (
              payment.bankTransferStatus === 'pending_verification' &&
              payment.method === 'bank-transfer'
            ) {
              setSelectedMethod('bank-transfer');
              setPreparedTxRef(payment.bankTransferReference || '');
              setBankTransferProviderReference(payment.bankTransferProviderReference || '');
              setStep(4);
              setPaymentProgressStatus('pending_verification');
            } else if (
              payment.bankTransferStatus === 'rejected' &&
              payment.status !== 'paid'
            ) {
              setSelectedMethod('bank-transfer');
              setStep(3);
              setPaymentProgressStatus('failed');
              setError(payment.bankTransferDecisionNote
                ? `The last bank transfer was rejected: ${payment.bankTransferDecisionNote}`
                : 'The last bank transfer was not verified. You may submit a new transfer after checking the details.');
            } else if (
              payment.bankTransferStatus === 'verified' &&
              payment.status === 'paid' &&
              payment.verifiedAt &&
              payment.receiptNumber
            ) {
              setSelectedMethod('bank-transfer');
              setPreparedTxRef(payment.bankTransferReference || '');
              setStep(4);
              setPaymentProgressStatus('success');
            } else if (
              payment.status === 'paid' &&
              payment.method === 'chapa' &&
              payment.chapaStatus === 'success' &&
              payment.verifiedAt
            ) {
              setPreparedTxRef(payment.chapaTxRef || '');
              setStep(4);
              setPaymentProgressStatus('success');
            } else if (
              ['failed', 'cancelled', 'expired'].includes(payment.chapaStatus) &&
              !payment.chapaInitialized
            ) {
              setPreparedTxRef('');
              setStep(3);
              setPaymentProgressStatus(payment.chapaStatus);
              setError('The previous Chapa checkout did not complete. Continue from Payment Method to prepare a new transaction.');
            } else if (payment.chapaInitialized) {
              setPreparedTxRef(payment.chapaTxRef || '');
              const resultStatus = ['failed', 'cancelled', 'expired'].includes(payment.chapaStatus)
                ? payment.chapaStatus
                : payment.chapaStatus === 'success'
                  ? 'unverified'
                  : payment.chapaStatus || 'pending';
              setStep(['failed', 'cancelled', 'expired'].includes(resultStatus) ? 3 : 4);
              setPaymentProgressStatus(resultStatus);
            } else if (payment.chapaTxRef && payment.chapaAmount > 0) {
              setPreparedTxRef(payment.chapaTxRef);
              setStep(4);
              setPaymentProgressStatus('');
            } else {
              setPreparedTxRef('');
            }
          } catch (statusError) {
            setError(
              statusError.response?.data?.message ||
              statusError.message ||
              'Could not restore this payment status. Refresh and retry before continuing.'
            );
          }
        } else if (selectionStorageKey) {
          sessionStorage.removeItem(selectionStorageKey);
          setPaymentProgressStatus('');
        }
      } catch (loadError) {
        if (!active) return;
        setInvoices([]);
        setHasPaidInvoices(false);
        setTestInvoiceState('');
        setInvoiceLoadError(
          loadError.response?.data?.message ||
          (loadError.response
            ? 'The invoice service could not load your invoices. Please retry.'
            : 'Could not reach the invoice service. Check that the backend is running, then retry.')
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInvoices();
    return () => { active = false; };
  }, [location.search, selectionStorageKey, user?.phone, invoiceReload]);

  const initializeChapaCheckout = async (txRef, phoneNumber = checkoutPhone) => {
    if (settingsLoading || settingsError || !chapaConfigured) {
      setError(settingsError || 'Chapa checkout is currently unavailable. Please contact the daycare administrator.');
      return false;
    }
    if (isFreeMode) {
      setError('Online payments are disabled. Contact the daycare administrator to enable checkout.');
      return false;
    }
    if (selectedMethod !== 'chapa' || !isValidChapaReference(txRef)) {
      setError('Prepare this invoice in the payment method step before initializing checkout.');
      return false;
    }
    if (payingRef.current) return false;

    payingRef.current = true;
    setPaying(true);
    setError('');
    try {
      const response = await api.post(`/payments/${selected[0]._id}/chapa-init`, {
        phone_number: phoneNumber,
        txRef
      });
      if (response.data?.success && response.data?.alreadyPaid && response.data?.txRef) {
        navigate(`/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(response.data.txRef)}`, { replace: true });
      } else if (response.data?.success && response.data?.checkoutUrl && response.data?.txRef === txRef) {
        redirectToChapaCheckout(response.data.checkoutUrl);
      } else {
        throw new Error(response.data?.message || 'Chapa did not provide a valid hosted checkout URL.');
      }
      return true;
    } catch (err) {
      setError(getChapaInitializationError(err));
      const attemptStatus = err.response?.data?.status;
      if (err.response?.data?.code === 'CHAPA_TRANSACTION_PENDING' && err.response?.data?.txRef) {
        navigate(`/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(err.response.data.txRef)}`, { replace: true });
      } else if (err.response?.data?.code === 'CHAPA_CREDENTIALS_REJECTED') {
        setPreparedTxRef('');
        setPaymentProgressStatus('failed');
        setChapaCredentialRejected(true);
        setStep(3);
      } else if (
        ['CHAPA_TRANSACTION_TERMINAL', 'CHAPA_REFERENCE_NOT_FOUND'].includes(err.response?.data?.code)
      ) {
        setPreparedTxRef('');
        setPaymentProgressStatus(attemptStatus || 'expired');
        setError('The previous attempt is terminal and remains recorded. Prepare a fresh checkout before trying again; the invoice is still unpaid.');
        setStep(3);
      } else if (err.response?.data?.code === 'CHAPA_INITIALIZATION_FAILED') {
        setPreparedTxRef('');
        setPaymentProgressStatus('failed');
        setStep(3);
      } else if (
        ['failed', 'cancelled', 'expired'].includes(attemptStatus) ||
        err.response?.data?.code === 'CHAPA_REFERENCE_REJECTED'
      ) {
        setPreparedTxRef('');
        setPaymentProgressStatus(attemptStatus || 'failed');
        setError(`${err.response?.data?.message || 'The previous Chapa checkout did not complete.'} Continue from Payment Method to prepare a new transaction.`);
        setStep(3);
      } else if (err.response?.data?.code === 'CHAPA_CHECKOUT_UNAVAILABLE' && err.response?.data?.txRef) {
        navigate(`/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(err.response.data.txRef)}`, { replace: true });
      }
      return false;
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const prepareCheckout = async (phoneNumber = checkoutPhone, directRetry = false) => {
    if (selected.length === 1 && selectedMethod === 'bank-transfer') {
      if (!manualBankTransfer?.available || settingsLoading || settingsError) {
        setError(settingsError || 'Manual bank transfer is not configured. Contact the daycare administrator.');
        return;
      }
      if (preparingRef.current) return;
      preparingRef.current = true;
      setPreparing(true);
      setError('');
      try {
        const invoice = selected[0];
        const response = await api.post(`/payments/${invoice._id}/bank-transfer/prepare`);
        const intent = response.data;
        if (
          !intent?.success ||
          typeof intent.reference !== 'string' ||
          Number(intent.amount) !== outstandingFor(invoice) ||
          intent.currency !== 'ETB'
        ) {
          throw new Error('The server could not prepare this transfer. Refresh the invoice and retry.');
        }
        setPreparedTxRef(intent.reference);
        setBankTransferProviderReference('');
        setPaymentProgressStatus('');
        setStep(4);
      } catch (prepareError) {
        setError(prepareError.response?.data?.message || prepareError.message || 'Could not prepare bank transfer.');
      } finally {
        preparingRef.current = false;
        setPreparing(false);
      }
      return;
    }
    if (selected.length !== 1 || selectedMethod !== 'chapa') {
      setError('Select one unpaid invoice and Chapa before continuing.');
      return;
    }
    if (isFreeMode || settingsLoading || settingsError || !chapaConfigured) {
      setError(settingsError || 'Chapa checkout is currently unavailable. Please contact the daycare administrator.');
      return;
    }

    if (preparingRef.current) return;
    preparingRef.current = true;
    setPreparing(true);
    setError('');
    setCheckoutPhone(phoneNumber);
    try {
      const invoice = selected[0];
      const response = await api.post(`/payments/${invoice._id}/chapa-prepare`);
      const intent = response.data;
      if (!intent?.success || intent.invoiceId !== invoice._id || !isValidChapaReference(intent.txRef)) {
        throw new Error('The server could not prepare a valid Chapa transaction. Please retry.');
      }
      if (intent.alreadyPaid) {
        navigate(`/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(intent.txRef)}`, { replace: true });
        return;
      }
      if (Number(intent.amount) !== outstandingFor(invoice) || intent.currency !== 'ETB') {
        throw new Error('The invoice amount changed. Refresh invoices before continuing.');
      }
      setPreparedTxRef(intent.txRef);
      setPaymentProgressStatus('');
      setChapaCredentialRejected(false);
      setError('');
      setStep(4);
      if (directRetry) {
        await initializeChapaCheckout(intent.txRef, phoneNumber);
      }
    } catch (prepareError) {
      const code = prepareError.response?.data?.code;
      const txRef = prepareError.response?.data?.txRef;
      if (code === 'CHAPA_TRANSACTION_PENDING' && txRef) {
        navigate(`/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(txRef)}`, { replace: true });
        return;
      }
      setError(prepareError.response?.data?.message || prepareError.message || 'Could not prepare Chapa checkout.');
    } finally {
      preparingRef.current = false;
      setPreparing(false);
    }
  };

  const handlePay = async () => {
    if (selected.length !== 1) {
      setError('Select exactly one invoice before continuing.');
      return;
    }
    if (selectedMethod === 'bank-transfer') {
      if (!manualBankTransfer?.available || !preparedTxRef) {
        setError('Prepare the bank transfer using the configured account details before submitting.');
        setStep(3);
        return;
      }
      const providerReference = bankTransferProviderReference.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,99}$/.test(providerReference)) {
        setError('Enter the bank transaction reference from your transfer receipt.');
        return;
      }
      if (payingRef.current) return;
      payingRef.current = true;
      setPaying(true);
      setError('');
      try {
        const response = await api.post(`/payments/${selected[0]._id}/bank-transfer/submit`, {
          paymentReference: preparedTxRef,
          reference: providerReference
        });
        if (response.data?.success && response.data.status === 'pending_verification') {
          setPaymentProgressStatus('pending_verification');
          setStep(4);
        } else {
          throw new Error(response.data?.message || 'The transfer was not accepted for verification.');
        }
      } catch (submitError) {
        setError(submitError.response?.data?.message || submitError.message || 'Could not submit bank transfer details.');
      } finally {
        payingRef.current = false;
        setPaying(false);
      }
      return;
    }

    if (selectedMethod !== 'chapa') {
      setError('This payment option requires manual confirmation by the daycare admin. Please contact support to complete it.');
      return;
    }
    await initializeChapaCheckout(preparedTxRef, checkoutPhone);
  };

  const checkBankTransferStatus = async () => {
    if (selected.length !== 1) return;
    try {
      const response = await api.get(`/payments/${selected[0]._id}/status`);
      const payment = response.data?.data;
      if (!response.data?.success || !payment) throw new Error('Could not refresh transfer status.');
      if (payment.bankTransferStatus === 'verified' && payment.status === 'paid' && payment.receiptNumber) {
        setPaymentProgressStatus('success');
        setPreparedTxRef(payment.bankTransferReference || preparedTxRef);
      } else if (payment.bankTransferStatus === 'rejected') {
        setPaymentProgressStatus('failed');
        setError('The transfer was not verified. Review the administrator note and submit a new transfer if appropriate.');
      } else {
        setPaymentProgressStatus('pending_verification');
      }
    } catch (statusError) {
      setError(statusError.response?.data?.message || statusError.message || 'Could not refresh transfer status.');
    }
  };

  const generateTestInvoice = async () => {
    if (generatingTestInvoice) return;
    setGeneratingTestInvoice(true);
    setError('');
    try {
      const res = await api.post('/payments/generate-test');
      const createdInvoice = res.data?.data;
      if (!res.data?.success || !createdInvoice?._id) {
        throw new Error(res.data?.message || 'The server did not return a saved test invoice.');
      }

      if (createdInvoice.status === 'paid') {
        if (selectionStorageKey) sessionStorage.removeItem(selectionStorageKey);
        setSelected([]);
        navigate('/dashboard/parent/payments?tab=receipts', { replace: true });
        return;
      }

      const invoiceResponse = await api.get('/payments/invoices');
      const invoiceList = invoiceResponse.data?.data;
      if (invoiceResponse.data?.success !== true || !Array.isArray(invoiceList)) {
        throw new Error('Test invoice was saved, but invoices could not be refreshed. Use Retry to load the saved invoice.');
      }
      const savedInvoice = invoiceList.find(invoice => invoice._id === createdInvoice._id);
      if (!savedInvoice || outstandingFor(savedInvoice) <= 0) {
        setInvoices(invoiceList);
        setInvoiceReload(value => value + 1);
        throw new Error(res.data?.alreadyUsed
          ? 'The existing test invoice is not currently payable. It was not treated as an unpaid invoice.'
          : 'The saved test invoice is not eligible for payment. Refresh invoices or contact the daycare administrator.');
      }

      setInvoices(invoiceList);
      setSelected([savedInvoice]);
      if (selectionStorageKey) sessionStorage.setItem(selectionStorageKey, savedInvoice._id);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate test invoice.');
    } finally {
      setGeneratingTestInvoice(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const wrapper = embedded ? 'space-y-6 pt-2' : 'min-h-screen bg-slate-50 -m-6 px-8 py-8';

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

      <PaymentProgress currentStep={step} resultStatus={paymentProgressStatus} successful={paymentProgressStatus === 'success'} />

      {isFreeMode && !settingsLoading && !settingsError && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <i className="bx bx-gift mt-0.5 text-xl" />
          <p>
            <span className="font-bold">Online payments are disabled.</span>{' '}
            {onlinePaymentsDisabledReason || 'You can view invoices and receipt history. Contact the daycare administrator to enable Chapa checkout.'}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl px-5 py-3.5 text-sm font-medium mb-4">
          <i className="bx bx-error-circle text-xl flex-shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div>
            {step === 1 && <Step1 invoices={invoices} hasPaidInvoices={hasPaidInvoices} testInvoiceState={testInvoiceState} selected={selected} setSelected={updateSelectedInvoice} onContinue={confirmInvoiceSelection} onViewReceipts={() => navigate('/dashboard/parent/payments?tab=receipts')} embedded={embedded} onBack={() => navigate(-1)} onGenerateTest={testInvoiceEnabled ? generateTestInvoice : null} generatingTestInvoice={generatingTestInvoice} invoiceLoadError={invoiceLoadError} onRetryInvoices={() => setInvoiceReload(value => value + 1)} />}
            {step === 2 && <InvoiceConfirmation
              invoice={selected[0]}
              onBack={() => setStep(1)}
              onContinue={continueToPaymentMethod}
            />}
            {step === 3 && <Step2 selected={selected} onContinue={prepareCheckout} preparing={preparing} manualBankTransfer={manualBankTransfer} bankTransferSettingsError={bankTransferSettingsError} retryingChapa={selectedMethod === 'chapa' && ['failed', 'cancelled', 'expired'].includes(paymentProgressStatus)} credentialRejected={chapaCredentialRejected} onBack={() => setStep(2)} selectedMethod={selectedMethod} setSelectedMethod={setSelectedMethod} userPhone={user?.phone || ''} onPhoneChange={setCheckoutPhone} chapaAvailable={!settingsLoading && !settingsError && !isFreeMode && chapaConfigured} settingsLoading={settingsLoading} settingsError={settingsError} isFreeMode={isFreeMode} />}
            {step === 4 &&
              paymentProgressStatus !== 'success' &&
              !(selectedMethod === 'bank-transfer' && paymentProgressStatus === 'pending_verification') && <Step3
              selected={selected}
              paying={paying}
              onPay={handlePay}
              onBack={() => setStep(3)}
              selectedMethod={selectedMethod}
              checkoutPhone={checkoutPhone}
              isFreeMode={isFreeMode}
              settingsLoading={settingsLoading}
              settingsError={settingsError}
              chapaConfigured={chapaConfigured}
              chapaEnvironment={chapaEnvironment}
              preparedTxRef={preparedTxRef}
              paymentProgressStatus={paymentProgressStatus}
              onCheckStatus={() => navigate(`/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(preparedTxRef)}`)}
              onRefreshSettings={refreshSettings}
              manualBankTransfer={manualBankTransfer}
              bankTransferProviderReference={bankTransferProviderReference}
              onBankTransferProviderReferenceChange={setBankTransferProviderReference}
              onCheckBankTransferStatus={checkBankTransferStatus}
            />}
            {step === 4 && (
              paymentProgressStatus === 'success' ||
              (selectedMethod === 'bank-transfer' && paymentProgressStatus === 'pending_verification')
            ) && (
              <section
                className={`rounded-2xl border p-6 shadow-sm ${
                  paymentProgressStatus === 'success'
                    ? 'border-emerald-200 bg-emerald-50'
                    : ['failed', 'expired', 'cancelled', 'unverified'].includes(paymentProgressStatus)
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-sky-200 bg-sky-50'
                }`}
                role={['failed', 'expired', 'cancelled', 'unverified'].includes(paymentProgressStatus) ? 'alert' : 'status'}
              >
                <h2 className="text-lg font-bold text-slate-900">
                  {paymentProgressStatus === 'success'
                    ? 'Payment verified'
                    : paymentProgressStatus === 'pending_verification'
                      ? 'Pending Verification'
                    : paymentProgressStatus === 'cancelled'
                      ? 'Payment cancelled'
                      : ['failed', 'expired'].includes(paymentProgressStatus)
                        ? 'Payment failed'
                        : 'Payment verification pending'}
                </h2>
                <p className="mt-2 text-sm text-slate-700">
                  {paymentProgressStatus === 'success'
                    ? selectedMethod === 'bank-transfer'
                      ? 'An authorized administrator confirmed receipt of funds. Your receipt is available.'
                      : 'Chapa confirmed this payment with the backend. You can view the verified receipt.'
                    : paymentProgressStatus === 'pending_verification'
                      ? 'Your transfer reference was submitted. The invoice is still unpaid while an administrator checks the daycare bank records.'
                    : paymentProgressStatus === 'cancelled'
                      ? 'No payment was recorded. You can start a new checkout when ready.'
                      : ['failed', 'expired'].includes(paymentProgressStatus)
                        ? 'Chapa did not complete this payment. You can check the result or start a new checkout.'
                        : 'The payment is not marked successful. Check with Chapa again to refresh the backend verification result.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {preparedTxRef && selectedMethod === 'bank-transfer' && (
                    <p className="w-full text-sm text-slate-700">
                      Daycare transfer reference: <span className="font-mono font-semibold">{preparedTxRef}</span>
                    </p>
                  )}
                  {selectedMethod === 'bank-transfer' && paymentProgressStatus === 'success' && (
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/parent/payments/success?invoice_id=${encodeURIComponent(selected[0]?._id || '')}`)}
                      className="rounded-xl bg-[#00845F] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      View verified receipt
                    </button>
                  )}
                  {selectedMethod === 'bank-transfer' && paymentProgressStatus === 'pending_verification' && (
                    <button
                      type="button"
                      onClick={checkBankTransferStatus}
                      className="rounded-xl bg-[#00845F] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Check verification status
                    </button>
                  )}
                  {preparedTxRef && selectedMethod === 'chapa' && (
                    <button
                      type="button"
                      onClick={() => navigate(selectedMethod === 'bank-transfer'
                        ? `/dashboard/parent/payments/success?invoice_id=${encodeURIComponent(selected[0]?._id || '')}`
                        : `/dashboard/parent/payments/success?tx_ref=${encodeURIComponent(preparedTxRef)}`)}
                      className="rounded-xl bg-[#00845F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#006B50] focus:outline-none focus:ring-2 focus:ring-[#00845F] focus:ring-offset-2"
                    >
                      {paymentProgressStatus === 'success' ? 'View verified receipt' : 'Check payment status'}
                    </button>
                  )}
                  {['failed', 'expired', 'cancelled'].includes(paymentProgressStatus) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreparedTxRef('');
                        setPaymentProgressStatus('');
                        setStep(3);
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    >
                      Start a new checkout
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
          <SummarySidebar
            selected={selected}
            user={user}
            onContactSupport={() => setIsSupportModalOpen(true)}
            step={step}
            onContinue={
              step === 1 && !invoiceLoadError && selected.length === 1 && outstandingFor(selected[0]) > 0
                ? confirmInvoiceSelection
                : null
            }
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
