import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import Pagination from '../../components/shared/Pagination';

const ReceiptsHistory = () => {
  const [payments,  setPayments]  = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [printing,  setPrinting]  = useState(null); // receipt id being printed
  const printRef = useRef();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/payments?status=paid');
        setPayments(res.data.data || []);
      } catch {
        setError('Could not load receipts.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter whenever search / year changes
  useEffect(() => {
    let list = payments;
    if (yearFilter !== 'all') {
      list = list.filter(p => {
        const d = p.paidDate || p.createdAt;
        return d && new Date(d).getFullYear().toString() === yearFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.invoiceNumber?.toLowerCase().includes(q) ||
        p.child?.firstName?.toLowerCase().includes(q) ||
        p.child?.lastName?.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
    setCurrentPage(1);
  }, [payments, search, yearFilter]);

  const years = [...new Set(
    payments
      .map(p => p.paidDate || p.createdAt)
      .filter(Boolean)
      .map(d => new Date(d).getFullYear())
  )].sort((a, b) => b - a);

  const totalFiltered = filtered.reduce((s, p) => s + (p.amount || 0), 0);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginatedReceipts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePrint = (payment) => {
    setPrinting(payment._id);
    setTimeout(() => {
      window.print();
      setPrinting(null);
    }, 200);
  };

  const handleDownloadCSV = () => {
    const headers = ['Invoice #', 'Child', 'Type', 'Amount', 'Paid Date', 'Method'];
    const rows = filtered.map(p => [
      p.invoiceNumber || '—',
      `${p.child?.firstName || ''} ${p.child?.lastName || ''}`.trim(),
      p.type?.replace(/-/g, ' ') || '—',
      `ETB ${p.amount}`,
      p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '—',
      p.method || 'cash'
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `receipts-${yearFilter === 'all' ? 'all-years' : yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl p-6 text-center">
      <i className="bx bx-error text-3xl" /><p className="mt-2">{error}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Receipts History</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {payments.length} paid invoice{payments.length !== 1 ? 's' : ''} · ${payments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()} total paid
          </p>
        </div>
        <button
          onClick={handleDownloadCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors text-sm disabled:opacity-40"
        >
          <i className="bx bx-download" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice #, child name, or type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Years</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>

      {/* Totals strip */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-5 py-3">
          <span className="text-sm text-slate-500">{filtered.length} receipt{filtered.length !== 1 ? 's' : ''} shown</span>
          <span className="font-bold text-emerald-400 text-lg">ETB {totalFiltered.toLocaleString()}</span>
        </div>
      )}

      {/* Receipt list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30">
          <i className="bx bx-receipt text-5xl opacity-30" />
          <p className="mt-3 font-semibold">No receipts found</p>
          <p className="text-xs mt-1 opacity-60">
            {payments.length === 0 ? 'No payments have been recorded yet.' : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-4 px-5 py-3.5 bg-slate-50 dark:bg-[#0d1520]/50 border-b border-slate-100 dark:border-teal-900/30">
            {['Invoice #', 'Child', 'Type', 'Amount', 'Paid Date', ''].map(h => (
              <span key={h} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-teal-900/30">
            {paginatedReceipts.map(p => (
              <div
                key={p._id}
                className={`flex flex-col md:grid md:grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 md:gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-[#162030]/30 transition-colors items-start md:items-center ${
                  printing === p._id ? 'print-target' : ''
                }`}
              >
                {/* Invoice # */}
                <div>
                  <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-[#0d1520] px-2 py-1 rounded-lg">
                    {p.invoiceNumber || '—'}
                  </span>
                </div>

                {/* Child */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {p.child?.firstName?.charAt(0) || '?'}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {p.child?.firstName} {p.child?.lastName}
                  </span>
                </div>

                {/* Type */}
                <span className="text-xs text-slate-500 bg-slate-100 dark:bg-[#0d1520] px-2 py-1 rounded-lg capitalize w-fit">
                  {p.type?.replace(/-/g, ' ') || '—'}
                </span>

                {/* Amount */}
                <span className="font-bold text-emerald-400 text-base">ETB {p.amount?.toLocaleString()}</span>

                {/* Paid date + method */}
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {p.paidDate
                      ? new Date(p.paidDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                  {p.method && (
                    <span className="text-[10px] text-slate-400 capitalize">{p.method}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePrint(p)}
                    title="Print receipt"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                  >
                    <i className="bx bx-printer text-lg" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-teal-900/30 bg-white dark:bg-[#111c2d]">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
                itemLabel="receipts"
              />
            </div>
          )}

          {/* Footer total */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-[#0d1520]/50 border-t border-slate-100 dark:border-teal-900/30 flex justify-between items-center">
            <span className="text-sm text-slate-500 font-semibold">Total ({filtered.length} receipts)</span>
            <span className="text-xl font-bold text-emerald-400">ETB {totalFiltered.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptsHistory;

