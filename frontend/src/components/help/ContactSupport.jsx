import React, { useState } from 'react';
import { Mail, Phone, Clock, MessageCircle, Headphones, Send, Zap, CheckCircle } from 'lucide-react';

const SUPPORT_EMAIL = 'habtamugetachew202@gmail.com';
const SUPPORT_PHONE = '0942306750';

// ── Simple Live Chat Modal ────────────────────────────────────────────────────
const LiveChatModal = ({ onClose }) => {
  const [messages, setMessages] = useState([
    { from: 'agent', text: 'Hi there! 👋 How can I help you today?', time: new Date() },
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    setMessages((prev) => [...prev, { from: 'user', text, time: now }]);
    setInput('');
    // Auto-reply after short delay
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          from: 'agent',
          text: "Thanks for reaching out! A support agent will be with you shortly. In the meantime, feel free to describe your issue in detail.",
          time: new Date(),
        },
      ]);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full sm:w-96 bg-white dark:bg-[#111c2d] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" style={{ maxHeight: '500px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-teal-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-teal-600 rounded-full" />
            </div>
            <div>
              <p className="text-sm font-semibold">Support Team</p>
              <p className="text-[10px] text-teal-200">Online · Avg reply &lt;2 min</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-lg font-bold leading-none">×</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.from === 'user'
                  ? 'bg-teal-600 text-white rounded-br-sm'
                  : 'bg-slate-100 dark:bg-[#162030] text-slate-800 dark:text-slate-200 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-teal-500 text-slate-900 dark:text-white placeholder-slate-400"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ContactSupport = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    });
  };

  const handleSendEmail = () => {
    window.location.href = `mailto:habtamugetachew202@gmail.com?subject=DaycareHQ Support Request`;
  };

  const handleCallSupport = () => {
    window.location.href = `tel:+2510942306750`;
  };

  return (
    <section className="h-full">
      {chatOpen && <LiveChatModal onClose={() => setChatOpen(false)} />}

      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Contact Support</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Our team is here to help you anytime.</p>
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Status bar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-900/40">
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">Support team is online now</p>
          <div className="ml-auto flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-500 bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 rounded-full">
            <Zap className="w-2.5 h-2.5" /> Avg. reply in &lt;2h
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Contact Details */}
          <button
            onClick={handleCopyEmail}
            className="w-full flex items-center gap-3.5 hover:bg-slate-50 dark:hover:bg-[#162030] p-2 -mx-2 rounded-xl transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#162030] flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Email</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {SUPPORT_EMAIL}
              </p>
            </div>
            {emailCopied
              ? <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
              : <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>}
          </button>

          <a
            href="tel:+2510942306750"
            className="flex items-center gap-3.5 hover:bg-slate-50 dark:hover:bg-[#162030] p-2 -mx-2 rounded-xl transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#162030] flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Phone</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {SUPPORT_PHONE}
              </p>
            </div>
          </a>

          <div className="flex items-center gap-3.5 p-2 -mx-2">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#162030] flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Office Hours</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Mon–Fri, 8 AM – 8 PM EST</p>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

          {/* Action Buttons */}
          <button
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-teal-500/20 hover:-translate-y-0.5"
          >
            <MessageCircle className="w-4 h-4" /> Start Live Chat
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCallSupport}
              className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 bg-white dark:bg-transparent hover:bg-teal-50 dark:hover:bg-teal-900/20 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-all"
            >
              <Headphones className="w-3.5 h-3.5" /> Call Support
            </button>
            <button
              onClick={handleSendEmail}
              className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 bg-white dark:bg-transparent hover:bg-teal-50 dark:hover:bg-teal-900/20 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-all"
            >
              <Send className="w-3.5 h-3.5" /> Send Email
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSupport;
