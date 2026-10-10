const newTranslations = {
  en: {
    "amountPaid": "Amount Paid",
    "transactionId": "Transaction ID",
    "datePaid": "Date",
    "paidBy": "Paid By",
    "downloadReceipt": "Download Receipt",
    "returnToDashboard": "Return to Dashboard",
    "paymentVerified": "Payment Verified Successfully!",
    "thankYou": "Thank you! Your transaction was completed securely.",
    "verifyingPayment": "Verifying Payment...",
    "pleaseWaitWhile": "Please wait while we confirm your transaction.",
    "paymentFailed": "Payment Failed or Cancelled",
    "transactionCouldNotBe": "The transaction could not be verified or was cancelled."
  },
  am: {
    "amountPaid": "የተከፈለው መጠን",
    "transactionId": "የግብይት መታወቂያ",
    "datePaid": "ቀን",
    "paidBy": "ከፋይ",
    "downloadReceipt": "ደረሰኝ ያውርዱ",
    "returnToDashboard": "ወደ ዳሽቦርድ ተመለስ",
    "paymentVerified": "ክፍያው በተሳካ ሁኔታ ተረጋግጧል!",
    "thankYou": "እናመሰግናለን! ግብይትዎ በሰላም ተጠናቋል።",
    "verifyingPayment": "ክፍያ በማረጋገጥ ላይ...",
    "pleaseWaitWhile": "እባክዎ ግብይትዎን ስናረጋግጥ ይጠብቁ።",
    "paymentFailed": "ክፍያ አልተሳካም ወይም ተሰርዟል",
    "transactionCouldNotBe": "ግብይቱ ሊረጋገጥ አልቻለም ወይም ተሰርዟል።"
  },
  om: {
    "amountPaid": "Hanga Kaffalame",
    "transactionId": "Eenyummeessa Darbiinsaa",
    "datePaid": "Guyyaa",
    "paidBy": "Kan Kaffale",
    "downloadReceipt": "Nagahee Buufadhu",
    "returnToDashboard": "Gara Daashboordiitti Deebi'i",
    "paymentVerified": "Kaffaltiin Milkaa'inaan Mirkanaa'eera!",
    "thankYou": "Galatoomi! Darbiinsi kee haala amansiisaa ta'een xumurameera.",
    "verifyingPayment": "Kaffaltii Mirkaneessaa jira...",
    "pleaseWaitWhile": "Osoo darbiinsa kee mirkaneessinuu maaloo eegi.",
    "paymentFailed": "Kaffaltiin Fashalaa'eera ykn Haqameera",
    "transactionCouldNotBe": "Darbiinsi hin mirkanaa'u ykn haqameera."
  },
  ti: {
    "amountPaid": "ዝተኸፍለ መጠን",
    "transactionId": "መንነት ትራንዛክሽን",
    "datePaid": "ዕለት",
    "paidBy": "ከፋላይ",
    "downloadReceipt": "ቅብሊት ኣውርድ",
    "returnToDashboard": "ናብ ዳሽቦርድ ተመለስ",
    "paymentVerified": "ክፍሊት ብዓወት ተረጋጊጹ!",
    "thankYou": "የቐንየልና! ትራንዛክሽንካ ብውሑስ መገዲ ተዛዚሙ።",
    "verifyingPayment": "ክፍሊት የረጋግጽ ኣሎ...",
    "pleaseWaitWhile": "በጃኻ ትራንዛክሽንካ ክነረጋግጽ ተጸበ።",
    "paymentFailed": "ክፍሊት ኣይተዓወተን ወይ ተሰሪዙ",
    "transactionCouldNotBe": "እቲ ትራንዛክሽን ክረጋገጽ ኣይከኣለን ወይ ተሰሪዙ እዩ።"
  }
};

const fs = require('fs');
const path = require('path');
const file = 'c:/Users/HP/Downloads/Telegram Desktop/daycare mint/daycare mint/frontend/src/translations.js';

let content = fs.readFileSync(file, 'utf8');

['en', 'am', 'om', 'ti'].forEach(lang => {
  const marker = `${lang}: {`;
  if (content.includes(marker)) {
    let toInsert = Object.keys(newTranslations[lang]).map(k => `    "${k}": "${newTranslations[lang][k]}",`).join('\\n');
    content = content.replace(marker, marker + '\\n' + toInsert);
  }
});

fs.writeFileSync(file, content, 'utf8');
console.log("Translations added for PaymentSuccess!");
