/**
 * Ethiopian Phone Number Validator
 * Supports: Ethio Telecom (09x / +2519x) and Safaricom (07x / +2517x)
 */

const ETHIOPIAN_PHONE_REGEX = /^(?:(?:\+251|251|0)[97]\d{8})$/;

/**
 * Validates an Ethiopian phone number.
 * @param {string} phone - The phone number to validate.
 * @returns {{ valid: boolean, carrier: string|null, normalized: string|null, error: string|null }}
 */
function validateEthiopianPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, carrier: null, normalized: null, error: 'Input must be a non-empty string.' };
  }

  const cleaned = phone.trim().replace(/\s+/g, '');

  if (!ETHIOPIAN_PHONE_REGEX.test(cleaned)) {
    return {
      valid: false,
      carrier: null,
      normalized: null,
      error: `"${cleaned}" is not a valid Ethiopian phone number.`,
    };
  }

  // Normalize to +251 format
  let digits = cleaned;
  if (digits.startsWith('+251'))     digits = digits.slice(4);  // +2519x → 9x
  else if (digits.startsWith('251')) digits = digits.slice(3);  // 2519x  → 9x
  else if (digits.startsWith('0'))   digits = digits.slice(1);  // 09x    → 9x

  const normalized = `+251${digits}`;

  const carrier = digits.startsWith('9') ? 'Ethio Telecom' : 'Safaricom';

  return { valid: true, carrier, normalized, error: null };
}

module.exports = { validateEthiopianPhone };
