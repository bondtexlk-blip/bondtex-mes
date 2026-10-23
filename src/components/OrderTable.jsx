import React, { useState } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LineChart,
  Edit3,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Palette,
  Hash,
} from 'lucide-react';
import {
  formatNumber,
  formatCompactNumber,
  formatDate,
  getStatusBadgeClass,
  getCategoryColor,
} from '../utils/formatters';

export default function OrderTable({
  orders = [],
  loading = false,
  onViewDailyTracking,
  onLogProduction,
  onPrintBarcode,
  onExportCsv,
  sortBy,
  sortOrder,
  onSort,
}) {
  const [copiedPo, setCopiedPo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const handleCopyPo = (po) => {
    navigator.clipboard?.writeText(po);
    setCopiedPo(po);
    setTimeout(() => setCopiedPo(null), 1500);
  };

  const totalPages = Math.ceil(orders.length / pageSize) || 1;
  const paginatedOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderSortIcon = (column) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden space-y-0">
      {/* Table Header Bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>Production Orders Directory</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {orders.length} Records
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Real structured records showing PO #, RM Material, Colour, Size, and Daily Plan vs Actual Tracking
          </p>
        </div>

        <button
          onClick={onExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition self-start sm:self-auto hover:text-white"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export CSV / Excel</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold select-none">
              {/* 1. PO # */}
              <th
                onClick={() => onSort('poNumber')}
                className="py-3.5 px-3.5 cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>PO #</span>
                  {renderSortIcon('poNumber')}
                </div>
              </th>

              {/* 2. RM Material */}
              <th
                onClick={() => onSort('rmMaterial')}
                className="py-3.5 px-3.5 cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>RM Material</span>
                  {renderSortIcon('rmMaterial')}
                </div>
              </th>

              {/* 3. Colour */}
              <th
                onClick={() => onSort('colour')}
                className="py-3.5 px-3.5 cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Colour</span>
                  {renderSortIcon('colour')}
                </div>
              </th>

              {/* 4. Size */}
              <th
                onClick={() => onSort('size')}
                className="py-3.5 px-3 text-center cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Size</span>
                  {renderSortIcon('size')}
                </div>
              </th>

              {/* 5. Category */}
              <th className="py-3.5 px-3">
                <span>Category</span>
              </th>

              {/* 6. Style */}
              <th
                onClick={() => onSort('style')}
                className="py-3.5 px-3.5 cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Style</span>
                  {renderSortIcon('style')}
                </div>
              </th>

              {/* 7. Order Qty */}
              <th
                onClick={() => onSort('orderQty')}
                className="py-3.5 px-3.5 text-right cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Order Qty</span>
                  {renderSortIcon('orderQty')}
                </div>
              </th>

              {/* 8. Floor Production Qty (Loop Insert Output) */}
              <th
                onClick={() => onSort('floorProductionQty')}
                className="py-3.5 px-3.5 text-right cursor-pointer hover:text-slate-200 transition text-cyan-400"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Floor Qty</span>
                  {renderSortIcon('floorProductionQty')}
                </div>
              </th>

              {/* 9. Production Qty (Permanent Delivery) */}
              <th
                onClick={() => onSort('productionQty')}
                className="py-3.5 px-3.5 text-right cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Production Qty</span>
                  {renderSortIcon('productionQty')}
                </div>
              </th>

              {/* 9. Delivery Qty */}
              <th
                onClick={() => onSort('deliveryQty')}
                className="py-3.5 px-3.5 text-right cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Delivery Qty</span>
                  {renderSortIcon('deliveryQty')}
                </div>
              </th>

              {/* 10. Balance Qty */}
              <th
                onClick={() => onSort('balanceQty')}
                className="py-3.5 px-3.5 text-right cursor-pointer hover:text-slate-200 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Balance Qty</span>
                  {renderSortIcon('balanceQty')}
                </div>
              </th>

              {/* 11. Daily Plan vs Actual Tracking */}
              <th className="py-3.5 px-3.5 text-center">
                <span>Plan vs Actual Status</span>
              </th>

              {/* 12. Actions */}
              <th className="py-3.5 px-3 text-center">
                <span>Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-sans">
            {loading ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading production records...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <p className="font-semibold text-slate-300">No matching orders found</p>
                    <p className="text-xs text-slate-500">
                      Try resetting filters, clearing the PO search, or choosing "All" categories.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order) => {
                const catTheme = getCategoryColor(order.category);
                const completionRate = order.orderQty > 0
                  ? Math.round((order.productionQty / order.orderQty) * 100)
                  : 0;

                const latestLog = order.dailyLogs && order.dailyLogs.length > 0
                  ? order.dailyLogs[order.dailyLogs.length - 1]
                  : null;

                const dayDiff = latestLog ? latestLog.actualQty - latestLog.planQty : 0;

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    {/* 1. PO Number */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-extrabold text-white text-xs group-hover:text-blue-400 transition-colors">
                          {order.poNumber}
                        </span>
                        <button
                          onClick={() => handleCopyPo(order.poNumber)}
                          className="text-slate-500 hover:text-slate-300 p-0.5"
                          title="Copy PO Number"
                        >
                          {copiedPo === order.poNumber ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {order.barcode}
                      </div>
                    </td>

                    {/* 2. RM Material (exact column) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
                        {order.rmMaterial}
                      </span>
                    </td>

                    {/* 3. Colour (exact column directly before Size) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/70 text-xs font-semibold text-slate-200">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                          style={{
                            backgroundColor:
                              (order.colour || '').toLowerCase().includes('black')
                                ? '#18181b'
                                : (order.colour || '').toLowerCase().includes('marzipan')
                                ? '#d4a373'
                                : (order.colour || '').toLowerCase().includes('praline')
                                ? '#bc6c25'
                                : (order.colour || '').toLowerCase().includes('ganache')
                                ? '#4a2c1d'
                                : (order.colour || '').toLowerCase().includes('talc')
                                ? '#e7e5e4'
                                : '#38bdf8',
                          }}
                        ></span>
                        <span>{order.colour}</span>
                      </span>
                    </td>

                    {/* 4. Size (exact column, bold like reference image) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-white font-mono text-xs font-black border border-slate-700 shadow-xs">
                        {order.size}
                      </span>
                    </td>

                    {/* 5. Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${catTheme.bg} ${catTheme.text} ${catTheme.border}`}
                      >
                        {order.category}
                      </span>
                    </td>

                    {/* 6. Style */}
                    <td className="py-3 px-3.5">
                      <div className="max-w-[170px] truncate" title={order.style}>
                        <span className="font-semibold text-slate-300 text-xs">
                          {order.style}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {order.styleCode}
                        </div>
                      </div>
                    </td>

                    {/* 7. Order Qty */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-100 text-xs">
                        {formatNumber(order.orderQty)}
                      </span>
                    </td>

                    {/* 8. Floor Production Qty (Loop Insert Output) */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-cyan-300 text-xs">
                        {formatNumber(order.floorProductionQty !== undefined ? order.floorProductionQty : order.productionQty)}
                      </span>
                    </td>

                    {/* 9. Production Qty (Permanent Delivery) */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div>
                        <span className="font-mono font-bold text-emerald-400 text-xs">
                          {formatNumber(order.productionQty)}
                        </span>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <div className="w-14 bg-slate-800 rounded-full h-1.5 overflow-hidden inline-block">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, completionRate)}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {completionRate}%
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 9. Delivery Qty */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-cyan-400 text-xs">
                        {formatNumber(order.deliveryQty)}
                      </span>
                    </td>

                    {/* 10. Balance Qty */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <span
                        className={`font-mono font-bold text-xs ${
                          order.balanceQty < 0
                            ? 'text-rose-400 font-black'
                            : order.balanceQty === 0
                            ? 'text-emerald-400'
                            : order.balanceQty < order.orderQty * 0.2
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {formatNumber(
                          order.balanceQty !== undefined
                            ? order.balanceQty
                            : (Number(order.orderQty) || 0) - (Number(order.productionQty) || 0)
                        )}
                      </span>
                    </td>

                    {/* 11. Daily Plan vs Actual Tracking */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>

                        {latestLog && (
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <span>Today: {formatCompactNumber(latestLog.actualQty)} / {formatCompactNumber(latestLog.planQty)}</span>
                            <span
                              className={dayDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                            >
                              ({dayDiff >= 0 ? `+${dayDiff}` : dayDiff})
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 12. Actions */}
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewDailyTracking(order)}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 transition"
                          title="View Day-by-Day Tracking & Chart"
                        >
                          <LineChart className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onLogProduction(order)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition"
                          title="Log Daily Production"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onPrintBarcode(order)}
                          className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 transition border border-slate-700"
                          title="Print Barcode Label"
                        >
                          <Barcode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Showing page <span className="text-white font-bold">{currentPage}</span> of{' '}
          <span className="text-white font-bold">{totalPages}</span> (
          {orders.length} total orders)
        </div>

        <div className="flex items-center gap-2 self-center sm:self-auto">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                currentPage === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
