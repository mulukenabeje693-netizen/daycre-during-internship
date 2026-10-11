import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ChildApprovalNotificationCard
 *
 * Props:
 *   notification  — object with:
 *     status        'approved' | 'disapproved'
 *     childName     string
 *     childId       string (MongoDB _id)
 *     adminReason   string (disapproval reason from admin)
 *     time          Date | string
 *   role          — 'parent' | 'reception'
 *   onDismiss     — optional callback to dismiss/mark-read
 */
const ChildApprovalNotificationCard = ({ notification, role, onDismiss }) => {
  const isApproved = notification.status === 'approved';

  const editLink   = role === 'parent'
    ? `/dashboard/parent/profile-card`
    : `/dashboard/reception/update-info`;

  const viewLink   = role === 'parent'
    ? `/dashboard/parent/profile-card`
    : `/dashboard/reception/update-info`;

  const timeLabel = notification.time
    ? new Date(notification.time).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  /* ═══════════════ DISAPPROVED ═══════════════ */
  if (!isApproved) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-4 shadow-sm">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <i className="bx bx-error-circle text-red-500 text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-red-700">
                  Child Registration Disapproved
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                  Warning
                </span>
              </div>
              {notification.childName && (
                <p className="text-xs text-red-500 mt-0.5 font-medium">
                  {notification.childName}
                </p>
              )}
              {timeLabel && (
                <p className="text-[10px] text-red-400 mt-0.5">{timeLabel}</p>
              )}
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
              aria-label="Dismiss"
            >
              <i className="bx bx-x text-xl" />
            </button>
          )}
        </div>

        {/* Admin Reason Box */}
        <div className="rounded-xl border-l-4 border-red-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">
            Admin Reason / የውድቅ የተደረገበት ምክንያት:
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {notification.adminReason || 'No reason provided by admin.'}
          </p>
        </div>

        {/* What to do next */}
        <div className="rounded-xl bg-red-100/60 border border-red-200 px-4 py-3">
          <p className="text-xs text-red-600 font-medium leading-relaxed">
            <i className="bx bx-info-circle mr-1" />
            Please update the child's information and resubmit for review.
          </p>
        </div>

        {/* Action button */}
        <div className="flex justify-end">
          <Link
            to={editLink}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all shadow-sm hover:shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
          >
            <i className="bx bx-edit-alt text-base" />
            Update Child Details
          </Link>
        </div>
      </div>
    );
  }

  /* ═══════════════ APPROVED ═══════════════ */
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4 shadow-sm">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <i className="bx bx-check-shield text-emerald-600 text-xl" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-emerald-700">
                Registration Approved Successfully 🎉
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                Approved
              </span>
            </div>
            {notification.childName && (
              <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                {notification.childName}
              </p>
            )}
            {timeLabel && (
              <p className="text-[10px] text-emerald-400 mt-0.5">{timeLabel}</p>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-emerald-300 hover:text-emerald-600 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <i className="bx bx-x text-xl" />
          </button>
        )}
      </div>

      {/* Success box */}
      <div className="rounded-xl border-l-4 border-emerald-500 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700 leading-relaxed">
          <span className="font-semibold text-emerald-700">Successfully registered!</span>{' '}
          {notification.childName
            ? <><span className="font-medium">{notification.childName}</span> is now enrolled in the daycare.</>
            : 'The child is now enrolled in the daycare.'
          }
        </p>
      </div>

      {/* Action button */}
      <div className="flex justify-end">
        <Link
          to={viewLink}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-all shadow-sm hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
        >
          <i className="bx bx-user text-base" />
          View Child Profile
        </Link>
      </div>
    </div>
  );
};

export default ChildApprovalNotificationCard;
