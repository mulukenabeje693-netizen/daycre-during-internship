const getManualBankTransferConfig = () => {
  const enabled = process.env.BANK_TRANSFER_ENABLED === 'true';
  const bankName = String(process.env.BANK_TRANSFER_BANK_NAME || '').trim();
  const accountName = String(process.env.BANK_TRANSFER_ACCOUNT_NAME || '').trim();
  const accountNumber = String(process.env.BANK_TRANSFER_ACCOUNT_NUMBER || '').trim();
  const instructions = String(process.env.BANK_TRANSFER_INSTRUCTIONS || '').trim();
  const configured = enabled && Boolean(bankName && accountName && accountNumber);

  return {
    available: configured,
    bankName: configured ? bankName : '',
    accountName: configured ? accountName : '',
    accountNumber: configured ? accountNumber : '',
    instructions: configured ? instructions : ''
  };
};

module.exports = { getManualBankTransferConfig };
