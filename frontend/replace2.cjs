const fs = require('fs');
const path = require('path');

const transPath = path.join(__dirname, 'src', 'translations.js');
let content = fs.readFileSync(transPath, 'utf8');

// Split the content by the language keys
let parts = content.split('\n  am: {\n');
if (parts.length === 1) {
    // maybe indentation is different
    parts = content.split('am: {');
}

let enPart = parts[0];
let rest1 = parts[1].split('om: {');
let amPart = rest1[0];
let rest2 = rest1[1].split('ti: {');
let omPart = rest2[0];
let tiPart = rest2[1];

// Replace in Amharic
amPart = amPart.replace(/ናኒዎች/g, 'ሞግዚቶች');
amPart = amPart.replace(/የናኒ/g, 'የሞግዚት');
amPart = amPart.replace(/ናኒ/g, 'ሞግዚት');
amPart = amPart.replace(/: "Nanny/g, ': "ሞግዚት');

// Replace in Oromiffa
omPart = omPart.replace(/Nanniwwan/g, 'Guddiftuuwwan');
omPart = omPart.replace(/Nanny/g, 'Guddiftuu');

// Replace in Tigrinya
tiPart = tiPart.replace(/Nanniwtat/g, 'ሓለፍቲ ሕፃናት');
tiPart = tiPart.replace(/ናይ ናኒ/g, 'ናይ ሓላፊት ሕፃናት');
tiPart = tiPart.replace(/ናኒ/g, 'ሓላፊት ሕፃናት');
tiPart = tiPart.replace(/: "Nanny/g, ': "ሓላፊት ሕፃናት');
tiPart = tiPart.replace(/: 'Nanny/g, ": 'ሓላፊት ሕፃናት");

content = enPart + (content.includes('\n  am: {\n') ? '\n  am: {\n' : 'am: {') + amPart + 'om: {' + omPart + 'ti: {' + tiPart;

fs.writeFileSync(transPath, content, 'utf8');
console.log('translations.js updated for localized nannies.');
