/**
 * Ethiopian phone number validation utilities
 *
 * Valid formats:
 *   Ethio Telecom: 09XXXXXXXX | +2519XXXXXXXX | 2519XXXXXXXX
 *   Safaricom ET:  07XXXXXXXX | +2517XXXXXXXX | 2517XXXXXXXX
 *
 * Both expand to exactly 10 local digits (0X_XXXXXXXX) or
 * 12 chars with country code (+251XXXXXXXXX).
 */

// Matches 09… or 07… local format AND +251/251 international format
export const ETHIO_TELECOM_RE  = /^(?:(?:\+251|251)9|09)\d{8}$/;
export const SAFARICOM_ET_RE   = /^(?:(?:\+251|251)7|07)\d{8}$/;
export const ETH_PHONE_RE      = /^(?:(?:\+251|251)[97]|0[97])\d{8}$/;

/**
 * Normalise a phone string to a comparable canonical form (+251XXXXXXXXX).
 * Returns null when the input is falsy/blank.
 */
export function normalizePhone(value) {
  if (!value || !value.trim()) return null;
  let v = value.trim().replace(/\s+/g, '');
  if (v.startsWith('+251')) return v;           // already canonical
  if (v.startsWith('251'))  return `+${v}`;     // 251… → +251…
  if (v.startsWith('0'))    return `+251${v.slice(1)}`; // 09… → +2519…
  return v; // unexpected — return as-is so the regex catches it
}

/**
 * Validate a single Ethiopian phone number.
 *
 * @param {string} value  Raw input from the field
 * @param {boolean} required  When false, empty strings are accepted (returns '')
 * @returns {string}  Empty string = valid.  Non-empty = error message to display.
 */
export function validateEthPhone(value, required = false) {
  const cleaned = value ? value.trim().replace(/\s+/g, '') : '';

  if (!cleaned) {
    return required ? 'Phone number is required.' : '';
  }

  if (!ETH_PHONE_RE.test(cleaned)) {
    return 'Invalid Ethiopian phone number. Must start with +2519, +2517, 09, or 07 followed by 8 digits.';
  }

  return '';
}

/**
 * Check whether two phone values refer to the same number (format-insensitive).
 *
 * @param {string} phone1
 * @param {string} phone2
 * @returns {boolean}  true when both are non-empty AND normalise to the same value
 */
export function phonesAreEqual(phone1, phone2) {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

/**
 * Full validation for a (primaryPhone, emergencyContactPhone) pair.
 *
 * Returns an object: { primaryError, emergencyError }
 * Empty string = no error on that field.
 */
export function validatePhonePair(primaryPhone, emergencyPhone, {
  primaryRequired = false,
  emergencyRequired = false,
} = {}) {
  const primaryError   = validateEthPhone(primaryPhone,   primaryRequired);
  let   emergencyError = validateEthPhone(emergencyPhone, emergencyRequired);

  // Only check equality when both numbers are present and individually valid
  if (!primaryError && !emergencyError && primaryPhone?.trim() && emergencyPhone?.trim()) {
    if (phonesAreEqual(primaryPhone, emergencyPhone)) {
      emergencyError = 'Emergency contact phone must be different from the primary phone number.';
    }
  }

  return { primaryError, emergencyError };
}
