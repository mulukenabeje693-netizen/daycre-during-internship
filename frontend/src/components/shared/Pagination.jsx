import React from 'react';
import { useLanguage } from '../../context/useLanguage';

const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems = 0,
  itemsPerPage = 5,
  itemLabel = 'items',
}) => {
  const { t } = useLanguage();

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-teal-900/30 text-xs">
      {/* Summary label */}
      <div className="text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1 text-center sm:text-left">
        {totalItems > 0 ? (
          <>
            {t('showing', 'Showing')}{' '}
            <span className="font-semibold text-slate-800 dark:text-white">
              {startIndex}
            </span>{' '}
            {t('to', 'to')}{' '}
            <span className="font-semibold text-slate-800 dark:text-white">
              {endIndex}
            </span>{' '}
            {t('of', 'of')}{' '}
            <span className="font-semibold text-slate-800 dark:text-white">
              {totalItems}
            </span>{' '}
            {itemLabel}
          </>
        ) : (
          <span>0 {itemLabel}</span>
        )}
      </div>

      {/* Controls: Prev / Page numbers / Next */}
      <div className="flex w-full sm:w-auto items-center justify-center gap-1.5 order-1 sm:order-2">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label={t('previous', 'Previous')}
          className="flex shrink-0 items-center justify-center gap-1 min-w-[92px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1520] text-slate-700 dark:text-slate-200 font-medium transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none shadow-sm"
        >
          <i className="bx bx-chevron-left text-base leading-none" />
          <span>{t('previous', 'Previous')}</span>
        </button>

        {/* Page Buttons */}
        <div className="flex items-center justify-center gap-1">
          {pages.map((p, idx) =>
            p === '...' ? (
              <span
                key={`ellipsis-${idx}`}
                className="w-7 text-center text-slate-400 dark:text-slate-500 select-none font-bold"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={currentPage === p ? 'page' : undefined}
                className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                  currentPage === p
                    ? 'bg-teal-600 dark:bg-cyan-600 text-white shadow-sm ring-2 ring-teal-500/20'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label={t('next', 'Next')}
          className="flex shrink-0 items-center justify-center gap-1 min-w-[92px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1520] text-slate-700 dark:text-slate-200 font-medium transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none shadow-sm"
        >
          <span>{t('next', 'Next')}</span>
          <i className="bx bx-chevron-right text-base leading-none" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
