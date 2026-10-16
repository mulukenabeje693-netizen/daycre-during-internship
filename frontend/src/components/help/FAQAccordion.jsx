import React, { useState, useMemo } from 'react';
import { ChevronDown, HelpCircle, SearchX } from 'lucide-react';

export const ALL_FAQS = [
  {
    q: 'How do I reset my password?',
    a: "Go to Settings → Security → Change Password. Enter your current password, then your new one. If you've forgotten your password, click \"Forgot Password\" on the login screen and follow the email reset instructions.",
    tags: ['password', 'security', 'login', 'reset'],
  },
  {
    q: 'How do I record attendance?',
    a: 'Navigate to the Attendance section from the left sidebar. Select the date and classroom, then mark each child as Present, Absent, or Late. Changes are saved automatically in real-time.',
    tags: ['attendance', 'record', 'classroom'],
  },
  {
    q: 'How do I submit a daily report?',
    a: 'Go to Daily Reports in the sidebar. Click "New Report", select the child, fill in activities, meals, nap times, and any notes. Click "Submit Report" to notify the parent instantly.',
    tags: ['daily report', 'submit', 'report', 'activities'],
  },
  {
    q: 'How do I contact parents?',
    a: 'Use the Communication page to send direct messages or announcements. Parents receive real-time notifications via the portal and optionally by email or push notification based on their preferences.',
    tags: ['message', 'parent', 'communication', 'notification'],
  },
  {
    q: 'Can I use the portal on mobile?',
    a: 'Yes! DaycareHQ is fully responsive and works beautifully on all mobile browsers. We also offer a Progressive Web App (PWA) that you can install directly from your mobile browser for an app-like experience.',
    tags: ['mobile', 'app', 'phone', 'browser'],
  },
  {
    q: 'How do I enable dark mode?',
    a: 'Go to Settings → Appearance. Select Dark mode. Your preference is saved automatically and persists across page refreshes.',
    tags: ['dark mode', 'appearance', 'theme'],
  },
  {
    q: 'How do I change my language?',
    a: 'Open Settings → Language. Select your preferred language from the dropdown (English, Amharic, Oromiffa, Tigrigna). The entire interface updates immediately.',
    tags: ['language', 'locale', 'amharic', 'translation'],
  },
  {
    q: 'How do I update my profile?',
    a: 'Navigate to Settings → Profile. You can update your name, email, phone number, and profile photo. Click "Save Changes" to apply.',
    tags: ['profile', 'name', 'email', 'photo', 'avatar'],
  },
  {
    q: 'How do I add a child to the system?',
    a: 'Go to the Children section and click "Add Child". Fill in the child\'s details including name, date of birth, parent/guardian information, and any medical notes. The parent will be notified upon approval.',
    tags: ['child', 'add', 'register', 'enrollment'],
  },
  {
    q: 'How do I make a payment?',
    a: 'Navigate to the Payments section from the sidebar. You can view outstanding invoices and pay securely via card or other available methods. Payment receipts are emailed automatically.',
    tags: ['payment', 'invoice', 'billing', 'fee'],
  },
];

const FAQAccordion = ({ search = '' }) => {
  const [open, setOpen] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return ALL_FAQS;
    return ALL_FAQS.filter(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        f.tags.some((t) => t.includes(q))
    );
  }, [search]);

  // Reset open when filter changes
  React.useEffect(() => setOpen(null), [search]);

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"` : 'Quick answers to common questions.'}
        </p>
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <SearchX className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No results found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Try a different keyword or{' '}
              <span className="text-teal-600 dark:text-teal-400 font-medium">submit a support ticket</span> below.
            </p>
          </div>
        ) : (
          filtered.map((faq, i) => (
            <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-[#162030]/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className={`w-4 h-4 flex-shrink-0 transition-colors ${open === i ? 'text-teal-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-teal-400'}`} />
                  <span className={`text-sm font-medium transition-colors ${open === i ? 'text-teal-700 dark:text-teal-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {faq.q}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-300 ${open === i ? 'rotate-180 text-teal-500' : ''}`} />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-5 pb-5 pl-12">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default FAQAccordion;
