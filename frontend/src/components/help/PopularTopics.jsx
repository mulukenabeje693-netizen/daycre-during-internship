import React from 'react';
import {
  Rocket, ClipboardCheck, FileText, LayoutGrid,
  Baby, MessageCircle, Bell, ShieldCheck, ArrowRight, SearchX
} from 'lucide-react';

const topics = [
  { icon: Rocket,         title: 'Getting Started',       desc: 'Learn the basics and set up your account quickly.',              keywords: ['start', 'setup', 'begin', 'new'],                  anchor: '#getting-started' },
  { icon: ClipboardCheck, title: 'Managing Attendance',   desc: 'How to record, edit and export attendance data.',               keywords: ['attendance', 'record', 'present', 'absent'],       anchor: '#attendance' },
  { icon: FileText,       title: 'Daily Reports',         desc: 'Create, submit, and review child daily reports.',               keywords: ['report', 'daily', 'activities', 'meals'],          anchor: '#daily-reports' },
  { icon: LayoutGrid,     title: 'Classroom Management',  desc: 'Organize rooms, assign teachers, and track capacity.',          keywords: ['classroom', 'room', 'teacher', 'capacity'],        anchor: '#classroom' },
  { icon: Baby,           title: 'Child Profiles',        desc: 'Add and manage individual child records and history.',          keywords: ['child', 'profile', 'enrollment', 'kid'],           anchor: '#children' },
  { icon: MessageCircle,  title: 'Parent Communication',  desc: 'Send messages, announcements, and notifications.',             keywords: ['message', 'parent', 'communication', 'chat'],      anchor: '#communication' },
  { icon: Bell,           title: 'Notifications',         desc: 'Configure alerts, push notifications, and reminders.',         keywords: ['notification', 'alert', 'reminder', 'push'],       anchor: '#notifications' },
  { icon: ShieldCheck,    title: 'Account & Security',    desc: 'Manage passwords, 2FA, and privacy settings.',                 keywords: ['security', 'password', '2fa', 'privacy', 'login'], anchor: '#security' },
];

const PopularTopics = ({ search = '' }) => {
  const q = search.toLowerCase().trim();
  const filtered = q
    ? topics.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          t.keywords.some((k) => k.includes(q))
      )
    : topics;

  const handleTopicClick = (topic) => {
    // Scroll to FAQ section and open relevant answer
    const faqSection = document.getElementById('faq-section');
    if (faqSection) {
      faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (q && filtered.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Popular Help Topics</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {q ? `${filtered.length} topic${filtered.length !== 1 ? 's' : ''} matching "${search}"` : 'Jump straight to the most common guides.'}
          </p>
        </div>
        {!q && (
          <button className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline hidden sm:flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((topic) => {
          const Icon = topic.icon;
          return (
            <button
              key={topic.title}
              onClick={() => handleTopicClick(topic)}
              className="group bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-300 text-left"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${topic.color || 'from-teal-500 to-teal-600'} flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{topic.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{topic.desc}</p>
              <div className="flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 group-hover:gap-2 transition-all">
                View Guide <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

// attach colors back
const COLORS = [
  'from-violet-500 to-purple-600', 'from-teal-500 to-emerald-600',
  'from-sky-500 to-blue-600',      'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',     'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-purple-600','from-slate-600 to-slate-700',
];
topics.forEach((t, i) => { t.color = COLORS[i]; });

export default PopularTopics;
