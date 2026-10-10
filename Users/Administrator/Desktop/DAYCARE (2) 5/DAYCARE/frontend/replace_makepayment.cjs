const fs = require('fs');

const file = 'c:/Users/HP/Downloads/Telegram Desktop/daycare mint/daycare mint/frontend/src/pages/features/MakePayment.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import useLanguage
if (!content.includes('useLanguage')) {
  content = content.replace(
    "import { useAuth } from '../../context/AuthContext';",
    "import { useAuth } from '../../context/AuthContext';\\nimport { useLanguage } from '../../context/useLanguage';"
  );
}

// 2. We need to pass `t` as a prop to components, or use `useLanguage` inside them if they are separate components.
// The components are Stepper, InvoiceCard, SummarySidebar, Step1, Step2, Step3, MakePayment.
// Since we don't want to refactor all components, it's easier to add `const { t } = useLanguage();` inside MakePayment, and pass `t={t}` to children, OR add it to each component.
// Let's add it to each component.

const components = ['Stepper', 'InvoiceCard', 'SummarySidebar', 'Step1', 'Step2', 'Step3', 'MakePayment'];
components.forEach(comp => {
  const marker1 = `const ${comp} = ({`;
  const marker2 = `const ${comp} = () => {`;
  const inject = `  const { t } = useLanguage();\\n`;
  if (content.includes(marker1)) {
    // Find the end of the destructuring "}) => {" or "} ) => {"
    let idx = content.indexOf(marker1);
    let arrowIdx = content.indexOf('=>', idx);
    let blockIdx = content.indexOf('{', arrowIdx);
    
    // Sometimes it's `=> (`. We need to convert it to `=> { ... return ( ... ) }`
    // Actually, Stepper and Step2 are using `=> (`
    let slice = content.substring(arrowIdx, arrowIdx + 20);
    if (slice.includes('=> (')) {
        let regex = new RegExp(`const ${comp} = \\(([^)]*)\\) => \\(`);
        let match = content.match(regex);
        if(match) {
            // we have to be careful with parenthesis balancing to replace `(` with `{ ... return (`
            // A safer way is string replace if we know the exact string.
        }
    }
  }
});
