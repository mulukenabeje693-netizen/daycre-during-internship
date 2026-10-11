import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import { rv, emergency as rvEmergency, classroom as rvClassroom, initials as rvInitials, age as rvAge } from '../../utils/renderValue';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';
import Pagination from '../../components/shared/Pagination';

/* ─── helpers ─────────────────────────────────────────────── */
const EMPTY_FORM = {
  firstName: '', lastName: '', dateOfBirth: '', gender: 'male',
  allergies: '', medicalNotes: '', vaccinationStatus: 'unknown',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
  status: 'active',
};

const toFormValues = (child) => ({
  firstName: child.firstName || '',
  lastName:  child.lastName  || '',
  dateOfBirth: child.dateOfBirth ? child.dateOfBirth.split('T')[0] : '',
  gender: child.gender || 'male',
  allergies: child.allergies || '',
  medicalNotes: child.medicalNotes || '',
  vaccinationStatus: child.vaccinationStatus || 'unknown',
  emergencyContactName: child.emergencyContact?.name || '',
  emergencyContactPhone: '',
  emergencyContactRelationship: child.emergencyContact?.relationship || '',
  status: child.status || 'active',
});

/* ─── component ───────────────────────────────────────────── */
const ChildList = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isReception = user?.role === 'reception';
  const isTeacher = user?.role === 'teacher';
  const [children, setChildren]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilter]   = useState('all');
  const [sortBy, setSortBy]         = useState('nameAsc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  // Edit modal state
  const [editModal, setEditModal]   = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [editError, setEditError]   = useState('');

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);

  // Approval modal state
  const [approvalModal, setApprovalModal] = useState(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [approvalSubmitted, setApprovalSubmitted] = useState(false);

  /* fetch ─────────────────────────────────────────────────── */
  const fetchChildren = async () => {
    try {
      setError('');
      // Teacher/nanny: /children already scopes to their classroom on the backend
      // (childController filters by classroom when role === 'teacher')
      const res = await api.get('/children');
      setChildren(res.data.data || []);
    } catch (err) {
      // Teachers get 0 children if not assigned to a classroom yet — show empty gracefully
      if (err.response?.status === 403) {
        setChildren([]);
      } else {
        setError(err.response?.data?.message || 'Failed to load children. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChildren(); }, []);

  /* flash helpers ─────────────────────────────────────────── */
  const flash = (setter, msg, ms = 3500) => {
    setter(msg); setTimeout(() => setter(''), ms);
  };

  /* ── APPROVE ──────────────────────────────────────────────── */
  const handleApprove = async (child) => {
    try {
      const res = await api.put(`/children/${child._id}/approve`, { note: 'Approved by admin' });
      setChildren(prev => prev.map(c =>
        c._id === child._id ? { ...c, status: res.data?.data?.status || 'approved' } : c
      ));
      flash(setSuccess, `${child.firstName} ${child.lastName} has been approved.`);
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Approval failed. Please try again.');
    }
  };

  /* ── DISAPPROVE MODAL ─────────────────────────────────────── */
  const [disapproveModal, setDisapproveModal] = useState(null); // child object | null
  const [disapproveNote, setDisapproveNote]   = useState('');
  const [disapproving, setDisapproving]       = useState(false);

  const openDisapproveModal = (child) => {
    setDisapproveModal(child);
    setDisapproveNote('');
  };

  const handleDisapprove = async () => {
    setDisapproving(true);
    try {
      const res = await api.put(`/children/${disapproveModal._id}/disapprove`, {
        note: disapproveNote || 'Disapproved by admin',
      });
      setChildren(prev => prev.map(c =>
        c._id === disapproveModal._id ? { ...c, status: res.data?.data?.status || 'disapproved' } : c
      ));
      flash(setSuccess, `${disapproveModal.firstName} ${disapproveModal.lastName} has been disapproved.`);
      setDisapproveModal(null);
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Disapproval failed. Please try again.');
    } finally {
      setDisapproving(false);
    }
  };

  /* ── EDIT ─────────────────────────────────────────────────── */
  const openEdit = (child) => {
    setForm(toFormValues(child));
    setEditError('');
    setEditModal(child);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (editError) setEditError('');
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setEditError('First name and last name are required.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const payload = {
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender:      form.gender,
        allergies:   form.allergies.trim(),
        medicalNotes: form.medicalNotes.trim(),
        vaccinationStatus: form.vaccinationStatus,
        status:      form.status,
        emergencyContact: {
          name:         form.emergencyContactName.trim(),
          phone:        form.emergencyContactPhone.trim(),
          relationship: form.emergencyContactRelationship.trim(),
        },
      };
      const res = await api.put(`/children/${editModal._id}`, payload);
      setChildren(prev => prev.map(c => c._id === editModal._id ? { ...c, ...res.data.data } : c));
      setEditModal(null);
      flash(setSuccess, `${form.firstName}'s info updated successfully.`);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── DELETE ───────────────────────────────────────────────── */
  const openDelete = (child) => {
    setDeleteModal(child);
    setDeleteForEveryone(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/children/${deleteModal._id}`);
      setChildren(prev => prev.filter(c => c._id !== deleteModal._id));
      flash(setSuccess, `${deleteModal.firstName}'s record has been removed.`);
      setDeleteModal(null);
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Delete failed.');
      setDeleteModal(null);
    } finally {
      setDeleting(false);
    }
  };

  /* ── APPROVE / DISAPPROVE ────────────────────────────────── */
  const openApprovalModal = (child, action) => {
    setApprovalModal({ child, action });
    setApprovalNote('');
    setApprovalError('');
    setApprovalSubmitted(false);
  };

  const closeApprovalModal = () => {
    setApprovalModal(null);
    setApprovalNote('');
    setApprovalError('');
    setApprovalSubmitted(false);
  };

  const handleApprovalSubmit = async () => {
    if (!approvalModal) return;
    const { child, action } = approvalModal;
    setApprovalLoading(true);
    setApprovalError('');

    try {
      const endpoint = action === 'approve'
        ? `/children/${child._id}/approve`
        : `/children/${child._id}/disapprove`;
      const res = await api.put(endpoint, { note: approvalNote });
      setChildren(prev => prev.map(c => c._id === child._id ? res.data.data : c));
      setApprovalSubmitted(true);
      const actionWord = action === 'approve' ? 'approved' : 'disapproved';
      flash(setSuccess, `Child ${actionWord} successfully.`);
      setTimeout(() => closeApprovalModal(), 1200);
    } catch (err) {
      setApprovalError(err.response?.data?.message || 'Action failed. Please try again.');
    } finally {
      setApprovalLoading(false);
    }
  };

  /* filter & sort ───────────────────────────────────────────── */
  const filtered = children.filter(c => {
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortBy === 'nameAsc') {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'nameDesc') {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return nameB.localeCompare(nameA);
      }
      if (sortBy === 'dateNewest' || sortBy === 'dateOldest') {
        const getTs = (item) => {
          if (item.createdAt) return new Date(item.createdAt).getTime();
          if (item.enrollmentDate) return new Date(item.enrollmentDate).getTime();
          const idStr = String(item._id || '');
          if (idStr.length === 24) return parseInt(idStr.substring(0, 8), 16) * 1000;
          return 0;
        };
        const diff = getTs(b) - getTs(a);
        return sortBy === 'dateNewest' ? diff : -diff;
      }
      if (sortBy === 'yearYoungest' || sortBy === 'yearOldest') {
        const getDob = (item) => {
          if (item.dateOfBirth) return new Date(item.dateOfBirth).getTime();
          return 0;
        };
        const dobA = getDob(a);
        const dobB = getDob(b);
        if (!dobA && !dobB) return 0;
        if (!dobA) return 1;
        if (!dobB) return -1;
        return sortBy === 'yearYoungest' ? dobB - dobA : dobA - dobB;
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
  const paginatedChildren = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  /* export ─────────────────────────────────────────────────── */
  const handleExport = () => {
    const headers = ['First Name', 'Last Name', 'Age', 'Classroom', 'Allergies', 'Vaccination', 'Status'];
    const rows = sorted.map(c => [
      rv(c.firstName), rv(c.lastName), rvAge(c.age, 'yrs', 'N/A'),
      rvClassroom(c.classroom, 'Unassigned'),
      rv(c.allergies, 'None'), rv(c.vaccinationStatus, 'unknown'), rv(c.status, 'active'),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `child-roster-${new Date().toISOString().split('T')[0]}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
    flash(setSuccess, 'Export successful!');
  };

  /* ── render ────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('updateChildInfo')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{children.length} {t('childrenEnrolled')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
            <i className="bx bx-download" /> {t('export')}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] border border-slate-200 dark:border-teal-900/40 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shadow-sm">
            <i className="bx bx-printer" /> {t('print')}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error   && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-sm">{success}</div>}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t('searchChildren', 'Search children...')} value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        {!isTeacher && (
          <select value={filterStatus} onChange={e => { setFilter(e.target.value); setCurrentPage(1); }}
            className="border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">{t('allStatus')}</option>
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive', 'Inactive')}</option>
            <option value="waitlist">{t('waitlist')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="approved">{t('approved')}</option>
            <option value="disapproved">{t('disapproved')}</option>
          </select>
        )}
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
            <option value="yearYoungest">{t('sortYearYoungest', 'Birth Year (Youngest)')}</option>
            <option value="yearOldest">{t('sortYearOldest', 'Birth Year (Oldest)')}</option>
          </select>
          <i className="bx bx-sort absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="bx bx-search text-4xl" />
          <p className="mt-2">{t('noChildrenFound', 'No children found.')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]/50">
                  {[
                    { label: t('thChild'), key: 'Child' },
                    { label: t('thAge'), key: 'Age' },
                    { label: t('thClassroom'), key: 'Classroom' },
                    { label: t('thAllergies'), key: 'Allergies' },
                    { label: t('thVaccination'), key: 'Vaccination' },
                    { label: t('thStatus'), key: 'Status' },
                    ...(isReception ? [{ label: t('thActions'), key: 'Actions' }] : [])
                  ].map(h => (
                    <th key={h.key} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedChildren.map(child => (
                  <tr key={child._id}
                    className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">

                    {/* Child name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {rvInitials(`${child.firstName} ${child.lastName}`)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-800 dark:text-white">{rv(child.firstName)} {rv(child.lastName)}</p>
                            {child.dateOfBirth && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                                {new Date(child.dateOfBirth).getFullYear()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span className="capitalize">{t(child.gender?.toLowerCase() || 'other', child.gender || 'Other')}</span>
                            {(child.createdAt || child.enrollmentDate) && (
                              <span>• {t('registered', 'Reg')}: {new Date(child.createdAt || child.enrollmentDate).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{rvAge(child.age, t('yrs', 'yrs'), 'N/A')}</td>

                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">
                        {rvClassroom(child.classroom, t('unassigned', 'Unassigned'))}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {child.allergies
                        ? <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">{rv(child.allergies)}</span>
                        : <span className="text-xs text-slate-400">{t('none', 'None')}</span>}
                    </td>

                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        child.vaccinationStatus === 'up-to-date' ? 'bg-emerald-500/10 text-emerald-400' :
                        child.vaccinationStatus === 'incomplete'  ? 'bg-amber-500/10 text-amber-400' :
                        'bg-slate-500/10 text-slate-400'}`}>
                        {t(child.vaccinationStatus === 'up-to-date' ? 'upToDate' : child.vaccinationStatus, child.vaccinationStatus)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        child.status === 'active'      ? 'bg-emerald-500/10 text-emerald-400' :
                        child.status === 'approved'    ? 'bg-emerald-500/10 text-emerald-400' :
                        child.status === 'disapproved' ? 'bg-rose-500/10 text-rose-400' :
                        child.status === 'waitlist'    ? 'bg-amber-500/10 text-amber-400' :
                        child.status === 'pending'     ? 'bg-cyan-500/10 text-cyan-400' :
                        'bg-slate-500/10 text-slate-400'}`}>
                        {t(child.status, child.status)}
                      </span>
                    </td>

                    {/* Actions — reception only */}
                    {isReception && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(child)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30 transition-colors"
                          >
                            <i className="bx bx-edit-alt text-sm" /> {t('edit')}
                          </button>
                          <button
                            onClick={() => openDelete(child)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30 transition-colors"
                          >
                            <i className="bx bx-trash text-sm" /> {t('delete')}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-4 border-t border-slate-100 dark:border-teal-900/30">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sorted.length}
              itemsPerPage={ITEMS_PER_PAGE}
              itemLabel={t('childrenLabel', 'children')}
            />
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ─────────────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            style={{ resize: 'both', overflow: 'hidden', minWidth: '340px', width: '660px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/40 shadow-2xl"
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-100 dark:border-teal-900/30 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-lg">
                  <i className="bx bx-edit-alt" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">{t('updateChildDetails')}</h3>
                  <p className="text-xs text-slate-400">{editModal.firstName} {editModal.lastName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-[10px] text-slate-400 italic select-none">{t('dragToResize')}</span>
                <button onClick={() => setEditModal(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <i className="bx bx-x text-xl" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Basic info */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('personalInformation')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('fullName').split(' ')[0]} *</label>
                    <input name="firstName" value={form.firstName} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('fullName').split(' ').slice(1).join(' ') || 'Last Name'} *</label>
                    <input name="lastName" value={form.lastName} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('dateLabel')}</label>
                    <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('male').replace('Male','') || 'Gender'}</label>
                    <select name="gender" value={form.gender} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="male">{t('male')}</option>
                      <option value="female">{t('female')}</option>
                      <option value="other">{t('other')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('thStatus')}</label>
                    <select name="status" value={form.status} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="active">{t('active')}</option>
                      <option value="inactive">{t('inactive')}</option>
                      <option value="waitlist">{t('waitlist')}</option>
                      <option value="pending">{t('pending')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('thVaccination')}</label>
                    <select name="vaccinationStatus" value={form.vaccinationStatus} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="unknown">{t('unknown')}</option>
                      <option value="up-to-date">{t('upToDate')}</option>
                      <option value="incomplete">{t('incomplete')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Medical info */}
              <div className="border-t border-slate-100 dark:border-teal-900/30 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('thAllergies')} & {t('additionalNotes')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('thAllergies')}</label>
                    <input name="allergies" value={form.allergies} onChange={handleFormChange} placeholder="e.g. Peanuts, dairy"
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('additionalNotes')}</label>
                    <input name="medicalNotes" value={form.medicalNotes} onChange={handleFormChange} placeholder="e.g. Asthma, special care"
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              {/* Emergency contact */}
              <div className="border-t border-slate-100 dark:border-teal-900/30 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('helpSupport').split('&')[0].trim()}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('fullName')}</label>
                    <input name="emergencyContactName" value={form.emergencyContactName} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('phoneNumber')}</label>
                    <input name="emergencyContactPhone" value={form.emergencyContactPhone} onChange={handleFormChange}
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('role').replace(' *','')}</label>
                    <input name="emergencyContactRelationship" value={form.emergencyContactRelationship} onChange={handleFormChange} placeholder="e.g. Mother, Uncle"
                      className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              {editError && <p className="text-rose-400 text-xs mt-1">{editError}</p>}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-slate-100 dark:border-teal-900/30 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setEditModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl border border-transparent hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-400 dark:hover:text-rose-400 transition-all">
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

      {/* ── DELETE MODAL ───────────────────────────────────────── */}
      <DeleteConfirmModal
        isOpen={!!deleteModal}
        title="Delete Child Record"
        description={deleteModal ? `Remove ${deleteModal.firstName} ${deleteModal.lastName}'s record?` : ''}
        warning="This action cannot be undone."
        checkboxLabel={t('deleteForEveryone')}
        checked={deleteForEveryone}
        onCheck={() => setDeleteForEveryone(p => !p)}
        onCancel={() => { setDeleteModal(null); setDeleteForEveryone(false); }}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel={deleting ? t('deleting') : t('delete')}
        cancelLabel={t('cancel')}
      />

      {/* ── DISAPPROVE MODAL ──────────────────────────────────── */}
      {disapproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#1a2535] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div className="flex items-start gap-4 px-6 pt-6 pb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <i className="bx bx-error text-xl" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('disapproveChild')}</h3>
                <p className="text-sm text-slate-400 mt-0.5">{t('provideReasonForDecision')}</p>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <textarea
                value={disapproveNote}
                onChange={e => setDisapproveNote(e.target.value)}
                placeholder="e.g. Missing required documents, please resubmit with updated ID."
                rows={4}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm bg-white dark:bg-[#0d1929] text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 resize-none transition-all"
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDisapproveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDisapprove}
                  disabled={disapproving}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {disapproving ? t('submitting') : t('confirmDisapproval')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVAL MODAL (existing) ──────────────────────────── */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/40 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                approvalModal.action === 'approve'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}>
                <i className={`bx ${approvalModal.action === 'approve' ? 'bx-check-circle' : 'bx-x-circle'}`} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white capitalize">
                  {approvalModal.action === 'approve' ? t('approveChildAction') : t('disapproveChild')}
                </h3>
                <p className="text-xs text-slate-400">{t('provideReasonForDecision')}</p>
              </div>
            </div>

            {approvalSubmitted ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl ${
                  approvalModal.action === 'approve' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  <i className={`bx ${approvalModal.action === 'approve' ? 'bx-check-circle' : 'bx-x-circle'}`} />
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-white capitalize">
                  {approvalModal.action === 'approve' ? t('childApprovedSuccess') : t('childDisapprovedSuccess')}
                </p>
                <p className="text-xs text-slate-400">{t('windowWillCloseAuto')}</p>
              </div>
            ) : (
              <>
                <textarea
                  value={approvalNote}
                  onChange={e => { setApprovalNote(e.target.value); if (approvalError) setApprovalError(''); }}
                  placeholder={approvalModal.action === 'approve'
                    ? 'e.g. All documents verified and enrollment details are complete.'
                    : 'e.g. Missing required documents, please resubmit with updated ID.'
                  }
                  rows={4}
                  className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-sm bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                {approvalError && <p className="text-rose-400 text-xs mt-2">{approvalError}</p>}

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={closeApprovalModal}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleApprovalSubmit}
                    disabled={approvalLoading}
                    className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors ${
                      approvalModal.action === 'approve'
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : 'bg-rose-500 hover:bg-rose-600'
                    } disabled:opacity-50`}
                  >
                    {approvalLoading ? t('submitting') : approvalModal.action === 'approve' ? t('confirmApproval') : t('confirmDisapproval')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ChildList;
