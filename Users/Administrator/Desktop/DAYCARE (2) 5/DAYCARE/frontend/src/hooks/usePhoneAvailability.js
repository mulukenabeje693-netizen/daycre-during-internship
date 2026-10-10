/**
 * usePhoneAvailability
 * ─────────────────────────────────────────────────────────────────────────────
 * Debounced, per-field hook that checks whether a phone number is already
 * registered in the system via GET /api/auth/check-phone.
 *
 * Usage:
 *   const { checking, takenError } = usePhoneAvailability(rawPhoneValue, formatError);
 *
 *   - checking   {boolean}  true while the async check is in-flight
 *   - takenError {string}   non-empty when the number is already in the DB
 *
 * The check is skipped when:
 *   - the value is empty / blank
 *   - there is already a format error on this field (formatError is truthy)
 */

import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { normalizePhone, ETH_PHONE_RE } from '../utils/phoneValidation';

const DEBOUNCE_MS = 600;
const TAKEN_SENTINEL = '__phone_taken__'; // sentinel — components replace with locale text

export function usePhoneAvailability(rawValue, formatError) {
  const [checking,   setChecking]   = useState(false);
  const [takenError, setTakenError] = useState('');
  const timerRef  = useRef(null);
  const abortRef  = useRef(null);
  const lastChecked = useRef('');   // avoid redundant calls for unchanged values

  useEffect(() => {
    // Clear stale state whenever the raw value changes
    setTakenError('');

    // Skip if there is already a format error — no point hitting the network
    if (formatError) {
      setChecking(false);
      clearTimeout(timerRef.current);
      return;
    }

    const cleaned = rawValue ? rawValue.trim().replace(/[\s\-]/g, '') : '';

    // Skip blank or structurally invalid values (regex gate)
    if (!cleaned || !ETH_PHONE_RE.test(cleaned)) {
      setChecking(false);
      clearTimeout(timerRef.current);
      return;
    }

    const normalized = normalizePhone(cleaned);
    if (!normalized || normalized === lastChecked.current) return;

    // Debounce
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setChecking(true);
      try {
        const res = await api.get('/auth/check-phone', {
          params: { phone: normalized },
          signal: controller.signal,
        });
        lastChecked.current = normalized;
        if (res.data?.available === false) {
          setTakenError(TAKEN_SENTINEL);
        } else {
          setTakenError('');
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          // Network failure — fail silently (backend registration will still catch it)
          setTakenError('');
        }
      } finally {
        setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [rawValue, formatError]);

  return { checking, takenError };
}
