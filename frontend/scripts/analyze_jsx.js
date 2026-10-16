const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '../src/pages/features/MakePayment.jsx');
const text = fs.readFileSync(p, 'utf8');
const lines = text.split(/\r?\n/);
const tagRegex = /<([A-Za-z][A-Za-z0-9\-]*)([^>]*)>|<\/([A-Za-z][A-Za-z0-9\-]*)\s*>|<([A-Za-z][A-Za-z0-9\-]*)([^>]*)\/\s*>/g;
const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
let stack = [];
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let match;
  // simple parser: find <tag ...>, </tag>, and self-closing
  while ((match = tagRegex.exec(line)) !== null) {
    if (match[1]) {
      // opening or self-closing captured in group 1
      const tag = match[1];
      const raw = match[0];
      const selfClose = /\/>\s*$/.test(raw) || voids.has(tag.toLowerCase());
      if (!selfClose) stack.push({tag, line: i+1});
    } else if (match[3]) {
      // closing tag
      const tag = match[3];
      if (!stack.length) {
        console.log('Unmatched closing tag', tag, 'at line', i+1);
      } else {
        const top = stack.pop();
        if (top.tag !== tag) {
          console.log('Tag mismatch: opened', top.tag, 'at line', top.line, 'but closed', tag, 'at line', i+1);
        }
      }
    }
  }
}
if (stack.length) {
  console.log('Unclosed tags (most recent 20):');
  stack.slice(-20).forEach(s => console.log(s.line, s.tag));
} else {
  console.log('No unclosed tags found');
}
