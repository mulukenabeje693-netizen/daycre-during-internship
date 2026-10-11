/**
 * BackendWakeupBanner
 *
 * Shows a dismissible warm-up notice while the Render free-tier
 * backend is waking from sleep. Disappears automatically once awake.
 */
import React from 'react';
import { useBackendWakeup } from '../../hooks/useBackendWakeup';

const BackendWakeupBanner = () => {
  const { awake, waking } = useBackendWakeup();

  if (!waking || awake) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl bg-[#0d1929] border border-[#00ADB5]/30 text-white text-sm font-medium max-w-sm w-[calc(100vw-2rem)]"
      style={{ animation: 'fadeSlideUp 0.3s ease' }}
    >
      {/* Spinner */}
      <div className="w-5 h-5 rounded-full border-2 border-[#00ADB5]/30 border-t-[#00ADB5] animate-spin flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-[#00ADB5] font-semibold leading-tight">Server warming up…</p>
        <p className="text-xs text-slate-400 leading-tight mt-0.5">
          Free-tier backend is starting. Data will load shortly.
        </p>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};

export default BackendWakeupBanner;
