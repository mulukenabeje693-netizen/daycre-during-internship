/**
 * CachedImage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in <img> replacement that caches via the two-tier engine.
 *
 * Props (all optional except `src`):
 *   src          {string}    Remote image URL
 *   fallback     {string}    Placeholder shown while loading or on error
 *   alt          {string}    Alt text
 *   ttlMs        {number}    Override default TTL for this image
 *   forceRefresh {boolean}   Invalidate cached copy and re-fetch
 *   skeleton     {boolean}   Show animated skeleton instead of spinner (default true)
 *   onLoad       {function}  Called when image resolves (src, status)
 *   onError      {function}  Called when image fails
 *   className    {string}    CSS class(es) for the outer wrapper
 *   imgClassName {string}    CSS class(es) for the <img> element
 *   style        {object}    Inline styles for wrapper
 *   ...rest                  Any extra props forwarded to <img>
 *
 * Usage:
 *   <CachedImage
 *     src="https://example.com/photo.jpg"
 *     fallback="/assets/avatar-placeholder.png"
 *     alt="Child photo"
 *     ttlMs={3 * 24 * 60 * 60 * 1000}
 *     className="w-10 h-10 rounded-full"
 *   />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect } from 'react';
import { useImageCache } from '../hooks/useImageCache';

// ─── Default placeholder (inline SVG – no extra asset required) ───────────────
const DEFAULT_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e2e8f0'/%3E%3Ccircle cx='50' cy='38' r='16' fill='%2394a3b8'/%3E%3Cellipse cx='50' cy='80' rx='28' ry='18' fill='%2394a3b8'/%3E%3C/svg%3E";

const CachedImage = React.memo(({
  src,
  fallback,
  alt = '',
  ttlMs,
  forceRefresh = false,
  skeleton = true,
  onLoad,
  onError,
  className = '',
  imgClassName = '',
  style,
  ...rest
}) => {
  const placeholder = fallback || DEFAULT_PLACEHOLDER;

  const { src: cachedSrc, status, retry } = useImageCache(src, {
    ttlMs,
    forceRefresh,
    disabled: !src,
  });

  // Notify parent
  useEffect(() => {
    if (status === 'cached' || status === 'fetched') onLoad?.(cachedSrc, status);
    if (status === 'error')  onError?.();
  }, [status, cachedSrc, onLoad, onError]);

  const isLoading = status === 'loading';
  const isError   = status === 'error' || (!src);
  const resolved  = cachedSrc || placeholder;

  return (
    <div
      className={`relative inline-block overflow-hidden ${className}`}
      style={style}
    >
      {/* ── Skeleton pulse overlay (shown while loading) ────────────────── */}
      {isLoading && skeleton && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 animate-pulse"
          style={{
            background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite linear',
          }}
        />
      )}

      {/* ── Image ───────────────────────────────────────────────────────── */}
      <img
        {...rest}
        src={resolved}
        alt={alt}
        loading="lazy"
        decoding="async"
        onClick={isError ? retry : rest.onClick}
        title={isError ? 'Click to retry' : rest.title}
        className={[
          imgClassName,
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          isError   ? 'cursor-pointer' : '',
        ].join(' ')}
        onError={(e) => {
          // If even the placeholder fails (e.g. offline), show the SVG default
          if (e.target.src !== DEFAULT_PLACEHOLDER) {
            e.target.src = DEFAULT_PLACEHOLDER;
          }
        }}
      />

      {/* ── Error badge (tap to retry) ───────────────────────────────────── */}
      {isError && src && (
        <button
          onClick={retry}
          aria-label="Retry loading image"
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-white text-xs gap-1 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <i className="bx bx-refresh text-2xl" />
          <span>Retry</span>
        </button>
      )}

      {/* ── Shimmer keyframe (injected once via a style tag) ─────────────── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
});

CachedImage.displayName = 'CachedImage';
export default CachedImage;
