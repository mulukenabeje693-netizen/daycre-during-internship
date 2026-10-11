import React from 'react';
import { BookOpen, FileText, Shield, FileCheck, GitBranch, ExternalLink } from 'lucide-react';

const resources = [
  {
    icon: BookOpen,
    label: 'Documentation',
    desc: 'Full technical docs & API reference.',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    href: 'https://github.com',
    external: true,
  },
  {
    icon: FileText,
    label: 'User Guide',
    desc: 'Step-by-step guide for all user roles.',
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    href: null, // scrolls to FAQ
    external: false,
  },
  {
    icon: Shield,
    label: 'Privacy Policy',
    desc: 'How we protect and use your data.',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    href: null,
    external: false,
  },
  {
    icon: FileCheck,
    label: 'Terms of Service',
    desc: 'Your agreement with DaycareHQ.',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    href: null,
    external: false,
  },
  {
    icon: GitBranch,
    label: 'Release Notes',
    desc: 'Latest updates and new features.',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    href: null,
    external: false,
  },
];

const UsefulResources = () => {
  const handleClick = (resource) => {
    if (resource.href && resource.external) {
      window.open(resource.href, '_blank', 'noopener,noreferrer');
      return;
    }
    // For internal links, scroll to the FAQ / ticket section
    const target = document.getElementById('faq-section') || document.querySelector('[data-section="contact"]');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Useful Resources</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Helpful documents and links.</p>
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {resources.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.label}
                onClick={() => handleClick(r)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#162030]/50 transition-colors group text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-9 h-9 rounded-xl ${r.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${r.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {r.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">{r.desc}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UsefulResources;
