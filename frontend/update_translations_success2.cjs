const newTranslations = {
  en: {
    "receiptNumber": "Receipt Number",
    "childName": "Child Name",
    "paymentFor": "Payment For",
    "paymentMethod": "Payment Method",
    "nextDueDate": "Next Due Date",
    "viewInvoices": "View Invoices",
    "backToDashboard": "Back to Dashboard",
    "paymentSuccessful": "Payment Successful!",
    "paymentProcessed": "Your payment has been processed successfully.",
    "thankYouDesc": "Your payment has been completed successfully.",
    "receiptSent": "A receipt has been sent to your email."
  },
  am: {
    "receiptNumber": "የደረሰኝ ቁጥር",
    "childName": "የልጅ ስም",
    "paymentFor": "ክፍያ ለ",
    "paymentMethod": "የክፍያ ዘዴ",
    "nextDueDate": "ቀጣይ የሚከፈልበት ቀን",
    "viewInvoices": "ክፍያዎችን ይመልከቱ",
    "backToDashboard": "ወደ ዳሽቦርድ ይመለሱ",
    "paymentSuccessful": "ክፍያ ተሳክቷል!",
    "paymentProcessed": "ክፍያዎ በተሳካ ሁኔታ ተከናውኗል።",
    "thankYouDesc": "ክፍያዎ በተሳካ ሁኔታ ተጠናቋል።",
    "receiptSent": "ደረሰኝ ወደ ኢሜይልዎ ተልኳል።"
  },
  om: {
    "receiptNumber": "Lakkoofsa Nagahee",
    "childName": "Maqaa Mucaa",
    "paymentFor": "Kaffaltii",
    "paymentMethod": "Mala Kaffaltii",
    "nextDueDate": "Guyyaa Kaffaltii Itti Aanu",
    "viewInvoices": "Nagaheewwan Ilaali",
    "backToDashboard": "Gara Daashboordiitti Deebi'i",
    "paymentSuccessful": "Kaffaltiin Milkaa'eera!",
    "paymentProcessed": "Kaffaltiin kee haala milkaa'een raawwatameera.",
    "thankYouDesc": "Kaffaltiin kee haala milkaa'een xumurameera.",
    "receiptSent": "Nagaheen gara iimeelii keetiitti ergameera."
  },
  ti: {
    "receiptNumber": "ቁጽሪ ቅብሊት",
    "childName": "ስም ቆልዓ",
    "paymentFor": "ክፍሊት ን",
    "paymentMethod": "ኣገባብ ክፍሊት",
    "nextDueDate": "ቀጻሊ ዝኽፈተሉ ዕለት",
    "viewInvoices": "ክፍሊታት ርአ",
    "backToDashboard": "ናብ ዳሽቦርድ ተመለስ",
    "paymentSuccessful": "ክፍሊት ተዓዊቱ!",
    "paymentProcessed": "ክፍሊትካ ብዓወት ተፈጺሙ ኣሎ።",
    "thankYouDesc": "ክፍሊትካ ብዓወት ተዛዚሙ ኣሎ።",
    "receiptSent": "ቅብሊት ናብ ኢመይልካ ተላኢኹ ኣሎ።"
  }
};

const fs = require('fs');
const file = 'c:/Users/HP/Downloads/Telegram Desktop/daycare mint/daycare mint/frontend/src/translations.js';
let content = fs.readFileSync(file, 'utf8');

['en', 'am', 'om', 'ti'].forEach(lang => {
  const marker = `${lang}: {`;
  if (content.includes(marker)) {
    let toInsert = Object.keys(newTranslations[lang]).map(k => `    "${k}": "${newTranslations[lang][k]}",`).join('\\n');
    content = content.replace(marker, marker + '\\n' + toInsert);
  }
});
content = content.replace(/\\n/g, '\n');
fs.writeFileSync(file, content, 'utf8');
