import React, { useEffect, useState } from 'react';

const Check = ({ done }) => (
  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
    {done ? <i className="bx bx-check"></i> : <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
  </div>
);

const Spinner = () => (
  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200">
    <div className="w-4 h-4 border-2 border-t-emerald-500 border-slate-200 rounded-full animate-spin"></div>
  </div>
);

const ProcessingPayment = ({ summary = {}, primary = null }) => {
  const [progress, setProgress] = useState(35);
  const progressWidth = `${progress}%`;

  useEffect(() => {
    const timer = setInterval(() => setProgress((prev) => Math.min(98, prev + Math.floor(Math.random() * 6 + 2))), 800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-6">
      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-8">
          <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white/80 p-10 shadow-2xl">
            <div className="absolute left-8 top-10 h-16 w-16 rounded-full bg-emerald-100/70 blur-2xl"></div>
            <div className="absolute right-10 top-32 h-10 w-10 rounded-full bg-slate-100/80"></div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="mb-6 inline-flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-[0_30px_60px_rgba(13,148,136,0.12)] animate-bounce">
                <svg width="92" height="92" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2l6 3v4c0 5-3.5 9.7-6 11-2.5-1.3-6-6-6-11V5l6-3z" fill="#0EA5A4" opacity="0.16" />
                  <path d="M12 3.2l4.8 2.4v3.1c0 4.1-2.9 7.9-4.8 9-1.9-1.1-4.8-4.9-4.8-9V5.6L12 3.2z" fill="#059669" />
                  <rect x="8" y="10" width="8" height="5" rx="1" fill="#10B981" />
                  <path d="M10 10v-1a2 2 0 114 0v1" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 mb-2">Processing Your Payment</h2>
              <p className="text-sm text-slate-500 mb-6">Please wait while we securely verify your tuition payment.</p>

              <div className="w-full max-w-2xl">
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 mb-4">
                  <div className="h-3 rounded-full" style={{ width: progressWidth, background: 'linear-gradient(90deg,#0ea5a4,#0891b2)' }}></div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-400"></span>
                    Processing
                  </div>
                  <div>{Math.round(progress)}% complete</div>
                </div>

                <div className="space-y-4 text-left">
                  <div className="flex items-start gap-4">
                    <div className="mt-1"><Check done={true} /></div>
                    <div>
                      <div className="font-semibold">Connecting to Chapa</div>
                      <div className="text-sm text-slate-500">Establishing secure connection</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1"><Check done={true} /></div>
                    <div>
                      <div className="font-semibold">Encrypting Payment</div>
                      <div className="text-sm text-slate-500">Encrypting payment details</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1"><Spinner /></div>
                    <div>
                      <div className="font-semibold">Verifying Transaction</div>
                      <div className="text-sm text-slate-500">Confirming with payment gateway</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 opacity-60">
                    <div className="mt-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-300">○</div>
                    </div>
                    <div>
                      <div className="font-semibold">Completing Payment</div>
                      <div className="text-sm text-slate-500">Finalizing your payment</div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  Please do not close this window while payment verification is in progress.
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div className="rounded-[20px] border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm">
            <h4 className="font-semibold mb-3">Payment Summary</h4>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-sm">
                {primary ? (primary.child?.firstName || 'C')[0] : 'P'}
              </div>
              <div>
                <div className="font-semibold">{primary ? `${primary.child?.firstName} ${primary.child?.lastName}` : 'Child Name'}</div>
                <div className="text-xs text-slate-500">{primary?.parent?.fullName || 'Parent Name'}</div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {summary.items.map((row) => (
                <div key={row.label} className="flex justify-between">
                  <div className="text-slate-500">{row.label}</div>
                  <div className="font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(row.amount)}</div>
                </div>
              ))}
              <div className="mt-3 border-t pt-3 flex justify-between">
                <div className="font-bold">Total</div>
                <div className="font-extrabold text-emerald-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(summary.total || 0)}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-500">
              Payment Method: <span className="font-semibold text-slate-900">Chapa</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ProcessingPayment;
