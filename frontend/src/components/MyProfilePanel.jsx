import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './common/UserAvatar';

/* ── role display helper ─────────────────────────────────── */
const roleLabel = (role) =>
  role === 'teacher' ? 'Nanny' :
  role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';

/* ── field row ───────────────────────────────────────────── */
const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5">
    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
      <i className={`bx ${icon} text-slate-500 dark:text-slate-400 text-base`} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 break-words">{value || '—'}</p>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────── */
const MyProfilePanel = ({ open, onClose }) => {
  const { user, setUser } = useAuth();
  const fileRef = useRef(null);

  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [editPersonal, setEditPersonal] = useState(false);
  const [editWork, setEditWork]         = useState(false);

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', organization: '',
  });

  const flash = (setter, msg) => { setter(msg); setTimeout(() => setter(''), 3500); };

  /* ── fetch fresh profile ─────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/auth/me');
        const u = res.data.user;
        setProfile(u);
        setForm({ fullName: u.fullName || '', email: u.email || '', phone: u.phone || '', organization: u.organization || '' });
      } catch {
        setProfile(user); // fallback to cached user
        if (user) setForm({ fullName: user.fullName || '', email: user.email || '', phone: user.phone || '', organization: user.organization || '' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open]);

  /* ── save personal info ──────────────────────────────── */
  const handleSavePersonal = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      flash(setError, 'Name and email are required.'); return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/staff/${profile._id || profile.id}`, {
        fullName: form.fullName.trim(),
        email:    form.email.trim().toLowerCase(),
        phone:    form.phone.trim(),
        organization: form.organization.trim(),
      });
      const updated = res.data.data || res.data.user || profile;
      setProfile(prev => ({ ...prev, ...updated }));
      // Update context + localStorage
      const merged = { ...user, fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() };
      setUser(merged);
      localStorage.setItem('user', JSON.stringify(merged));
      setEditPersonal(false);
      flash(setSuccess, 'Profile updated successfully.');
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  /* ── upload avatar ───────────────────────────────────── */
  const handleAvatarChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await api.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.success) {
        const updated = res.data.user;
        setUser && setUser(updated);
        setProfile && setProfile(prev => ({ ...prev, ...updated }));
        localStorage.setItem('user', JSON.stringify(updated));
        flash(setSuccess, 'Avatar updated successfully.');
      }
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Avatar upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const p = profile || user;
  if (!p) return null;

  const joined = p.createdAt
    ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const employeeId = `DC-${(p.role || 'USR').slice(0,3).toUpperCase()}-${String(p._id || p.id || '').slice(-6).toUpperCase()}`;

  return (
    <>
      {/* ── Overlay ───────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[210] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* ── Slide-over panel ──────────────────────────────── */}
      <div className={`fixed top-0 right-0 z-[220] h-full w-full sm:w-[380px] max-w-full bg-white dark:bg-[#111c2d] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">My Profile</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <i className="bx bx-x text-xl" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-[#00ADB5] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Avatar section ────────────────────────── */}
              <div className="flex flex-col items-center py-7 px-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1929]">
                <div className="relative mb-3">
                  <UserAvatar
                    user={p}
                    size="xl"
                    ring="ring-4 ring-white dark:ring-[#111c2d]"
                  />
                  {/* Camera button */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    title="Change avatar"
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#00ADB5] flex items-center justify-center text-white shadow-sm hover:bg-[#009aa1] transition-colors z-10"
                  >
                    <i className="bx bx-camera text-sm" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{p.fullName}</h3>
                <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-[#00ADB5]/40 text-[#00ADB5] bg-[#00ADB5]/8">
                  {roleLabel(p.role)}
                </span>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Online</span>
                </div>
              </div>

              {/* Alerts */}
              {error   && <div className="mx-5 mt-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
              {success && <div className="mx-5 mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">{success}</div>}

              {/* ── Personal Information ──────────────────── */}
              <div className="px-5 pt-5 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Personal Information</h4>
                  <button
                    onClick={() => setEditPersonal(prev => !prev)}
                    className="text-xs font-semibold text-[#00ADB5] hover:underline flex items-center gap-1"
                  >
                    <i className={`bx ${editPersonal ? 'bx-x' : 'bx-edit-alt'} text-sm`} />
                    {editPersonal ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {editPersonal ? (
                  <div className="space-y-3 mt-3">
                    {[
                      { label: 'Full Name', key: 'fullName',    type: 'text'  },
                      { label: 'Email',     key: 'email',       type: 'email' },
                      { label: 'Phone',     key: 'phone',       type: 'tel'   },
                      { label: 'Organization', key: 'organization', type: 'text' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{f.label}</label>
                        <input
                          type={f.type}
                          value={form[f.key]}
                          onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 transition-all"
                        />
                      </div>
                    ))}
                    <button
                      onClick={handleSavePersonal}
                      disabled={saving}
                      className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] text-white font-semibold text-sm py-2.5 transition-all disabled:opacity-60"
                    >
                      {saving ? <><i className="bx bx-loader-alt animate-spin" /> Saving…</> : <><i className="bx bx-check" /> Save Changes</>}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <InfoRow icon="bx-user"        label="Full Name"    value={p.fullName} />
                    <InfoRow icon="bx-envelope"    label="Email"        value={p.email} />
                    <InfoRow icon="bx-phone"       label="Phone"        value={p.phone} />
                    <InfoRow icon="bx-id-card"     label="Employee ID"  value={employeeId} />
                    <InfoRow icon="bx-calendar"    label="Join Date"    value={joined} />
                  </div>
                )}
              </div>

              {/* ── Work Information ──────────────────────── */}
              <div className="px-5 pt-4 pb-6">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Work Information</h4>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <InfoRow icon="bxs-graduation"  label="Role"          value={roleLabel(p.role)} />
                  <InfoRow icon="bx-buildings"    label="Department"    value={p.organization || 'Daycare Center'} />
                  <InfoRow icon="bx-map-pin"      label="Location"      value="Main Branch" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer — Update Profile button */}
        {!loading && !editPersonal && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111c2d]">
            <button
              onClick={() => setEditPersonal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1] text-white font-bold text-sm py-3 transition-all shadow-sm hover:shadow-[0_4px_16px_rgba(0,173,181,0.3)]"
            >
              <i className="bx bx-edit-alt text-base" />
              Update Profile
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default MyProfilePanel;
