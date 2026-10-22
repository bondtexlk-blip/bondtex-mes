import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Calendar,
  Clock,
  TrendingUp,
  Users,
  Search,
  Filter,
  ArrowRight,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  QrCode,
  Smartphone,
  ExternalLink,
  ChevronRight,
  X,
  Target,
  PackageCheck,
  Scale,
  Factory,
  Sun,
  Moon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../api/client';
import {
  formatNumber,
  formatCompactNumber,
  getStatusBadgeClass,
  getCategoryColor,
} from '../utils/formatters';

export default function DailyProductionDashboard({
  onNavigateToWorker,
  onShowToast,
  theme = 'dark',
  onToggleTheme,
}) {
  const [category, setCategory] = useState('Loop');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLogModal, setSelectedLogModal] = useState(null);
  const [showCompleteLogsModal, setShowCompleteLogsModal] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [chartView, setChartView] = useState('timeline'); // 'timeline' | 'size'

  const categories = ['Loop', 'Strap', 'T-shirt', 'Other'];

  // Load Daily Production Data
  const loadDailyData = async () => {
    try {
      setLoading(true);
      const res = await api.getDailyProduction(category);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error loading daily production data:', err);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDailyData();
  }, [category]);

  const summary = data?.summary || {
    totalOrderQty: 0,
    totalProductionQty: 0,
    totalBalanceQty: 0,
    todayTotalOutput: 0,
    todayTargetQuota: 0,
    targetAchievementRate: 0,
    activeOperatorsCount: 0,
    activeMachinesCount: 0,
    totalBatchesToday: 0,
  };

  const tableRows = data?.tableRows || [];
  const drillDownLogs = data?.drillDownLogs || [];
  const hourlyTimeline = data?.charts?.hourlyTimeline || [];
  const sizeBreakdown = data?.charts?.sizeBreakdown || [];

  // Filter logs for drilldown modal
  const filteredLogs = drillDownLogs.filter((log) => {
    if (!logSearchQuery.trim()) return true;
    const q = logSearchQuery.toLowerCase();
    return (
      (log.operatorName && log.operatorName.toLowerCase().includes(q)) ||
      (log.machineName && log.machineName.toLowerCase().includes(q)) ||
      (log.poNumber && log.poNumber.toLowerCase().includes(q)) ||
      (log.style && log.style.toLowerCase().includes(q)) ||
      (log.size && String(log.size).includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Banner with Category Switcher (Defaulting to Loop) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Real-Time Operator QR Entries</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Daily Production Dashboard ({category})
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Monitoring floor output submitted directly from operator machine QR scans. Real-time metrics for Style, Size, Order Volume, Produced Pieces, and Balances.
            </p>
          </div>

          {/* Action buttons & Category selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Pills */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    category === cat
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              </button>
            )}

            <button
              onClick={loadDailyData}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Refresh today's floor data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowCompleteLogsModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition"
            >
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Complete Drill-Down Logs ({drillDownLogs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards for Today's Floor Production */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Today Total Output */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-blue-500/30 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-blue-400">
              Today's Output (QR)
            </span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Activity className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {formatNumber(summary.todayTotalOutput)}
            </span>
            <span className="text-xs text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Quota: {formatNumber(summary.todayTargetQuota)} pcs</span>
            <span className="text-emerald-400 font-bold font-mono">
              {summary.targetAchievementRate}% Quota
            </span>
          </div>
        </div>

        {/* Total Order Qty in Loop */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px]">
              {category} Order Qty
            </span>
            <span className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
              <PackageCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {formatNumber(summary.totalOrderQty)}
            </span>
            <span className="text-xs text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Booked Contracts</span>
            <span className="text-slate-300 font-mono">{tableRows.length} Styles/Sizes</span>
          </div>
        </div>

        {/* Total Production Qty */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-400">
              Cumulative Produced
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Factory className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {formatNumber(summary.totalProductionQty)}
            </span>
            <span className="text-xs text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Total Completed</span>
            <span className="text-emerald-400 font-bold font-mono">
              {summary.totalOrderQty > 0 ? Math.round((summary.totalProductionQty / summary.totalOrderQty) * 100) : 0}% Done
            </span>
          </div>
        </div>

        {/* Balance Qty */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-400">
              Remaining Balance
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Scale className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {formatNumber(summary.totalBalanceQty)}
            </span>
            <span className="text-xs text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Active Operators: {summary.activeOperatorsCount}</span>
            <span className="text-slate-400 font-mono">{summary.totalBatchesToday} batches</span>
          </div>
        </div>
      </div>

      {/* --- REQUIREMENT 1 TABLE: COMPREHENSIVE DATA TABLE --- */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden space-y-0">
        <div className="p-5 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{category} Daily Production & Quota Status</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono">
                {tableRows.length} Items
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Real-time records displaying Style Name, Size, Order Qty, Production Qty, Balance Qty, and Today's QR Output
            </p>
          </div>

          <button
            onClick={() => setShowCompleteLogsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition self-start sm:self-auto"
          >
            <span>View Complete Worker Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold select-none">
                <th className="py-3.5 px-4">Production / Style Name</th>
                <th className="py-3.5 px-3">Colour</th>
                <th className="py-3.5 px-3 text-center">Size</th>
                <th className="py-3.5 px-4 text-right">Order Qty</th>
                <th className="py-3.5 px-4 text-right">Production Qty</th>
                <th className="py-3.5 px-4 text-right">Balance Qty</th>
                <th className="py-3.5 px-4 text-right">Today's QR Output</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading daily production records...</span>
                    </div>
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No production orders found for {category} category.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const progress = row.orderQty > 0 ? Math.round((row.productionQty / row.orderQty) * 100) : 0;

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* 1. Production / Style Name */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-[260px]">
                          <span className="font-bold text-white text-xs block group-hover:text-blue-400 transition-colors">
                            {row.style}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>PO: {row.poNumber}</span>
                            <span>•</span>
                            <span className="text-cyan-300">{row.rmMaterial}</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Colour (Directly before Size) */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/80 text-xs font-semibold text-slate-200 shadow-xs">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                            style={{
                              backgroundColor:
                                (row.colour || '').toLowerCase().includes('black')
                                  ? '#18181b'
                                  : (row.colour || '').toLowerCase().includes('marzipan')
                                  ? '#d4a373'
                                  : (row.colour || '').toLowerCase().includes('praline')
                                  ? '#bc6c25'
                                  : (row.colour || '').toLowerCase().includes('ganache')
                                  ? '#4a2c1d'
                                  : (row.colour || '').toLowerCase().includes('talc')
                                  ? '#e7e5e4'
                                  : '#38bdf8',
                            }}
                          ></span>
                          <span className="truncate max-w-[140px]">{row.colour || 'Standard'}</span>
                        </span>
                      </td>

                      {/* 3. Size (Bold & Formatted) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-mono text-xs font-black border border-slate-700 shadow-xs">
                          {row.size}
                        </span>
                      </td>

                      {/* 3. Order Qty */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-100 text-xs">
                        {formatNumber(row.orderQty)}
                      </td>

                      {/* 4. Production Qty */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div>
                          <span className="font-mono font-bold text-emerald-400 text-xs">
                            {formatNumber(row.productionQty)}
                          </span>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden inline-block">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${Math.min(100, progress)}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {progress}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Balance Qty */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold text-xs">
                        <span
                          className={
                            row.balanceQty === 0
                              ? 'text-emerald-400'
                              : row.balanceQty < row.orderQty * 0.2
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }
                        >
                          {formatNumber(row.balanceQty)}
                        </span>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {row.balanceQty === 0 ? 'Completed' : 'Remaining'}
                        </div>
                      </td>

                      {/* 6. Today's QR Output */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-mono font-black text-blue-400 text-xs bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
                          +{formatNumber(row.todayOutput)} pcs
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Target: {formatNumber(row.dayPlan)}
                        </div>
                      </td>

                      {/* 7. Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>

                      {/* 8. Details Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setLogSearchQuery(row.poNumber);
                            setShowCompleteLogsModal(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold border border-slate-700 transition"
                        >
                          <span>Logs</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- REQUIREMENT 1 GRAPH: VISUAL GRAPH SHOWING DAILY PRODUCTION PERFORMANCE --- */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span>Daily Production Performance ({category})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Visual performance tracking comparing operator outputs against planned targets
            </p>
          </div>

          {/* Graph View Toggle */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setChartView('timeline')}
              className={`px-3 py-1 rounded-lg transition ${
                chartView === 'timeline'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hourly Timeline
            </button>
            <button
              onClick={() => setChartView('size')}
              className={`px-3 py-1 rounded-lg transition ${
                chartView === 'size'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Output by Size
            </button>
          </div>
        </div>

        {/* Dynamic Responsive Recharts Graph */}
        <div className="h-72 w-full pt-2">
          {chartView === 'timeline' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourlyTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="todayDailyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const out = payload.find((p) => p.dataKey === 'output')?.value || 0;
                      const tgt = payload.find((p) => p.dataKey === 'target')?.value || 0;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white border-b border-slate-800 pb-1">
                            {label}
                          </div>
                          <div className="text-blue-400 font-semibold">
                            QR Output: <span className="font-mono text-white">{formatNumber(out)} pcs</span>
                          </div>
                          <div className="text-slate-400">
                            Target Slot: <span className="font-mono text-slate-300">{formatNumber(tgt)} pcs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Bar dataKey="output" name="Today's Output (pcs)" fill="url(#todayDailyGrad)" radius={[4, 4, 0, 0]} barSize={24} />
                <Line type="monotone" dataKey="target" name="Target Trend" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="size" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const out = payload.find((p) => p.dataKey === 'todayOutput')?.value || 0;
                      const tgt = payload.find((p) => p.dataKey === 'target')?.value || 0;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white border-b border-slate-800 pb-1">
                            {label}
                          </div>
                          <div className="text-blue-400 font-semibold">
                            Today Output: <span className="font-mono text-white">{formatNumber(out)} pcs</span>
                          </div>
                          <div className="text-slate-400">
                            Target Plan: <span className="font-mono text-slate-300">{formatNumber(tgt)} pcs</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Bar dataKey="target" name="Daily Target Plan" fill="#475569" radius={[4, 4, 0, 0]} />
                <Bar dataKey="todayOutput" name="Actual QR Output" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* --- DRILL-DOWN MODAL WITH COMPLETE WORKER LOGS --- */}
      {showCompleteLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Complete Daily Production Drill-Down Logs</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-mono">
                      {category}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Individual operator submission records captured from physical machine QR scans
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCompleteLogsModal(false);
                  setLogSearchQuery('');
                }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Search inside logs */}
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Filter logs by operator, machine, style, or PO..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
                {logSearchQuery && (
                  <button
                    onClick={() => setLogSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <span className="text-slate-400 font-mono text-[11px]">
                Showing {filteredLogs.length} of {drillDownLogs.length} batch records
              </span>
            </div>

            {/* Complete Logs Table */}
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No batch submission logs matched your filter.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="py-3 px-3">Time / Timestamp</th>
                        <th className="py-3 px-3">Time Slot / Shift</th>
                        <th className="py-3 px-3">Operator / Worker</th>
                        <th className="py-3 px-3">Machine / Station</th>
                        <th className="py-3 px-3">PO #</th>
                        <th className="py-3 px-3">Style</th>
                        <th className="py-3 px-3">Colour</th>
                        <th className="py-3 px-3 text-center">Size</th>
                        <th className="py-3 px-3 text-right">Batch Qty</th>
                        <th className="py-3 px-3">Operator Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {filteredLogs.map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-mono font-medium text-slate-300 whitespace-nowrap">
                            <div>{log.time}</div>
                            <div className="text-[10px] text-slate-500">{log.date}</div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono text-cyan-400 font-bold text-xs block">
                              {log.timeSlot || '08:45 - 09:45'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {log.shift || 'Day Shift'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-blue-400" />
                              <span>{log.operatorName || 'Floor Worker'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded text-[11px]">
                              {log.machineName || log.machineId}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-200 whitespace-nowrap">
                            {log.poNumber}
                          </td>
                          <td className="py-3 px-3">
                            <div className="max-w-[180px] font-semibold text-slate-200 truncate">
                              {log.style}
                            </div>
                          </td>
                          {/* Dedicated Colour column directly before Size */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-200">
                              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                              <span className="truncate max-w-[110px]">{log.colour || 'Standard'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-mono font-black border border-slate-700">
                              {log.size}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-black text-emerald-400 text-xs">
                            +{formatNumber(log.qty)} pcs
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-[180px]">
                            {log.notes || 'Floor entry'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>All records synced live from mobile operator QR submissions</span>
              <button
                onClick={() => {
                  setShowCompleteLogsModal(false);
                  setLogSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
              >
                Close Drill-Down
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
