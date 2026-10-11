/**
 * ChunkErrorBoundary.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Error Boundary specifically designed for React.lazy() + Suspense trees.
 *
 * Handles two distinct failure modes:
 *  1. ChunkLoadError  — network failed to download a JS chunk (e.g. deploy
 *     updated the filename hash while the user had the old page open).
 *     Strategy: auto-reload the page ONCE (the new chunk URLs will be valid).
 *
 *  2. Runtime render error — a bug inside the lazy-loaded component.
 *     Strategy: show a friendly error card with a manual retry button.
 *
 * Props:
 *   children    {ReactNode}  — wrapped lazy component tree
 *   fallback    {ReactNode}  — optional custom fallback (overrides default card)
 *   onError     {function}   — optional callback (error, errorInfo)
 *   label       {string}     — human-readable name shown in error card
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React from 'react';

const AUTO_RELOAD_KEY = 'chunk_reload_attempted';

export class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed');

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    this.props.onError?.(error, errorInfo);

    // Auto-reload once for chunk errors (stale deploy recovery)
    if (this.state.isChunkError) {
      const alreadyRetried = sessionStorage.getItem(AUTO_RELOAD_KEY);
      if (!alreadyRetried) {
        sessionStorage.setItem(AUTO_RELOAD_KEY, '1');
        window.location.reload();
      }
    }
  }

  reset() {
    sessionStorage.removeItem(AUTO_RELOAD_KEY);
    this.setState({ hasError: false, error: null, isChunkError: false });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Custom fallback override
    if (this.props.fallback) return this.props.fallback;

    const { error, isChunkError } = this.state;
    const label = this.props.label || 'this section';

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 p-8 my-4 rounded-2xl border text-center"
        style={{
          background: 'rgba(239,68,68,0.06)',
          borderColor: 'rgba(239,68,68,0.2)',
        }}
      >
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 text-3xl">
          <i className={`bx ${isChunkError ? 'bx-wifi-off' : 'bx-error-circle'}`} />
        </div>

        {/* Message */}
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            {isChunkError ? 'Connection lost while loading' : 'Something went wrong'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            {isChunkError
              ? `Could not load ${label}. Check your internet connection and try again.`
              : `An error occurred in ${label}. Our team has been notified.`}
          </p>
          {!isChunkError && error?.message && (
            <pre className="mt-2 text-xs text-rose-400 bg-rose-500/10 rounded-lg p-2 max-w-sm mx-auto whitespace-pre-wrap text-left">
              {error.message}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={this.reset}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
          >
            <i className="bx bx-refresh mr-1.5" />
            Try Again
          </button>
          {isChunkError && (
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              <i className="bx bx-revision mr-1.5" />
              Reload Page
            </button>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Convenience HOC: wraps any component in ChunkErrorBoundary + Suspense.
 *
 * Usage:
 *   const SafeLazy = withLazySafety(React.lazy(() => import('./HeavyModal')), {
 *     label: 'Live Stream',
 *     fallback: <ModalSkeleton />,
 *   });
 */
export function withLazySafety(LazyComponent, options = {}) {
  const { label, fallback, suspenseFallback } = options;

  const Wrapped = (props) => (
    <ChunkErrorBoundary label={label} fallback={fallback}>
      <React.Suspense fallback={suspenseFallback || <DefaultSuspenseFallback label={label} />}>
        <LazyComponent {...props} />
      </React.Suspense>
    </ChunkErrorBoundary>
  );

  Wrapped.displayName = `SafeLazy(${label || 'Component'})`;
  return Wrapped;
}

/** Minimal inline spinner used when no custom suspense fallback is provided */
function DefaultSuspenseFallback({ label }) {
  return (
    <div className="w-full py-12 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
      <span className="text-xs text-slate-400">
        {label ? `Loading ${label}…` : 'Loading…'}
      </span>
    </div>
  );
}

export default ChunkErrorBoundary;
