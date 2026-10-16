import React from 'react';

/**
 * Telegram-style delete confirmation modal.
 *
 * Props:
 *  - isOpen        {bool}     show/hide
 *  - title         {string}   modal title  (default "Delete")
 *  - description   {string}   body text
 *  - warning       {string}   red warning line (default "This action cannot be undone.")
 *  - checkboxLabel {string}   optional checkbox label — hidden when falsy
 *  - checked       {bool}     checkbox value
 *  - onCheck       {fn}       checkbox toggle
 *  - onCancel      {fn}       cancel handler
 *  - onConfirm     {fn}       delete/confirm handler
 *  - loading       {bool}     disables confirm button and shows spinner
 *  - confirmLabel  {string}   confirm button label (default "Delete")
 *  - cancelLabel   {string}   cancel button label  (default "Cancel")
 *  - icon          {string}   boxicons class for header icon (default "bx-trash")
 */
const DeleteConfirmModal = ({
  isOpen,
  title       = 'Delete',
  description = 'Are you sure you want to delete this?',
  warning     = 'This action cannot be undone.',
  checkboxLabel,
  checked     = false,
  onCheck,
  onCancel,
  onConfirm,
  loading     = false,
  confirmLabel = 'Delete',
  cancelLabel  = 'Cancel',
  icon         = 'bx-trash',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e2535] shadow-2xl overflow-hidden">

        {/* Icon + Title + Description */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center flex-shrink-0">
            <i className={`bx ${icon} text-2xl text-rose-500`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>

        {/* Warning */}
        {warning && (
          <div className="px-6 pb-3">
            <p className="text-xs font-semibold text-rose-500">{warning}</p>
          </div>
        )}

        {/* Optional checkbox */}
        {checkboxLabel && (
          <div className="px-6 pb-4">
            <label className="flex items-center gap-3 cursor-pointer select-none" onClick={onCheck}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                checked ? 'bg-[#00ADB5] border-[#00ADB5]' : 'border-slate-400 dark:border-slate-500'
              }`}>
                {checked && <i className="bx bx-check text-white text-sm" />}
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">{checkboxLabel}</span>
            </label>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-700" />

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
          >
            {loading && <i className="bx bx-loader-alt animate-spin text-sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
