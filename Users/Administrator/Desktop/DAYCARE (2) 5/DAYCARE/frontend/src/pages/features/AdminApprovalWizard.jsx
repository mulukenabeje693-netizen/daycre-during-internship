import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';
import Pagination from '../../components/shared/Pagination';

/* ─── helpers ─────────────────────────────────────────────── */
const initials = (name = '') => {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
};

const StatusPill = ({ status }) => {
  const map = {
    approved:     'bg-emerald-100 text-emerald-700 border-emerald-200',
    disapproved:  'bg-amber-100   text-amber-700   border-amber-200',
    pending:      'bg-cyan-100    text-cyan-700    border-cyan-200',
    resubmitted:  'bg-violet-100  text-violet-700  border-violet-200',
    active:       'bg-emerald-100 text-emerald-700 border-emerald-200',
    waitlist:     'bg-slate-100   text-slate-500   border-slate-200',
  };
  const label = status === 'resubmitted' ? '🔄 Re-submitted' : (status || 'pending');
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${map[status] || map.pending}`}>
      {label}
    </span>
  );
};

/* ─── Field row ─────────────────────────────────────────────── */
const Field = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`text-sm font-medium ${!value ? 'text-slate-400 dark:text-slate-500 italic' : 'text-slate-800 dark:text-slate-100'}`}>
      {value || 'Not Provided'}
    </p>
  </div>
);

/* ─── ID Card Image viewer ──────────────────────────────────── */
const IdCardImage = ({ url, label, icon, t }) => {
  const [lightbox, setLightbox] = useState(false);
  const src = url ? `http://localhost:5000${url}` : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <i className={`bx ${icon} text-sm text-[#00ADB5]`} />
          {label}
        </p>

        {src ? (
          <div
            onClick={() => setLightbox(true)}
            className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#0d1929] cursor-zoom-in aspect-[3/2]"
          >
            <img
              src={src}
              alt={label}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
            {/* fallback if image fails */}
            <div className="hidden absolute inset-0 items-center justify-center flex-col gap-1 text-slate-400">
              <i className="bx bx-image text-3xl" />
              <p className="text-[10px]">{t('imageLoadError', 'Cannot load image')}</p>
            </div>
            {/* hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
              <i className="bx bx-zoom-in text-2xl text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1929] aspect-[3/2] flex flex-col items-center justify-center gap-1 text-slate-300 dark:text-slate-600">
            <i className="bx bx-image text-3xl" />
            <p className="text-[10px]">{t('notUploaded', 'Not uploaded')}</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && src && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(false)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-semibold flex items-center gap-1 transition-colors"
            >
              <i className="bx bx-x text-xl" /> {t('close', 'Close')}
            </button>
            <img src={src} alt={label} className="w-full rounded-2xl shadow-2xl" />
            <p className="text-center text-white/60 text-xs mt-3">{label}</p>
          </div>
        </div>
      )}
    </>
  );
};

/* ─── Stepper ───────────────────────────────────────────────── */
const STEPS = [
  { id: 1, labelKey: 'step1' },
  { id: 2, labelKey: 'step2' },
];

const Stepper = ({ currentStep, parentStatus, t }) => (
  <div className="flex items-center gap-0 mb-8">
    {STEPS.map((step, idx) => {
      const isActive    = currentStep === step.id;
      const isCompleted = currentStep > step.id;
      const isLocked    = step.id === 2 && (parentStatus === 'pending' || parentStatus === 'resubmitted');
      return (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
              isCompleted
                ? 'bg-[#00ADB5] border-[#00ADB5] text-white shadow-[0_0_12px_rgba(0,173,181,0.35)]'
                : isActive
                ? 'border-[#00ADB5] text-[#00ADB5] bg-white dark:bg-[#0d1929]'
                : isLocked
                ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 bg-white dark:bg-[#0d1929]'
                : 'border-slate-200 dark:border-slate-700 text-slate-400 bg-white dark:bg-[#0d1929]'
            }`}>
              {isCompleted
                ? <CheckCircle2 className="text-xl" />
                : isLocked
                ? <ShieldCheck className="text-base" />
                : <span className="text-base font-bold">{step.id}</span>}
            </div>
            <div className="text-center">
              <p className={`text-[11px] font-bold uppercase tracking-widest ${
                isActive ? 'text-[#00ADB5]' : isCompleted ? 'text-[#00ADB5]' : 'text-slate-400'
              }`}>{t(step.labelKey)}</p>
              {isLocked && <p className="text-[9px] text-slate-400">{t('parentApprovalHint', 'Must approve parent first')}</p>}
            </div>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`flex-shrink-0 h-px w-16 mb-6 transition-colors ${
              currentStep > 1 ? 'bg-[#00ADB5]' : 'bg-slate-200 dark:bg-slate-700'
            }`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const DecisionPanel = ({ status, note, onApprove, onDisapprove, loading, type, t }) => {
  const [showReason, setShowReason] = useState(false);
  // Pre-fill with existing reason when editing a disapproval
  const [reason, setReason]         = useState('');
  const [editing, setEditing]       = useState(false);

  const handleDisapprove = () => {
    if (!showReason) { setShowReason(true); return; }
    onDisapprove(reason);
  };

  // When entering edit mode, pre-fill reason if already disapproved
  const startEdit = () => {
    const isDisapproved = status === 'disapproved';
    setReason(isDisapproved && note ? note : '');
    // Auto-open the reason textarea when editing a disapproval
    setShowReason(isDisapproved);
    setEditing(true);
  };

  // Reset local state when editing is toggled off
  const cancelEdit = () => {
    setEditing(false);
    setShowReason(false);
    setReason('');
  };

  // Show decision form when pending, resubmitted, OR when admin clicked "Edit"
  const showForm = !status || status === 'pending' || status === 'resubmitted' || editing;

  if (!showForm) {
    // Already decided — show result banner + Edit button
    const isApproved = status === 'approved' || status === 'active';
    return (
      <div className="space-y-3">
        <div className={`flex items-center gap-3 rounded-xl px-5 py-4 border ${
          isApproved
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25'
        }`}>
          {isApproved
            ? <CheckCircle2 className="text-emerald-500 text-xl flex-shrink-0" />
            : <XCircle className="text-amber-500 text-xl flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${isApproved ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {type === 'parent' ? t('parentVerification', 'Parent Verification') : t('childVerification', 'Child Verification')}{' '}
              {isApproved ? t('approved') : t('disapproved')}
            </p>
            {note && <p className={`text-xs mt-0.5 italic ${isApproved ? 'text-emerald-600/70' : 'text-amber-600/70'}`}>"{note}"</p>}
          </div>
          {/* Edit button */}
          <button
            onClick={startEdit}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-[#00ADB5] hover:text-[#00ADB5] transition-all"
          >
            <i className="bx bx-edit text-sm" /> {t('edit', 'Edit')}
          </button>
        </div>
      </div>
    );
  }

  // Decision form (pending or editing)
  return (
    <div className="space-y-3">
      {editing && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-2.5 text-xs text-blue-700 dark:text-blue-400">
          <i className="bx bx-info-circle text-sm flex-shrink-0" />
          <span>{t('editDecisionHint', 'You are changing a previous decision. Select the new status below.')}</span>
        </div>
      )}
      {showReason && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
            {t('disapproveReason', 'Reason for disapproval')}
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder={t('parentApprovalHint')}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060d14] px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 resize-none transition-all"
          />
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => { onApprove(''); cancelEdit(); }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-all shadow-sm disabled:opacity-50"
        >
          <CheckCircle2 className="text-base" />
          {t('approve')} {type === 'parent' ? t('parentVerification', 'Parent Verification') : t('childVerification', 'Child Verification')}
        </button>
        <button
          onClick={handleDisapprove}
          disabled={loading || (showReason && !reason.trim())}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all shadow-sm disabled:opacity-50"
        >
          {loading
            ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <XCircle className="text-base" />
          }
          {t('disapprove')}
        </button>
        {(showReason || editing) && (
          <button
            onClick={cancelEdit}
            className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {t('cancel', 'Cancel')}
          </button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const AdminApprovalWizard = () => {
  const { t } = useLanguage();
  const [families, setFamilies]     = useState([]);
  const [selected, setSelected]     = useState(null); // { parent, children[] }
  const [step, setStep]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const flash = (setter, msg) => { setter(msg); setTimeout(() => setter(''), 3500); };

  /* ── fetch all parents with children ─────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/parents');
      setFamilies(res.data.data || []);
    } catch {
      flash(setError, t('failedToLoadFamilies'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  /* ── open wizard for a family ─────────────────────────── */
  const openWizard = (parent) => {
    setSelected(parent);
    // If parent already approved, start at step 2; resubmitted always starts at step 1
    setStep(parent.approvalStatus === 'approved' ? 2 : 1);
    setError('');
    setSuccess('');
  };

  /* ── STEP 1: approve/disapprove parent ───────────────── */
  const handleParentDecision = async (action, note) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const endpoint = action === 'approve'
        ? `/staff/parents/${selected._id}/approve`
        : `/staff/parents/${selected._id}/disapprove`;
      const res = await api.put(endpoint, { note });
      const updated = { ...selected, approvalStatus: res.data.data.approvalStatus, approvalNote: res.data.data.approvalNote };
      setSelected(updated);
      setFamilies(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p));
      if (action === 'approve') {
        flash(setSuccess, t('parentApprovedSuccess'));
        setTimeout(() => setStep(2), 800);
      } else {
        flash(setSuccess, t('parentDisapprovedSuccess'));
      }
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── STEP 2: approve/disapprove child ────────────────── */
  const handleChildDecision = async (childId, action, note) => {
    setActionLoading(true);
    try {
      const endpoint = action === 'approve'
        ? `/children/${childId}/approve`
        : `/children/${childId}/disapprove`;
      const res = await api.put(endpoint, { note });
      const updatedChild = res.data.data;
      setSelected(prev => ({
        ...prev,
        children: prev.children.map(c =>
          c._id === childId ? { ...c, status: updatedChild.status, approvalNote: updatedChild.approvalNote } : c
        ),
      }));
      setFamilies(prev => prev.map(p =>
        p._id === selected._id
          ? { ...p, children: p.children.map(c => c._id === childId ? { ...c, status: updatedChild.status } : c) }
          : p
      ));
      flash(setSuccess, action === 'approve' ? t('childApprovedSuccess') : t('childDisapprovedSuccess'));
    } catch (err) {
      flash(setError, err.response?.data?.message || t('actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  /* ── filtered families ────────────────────────────────── */
  // A family appears in pending when status is 'pending' OR 'resubmitted'
  const isEffectivelyPending = (p) => ['pending', 'resubmitted'].includes(p.approvalStatus || 'pending');
  const parentMatches = (p, status) => {
    const s = p.approvalStatus || 'pending';
    if (status === 'pending') return s === 'pending' || s === 'resubmitted';
    return s === status;
  };
  const childrenMatch = (p, status) => (p.children || []).some(c => (c.status || 'pending') === status);

  const filtered = families.filter(p =>
    filterStatus === 'all' ? true : (parentMatches(p, filterStatus) || childrenMatch(p, filterStatus))
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedFamilies = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const counts = {
    // pending includes both 'pending' and 'resubmitted'
    pending:     families.filter(p => isEffectivelyPending(p) || childrenMatch(p, 'pending')).length,
    approved:    families.filter(p => parentMatches(p, 'approved')    || childrenMatch(p, 'approved')).length,
    disapproved: families.filter(p => parentMatches(p, 'disapproved') || childrenMatch(p, 'disapproved')).length,
  };

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#00ADB5] mb-1">{t('adminApprovalsHeader')}</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('enrollmentApprovals')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('approvalWorkflowDescription')}
          </p>
        </div>
        <button onClick={load}
          className="self-start inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent px-4 py-2 text-sm font-semibold text-[#00ADB5] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
          <i className="bx bx-refresh text-base" /> {t('refresh')}
        </button>
      </div>

      {/* ── Alerts ───────────────────────────────────────── */}
      {error   && <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400"><i className="bx bx-error-circle flex-shrink-0"/>{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"><i className="bx bx-check-circle flex-shrink-0"/>{success}</div>}

      {/* ── Stats filter row ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'pending',     label: t('pending', 'Pending'),     count: counts.pending,     dot: 'bg-cyan-400',    active: 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/25 dark:text-cyan-400' },
          { key: 'approved',    label: t('approved', 'Approved'),    count: counts.approved,    dot: 'bg-emerald-400', active: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-400' },
          { key: 'disapproved', label: t('disapproved', 'Disapproved'), count: counts.disapproved, dot: 'bg-amber-400',   active: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-400' },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setFilterStatus(tab.key); setCurrentPage(1); }}
            className={`flex items-center gap-3 rounded-2xl border p-4 transition-all text-left ${
              filterStatus === tab.key
                ? `${tab.active} shadow-sm`
                : 'bg-white dark:bg-[#0d1929] border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#00ADB5]/30'
            }`}>
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tab.dot}`} />
            <div>
              <p className="text-xl font-extrabold leading-none">{tab.count}</p>
              <p className="text-[11px] font-medium mt-0.5">{tab.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Family list ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Left: family list */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <i className="bx bx-group text-base text-[#00ADB5]" />
            {filtered.length} {t(filterStatus)} {t('families', 'Families')}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-[#00ADB5] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-400">
              <i className="bx bx-group text-4xl opacity-30" />
              <p className="text-sm">{t('noPendingFamilies', 'No pending families')}</p>
            </div>
          ) : (
            <>
              {paginatedFamilies.map(parent => {
                const isSelected = selected?._id === parent._id;
                const pStatus = parent.approvalStatus || 'pending';
                const isResubmitted = pStatus === 'resubmitted';
                return (
                  <button key={parent._id} onClick={() => openWizard(parent)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#00ADB5] bg-[#00ADB5]/5 shadow-sm ring-2 ring-[#00ADB5]/20'
                        : isResubmitted
                        ? 'bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/30 hover:border-violet-400'
                        : 'bg-white dark:bg-[#0d1929] border-slate-200 dark:border-slate-700 hover:border-[#00ADB5]/40 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                          pStatus === 'approved' ? 'bg-emerald-400' :
                          pStatus === 'disapproved' ? 'bg-amber-400' :
                          isResubmitted ? 'bg-violet-400' :
                          'bg-[#00ADB5]'
                        }`}>{initials(parent.fullName)}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800 dark:text-white">{parent.fullName}</p>
                            {isResubmitted && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">
                                Re-submitted
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{parent.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusPill status={t(pStatus, pStatus)} />
                        <p className="text-[10px] text-slate-400">{parent.children?.length || 0} {t('children', 'children')}</p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Pagination */}
              <div className="bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filtered.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  itemLabel={t('familiesLabel', 'families')}
                />
              </div>
            </>
          )}
        </div>

        {/* Right: wizard panel */}
        <div>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] text-slate-400 gap-3">
              <i className="bx bx-select-multiple text-5xl opacity-20" />
              <p className="text-sm font-medium">{t('selectFamilyPrompt')}</p>
              <p className="text-xs opacity-70">{t('reviewOrderHint')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Wizard header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white text-base">
                  {selected.fullName}
                </h3>
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <i className="bx bx-x text-xl" />
                </button>
              </div>

              <div className="px-6 pt-6 pb-8 space-y-6">
                {/* Stepper */}
                <Stepper currentStep={step} parentStatus={selected.approvalStatus || 'pending'} t={t} />

                {/* ── STEP 1: Parent details ─────────────── */}
                {step === 1 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">

                    {/* Re-submission banner */}
                    {selected.approvalStatus === 'resubmitted' && (
                      <div className="flex items-start gap-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/25 px-4 py-4">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <i className="bx bx-revision text-violet-600 dark:text-violet-400 text-lg" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-violet-700 dark:text-violet-400">
                            🔄 Parent Re-submitted for Review
                          </p>
                          <p className="text-xs text-violet-600/80 dark:text-violet-300/80 mt-1 leading-relaxed">
                            This parent was previously disapproved and has updated their profile information. Please review the updated details below and make a new approval decision.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-slate-50 dark:bg-[#060d14] rounded-xl p-5 border border-slate-100 dark:border-slate-800">
                      <Field label={t('fullName', 'Full Name')}      value={selected.fullName} />
                      <Field label={t('emailLabel', 'Email Address')} value={selected.email} />
                      <Field label={t('phoneNumber', 'Phone Number')} value={selected.phone || null} />
                      <Field label={t('organization', 'Organization')} value={selected.organization || null} />
                      <Field
                        label={t('emergencyContact', 'Emergency Contact')}
                        value={
                          selected.emergencyContact?.name || selected.emergencyContact?.phone
                            ? [
                                selected.emergencyContact.name,
                                selected.emergencyContact.relationship,
                                selected.emergencyContact.phone,
                              ].filter(Boolean).join(' · ')
                            : null
                        }
                      />
                      <Field
                        label={t('registeredChildren', 'Registered Children')}
                        value={`${selected.children?.length || 0} ${t('children', 'children')} linked`}
                      />
                    </div>

                    {/* ── ID Card Images ──────────────────────── */}
                    {(selected.idFrontUrl || selected.idBackUrl) ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060d14] overflow-hidden">
                        {/* Section header */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1929]">
                          <i className="bx bx-id-card text-[#00ADB5] text-lg" />
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {t('idCardDocuments', 'ID Card Documents')}
                          </p>
                          {selected.isIdVerified && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <i className="bx bx-check-shield text-xs" />
                              {t('idVerified', 'ID Verified')}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 p-4">
                          {/* Front side */}
                          <IdCardImage
                            url={selected.idFrontUrl}
                            label={t('idFront', 'Front Side')}
                            icon="bx-credit-card-front"
                            t={t}
                          />
                          {/* Back side */}
                          <IdCardImage
                            url={selected.idBackUrl}
                            label={t('idBack', 'Back Side')}
                            icon="bx-credit-card"
                            t={t}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#060d14] px-4 py-4">
                        <i className="bx bx-id-card text-2xl text-slate-300 dark:text-slate-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {t('noIdUploaded', 'No ID documents uploaded')}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {t('noIdUploadedDesc', 'Parent has not submitted ID verification documents yet.')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Children preview */}
                    {selected.children?.length > 0 && (
                      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0d1929] divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
                        {selected.children.map(c => (
                          <div key={c._id} className="flex items-center justify-between px-4 py-3 gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#00ADB5]/10 flex items-center justify-center text-[#00ADB5] text-xs font-bold flex-shrink-0">
                                {initials(`${c.firstName || ''} ${c.lastName || ''}`)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {c.firstName || 'Unknown'} {c.lastName || ''}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {c.classroom?.name || 'Unassigned'}
                                </p>
                              </div>
                            </div>
                            <StatusPill status={c.status} />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                        {t('parentDecision')}
                      </p>
                      <DecisionPanel
                        status={selected.approvalStatus || 'pending'}
                        note={selected.approvalNote}
                        onApprove={note => handleParentDecision('approve', note)}
                        onDisapprove={note => handleParentDecision('disapprove', note)}
                        loading={actionLoading}
                        type="parent"
                        t={t}
                      />
                    </div>

                    {selected.approvalStatus === 'approved' && (
                      <button
                        onClick={() => setStep(2)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#00ADB5]/40 hover:border-[#00ADB5] py-3 text-sm font-semibold text-[#00ADB5] hover:bg-[#00ADB5]/5 transition-all"
                      >
                        {t('continueToChildVerification', 'Continue to Child Verification')}
                        <i className="bx bx-right-arrow-alt text-lg" />
                      </button>
                    )}
                  </div>
                )}

                {/* ── STEP 2: Child details ──────────────── */}
                {step === 2 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
                    <button
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00ADB5] hover:underline"
                    >
                      <i className="bx bx-left-arrow-alt text-sm" /> {t('backToParent')}
                    </button>

                    {/* Parent status reminder */}
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2.5">
                      <i className="bx bx-check-circle text-emerald-500 text-base" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {t('parentVerifiedText', '{name} is verified').replace('{name}', selected.fullName)}
                      </p>
                    </div>

                    {selected.children?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060d14] text-slate-400">
                        <i className="bx bx-child text-4xl opacity-30" />
                        <p className="text-sm">{t('noChildrenLinked')}</p>
                      </div>
                    ) : selected.children.map((child, idx) => (
                      <div key={child._id} className={`rounded-2xl border p-5 space-y-4 ${
                        child.status === 'approved' || child.status === 'active'
                          ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/5 dark:border-emerald-500/20'
                          : child.status === 'disapproved'
                          ? 'border-amber-200 bg-amber-50 dark:bg-amber-500/5 dark:border-amber-500/20'
                          : 'border-slate-200 bg-white dark:bg-[#0d1929] dark:border-slate-800'
                      }`}>
                        {/* Child header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                              child.status === 'approved' || child.status === 'active' ? 'bg-emerald-400' :
                              child.status === 'disapproved' ? 'bg-amber-400' : 'bg-[#00ADB5]'
                            }`}>
                              {initials(`${child.firstName || ''} ${child.lastName || ''}`)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">
                                {child.firstName || 'Unknown'} {child.lastName || ''}
                              </p>
                              <p className="text-xs text-slate-400">{t('thChild')} {idx + 1}</p>
                            </div>
                          </div>
                          <StatusPill status={t(child.status, child.status)} />
                        </div>

                        {/* Child fields */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-white/60 dark:bg-slate-900/40 rounded-xl p-4 border border-current/10">
                          <Field label={t('gender', 'Gender')}       value={t(child.gender?.toLowerCase() || 'other', child.gender || 'Other')} />
                          <Field label={t('thAge')}          value={child.age != null ? `${child.age} ${t('yrs')}` : null} />
                          <Field label={t('thClassroom')}    value={child.classroom?.name || null} />
                          <Field label={t('thVaccination')}  value={t(child.vaccinationStatus === 'up-to-date' ? 'upToDate' : (child.vaccinationStatus || 'unknown'), child.vaccinationStatus || 'Unknown')} />
                          <Field label={t('thAllergies')}    value={child.allergies || null} />
                          <Field label={t('medicalNotes', 'Medical Notes')} value={child.medicalNotes || null} />
                        </div>

                        {/* Child decision */}
                        <div className="border-t border-current/10 pt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                            {t('childDecision')}
                          </p>
                          <DecisionPanel
                            status={child.status}
                            note={child.approvalNote}
                            onApprove={note => handleChildDecision(child._id, 'approve', note)}
                            onDisapprove={note => handleChildDecision(child._id, 'disapprove', note)}
                            loading={actionLoading}
                            type="child"
                            t={t}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>{/* /px-6 body */}
            </div>
          )}
        </div>{/* /right panel */}
      </div>{/* /grid */}
    </div>
  );
};

export default AdminApprovalWizard;
