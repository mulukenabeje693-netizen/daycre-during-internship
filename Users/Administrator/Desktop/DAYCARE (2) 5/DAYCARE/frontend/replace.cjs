const fs = require('fs');
const path = require('path');

const transPath = path.join(__dirname, 'src', 'translations.js');
let content = fs.readFileSync(transPath, 'utf8');

content = content.split('\n').map(line => {
    if (line.includes(': "') || line.includes(": '")) {
        let parts = line.split(': "');
        if (parts.length === 2) {
            let val = parts[1];
            
            // English
            val = val.replace(/Teacher's/g, "Nanny's");
            val = val.replace(/teacher's/gi, "nanny's");
            val = val.replace(/Teachers/g, "Nannies");
            val = val.replace(/teachers/gi, "nannies");
            val = val.replace(/Teacher/g, "Nanny");
            val = val.replace(/teacher/gi, "nanny");
            val = val.replace(/childcare providers/gi, "Nannies");
            val = val.replace(/childcare provider/gi, "Nanny");
            
            // Amharic
            val = val.replace(/አስተማሪዎች/g, "ናኒዎች");
            val = val.replace(/አስተማሪ/g, "ናኒ");
            
            // Oromiffa
            val = val.replace(/Barsiisoota/g, "Nanniwwan");
            val = val.replace(/Barsiisota/g, "Nanniwwan");
            val = val.replace(/Barsiisaa/gi, "Nanny");
            
            // Tigrinya
            val = val.replace(/መምህራን/g, "Nanniwtat");
            val = val.replace(/መምህር/g, "ናኒ");
            
            return parts[0] + ': "' + val;
        }
    }
    return line;
}).join('\n');

fs.writeFileSync(transPath, content, 'utf8');
console.log('translations.js updated');

// Update index.html
const indexPath = path.join(__dirname, '..', 'Daycare', 'decare', 'frontend', 'index.html');
if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    indexContent = indexContent.replace(/childcare providers/gi, "Nannies");
    indexContent = indexContent.replace(/childcare provider/gi, "Nanny");
    // Also replace teacher/teachers if they refer to the provider. 
    // In index.html line 140: "Trusted by childcare providers, teachers, and families" -> "Trusted by Nannies, Nannies, and families"? 
    // No, maybe we shouldn't replace "teachers" globally in index.html, it might look weird "Nannies, nannies, and families". Let's just fix childcare provider in index.html.
    indexContent = indexContent.replace(/Trusted by Nannies, teachers, and families/, "Trusted by Nannies and families");
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log('index.html updated');
} else {
    console.log('index.html not found at ' + indexPath);
}
