/**
 * useBackendWakeup — local mode
 * Backend runs locally so it's always awake. No pinging needed.
 */
export function useBackendWakeup() {
  return { awake: true, waking: false };
}
