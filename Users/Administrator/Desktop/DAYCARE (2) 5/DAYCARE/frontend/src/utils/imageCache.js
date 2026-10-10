/**
 * imageCache.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-Tier Image Caching Engine for React (Browser)
 *
 *  L1 – Memory Cache  : JavaScript Map  (fast, lost on page refresh)
 *  L2 – Disk Cache    : IndexedDB        (persistent across sessions)
 *
 * Strategy (per request):
 *   1. Check L1 (memory) → hit? return immediately (< 1ms)
 *   2. Check L2 (IndexedDB) → hit? promote to L1, return Blob URL
 *   3. Fetch from network → store in L2 then L1, return Blob URL
 *   4. On any failure → return null so caller can show placeholder
 *
 * TTL  : Entries older than `TTL_MS` are treated as stale and re-fetched.
 * Size : When L1 exceeds `MAX_MEMORY_ENTRIES`, the oldest entry is evicted (LRU).
 *        When L2 exceeds `MAX_DISK_ENTRIES`,  the oldest entry is evicted (LRU).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  /** How long a cached image is considered fresh (default: 7 days) */
  TTL_MS: 7 * 24 * 60 * 60 * 1000,

  /** Max images kept in the in-process Map (RAM) */
  MAX_MEMORY_ENTRIES: 100,

  /** Max images kept in IndexedDB (disk) */
  MAX_DISK_ENTRIES: 500,

  /** IndexedDB database name and store */
  DB_NAME: 'img_cache_db',
  DB_VERSION: 1,
  STORE_NAME: 'images',
};

// ─── L1 · Memory Cache ────────────────────────────────────────────────────────
/**
 * Each entry: { blobUrl: string, timestamp: number, lastUsed: number }
 * We keep an insertion-order Map so eviction is O(1) (delete first key).
 */
const memoryCache = new Map();

function memGet(url) {
  const entry = memoryCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CONFIG.TTL_MS) {
    // Stale — revoke the object URL to free memory and remove entry
    URL.revokeObjectURL(entry.blobUrl);
    memoryCache.delete(url);
    return null;
  }
  // Refresh LRU position
  entry.lastUsed = Date.now();
  return entry.blobUrl;
}

function memSet(url, blobUrl) {
  // Evict LRU entry if over limit
  if (memoryCache.size >= CONFIG.MAX_MEMORY_ENTRIES) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, val] of memoryCache) {
      if (val.lastUsed < oldestTime) {
        oldestTime = val.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      URL.revokeObjectURL(memoryCache.get(oldestKey).blobUrl);
      memoryCache.delete(oldestKey);
    }
  }
  memoryCache.set(url, { blobUrl, timestamp: Date.now(), lastUsed: Date.now() });
}

// ─── L2 · IndexedDB (Disk Cache) ──────────────────────────────────────────────
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
        // keyPath = url, additional index on timestamp for LRU eviction
        const store = db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = (e) => reject(e.target.error);
    req.onblocked  = ()  => reject(new Error('IndexedDB blocked'));
  });
}

