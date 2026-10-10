import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/useLanguage';
import api from '../services/api';

const UrgentAnnouncementBanner = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = sessionStorage.getItem('dismissed_urgent_announcements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Display for admin, nanny/teachers, parents, reception, staff
  const allowedRoles = ['admin', 'parent', 'teacher', 'reception', 'staff'];
  const isAllowed = user && allowedRoles.includes(user.role);

  const [timeLeft, setTimeLeft] = useState(10);
  const [isPaused, setIsPaused] = useState(false);

  const fetchUrgentAnnouncements = useCallback(async () => {
    if (!isAllowed) return;
    try {
      const res = await api.get('/messages/urgent-announcements');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAnnouncements(res.data.data);
      }
    } catch {
      // Fallback: check unread messages if endpoint is unavailable
      try {
        const inboxRes = await api.get('/messages/inbox');
        if (inboxRes.data?.data) {
          const urgent = inboxRes.data.data.filter(
            m => !m.isRead && m.priority === 'urgent'
          );
          setAnnouncements(urgent);
        }
      } catch {
        // Silent catch
      }
    }
  }, [isAllowed]);

  // Fetch once on mount — real-time updates come through the socket listener below
  useEffect(() => {
    fetchUrgentAnnouncements();
  }, [fetchUrgentAnnouncements]);

  // Real-time socket listener for incoming urgent announcements
  useEffect(() => {
    if (!socket || !isAllowed) return;

    const handleUrgent = (newMsg) => {
      if (!newMsg) return;
      if (newMsg.priority === 'urgent') {
        setAnnouncements(prev => {
          // Avoid duplicate
          const exists = prev.some(m => m._id === newMsg._id);
          if (exists) return prev;
          return [newMsg, ...prev];
        });
        setTimeLeft(10);
      }
    };

    socket.on('urgentAnnouncement', handleUrgent);
    socket.on('newMessage', handleUrgent);

    return () => {
      socket.off('urgentAnnouncement', handleUrgent);
      socket.off('newMessage', handleUrgent);
    };
  }, [socket, isAllowed]);

  // Filter out any dismissed announcements in this session
  const activeAnnouncements = announcements.filter(a => !dismissedIds.includes(a._id));
  const current = activeAnnouncements[currentIndex] || activeAnnouncements[0];

  const handleDismiss = useCallback(async (e) => {
    e?.stopPropagation?.();
    if (!current) return;
    const idToDismiss = current._id;

    // Update dismissed IDs in state and session storage
    setDismissedIds(prev => {
      const updated = [...prev, idToDismiss];
      try {
        sessionStorage.setItem('dismissed_urgent_announcements', JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });

    // Mark as read in backend
    try {
      await api.put(`/messages/${idToDismiss}/read`);
    } catch {
      // Silent error
    }

    setShowModal(false);
  }, [current]);

  // Reset timer whenever current announcement changes
  useEffect(() => {
    setTimeLeft(10);
  }, [current?._id, currentIndex]);

  // 10-second countdown timer
  useEffect(() => {
    if (!current || isPaused || showModal) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [current, isPaused, showModal, handleDismiss]);

  if (!isAllowed || !current) return null;

  const cleanSubject = current.subject?.replace(/^\[Announcement\]\s*/i, '') || 'Urgent Notice';
  const cleanBody = current.body || '';

  const handleOpenDetails = () => {
    setShowModal(true);
  };

  const handleGoToCommunication = () => {
    setShowModal(false);
    handleDismiss();
    navigate(`/dashboard/${user.role}/communication?tab=announcements`);
  };

  return (
    <>
      {/* ── Urgent Announcement Banner (10s auto-dismiss) ─────────── */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="w-full relative overflow-hidden rounded-2xl mb-5 p-4 sm:p-5 transition-all duration-300 shadow-xl border animate-fade-in group cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, rgba(38, 8, 16, 0.96) 0%, rgba(24, 5, 10, 0.98) 100%)',
          borderColor: 'rgba(244, 63, 94, 0.55)',
          boxShadow: '0 8px 30px rgba(225, 29, 72, 0.22), 0 0 1px rgba(244, 63, 94, 0.6)',
        }}
        onClick={handleOpenDetails}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left section: Icon + Content */}
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            {/* Red Circle with Exclamation Icon */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg text-white font-black"
              style={{
                backgroundColor: '#ff2442',
                boxShadow: '0 0 18px rgba(255, 36, 66, 0.5)',
              }}
            >
              <i className="bx bx-error-circle text-2xl" />
            </div>

            {/* Announcement Texts */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm inline-flex items-center gap-1"
                  style={{ backgroundColor: '#ff2442' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  {t('urgent', 'URGENT')}
                </span>

                {/* 10-second countdown badge */}
                <span className="text-[10px] font-semibold text-rose-200 bg-rose-950/70 px-2 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1">
                  <i className="bx bx-time-five text-xs text-rose-400" />
                  {isPaused ? t('paused', 'Paused') : `${timeLeft}s`}
                </span>

                {activeAnnouncements.length > 1 && (
                  <span className="text-[11px] font-medium text-rose-300/80 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    {currentIndex + 1} of {activeAnnouncements.length}
                  </span>
                )}
              </div>

              <h4 className="text-white font-bold text-base sm:text-lg leading-tight tracking-tight truncate">
                {cleanSubject}
              </h4>

              <p className="text-slate-300 text-xs sm:text-sm mt-1 leading-relaxed line-clamp-2">
                {cleanBody}
              </p>
            </div>
          </div>

          {/* Right section: Action Button & Dismiss */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0" onClick={e => e.stopPropagation()}>
            {activeAnnouncements.length > 1 && (
              <div className="flex items-center mr-1 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentIndex(prev => (prev > 0 ? prev - 1 : activeAnnouncements.length - 1));
                    setTimeLeft(10);
                  }}
                  className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-0.5"
                  title="Previous"
                >
                  <i className="bx bx-chevron-left text-base" />
                  <span>{t('prev', 'Prev')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentIndex(prev => (prev < activeAnnouncements.length - 1 ? prev + 1 : 0));
                    setTimeLeft(10);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-200 hover:text-white bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-0.5 border border-rose-500/30"
                  title="Next"
                >
                  <span>{t('next', 'Next')}</span>
                  <i className="bx bx-chevron-right text-base" />
                </button>
              </div>
            )}

            {/* View Details Button */}
            <button
              type="button"
              onClick={handleOpenDetails}
              className="text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-full transition-all duration-200 cursor-pointer shadow-md hover:scale-105 active:scale-95 whitespace-nowrap"
              style={{
                backgroundColor: '#ff2442',
                boxShadow: '0 4px 14px rgba(255, 36, 66, 0.4)',
              }}
            >
              {t('viewDetails', 'View Details')}
            </button>

            {/* Dismiss Cross */}
            <button
              type="button"
              onClick={handleDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
              title="Dismiss"
              aria-label="Dismiss"
            >
              <i className="bx bx-x text-2xl" />
            </button>
          </div>
        </div>

        {/* 10-second countdown animated progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Urgent Announcement Full Details Modal ────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl border p-6 sm:p-7 shadow-2xl relative"
            style={{
              backgroundColor: '#120509',
              borderColor: 'rgba(244, 63, 94, 0.6)',
              boxShadow: '0 20px 60px rgba(225, 29, 72, 0.35)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-rose-500/20">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black"
                  style={{ backgroundColor: '#ff2442' }}
                >
                  <i className="bx bx-error-circle text-2xl" />
                </div>
                <div>
                  <span
                    className="text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider"
                    style={{ backgroundColor: '#ff2442' }}
                  >
                    {t('urgent', 'URGENT ANNOUNCEMENT')}
                  </span>
                  <p className="text-xs text-rose-300/70 mt-0.5">
                    {current.createdAt
                      ? new Date(current.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <i className="bx bx-x text-2xl" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-5 space-y-3">
              <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                {cleanSubject}
              </h3>

              <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-4 text-slate-200 text-sm leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                {cleanBody}
              </div>

              {current.sender?.fullName && (
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Sent by:</span>{' '}
                  {current.sender.fullName}{' '}
                  <span className="text-rose-400">({current.sender.role || 'Administration'})</span>
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-rose-500/20">
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                {t('dismiss', 'Dismiss & Close')}
              </button>

              <button
                type="button"
                onClick={handleGoToCommunication}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: '#ff2442',
                  boxShadow: '0 4px 16px rgba(255, 36, 66, 0.45)',
                }}
              >
                {t('openInInbox', 'View in Communication')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UrgentAnnouncementBanner;
