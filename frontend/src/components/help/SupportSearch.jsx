import React, { useEffect, useRef } from 'react';
import { Search, Sparkles, X } from 'lucide-react';

const SupportSearch = ({ search, setSearch }) => {
  const inputRef = useRef(null);

  // Focus on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcut: '/' to focus
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative bg-gradient-to-br from-teal-600 to-teal-700 dark:from-teal-800 dark:to-teal-900 rounded-3xl p-8 md:p-12 overflow-hidden shadow-xl shadow-teal-500/20">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 border border-white/20">
          <Sparkles className="w-3.5 h-3.5" />
          Search over 200+ help articles
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
          How can we help you?
        </h2>
        <p className="text-teal-100 text-sm mb-7">
          Search articles, features, or common questions to find instant answers.
        </p>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search articles, features, or questions… (press "/" to focus)'
            className="w-full pl-12 pr-12 py-4 bg-white dark:bg-[#111c2d] text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl text-sm shadow-xl shadow-black/10 focus:ring-2 focus:ring-teal-500/40 focus:outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {search && (
          <p className="text-teal-200 text-xs mt-3">
            Showing results for: <span className="font-semibold">"{search}"</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default SupportSearch;
