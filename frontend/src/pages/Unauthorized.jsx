import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoBack = () => {
    if (user) {
      navigate(`/dashboard/${user.role}`);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-app px-4">
      <div className="text-center glass p-10 rounded-[28px] max-w-[480px] shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        <div className="w-20 h-20 bg-[rgba(240,79,95,0.12)] text-danger rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="bx bx-shield-quarter text-5xl"></i>
        </div>
        <h1 className="text-2xl font-extrabold text-primary tracking-tight mb-2">Access Denied</h1>
        <p className="text-muted font-medium mb-8">
          You do not have the required permissions to view this dashboard page.
        </p>
        <button
          onClick={handleGoBack}
          className="px-6 py-3 btn-primary rounded-xl transition-all duration-200"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
