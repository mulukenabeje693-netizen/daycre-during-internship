import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import UserAvatar from './common/UserAvatar';

const ProfilePanel = ({ open, onClose }) => {
  const { user, setUser } = useAuth();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingWork, setEditingWork] = useState(false);
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    employeeId: '',
    role: user?.role || '',
    department: user?.department || '',
    location: user?.location || '',
    shift: user?.shift || ''
  });

  useEffect(() => {
    setUserForm({
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      employeeId: user?.employeeId || '',
      role: user?.role || '',
      department: user?.department || '',
      location: user?.location || '',
      shift: user?.shift || ''
    });
  }, [user]);

  if (!open) return null;

  const handlePick = () => fileRef.current?.click();

  const handleChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    try {
      const res = await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.success) {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const formattedJoin = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        fullName: userForm.fullName,
        email: userForm.email,
        phone: userForm.phone
      };

      // Admins can update work fields
      if (user?.role === 'admin') {
        payload.employeeId = userForm.employeeId;
        payload.role = userForm.role;
        payload.department = userForm.department;
        payload.location = userForm.location;
        payload.shift = userForm.shift;
      }

      const res = await api.patch('/auth/me', payload);
      if (res.data?.success) {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.error('Save failed', err?.response?.data || err.message || err);
    } finally {
      setSaving(false);
      // Exit edit mode after save
      setEditingPersonal(false);
      setEditingWork(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center sm:items-start justify-center p-3 sm:p-6 overflow-auto bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-[#07101a] rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col relative border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white">My Profile</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">✕</button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>
          <div className="flex flex-col items-center">
            <div className="relative">
              <UserAvatar
                user={user}
                size="2xl"
                showOnline={true}
                ring="ring-4 ring-white dark:ring-[#07101a]"
              />

              <button onClick={handlePick} title="Change profile picture" className="absolute -right-1 top-2 w-10 h-10 rounded-full bg-white dark:bg-[#0b1720] border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-md z-10">
                <i className="bx bx-camera text-lg text-slate-700 dark:text-slate-200" />
              </button>
            </div>

            <h4 className="mt-4 text-lg font-bold text-slate-800 dark:text-white">{user?.fullName}</h4>
            <p className="text-xs font-extrabold uppercase px-3 py-0.5 rounded-full bg-[#00ADB5]/10 text-[#00ADB5] border border-[#00ADB5]/30 w-fit mt-2">{user?.role === 'teacher' ? 'NANNY' : (user?.role || '').toUpperCase()}</p>
            <p className="text-sm text-emerald-400 mt-2">Online</p>
          </div>

          <div className="mt-6 space-y-6 pb-24">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-800 dark:text-white">Personal Information</h5>
              <div className="flex items-center gap-2">
                {editingPersonal ? (
                  <>
                    <button onClick={() => { setEditingPersonal(false); setUserForm({ fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '', employeeId: user?.employeeId || '', role: user?.role || '', department: user?.department || '', location: user?.location || '', shift: user?.shift || '' }); }} className="text-sm px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800">Cancel</button>
                    <button onClick={handleSave} className="text-sm px-3 py-1 rounded-lg bg-[#00ADB5] text-white">Save</button>
                  </>
                ) : (
                  <button onClick={() => setEditingPersonal(true)} className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg">Edit</button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-user text-lg text-slate-400" />
                <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Full Name</p>
                    <input readOnly={!editingPersonal} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.fullName} onChange={(e) => setUserForm({...userForm, fullName: e.target.value})} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-envelope text-lg text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Email</p>
                  <input readOnly={!editingPersonal} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-phone text-lg text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Phone</p>
                  <input readOnly={!editingPersonal} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.phone} onChange={(e) => setUserForm({...userForm, phone: e.target.value})} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-id-card text-lg text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Employee ID</p>
                  <input readOnly={!(editingPersonal && user?.role === 'admin')} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.employeeId} onChange={(e) => setUserForm({...userForm, employeeId: e.target.value})} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-calendar text-lg text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Join Date</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formattedJoin}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-800 dark:text-white">Work Information</h5>
              <div className="flex items-center gap-2">
                {user?.role === 'admin' ? (
                  editingWork ? (
                    <>
                      <button onClick={() => { setEditingWork(false); setUserForm({ fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '', employeeId: user?.employeeId || '', role: user?.role || '', department: user?.department || '', location: user?.location || '', shift: user?.shift || '' }); }} className="text-sm px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800">Cancel</button>
                      <button onClick={handleSave} className="text-sm px-3 py-1 rounded-lg bg-[#00ADB5] text-white">Save</button>
                    </>
                  ) : (
                    <button onClick={() => setEditingWork(true)} className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg">Edit</button>
                  )
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                  <i className="bx bx-briefcase text-lg text-slate-400" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Role</p>
                    <input readOnly={!editingWork || user?.role !== 'admin'} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})} />
                  </div>
                </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-building text-lg text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Department</p>
                  <input readOnly={!editingWork || user?.role !== 'admin'} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.department} onChange={(e) => setUserForm({...userForm, department: e.target.value})} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-map text-lg text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Location</p>
                  <input readOnly={!editingWork || user?.role !== 'admin'} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.location} onChange={(e) => setUserForm({...userForm, location: e.target.value})} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0b1720] rounded-xl">
                <i className="bx bx-time text-lg text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Shift</p>
                  <input readOnly={!editingWork || user?.role !== 'admin'} className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent w-full" value={userForm.shift} onChange={(e) => setUserForm({...userForm, shift: e.target.value})} />
                </div>
              </div>
            </div>

            <div />
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
        </div>

        {/* Fixed footer with Update Profile button (absolute inside modal) */}
        <div className="absolute left-0 right-0 bottom-0 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#07101a]">
          <div className="max-w-lg mx-auto">
            <button onClick={handleSave} disabled={saving} className={`w-full py-3 rounded-xl font-semibold ${saving ? 'bg-slate-300 text-slate-700 cursor-not-allowed' : 'bg-[#00ADB5] text-white'}`}>
              {saving ? 'Saving...' : 'Update Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePanel;
