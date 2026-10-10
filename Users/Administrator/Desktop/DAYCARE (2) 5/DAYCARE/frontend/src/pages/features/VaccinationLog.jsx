import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import ChildSelectDropdown from '../../components/ChildSelectDropdown';

const VACCINES = [
  'Hepatitis B',
  'DTaP (Diphtheria, Tetanus, Pertussis)',
  'Hib (Haemophilus influenzae)',
  'PCV15 / PCV20 (Pneumococcal)',
  'IPV (Polio)',
  'Influenza (Flu)',
  'MMR (Measles, Mumps, Rubella)',
  'Varicella (Chickenpox)',
  'Hepatitis A',
  'COVID-19'
];

const VaccinationLog = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = { childIds: [], name: '', customName: '', dateGiven: '', status: 'Up to Date', givenBy: user?.fullName || 'Sarah Johnson', notes: '' };
  const [vaxForm, setVaxForm] = useState(emptyForm);

  const canEdit = ['admin', 'reception', 'teacher'].includes(user?.role);

  const loadData = async () => {
    try {
      const res = await api.get('/children');
      setChildren(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddVax = async (e) => {
    e.preventDefault();
    if (!vaxForm.childIds || vaxForm.childIds.length === 0) return alert('Please select at least one child');
    setSaving(true);
    try {
      const finalName = vaxForm.name === 'Other' ? vaxForm.customName : vaxForm.name;
      
      await Promise.all(vaxForm.childIds.map(async (childId) => {
        const child = children.find(c => c._id === childId);
        if (!child) return;
        const existingLog = child.vaccinationLog || [];
        const updated = [...existingLog, { 
          name: finalName, 
          dateGiven: vaxForm.dateGiven, 
          status: vaxForm.status,
          givenBy: vaxForm.givenBy,
          notes: vaxForm.notes,
          addedAt: new Date().toISOString() 
        }];
        await api.put(`/children/${child._id}`, { vaccinationLog: updated });
        
        // Notify parents
        if (child.parents && child.parents.length > 0) {
          for (const parent of child.parents) {
            const parentId = parent._id || parent;
            await api.post('/messages', {
              recipientId: parentId,
              subject: `New Vaccination Record: ${finalName}`,
              body: `A new vaccination record (${finalName}) has been added for ${child.firstName}. Date Given: ${vaxForm.dateGiven}, Status: ${vaxForm.status}.`,
              priority: 'normal',
              relatedChild: child._id
            }).catch(err => console.error('Failed to notify parent', err));
          }
        }
      }));

      await loadData();
      setShowAddModal(false);
      setVaxForm(emptyForm);
    } catch (err) {
      console.error(err);
      alert('Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  // Compute flattened logs
  let flattenedLogs = [];
  children.forEach(child => {
    if (child.vaccinationLog) {
      child.vaccinationLog.forEach(log => {
        flattenedLogs.push({
          child,
          log
        });
      });
    }
  });

  // Filter logs based on search
  flattenedLogs = flattenedLogs.filter(item => {
    const childName = `${item.child.firstName} ${item.child.lastName}`.toLowerCase();
    const vaxName = (item.log.name || '').toLowerCase();
    const q = search.toLowerCase();
    return childName.includes(q) || vaxName.includes(q);
  });

  // Sort by date given (newest first)
  flattenedLogs.sort((a, b) => new Date(b.log.dateGiven) - new Date(a.log.dateGiven));

  // Compute stats
  const totalChildren = children.length;
  const upToDateCount = flattenedLogs.filter(l => l.log.status === 'Up to Date').length;
  const upcomingCount = flattenedLogs.filter(l => l.log.status === 'Upcoming').length;
  const overdueCount = flattenedLogs.filter(l => l.log.status === 'Overdue').length;

  // Render status badge
  const renderStatus = (status) => {
    if (status === 'Up to Date') {
      return <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide">{t('upToDate')}</span>;
    }
    if (status === 'Upcoming') {
      return <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide">{t('upcoming')}</span>;
    }
    if (status === 'Overdue') {
      return <span className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide">{t('overdue')}</span>;
    }
    return <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide">{status || 'Unknown'}</span>;
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('vaccinationLogTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('vaccinationLogSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('searchChildPlaceholder')} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-teal-900/30 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white w-64"
            />
          </div>
          <button className="flex items-center gap-2 border border-slate-200 dark:border-teal-900/30 px-4 py-2 rounded-full text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#111c2d] transition-colors">
            <i className="bx bx-filter" /> {t('filterBtn')}
          </button>
          {canEdit && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-full font-semibold transition-colors text-sm shadow-sm"
            >
              {t('addRecord')}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white dark:bg-[#111c2d] p-5 rounded-2xl border border-slate-200 dark:border-teal-900/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <i className="bx bx-group text-2xl text-blue-500" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('totalChildren')}</p>
            <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-1">{totalChildren}</h4>
            <p className="text-[11px] text-slate-400 mt-1">{t('registeredChildren')}</p>
          </div>
        </div>
        {/* Card 2 */}
        <div className="bg-white dark:bg-[#111c2d] p-5 rounded-2xl border border-slate-200 dark:border-teal-900/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
            <i className="bx bx-check-shield text-2xl text-emerald-500" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('upToDate')}</p>
            <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-1">{upToDateCount}</h4>
            <p className="text-[11px] text-slate-400 mt-1">{t('recordsUpToDate')}</p>
          </div>
        </div>
        {/* Card 3 */}
        <div className="bg-white dark:bg-[#111c2d] p-5 rounded-2xl border border-slate-200 dark:border-teal-900/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
            <i className="bx bx-time text-2xl text-amber-500" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('upcoming')}</p>
            <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-1">{upcomingCount}</h4>
            <p className="text-[11px] text-slate-400 mt-1">{t('requiresAttentionSoon')}</p>
          </div>
        </div>
        {/* Card 4 */}
        <div className="bg-white dark:bg-[#111c2d] p-5 rounded-2xl border border-slate-200 dark:border-teal-900/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
            <i className="bx bx-shield-x text-2xl text-rose-500" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('overdue')}</p>
            <h4 className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-1">{overdueCount}</h4>
            <p className="text-[11px] text-slate-400 mt-1">{t('requiresImmediateAttention')}</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-teal-900/30">
          <h3 className="font-bold text-slate-800 dark:text-white">{t('vaccinationRecords')}</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-teal-900/20">
            <thead className="bg-slate-50/80 dark:bg-[#0d1520]/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('childNameCol')} <i className="bx bx-sort-alt-2 opacity-50 ml-1 text-[10px]" />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('ageCol')} <i className="bx bx-sort-alt-2 opacity-50 ml-1 text-[10px]" />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('vaccineCol')} <i className="bx bx-sort-alt-2 opacity-50 ml-1 text-[10px]" />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('dateGivenCol')} <i className="bx bx-sort-alt-2 opacity-50 ml-1 text-[10px]" />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('statusTh')} <i className="bx bx-sort-alt-2 opacity-50 ml-1 text-[10px]" />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('givenByCol')} <i className="bx bx-sort-alt-2 opacity-50 ml-1 text-[10px]" />
                </th>
                {canEdit && (
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400">
                    {t('actionsCol')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-teal-900/20">
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="text-center py-10">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : flattenedLogs.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="text-center py-20 text-slate-400">
                    <i className="bx bx-injection text-5xl opacity-30" />
                    <p className="mt-3">{t('noVaccinationRecords')}</p>
                  </td>
                </tr>
              ) : (
                flattenedLogs.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-[#162030]/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-[#0d1520] overflow-hidden flex items-center justify-center flex-shrink-0">
                          {item.child.photoUrl ? (
                            <img src={item.child.photoUrl} alt="child" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
                              {item.child?.firstName?.[0] || '?'}{item.child?.lastName?.[0] || ''}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          {item.child?.firstName || ''} {item.child?.lastName || ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                      {item.child.age !== null ? `${item.child.age}y` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                      {item.log.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                      {formatDate(item.log.dateGiven)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStatus(item.log.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                      {item.log.givenBy || '—'}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 text-slate-400 hover:text-teal-600 hover:border-teal-500 transition-colors bg-white dark:bg-transparent shadow-sm">
                            <i className="bx bx-show text-[15px]" />
                          </button>
                          <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-white dark:bg-transparent shadow-sm">
                            <i className="bx bx-dots-vertical-rounded text-[15px]" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111c2d] w-full max-w-lg rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-teal-900/30">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-teal-900/30 flex items-center justify-between bg-slate-50/50 dark:bg-[#0d1520]/50">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <i className="bx bx-injection text-teal-500 text-xl" />
                {t('addVaccinationRecord')}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <i className="bx bx-x text-xl" />
              </button>
            </div>
            
            <form onSubmit={handleAddVax} className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{t('selectChildLabel')}</label>
                <ChildSelectDropdown 
                  childrenList={children}
                  selectedIds={vaxForm.childIds}
                  onChange={ids => setVaxForm({ ...vaxForm, childIds: ids })}
                  label={t('chooseChildDots')}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{t('vaccineNameLabel')}</label>
                <select 
                  required 
                  value={vaxForm.name} 
                  onChange={e => setVaxForm({ ...vaxForm, name: e.target.value })}
                  className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-[13px] font-semibold bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em', paddingRight: '2.5rem' }}
                >
                  <option className="bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white" value="">{t('selectVaccineDots')}</option>
                  {VACCINES.map(v => <option className="bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white" key={v} value={v}>{v}</option>)}
                  <option className="bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white" value="Other">Other</option>
                </select>
              </div>

              {vaxForm.name === 'Other' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{t('specifyVaccineName')}</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={t('customVaccinePlaceholder')} 
                    value={vaxForm.customName} 
                    onChange={e => setVaxForm({ ...vaxForm, customName: e.target.value })}
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-[13px] font-semibold bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow placeholder-slate-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{t('dateGivenLabel')}</label>
                  <input 
                    type="date" 
                    required 
                    value={vaxForm.dateGiven} 
                    onChange={e => setVaxForm({ ...vaxForm, dateGiven: e.target.value })}
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-[13px] font-semibold bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{t('statusLabel')}</label>
                  <select 
                    required 
                    value={vaxForm.status} 
                    onChange={e => setVaxForm({ ...vaxForm, status: e.target.value })}
                    className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-[13px] font-semibold bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow appearance-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em', paddingRight: '2.5rem' }}
                  >
                    <option className="bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white" value="Up to Date">{t('upToDate')}</option>
                    <option className="bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white" value="Upcoming">{t('upcoming')}</option>
                    <option className="bg-white dark:bg-[#0d1520] text-slate-800 dark:text-white" value="Overdue">{t('overdue')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">{t('givenByLabel')}</label>
                <input 
                  type="text" 
                  placeholder="e.g. Sarah Johnson" 
                  value={vaxForm.givenBy} 
                  onChange={e => setVaxForm({ ...vaxForm, givenBy: e.target.value })}
                  className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-[13px] font-semibold bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow placeholder-slate-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-50 shadow-md shadow-teal-500/20"
                >
                  {saving ? t('saving') : t('saveRecord')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default VaccinationLog;
