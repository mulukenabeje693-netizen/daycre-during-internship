import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';

const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const ParentHistory = () => {
  const [parents, setParents]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  /* ── edit modal state ─── */
  const [editModal, setEditModal]   = useState(null);
  const [form, setForm]             = useState({});
  const [saving, setSaving]         = useState(false);
  const [editError, setEditError]   = useState('');

  /* ── delete modal state ─ */
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting]       = useState(false);

  const flash = (setter, msg) => { setter(msg); setTimeout(() => setter(''), 3500); };

  /* ── fetch ────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/staff/parents');
        setParents(res.data.data || []);
      } catch {
        setError('Failed to load parents.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── filter ──────────── */
  const filtered = parents.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.fullName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    );
  });

  /* ── edit ────────────── */
  const openEdit = (p) => {
    setForm({
      fullName:     p.fullName     || '',
      email:        p.email        || '',
      phone:        p.phone        || '',
      organization: p.organization || '',
      emergencyContactName:         p.emergencyContact?.name         || '',
      emergencyContactPhone:        p.emergencyContact?.phone        || '',
      emergencyContactRelationship: p.emergencyContact?.relationship || '',
    });
    setEditError('');
    setEditModal(p);
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      setEditError('Full name and email are required.'); return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/staff/${editModal._id}`, {
        fullName:     form.fullName.trim(),
        email:        form.email.trim().toLowerCase(),
        phone:        form.phone.trim(),
        organization: form.organization.trim(),
        emergencyContact: {
          name:         form.emergencyContactName.trim(),
          phone:        form.emergencyContactPhone.trim(),
          relationship: form.emergencyContactRelationship.trim(),
        },
      });
      setParents((prev) =>
        prev.map((p) => (p._id === editModal._id ? { ...p, ...res.data.data } : p))
      );
      setEditModal(null);
      flash(setSuccess, `${form.fullName}'s info updated.`);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  /* ── delete ──────────── */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/staff/${deleteModal._id}`);
      setParents((prev) => prev.filter((p) => p._id !== deleteModal._id));
      flash(setSuccess, `${deleteModal.fullName}'s record removed.`);
      setDeleteModal(null);
    } catch (err) {
      flash(setError, err.response?.data?.message || 'Delete failed.');
      setDeleteModal(null);
    } finally {
      setDeleting(false);
    }
  };

  /* ═══════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════ */
  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#060d14] py-2">

      {/* ── White card ─────────────────────────────── */}
      <div className="bg-white dark:bg-[#0d1929] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-8 pt-7 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Registered Parents
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {parents.length} parent{parents.length !== 1 ? 's' : ''} in the system
            </p>
          </div>
          <Link
            to="/dashboard/reception/new-child-registry"
            className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent px-4 py-2 text-sm font-semibold text-[#00ADB5] dark:text-[#00B4D8] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <i className="bx bx-user-plus text-base" />
            Register New Parent
          </Link>
        </div>

        {/* Alerts */}
        {(error || success) && (
          <div className="px-8 pt-4">
            {error   && <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400"><i className="bx bx-error-circle flex-shrink-0" />{error}</div>}
            {success && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"><i className="bx bx-check-circle flex-shrink-0" />{success}</div>}
          </div>
        )}

        {/* Search */}
        <div className="px-8 py-4">
          <div className="relative">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060d14] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 dark:focus:border-[#00B4D8] transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-[#00ADB5] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading parents…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <i className="bx bx-group text-5xl opacity-20" />
              <p className="text-sm">{search ? 'No parents match your search.' : 'No parents registered yet.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <div
                  key={p._id}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#060d14] p-5 hover:border-[#00ADB5]/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

                    {/* Avatar + info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#00ADB5]/10 flex items-center justify-center text-[#00ADB5] font-bold text-lg flex-shrink-0 border border-[#00ADB5]/20">
                        {initials(p.fullName)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{p.fullName}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {p.email && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <i className="bx bx-envelope text-sm" />{p.email}
                            </span>
                          )}
                          {p.phone && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <i className="bx bx-phone text-sm" />{p.phone}
                            </span>
                          )}
                          {p.organization && (
                            <span className="text-xs text-[#00ADB5] flex items-center gap-1">
                              <i className="bx bx-buildings text-sm" />{p.organization}
                            </span>
                          )}
                        </div>

                        {/* Status badge */}
                        <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
                          p.approvalStatus === 'approved'    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                          p.approvalStatus === 'disapproved' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        }`}>
                          {p.approvalStatus || 'pending'}
                        </span>

                        {/* Emergency contact */}
                        {p.emergencyContact?.name && (
                          <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                            <i className="bx bx-phone-call text-sm" />
                            Emergency: {p.emergencyContact.name}
                            {p.emergencyContact.phone && ` · ${p.emergencyContact.phone}`}
                            {p.emergencyContact.relationship && ` (${p.emergencyContact.relationship})`}
                          </p>
                        )}

                        {/* Children */}
                        {p.children?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.children.map((c) => (
                              <span
                                key={c._id}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#00ADB5]/8 border border-[#00ADB5]/20 text-[#00ADB5] dark:bg-[#00ADB5]/10"
                              >
                                <i className="bx bx-child text-sm" />
                                {c.firstName} {c.lastName}
                                {c.classroom?.name && (
                                  <span className="opacity-60">· {c.classroom.name}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1929] hover:border-[#00ADB5]/50 hover:text-[#00ADB5] text-slate-600 dark:text-slate-300 transition-all"
                      >
                        <i className="bx bx-edit-alt text-sm" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteModal(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all"
                      >
                        <i className="bx bx-trash text-sm" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ EDIT MODAL ════════════════════════════════════════ */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0d1929] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00ADB5]/10 flex items-center justify-center">
                  <i className="bx bx-edit-alt text-[#00ADB5] text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Edit Parent</h3>
                  <p className="text-xs text-slate-400">{editModal.fullName}</p>
                </div>
              </div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <i className="bx bx-x text-xl" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {[
                { label: 'Full Name *',   name: 'fullName',     type: 'text'  },
                { label: 'Email *',       name: 'email',        type: 'email' },
                { label: 'Phone',         name: 'phone',        type: 'tel'   },
                { label: 'Organization',  name: 'organization', type: 'text'  },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{f.label}</label>
                  <input
                    name={f.name} type={f.type} value={form[f.name]}
                    onChange={(e) => { setForm((p) => ({ ...p, [f.name]: e.target.value })); setEditError(''); }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060d14] px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 transition-all"
                  />
                </div>
              ))}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Emergency Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Contact Name',  name: 'emergencyContactName'  },
                    { label: 'Contact Phone', name: 'emergencyContactPhone' },
                  ].map((f) => (
                    <div key={f.name}>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{f.label}</label>
                      <input
                        name={f.name} value={form[f.name]}
                        onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060d14] px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 transition-all"
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Relationship</label>
                    <input
                      name="emergencyContactRelationship" value={form.emergencyContactRelationship}
                      onChange={(e) => setForm((p) => ({ ...p, emergencyContactRelationship: e.target.value }))}
                      placeholder="e.g. Spouse, Sibling"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060d14] px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#00ADB5] focus:ring-2 focus:ring-[#00ADB5]/15 transition-all"
                    />
                  </div>
                </div>
              </div>

              {editError && <p className="text-rose-500 text-xs mt-1">{editError}</p>}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button onClick={() => setEditModal(null)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#00ADB5] hover:bg-[#009aa1] rounded-xl transition-all shadow-sm disabled:opacity-60">
                {saving ? <><i className="bx bx-loader-alt animate-spin" /> Saving…</> : <><i className="bx bx-check" /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE MODAL ══════════════════════════════════════ */}
      <DeleteConfirmModal
        isOpen={!!deleteModal}
        title="Delete Parent Record"
        description={deleteModal ? `Remove ${deleteModal.fullName}'s record from the system?` : ''}
        warning="This action cannot be undone."
        onCancel={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
      />

    </div>
  );
};

export default ParentHistory;
