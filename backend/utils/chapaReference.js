const crypto = require('crypto');

const CHAPA_REFERENCE_PREFIX = 'MINT-';
const CHAPA_REFERENCE_MAX_LENGTH = 20;
const CHAPA_REFERENCE_SUFFIX_LENGTH = CHAPA_REFERENCE_MAX_LENGTH - CHAPA_REFERENCE_PREFIX.length;

const createChapaReference = () =>
  `${CHAPA_REFERENCE_PREFIX}${crypto.randomBytes(11).toString('base64url')}`;

const isValidChapaReference = value =>
  typeof value === 'string' &&
  value.length <= CHAPA_REFERENCE_MAX_LENGTH &&
  new RegExp(`^${CHAPA_REFERENCE_PREFIX}[A-Za-z0-9_-]{1,${CHAPA_REFERENCE_SUFFIX_LENGTH}}$`).test(value);

module.exports = {
  CHAPA_REFERENCE_MAX_LENGTH,
  createChapaReference,
  isValidChapaReference
};
