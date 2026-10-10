import React from 'react';

/**
 * TranslatorIcon component
 * Renders the language translator icon (folded book with 'A' and character '文' plus curved arrow).
 * Uses high-res transparent PNGs optimized for both light and dark backgrounds.
 */
const TranslatorIcon = ({ className = 'w-4 h-4', style = {} }) => {
  return (
    <span className={`inline-flex items-center justify-center flex-shrink-0 ${className}`} style={style}>
      {/* Light mode */}
      <img
        src="/assets/optimized/translator-icon-128.webp"
        alt="Translate"
        className="w-full h-full object-contain block dark:hidden select-none pointer-events-none"
      />
      {/* Dark mode */}
      <img
        src="/assets/optimized/translator-icon-dark.webp"
        alt="Translate"
        className="w-full h-full object-contain hidden dark:block select-none pointer-events-none"
      />
    </span>
  );
};

export default TranslatorIcon;
