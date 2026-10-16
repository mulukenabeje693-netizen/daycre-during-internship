import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/useLanguage';

const TYPE_LINK = {
  message: (role, refId) => `/dashboard/${role}/communication?tab=messages&msgId=${refId}`,
  announcement: (role, refId) => `/dashboard/${role}/communication?tab=announcements&id=${refId}`,
  appointment: (role) => `/dashboard/${role}/appointments`,
  payment: (role) => `/dashboard/${role}/payments`,
  child_approval: (role) => role === 'parent'
    ? `/dashboard/parent/registration-updates`
    : `/dashboard/${role}/registration-updates`,
};

const COLOR = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-400' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', dot: 'bg-amber-400' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-500' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
};

function timeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t ? t('justNow') : 'just now';
  if (mins < 60) return `${mins}${t ? t('minutesAgo') : 'm ago'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t ? t('hoursAgo') : 'h ago'}`;
  const days = Math.floor(hrs / 24);
  return `${days}${t ? t('daysAgo') : 'd ago'}`;
}

function getLocalizedNotifTitle(notif, t) {
  if (!notif?.title) return '';
  if (notif.title.startsWith('Overdue invoice — ')) {
    const childName = notif.title.replace('Overdue invoice — ', '');
    return `${t('overdueInvoice')} — ${childName}`;
  }
  if (notif.title.startsWith('Payment due — ')) {
    const childName = notif.title.replace('Payment due — ', '');
    return `${t('paymentDue')} — ${childName}`;
  }
  if (notif.title === 'New message') {
    return t('newMessage');
  }
  if (notif.title === 'Child Registration Update') {
    return t('childRegistrationUpdate');
  }
  if (notif.title.startsWith('Appointment: ')) {
    const apptName = notif.title.replace('Appointment: ', '');
    return `${t('appointmentPrefix')}: ${apptName}`;
  }
  return notif.title;
}

function getLocalizedNotifType(type, t) {
  const typeMap = {
    payment: 'paymentType',
    message: 'messageType',
    announcement: 'announcementType',
    appointment: 'appointmentType',
    child_approval: 'childApprovalType',
  };
  return t(typeMap[type] || type) || type;
}

function getLocalizedNotifBody(notif) {
  if (!notif?.body) return '';
  return notif.body.replace(/\$([0-9.,]+)/g, 'ETB $1');
}

const playPremiumChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const playTone = (freq, time, duration, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
    };

    // Play a nice two-tone chime (G5 then C6)
    playTone(783.99, ctx.currentTime, 0.4, 0.1);
    playTone(1046.50, ctx.currentTime + 0.15, 0.6, 0.1);
  } catch (e) {
    console.warn("Audio Context blocked or unsupported");
  }
};

