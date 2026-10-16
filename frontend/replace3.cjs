const fs = require('fs');
const path = require('path');

const transPath = path.join(__dirname, 'src', 'translations.js');
let content = fs.readFileSync(transPath, 'utf8');

// Split the content by the language keys
let parts = content.split('\n  am: {\n');
if (parts.length === 1) parts = content.split('am: {');

let enPart = parts[0];
let rest1 = parts[1].split('om: {');
let amPart = rest1[0];
let rest2 = rest1[1].split('ti: {');
let omPart = rest2[0];
let tiPart = rest2[1];

function replaceVals(text, map) {
    return text.split('\n').map(line => {
        if (line.includes(': "') || line.includes(": '")) {
            let splitChar = line.includes(': "') ? ': "' : ": '";
            let parts = line.split(splitChar);
            if (parts.length === 2) {
                let val = parts[1];
                for (let [search, replace] of Object.entries(map)) {
                    // search is string or regex
                    let regex = new RegExp(search, 'g');
                    val = val.replace(regex, replace);
                }
                return parts[0] + splitChar + val;
            }
        }
        return line;
    }).join('\n');
}

// English
enPart = replaceVals(enPart, {
    'Provider Attendance': 'Nanny Attendance',
    'Provider Login': 'Nanny Login',
    'Total Providers': 'Total Nannies',
    'PROVIDER NAME': 'NANNY NAME',
    'PROVIDERS': 'NANNIES',
    'Provider List': 'Nanny List',
    'Provider profile': 'Nanny profile',
    'Choose Provider': 'Choose Nanny',
    'Provider not selected': 'Nanny not selected',
    'Provider': 'Nanny',
    'providers': 'nannies',
    'provider': 'nanny'
});

// Amharic
amPart = replaceVals(amPart, {
    'የአቅራቢ': 'የሞግዚት',
    'አቅራቢዎች': 'ሞግዚቶች',
    'አቅራቢ': 'ሞግዚት'
});

// Oromiffa
omPart = replaceVals(omPart, {
    'DHIYEESSAA': 'GUDDIFTUU',
    'Dhiyeessaa': 'Guddiftuu',
    'dhiyeessaa': 'guddiftuu'
});

// Tigrinya
tiPart = replaceVals(tiPart, {
    'ኣቕረብቲ': 'ሓለፍቲ ሕፃናት',
    'ኣቕራቢ': 'ሓላፊት ሕፃናት'
});

content = enPart + (content.includes('\n  am: {\n') ? '\n  am: {\n' : 'am: {') + amPart + 'om: {' + omPart + 'ti: {' + tiPart;

fs.writeFileSync(transPath, content, 'utf8');
console.log('translations.js updated for remaining provider strings.');
