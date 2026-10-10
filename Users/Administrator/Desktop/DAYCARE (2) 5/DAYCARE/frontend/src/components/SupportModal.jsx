import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SupportModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent scrolling on body when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subject || !message) return;
    setIsSubmitting(true);
    
    // Simulate API call to POST /api/support/tickets
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      
      // Optionally reset form
      setSubject('');
      setTransactionId('');
      setMessage('');
      
      // Reset success state and close modal after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 3000);
    }, 1500);
  };

  const handleLiveChat = () => {
    onClose();
    navigate('/dashboard/parent/communication');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#00A884]/10 flex items-center justify-center text-[#00A884]">
              <i className="bx bx-headphone text-lg" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Contact Support</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <i className="bx bx-x text-xl" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {isSuccess ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 mx-auto mb-4">
                <i className="bx bx-check text-3xl font-bold" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Ticket Submitted!</h3>
              <p className="text-sm text-slate-500">
                We've received your request and our support team will get back to you shortly.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Direct Contact Info */}
              <div className="bg-[#00A884]/5 border border-[#00A884]/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <i className="bx bx-phone text-[#00A884]" />
                    <span className="font-semibold">+251 91 241 5120</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="bx bx-envelope text-[#00A884]" />
                    <span className="font-semibold">support@daycare.com</span>
                  </div>
                </div>
                <button 
                  onClick={handleLiveChat}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#00A884] text-white text-sm font-semibold rounded-lg shadow-md shadow-[#00A884]/30 hover:bg-teal-600 transition"
                >
                  <i className="bx bx-message-dots" /> Open Direct Chat
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Or Report an Issue</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Subject *</label>
                  <input 
                    type="text" 
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Payment issue, Transaction failure"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00A884] focus:ring-1 focus:ring-[#00A884] transition"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Transaction ID / Invoice Number (Optional)</label>
                  <input 
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g., TX-12345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00A884] focus:ring-1 focus:ring-[#00A884] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message *</label>
                  <textarea 
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00A884] focus:ring-1 focus:ring-[#00A884] transition resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={isSubmitting || !subject || !message}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-50 transition"
                  >
                    {isSubmitting ? (
                      <><i className="bx bx-loader-alt animate-spin" /> Submitting...</>
                    ) : (
                      <><i className="bx bx-send" /> Submit Ticket</>
                    )}
                  </button>
                  {/* Inline comment for Backend connection point */}
                  {/* TODO: Connect this to Socket.IO or Push notification service to notify admins of a new ticket */}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportModal;