const NotificationDropdown = ({ role }) => {
  const { socket } = useSocket();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);
  const prevUnreadRef = useRef(null);

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // silently fail — don't break the UI
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial fetch + 60-second poll
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(() => fetchNotifications(true), 60000);
    return () => clearInterval(pollRef.current);
  }, [fetchNotifications]);

  // Socket listener for real-time updates — debounced so a connect
  // event right after mount doesn't fire a duplicate fetch
  useEffect(() => {
    if (!socket) return;
    let debounceTimer = null;
    const handleNewMessage = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchNotifications(true), 1500);
    };
    socket.on('newMessage', handleNewMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
      clearTimeout(debounceTimer);
    };
  }, [socket, fetchNotifications]);

  // Watch for unread count increases to play sound
  useEffect(() => {
    if (prevUnreadRef.current !== null && unreadCount > prevUnreadRef.current) {
      playPremiumChime();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Listen for global request to open notifications (triggered from profile menu)
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      fetchNotifications(true);
    };
    window.addEventListener('openNotifications', onOpen);
    return () => window.removeEventListener('openNotifications', onOpen);
  }, [fetchNotifications]);

  const navigate = useNavigate();

  // ── Mark single notification read ────────────────────────────────
  const handleRead = async (notif) => {
    if (notif.type === 'message') {
      try {
        await api.put(`/notifications/${notif.refId}/read`, { type: 'message' });
      } catch { /* ignore */ }
    }
    // Optimistically mark read in local state
    setNotifications(prev =>
      prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - (notif.read ? 0 : 1)));

    // Navigate to relevant page
    const path = TYPE_LINK[notif.type]?.(role, notif.refId);
    if (path) navigate(path);
  };

  // ── Mark all read ────────────────────────────────────────────────
  const handleClearAll = async () => {
    setClearing(true);
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ } finally {
      setClearing(false);
    }
  };

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          const willOpen = !open;
          setOpen(willOpen);
          if (willOpen) {
            // refresh immediately when opening so users see latest
            fetchNotifications(true);
          }
        }}
        className="relative p-2 bg-card hover:bg-var-surface text-slate-600 dark:text-slate-300 rounded-xl transition-all duration-200 focus:outline-none"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <i className={`bx bx-bell text-xl transition-transform duration-200 ${open ? 'rotate-12' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute -right-12 sm:right-0 mt-2 w-[calc(100vw-32px)] sm:w-[360px] max-w-[360px] max-h-[480px] flex flex-col bg-card border border-glass rounded-2xl shadow-2xl z-[200] overflow-hidden"
          style={{ animation: 'fadeSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-teal-900/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <i className="bx bx-bell text-[var(--primary-light)] text-lg" />
              <span className="font-bold text-primary text-sm">{t('notificationsTitle')}</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">
                  {unreadCount} {t('newBadge')}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold disabled:opacity-50 transition-colors"
              >
                {clearing ? t('clearing') : t('markAllRead')}
              </button>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <i className="bx bx-bell-off text-4xl mb-2 opacity-40" />
                <p className="text-sm font-medium">{t('allCaughtUp')}</p>
                <p className="text-xs mt-1 opacity-60">{t('noNotifications')}</p>
              </div>
            ) : (
              <>
                {/* Unread section */}
                {unread.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {t('newSection')}
                    </p>
                    {unread.map((notif, i) => (
                      <NotifItem key={notif.id} notif={notif} onRead={handleRead} role={role} index={i} t={t} />
                    ))}
                  </div>
                )}

                {/* Read section */}
                {read.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {t('earlierSection')}
                    </p>
                    {read.map((notif, i) => (
                      <NotifItem key={notif.id} notif={notif} onRead={handleRead} role={role} index={i + unread.length} t={t} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-teal-900/30 px-4 py-2.5 flex-shrink-0">
            <button
              onClick={() => { fetchNotifications(); }}
              className="w-full text-center text-xs text-slate-400 hover:text-indigo-400 font-semibold transition-colors py-1"
            >
              <i className="bx bx-refresh mr-1" />
              {t('refresh')}
            </button>
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes itemSlideIn {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .notif-item-anim {
          animation: itemSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
};

// ── Single notification row ───────────────────────────────────────
const NotifItem = ({ notif, onRead, role, index = 0, t }) => {
  const c = COLOR[notif.color] || COLOR.indigo;
  const isChildApproval = notif.type === 'child_approval';
  const localizedTitle = getLocalizedNotifTitle(notif, t);
  const localizedType = getLocalizedNotifType(notif.type, t);

  /* ── child_approval: custom wide card ── */
  if (isChildApproval) {
    const isDisapproval = notif.isDisapproval;
    const cardColor = isDisapproval ? COLOR.amber : COLOR.emerald;
    const updateLink = role === 'parent'
      ? `/dashboard/parent/registration-updates`
      : `/dashboard/${role}/registration-updates`;

    return (
      <div
        className={`notif-item-anim w-full text-left px-4 py-3 border-b border-glass last:border-0 ${notif.read ? 'opacity-60' : ''
          }`}
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${cardColor.bg} flex items-center justify-center mt-0.5 relative`}>
            <i className={`bx ${isDisapproval ? 'bx-error-circle' : 'bx-check-shield'} ${cardColor.text} text-base`} />
            {!notif.read && (
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${cardColor.dot} rounded-full border-2 border-white dark:border-slate-900`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold leading-snug ${notif.read ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {isDisapproval && !notif.read && (
                <span className="inline-block mr-1 text-amber-400">●</span>
              )}
              {localizedTitle}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{getLocalizedNotifBody(notif)}</p>
            <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">{timeAgo(notif.time, t)}</p>
          </div>
        </div>

        {/* Disapproval reason box */}
        {isDisapproval && notif.adminReason && (
          <div className="mt-2.5 ml-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
              {t ? t('adminReason') : 'Admin Reason:'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              {notif.adminReason}
            </p>
          </div>
        )}

        {/* Action link */}
        <div className="mt-2 ml-12">
          <a
            href={updateLink}
            onClick={() => onRead(notif)}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-lg px-2.5 py-1 transition-colors ${isDisapproval
                ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/25'
                : 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-200 dark:hover:bg-cyan-500/25'
              }`}
          >
            <i className="bx bx-edit-alt text-sm" />
            {t ? t('updateChildDetails') : 'Update Child Details'}
          </a>
        </div>
      </div>
    );
  }

  /* ── Regular notification row ── */
  return (
    <button
      onClick={() => onRead(notif)}
      className={`notif-item-anim w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-var-surface transition-colors border-b border-glass last:border-0 ${notif.read ? 'opacity-60' : ''
        }`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Icon bubble */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mt-0.5 relative`}>
        <i className={`bx ${notif.icon} ${c.text}`} />
        {!notif.read && (
          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${c.dot} rounded-full border-2 border-white dark:border-slate-900`} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold leading-snug truncate ${notif.read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'
          }`}>
          {notif.priority === 'high' && !notif.read && (
            <span className="inline-block mr-1 text-rose-400">●</span>
          )}
          {localizedTitle}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{getLocalizedNotifBody(notif)}</p>
        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">{timeAgo(notif.time, t)}</p>
      </div>

      {/* Type badge */}
      <span className={`flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${c.bg} ${c.text} mt-0.5`}>
        {localizedType}
      </span>
    </button>
  );
};

export default NotificationDropdown;

