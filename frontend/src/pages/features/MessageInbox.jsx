import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const MessageInbox = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [thread, setThread] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const emptyCompose = { recipientId: '', subject: '', body: '', priority: 'normal' };
  const [compose, setCompose] = useState(emptyCompose);
  const [replyBody, setReplyBody] = useState('');

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const endpoint = tab === 'inbox' ? '/messages/inbox' : '/messages/sent';
      const res = await api.get(endpoint);
      setMessages(res.data.data);
    } catch (err) {
      setError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/staff');
      setContacts(res.data.data);
    } catch {
      // If not admin, load parents or teachers
      try {
        const childrenRes = await api.get('/children');
        // Extract unique parents/teachers via children
        const res2 = await api.get('/classrooms');
        const teachers = res2.data.data
          .filter(c => c.teacher)
          .map(c => c.teacher);
        setContacts(teachers);
      } catch {}
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchContacts();
  }, [tab]);

  const openMessage = async (msg) => {
    setSelectedMessage(msg);
    setThreadLoading(true);
    try {
      const res = await api.get(`/messages/${msg._id}/thread`);
      setThread(res.data.data);
      // Update local read status
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, isRead: true } : m));
    } catch (err) {
      setError('Failed to load message thread.');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/messages', compose);
      setSuccess('Message sent!');
      setShowCompose(false);
      setCompose(emptyCompose);
      if (tab === 'sent') fetchMessages();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message.');
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    try {
      await api.post('/messages', {
        recipientId: tab === 'inbox' ? thread.parent.sender._id : thread.parent.recipient._id,
        subject: `Re: ${thread.parent.subject}`,
        body: replyBody,
        parentMessageId: thread.parent._id
      });
      setSuccess('Reply sent!');
      setReplyBody('');
      openMessage(selectedMessage);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to send reply.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/messages/${id}`);
      setMessages(prev => prev.filter(m => m._id !== id));
      setSelectedMessage(null);
      setThread(null);
    } catch (err) {
      setError('Delete failed.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Messages</h2>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors"
        >
          <i className={`bx ${showCompose ? 'bx-x' : 'bx-message-square-add'}`} />
          {showCompose ? 'Cancel' : 'New Message'}
        </button>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-3 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 text-sm">✅ {success}</div>}

      {/* Compose Form */}
      {showCompose && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Compose Message</h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">To *</label>
              <select required value={compose.recipientId} onChange={e => setCompose({ ...compose, recipientId: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Recipient</option>
                {contacts.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Subject</label>
              <input type="text" value={compose.subject} placeholder="Message subject" onChange={e => setCompose({ ...compose, subject: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Message *</label>
              <textarea required rows={4} value={compose.body} placeholder="Type your message here..."
                onChange={e => setCompose({ ...compose, body: e.target.value })}
                className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div className="flex justify-end gap-3">
              <select value={compose.priority} onChange={e => setCompose({ ...compose, priority: e.target.value })}
                className="border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none">
                <option value="normal">Normal</option>
                <option value="urgent">🚨 Urgent</option>
              </select>
              <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors flex items-center gap-2">
                <i className="bx bx-send" /> Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '500px' }}>
        {/* Message List */}
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-teal-900/30">
            {['inbox', 'sent'].map(t => (
              <button key={t} onClick={() => { setTab(t); setSelectedMessage(null); setThread(null); }}
                className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                  tab === t ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {t === 'inbox' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <i className="bx bx-inbox" /> Inbox
                    {messages.filter(m => !m.isRead).length > 0 && tab === 'inbox' && (
                      <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {messages.filter(m => !m.isRead).length}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5"><i className="bx bx-send" /> Sent</span>
                )}
              </button>
            ))}
          </div>

          {/* Message Items */}
          <div className="divide-y divide-slate-100 dark:divide-teal-900/30 overflow-y-auto max-h-[500px]">
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <i className="bx bx-envelope text-3xl" />
                <p className="text-sm mt-2">No messages in {tab}</p>
              </div>
            ) : messages.map(msg => (
              <button key={msg._id} onClick={() => openMessage(msg)}
                className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-[#162030]/50 transition-colors ${
                  selectedMessage?._id === msg._id ? 'bg-indigo-500/5 border-r-2 border-indigo-500' : ''
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${!msg.isRead && tab === 'inbox' ? 'bg-indigo-500' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${!msg.isRead && tab === 'inbox' ? 'font-bold text-slate-800 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                        {tab === 'inbox' ? msg.sender?.fullName : msg.recipient?.fullName}
                      </p>
                      {msg.priority === 'urgent' && <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full font-bold">URGENT</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{msg.subject}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(msg.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread View */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 flex flex-col">
          {!selectedMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <i className="bx bx-envelope-open text-5xl" />
              <p className="mt-3 text-sm">Select a message to read</p>
            </div>
          ) : threadLoading ? (
            <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : thread ? (
            <>
              {/* Thread Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-teal-900/30 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">{thread.parent.subject}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    From: {thread.parent.sender?.fullName} ({thread.parent.sender?.role}) · {new Date(thread.parent.createdAt).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => handleDelete(thread.parent._id)} className="text-slate-400 hover:text-rose-400 transition-colors p-1">
                  <i className="bx bx-trash text-lg" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Parent message */}
                {(() => {
                  const parentMine = thread.parent.sender?._id === user?._id;
                  return (
                    <div className={`flex gap-3 ${parentMine ? 'flex-row-reverse justify-end' : ''}`}>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {thread.parent.sender?.fullName?.charAt(0)}
                      </div>
                      <div className={`flex-1 rounded-2xl p-4 max-w-md ${parentMine ? 'bg-indigo-500 text-white rounded-tl-none ml-auto' : 'bg-slate-50 dark:bg-[#0d1520] text-slate-700 dark:text-slate-200 rounded-tl-none'}`}>
                        <p className={`text-sm font-semibold mb-1 ${parentMine ? 'text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>{thread.parent.sender?.fullName}</p>
                        <p className="text-sm whitespace-pre-wrap">{thread.parent.body}</p>
                        <p className={`text-[10px] mt-2 ${parentMine ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(thread.parent.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Replies */}
                {thread.replies.map(reply => (
                  <div key={reply._id} className={`flex gap-3 ${reply.sender?._id === user?._id ? 'flex-row-reverse' : ''}`}>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {reply.sender?.fullName?.charAt(0)}
                    </div>
                    <div className={`flex-1 rounded-2xl p-4 max-w-md ${
                      reply.sender?._id === user?._id
                        ? 'bg-indigo-500 text-white rounded-tr-none ml-auto'
                        : 'bg-slate-50 dark:bg-[#0d1520] text-slate-700 dark:text-slate-200 rounded-tl-none'
                    }`}>
                      <p className={`text-sm font-semibold mb-1 ${reply.sender?._id === user?._id ? 'text-indigo-100' : ''}`}>{reply.sender?.fullName}</p>
                      <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                      <p className={`text-[10px] mt-2 ${reply.sender?._id === user?._id ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(reply.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Box */}
              <div className="border-t border-slate-100 dark:border-teal-900/30 p-4">
                <form onSubmit={handleReply} className="flex gap-3">
                  <textarea
                    value={replyBody} onChange={e => setReplyBody(e.target.value)}
                    placeholder="Type a reply..."
                    rows={2}
                    className="flex-1 border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  <button type="submit" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors flex items-center gap-1 font-semibold text-sm">
                    <i className="bx bx-send" /> Reply
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MessageInbox;

