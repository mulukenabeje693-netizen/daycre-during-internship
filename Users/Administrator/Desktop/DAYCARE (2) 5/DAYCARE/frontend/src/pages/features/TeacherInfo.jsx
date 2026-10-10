import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TeacherInfo = () => {
  const { user } = useAuth();
  const [children,  setChildren]  = useState([]);
  const [teachers,  setTeachers]  = useState([]);   // { teacher, classroom, childNames }
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [compose,   setCompose]   = useState(null);  // teacher id to message
  const [msgBody,   setMsgBody]   = useState('');
  const [sending,   setSending]   = useState(false);
  const [msgStatus, setMsgStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [childRes, roomRes] = await Promise.all([
          api.get('/children'),
          api.get('/classrooms')
        ]);
        const kids  = childRes.data.data  || [];
        const rooms = roomRes.data.data   || [];
        setChildren(kids);

        // Build teacher info from classrooms
        const seen = new Set();
        const result = [];
        kids.forEach(child => {
          const room = rooms.find(r => r._id === (child.classroom?._id || child.classroom));
          if (room?.teacher && !seen.has(room.teacher._id || room.teacher)) {
            seen.add(room.teacher._id || room.teacher);
            result.push({
              teacher:    room.teacher,
              classroom:  room,
              childNames: kids
                .filter(k => (k.classroom?._id || k.classroom) === room._id)
                .map(k => k.firstName)
            });
          }
        });
        setTeachers(result);
      } catch {
        setError('Could not load teacher information.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgBody.trim()) return;
    setSending(true);
    setMsgStatus('');
    try {
      await api.post('/messages', {
        recipientId: compose,
        subject: 'Message from parent',
        body: msgBody
      });
      setMsgStatus('Message sent successfully!');
      setMsgBody('');
      setCompose(null);
    } catch {
      setMsgStatus('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl p-6 text-center">
      <i className="bx bx-error text-3xl" /><p className="mt-2">{error}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Teacher Information</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Your children's classroom teachers</p>
      </div>

      {msgStatus && (
        <div className={`rounded-xl p-4 text-sm font-semibold ${
          msgStatus.includes('success')
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
        }`}>
          {msgStatus}
        </div>
      )}

      {teachers.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bxs-graduation text-5xl opacity-30" />
          <p className="mt-3 font-semibold">No teacher assigned yet</p>
          <p className="text-xs mt-1 opacity-60">Teachers will appear once your child is assigned a classroom.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teachers.map(({ teacher, classroom, childNames }) => (
            <div key={teacher._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 px-6 py-5 flex items-center gap-4 border-b border-slate-100 dark:border-teal-900/30">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0">
                  {teacher.fullName?.charAt(0) || 'T'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">{teacher.fullName}</h3>
                  <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide mt-0.5">
                    {classroom.name} Teacher
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{classroom.ageGroup}</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Contact details */}
                <div className="space-y-2">
                  {teacher.email && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0d1520] rounded-xl">
                      <i className="bx bx-envelope text-indigo-400" />
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">Email</p>
                        <a href={`mailto:${teacher.email}`} className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-400">
                          {teacher.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {teacher.phone && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0d1520] rounded-xl">
                      <i className="bx bx-phone text-emerald-400" />
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">Phone</p>
                        <a href={`tel:${teacher.phone}`} className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-400">
                          {teacher.phone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Your children in this class */}
                {childNames.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <p className="w-full text-[10px] font-semibold text-slate-400 uppercase">Your child in this class</p>
                    {childNames.map(name => (
                      <span key={name} className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg font-semibold">
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Message teacher button */}
                {compose === teacher._id ? (
                  <form onSubmit={handleSendMessage} className="space-y-3">
                    <textarea
                      value={msgBody}
                      onChange={e => setMsgBody(e.target.value)}
                      placeholder="Write a message to the teacher..."
                      rows={3}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setCompose(null); setMsgBody(''); }}
                        className="flex-1 py-2 text-sm font-semibold text-slate-500 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={sending || !msgBody.trim()}
                        className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        <i className="bx bx-send" /> {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => { setCompose(teacher._id); setMsgStatus(''); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl transition-colors"
                  >
                    <i className="bx bx-message-square-dots" /> Send Message
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherInfo;

