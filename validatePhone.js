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

// ── Test cases ────────────────────────────────────────────────────────────────

const testNumbers = [
  // ✅ Valid — Ethio Telecom
  '0912345678',
  '251912345678',
  '+251912345678',

  // ✅ Valid — Safaricom
  '0712345678',
  '251712345678',
  '+251712345678',

  // ❌ Invalid
  '0812345678',      // wrong second digit (8)
  '07123456',        // too short
  '07123456789',     // too long
  '+2519123456789',  // too long with country code
  '712345678',       // missing leading 0 or country code
  '',                // empty
  '09abcde123',      // non-numeric
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('           Ethiopian Phone Number Validation Results               ');
console.log('═══════════════════════════════════════════════════════════════════');

testNumbers.forEach(num => {
  const result = validateEthiopianPhone(num);
  const status = result.valid ? '✅ VALID  ' : '❌ INVALID';
  const info = result.valid
    ? `carrier: ${result.carrier.padEnd(14)}  normalized: ${result.normalized}`
    : `error: ${result.error}`;
  console.log(`${status}  ${String(num || '(empty)').padEnd(20)}  ${info}`);
});

console.log('═══════════════════════════════════════════════════════════════════');
const validCount   = testNumbers.filter(n => validateEthiopianPhone(n).valid).length;
const invalidCount = testNumbers.length - validCount;
console.log(`\n  Total: ${testNumbers.length}  |  ✅ Valid: ${validCount}  |  ❌ Invalid: ${invalidCount}\n`);
