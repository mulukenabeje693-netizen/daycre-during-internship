export const isValidChapaReference = value =>
  typeof value === 'string' && /^MINT-[A-Za-z0-9_-]{1,15}$/.test(value);
