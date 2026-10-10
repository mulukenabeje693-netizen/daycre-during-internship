import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB' }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const STATUS_BADGE = {
  paid:      'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-600',
  overdue:   'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

const AdminPaymentHistory = () => {
  const { isFreeMode, togglePaymentMode } = useSettings();
  const [payments,   setPayments]   = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('all');
  const [method,     setMethod]     = useState('all');
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [togglingMode, setTogglingMode] = useState(false);
  const LIMIT = 20;

  const handleToggleFreeMode = async () => {
    setTogglingMode(true);
    try { await togglePaymentMode(); }
    catch (e) { console.error(e); }
    finally { setTogglingMode(false); }
  };

  const fetchHistory = useCallback(async (p = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (status !== 'all')  params.append('status',    status);
      if (method !== 'all')  params.append('method',    method);
      if (startDate)         params.append('startDate', startDate);
      if (endDate)           params.append('endDate',   endDate);
      if (search.trim())     params.append('search',    search.trim());

      const res = await api.get(`/payments/history?${params}`);
      setPayments(res.data.data   || []);
      setStats(res.data.stats     || {});
      setTotal(res.data.total     || 0);
      setTotalPages(res.data.pages || 1);
      setPage(p);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payment history.');
    } finally {
      setLoading(false);
    }
  }, [search, status, method, startDate, endDate]);

  useEffect(() => { fetchHistory(1); }, [fetchHistory]);

  const handleExportCSV = () => {
    const rows = [
      ['Receipt #','Transaction ID','Parent','Child','Type','Amount','Status','Method','Date'],
      ...payments.map(p => [
        p.invoiceNumber || '—',
        p.chapaTxRef    || '—',
        p.parent?.fullName || '—',
        `${p.child?.firstName || ''} ${p.child?.lastName || ''}`.trim() || '—',
        p.type?.replace(/-/g,' ') || '—',
        p.amount || 0,
        p.status || '—',
        p.method || '—',
        fmtDate(p.paidDate || p.createdAt),
      ])
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const link = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `payment-history-${new Date().toISOString().split('T')[0]}.csv`,
    });
    link.click();
  };

  return (
    <div className="space-y-5">

      {/* Payment Mode Toggle */}
      <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border ${
        isFreeMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i className={`bx ${isFreeMode ? 'bx-gift text-emerald-500' : 'bx-credit-card text-amber-500'} text-lg`} />
            {isFreeMode ? 'Free Mode Active' : 'Payment Mode Active'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isFreeMode
              ? 'Parents have free access — no payments required'
              : 'Chapa payments are required from parents'}
          </p>
        </div>
        <button
          onClick={handleToggleFreeMode}
          disabled={togglingMode}
          title="Toggle Free / Payment Mode"
          className={`relative inline-flex h-7 min-w-[3.25rem] items-center rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-60 ${
            isFreeMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${
            isFreeMode ? 'translate-x-7' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: 'bx-money',       label: 'Total Collected', value: fmtCurrency(stats.totalPaid), cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { icon: 'bx-receipt',     label: 'Total Invoices',  value: stats.totalCount || 0,         cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
          { icon: 'bx-check-circle',label: 'Paid',            value: stats.paidCount  || 0,         cls: 'bg-teal-50 border-teal-200 text-teal-700' },
          { icon: 'bx-time-five',   label: 'This Page',       value: payments.length,               cls: 'bg-slate-50 border-slate-200 text-slate-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-5 border ${s.cls}`}>
            <i className={`bx ${s.icon} text-2xl mb-2 block`} />
            <p className="text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs mt-1 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl px-5 py-4 text-sm font-medium">
          <i className="bx bx-error-circle mr-2" />{error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search by parent, child, invoice #..."
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchHistory(1)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-teal-900/40 bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white text-sm focus:outline-none focus:border-[#00A884]" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-teal-900/40 px-4 py-2.5 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none">
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-teal-900/40 px-4 py-2.5 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none">
            <option value="all">All Methods</option>
            <option value="chapa">Chapa</option>
            <option value="card">Card</option>
            <option value="bank-transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-teal-900/40 px-3 py-2 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">To Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-teal-900/40 px-3 py-2 text-sm bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none" />
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <button onClick={() => fetchHistory(1)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A884] hover:bg-[#009070] text-white font-semibold text-sm transition">
              <i className="bx bx-filter-alt" /> Apply Filters
            </button>
            <button onClick={() => { setSearch(''); setStatus('all'); setMethod('all'); setStartDate(''); setEndDate(''); }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-teal-900/30 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-[#0d1520] transition">
              Reset
            </button>
          </div>
          <div className="flex justify-start sm:justify-end">
            <button onClick={handleExportCSV} disabled={payments.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition disabled:opacity-40">
              <i className="bx bx-download" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <i className="bx bx-receipt text-5xl block mb-3 opacity-30" />
            <p className="font-medium">No payment records found</p>
            <p className="text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-teal-900/30 bg-slate-50 dark:bg-[#0d1520]">
                  {['Receipt #','Transaction ID','Parent','Child','Type','Amount','Status','Method','Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p._id} className="border-b border-slate-100 dark:border-teal-900/30 last:border-0 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{p.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-400 max-w-[110px] truncate" title={p.chapaTxRef}>{p.chapaTxRef ? p.chapaTxRef.slice(0, 14) + '…' : '—'}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800 dark:text-white whitespace-nowrap">{p.parent?.fullName || '—'}</p>
                      <p className="text-xs text-slate-400">{p.parent?.email}</p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {p.child ? `${p.child.firstName} ${p.child.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-slate-100 dark:bg-[#0d1520] text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg capitalize">
                        {p.type?.replace(/-/g,' ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-white">{fmtCurrency(p.amount)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_BADGE[p.status] || STATUS_BADGE.cancelled}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 capitalize">{p.method || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(p.paidDate || p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-teal-900/20">
            <span className="text-xs text-slate-500">Page {page} of {totalPages} · {total} total records</span>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchHistory(page - 1)} disabled={page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d1520] disabled:opacity-40 transition">
                <i className="bx bx-chevron-left" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={pg} onClick={() => fetchHistory(pg)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition ${
                      pg === page ? 'bg-[#00A884] text-white' : 'border border-slate-200 dark:border-teal-900/30 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d1520]'
                    }`}>{pg}
                  </button>
                );
              })}
              <button onClick={() => fetchHistory(page + 1)} disabled={page >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-teal-900/30 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#0d1520] disabled:opacity-40 transition">
                <i className="bx bx-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentHistory;
