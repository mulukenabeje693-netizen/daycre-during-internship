import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import { rv, phone as rvPhone, emergency as rvEmergency, classroom as rvClassroom, initials as rvInitials, organisation as rvOrg } from '../../utils/renderValue';
import Pagination from '../../components/shared/Pagination';

const ParentManagement = () => {
  const { t } = useLanguage();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Approval modal state
  const [approvalModal, setApprovalModal] = useState(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);

  // Lock body scroll when delete modal is open
  useEffect(() => {
    if (deleteTarget) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [deleteTarget]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const parentsRes = await api.get('/staff/parents');
      setParents(parentsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const idToDelete = deleteTarget;
    setDeleteTarget(null);
    setDeleteForEveryone(false);
    try {
      await api.delete(`/staff/${idToDelete}`);
      setParents(prev => prev.filter(p => p._id !== idToDelete));
      setSuccess('Parent removed successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Delete failed. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleBlock = async (parentId, currentlyBlocked) => {
    try {
      const res = await api.put(`/staff/parents/${parentId}/block`);
      setParents(prev => prev.map(p =>
        p._id === parentId ? { ...p, isBlocked: res.data.data.isBlocked } : p
      ));
      setSuccess(currentlyBlocked ? 'Parent unblocked successfully.' : 'Parent blocked successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openApprovalModal = (parentId, action) => {
    if (action === 'approve') {
      // Approve directly — no modal needed
      handleDirectApprove(parentId);
      return;
    }
    setApprovalModal({ parentId, action });
    setApprovalNote('');
  };

  const handleDirectApprove = async (parentId) => {
    try {
      const res = await api.put(`/staff/parents/${parentId}/approve`, { note: '' });
      setParents(prev => prev.map(p =>
        p._id === parentId
          ? { ...p, approvalStatus: res.data.data.approvalStatus, approvalNote: res.data.data.approvalNote }
          : p
      ));
      setSuccess('Parent approved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve parent.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const closeApprovalModal = () => {
    setApprovalModal(null);
    setApprovalNote('');
  };

  const handleApprovalSubmit = async () => {
    if (!approvalNote.trim()) {
      setError('Please write a reason before submitting.');
      return;
    }
    setApprovalLoading(true);
    setError('');
    try {
      const endpoint = approvalModal.action === 'approve'
        ? `/staff/parents/${approvalModal.parentId}/approve`
        : `/staff/parents/${approvalModal.parentId}/disapprove`;
      const res = await api.put(endpoint, { note: approvalNote });
      setParents(prev => prev.map(p =>
        p._id === approvalModal.parentId
          ? { ...p, approvalStatus: res.data.data.approvalStatus, approvalNote: res.data.data.approvalNote }
          : p
      ));
      const actionWord = approvalModal.action === 'approve' ? 'approved' : 'disapproved';
      setApprovalModal(prev => ({ ...prev, submitted: true, actionWord }));
      setTimeout(() => {
        closeApprovalModal();
        setSuccess(`Parent ${actionWord} successfully.`);
        setTimeout(() => setSuccess(''), 3000);
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed. Please try again.');
    } finally {
      setApprovalLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">

      {/* Delete confirmation modal — portal so it always centers on viewport */}
      {deleteTarget && ReactDOM.createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e2535] shadow-2xl overflow-hidden mx-4">
            {/* Icon + Title */}
            <div className="flex items-center gap-4 px-6 pt-6 pb-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                <i className="bx bx-trash text-2xl text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Parent</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Are you sure you want to delete this parent account?</p>
              </div>
            </div>

            {/* Warning */}
            <div className="px-6 pb-3">
              <p className="text-xs font-semibold text-rose-500">This action cannot be undone.</p>
            </div>

            {/* Checkbox */}
            <div className="px-6 pb-5">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${deleteForEveryone ? 'bg-[#00ADB5] border-[#00ADB5]' : 'border-slate-400 dark:border-slate-500'}`}
                  onClick={() => setDeleteForEveryone(p => !p)}
                >
                  {deleteForEveryone && <i className="bx bx-check text-white text-sm" />}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">Also delete all children records</span>
              </label>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 dark:border-slate-700" />

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteForEveryone(false); }}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('parentManagementTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{parents.length} {t('registeredParents')}</p>
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">✅ {success}</div>}

      {/* Search */}
      <div className="relative">
        <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" placeholder={t('searchParents')}
          value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Parent List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-group text-4xl" /><p className="text-sm mt-2">{t('noParentsFound')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedParents.map(p => (
            <div key={p._id} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {rvInitials(p.fullName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">{rv(p.fullName)}</h3>
                    <p className="text-xs text-slate-400">{rv(p.email)}</p>
                    <p className="text-xs text-slate-400">{rvPhone(p)}</p>
                    {rvOrg(p) !== 'N/A' && <p className="text-xs text-indigo-400">{rvOrg(p)}</p>}
                    {(p.emergencyContact?.name || p.emergencyContact?.phone) && (
                      <p className="text-xs text-amber-500 mt-0.5">
                        <i className="bx bx-user-check mr-1" />
                        {rvEmergency(p.emergencyContact)}
                      </p>
                    )}
                    <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      p.approvalStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.approvalStatus === 'disapproved' ? 'bg-rose-500/10 text-rose-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {t(p.approvalStatus || 'pending', p.approvalStatus || 'pending')}
                    </span>
                    {p.approvalNote && (
                      <p className="text-xs text-slate-400 mt-1 italic">"{rv(p.approvalNote)}"</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {/* Block / Unblock button */}
                  <button
                    onClick={() => handleBlock(p._id, p.isBlocked)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      p.isBlocked
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30'
                        : 'bg-slate-100 dark:bg-[#0d1520] text-slate-500 dark:text-slate-400 hover:bg-orange-50 hover:text-orange-500 dark:hover:text-orange-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <i className={`bx ${p.isBlocked ? 'bx-lock-open-alt' : 'bx-block'} text-base`} />
                    {p.isBlocked ? 'Unblock' : 'Block'}
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={() => setDeleteTarget(p._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#0d1520] text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <i className="bx bx-trash text-base" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Children */}
              {p.children?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-teal-900/30">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('children')}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.children.slice(0, 5).map(c => (
                      <span key={c._id} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full">
                        <i className="bx bx-child text-sm" />
                        {rv(c.firstName)} {rv(c.lastName)}
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

      {/* Approval Modal */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#1a2535] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div className="flex items-start gap-4 px-6 pt-6 pb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5 ${
                approvalModal.action === 'approve'
                  ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                <i className={`bx ${approvalModal.action === 'approve' ? 'bx-check-shield' : 'bx-error'}`} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {approvalModal.action === 'approve' ? t('approveParent') : t('disapproveParent')}
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">{t('provideReasonForDecision')}</p>
              </div>
            </div>

            {approvalModal.submitted ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 px-6">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl ${
                  approvalModal.actionWord === 'approved'
                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-100 dark:bg-amber-500/10 text-amber-500'
                }`}>
                  <i className={`bx ${approvalModal.actionWord === 'approved' ? 'bx-check-circle' : 'bx-x-circle'}`} />
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-white capitalize">
                  Parent {approvalModal.actionWord} successfully!
                </p>
                <p className="text-xs text-slate-400">{t('windowWillCloseAuto')}</p>
              </div>
            ) : (
              <div className="px-6 pb-6 space-y-4">
                {/* Textarea */}
                <textarea
                  value={approvalNote}
                  onChange={e => { setApprovalNote(e.target.value); if (error) setError(''); }}
                  placeholder={approvalModal.action === 'approve'
                    ? 'e.g. All documents verified and parent meets enrollment requirements.'
                    : 'e.g. Missing required documents, please resubmit with updated ID.'}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm bg-white dark:bg-[#0d1929] text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 resize-none transition-all"
                />
                {error && <p className="text-rose-500 text-xs">{error}</p>}

                {/* Buttons */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeApprovalModal}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleApprovalSubmit}
                    disabled={approvalLoading}
                    className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 ${
                      approvalModal.action === 'approve'
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : 'bg-amber-500 hover:bg-amber-600'
                    }`}
                  >
                    {approvalLoading
                      ? t('submitting')
                      : approvalModal.action === 'approve'
                        ? t('confirmApproval')
                        : t('confirmDisapproval')
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentManagement;

