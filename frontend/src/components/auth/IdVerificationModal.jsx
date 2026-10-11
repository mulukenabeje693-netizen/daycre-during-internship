import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../../services/api';

/**
 * IdVerificationModal
 * 
 * Standalone 2-step ID verification modal.
 * Step 1: Front ID  →  Step 2: Back ID  →  Submit
 *
 * Props:
 *   onClose()              — close without saving
 *   onSuccess(data)        — called with { frontIdUrl, backIdUrl, isIdVerified }
 *
 * Usage:
 *   <IdVerificationModal onClose={() => setOpen(false)} onSuccess={(d) => console.log(d)} />
 */

// ─── tiny helpers ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'front',
    label: 'Front ID',
    title: 'Scan Front Side of ID Card',
    hint: 'Position the front of your ID card within the frame',
    uploadLabel: 'Upload Front Image',
  },
  {
    id: 'back',
    label: 'Back ID',
    title: 'Scan Back Side of ID Card',
    hint: 'Flip your ID card and position the back within the frame',
    uploadLabel: 'Upload Back Image',
  },
];

// ─── LLM validation helper ────────────────────────────────────────────────────
// Converts a File/Blob to base64, sends it to POST /api/auth/validate-id,
// and returns { valid: boolean, reason: string | null }.
const validateWithLLM = async (file, side) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const imageBase64 = reader.result; // full data-URL
        const res = await api.post('/auth/validate-id', { side, imageBase64 });
        resolve({ valid: res.data?.valid !== false, reason: res.data?.reason || null });
      } catch {
        // Network / server error → let it through rather than blocking the user
        resolve({ valid: true, reason: null });
      }
    };
    reader.onerror = () => resolve({ valid: true, reason: null });
    reader.readAsDataURL(file);
  });
};

