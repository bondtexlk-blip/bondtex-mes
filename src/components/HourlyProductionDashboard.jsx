import React, { useState, useEffect } from 'react';
import {
  Clock,
  Activity,
  Layers,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  AlertTriangle,
  Scissors,
  Flame,
  Zap,
  ArrowRight,
  ExternalLink,
  Smartphone,
  Printer,
  ChevronDown,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';

export default function HourlyProductionDashboard({
  onNavigateToWorker,
  onShowToast,
  theme = 'dark',
  onToggleTheme,
}) {
  const [shift, setShift] = useState('Day Shift');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState('All');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Fetch machine-wise hourly production data
  const loadHourlyData = async () => {
    try {
      setLoading(true);
      const res = await api.getHourlyProduction({ shift });
      if (res.success && res.data) {
        setData(res.data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to load hourly production data:', err);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHourlyData();
  }, [shift]);

  const machines = data?.machines || [];
  const summary = data?.summary || {
    totalHourlyOutput: 0,
    totalTargetQuota: 0,
    overallNetVariance: 0,
    activeMachinesCount: 0,
  };
  const workingHours = data?.workingHours || (shift === 'Night Shift' ? 10 : 13);

  // Filter machines if user selected a single machine
  const filteredMachines =
    selectedMachineFilter === 'All'
      ? machines
      : machines.filter((m) => m.id === selectedMachineFilter || m.code === selectedMachineFilter);

  // Calculate overall factory hourly rate
  const overallAchievementRate =
    summary.totalTargetQuota > 0
      ? Math.round((summary.totalHourlyOutput / summary.totalTargetQuota) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950/40 to-indigo-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Time-Slot Output & Machine Rules</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Hourly Production Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Machine-wise hourly output breakdowns comparing hourly targets against actual floor entries.
              Includes Strap division workflows (Cutting, Pusing, Iron & Compress Sync) and Dry Cut multiplier calculations.
            </p>
          </div>

          {/* Top Controls: Shift Selector, Theme & Refresh */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Shift Switcher */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShift('Day Shift')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  shift === 'Day Shift'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Day Shift (13h)</span>
              </button>

              <button
                type="button"
                onClick={() => setShift('Night Shift')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  shift === 'Night Shift'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Night Shift (10h)</span>
              </button>
            </div>

            {/* Quick Machine Filter Dropdown */}
            <select
              value={selectedMachineFilter}
              onChange={(e) => setSelectedMachineFilter(e.target.value)}
              aria-label="Filter by Machine"
              className="bg-slate-950/80 border border-slate-800 text-xs font-semibold rounded-2xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Machines Stacked ({machines.length})</option>
              {machines.map((m) => (
                <option key={m.id || m.code} value={m.id || m.code}>
                  {m.name} ({m.category})
                </option>
              ))}
            </select>

            {/* Refresh */}
            <button
              onClick={loadHourlyData}
              title="Refresh hourly logs"
              className="p-2.5 rounded-2xl bg-slate-850 hover:bg-slate-750 text-slate-300 border border-slate-750 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cumulative Output */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-cyan-400">
              Shift Actual Output
            </span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Activity className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {formatNumber(summary.totalHourlyOutput)}
            </span>
            <span className="text-xs text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Quota Completion</span>
            <span className="text-cyan-400 font-bold font-mono">
              {overallAchievementRate}% of shift
            </span>
          </div>
        </div>

        {/* Expected Target Quota */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-blue-400">
              Shift Target Quota
            </span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
              {formatNumber(summary.totalTargetQuota)}
            </span>
            <span className="text-xs text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Working Windows</span>
            <span className="text-slate-300 font-mono">{workingHours} Production Hours</span>
          </div>
        </div>

        {/* Target vs Actual Net Variance */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-400">
              Net Output Variance
            </span>
            <span
              className={`p-1.5 rounded-lg border ${
                summary.overallNetVariance >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {summary.overallNetVariance >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono ${
                summary.overallNetVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.overallNetVariance >= 0 ? '+' : ''}
              {formatNumber(summary.overallNetVariance)}
            </span>
            <span className="text-xs text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Status</span>
            <span
              className={`font-bold font-mono ${
                summary.overallNetVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.overallNetVariance >= 0 ? 'Ahead of Target' : 'Behind Target Plan'}
            </span>
          </div>
        </div>

        {/* Active Machines in Workflow */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-indigo-400">
              Plant Floor Fleet
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">
              {summary.activeMachinesCount}
            </span>
            <span className="text-xs text-slate-400">Stations Live</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Shift Mode</span>
            <span className="text-slate-300 font-mono">{shift}</span>
          </div>
        </div>
      </div>

      {/* 3. Factory Rules Legend Strip */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs space-y-2">
        <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Active Factory Hourly Rules & Calculation Logic</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px] text-slate-300">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2">
            <Scissors className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">Cutting & Pusing Machines:</span>
              <span className="text-slate-400">Dedicated tracking for Strap category components.</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2">
            <LinkIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">Iron & Compress Sync:</span>
              <span className="text-slate-400">Entries in either Iron or Compress sync identically.</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">Dry Cut Multipliers:</span>
              <span className="text-slate-400">Sz 10,12,14,18 (×50); Sz 16 (×45) on input units.</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">Hourly Target Formula:</span>
              <span className="text-slate-400">Daily Target ÷ {workingHours} Working Hours.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Machine-wise Stacked Breakdown Tables */}
      <div className="space-y-8">
        {loading && !data ? (
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-semibold">Aggregating machine hourly breakdowns & syncing logs...</p>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-16 text-center text-slate-400">
            No machines found matching the selected filter.
          </div>
        ) : (
          filteredMachines.map((machine) => {
            const isDryCut = machine.isDryCut;
            const isSynced = machine.isSyncedStrap;
            const hourlyTarget = machine.expectedHourlyTarget || Math.round(machine.dailyTargetQty / workingHours);
            const totals = machine.totals || {
              totalTarget: machine.dailyTargetQty,
              totalProduced: 0,
              netVariance: 0,
              achievementRate: 0,
            };

            return (
              <div
                key={machine.id || machine.code}
                id={`machine-table-${machine.code || machine.id}`}
                className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden transition"
              >
                {/* Machine Card Header */}
                <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-white tracking-tight">
                        {machine.name}
                      </h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {machine.code || machine.id}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {machine.category} Division
                      </span>

                      {/* Special Machine Rule Badges */}
                      {machine.specialRule && (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 ${
                            isDryCut
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isSynced
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isDryCut ? <Zap className="w-3.5 h-3.5" /> : isSynced ? <LinkIcon className="w-3.5 h-3.5" /> : null}
                          <span>{machine.specialRule}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400">
                      Operator: <span className="text-white font-semibold">{machine.operatorName || 'Floor Worker'}</span> • Shift: <span className="text-slate-300 font-mono">{machine.shift}</span> • Daily Target: <span className="font-mono text-emerald-400 font-bold">{formatNumber(machine.dailyTargetQty)} pcs</span>
                    </p>
                  </div>

                  {/* Hourly Target Formula Indicator & Quick Action */}
                  <div className="flex items-center gap-3">
                    <div className="text-right bg-slate-900/80 px-3.5 py-2 rounded-2xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Hourly Target Pace
                      </span>
                      <span className="text-sm font-mono font-black text-cyan-400">
                        {formatNumber(hourlyTarget)} pcs / hr
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        ({formatNumber(machine.dailyTargetQty)} ÷ {workingHours}h)
                      </span>
                    </div>

                    {onNavigateToWorker && (
                      <button
                        type="button"
                        onClick={() => onNavigateToWorker(machine.code || machine.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-emerald-600/30"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Worker QR</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Machine Hourly Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/95 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold select-none">
                        {/* 1. Time Slot */}
                        <th className="py-3.5 px-4 whitespace-nowrap">Time Slot</th>

                        {/* 2. Worker Name */}
                        <th className="py-3.5 px-3.5 whitespace-nowrap">Worker Name</th>

                        {/* 3. Style */}
                        <th className="py-3.5 px-3.5">Style</th>

                        {/* 4. Colour (Directly before Size!) */}
                        <th className="py-3.5 px-3 whitespace-nowrap">Colour</th>

                        {/* 5. Size */}
                        <th className="py-3.5 px-3 text-center whitespace-nowrap">Size</th>

                        {/* 6. Multiplier Columns (if Dry Cut Machine) */}
                        {isDryCut && (
                          <>
                            <th className="py-3.5 px-3 text-right whitespace-nowrap">Input Units</th>
                            <th className="py-3.5 px-3 text-center whitespace-nowrap">Multiplier</th>
                          </>
                        )}

                        {/* 7. Hourly Target */}
                        <th className="py-3.5 px-3.5 text-right whitespace-nowrap">Target Qty</th>

                        {/* 8. Actual Output */}
                        <th className="py-3.5 px-3.5 text-right whitespace-nowrap">Actual Output</th>

                        {/* 9. Target vs Actual Variance */}
                        <th className="py-3.5 px-3.5 text-right whitespace-nowrap">Variance (+ / -)</th>

                        {/* 10. Status */}
                        <th className="py-3.5 px-4 text-center whitespace-nowrap">Tracking Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {(machine.slots || []).map((slot) => {
                        const isAhead = slot.variance > 0;
                        const isBehind = slot.variance < 0 && slot.actualOutput > 0;
                        const isPending = slot.actualOutput === 0;

                        return (
                          <tr
                            key={slot.id || slot.timeSlot}
                            className={`hover:bg-slate-800/40 transition group ${
                              slot.actualOutput > 0 ? 'bg-slate-900/40' : ''
                            }`}
                          >
                            {/* 1. Time Slot */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-slate-200">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span>{slot.timeSlot}</span>
                              </span>
                            </td>

                            {/* 2. Worker Name */}
                            <td className="py-3.5 px-3.5 whitespace-nowrap font-medium text-white">
                              <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>{slot.workerName || machine.operatorName || 'Floor Worker'}</span>
                              </span>
                            </td>

                            {/* 3. Style */}
                            <td className="py-3.5 px-3.5">
                              <div className="max-w-[200px] truncate text-slate-300 font-semibold text-xs">
                                {slot.style || 'Standard Webbing'}
                              </div>
                            </td>

                            {/* 4. Colour (Directly before Size!) */}
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/80 text-xs font-semibold text-slate-200 shadow-xs">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                                  style={{
                                    backgroundColor:
                                      (slot.colour || '').toLowerCase().includes('black')
                                        ? '#18181b'
                                        : (slot.colour || '').toLowerCase().includes('marzipan')
                                        ? '#d4a373'
                                        : (slot.colour || '').toLowerCase().includes('praline')
                                        ? '#bc6c25'
                                        : (slot.colour || '').toLowerCase().includes('ganache')
                                        ? '#4a2c1d'
                                        : (slot.colour || '').toLowerCase().includes('talc')
                                        ? '#e7e5e4'
                                        : '#38bdf8',
                                  }}
                                ></span>
                                <span className="truncate max-w-[120px]">{slot.colour || 'Marzipan 39H6'}</span>
                              </span>
                            </td>

                            {/* 5. Size */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-mono text-xs font-black border border-slate-700 shadow-xs">
                                {slot.size || '12'}
                              </span>
                            </td>

                            {/* 6. Multiplier Columns (Dry Cut Only) */}
                            {isDryCut && (
                              <>
                                <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono text-slate-300 font-semibold">
                                  {slot.rawQty > 0 ? (
                                    <span>{slot.rawQty} units</span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono font-bold">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-black border ${
                                      String(slot.size).trim() === '16'
                                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    }`}
                                  >
                                    ×{slot.multiplier}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* 7. Expected Hourly Target */}
                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-400">
                              {formatNumber(slot.hourlyTarget)} pcs
                            </td>

                            {/* 8. Actual Produced Output */}
                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap font-mono font-black text-sm">
                              {slot.actualOutput > 0 ? (
                                <span className="text-white">{formatNumber(slot.actualOutput)} pcs</span>
                              ) : (
                                <span className="text-slate-600 font-normal">0 pcs</span>
                              )}
                            </td>

                            {/* 9. Target vs Actual Variance Highlight */}
                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap font-mono font-bold">
                              {slot.actualOutput === 0 ? (
                                <span className="text-slate-600">-</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${
                                    isAhead
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-xs'
                                      : isBehind
                                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-xs'
                                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                  }`}
                                >
                                  {isAhead ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : isBehind ? (
                                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                  ) : null}
                                  <span>
                                    {isAhead ? '+' : ''}
                                    {formatNumber(slot.variance)} pcs ({isAhead ? '+' : ''}
                                    {slot.variancePct}%)
                                  </span>
                                </span>
                              )}
                            </td>

                            {/* 10. Status Badge */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                  slot.status === 'Ahead'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : slot.status === 'On Track'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                    : slot.status === 'Behind Plan'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-slate-800 text-slate-500 border-slate-700'
                                }`}
                              >
                                {slot.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Table Footer: Machine Totals */}
                    <tfoot>
                      <tr className="bg-slate-950 font-mono text-xs border-t-2 border-slate-800 text-slate-200">
                        <td className="py-4 px-4 font-bold uppercase tracking-wider text-slate-400">
                          {machine.name} Total Output
                        </td>
                        <td className="py-4 px-3.5 text-slate-400">-</td>
                        <td className="py-4 px-3.5 text-slate-400">-</td>
                        <td className="py-4 px-3 text-slate-400">-</td>
                        <td className="py-4 px-3 text-slate-400">-</td>
                        {isDryCut && (
                          <>
                            <td className="py-4 px-3 text-right text-slate-400 font-bold">Total</td>
                            <td className="py-4 px-3 text-slate-400">-</td>
                          </>
                        )}
                        <td className="py-4 px-3.5 text-right font-black text-slate-300">
                          {formatNumber(totals.totalTarget)} pcs
                        </td>
                        <td className="py-4 px-3.5 text-right font-black text-emerald-400 text-sm">
                          {formatNumber(totals.totalProduced)} pcs
                        </td>
                        <td className="py-4 px-3.5 text-right font-black">
                          <span
                            className={
                              totals.netVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {totals.netVariance >= 0 ? '+' : ''}
                            {formatNumber(totals.netVariance)} pcs
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-black text-cyan-400 text-xs">
                            {totals.achievementRate}% Quota
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
