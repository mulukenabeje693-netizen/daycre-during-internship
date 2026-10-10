const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, 'frontend/src/translations.js'), 'utf8'
);

// Strip ES module export keyword, assign to variable for evaluation
const sanitized = src.replace('export const translations =', 'const translations =') + '\nmodule.exports = translations;';

const tmpFile = path.join(__dirname, '_tmp_translations_eval.cjs');
fs.writeFileSync(tmpFile, sanitized);

let langs;
try {
  langs = require(tmpFile);
} finally {
  fs.unlinkSync(tmpFile);
}

const dir = path.join(__dirname, 'frontend/src/locales');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

Object.entries(langs).forEach(([code, dict]) => {
  const outPath = path.join(dir, `${code}.js`);
  fs.writeFileSync(
    outPath,
    `// Auto-split locale file — DO NOT EDIT manually. Edit translations.js instead.\nexport default ${JSON.stringify(dict, null, 2)};\n`
  );
  const size = fs.statSync(outPath).size;
  console.log(`✅  ${code}.js — ${Object.keys(dict).length} keys — ${(size/1024).toFixed(1)} KB`);
});

console.log(`\n📂 Locale files written to: ${dir}`);