// ─── IDCardPlaceholder — landscape card shown before capture ──────────────────
const IDCardPlaceholder = ({ variant }) => {
  const isFront = variant === 'front';
  return (
    <svg viewBox="0 0 420 260" className="w-full h-full" aria-hidden="true">
      {/* Card body */}
      <rect x="30" y="30" width="360" height="200" rx="14"
        className="fill-[var(--surface)] dark:fill-[var(--card-bg)]"
        stroke="var(--border)" strokeWidth="1.5" />

      {/* Header stripe */}
      <rect x="30" y="30" width="360" height="38" rx="14"
        className="fill-[var(--primary-dark)]" />
      <rect x="30" y="54" width="360" height="14"
        className="fill-[var(--primary-dark)]" />

      {/* Header label text lines */}
      <rect x="155" y="41" width="110" height="6" rx="3" fill="rgba(255,255,255,0.5)" />
      <rect x="175" y="51" width="70" height="4" rx="2" fill="rgba(255,255,255,0.3)" />

      {isFront ? (
        <>
          {/* Photo box */}
          <rect x="50" y="82" width="72" height="90" rx="6"
            className="fill-slate-200 dark:fill-slate-700" stroke="var(--border)" strokeWidth="1" />
          {/* Person silhouette */}
          <circle cx="86" cy="108" r="16" className="fill-slate-400 dark:fill-slate-500" />
          <path d="M58 172 Q86 148 114 172" className="fill-slate-400 dark:fill-slate-500" />

          {/* Text lines */}
          <rect x="138" y="86" width="55" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" />
          <rect x="138" y="96" width="180" height="7" rx="3.5" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" opacity="0.7"/>

          <rect x="138" y="116" width="45" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" />
          <rect x="138" y="126" width="130" height="6" rx="3" className="fill-slate-400 dark:fill-slate-500" opacity="0.6"/>

          <rect x="138" y="145" width="40" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" />
          <rect x="138" y="155" width="90" height="6" rx="3" className="fill-slate-400 dark:fill-slate-500" opacity="0.6"/>

          {/* Barcode at bottom */}
          {[0,5,9,14,18,23,28,32,37,42,47,51,56].map((x, i) => (
            <rect key={i} x={50 + x} y="192" width={i % 3 === 0 ? 3 : 2} height="24" rx="0.5"
              className="fill-slate-700 dark:fill-slate-300" opacity="0.7"/>
          ))}
          <rect x="242" y="192" width="130" height="24" rx="4"
            className="fill-slate-100 dark:fill-slate-800" />
          <rect x="252" y="199" width="60" height="5" rx="2.5" className="fill-slate-400 dark:fill-slate-500" opacity="0.5"/>
          <rect x="252" y="208" width="100" height="4" rx="2" className="fill-slate-300 dark:fill-slate-600" opacity="0.4"/>
        </>
      ) : (
        <>
          {/* Large QR code area */}
          <rect x="50" y="80" width="100" height="100" rx="6"
            className="fill-slate-100 dark:fill-slate-800" stroke="var(--border)" strokeWidth="1" />
          {/* QR finder patterns */}
          {[[55,85],[120,85],[55,150]].map(([x,y],i) => (
            <g key={i}>
              <rect x={x} y={y} width="20" height="20" rx="3" className="fill-slate-700 dark:fill-slate-300" opacity="0.8"/>
              <rect x={x+3} y={y+3} width="14" height="14" rx="2" className="fill-slate-100 dark:fill-slate-800" />
              <rect x={x+6} y={y+6} width="8" height="8" rx="1" className="fill-slate-700 dark:fill-slate-300" opacity="0.8"/>
            </g>
          ))}
          {/* QR data dots */}
          <rect x="80" y="85" width="35" height="35" className="fill-slate-500 dark:fill-slate-400" opacity="0.3"/>
          <rect x="55" y="120" width="65" height="25" className="fill-slate-500 dark:fill-slate-400" opacity="0.3"/>
          <rect x="120" y="120" width="25" height="60" className="fill-slate-500 dark:fill-slate-400" opacity="0.2"/>

          {/* Info lines right side */}
          <rect x="168" y="86" width="50" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" />
          <rect x="168" y="96" width="180" height="7" rx="3.5" className="fill-[var(--primary-dark)] dark:fill-[var(--primary-light)]" opacity="0.7"/>
          <rect x="168" y="116" width="40" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" />
          <rect x="168" y="126" width="140" height="6" rx="3" className="fill-slate-400 dark:fill-slate-500" opacity="0.6"/>
          <rect x="168" y="145" width="35" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" />
          <rect x="168" y="155" width="110" height="6" rx="3" className="fill-slate-400 dark:fill-slate-500" opacity="0.6"/>
          <rect x="168" y="170" width="150" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" opacity="0.4"/>

          {/* Machine-readable zone at bottom */}
          <rect x="50" y="196" width="320" height="8" rx="2" className="fill-slate-300 dark:fill-slate-600" opacity="0.4"/>
          <rect x="50" y="208" width="320" height="8" rx="2" className="fill-slate-300 dark:fill-slate-600" opacity="0.3"/>
        </>
      )}

      {/* Corner bracket guides */}
      <g fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-[var(--primary-light)]" opacity="0.6">
        <polyline points="30,50 30,30 50,30" />
        <polyline points="370,50 390,50 390,30 370,30" />
        <polyline points="30,210 30,230 50,230" />
        <polyline points="370,210 390,210 390,230 370,230" />
      </g>
    </svg>
  );
};

