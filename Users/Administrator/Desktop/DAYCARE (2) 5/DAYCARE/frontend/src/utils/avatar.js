/**
 * Helper to build the full URL for user or child avatars.
 * Handles absolute URLs, blobs, data URLs, and relative /uploads paths.
 */
export const getAvatarUrl = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return null;
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  const defaultBase = isLocalHost ? 'http://localhost:5000' : 'https://daycare-vg2j.onrender.com';
  const rawBase = import.meta.env.VITE_API_BASE_URL || defaultBase;
  const backendBase = rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  
  return `${backendBase}${cleanPath}`;
};
