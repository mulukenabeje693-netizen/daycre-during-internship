/**
 * renderValue.js
 * ─────────────────────────────────────────────────────────────
 * Safe display helpers for the Daycare Management System.
 * Import what you need and use throughout tables, modals, cards.
 *
 * Usage:
 *   import { rv, phone, emergency, classroom, age, date, initials } from '../../utils/renderValue';
 */

// ── Core helper ───────────────────────────────────────────────
/**
 * Returns the value if it is a non-empty, non-null, non-undefined string
 * or number; otherwise returns the fallback.
 *
 * @param {*}      value     - Raw value from API / state
 * @param {string} fallback  - What to show when value is falsy (default: 'N/A')
 */
export const rv = (value, fallback = 'N/A') => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  if (str === '' || str === 'null' || str === 'undefined') return fallback;
  return str;
};

// ── Phone number ──────────────────────────────────────────────
/**
 * Resolves a phone number from multiple possible field names
 * (phone, phoneNumber) and formats or falls back gracefully.
 */
export const phone = (obj, fallback = 'Not Provided') => {
  if (!obj) return fallback;
  const raw = obj.phone || obj.phoneNumber || obj.mobile || null;
  return rv(raw, fallback);
};

// ── Emergency contact ─────────────────────────────────────────
/**
 * Returns a formatted emergency contact string or a friendly fallback.
 * e.g.  "Abebe Kebede (0911234567 · Mother)"
 */
export const emergency = (ec, fallback = 'No Emergency Contact') => {
  if (!ec) return fallback;
  const name  = rv(ec.name, '');
  const ph    = rv(ec.phone, '');
  const rel   = rv(ec.relationship, '');

  if (!name && !ph) return fallback;

  const parts = [];
  if (name) parts.push(name);
  const detail = [ph, rel].filter(Boolean).join(' · ');
  if (detail) parts.push(`(${detail})`);
  return parts.join(' ');
};

// ── Classroom ─────────────────────────────────────────────────
export const classroom = (obj, fallback = 'Unassigned') => {
  if (!obj) return fallback;
  // obj might be a populated object or just a name string
  if (typeof obj === 'string') return rv(obj, fallback);
  return rv(obj.name, fallback);
};

// ── Organisation ──────────────────────────────────────────────
export const organisation = (obj, fallback = 'N/A') => {
  if (!obj) return fallback;
  return rv(obj.organization || obj.organisation, fallback);
};

// ── Age ───────────────────────────────────────────────────────
/**
 * Returns formatted age string, e.g. "3 yrs" or "N/A".
 */
export const age = (value, unit = 'yrs', fallback = 'N/A') => {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  if (isNaN(n)) return fallback;
  return `${n} ${unit}`;
};

// ── Date formatting ───────────────────────────────────────────
/**
 * Format a date value into a readable string.
 * @param {string|Date} value
 * @param {object} opts  - Intl.DateTimeFormatOptions (defaults to readable date)
 */
export const date = (value, opts = {}, fallback = 'N/A') => {
  if (!value) return fallback;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', ...opts,
    });
  } catch {
    return fallback;
  }
};

// ── Initials ──────────────────────────────────────────────────
/**
 * Returns up to 2 initials from a full name string, uppercased.
 */
export const initials = (fullName, fallback = '?') => {
  if (!fullName || typeof fullName !== 'string') return fallback;
  return fullName.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || fallback;
};

// ── Status label ──────────────────────────────────────────────
/**
 * Capitalises a status string, falling back gracefully.
 */
export const status = (value, fallback = 'Unknown') => {
  const raw = rv(value, '');
  if (!raw) return fallback;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

// ── Full name ─────────────────────────────────────────────────
/**
 * Safe full name from a user/child object.
 */
export const fullName = (obj, fallback = 'Unknown') => {
  if (!obj) return fallback;
  if (obj.fullName) return rv(obj.fullName, fallback);
  const first = rv(obj.firstName, '');
  const last  = rv(obj.lastName,  '');
  const combined = `${first} ${last}`.trim();
  return combined || fallback;
};

// ── Default export: all helpers as one object ─────────────────
export default { rv, phone, emergency, classroom, organisation, age, date, initials, status, fullName };
