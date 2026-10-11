import React from 'react';

const LoadingFallback = ({ fullPage = false, message = 'Loading...' }) => {
  if (fullPage) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0d1520] text-white p-4">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-3 border-teal-500/20 border-t-teal-400 animate-spin" />
          <div
            className="absolute w-7 h-7 rounded-full border-2 border-teal-300/30 border-b-teal-300 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}
          />
        </div>
        <p className="mt-4 text-xs tracking-wider uppercase text-teal-300/80 font-medium animate-pulse">
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full py-16 flex flex-col items-center justify-center">
      <div className="w-9 h-9 rounded-full border-3 border-teal-500/20 border-t-teal-400 animate-spin" />
      <span className="mt-3 text-xs text-slate-400 font-medium">{message}</span>
    </div>
  );
};

export default LoadingFallback;
