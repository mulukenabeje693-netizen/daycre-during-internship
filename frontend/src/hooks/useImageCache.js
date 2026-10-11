/**
 * useImageCache.js
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that wraps the imageCache engine.
 *
 * Returns: { src, status, retry }
 *   src    : resolved Blob URL (or null if loading/error)
 *   status : 'idle' | 'loading' | 'cached' | 'fetched' | 'error'
 *   retry  : function — manually re-trigger the load
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCachedImage, invalidateImage } from '../utils/imageCache';

/**
 * @param {string|null|undefined} url        - Remote image URL to resolve
 * @param {object}                [options]
 * @param {number}                [options.ttlMs]          - Per-image TTL override
 * @param {boolean}               [options.disabled]       - Skip loading entirely
 * @param {boolean}               [options.forceRefresh]   - Invalidate cache before loading
 */
export function useImageCache(url, options = {}) {
  const { ttlMs, disabled = false, forceRefresh = false } = options;

  const [src,    setSrc]    = useState(null);
  const [status, setStatus] = useState('idle');

  // Track current URL so stale async results from old URLs are discarded
  const activeUrlRef = useRef(null);
  // AbortController for in-flight fetch
  const abortRef = useRef(null);

  const load = useCallback(async (targetUrl) => {
    if (!targetUrl || disabled) {
      setSrc(null);
      setStatus('idle');
      return;
    }

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    activeUrlRef.current = targetUrl;
    setStatus('loading');
    setSrc(null);

    // Optionally bust the cache for this image
    if (forceRefresh) await invalidateImage(targetUrl);

    const result = await getCachedImage(targetUrl, {
      ttlMs,
      signal: abortRef.current.signal,
    });

    // Guard: if URL changed while we were awaiting, discard stale result
    if (activeUrlRef.current !== targetUrl) return;

    if (result) {
      setSrc(result);
      setStatus('cached'); // from L1/L2; 'fetched' is indistinguishable here by design
    } else {
      setSrc(null);
      setStatus('error');
    }
  }, [disabled, forceRefresh, ttlMs]);

  useEffect(() => {
    load(url);
    return () => {
      abortRef.current?.abort();
    };
  }, [url, load]);

  /** Manually retry (e.g. user taps a broken image) */
  const retry = useCallback(() => {
    load(url);
  }, [url, load]);

  return { src, status, retry };
}
