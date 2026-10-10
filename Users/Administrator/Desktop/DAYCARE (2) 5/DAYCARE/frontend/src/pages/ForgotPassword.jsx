import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ForgotPasswordCard from '../components/auth/ForgotPasswordCard';
import EmailSentCard from '../components/auth/EmailSentCard';
import ResetPasswordCard from '../components/auth/ResetPasswordCard';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [screen, setScreen] = useState(token ? 'reset' : 'forgot');
  const [email, setEmail] = useState('');
  const [initialOtp, setInitialOtp] = useState(null);

  if (screen === 'reset') {
    return (
      <ResetPasswordCard
        token={token}
        onSuccess={() => navigate('/login?reset=success')}
        onSendNewLink={() => setScreen('forgot')}
      />
    );
  }

  if (screen === 'sent') {
    return (
      <EmailSentCard
        email={email}
        initialOtp={initialOtp}
        onBackToLogin={() => navigate('/login')}
      />
    );
  }

  return (
    <ForgotPasswordCard
      onBackToLogin={() => navigate('/login')}
      onEmailSent={(submittedEmail, otp) => {
        setEmail(submittedEmail);
        setInitialOtp(otp || null);
        setScreen('sent');
      }}
    />
  );
};

export default ForgotPassword;

