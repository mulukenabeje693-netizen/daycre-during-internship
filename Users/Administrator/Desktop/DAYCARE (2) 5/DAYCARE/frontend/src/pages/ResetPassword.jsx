import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ResetPasswordCard from '../components/auth/ResetPasswordCard';
import PasswordChangedCard from '../components/auth/PasswordChangedCard';

/**
 * ResetPassword page
 * Route: /reset-password?email=...&token=...
 *
 * Reads email + token from URL search params (set by EmailSentCard after OTP verification).
 * Screen 1: ResetPasswordCard  — new password form
 * Screen 2: PasswordChangedCard — success confirmation
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  const [done, setDone] = useState(false);

  // If no token in URL, send back to forgot-password
  if (!token) {
    navigate('/forgot-password', { replace: true });
    return null;
  }

  if (done) {
    return <PasswordChangedCard onGoToLogin={() => navigate('/login', { replace: true })} />;
  }

  return (
    <ResetPasswordCard
      email={email}
      token={token}
      onSuccess={() => setDone(true)}
      onSendNewLink={() => navigate('/forgot-password', { replace: true })}
    />
  );
};

export default ResetPassword;
