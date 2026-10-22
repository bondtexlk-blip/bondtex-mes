import React from 'react';
import {
  X,
  Calendar,
  LineChart,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Barcode,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  formatNumber,
  formatCompactNumber,
  formatDate,
  formatShortDate,
  getStatusBadgeClass,
  getCategoryColor,
} from '../utils/formatters';

export default function DailyBreakdownModal({ order, onClose, onLogOutput }) {
  if (!order) return null;

  const logs = order.dailyLogs || [];
  const catTheme = getCategoryColor(order.category);

  // Compute total planned and actual in this order's logs
  const totalPlannedInLogs = logs.reduce((sum, l) => sum + (Number(l.planQty) || 0), 0);
  const totalActualInLogs = logs.reduce((sum, l) => sum + (Number(l.actualQty) || 0), 0);
  const totalDeliveredInLogs = logs.reduce((sum, l) => sum + (Number(l.deliveryQty) || 0), 0);
  const netVariance = totalActualInLogs - totalPlannedInLogs;
  const logEfficiency = totalPlannedInLogs > 0 ? Math.round((totalActualInLogs / totalPlannedInLogs) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-6 bg-slate-950/80 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${catTheme.bg} ${catTheme.text} ${catTheme.border}`}
              >
                {order.category}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(
                  order.status
                )}`}
              >
                {order.status}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>PO #{order.poNumber}</span>
              <span className="text-xs font-mono text-cyan-300 font-semibold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                RM: {order.rmMaterial}
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
              <span className="text-slate-200 font-medium">{order.style}</span>
              <span>•</span>
              <span className="text-slate-400">Colour:</span>
              <span className="text-white font-semibold">{order.colour}</span>
              <span>•</span>
              <span className="text-slate-400">Size:</span>
              <span className="text-white font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded">{order.size}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-8rem)] overflow-y-auto">
          {/* Order Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 text-[11px] block">Order Target</span>
              <span className="text-base font-extrabold text-white font-mono">
                {formatNumber(order.orderQty)} pcs
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Total Produced</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {formatNumber(order.productionQty)} pcs
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Total Delivered</span>
              <span className="text-base font-extrabold text-cyan-400 font-mono">
                {formatNumber(order.deliveryQty)} pcs
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Remaining Balance</span>
              <span className="text-base font-extrabold text-amber-400 font-mono">
                {formatNumber(order.balanceQty)} pcs
              </span>
            </div>
          </div>

          {/* Day-by-Day Chart */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Daily Plan vs Actual Progression
                </h4>
                <p className="text-xs text-slate-400">
                  Daily output logs comparing manufacturing target vs actual completed pieces
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Adherence:</span>
                <span
                  className={`font-bold ${
                    logEfficiency >= 100
                      ? 'text-emerald-400'
                      : logEfficiency >= 85
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {logEfficiency}%
                </span>
              </div>
            </div>

            <div className="h-56 w-full">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No daily tracking logs recorded for this order yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={logs} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      stroke="#64748b"
                      fontSize={11}
                    />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const p = payload.find((i) => i.dataKey === 'planQty')?.value || 0;
                          const a = payload.find((i) => i.dataKey === 'actualQty')?.value || 0;
                          const d = payload.find((i) => i.dataKey === 'deliveryQty')?.value || 0;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                              <div className="font-bold text-white border-b border-slate-800 pb-1">
                                {label}
                              </div>
                              <div className="text-slate-300">Plan: <span className="font-mono text-white">{formatNumber(p)}</span></div>
                              <div className="text-blue-400 font-semibold">Actual: <span className="font-mono">{formatNumber(a)}</span></div>
                              <div className="text-emerald-400">Delivered: <span className="font-mono">{formatNumber(d)}</span></div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="planQty" name="Daily Plan Target" fill="#475569" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actualQty" name="Actual Produced" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="deliveryQty" name="Delivered" stroke="#10b981" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Day-by-Day Comprehensive Logs Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white tracking-tight">
                Daily Manufacturing Log Entries
              </h4>
              <button
                onClick={() => onLogOutput && onLogOutput(order)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-600/30"
              >
                + Log Today's Output
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Plan Target</th>
                    <th className="py-2.5 px-3 text-right">Actual Output</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                    <th className="py-2.5 px-3 text-right">Delivered</th>
                    <th className="py-2.5 px-3 text-center">Achievement</th>
                    <th className="py-2.5 px-3">Shift Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {logs.map((log, index) => {
                    const diff = log.actualQty - log.planQty;
                    const eff = log.planQty > 0 ? Math.round((log.actualQty / log.planQty) * 100) : 100;
                    return (
                      <tr key={index} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-200">
                          {log.date}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          {formatNumber(log.planQty)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                          {formatNumber(log.actualQty)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {diff >= 0 ? `+${formatNumber(diff)}` : formatNumber(diff)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-cyan-400">
                          {formatNumber(log.deliveryQty || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              eff >= 100
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : eff >= 85
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {eff}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 truncate max-w-[200px]">
                          {log.notes || 'Normal run'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
