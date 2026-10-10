import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { useSocket } from '../../context/SocketContext';
import UserAvatar from '../../components/common/UserAvatar';

// ── Smart relative timestamp (updates every 30s via tick state) ─────────────
function timeAgo(dateStr, _tick) {
  // _tick is passed in just to invalidate React's memo cache when it changes
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60)  return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m`;
  const hrs  = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h`;
  const days = Math.floor(hrs  / 24);
  if (days < 7)   return `${days}d`;
  const wks  = Math.floor(days / 7);
  if (wks  < 8)   return `${wks}w`;
  // Older than ~2 months → short date  e.g. "Aug 5"
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLine(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeLine(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Label + count for a broadcast group
function groupLabel(group, count) {
  const labels = {
    all: 'All Users',
    parents: 'Parents',
    teachers: 'Nannies',
    staff: 'All Staff',
    individual: 'Individual',
  };
  const base = labels[group] || 'All Users';
  return count ? `${base} (${count})` : base;
}

// Priority config: maps DB value → colour tokens (labels resolved via t() at render)
const PRIORITY_CONFIG = {
  urgent: { dot: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-500/10' },
  normal: { dot: 'bg-orange-400', text: 'text-orange-500', bg: 'bg-orange-400/10' },
  low: { dot: 'bg-blue-400', text: 'text-blue-500', bg: 'bg-blue-400/10' },
};
function getPriority(p) {
  return PRIORITY_CONFIG[p] || PRIORITY_CONFIG.normal;
}

const INPUT = 'w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

// ── Announcement card ────────────────────────────────────────────────────────
const AnnouncementCard = ({ item, highlighted, innerRef }) => {
  const [expanded, setExpanded] = useState(highlighted || false);

  useEffect(() => {
    if (highlighted) {
      setExpanded(true);
      if (innerRef?.current) {
        innerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlighted, innerRef]);

  const isLong = item.body?.length > 160;
  const preview = isLong && !expanded ? item.body.slice(0, 160) + '…' : item.body;

  const priorityStyle = item.priority === 'urgent'
    ? 'border-rose-500/40 bg-rose-500/5'
    : 'border-slate-200 dark:border-teal-900/30 bg-white dark:bg-[#111c2d]';

  return (
    <div ref={innerRef} className={`rounded-2xl border p-5 transition-all duration-500 ${priorityStyle} ${highlighted ? 'ring-2 ring-indigo-500 shadow-lg' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {item.priority === 'urgent' && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              🚨 Urgent
            </span>
          )}
          <h4 className="font-bold text-slate-800 dark:text-white text-sm">{item.subject}</h4>
        </div>
        <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(item.createdAt)}</span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{preview}</p>
      {isLong && (
        <button onClick={() => setExpanded(p => !p)}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-2">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-teal-900/30">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
          {item.sender?.fullName?.charAt(0) || 'D'}
        </div>
        <span className="text-xs text-slate-400">
          {item.sender?.fullName || 'Daycare'} · {item.sender?.role || 'admin'}
        </span>
      </div>
    </div>
  );
};

// ── Message thread row ───────────────────────────────────────────────────────
const ThreadRow = ({ msg, isSelected, onClick, myId, tick }) => {
  const other = msg.partner || (msg.sender?._id === myId ? msg.recipient : msg.sender);
  const ts    = msg.latestMessageCreatedAt || msg.updatedAt || msg.createdAt;
  const isUnread = !msg.isRead && msg.recipient?._id === myId;
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-[#162030]/50 transition-colors border-b border-slate-100 dark:border-teal-900/30 last:border-0 ${
        isSelected ? 'bg-indigo-500/5 border-r-2 border-indigo-500' : ''
      }`}>
      <UserAvatar
        user={other}
        avatar={other?.avatar}
        name={other?.fullName}
        size="sm"
        ring={false}
        className="w-9 h-9 flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${
            isUnread ? 'font-bold text-slate-800 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'
          }`}>
            {other?.fullName || 'Unknown'}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 tabular-nums">
            {timeAgo(ts, tick)}
          </span>
        </div>
        {/* Last message preview */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-snug">
          {msg.latestMessageBody || msg.body || msg.subject || '—'}
        </p>
        {msg.priority === 'urgent' && (
          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">URGENT</span>
        )}
      </div>
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />
      )}
    </button>
  );
};

// ── Main component ───────────────────────────────────────────────────────────
const Communication = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // tabs: 'announcements' | 'messages'
  const [tab, setTab] = useState('announcements');
  const [announcements, setAnnouncements] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [showContactsDropdown, setShowContactsDropdown] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unread, setUnread] = useState(0);
  const [announceLoading, setAnnounceLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [chatSearch, setChatSearch] = useState('');
  const [targetAnnId, setTargetAnnId] = useState(null);
  const announceRefs = useRef({});
  // Track which announcement is being edited (to pre-fill the form)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null);

  const emptyCompose = { recipientId: '', subject: '', body: '', priority: 'normal' };
  const [compose, setCompose] = useState(emptyCompose);

  const emptyAnnounce = { subject: '', body: '', priority: 'normal' };
  const [announceForm, setAnnounceForm] = useState(emptyAnnounce);
  const [announceTarget, setAnnounceTarget] = useState('all'); // 'all' | 'parents' | 'teachers' | 'staff' | contactId

  const canAnnounce = ['admin'].includes(user?.role);

  // ── Online presence tracking ─────────────────────────────────────────────
  // onlineUsers: Set of userIds currently connected
  // lastSeenMap: Map of userId → ISO date string of last disconnect
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenMap, setLastSeenMap] = useState(new Map());

  // Populate from connectedUsers on mount via a lightweight endpoint
  useEffect(() => {
    api.get('/auth/online-users').then(res => {
      setOnlineUsers(new Set(res.data.onlineIds || []));
    }).catch(() => {});
  }, []);

  // Listen for real-time offline events
  useEffect(() => {
    if (!socket) return;
    const handleUserOffline = ({ userId, lastOnline }) => {
      setOnlineUsers(prev => { const n = new Set(prev); n.delete(userId); return n; });
      setLastSeenMap(prev => new Map(prev).set(userId, lastOnline));
    };
    const handleUserOnline = (userId) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
      setLastSeenMap(prev => { const n = new Map(prev); n.delete(userId); return n; });
    };
    socket.on('userOffline', handleUserOffline);
    socket.on('userOnline',  handleUserOnline);
    return () => {
      socket.off('userOffline', handleUserOffline);
      socket.off('userOnline',  handleUserOnline);
    };
  }, [socket]);
  // Force sidebar timestamps to re-render every 30 s so labels like "1m"
  // automatically advance to "2m" etc. without a page refresh.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Refs for Telegram-style auto-scroll
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);

  // Auto-scroll to bottom whenever thread messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread]);

  // Close three-dot menu when clicking outside — removed (no longer needed)

  const getPartner = (msg) => {
    const senderId = msg.sender?._id?.toString?.() || msg.sender?.toString?.();
    const recipientId = msg.recipient?._id?.toString?.() || msg.recipient?.toString?.();
    const userId = user?._id?.toString?.();

    if (senderId && recipientId) {
      if (senderId === userId) return msg.recipient;
      if (recipientId === userId) return msg.sender;
    }

    if (msg.recipient?.fullName) return msg.recipient;
    if (msg.sender?.fullName) return msg.sender;
    return null;
  };

  const recentChats = useMemo(() => {
    const combined = [...inbox, ...sentMessages].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
    const seen = new Map();

    combined.forEach(msg => {
      const partner = getPartner(msg);
      const key = partner?._id || msg._id;
      if (!seen.has(key)) {
        seen.set(key, { ...msg, partner });
      }
    });

    return Array.from(seen.values());
  // tick refreshes the sort order + displayed labels every 30 s
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox, sentMessages, user?._id, tick]);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  // Helper: wraps any promise with a max wait so the page never hangs forever
  const withTimeout = (promise, ms = 8000) =>
    Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]);

  const parseAnnouncements = useCallback((msgs) => {
    const staffRoles = ['admin', 'teacher', 'reception', 'staff'];
    const grouped = new Map();
    msgs.filter(m => staffRoles.includes(m.sender?.role) && m.subject?.startsWith('[Announcement]')).forEach(msg => {
      const key = msg.broadcastId || `${msg.subject}__${Math.floor(new Date(msg.createdAt).getTime() / 5000)}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          _id: msg._id,
          broadcastId: key,
          subject: msg.subject,
          body: msg.body,
          sender: msg.sender,
          priority: msg.priority,
          broadcastGroup: msg.broadcastGroup,
          broadcastCount: msg.broadcastCount,
          createdAt: msg.createdAt,
        });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, []);

  const fetchInbox = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await api.get('/messages/inbox', { signal: controller.signal });
      clearTimeout(timer);
      const data = res.data.data || [];
      setInbox(data);
      setUnread(res.data.unreadCount || 0);
      if (!canAnnounce) {
        setAnnouncements(parseAnnouncements(data));
      }
      return data;
    } catch { return []; }
  }, [canAnnounce, parseAnnouncements]);

  const fetchAnnouncements = useCallback(async () => {
    if (!canAnnounce) return;
    try {
      const res = await api.get('/messages/announcements');
      setAnnouncements(res.data.data || []);
    } catch { /* silent */ }
  }, [canAnnounce]);

  // ── Socket.io Real-Time Updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      // 1. If it's an announcement, we might just refetch announcements
      if (newMessage.subject?.startsWith('[Announcement]')) {
        fetchAnnouncements();
        return;
      }

      // 2. Otherwise it's a direct message or regular notification
      // Add to inbox so it jumps to the top of recent chats
      setInbox(prev => {
        // If it's already in inbox, don't duplicate
        if (prev.find(m => m._id === newMessage._id)) return prev;
        return [newMessage, ...prev];
      });

      // Increment unread count
      setUnread(prev => prev + 1);

      // 3. If the user currently has this thread open, append to replies
      setThread(prevThread => {
        if (!prevThread) return prevThread;

        // If the new message is a reply to the currently open thread parent
        if (newMessage.parentMessage === prevThread.parent._id) {
          // Check for duplicates
          if (prevThread.replies.find(r => r._id === newMessage._id)) return prevThread;

          return {
            ...prevThread,
            replies: [...prevThread.replies, newMessage]
          };
        }

        // If the new message IS the parent of a thread and it matches the open one
        if (newMessage._id === prevThread.parent._id) {
          return prevThread; // Already open
        }

        return prevThread;
      });
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, fetchAnnouncements]);


  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError('');
    const currentUserId = user?._id || user?.id;
    const userRole = user?.role;
    const parentContactRoles = ['teacher', 'reception', 'admin'];

    const normalizeAndFilter = (list) => {
      const seen = new Set();
      return (list || []).filter(c => {
        if (!c || !c._id) return false;
        const idStr = String(c._id);
        if (idStr === String(currentUserId)) return false;
        if (userRole === 'parent' && !parentContactRoles.includes(c.role)) return false;
        if (seen.has(idStr)) return false;
        seen.add(idStr);
        return true;
      });
    };

    try {
      console.log('[Communication] Fetching contacts for role:', userRole);
      let rawContacts = [];

      if (['admin', 'reception'].includes(userRole)) {
        // /staff/contacts already returns ALL users (including parents) for admin/reception.
        // No need for the separate /staff/parents or /staff calls — they added
        // duplicate data and caused the 341 MB payload on the Communication page.
        const [contactsRes, staffRes] = await Promise.allSettled([
          api.get('/staff/contacts'),
          api.get('/staff'),
        ]);

        if (contactsRes.status === 'fulfilled') {
          const list = Array.isArray(contactsRes.value.data?.data) ? contactsRes.value.data.data : (Array.isArray(contactsRes.value.data) ? contactsRes.value.data : []);
          console.log('[Communication] /api/staff/contacts returned:', list.length);
          rawContacts.push(...list);
        } else {
          console.warn('[Communication] /staff/contacts fetch error:', contactsRes.reason?.message);
        }

        if (staffRes.status === 'fulfilled') {
          const staffList = staffRes.value.data?.data || [];
          console.log('[Communication] /api/staff returned:', staffList.length);
          rawContacts.push(...staffList);
        } else {
          console.warn('[Communication] /staff fetch error:', staffRes.reason?.message);
        }
      } else {
        // Non-admin roles only need the single /staff/contacts call
        try {
          const res = await api.get('/staff/contacts');
          const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          console.log('[Communication] /api/staff/contacts returned:', list.length);
          rawContacts.push(...list);
        } catch (cErr) {
          console.warn('[Communication] /staff/contacts fetch error:', cErr.message);
        }
      }

      const finalContacts = normalizeAndFilter(rawContacts);
      console.log('[Communication] Final combined contacts count:', finalContacts.length);
      setContacts(finalContacts);

      if (finalContacts.length === 0) {
        setContactsError('No user contacts could be loaded. Please click "Reload Contacts" to retry.');
      }
    } catch (err) {
      console.error('[Communication] fetchContacts fatal error:', err);
      setContactsError(err.response?.data?.message || err.message || 'Failed to load contacts');
    } finally {
      setContactsLoading(false);
    }
  }, [user?._id, user?.id, user?.role]);

  // Ensure contacts are loaded whenever announcement form is opened
  useEffect(() => {
    if (showAnnounceForm && contacts.length === 0) {
      fetchContacts();
    }
  }, [showAnnounceForm, contacts.length, fetchContacts]);

  const fetchSent = useCallback(async () => {
    try {
      const res = await api.get('/messages/sent');
      setSentMessages(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Wrap each call with an 8s client-side timeout so the page never
      // spins forever when Atlas is slow — it shows empty state instead.
      await Promise.all([
        withTimeout(fetchInbox()),
        canAnnounce ? withTimeout(fetchAnnouncements()) : Promise.resolve(),
        withTimeout(fetchSent()),
      ]);
      setLoading(false);
      // Fetch contacts after page is visible (non-blocking)
      fetchContacts();
    };
    init();
  }, [fetchAnnouncements, fetchInbox, fetchSent, fetchContacts, canAnnounce]);

  useEffect(() => {
    if (loading) return;

    const tabParam = searchParams.get('tab');
    const msgId = searchParams.get('msgId');
    const annId = searchParams.get('id');

    if (tabParam || msgId || annId) {
      if (tabParam === 'announcements' || annId) {
        setTab('announcements');
        if (annId) setTargetAnnId(annId);
      } else if (tabParam === 'direct' || tabParam === 'messages' || msgId) {
        setTab('messages');
        if (msgId) {
          const allMessages = [...inbox, ...sentMessages];
          const targetMsg = allMessages.find(m => m._id === msgId);
          if (targetMsg && selected?._id !== msgId) {
            openThread(targetMsg);
          } else if (!targetMsg && selected?._id !== msgId) {
            openThread({ _id: msgId });
          }
        }
      }

      // Clear search params in React Router so it never re-triggers or reverts user tab choice
      setSearchParams({}, { replace: true });
    }
  }, [loading, searchParams, setSearchParams, inbox, sentMessages]);

  const openViewAnnouncement = async (a) => {
    setViewingAnnouncement(a);
    if (!a.isRead && a._id) {
      try {
        await api.put(`/messages/${a._id}/read`);
        setAnnouncements(prev => prev.map(item => (item._id === a._id || (a.broadcastId && item.broadcastId === a.broadcastId)) ? { ...item, isRead: true } : item));
      } catch { /* silent */ }
    }
  };

  // ── Open thread ─────────────────────────────────────────────────────────────
  const openThread = async (msg) => {
    setSelected(msg);
    setThread(null);
    setThreadLoading(true);
    setError('');
    try {
      const res = await api.get(`/messages/${msg._id}/thread`);
      setThread(res.data.data);
      setInbox(prev => prev.map(m => m._id === msg._id ? { ...m, isRead: true } : m));
      setUnread(prev => Math.max(0, prev - (msg.isRead ? 0 : 1)));
    } catch {
      setError('Could not load message thread.');
    } finally {
      setThreadLoading(false);
    }
  };

  // ── Send new message ─────────────────────────────────────────────────────────
  const startChatWith = (contact) => {
    setError('');
    setCompose({
      recipientId: contact._id,
      subject: `Chat with ${contact.fullName}`,
      body: '',
      priority: 'normal'
    });
    setShowCompose(true);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/messages', compose);
      setSuccess('Message sent!');
      setShowCompose(false);
      setCompose(emptyCompose);
      await Promise.all([fetchInbox(), fetchSent()]);
      setSelected(res.data.data);
      setThread(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send.');
    }
  };

  // ── Reply ────────────────────────────────────────────────────────────────────
  const [attachment, setAttachment] = useState(null);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim() || !thread) return;
    setError('');
    try {
      const recipientId = thread.parent.sender?._id === user?._id
        ? thread.parent.recipient?._id
        : thread.parent.sender?._id;

      const formData = new FormData();
      formData.append('recipientId', recipientId);
      formData.append('subject', `Re: ${thread.parent.subject}`);
      formData.append('body', replyBody);
      formData.append('parentMessageId', thread.parent._id);
      if (attachment) formData.append('attachment', attachment);

      await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setReplyBody('');
      setAttachment(null);
      setSuccess('Reply sent!');
      await Promise.all([fetchInbox(), fetchSent()]);
      openThread(selected);
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Failed to send reply.');
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const requestDeleteThread = (id) => {
    setDeleteTargetId(id);
    setDeleteForEveryone(false);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/messages/${deleteTargetId}`);
      // Remove from all relevant state slices
      setInbox(prev => prev.filter(m => m._id !== deleteTargetId));
      setSentMessages(prev => prev.filter(m => m._id !== deleteTargetId));
      setAnnouncements(prev => prev.filter(a => a._id !== deleteTargetId && a.broadcastId !== deleteTargetId));
      if (selected?._id === deleteTargetId) {
        setSelected(null);
        setThread(null);
      }
      setSuccess('Deleted successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Delete failed.');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      setDeleteForEveryone(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
    setDeleteForEveryone(false);
  };

  // ── Send Announcement (broadcast to selected recipients) ───────────────────
  const openEditForm = (a) => {
    setEditingAnnouncement(a);
    setAnnounceForm({
      subject: a.subject?.replace('[Announcement] ', '') || '',
      body: a.body || '',
      priority: a.priority || 'normal'
    });
    setAnnounceTarget(a.broadcastGroup || 'all');
    setShowAnnounceForm(true);
    setShowCompose(false);
    setError('');
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!announceForm.subject.trim() || !announceForm.body.trim()) return;
    setAnnounceLoading(true);
    setError('');
    try {
      let recipients = [];

      if (announceTarget === 'all') {
        recipients = contacts;
      } else if (announceTarget === 'parents') {
        recipients = contacts.filter(c => c.role === 'parent');
      } else if (announceTarget === 'teachers') {
        recipients = contacts.filter(c => c.role === 'teacher');
      } else if (announceTarget === 'staff') {
        recipients = contacts.filter(c => ['teacher', 'reception', 'staff'].includes(c.role));
      } else {
        const found = contacts.find(c => c._id === announceTarget);
        if (found) recipients = [found];
      }

      if (recipients.length === 0) {
        setError('No recipients found for the selected group.');
        setAnnounceLoading(false);
        return;
      }

      // Generate a shared broadcast ID so all copies of this message are grouped
      const broadcastId = `bc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const broadcastGroup = ['all', 'parents', 'teachers', 'staff'].includes(announceTarget)
        ? announceTarget
        : 'individual';

      await Promise.allSettled(
        recipients.map(c =>
          api.post('/messages', {
            recipientId: c._id,
            subject: `[Announcement] ${announceForm.subject}`,
            body: announceForm.body,
            priority: announceForm.priority,
            broadcastId,
            broadcastGroup,
            broadcastCount: recipients.length
          })
        )
      );

      setSuccess(`✅ Announcement sent to ${recipients.length} recipient(s)!`);
      setAnnounceForm(emptyAnnounce);
      setAnnounceTarget('all');
      setShowAnnounceForm(false);
      setEditingAnnouncement(null);
      await fetchAnnouncements();
      setTimeout(() => setSuccess(''), 4000);
    } catch {
      setError('Failed to send announcement.');
    } finally {
      setAnnounceLoading(false);
    }
  };

  // ── Personal messages (all inbox, not just staff) ─────────────────────────
  const personalMessages = inbox.filter(m => !['admin', 'teacher', 'reception', 'staff'].includes(m.sender?.role) || tab === 'messages');

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      const query = searchQuery.trim().toLowerCase();
      const cleanSubject = a.subject?.replace('[Announcement] ', '') || '';
      const matchesSearch = !query || [cleanSubject, a.body, a.sender?.fullName]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(query));
      const matchesPriority = priorityFilter === 'all' || a.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [announcements, searchQuery, priorityFilter]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Delete confirmation modal — rendered globally so it works on both tabs */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        title={t('deleteConfirmationTitle', 'Delete Message')}
        description="Are you sure you want to delete this conversation?"
        warning="This action cannot be undone."
        checkboxLabel={t('deleteForEveryone', 'Delete for everyone')}
        checked={deleteForEveryone}
        onCheck={() => setDeleteForEveryone(p => !p)}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
        confirmLabel={t('delete', 'Delete')}
        cancelLabel={t('cancel', 'Cancel')}
      />

      {/* Announcement Detail Modal */}
      {viewingAnnouncement && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewingAnnouncement(null)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111c2d] border border-slate-200 dark:border-teal-900/40 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-teal-900/30">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="bx bx-megaphone text-2xl" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getPriority(viewingAnnouncement.priority).bg} ${getPriority(viewingAnnouncement.priority).text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getPriority(viewingAnnouncement.priority).dot}`} />
                      {viewingAnnouncement.priority === 'urgent' ? t('priorityHigh', 'High') : viewingAnnouncement.priority === 'low' ? t('priorityLow', 'Low') : t('priorityNormal', 'Normal')}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <i className="bx bx-time-five text-[13px]" />
                      {formatDateLine(viewingAnnouncement.createdAt)} · {formatTimeLine(viewingAnnouncement.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                    {viewingAnnouncement.subject?.replace('[Announcement] ', '') || 'Announcement Details'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAnnouncement(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <i className="bx bx-x text-2xl" />
              </button>
            </div>

            {/* Meta info row */}
            <div className="px-6 py-3 bg-slate-50/80 dark:bg-[#0d1520]/80 border-b border-slate-100 dark:border-teal-900/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <UserAvatar
                  user={viewingAnnouncement.sender}
                  avatar={viewingAnnouncement.sender?.avatar}
                  name={viewingAnnouncement.sender?.fullName}
                  size="xs"
                  ring={false}
                />
                <span>{t('sentByCol', 'Sent By')}: <strong className="text-slate-900 dark:text-white">{viewingAnnouncement.sender?.fullName || 'Administrator'}</strong> <span className="capitalize text-slate-400">({viewingAnnouncement.sender?.role || 'Admin'})</span></span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <i className="bx bxs-group text-base text-slate-400" />
                <span>{t('sentToCol', 'Sent To')}: <strong className="text-slate-900 dark:text-white">{groupLabel(viewingAnnouncement.broadcastGroup, viewingAnnouncement.broadcastCount)}</strong></span>
              </div>
            </div>

            {/* Body Content */}
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-teal-500/20">
                {viewingAnnouncement.body || 'No description provided.'}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-teal-900/30 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#0d1520]/40">
              {canAnnounce && (
                <button
                  type="button"
                  onClick={() => {
                    const a = viewingAnnouncement;
                    setViewingAnnouncement(null);
                    openEditForm(a);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 border border-teal-500/30 transition-colors cursor-pointer"
                >
                  <i className="bx bx-edit text-sm" />
                  {t('editAnnouncement', 'Edit Announcement')}
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingAnnouncement(null)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors cursor-pointer"
                >
                  {t('close', 'Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('communicationTitle', 'Communication')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('communicationSubtitle', 'Announcements and direct messages')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* New Announcement — announcements tab + admin/teacher only */}
          {tab === 'announcements' && canAnnounce && (
            <button
              onClick={() => {
                setShowAnnounceForm(p => !p);
                setShowCompose(false);
                setError('');
                fetchContacts();
                if (showAnnounceForm) {
                  setEditingAnnouncement(null);
                  setAnnounceForm(emptyAnnounce);
                  setAnnounceTarget('all');
                }
              }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors text-sm"
            >
              <i className={`bx ${showAnnounceForm ? 'bx-x' : 'bx-megaphone'}`} />
              {showAnnounceForm ? t('cancel', 'Cancel') : t('newAnnouncement', 'New Announcement')}
            </button>
          )}
          {/* New Message — messages tab only */}
          {tab === 'messages' && (
            <button
              onClick={() => { setShowCompose(p => !p); setShowAnnounceForm(false); setError(''); }}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors text-sm"
            >
              <i className={`bx ${showCompose ? 'bx-x' : 'bx-message-square-add'}`} />
              {showCompose ? t('cancel', 'Cancel') : t('newMessage', 'New Message')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-3 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 text-sm">{success}</div>}

      {/* Announcement Compose Form */}
      {showAnnounceForm && canAnnounce && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-amber-500/30 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-xl shadow-sm">
              <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10v4a1 1 0 0 0 1 1h2l2 4h2l-1.5-4H10l9 4V5l-9 4H4a1 1 0 0 0-1 1Z" />
                <path d="M19 9.5a3 3 0 0 1 0 5" />
              </svg>
            </span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editingAnnouncement ? t('editAnnouncement', 'Edit Announcement') : t('broadcastAnnouncement', 'Broadcast Announcement')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{editingAnnouncement ? t('updateResend', 'Update and resend this announcement') : t('sendTo', 'Send an announcement to users')}</p>
            </div>
          </div>

          <form onSubmit={handleSendAnnouncement} className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">{t('sendTo', 'Send To')} *</label>
                    <button
                      type="button"
                      onClick={fetchContacts}
                      disabled={contactsLoading}
                      className="text-xs text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:underline flex items-center gap-1 font-medium disabled:opacity-50 cursor-pointer"
                    >
                      <i className={`bx bx-refresh text-base ${contactsLoading ? 'animate-spin' : ''}`} />
                      {contactsLoading ? 'Loading users...' : contacts.length > 0 ? `✓ ${contacts.length} users ready` : 'Reload Contacts'}
                    </button>
                  </div>
                  {contactsError && (
                    <p className="text-xs text-rose-500 font-medium mb-1.5 flex items-center gap-1">
                      <i className="bx bx-error-circle" /> {contactsError}
                    </p>
                  )}
                  <select
                    value={announceTarget}
                    onChange={e => setAnnounceTarget(e.target.value)}
                    onFocus={() => { if (contacts.length === 0) fetchContacts(); }}
                    className={INPUT}
                  >
                    <optgroup label="── Groups ──">
                      <option value="all">🌐 All Users ({contacts.length})</option>
                      <option value="parents">👨‍👩‍👧 Parents only ({contacts.filter(c => c.role === 'parent').length})</option>
                      <option value="teachers">🎓 Nannies only ({contacts.filter(c => c.role === 'teacher').length})</option>
                      <option value="staff">👷 Staff only ({contacts.filter(c => ['teacher', 'reception', 'staff'].includes(c.role)).length})</option>
                    </optgroup>
                    <optgroup label="── Specific Person ──">
                      {contacts.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.fullName} ({c.role})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('priorityLabel', 'Priority')}</label>
                  <select
                    value={announceForm.priority}
                    onChange={e => setAnnounceForm({ ...announceForm, priority: e.target.value })}
                    className={INPUT}
                  >
                    <option value="low">🔵 {t('priorityLow', 'Low')}</option>
                    <option value="normal">🟠 {t('priorityNormal', 'Normal')}</option>
                    <option value="urgent">🔴 {t('priorityHigh', 'High')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('subjectLabel', 'Subject')} *</label>
                  <input
                    required
                    type="text"
                    placeholder={t('announcementTitle', 'Announcement title…')}
                    value={announceForm.subject}
                    onChange={e => setAnnounceForm({ ...announceForm, subject: e.target.value })}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('messageLabel', 'Message')} *</label>
                  <textarea
                    required
                    rows={7}
                    placeholder={t('typeAnnouncement', 'Type your announcement here…')}
                    value={announceForm.body}
                    onChange={e => setAnnounceForm({ ...announceForm, body: e.target.value })}
                    className={`${INPUT} resize-none min-h-[200px]`}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520] p-4 flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 text-xl">
                    <i className="bx bx-refresh" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('instantDelivery', 'Instant Delivery')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('instantDeliveryDesc', 'Reach all users immediately')}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520] p-4 flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600 text-xl">
                    <i className="bx bx-target-lock" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('smartTargeting', 'Smart Targeting')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('smartTargetingDesc', 'Send to specific groups')}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520] p-4 flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 text-xl">
                    <i className="bx bx-shield-quarter" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('priorityLevels', 'Priority Levels')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('priorityLevelsDesc', 'Set importance levels')}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button type="button" onClick={() => { setShowAnnounceForm(false); setEditingAnnouncement(null); setAnnounceForm(emptyAnnounce); setAnnounceTarget('all'); }}
                  className="rounded-xl border border-slate-200 dark:border-teal-900/30 bg-slate-100 dark:bg-[#0d1520] px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition">
                  {t('cancel', 'Cancel')}
                </button>
                <button type="submit" disabled={announceLoading}
                  className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 transition disabled:opacity-60 flex items-center gap-2">
                  <i className="bx bx-send" />
                  {announceLoading ? t('sending', 'Sending...') : editingAnnouncement ? t('updateResend', 'Update & Resend') : t('sendAnnouncement', 'Send Announcement')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Compose form */}
      {showCompose && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">{t('composeMsgTitle', 'Compose Message')}</h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('toLabel', 'To')} *</label>
              <select required value={compose.recipientId}
                onChange={e => setCompose({ ...compose, recipientId: e.target.value })}
                className={INPUT}>
                <option value="">{t('selectRecipient', 'Select recipient…')}</option>
                {contacts.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.fullName} ({c.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('subjectLabel', 'Subject')}</label>
                <input type="text" placeholder={t('announcementTitle', 'Message subject')} value={compose.subject}
                  onChange={e => setCompose({ ...compose, subject: e.target.value })}
                  className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('priorityLabel', 'Priority')}</label>
                <select value={compose.priority}
                  onChange={e => setCompose({ ...compose, priority: e.target.value })}
                  className={INPUT}>
                  <option value="normal">{t('priorityNormal', 'Normal')}</option>
                  <option value="urgent">🚨 {t('priorityHigh', 'High')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('messageLabel', 'Message')} *</label>
              <textarea required rows={4} placeholder={t('typeAnnouncement', 'Type your message here…')} value={compose.body}
                onChange={e => setCompose({ ...compose, body: e.target.value })}
                className={`${INPUT} resize-none`} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCompose(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors">
                {t('cancel', 'Cancel')}
              </button>
              <button type="submit"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors flex items-center gap-2">
                <i className="bx bx-send" /> {t('send', 'Send')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Communication toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-teal-900/30 dark:bg-[#111c2d] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {[
            { key: 'announcements', label: t('announcements', 'Announcements'), icon: 'bx-megaphone', count: announcements.filter(m => !m.isRead).length },
            { key: 'messages', label: t('directMessages', 'Direct Messages'), icon: 'bx-envelope', count: unread }
          ].map(t => (
            <button
              type="button"
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setSelected(null);
                setThread(null);
                // Close whichever form is open when switching tabs
                setShowAnnounceForm(false);
                setShowCompose(false);
                setEditingAnnouncement(null);
                setAnnounceForm(emptyAnnounce);
                setAnnounceTarget('all');
                if (searchParams.toString()) {
                  setSearchParams({}, { replace: true });
                }
              }}
              className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key
                ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}>
              <i className={`bx ${t.icon}`} />
              {t.label}
              {t.count > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'announcements' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchAnnouncements', 'Search announcements...')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0d1520] py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Priority pill filters */}
            <div className="flex items-center gap-1.5">
              {[
                { value: 'all', label: t('allPriorities'), dot: null, active: 'bg-slate-700 dark:bg-slate-600 text-white border-slate-700 dark:border-slate-600' },
                { value: 'urgent', label: t('priorityHigh'), dot: 'bg-rose-500', active: 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-400/40' },
                { value: 'normal', label: t('priorityNormal'), dot: 'bg-orange-400', active: 'bg-orange-400/15 dark:bg-orange-400/20 text-orange-600 dark:text-orange-400 border-orange-400/40' },
                { value: 'low', label: t('priorityLow'), dot: 'bg-blue-400', active: 'bg-blue-400/15 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 border-blue-400/40' },
              ].map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriorityFilter(p.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${priorityFilter === p.value
                    ? p.active
                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                >
                  {p.dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'announcements' ? (
        <div className="space-y-4">
          {filteredAnnouncements.length === 0 ? (
            <div className="text-center py-20 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
              <i className="bx bx-megaphone text-5xl opacity-30" />
              <p className="mt-3 font-semibold">{t('noAnnouncementsMatch', 'No announcements match your search')}</p>
              <p className="text-xs mt-1 opacity-60">Try adjusting your search terms or filters.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-teal-900/30 bg-white dark:bg-[#111c2d] shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-teal-900/20">
                  <thead className="bg-slate-50 dark:bg-[#0d1520]">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                        {t('announcementCol', 'Announcement')}
                        <span className="ml-1 text-slate-400">↕</span>
                      </th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('sentToCol', 'Sent To')}</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('priorityCol', 'Priority')}</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('sentByCol', 'Sent By')}</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('dateCol', 'Date')}</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('statusCol', 'Status')}</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{t('actionsCol', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-teal-900/20">
                    {filteredAnnouncements.map((a, i) => {
                      const pCfg = getPriority(a.priority);
                      const cleanSubject = a.subject?.replace('[Announcement] ', '') || 'Untitled announcement';
                      const sentToLabel = groupLabel(a.broadcastGroup, a.broadcastCount);
                      const highlighted = targetAnnId === a._id || targetAnnId === a.broadcastId;
                      if (!announceRefs.current[a._id]) {
                        announceRefs.current[a._id] = React.createRef();
                      }
                      return (
                        <tr
                          key={a.broadcastId || a._id}
                          ref={announceRefs.current[a._id]}
                          onClick={() => openViewAnnouncement(a)}
                          className={`cursor-pointer group hover:bg-slate-50/70 dark:hover:bg-[#0d1520]/60 transition-colors ${highlighted ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-500/5' : ''}`}
                        >
                          {/* Announcement title + preview */}
                          <td className="px-6 py-4 max-w-xs">
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-5 truncate group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                              {cleanSubject}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-4">
                              {a.body || 'No description available.'}
                            </p>
                          </td>

                          {/* Sent To */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                              <i className="bx bxs-group text-slate-400 text-base" />
                              {sentToLabel}
                            </div>
                          </td>

                          {/* Priority badge */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${pCfg.bg} ${pCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pCfg.dot}`} />
                              {a.priority === 'urgent' ? t('priorityHigh', 'High') : a.priority === 'low' ? t('priorityLow', 'Low') : t('priorityNormal', 'Normal')}
                            </span>
                          </td>

                          {/* Sent By */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                user={a.sender}
                                avatar={a.sender?.avatar}
                                name={a.sender?.fullName}
                                size="xs"
                                ring={false}
                              />
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {a.sender?.fullName || 'DaycareHQ'}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 capitalize">
                                  {a.sender?.role || 'Administrator'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {formatDateLine(a.createdAt)}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <i className="bx bx-time-five text-[13px]" />
                              {formatTimeLine(a.createdAt)}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              {t('delivered', 'Delivered')}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openViewAnnouncement(a);
                                }}
                                title="View announcement details"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 transition-colors cursor-pointer"
                              >
                                <i className="bx bx-show text-lg" />
                              </button>
                              {canAnnounce && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditForm(a);
                                  }}
                                  title="Edit announcement"
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors cursor-pointer"
                                >
                                  <i className="bx bx-edit text-lg" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteThread(a._id);
                                }}
                                title="Delete announcement"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                <i className="bx bx-trash text-lg" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div className="px-6 py-3 border-t border-slate-100 dark:border-teal-900/20 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{t('showing', 'Showing')} 1 {t('of', 'to')} {Math.min(filteredAnnouncements.length, 10)} {t('of', 'of')} {filteredAnnouncements.length} {t('announcements', 'Announcements').toLowerCase()}</span>
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 hover:bg-slate-50 dark:hover:bg-[#0d1520] transition-colors disabled:opacity-40" disabled>
                    <i className="bx bx-chevron-left" />
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-500 text-white text-xs font-bold">1</button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 hover:bg-slate-50 dark:hover:bg-[#0d1520] transition-colors">
                    <i className="bx bx-chevron-right" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Messages tab ──────────────────────────────────────────────── */}
          {/* Fixed height = viewport minus header (~68px) minus page padding (~80px) */}
          <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4"
            style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>

            {/* ── Left: Contact list — independent scroll ── */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 flex flex-col overflow-hidden min-h-0">
              {/* Header + search */}
              <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-teal-900/30 flex-shrink-0 space-y-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('recentChats', 'Recent Chats')}</h3>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <i className="bx bx-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm pointer-events-none" />
                    <input
                      type="text"
                      value={chatSearch}
                      onChange={e => setChatSearch(e.target.value)}
                      placeholder={t('searchConversations', 'Search conversations...')}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-[#0d1520] border border-transparent focus:border-teal-500/40 focus:ring-0 focus:outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                    />
                  </div>
                  {/* Filter / sort icon */}
                  <button
                    type="button"
                    title="Sort conversations"
                    className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-[#0d1520] text-slate-400 dark:text-slate-500 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
                  >
                    <i className="bx bx-slider-alt text-sm" />
                  </button>
                </div>
              </div>

              <div className="chat-messages overflow-y-auto flex-1 min-h-0">
                {recentChats.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-8 text-slate-400 text-sm">
                    {t('noRecentChats', 'No recent chats yet.')}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
                    {recentChats
                      .filter(msg => {
                        if (!chatSearch.trim()) return true;
                        const q = chatSearch.toLowerCase();
                        const other = msg.partner || getPartner(msg) || (msg.sender?._id === user?._id ? msg.recipient : msg.sender);
                        return (
                          other?.fullName?.toLowerCase().includes(q) ||
                          msg.body?.toLowerCase().includes(q) ||
                          msg.subject?.toLowerCase().includes(q)
                        );
                      })
                      .map(msg => (
                        <ThreadRow
                          key={msg._id}
                          msg={msg}
                          isSelected={selected?._id === msg._id}
                          onClick={() => openThread(msg)}
                          myId={user?._id}
                          tick={tick}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: Active chat window — fixed header + footer, scroll middle ── */}
            <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col overflow-hidden min-h-0">
              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 min-h-0">
                  <i className="bx bx-chat text-4xl opacity-30" />
                  <p className="mt-3 text-xs">{t('selectConversation', 'Select a conversation to view the chat.')}</p>
                </div>
              ) : threadLoading ? (
                <div className="flex-1 flex items-center justify-center py-20 min-h-0">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : thread ? (
                <>
                  {/* Fixed chat header */}
                  <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between gap-4 flex-shrink-0 bg-white dark:bg-[#111c2d]">
                    <div className="flex items-center gap-3 min-w-0">
                      {(() => {
                        const partner = thread.parent.sender?._id === user?._id ? thread.parent.recipient : thread.parent.sender;
                        return (
                          <>
                            <UserAvatar
                              user={partner}
                              avatar={partner?.avatar}
                              name={partner?.fullName}
                              size="md"
                              ring="ring-2 ring-teal-500/20"
                            />
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {partner?.fullName || 'User'}
                              </h3>
                              {(() => {
                                const pid = partner?._id?.toString?.();
                                const isOnline = pid && onlineUsers.has(pid);
                                const lastSeen = pid && lastSeenMap.get(pid);
                                if (isOnline) return (
                                  <p className="flex items-center gap-1 text-[10px] mt-0.5 text-emerald-500 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                    Online
                                  </p>
                                );
                                if (lastSeen) return (
                                  <p className="text-[10px] mt-0.5 text-slate-400">
                                    Last seen {timeAgo(lastSeen)}
                                  </p>
                                );
                                return (
                                  <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-400 mt-0.5 capitalize">
                                    {partner?.role || 'Member'}
                                  </p>
                                );
                              })()}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <button onClick={() => requestDeleteThread(thread.parent._id)}
                      className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 flex-shrink-0">
                      <i className="bx bx-trash text-base" />
                    </button>
                  </div>

                  {/* Independent scrollable messages — flex-1 + min-h-0 is the key */}
                  <div
                    ref={messagesScrollRef}
                    className="chat-messages flex-1 min-h-0 overflow-y-auto px-4 py-5 bg-slate-50 dark:bg-[#0a0f1a]"
                  >
                    <div className="flex flex-col gap-2">
                      {/* Conversation timestamp header */}
                      <div className="text-center text-[9px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 py-2">
                        {t('conversationStarted', 'Conversation started')} {timeAgo(thread.parent.createdAt)}
                      </div>

                      {[thread.parent, ...thread.replies].map(message => {
                        // Robust "mine" detection — compare by ID, email, or name as fallbacks
                        const senderId = message.sender?._id?.toString?.() || message.sender?.toString?.() || '';
                        const myId = user?._id?.toString?.() || '';
                        const mine = (
                          (myId && senderId && senderId === myId) ||
                          (user?.email && message.sender?.email && message.sender.email === user.email) ||
                          (user?.fullName && message.sender?.fullName && message.sender.fullName === user.fullName)
                        );
                        const timeStr = new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        const senderName = message.sender?.fullName || 'Unknown';

                        return (
                          <div key={message._id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                            {/* Avatar for received messages */}
                            {!mine && (
                              <UserAvatar
                                user={message.sender}
                                avatar={message.sender?.avatar}
                                name={senderName}
                                size="xs"
                                ring={false}
                                className="mb-0.5 flex-shrink-0"
                              />
                            )}

                            <div className={`max-w-[65%] sm:max-w-[55%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                              {/* Sender name (only for received) */}
                              {!mine && (
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 ml-1">
                                  {senderName}
                                </span>
                              )}

                              {/* Bubble */}
                              <div
                                className={`relative px-4 py-2.5 shadow-sm ${mine
                                  ? 'bg-teal-500 dark:bg-teal-600 text-white rounded-2xl rounded-br-sm'
                                  : 'bg-white dark:bg-[#1e2d42] border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-sm'
                                  }`}
                              >
                                {/* Message body */}
                                <p className="text-[13.5px] leading-snug whitespace-pre-wrap break-words">
                                  {message.body}
                                </p>

                                {/* Time + read tick */}
                                <div className={`flex items-center justify-end gap-1 mt-1 ${mine ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}`}>
                                  <span className="text-[10px]">{timeStr}</span>
                                  {mine && (
                                    <i className={`bx ${message.isRead ? 'bx-check-double text-sky-300' : 'bx-check'} text-[13px] leading-none`} />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Avatar for sent messages */}
                            {mine && (
                              <UserAvatar
                                user={user}
                                avatar={user?.avatar}
                                name={user?.fullName}
                                size="xs"
                                ring={false}
                                className="mb-0.5 flex-shrink-0"
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* Sentinel — scroll target for auto-scroll to bottom */}
                      <div ref={messagesEndRef} className="h-0 w-full" />
                    </div>
                  </div>

                  {/* Fixed reply bar */}
                  <div className="border-t border-slate-200 dark:border-slate-700/50 p-3 flex-shrink-0 bg-white dark:bg-[#111c2d]">
                    <form onSubmit={handleReply} className="flex items-center gap-2">
                      <label className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#0d1520] p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer flex-shrink-0">
                        <input type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] || null)} />
                        <i className="bx bx-paperclip text-base" />
                      </label>
                      <div className="flex flex-col gap-1 flex-1">
                        <textarea
                          value={replyBody}
                          onChange={e => setReplyBody(e.target.value)}
                          placeholder={t('typeMessage', 'Type your message...')}
                          rows={1}
                          className="w-full min-h-[38px] resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1520] px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        />
                        {attachment && (
                          <div className="text-[10px] text-slate-400">
                            Attached: {attachment.name} ({Math.ceil(attachment.size / 1024)} KB)
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!replyBody.trim() && !attachment}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#00b09b] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#00968a] transition disabled:opacity-50 flex-shrink-0"
                      >
                        <i className="bx bx-send" /> {t('send', 'Send')}
                      </button>
                    </form>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Communication;

