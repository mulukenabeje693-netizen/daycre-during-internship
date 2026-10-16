import { useLanguage } from '../../context/useLanguage';

const STEPS = [
  { n: 1, label: 'selectInvoice' },
  { n: 2, label: 'confirmPaymentDetails' },
  { n: 3, label: 'paymentMethodTitle' },
  { n: 4, label: 'completePayment' },
];

const STATUS_MESSAGES = {
  pending: 'Payment verification is pending with Chapa. This step completes only after backend confirmation.',
  processing: 'Chapa is processing this payment. We will show success only after backend verification.',
  failed: 'This payment attempt failed or was rejected. No successful payment has been recorded.',
  expired: 'This Chapa checkout has expired. No successful payment has been recorded.',
  cancelled: 'This payment was cancelled. No successful payment has been recorded.',
  unverified: 'This payment could not be verified. It has not been marked as successful.',
  'verification-delayed': 'Verification requests are temporarily limited. Your invoice remains unpaid until Chapa confirms payment.',
  'verification-error': 'Chapa could not verify this payment right now. Your invoice remains unpaid; retry when the service is available.',
  'authentication-error': 'Sign in with the parent account that started this payment to verify it.',
  'not-found': 'The transaction reference was not found. No payment has been recorded.',
};

const PaymentProgress = ({ currentStep = 1, successful = false, resultStatus = '' }) => {
  const { t } = useLanguage();
  const message = successful
    ? 'Payment verified successfully by Chapa.'
    : STATUS_MESSAGES[resultStatus];
  const isFailure = [
    'failed',
    'expired',
    'cancelled',
    'unverified',
    'verification-delayed',
    'verification-error',
    'authentication-error',
    'not-found',
  ].includes(resultStatus);

  return (
    <div className="payment-progress-container">
      <ol className="payment-progress" aria-label="Payment progress">
        {STEPS.map(({ n, label }, index) => {
          const completed = successful || n < currentStep;
          const active = n === currentStep;
          const failed = active && isFailure;

          return (
            <li
              key={n}
              className={`payment-progress__step${completed ? ' is-complete' : ''}${active ? ' is-active' : ''}${failed ? ' is-failed' : ''}`}
              aria-current={active || (successful && n === 4) ? 'step' : undefined}
            >
              {index < STEPS.length - 1 && (
                <span className="payment-progress__track" aria-hidden="true">
                  <span className={`payment-progress__fill${n < currentStep || successful ? ' is-filled' : ''}`} />
                </span>
              )}
              <span className="payment-progress__circle" aria-hidden="true">
                {completed ? <i className="bx bx-check" /> : n}
              </span>
              <span className="payment-progress__label">{t(label)}</span>
            </li>
          );
        })}
      </ol>
      {message && (
        <p
          className={`payment-progress__status${successful ? ' is-success' : isFailure ? ' is-failure' : ''}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default PaymentProgress;
