import React from 'react';
import { MessageCircle, Phone, Star } from 'lucide-react';

const SUPPORT_PHONE = '+2510942306750';

const ImmediateHelpBanner = ({ onOpenChat }) => {
  return (
    <section>
      <div className="relative bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 dark:from-[#040810] dark:via-teal-950 dark:to-[#040810] rounded-3xl overflow-hidden p-8 md:p-12 shadow-2xl">
        {/* Decorative orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          {/* Icon */}
          <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-900/50">
            <MessageCircle className="w-12 h-12 md:w-16 md:h-16 text-white opacity-90" />
          </div>

          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 text-teal-400 text-xs font-semibold mb-3 bg-teal-400/10 px-3 py-1 rounded-full border border-teal-400/20">
              <Star className="w-3 h-3 fill-teal-400" /> Available 24/7
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">Need Immediate Help?</h2>
            <p className="text-teal-200/80 text-sm leading-relaxed max-w-lg">
              Our support team is available around the clock to assist you with any questions, technical issues, or urgent requests.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 flex-shrink-0 w-full md:w-auto">
            <button
              onClick={onOpenChat}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-teal-900/50 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" /> Start Live Chat
            </button>
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all border border-white/20 hover:border-white/40 backdrop-blur-sm whitespace-nowrap"
            >
              <Phone className="w-4 h-4" /> Call Support
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ImmediateHelpBanner;
