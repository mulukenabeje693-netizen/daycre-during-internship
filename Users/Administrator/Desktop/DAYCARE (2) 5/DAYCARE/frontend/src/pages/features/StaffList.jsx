import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import PasswordStrengthChecker, { validatePassword } from '../../components/shared/PasswordStrengthChecker';
import { rv, phone as rvPhone, emergency as rvEmergency, initials as rvInitials } from '../../utils/renderValue';
import Pagination from '../../components/shared/Pagination';

const StaffList = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { feature } = useParams();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(feature === 'add-staff');
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [sortBy, setSortBy] = useState('nameAsc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [showPassword, setShowPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Ethiopian phone: 09xxxxxxxx | 07xxxxxxxx | 2519xxxxxxxx | 2517xxxxxxxx | +251 variants
  const ETH_PHONE_RE = /^(?:(?:\+251|251|0)[97]\d{8})$/;
  const validatePhone = (val) => {
    if (!val || !val.trim()) return ''; // optional field
    if (!ETH_PHONE_RE.test(val.trim().replace(/\s+/g, '')))
      return 'Enter a valid Ethiopian number (e.g. 0911234567 or +251911234567)';
    return '';
  };

  const emptyForm = { fullName: '', email: '', phone: '', password: '', role: 'teacher' };
  const [form, setForm] = useState(emptyForm);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/staff');
      setStaff(res.data.data);
    } catch (err) {
      setError('Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowPassword(false);
    setError('');
    setPhoneError('');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingId(s._id);
    setForm({ fullName: s.fullName, email: s.email || '', phone: s.phone || '', password: '', role: s.role });
    setShowPassword(false);
    setError('');
    setPhoneError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setError('');
    setPhoneError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Phone validation on submit
    const pErr = validatePhone(form.phone);
    if (pErr) { setPhoneError(pErr); return; }
    // Password validation (only when adding new staff)
    if (!editingId) {
      const pwdErr = validatePassword(form.password);
      if (pwdErr) { setError(pwdErr); return; }
    }
    try {
      if (editingId) {
        await api.put(`/staff/${editingId}`, { fullName: form.fullName, email: form.email, phone: form.phone, role: form.role });
        setSuccess('Staff updated successfully.');
      } else {
        await api.post('/auth/register', { ...form, role: form.role });
        setSuccess('Staff member added successfully.');
      }
      closeForm();
      fetchStaff();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || (editingId ? 'Update failed.' : 'Failed to add staff.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/staff/${deleteTarget}`);
      setStaff(prev => prev.filter(s => s._id !== deleteTarget));
      setSuccess('Staff member removed.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Delete failed.');
    } finally {
      setDeleteTarget(null);
      setDeleteForEveryone(false);
    }
  };

  const roleColor = (role) => ({
    admin:     'bg-purple-500/10 text-purple-500',
    teacher:   'bg-cyan-500/10 text-cyan-500',
    reception: 'bg-amber-500/10 text-amber-500',
    staff:     'bg-slate-500/10 text-slate-400'
  }[role] || 'bg-slate-500/10 text-slate-400');

  const filtered = staff.filter(s => {
    const matchSearch = s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || s.role === filterRole;
    return matchSearch && matchRole;
  });

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortBy === 'nameAsc') {
        return (a.fullName || '').localeCompare(b.fullName || '');
      }
      if (sortBy === 'nameDesc') {
        return (b.fullName || '').localeCompare(a.fullName || '');
      }
      if (sortBy === 'dateNewest' || sortBy === 'dateOldest') {
        const getTs = (item) => {
          if (item.createdAt) return new Date(item.createdAt).getTime();
          const idStr = String(item._id || '');
          if (idStr.length === 24) return parseInt(idStr.substring(0, 8), 16) * 1000;
          return 0;
        };
        const diff = getTs(b) - getTs(a);
        return sortBy === 'dateNewest' ? diff : -diff;
      }
      return 0;
    });
    return list;
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStaff = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e2535] shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('deleteConfirmationTitle', 'Do you want to delete this?')}</h3>
              <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${deleteForEveryone ? 'bg-blue-500 border-blue-500' : 'border-slate-400 dark:border-slate-500'}`}
                  onClick={() => setDeleteForEveryone(p => !p)}>
                  {deleteForEveryone && <i className="bx bx-check text-white text-sm" />}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">{t('deleteForEveryone', 'Delete for everyone')}</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-1 px-4 pb-4">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteForEveryone(false); }}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                {t('cancel', 'Cancel')}
              </button>
              <button type="button" onClick={handleDelete}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                {t('delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('staffManagement', 'Staff Management')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{staff.length} {t('staffMembers', 'staff members')}</p>
        </div>
      </div>

      {error && !showForm && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="relative bg-[#0f1729] rounded-2xl border border-slate-700/60 shadow-2xl w-full max-w-lg p-7 overflow-hidden">

            {/* Background glow */}
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={closeForm}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors text-lg font-bold"
            >
              ×
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <i className="bx bx-user-plus text-2xl text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingId ? t('editStaffMember', 'Edit Staff Member') : t('addNewStaffMember', 'Add New Staff Member')}
                </h3>
                <p className="text-xs text-slate-400">
                  {t('fillStaffDetails', 'Fill in the details below')}
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3 text-xs mb-4">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Row 1: Full Name + Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{t('fullName', 'Full Name')} *</label>
                  <div className="relative">
                    <i className="bx bx-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                    <input
                      required type="text" value={form.fullName}
                      onChange={e => setForm({ ...form, fullName: e.target.value })}
                      placeholder={t('egSarahJohnson', 'e.g. Sarah Johnson')}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{t('emailLabel', 'Email')} *</label>
                  <div className="relative">
                    <i className="bx bx-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                    <input
                      required type="email" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="admin@daycare.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Phone + Role */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{t('phoneNumber', 'Phone Number')} *</label>
                  <div className="relative">
                    <i className="bx bx-phone absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                    <input
                      type="tel" value={form.phone}
                      onChange={e => {
                        const val = e.target.value;
                        setForm({ ...form, phone: val });
                        setPhoneError(validatePhone(val));
                      }}
                      placeholder="e.g. 0911 234 567"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/70 border text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                        phoneError
                          ? 'border-rose-500/70 focus:ring-rose-500/40'
                          : 'border-slate-700/60 focus:ring-indigo-500/60'
                      }`}
                    />
                  </div>
                  {phoneError && (
                    <p className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1">
                      <i className="bx bx-error-circle text-sm" />{phoneError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{t('role', 'Role')} *</label>
                  <div className="relative">
                    <i className="bx bx-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                    <select
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 appearance-none"
                    >
                      <option value="teacher">{t('childcareProvider', 'Nanny')}</option>
                      <option value="reception">{t('reception', 'Reception')}</option>
                      <option value="staff">{t('supportStaff', 'Support Staff')}</option>
                      <option value="admin">{t('admin', 'Admin')}</option>
                    </select>
                    <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Password */}
              {!editingId && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{t('password', 'Password')} *</label>
                  <div className="relative">
                    <i className="bx bx-lock-alt absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="Min 8 chars, uppercase, number, special char"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <i className={`bx ${showPassword ? 'bx-show' : 'bx-hide'} text-lg`} />
                    </button>
                  </div>
                  <PasswordStrengthChecker password={form.password} />
                </div>
              )}

              {/* Info cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <i className="bx bx-shield-quarter text-indigo-400 text-base" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{t('secureAccess', 'Secure Access')}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{t('staffCredentialsHint', 'Staff will receive login credentials via email')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                    <i className="bx bx-group text-slate-300 text-base" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{t('roleBased', 'Role Based')}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{t('permissionsHint', 'Permissions are set by user role')}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors"
                >
                  <i className="bx bx-plus" />
                  {editingId ? t('updateStaff', 'Update Staff') : t('addStaff', 'Add Staff')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('searchStaff', 'Search by name or email...')}
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value); setCurrentPage(1); }}
          className="border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">{t('allRoles', 'All Roles')}</option>
          <option value="admin">{t('admin', 'Admin')}</option>
          <option value="teacher">{t('childcareProvider', 'Teacher')}</option>
          <option value="reception">{t('reception', 'Reception')}</option>
          <option value="staff">{t('supportStaff', 'Support Staff')}</option>
        </select>
        <div className="relative min-w-[200px]">
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
            className="w-full appearance-none pl-9 pr-8 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="nameAsc">{t('sortNameAsc', 'Name (A–Z)')}</option>
            <option value="nameDesc">{t('sortNameDesc', 'Name (Z–A)')}</option>
            <option value="dateNewest">{t('sortDateNewest', 'Registered (Newest)')}</option>
            <option value="dateOldest">{t('sortDateOldest', 'Registered (Oldest)')}</option>
          </select>
          <i className="bx bx-sort absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Staff Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedStaff.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-user-x text-4xl" />
          <p className="text-sm mt-2">{t('noStaffFound', 'No staff found.')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedStaff.map(s => (
              <div key={s._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-6 flex flex-col items-center text-center relative group hover:shadow-lg transition-shadow">
                {user?.role === 'admin' && user._id !== s._id && (
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(s)} className="p-1.5 bg-slate-100 dark:bg-[#0d1520] rounded-lg text-slate-500 hover:text-indigo-500 transition-colors">
                      <i className="bx bx-edit text-lg" />
                    </button>
                    <button onClick={() => setDeleteTarget(s._id)} className="p-1.5 bg-slate-100 dark:bg-[#0d1520] rounded-lg text-slate-500 hover:text-rose-500 transition-colors">
                      <i className="bx bx-trash text-lg" />
                    </button>
                  </div>
                )}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
                  {rvInitials(s.fullName)}
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{rv(s.fullName)}</h3>
                <p className="text-xs text-slate-400 mb-3">{rv(s.email)}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${roleColor(s.role)}`}>{t(s.role, s.role)}</span>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {t(s.status || 'active', s.status || 'active')}
                  </span>
                </div>
                {/* Phone — always shown, N/A if missing */}
                <div className="w-full border-t border-slate-100 dark:border-teal-900/30 mt-4 pt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <i className="bx bx-phone" /> {rvPhone(s)}
                </div>
                {/* Emergency contact if present */}
                {(s.emergencyContact?.name || s.emergencyContact?.phone) && (
                  <div className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 mt-1">
                    <i className="bx bx-user-check" />
                    <span>{rvEmergency(s.emergencyContact)}</span>
                  </div>
                )}
                {/* Classroom for teachers */}
                {s.classroom && (
                  <div className="w-full flex items-center justify-center gap-2 text-xs text-indigo-400 mt-1">
                    <i className="bx bx-door-open" />
                    <span>{rv(s.classroom.name, 'Unassigned')}</span>
                  </div>
                )}
                {/* Date registered */}
                {s.createdAt && (
                  <div className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-1.5">
                    <i className="bx bx-calendar" />
                    <span>{t('registered', 'Reg')}: {new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 px-6 py-4 shadow-sm">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sorted.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel={t('staffMembers', 'staff members')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffList;

