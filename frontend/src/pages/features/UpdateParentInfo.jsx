import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import { rv, phone as rvPhone, initials as rvInitials, organisation as rvOrg } from '../../utils/renderValue';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';
import Pagination from '../../components/shared/Pagination';

/* ─── helpers ─────────────────────────────────────────────── */
const EMPTY_FORM = {
  fullName: '', email: '', phone: '', organization: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
};

const toFormValues = (p) => ({
  fullName:     p.fullName     || '',
  email:        p.email        || '',
  phone:        p.phone        || '',
  organization: p.organization || '',
  emergencyContactName:         p.emergencyContact?.name         || '',
  emergencyContactPhone:        p.emergencyContact?.phone        || '',
  emergencyContactRelationship: p.emergencyContact?.relationship || '',
});

/* ─── component ───────────────────────────────────────────── */
const UpdateParentInfo = () => {
  const { t } = useLanguage();
  const [parents, setParents]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // Edit modal
  const [editModal, setEditModal] = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [editError, setEditError] = useState('');

  // Delete modal
  const [deleteModal, setDeleteModal]               = useState(null);
  const [deleting, setDeleting]                     = useState(false);
  const [deleteForEveryone, setDeleteForEveryone]   = useState(true);

  /* fetch ──────────────────────────────────────────────────── */
  const fetchParents = async () => {
    try {
      const res = await api.get('/staff/parents');
      setParents(res.data.data);
    } catch {
      setError('Failed to load parents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchParents(); }, []);

  const flash = (setter, msg, ms = 3500) => { setter(msg); setTimeout(() => setter(''), ms); };

  /* ── EDIT ─────────────────────────────────────────────────── */
  const openEdit = (parent) => {
    setForm(toFormValues(parent));
    setEditError('');
    setEditModal(parent);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (editError) setEditError('');
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      setEditError('Full name and email are required.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const payload = {
        fullName:     form.fullName.trim(),
        email:        form.email.trim().toLowerCase(),
        phone:        form.phone.trim(),
        organization: form.organization.trim(),
        emergencyContact: {
          name:         form.emergencyContactName.trim(),
          phone:        form.emergencyContactPhone.trim(),
          relationship: form.emergencyContactRelationship.trim(),
        },
      };
      const res = await api.put(`/staff/${editModal._id}`, payload);
      setParents(prev => prev.map(p => p._id === editModal._id ? { ...p, ...res.data.data } : p));
      setEditModal(null);
      flash(setSuccess, `✅ ${form.fullName}'s info updated successfully.`);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── DELETE ───────────────────────────────────────────────── */
  const openDelete = (parent) => { setDeleteForEveryone(true); setDeleteModal(parent); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/staff/${deleteModal._id}`);
      setParents(prev => prev.filter(p => p._id !== deleteModal._id));
      flash(setSuccess, `🗑️ ${deleteModal.fullName}'s record has been removed.`);
      setDeleteModal(null);
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Delete failed.');
      setDeleteModal(null);
    } finally {
      setDeleting(false);
    }
  };

  /* filter ─────────────────────────────────────────────────── */
  const filtered = parents.filter(p =>
    (p.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedParents = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  /* ── render ───────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('updateParentInfoTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{parents.length} {t('registeredParentsCount')}</p>
        </div>
      </div>

      {/* Alerts */}
      {error   && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">{success}</div>}

      {/* Search */}
      <div className="relative">
        <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder={t('searchParentsByNameOrEmail')}
          value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-group text-4xl" />
          <p className="text-sm mt-2">{t('noParentsFound2')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedParents.map(p => (
            <div key={p._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {rvInitials(p.fullName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">{rv(p.fullName)}</h3>
                    <p className="text-xs text-slate-400">{rv(p.email)}</p>
                    <p className="text-xs text-slate-400">{rvPhone(p)}</p>
                    {rvOrg(p) !== 'N/A' && <p className="text-xs text-indigo-400">{rvOrg(p)}</p>}
                    <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      p.approvalStatus === 'approved'    ? 'bg-emerald-500/10 text-emerald-400' :
                      p.approvalStatus === 'disapproved' ? 'bg-rose-500/10 text-rose-400' :
                      'bg-amber-500/10 text-amber-400'}`}>
                      {p.approvalStatus || 'pending'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 transition-colors">
                    <i className="bx bx-edit-alt text-sm" /> {t('edit')}
                  </button>
                  <button onClick={() => openDelete(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 transition-colors">
                    <i className="bx bx-trash text-sm" /> {t('delete')}
                  </button>
                </div>
              </div>

              {/* Children */}
              {p.children?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-teal-900/30">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('childrenLabel')}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.children.slice(0, 5).map(c => (
                      <span key={c._id} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full">
                        <i className="bx bx-child text-sm" />
                        {c.firstName} {c.lastName}
                        {c.classroom && <span className="text-indigo-300/70">· {rv(c.classroom?.name, 'Unassigned')}</span>}
                      </span>
                    ))}
                    {p.children.length > 5 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full">
                        +{p.children.length - 5} {t('more', 'more')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 px-5 py-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel={t('parentsLabel', 'parents')}
            />
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ─────────────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            style={{ resize: 'both', overflow: 'hidden', minWidth: '340px', width: '640px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/40 shadow-2xl"
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-100 dark:border-teal-900/30 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-lg">
                  <i className="bx bx-edit-alt" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">{t('editParentInfo')}</h3>
                  <p className="text-xs text-slate-400">{rv(editModal?.fullName)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-[10px] text-slate-400 italic select-none">drag corner to resize ↘</span>
                <button onClick={() => setEditModal(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <i className="bx bx-x text-xl" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Full name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('fullName')} *</label>
                  <input name="fullName" value={form.fullName} onChange={handleFormChange}
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('emailLabel')} *</label>
                  <input name="email" type="email" value={form.email} onChange={handleFormChange}
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('phoneNumber')}</label>
                  <input name="phone" value={form.phone} onChange={handleFormChange} placeholder="e.g. 555-0101"
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* Organization */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('orgEmployer')}</label>
                  <input name="organization" value={form.organization} onChange={handleFormChange} placeholder="e.g. Acme Corp"
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* Divider */}
                <div className="sm:col-span-2 border-t border-slate-100 dark:border-teal-900/30 pt-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('emergencyContact')}</p>
                </div>

                {/* Emergency name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('contactName')}</label>
                  <input name="emergencyContactName" value={form.emergencyContactName} onChange={handleFormChange}
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* Emergency phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('contactPhone')}</label>
                  <input name="emergencyContactPhone" value={form.emergencyContactPhone} onChange={handleFormChange}
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* Relationship */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('relationshipLabel')}</label>
                  <input name="emergencyContactRelationship" value={form.emergencyContactRelationship} onChange={handleFormChange} placeholder="e.g. Spouse, Sibling"
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

              </div>
              {editError && <p className="text-rose-400 text-xs mt-3">{editError}</p>}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-slate-100 dark:border-teal-900/30 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setEditModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors">
                {t('cancel')}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-50">
                {saving ? t('saving') : t('saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ─────────────────────────────────────── */}
      <DeleteConfirmModal
        isOpen={!!deleteModal}
        title="Delete Parent Record"
        description={deleteModal ? `Remove ${deleteModal.fullName}'s account and all associated data?` : ''}
        warning="This action cannot be undone."
        checkboxLabel={t('deleteForEveryone')}
        checked={deleteForEveryone}
        onCheck={() => setDeleteForEveryone(p => !p)}
        onCancel={() => { setDeleteModal(null); setDeleteForEveryone(true); }}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel={deleting ? t('deleting') : t('delete')}
        cancelLabel={t('cancel')}
      />

    </div>
  );
};

export default UpdateParentInfo;
