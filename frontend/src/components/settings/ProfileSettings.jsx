import React, { useState } from 'react';
import { Camera, Mail, Phone, User as UserIcon, BadgeInfo, Calendar, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import UserAvatar from '../common/UserAvatar';

const ProfileSettings = () => {
  const { user, setUser } = useAuth();

  const [profile, setProfile] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await api.patch('/auth/me', profile);
      if (res.data.success) {
        const updated = res.data.user;
        // Update auth context + localStorage
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        setStatus({ type: 'success', message: 'Profile updated successfully!' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.success) {
        const updated = res.data.user;
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        setStatus({ type: 'success', message: 'Avatar updated!' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to upload avatar.' });
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profile Information</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update your personal information and profile details.</p>
      </div>

      {status && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm font-medium ${
          status.type === 'success' ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border border-teal-200 dark:border-teal-800' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
        }`}>
          {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {status.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-10">
        {/* Profile Picture Upload */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group cursor-pointer">
            <label htmlFor="avatar-upload" className="cursor-pointer block relative">
              <UserAvatar
                user={user}
                size="3xl"
                ring="ring-4 ring-white dark:ring-[#111c2d]"
              />
              <div className="absolute inset-0 bg-slate-900/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {avatarUploading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </div>
            </label>
            <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Change Photo</p>
            <p className="text-xs text-slate-400 mt-0.5">JPG, PNG or GIF. Max size 2MB.</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-slate-400" /> Full Name
              </label>
              <input type="text" name="fullName" value={profile.fullName} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> Email Address
              </label>
              <input type="email" name="email" value={profile.email} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> Phone Number
              </label>
              <input type="tel" name="phone" value={profile.phone} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#162030] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" />
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-800 my-4" />

          {/* Read Only Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <BadgeInfo className="w-3.5 h-3.5" /> Employee ID
              </label>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{user?.employeeId || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Role
              </label>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 mt-1 capitalize">
                {user?.role || 'N/A'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Joined Date
              </label>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
