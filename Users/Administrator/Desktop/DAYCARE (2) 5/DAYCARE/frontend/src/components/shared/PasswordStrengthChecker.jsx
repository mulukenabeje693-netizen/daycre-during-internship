/**
 * PasswordStrengthChecker
 * Drop-in component — shows a compact space-saving progress bar and dynamic helper text.
 *
 * Usage:
 *   import PasswordStrengthChecker, { validatePassword } from './PasswordStrengthChecker';
 *   <PasswordStrengthChecker password={value} />
 *
 * validatePassword(value) → '' if all rules pass, else an error string.
 */
import React from 'react';
import { useLanguage } from '../../context/useLanguage';

// ── Rules ────────────────────────────────────────────────────────────────────
export const PWD_RULES = [
  { id: 'len',  label: '8+ chars',       test: (v) => v.length >= 8 },
  { id: 'up',   label: 'uppercase',      test: (v) => /[A-Z]/.test(v) },
  { id: 'low',  label: 'lowercase',      test: (v) => /[a-z]/.test(v) },
  { id: 'num',  label: 'number',         test: (v) => /[0-9]/.test(v) },
  { id: 'spec', label: 'special char',   test: (v) => /[^A-Za-z0-9]/.test(v) },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
export const getStrengthScore = (pw) =>
  PWD_RULES.reduce((acc, r) => acc + (r.test(pw) ? 1 : 0), 0);

const STRENGTH_META = {
  en: [
    { label: 'Weak',      color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'Weak',      color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'Medium',    color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'Medium',    color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'Strong',    color: '#14b8a6', tw: 'bg-teal-500' },
    { label: 'Excellent', color: '#34d399', tw: 'bg-emerald-400' },
  ],
  am: [
    { label: 'ደካማ',      color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'ደካማ',      color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'መካከለኛ',   color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'መካከለኛ',   color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'ጠንካራ',    color: '#14b8a6', tw: 'bg-teal-500' },
    { label: 'እጅጉን ጠንካራ', color: '#34d399', tw: 'bg-emerald-400' },
  ],
  om: [
    { label: 'Laafaa',    color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'Laafaa',    color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'Giddu-galeessa', color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'Giddu-galeessa', color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'Jabaa',     color: '#14b8a6', tw: 'bg-teal-500' },
    { label: 'Baay\'ee Jabaa', color: '#34d399', tw: 'bg-emerald-400' },
  ],
  ti: [
    { label: 'ደኻም',      color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'ደኻም',      color: '#f43f5e', tw: 'bg-rose-500' },
    { label: 'ማእከላዊ',   color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'ማእከላዊ',   color: '#f59e0b', tw: 'bg-amber-500' },
    { label: 'ጠንካራ',    color: '#14b8a6', tw: 'bg-teal-500' },
    { label: 'ኣዝዩ ጠንካራ', color: '#34d399', tw: 'bg-emerald-400' },
  ],
};

export const getMissingText = (pw) => {
  if (!pw) return 'Must be at least 8 chars with A-Z, 0-9, and symbols';
  
  const missing = PWD_RULES.filter(r => !r.test(pw));
  if (missing.length === 0) return '✓ Strong & secure password';

  const parts = missing.map(r => r.label);

  if (parts.length === 1) {
    if (!PWD_RULES[1].test(pw)) return 'Needs an uppercase letter (A-Z)';
    if (!PWD_RULES[2].test(pw)) return 'Needs a lowercase letter (a-z)';
    if (!PWD_RULES[3].test(pw)) return 'Needs a number (0-9)';
    if (!PWD_RULES[4].test(pw)) return 'Needs a special character';
    if (!PWD_RULES[0].test(pw)) return 'Must be at least 8 characters';
  }

  const last = parts.pop();
  return `Needs ${parts.join(', ')} & ${last}`;
};

/**
 * Returns '' if password passes all rules, otherwise an error message.
 */
export const validatePassword = (pw) => {
  if (!pw) return 'Password is required.';
  const failed = PWD_RULES.filter((r) => !r.test(pw));
  if (failed.length === 0) return '';
  return `Password must include: ${failed.map((r) => r.label).join(', ')}.`;
};

// ── Component ────────────────────────────────────────────────────────────────
const PasswordStrengthChecker = ({ password = '' }) => {
  const { locale } = useLanguage();
  const L = locale || 'en';
  const lx = (en, am, om, ti) => L === 'am' ? am : L === 'om' ? om : L === 'ti' ? ti : en;
  const score = getStrengthScore(password);
  const metaList = STRENGTH_META[L] || STRENGTH_META['en'];
  const meta  = metaList[score];

  const getLocalizedMissingText = (pw) => {
    if (!pw) return lx('Must be at least 8 chars with A-Z, 0-9, and symbols', 'ቢያንስ 8 ፊደሎች፣ A-Z፣ 0-9 እና ምልክቶች ያስፈልጋሉ', 'Qubee 8+, A-Z, 0-9 fi mallattoowwan barbaachisoo', 'ዝወሓደ 8 ፊደላት፣ A-Z፣ 0-9 ምልክታትን የድልዩ');
    const missing = PWD_RULES.filter(r => !r.test(pw));
    if (missing.length === 0) return lx('✓ Strong & secure password', '✓ ጠንካራ እና ደህንነቱ የተጠበቀ የይለፍ ቃል', '✓ Jecha darbii jabaa fi nagaha', '✓ ጠንካራን ውሑስን ምስጢር ቃል');
    if (!PWD_RULES[1].test(pw)) return lx('Needs an uppercase letter (A-Z)', 'ትልቅ ፊደል ያስፈልጋል (A-Z)', 'Qubee guddaa (A-Z) barbaachisa', 'ዓቢ ፊደል (A-Z) የድሊ');
    if (!PWD_RULES[2].test(pw)) return lx('Needs a lowercase letter (a-z)', 'ትንሽ ፊደል ያስፈልጋል (a-z)', 'Qubee xixiqqaa (a-z) barbaachisa', 'ንኣሽቶ ፊደል (a-z) የድሊ');
    if (!PWD_RULES[3].test(pw)) return lx('Needs a number (0-9)', 'ቁጥር ያስፈልጋል (0-9)', 'Lakkoofsa (0-9) barbaachisa', 'ቁጽሪ (0-9) የድሊ');
    if (!PWD_RULES[4].test(pw)) return lx('Needs a special character', 'ልዩ ምልክት ያስፈልጋል', 'Mallattoo addaa barbaachisa', 'ፍሉይ ምልክት የድሊ');
    if (!PWD_RULES[0].test(pw)) return lx('Must be at least 8 characters', 'ቢያንስ 8 ፊደሎች ያስፈልጋሉ', 'Qubee 8 ol barbaachisa', 'ዝወሓደ 8 ፊደላት የድልዩ');
    return lx('Almost there!', 'ሊደርስ ነው!', 'Itti dhiyaateera!', 'ቀሪቡ ኣሎ!');
  };

  const missingText = getLocalizedMissingText(password);

  return (
    <div className="flex items-center justify-between gap-3 text-xs mt-1.5 w-full">
      {/* Left Side: Progress Bar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex gap-1 w-20">
          {[1, 2, 3, 4, 5].map((seg) => (
            <div
              key={seg}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                seg <= score ? meta.tw : 'bg-slate-200 dark:bg-slate-700/50'
              }`}
            />
          ))}
        </div>
        {password.length > 0 && (
          <span className="font-bold text-[10px] w-12" style={{ color: meta.color }}>
            {meta.label}
          </span>
        )}
      </div>

      {/* Right Side: Dynamic Helper Text */}
      <div className={`text-[10px] text-right truncate ${score === 5 ? 'text-teal-400 font-bold' : 'text-slate-400'}`}>
        {missingText}
      </div>
    </div>
  );
};

export default PasswordStrengthChecker;