async function diskGet(url) {
  try {
    const db    = await openDB();
    const tx    = db.transaction(CONFIG.STORE_NAME, 'readonly');
    const store = tx.objectStore(CONFIG.STORE_NAME);

    return new Promise((resolve) => {
      const req = store.get(url);
      req.onsuccess = (e) => {
        const record = e.target.result;
        if (!record) return resolve(null);
        // Check TTL
        if (Date.now() - record.timestamp > CONFIG.TTL_MS) {
          diskDelete(url); // async cleanup, don't await
          return resolve(null);
        }
        // Convert stored ArrayBuffer → Blob → Object URL
        const blob    = new Blob([record.data], { type: record.mimeType });
        const blobUrl = URL.createObjectURL(blob);
        resolve(blobUrl);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function diskSet(url, arrayBuffer, mimeType) {
  try {
    const db    = await openDB();
    const tx    = db.transaction(CONFIG.STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONFIG.STORE_NAME);

    // Enforce disk size limit before writing
    await evictDiskIfNeeded(store);

    store.put({ url, data: arrayBuffer, mimeType, timestamp: Date.now() });
  } catch (err) {
    console.warn('[ImageCache] diskSet failed:', err);
  }
}

async function diskDelete(url) {
  try {
    const db    = await openDB();
    const tx    = db.transaction(CONFIG.STORE_NAME, 'readwrite');
    tx.objectStore(CONFIG.STORE_NAME).delete(url);
  } catch { /* silent */ }
}

function evictDiskIfNeeded(store) {
  return new Promise((resolve) => {
    const countReq = store.count();
    countReq.onsuccess = (e) => {
      const count = e.target.result;
      if (count < CONFIG.MAX_DISK_ENTRIES) return resolve();

      // Delete oldest entries (lowest timestamp) until under limit
      const toDelete = count - CONFIG.MAX_DISK_ENTRIES + 1;
      const idx      = store.index('timestamp');
      const cursor   = idx.openCursor(null, 'next'); // ascending = oldest first
      let deleted    = 0;

      cursor.onsuccess = (ev) => {
        const cur = ev.target.result;
        if (!cur || deleted >= toDelete) return resolve();
        cur.delete();
        deleted++;
        cur.continue();
      };
      cursor.onerror = () => resolve();
    };
    countReq.onerror = () => resolve();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve an image URL to a locally-cached Blob URL.
 *
 * @param {string} url        - Remote image URL
 * @param {object} [options]  - Override per-call: { ttlMs, signal }
 * @returns {Promise<string|null>} Blob URL string, or null on failure
 */
export async function getCachedImage(url, options = {}) {
  if (!url) return null;

  const ttlMs = options.ttlMs ?? CONFIG.TTL_MS;

  // ── L1 hit ────────────────────────────────────────────────────────────────
  const memHit = memGet(url);
  if (memHit) return memHit;

  // ── L2 hit ────────────────────────────────────────────────────────────────
  const diskHit = await diskGet(url);
  if (diskHit) {
    memSet(url, diskHit); // promote to L1
    return diskHit;
  }

  // ── Network fetch ─────────────────────────────────────────────────────────
  try {
    const res = await fetch(url, {
      signal: options.signal,
      // Bypass browser cache so we control freshness ourselves
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const mimeType    = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();

    // Write to both tiers
    await diskSet(url, arrayBuffer, mimeType);
    const blob    = new Blob([arrayBuffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    memSet(url, blobUrl);

    return blobUrl;
  } catch (err) {
    if (err.name === 'AbortError') return null; // intentionally cancelled
    console.warn('[ImageCache] fetch failed for', url, err);
    return null;
  }
}

/**
 * Manually invalidate a single URL from both cache tiers.
 */
export async function invalidateImage(url) {
  if (!url) return;
  const entry = memoryCache.get(url);
  if (entry) { URL.revokeObjectURL(entry.blobUrl); memoryCache.delete(url); }
  await diskDelete(url);
}

/**
 * Wipe the entire disk cache and memory cache.
 * Useful for logout or "Clear Cache" settings buttons.
 */
export async function clearImageCache() {
  // Revoke all Blob URLs before clearing
  for (const [, entry] of memoryCache) {
    URL.revokeObjectURL(entry.blobUrl);
  }
  memoryCache.clear();

  try {
    const db    = await openDB();
    const tx    = db.transaction(CONFIG.STORE_NAME, 'readwrite');
    tx.objectStore(CONFIG.STORE_NAME).clear();
  } catch (err) {
    console.warn('[ImageCache] clearImageCache failed:', err);
  }
}

/**
 * Returns live stats about both cache tiers.
 */
export async function getCacheStats() {
  let diskCount = 0;
  try {
    const db    = await openDB();
    const tx    = db.transaction(CONFIG.STORE_NAME, 'readonly');
    diskCount   = await new Promise((res) => {
      const req = tx.objectStore(CONFIG.STORE_NAME).count();
      req.onsuccess = (e) => res(e.target.result);
      req.onerror   = ()  => res(0);
    });
  } catch { /* silent */ }

  return {
    memoryEntries : memoryCache.size,
    maxMemory     : CONFIG.MAX_MEMORY_ENTRIES,
    diskEntries   : diskCount,
    maxDisk       : CONFIG.MAX_DISK_ENTRIES,
    ttlDays       : CONFIG.TTL_MS / (24 * 60 * 60 * 1000),
  };
}

/**
 * Override global config at runtime (call once at app startup if needed).
 * e.g. configureImageCache({ TTL_MS: 3 * 24 * 60 * 60 * 1000 })
 */
export function configureImageCache(overrides = {}) {
  Object.assign(CONFIG, overrides);
}

export { CONFIG as imageCacheConfig };