// ─── StepIndicator ─────────────────────────────────────────────────────────────
const StepIndicator = ({ current }) => (
  <div className="flex items-center justify-center gap-3 mb-6">
    {STEPS.map((s, i) => {
      const done    = i < current;
      const active  = i === current;
      return (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
            ${done   ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : ''}
            ${active ? 'bg-[var(--primary-dark)] border-[var(--primary-light)] text-white shadow-[0_0_12px_rgba(22,196,201,0.4)]' : ''}
            ${!done && !active ? 'bg-transparent border-slate-300 dark:border-slate-600 text-slate-400' : ''}
          `}>
            {done ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            ) : i + 1}
          </div>
          <span className={`text-xs font-semibold ${active ? 'text-[var(--primary-light)]' : done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 rounded ${done ? 'bg-[var(--primary)]' : 'bg-slate-200 dark:bg-slate-700'}`} />
          )}
        </div>
      );
    })}
  </div>
);

// ─── CapturePanel — shown for each step before the image is confirmed ──────────
// The camera viewport is a landscape rectangle (16:10 aspect ratio).
// On capture, we crop the canvas to match exactly what the overlay rectangle shows.
const CapturePanel = ({ side, step, onCaptured, onValidationError }) => {
  const videoRef        = useRef(null);
  const canvasRef       = useRef(null);
  const frameRef        = useRef(null); // the visible crop rectangle DOM node
  const streamRef       = useRef(null);
  const [mode, setMode]               = useState(null);   // null | 'camera'
  const [cameraReady, setCameraReady] = useState(false);
  const [camError, setCamError]       = useState('');
  const [validating, setValidating]   = useState(false);

  // Start rear-facing camera
  const startCamera = useCallback(async () => {
    setCamError('');
    setCameraReady(false);
    setMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCamError('Camera access denied. Please allow camera permission or use file upload.');
      setMode(null);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setMode(null);
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), []);

  // ── shared: validate then forward ──
  const processCapture = useCallback(async (blob, filename) => {
    const file    = new File([blob], filename, { type: 'image/jpeg' });
    const preview = URL.createObjectURL(blob);

    setValidating(true);
    const { valid, reason } = await validateWithLLM(file, side);
    setValidating(false);

    if (!valid) {
      URL.revokeObjectURL(preview);
      onValidationError(reason || 'This image does not appear to be a valid ID card. Please try again.');
      return;
    }
    onCaptured({ file, preview });
  }, [side, onCaptured, onValidationError]);

  // Capture: crop canvas to the visible rectangular frame overlay
  const capture = useCallback(() => {
    const video   = videoRef.current;
    const canvas  = canvasRef.current;
    const frame   = frameRef.current;
    if (!video || !canvas || !frame) return;

    const videoRect = video.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scaleX = video.videoWidth  / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;
    const sx = Math.max(0, (frameRect.left - videoRect.left) * scaleX);
    const sy = Math.max(0, (frameRect.top  - videoRect.top)  * scaleY);
    const sw = Math.min((frameRect.width  * scaleX), video.videoWidth  - sx);
    const sh = Math.min((frameRect.height * scaleY), video.videoHeight - sy);

    canvas.width  = sw;
    canvas.height = sh;
    canvas.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    canvas.toBlob(blob => {
      if (!blob) return;
      stopCamera();
      processCapture(blob, `id-${side}-${Date.now()}.jpg`);
    }, 'image/jpeg', 0.95);
  }, [side, stopCamera, processCapture]);

  // Handle file upload
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCamError('Please select an image file (JPG, PNG, etc.).');
      return;
    }
    e.target.value = '';
    // read as blob so processCapture can handle it uniformly
    const reader = new FileReader();
    reader.onloadend = () => {
      const byteString = atob(reader.result.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: file.type });
      processCapture(blob, file.name);
    };
    reader.readAsDataURL(file);
  }, [processCapture]);

  return (
    <div className="relative flex flex-col items-center gap-4">

      {/* ── Viewport ── */}
      {mode === 'camera' ? (
        /* Camera active — landscape video with rectangular crop overlay */
        <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '16/10' }}>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="w-full h-full object-cover"
          />

          {/* Dark vignette outside the card zone */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.45) 100%)',
            }}
          />

          {/* Landscape crop rectangle — 85% wide × 62% tall, centred */}
          <div
            ref={frameRef}
            className="absolute pointer-events-none"
            style={{
              left: '7.5%', top: '15%',
              width: '85%', height: '70%',
              borderRadius: '10px',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.42)',
            }}
          >
            {/* Animated corner guides */}
            {[
              'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-[10px]',
              'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-[10px]',
              'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-[10px]',
              'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-[10px]',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-7 h-7 border-[var(--primary-light)] ${cls}`}
                style={{ filter: 'drop-shadow(0 0 6px rgba(22,196,201,0.8))' }} />
            ))}

            {/* Scanning laser line */}
            {cameraReady && (
              <div className="absolute inset-x-0 h-[2px] pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, var(--primary-light), transparent)',
                  boxShadow: '0 0 12px 3px rgba(22,196,201,0.5)',
                  animation: 'idScan 2.2s ease-in-out infinite',
                }}
              />
            )}
          </div>

          {/* Helper text inside viewport */}
          <p className="absolute bottom-3 left-0 right-0 text-center text-white text-[11px] font-semibold drop-shadow pointer-events-none"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            Position your ID card within the frame
          </p>

          {/* Camera initialising spinner */}
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="w-9 h-9 border-2 border-[var(--primary-light)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Keyframe for scanning line — injected once */}
          <style>{`
            @keyframes idScan {
              0%   { top: 4%; opacity: 0; }
              10%  { opacity: 1; }
              90%  { opacity: 1; }
              100% { top: 94%; opacity: 0; }
            }
          `}</style>
        </div>
      ) : (
        /* Idle — show landscape ID card illustration + instruction notice */
        <div className="flex flex-col gap-3 w-full">
          {/* Instruction notice */}
          <div className="w-full rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex gap-3 items-start">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <p className="font-bold mb-1">Please upload an official ID card image — not a personal selfie or face photo.</p>
              {side === 'front'
                ? <p>• <strong>Front Side:</strong> Must clearly show Full Name and Date of Birth.</p>
                : <p>• <strong>Back Side:</strong> Must contain a clear, scannable QR Code.</p>
              }
            </div>
          </div>

          {/* Landscape card placeholder */}
          <div className="relative w-full rounded-2xl overflow-hidden border-2 border-dashed border-[var(--primary-light)]/40 bg-[var(--surface)] dark:bg-[var(--card-bg)]"
            style={{ aspectRatio: '16/10' }}>
            <IDCardPlaceholder variant={side} />
          </div>
        </div>
      )}

      {/* Validating overlay — shown while LLM is checking the image */}
      {validating && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/80 dark:bg-[var(--card-bg)]/80 backdrop-blur-sm">
          <div className="w-10 h-10 border-[3px] border-[var(--primary-light)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Validating ID card…</p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Helper text below frame (always visible) */}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center -mt-1">
        Position your ID card within the frame
      </p>

      {camError && (
        <p className="text-xs text-red-500 dark:text-red-400 font-semibold text-center">{camError}</p>
      )}

      {/* ── Action buttons ── */}
      {mode === 'camera' ? (
        <div className="flex gap-3 w-full">
          <button type="button" onClick={stopCamera} disabled={validating}
            className="flex-1 py-2.5 rounded-full border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={capture} disabled={!cameraReady || validating}
            className="flex-1 py-2.5 rounded-full bg-[var(--primary-dark)] text-white text-sm font-bold shadow-md hover:bg-[var(--primary)] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {validating ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/></svg>Checking…</>
            ) : (
              <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/></svg>Capture ID</>
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          {/* Scan with Camera */}
          <button type="button" onClick={startCamera} disabled={validating}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-[var(--glass-border)] bg-white dark:bg-[var(--card-bg)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Scan with Camera</div>
              <div className="text-xs text-slate-500">Align the card in the rectangular frame</div>
            </div>
          </button>

          {/* Upload file */}
          <label className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-[var(--glass-border)] bg-white dark:bg-[var(--card-bg)] hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all ${validating ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={validating} />
            <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{step.uploadLabel}</div>
              <div className="text-xs text-slate-500">Choose a photo from your device</div>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

// ─── PreviewPanel — shown after image is captured, before confirmed ────────────
const PreviewPanel = ({ side, preview, onRetake, onConfirm }) => (
  <div className="flex flex-col items-center gap-4">
    <div className="relative w-full h-44 rounded-2xl overflow-hidden border-2 border-[var(--primary-light)]/60 shadow-md">
      <img src={preview} alt={`${side} ID preview`} className="w-full h-full object-cover" />
      {/* green overlay badge */}
      <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        Captured
      </div>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
      Looks good? Confirm or retake if the image is blurry or cut off.
    </p>
    <div className="flex gap-3 w-full">
      <button type="button" onClick={onRetake}
        className="flex-1 py-2.5 rounded-full border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        Retake
      </button>
      <button type="button" onClick={onConfirm}
        className="flex-1 py-2.5 rounded-full bg-[var(--primary-dark)] text-white text-sm font-bold shadow-md hover:bg-[var(--primary)] transition-all flex items-center justify-center gap-2">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        Confirm
      </button>
    </div>
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────
const IdVerificationModal = ({ onClose, onSuccess }) => {
  // stepIndex: 0 = front, 1 = back
  const [stepIndex, setStepIndex]         = useState(0);
  const [captures, setCaptures]           = useState({ front: null, back: null });
  // phase: 'capture' | 'preview' | 'done'
  const [phase, setPhase]                 = useState('capture');
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [validationError, setValidationError] = useState('');

  const currentStep = STEPS[stepIndex];

  // Called by CapturePanel when a frame/file passes validation
  const handleCaptured = useCallback(({ file, preview }) => {
    setValidationError('');
    setCaptures(prev => ({ ...prev, [currentStep.id]: { file, preview } }));
    setPhase('preview');
  }, [currentStep.id]);

  // Called by CapturePanel when LLM rejects the image
  const handleValidationError = useCallback((reason) => {
    setValidationError(reason);
  }, []);

  // Retake — clear the current capture and go back to capture mode
  const handleRetake = useCallback(() => {
    setValidationError('');
    setCaptures(prev => ({ ...prev, [currentStep.id]: null }));
    setPhase('capture');
  }, [currentStep.id]);

  // Confirm current step — advance or go to review
  const handleConfirm = useCallback(() => {
    setValidationError('');
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(i => i + 1);
      setPhase('capture');
    } else {
      setPhase('done');
    }
  }, [stepIndex]);

  // Submit both images to /api/auth/upload-id
  const handleSubmit = useCallback(async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('idFront', captures.front.file, captures.front.file.name);
      formData.append('idBack',  captures.back.file,  captures.back.file.name);

      const res = await api.post('/auth/upload-id', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        onSuccess?.(res.data.data);
      } else {
        setSubmitError(res.data?.message || 'Upload failed. Please try again.');
        setPhase('done');
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to upload ID documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [captures, onSuccess]);

  // Cleanup blob URLs when modal unmounts
  useEffect(() => {
    return () => {
      if (captures.front?.preview?.startsWith('blob:')) URL.revokeObjectURL(captures.front.preview);
      if (captures.back?.preview?.startsWith('blob:'))  URL.revokeObjectURL(captures.back.preview);
    };
  }, [captures]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-labelledby="id-verify-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card */}
      <div className="w-full max-w-md bg-white dark:bg-[var(--card-bg)] rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-[var(--glass-border)]">

        {/* ── Header ── */}
        <div className="bg-[linear-gradient(135deg,var(--primary),var(--primary-dark))] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/15 border border-white/30 flex items-center justify-center">
              <svg width="18" height="18" fill="none" stroke="var(--primary-light)" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
              </svg>
            </div>
            <div>
              <h2 id="id-verify-title" className="text-white font-bold text-base leading-tight">ID Verification</h2>
              <p className="text-white/70 text-[11px]">
                {phase === 'done' ? 'Review & Submit' : `Step ${stepIndex + 1} of ${STEPS.length}: ${currentStep.title}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5">

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
              style={{ width: phase === 'done' ? '100%' : `${((stepIndex + (phase === 'preview' ? 0.5 : 0)) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Step indicator */}
          <StepIndicator current={phase === 'done' ? STEPS.length : stepIndex} />

          {/* ── Review & submit screen ── */}
          {phase === 'done' ? (
            <div className="flex flex-col gap-4">
              {submitError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold">
                  {submitError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {STEPS.map(s => (
                  <div key={s.id} className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{s.title}</span>
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-[var(--glass-border)]" style={{ aspectRatio: '16/10' }}>
                      <img src={captures[s.id]?.preview} alt={s.title} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Both sides look clear and readable? Submit to save securely.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setStepIndex(0); setPhase('capture'); setCaptures({ front: null, back: null }); }}
                  className="flex-1 py-2.5 rounded-full border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  Start Over
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-2.5 rounded-full bg-[var(--primary-dark)] text-white text-sm font-bold shadow-md hover:bg-[var(--primary)] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting ? (
                    <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/></svg>Saving…</>
                  ) : (
                    <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Complete Verification</>
                  )}
                </button>
              </div>
            </div>
          ) : phase === 'preview' ? (
            /* Preview after capture */
            <PreviewPanel
              side={currentStep.id}
              preview={captures[currentStep.id]?.preview}
              onRetake={handleRetake}
              onConfirm={handleConfirm}
            />
          ) : (
            /* Capture / upload panel */
            <div className="flex flex-col gap-3">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 text-center">{currentStep.title}</p>

              {/* LLM rejection banner — shown when image fails validation */}
              {validationError && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
                    className="text-red-500 shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 leading-relaxed">{validationError}</p>
                </div>
              )}

              <CapturePanel
                side={currentStep.id}
                step={currentStep}
                onCaptured={handleCaptured}
                onValidationError={handleValidationError}
              />
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5 flex items-center gap-2 text-[11px] text-slate-400">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Your ID images are encrypted and stored securely.
        </div>
      </div>
    </div>
  );
};

export default IdVerificationModal;
