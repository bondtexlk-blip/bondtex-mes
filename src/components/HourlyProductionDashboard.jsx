import React, { useState, useEffect } from 'react';
import {
  Clock,
  Activity,
  Scale,
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
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';

export function getMachineUnit(m) {
  if (m?.unit && typeof m.unit === 'string' && m.unit.trim()) return m.unit.trim();
  const name = (m?.name || m?.machineName || '').toLowerCase();
  const code = (m?.code || m?.id || m?.machineId || '').toLowerCase();
  if (name.includes('cutting') || (code.includes('cut') && !name.includes('dry') && !code.includes('dry') && !name.includes('die') && !code.includes('die'))) return 'Fabric Tape';
  if (name.includes('fusing') || name.includes('pusing') || code.includes('pus')) return 'Fabric Tape';
  if (name.includes('iron') || code.includes('irn')) return 'Fabric Tape';
  if (name.includes('die cut') || code.includes('die') || name.includes('dry cut') || code.includes('dry')) return 'pcs';
  return 'pcs';
}

export default function HourlyProductionDashboard({
  onNavigateToWorker,
  onShowToast,
  theme = 'dark',
  onToggleTheme,
}) {
  const [shift, setShift] = useState('Day Shift');
  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedMachineFilter, setSelectedMachineFilter] = useState('All');
  const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'stations'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Editable hourly production log state
  const [editingLogModal, setEditingLogModal] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editOperator, setEditOperator] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const handleOpenEdit = (log, machineInfo, slotInfo, allSlotLogs = []) => {
    const list = allSlotLogs && allSlotLogs.length > 0 ? allSlotLogs : (log ? [log] : []);
    const activeLog = log || list[0] || null;
    setEditingLogModal({
      log: activeLog,
      machine: machineInfo,
      slot: slotInfo,
      logsList: list,
    });
    setEditQty(activeLog?.qty !== undefined ? String(activeLog.qty) : '');
    setEditOperator(activeLog?.operator || activeLog?.operatorName || machineInfo?.operatorName || '');
    setEditNotes(activeLog?.notes || '');
  };

  const handleSelectLogToEdit = (selectedLog) => {
    if (!selectedLog) return;
    setEditingLogModal((prev) => ({
      ...prev,
      log: selectedLog,
    }));
    setEditQty(selectedLog.qty !== undefined ? String(selectedLog.qty) : '');
    setEditOperator(selectedLog.operator || selectedLog.operatorName || editingLogModal?.machine?.operatorName || '');
    setEditNotes(selectedLog.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingLogModal || !editingLogModal.log) return;
    const num = Number(editQty);
    if (isNaN(num) || num < 0) {
      if (onShowToast) onShowToast('Please enter a valid quantity', 'error');
      return;
    }
    const previousData = data;
    const logId = editingLogModal.log.id;
    const oldQty = Number(editingLogModal.log.qty) || 0;
    const diffQty = num - oldQty;

    // Optimistic UI update
    if (data && Array.isArray(data.machines)) {
      const updatedMachines = data.machines.map((m) => {
        const matchesMach =
          m.id === editingLogModal.log.machineId ||
          m.code === editingLogModal.log.machineId ||
          (m.name && editingLogModal.log.machineName && m.name.toLowerCase() === editingLogModal.log.machineName.toLowerCase());
        if (!matchesMach) return m;

        const updatedSlots = (m.slots || []).map((s) => {
          const slotMatches = (s.timeSlot || s.id) === (editingLogModal.slot?.label || editingLogModal.log?.timeSlot);
          if (!slotMatches) return s;
          const updatedSlotLogs = (s.logs || []).map((l) =>
            l.id === logId || l === editingLogModal.log
              ? { ...l, qty: num, operator: editOperator, notes: editNotes }
              : l
          );
          const newActual = Math.max(0, s.actualOutput + diffQty);
          return {
            ...s,
            logs: updatedSlotLogs,
            actualOutput: newActual,
            variance: newActual - s.hourlyTarget,
            variancePct: s.hourlyTarget > 0 ? Math.round(((newActual - s.hourlyTarget) / s.hourlyTarget) * 100) : 0,
            status: newActual >= s.hourlyTarget ? 'Ahead' : newActual > 0 ? 'On Track' : 'Pending',
          };
        });

        const newTotProduced = Math.max(0, (m.totals?.totalProduced || 0) + diffQty);
        return {
          ...m,
          slots: updatedSlots,
          totals: {
            ...m.totals,
            totalProduced: newTotProduced,
            netVariance: newTotProduced - (m.totals?.totalTarget || 0),
          },
        };
      });

      setData((prev) => ({
        ...prev,
        machines: updatedMachines,
        allLogs: (prev.allLogs || []).map((l) =>
          l.id === logId || l === editingLogModal.log
            ? { ...l, qty: num, operator: editOperator, notes: editNotes }
            : l
        ),
      }));
    }

    try {
      setIsSubmittingEdit(true);
      const res = await api.updateProductionLog(editingLogModal.log.id, {
        qty: num,
        operator: editOperator,
        notes: editNotes,
        machineId: editingLogModal.log.machineId || editingLogModal.machine?.code || editingLogModal.machine?.id,
        timeSlot: editingLogModal.slot?.label || editingLogModal.log?.timeSlot,
        date: editingLogModal.log.date || selectedDate,
        size: editingLogModal.log.size || editingLogModal.machine?.size,
        colour: editingLogModal.log.colour || editingLogModal.machine?.colour,
      });

      if (res && res.success) {
        if (onShowToast) {
          const unit = getMachineUnit(editingLogModal.machine);
          onShowToast(`Updated to ${num.toLocaleString()} ${unit} successfully!`, 'success');
        }
        setEditingLogModal(null);
        await loadHourlyData();
      } else {
        setData(previousData);
        if (onShowToast) onShowToast('Failed to update hourly production entry', 'error');
      }
    } catch (err) {
      setData(previousData);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteLog = async (targetLog = editingLogModal?.log) => {
    const logToDelete = targetLog || editingLogModal?.log;
    if (!logToDelete) return;
    const unit = getMachineUnit(editingLogModal?.machine || { name: logToDelete.machineName, code: logToDelete.machineId });
    const confirmMsg = `Are you sure you want to delete this hourly production entry?\n\nMachine: ${logToDelete.machineName || logToDelete.machineId || editingLogModal?.machine?.name || 'Machine'}\nOperator: ${logToDelete.operator || logToDelete.operatorName || 'N/A'}\nSlot: ${logToDelete.timeSlot || editingLogModal?.slot?.label || 'Slot'}\nOutput: ${formatNumber(logToDelete.qty)} ${unit}\n\nThis will permanently delete this record and update Floor Production Qty and Dashboard metrics!`;
    if (!window.confirm(confirmMsg)) return;

    // Instant optimistic state update: Remove immediately from React UI
    const previousData = data;
    const logId = logToDelete.id;
    const targetSlotLabel = logToDelete.timeSlot || editingLogModal?.slot?.label;
    const deletedQty = Number(logToDelete.qty) || 0;

    if (data && Array.isArray(data.machines)) {
      const updatedMachines = data.machines.map((m) => {
        const matchesMach =
          m.id === logToDelete.machineId ||
          m.code === logToDelete.machineId ||
          (m.name && logToDelete.machineName && m.name.toLowerCase() === logToDelete.machineName.toLowerCase());
        if (!matchesMach) return m;

        const updatedSlots = (m.slots || []).map((s) => {
          const slotMatches = (s.timeSlot || s.id) === targetSlotLabel;
          if (!slotMatches) return s;
          const filteredLogs = (s.logs || []).filter((l) => l.id !== logId && l !== logToDelete);
          const newActual = filteredLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
          return {
            ...s,
            logs: filteredLogs,
            actualOutput: newActual,
            variance: newActual - s.hourlyTarget,
            variancePct: s.hourlyTarget > 0 ? Math.round(((newActual - s.hourlyTarget) / s.hourlyTarget) * 100) : 0,
            status: newActual >= s.hourlyTarget ? 'Ahead' : newActual > 0 ? 'On Track' : 'Pending',
          };
        });

        const newTotProduced = Math.max(0, (m.totals?.totalProduced || 0) - deletedQty);
        return {
          ...m,
          slots: updatedSlots,
          totals: {
            ...m.totals,
            totalProduced: newTotProduced,
            netVariance: newTotProduced - (m.totals?.totalTarget || 0),
          },
        };
      });

      setData((prev) => ({
        ...prev,
        machines: updatedMachines,
        allLogs: (prev.allLogs || []).filter((l) => l.id !== logId && l !== logToDelete),
      }));
    }

    setEditingLogModal(null);

    try {
      setIsSubmittingEdit(true);
      const res = await api.deleteProductionLog(logToDelete.id, {
        machineId: logToDelete.machineId || editingLogModal?.machine?.code || editingLogModal?.machine?.id,
        timeSlot: targetSlotLabel,
        date: logToDelete.date || selectedDate,
        size: logToDelete.size,
        qty: logToDelete.qty,
      });

      if (res && res.success) {
        if (onShowToast) onShowToast('Hourly production log deleted successfully!', 'success');
        await loadHourlyData();
      } else {
        setData(previousData);
        if (onShowToast) onShowToast('Failed to delete hourly production entry', 'error');
      }
    } catch (err) {
      setData(previousData);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Fetch machine-wise hourly production data
  const loadHourlyData = async () => {
    try {
      setLoading(true);
      const res = await api.getHourlyProduction({ shift, date: selectedDate });
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
    const unsubscribe = api.subscribe(() => {
      loadHourlyData();
    });
    // Fast polling fallback (every 4 seconds) to guarantee real-time cross-device sync with phone
    const pollId = setInterval(() => {
      loadHourlyData();
    }, 4000);
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(pollId);
    };
  }, [shift, selectedDate]);

  const defaultDaySlots = [
    { id: '07:45-08:45', label: '07:45 - 08:45', display: '7.45 - 8.45' },
    { id: '08:45-09:45', label: '08:45 - 09:45', display: '8.45 - 9.45' },
    { id: '09:45-10:45', label: '09:45 - 10:45', display: '9.45 - 10.45' },
    { id: '10:45-11:45', label: '10:45 - 11:45', display: '10.45 - 11.45' },
    { id: '11:45-12:45', label: '11:45 - 12:45', display: '11.45 - 12.45' },
    { id: '12:45-14:15', label: '12:45 - 14:15', display: '12.45 - 2.15' },
    { id: '14:15-15:15', label: '14:15 - 15:15', display: '2.15 - 3.15' },
    { id: '15:15-16:30', label: '15:15 - 16:30', display: '3.15 - 4.30' },
    { id: '16:30-17:30', label: '16:30 - 17:30', display: '4.30 - 5.30' },
    { id: '17:30-18:30', label: '17:30 - 18:30', display: '5.30 - 6.30' },
    { id: '18:30-19:30', label: '18:30 - 19:30', display: '6.30 - 7.30' },
    { id: '19:30-20:30', label: '19:30 - 20:30', display: '7.30 - 8.30' },
    { id: '21:00-21:30', label: '21:00 - 21:30', display: '9.00 - 9.30' },
  ];
  const defaultNightSlots = [
    { id: '21:30-22:30', label: '21:30 - 22:30', display: '9.30 - 10.30' },
    { id: '22:30-23:30', label: '22:30 - 23:30', display: '10.30 - 11.30' },
    { id: '23:30-00:30', label: '23:30 - 00:30', display: '11.30 - 12.30' },
    { id: '00:30-01:30', label: '00:30 - 01:30', display: '12.30 - 1.30' },
    { id: '01:30-02:30', label: '01:30 - 02:30', display: '1.30 - 2.30' },
    { id: '02:30-03:30', label: '02:30 - 03:30', display: '2.30 - 3.30' },
    { id: '03:30-04:30', label: '03:30 - 04:30', display: '3.30 - 4.30' },
    { id: '04:30-05:30', label: '04:30 - 05:30', display: '4.30 - 5.30' },
    { id: '05:30-06:30', label: '05:30 - 06:30', display: '5.30 - 6.30' },
    { id: '06:30-07:30', label: '06:30 - 07:30', display: '6.30 - 7.30' },
  ];

  const timeSlots = data?.slots || (shift === 'Night Shift' ? defaultNightSlots : defaultDaySlots);
  const summaryMatrix = data?.summaryMatrix || [];
  const machines = data?.machines || [];
  const allLogsForDate = data?.allLogs || [];
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
              Includes Strap division workflows (Cutting, Pusing, Iron Machine) and Dry Cut multiplier calculations.
            </p>
          </div>

          {/* Top Controls: View Toggle, Shift Selector, Theme & Refresh */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle: Summary Matrix vs Station Cards vs All Logs */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('summary')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  viewMode === 'summary'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Summary Matrix</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('stations')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  viewMode === 'stations'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Station Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('logs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  viewMode === 'logs'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Log Entries ({allLogsForDate.length})</span>
              </button>
            </div>

            {/* Production Date Selector */}
            <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-2xl border border-slate-800 text-xs">
              <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                title="Select Production Date to view hourly output"
              />
              {selectedDate !== todayIso && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayIso)}
                  className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[11px] font-bold border border-cyan-500/30 transition"
                  title="Jump back to Today"
                >
                  Today
                </button>
              )}
            </div>

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

      {/* 2. Top Metric Cards Strip (Requirement 2 & 5: Real-Time Completed from LOOP INSERT ONLY, Remaining Balance from Total Order Quantity) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Amount Completed So Far (Strictly LOOP INSERT ONLY) */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-cyan-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Total Completed So Far</span>
            </span>
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
              LOOP INSERT ONLY
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {formatNumber(summary.totalLoopInsertCompleted || summary.totalHourlyOutput)}
            </span>
            <span className="text-xs text-cyan-400 font-mono font-semibold">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Today's Shift Output</span>
            <span className="text-emerald-400 font-mono font-bold">
              +{formatNumber(summary.totalLoopInsertShiftCompleted || 0)} pcs
            </span>
          </div>
        </div>

        {/* Metric 2: Remaining Balance = (Total Order Quantity) - (Total Completed from LOOP INSERT) */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-400 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Remaining Balance</span>
            </span>
            <span className={`p-1 rounded-lg border text-[10px] font-mono font-bold ${
              (summary.remainingBalance || 0) === 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              {(summary.remainingBalance || 0) === 0 ? 'COMPLETED' : 'TO GO'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black font-mono ${
              (summary.remainingBalance || 0) === 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {formatNumber(summary.remainingBalance !== undefined ? summary.remainingBalance : Math.max(0, (summary.totalOrderQty || 271489) - (summary.totalLoopInsertCompleted || 0)))}
            </span>
            <span className="text-xs text-slate-400 font-mono">pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Formula</span>
            <span className="text-slate-300 font-mono text-[10px]">
              Total Order - Loop Insert
            </span>
          </div>
        </div>

        {/* Metric 3: Current Efficiency / Completion Percentage (%) */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Order Completion Rate</span>
            </span>
            <span className="p-1 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold">
              {((Number(summary.totalLoopInsertCompleted || 0) / (Number(summary.totalOrderQty) || 271489)) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-300">
              {summary.efficiencyPct !== undefined ? summary.efficiencyPct : Math.round((Number(summary.totalLoopInsertCompleted || 0) / (Number(summary.totalOrderQty) || 271489)) * 100)}%
            </span>
            <span className="text-xs text-slate-400">progress</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Intermediate WIP (Preparatory)</span>
            <span className="text-slate-300 font-mono">
              +{formatNumber(summary.intermediateShiftOutput || 0)} units
            </span>
          </div>
        </div>

        {/* Metric 4: Total Order Quantity */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-indigo-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Total Order Quantity</span>
            </span>
            <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono font-bold">
              CATALOG
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-indigo-300 font-mono">
              {formatNumber(summary.totalOrderQty || 271489)}
            </span>
            <span className="text-xs text-slate-400 font-mono">pcs target</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
            <span>Plant Fleet</span>
            <span className="text-slate-300 font-mono">{summary.activeMachinesCount || 5} Stations Active</span>
          </div>
        </div>
      </div>

      {/* 3. Factory Rules Legend Strip */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs space-y-2">
        <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Active Factory Hourly Rules & Calculation Logic</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2">
            <Scissors className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">Cutting & Pusing Machines:</span>
              <span className="text-slate-400">Dedicated tracking for Strap category components.</span>
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

      {/* 4. Main Body: Summary Matrix Table OR Detailed Stations View */}
      {viewMode === 'summary' ? (
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
          {/* Summary Matrix Card Header */}
          <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Machines Hourly Production Summary Matrix</span>
              </h3>
              <p className="text-xs text-slate-400">
                Top-to-bottom machine stations listing with assigned Colour, Size, and horizontal hourly slot output.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 px-3 py-1 rounded-xl">
                {(summaryMatrix.length > 0 ? summaryMatrix : machines).length} Active Stations
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/95 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold select-none">
                  <th className="py-3.5 px-4 whitespace-nowrap sticky left-0 bg-slate-950 z-20 border-r border-slate-800 shadow-sm">
                    Machine / Station
                  </th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap border-r border-slate-800/60">
                    Colour
                  </th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap border-r border-slate-800/60">
                    Size
                  </th>
                  {timeSlots.map((slot) => (
                    <th
                      key={slot.id}
                      className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-[10px] border-r border-slate-800/40"
                    >
                      {slot.display || slot.label}
                    </th>
                  ))}
                  <th className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-slate-950 z-20 border-l border-slate-800 shadow-sm">
                    Total Output / Quota
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {(summaryMatrix.length > 0 ? summaryMatrix : machines).map((row) => {
                  const mName = row.name || 'Machine';
                  const mCode = row.code || row.id || '';
                  const mColour = row.colour || (row.assignedColours && row.assignedColours[0]) || '-';
                  const mSize = row.size || (row.assignedSizes && row.assignedSizes.join(', ')) || '-';
                  const mProduced = row.totalProduced !== undefined ? row.totalProduced : (row.totals?.totalProduced || 0);
                  const mTarget = row.dailyTarget !== undefined ? row.dailyTarget : (row.dailyTargetQty || 2500);
                  const mAchieve = mTarget > 0 ? Math.round((mProduced / mTarget) * 100) : 0;

                  return (
                    <tr
                      key={row.id || mCode}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Col 1: Machine */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-white sticky left-0 bg-slate-900 group-hover:bg-slate-850 z-10 border-r border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[150px]">{mName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {mCode}
                          </span>
                          {row.isLoopInsert && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-wide">
                              ★ FINAL ASSEMBLY
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {row.operatorName || 'Floor Worker'}
                          {row.isLoopInsert ? (
                            <span className="ml-1 text-[9px] text-emerald-400 font-bold">• Finished Pieces</span>
                          ) : (
                            <span className="ml-1 text-[9px] text-slate-500 font-normal">• Preparatory WIP</span>
                          )}
                        </div>
                      </td>

                      {/* Col 2: Colour */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap border-r border-slate-800/60">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-300">
                          <span
                            className="w-2 h-2 rounded-full border border-white/20"
                            style={{
                              backgroundColor:
                                (mColour || '').toLowerCase().includes('black')
                                  ? '#18181b'
                                  : (mColour || '').toLowerCase().includes('marzipan')
                                  ? '#d4a373'
                                  : (mColour || '').toLowerCase().includes('praline')
                                  ? '#bc6c25'
                                  : (mColour || '').toLowerCase().includes('ganache')
                                  ? '#4a2c1d'
                                  : (mColour || '').toLowerCase().includes('talc')
                                  ? '#e7e5e4'
                                  : '#38bdf8',
                            }}
                          ></span>
                          <span className="truncate max-w-[110px]">{mColour}</span>
                        </span>
                      </td>

                      {/* Col 3: Size */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap border-r border-slate-800/60">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[11px] font-bold">
                          {mSize}
                        </span>
                      </td>

                      {/* Cols 4..N: Time Slots */}
                      {timeSlots.map((slot) => {
                        const cellData = row.slotOutputs?.[slot.id] || (row.slots?.find((s) => s.id === slot.id));
                        const qty = typeof cellData === 'object' ? (cellData?.qty || cellData?.actualOutput || 0) : (Number(cellData) || 0);
                        const workerLabel = cellData?.workerName || '';
                        const slotLogs = cellData?.logs || [];
                        const breakdowns = cellData?.breakdowns || [];
                        const targetUnit = getMachineUnit(row);

                        return (
                          <td
                            key={slot.id}
                            onClick={() => {
                              if (qty > 0) {
                                const logToEdit = slotLogs.length > 0
                                  ? slotLogs[0]
                                  : {
                                      id: `LOG-SLOT-${row.code || row.id}-${slot.id}`,
                                      machineId: row.code || row.id,
                                      machineName: row.name,
                                      timeSlot: slot.label,
                                      qty,
                                      operator: workerLabel,
                                      size: row.size,
                                      colour: row.colour,
                                      notes: 'Slot output',
                                    };
                                handleOpenEdit(logToEdit, row, slot, slotLogs);
                              }
                            }}
                            className={`py-2.5 px-2 text-center whitespace-nowrap border-r border-slate-800/40 font-mono text-xs ${
                              qty > 0 ? 'bg-cyan-950/30 hover:bg-cyan-900/50 cursor-pointer transition-colors group/cell' : ''
                            }`}
                            title={qty > 0 ? `Click to edit ${qty} ${targetUnit} (${workerLabel})` : undefined}
                          >
                            {qty > 0 ? (
                              <div className="flex flex-col items-center gap-1 min-w-[90px]">
                                {breakdowns.length > 1 ? (
                                  <div className="space-y-1 w-full text-left">
                                    {breakdowns.map((b, bIdx) => (
                                      <div
                                        key={b.key || bIdx}
                                        className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[10px] flex items-center justify-between gap-1 shadow-xs"
                                        title={`Operator: ${b.operator} | Size: ${b.size} | Qty: ${b.qty} ${targetUnit}`}
                                      >
                                        <span className="font-sans font-bold text-slate-200 truncate max-w-[55px]">
                                          {b.operator}
                                        </span>
                                        <span className="font-mono text-amber-300 font-bold whitespace-nowrap">
                                          Sz {b.size}: <span className="text-white font-black">{formatNumber(b.qty)}</span>
                                        </span>
                                        {b.rejectReason && (
                                          <span className="text-[9px] text-rose-400 font-bold" title={`Downtime: ${b.rejectReason}`}>
                                            ⚠️
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    <div className="pt-0.5 border-t border-slate-700/50 flex items-center justify-between text-[10px] font-black text-cyan-300 font-mono px-1">
                                      <span className="text-slate-400 font-normal">Tot:</span>
                                      <span>{formatNumber(qty)} {targetUnit}</span>
                                    </div>
                                  </div>
                                ) : breakdowns.length === 1 ? (
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1 font-black text-cyan-300">
                                      <span>{formatNumber(qty)}</span>
                                      <span className="text-[10px] font-normal text-slate-400">{targetUnit}</span>
                                      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/cell:opacity-100 text-cyan-400 transition" />
                                    </div>
                                    <div className="text-[9px] text-amber-300 font-mono font-bold">
                                      {breakdowns[0].operator} • Sz {breakdowns[0].size}
                                    </div>
                                    {breakdowns[0].rejectReason && (
                                      <span className="text-[8px] px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 mt-0.5 truncate max-w-[85px]">
                                        ⚠️ {breakdowns[0].rejectReason}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1 font-black text-cyan-300">
                                      <span>{formatNumber(qty)}</span>
                                      <span className="text-[10px] font-normal text-slate-400">{targetUnit}</span>
                                    </div>
                                    {workerLabel && (
                                      <span className="text-[9px] text-slate-400 font-sans max-w-[85px] truncate">
                                        {workerLabel}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Last Col: Total Output / Quota & Real-Time Metrics */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-slate-900 group-hover:bg-slate-850 z-10 border-l border-slate-800 shadow-sm">
                        <div className="font-mono font-black text-emerald-400 text-sm">
                          {formatNumber(mProduced)}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            {getMachineUnit(row)}
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-400 font-mono">
                          Remaining: {formatNumber(Math.max(0, mTarget - mProduced))} {getMachineUnit(row)}
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono font-bold">
                          Efficiency: {mAchieve}% (Target: {formatNumber(mTarget)})
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'stations' ? (
        /* Detailed Station Cards View */
        <div className="space-y-8 animate-fade-in">
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
            const unit = getMachineUnit(machine);
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
                      Operator: <span className="text-white font-semibold">{machine.operatorName || 'Floor Worker'}</span> • Shift: <span className="text-slate-300 font-mono">{machine.shift}</span> • Daily Target: <span className="font-mono text-emerald-400 font-bold">{formatNumber(machine.dailyTargetQty)} {unit}</span> • Completed: <span className="font-mono text-cyan-400 font-bold">{formatNumber(totals.totalProduced)} {unit}</span> • Remaining: <span className="font-mono text-amber-400 font-bold">{formatNumber(Math.max(0, totals.totalTarget - totals.totalProduced))} {unit}</span> • Efficiency: <span className="font-mono text-emerald-300 font-bold">{totals.totalTarget > 0 ? Math.round((totals.totalProduced / totals.totalTarget) * 100) : 0}%</span>
                    </p>
                  </div>

                  {/* Hourly Target Formula Indicator & Quick Action */}
                  <div className="flex items-center gap-3">
                    <div className="text-right bg-slate-900/80 px-3.5 py-2 rounded-2xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Hourly Target Pace
                      </span>
                      <span className="text-sm font-mono font-black text-cyan-400">
                        {formatNumber(hourlyTarget)} {unit} / hr
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
                              {formatNumber(slot.hourlyTarget)} {unit}
                            </td>

                            {/* 8. Actual Produced Output (Segregated by Operator & Size) */}
                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap font-mono font-black text-sm">
                              {slot.actualOutput > 0 ? (
                                <div className="flex flex-col items-end gap-1">
                                  {slot.breakdowns && slot.breakdowns.length > 1 && (
                                    <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                                      {slot.breakdowns.map((b, bIdx) => (
                                        <span
                                          key={b.key || bIdx}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-slate-300"
                                        >
                                          <span className="font-sans font-bold text-slate-200">{b.operator}</span>
                                          <span className="text-amber-400 font-bold">• Sz {b.size}:</span>
                                          <span className="text-cyan-300 font-black">{formatNumber(b.qty)}</span>
                                          {b.rejectReason && (
                                            <span className="text-rose-400 text-[9px] font-bold" title={`Reason: ${b.rejectReason}`}>⚠️</span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const logToEdit = slot.logs && slot.logs.length > 0
                                        ? slot.logs[0]
                                        : {
                                            id: `LOG-SLOT-${machine.code || machine.id}-${slot.id}`,
                                            machineId: machine.code || machine.id,
                                            machineName: machine.name,
                                            timeSlot: slot.timeSlot,
                                            qty: slot.actualOutput,
                                            operator: slot.workerName || machine.operatorName,
                                            size: slot.size,
                                            colour: slot.colour,
                                            notes: slot.notes || '',
                                          };
                                      handleOpenEdit(logToEdit, machine, slot, slot.logs || []);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/30 transition group/btn"
                                    title={`Click to view/edit ${slot.actualOutput} ${unit}`}
                                  >
                                    <span>{formatNumber(slot.actualOutput)} {unit}</span>
                                    <Pencil className="w-3 h-3 text-cyan-400 opacity-60 group-hover/btn:opacity-100" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-600 font-normal">0 {unit}</span>
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
                                    {formatNumber(slot.variance)} {unit} ({isAhead ? '+' : ''}
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
                          {formatNumber(totals.totalTarget)} {unit}
                        </td>
                        <td className="py-4 px-3.5 text-right font-black text-emerald-400 text-sm">
                          {formatNumber(totals.totalProduced)} {unit}
                        </td>
                        <td className="py-4 px-3.5 text-right font-black">
                          <span
                            className={
                              totals.netVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {totals.netVariance >= 0 ? '+' : ''}
                            {formatNumber(totals.netVariance)} {unit}
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
      ) : (
        /* View Mode === 'logs': All Logged Entries View */
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
          {/* Card Header */}
          <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>All Hourly Logged Batches</span>
              </h3>
              <p className="text-xs text-slate-400">
                Direct audit trail for <strong>{selectedDate}</strong> ({shift}). You can change numbers or delete any wrong entry.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-xl">
                {allLogsForDate.length} Logged Entries
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/95 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold select-none">
                  <th className="py-3.5 px-4">Time Slot & Time</th>
                  <th className="py-3.5 px-4">Station / Machine</th>
                  <th className="py-3.5 px-4">Operator / Worker</th>
                  <th className="py-3.5 px-4">Order / Colour / Size</th>
                  <th className="py-3.5 px-4 text-right">Output Quantity</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {allLogsForDate.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500 font-sans text-xs">
                      No hourly logs recorded for {selectedDate} ({shift}).
                    </td>
                  </tr>
                ) : (
                  allLogsForDate.map((logItem, idx) => {
                    const unit = logItem.unit || 'pcs';
                    const mach = machines.find((m) => m.code === logItem.machineId || m.id === logItem.machineId || m.name === logItem.machineName);
                    return (
                      <tr key={logItem.id || idx} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-cyan-300">
                          <div className="font-bold">{logItem.timeSlot || 'Slot'}</div>
                          {logItem.time && <div className="text-[10px] text-slate-500">{logItem.time}</div>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-white">{logItem.machineName || logItem.machineId}</span>
                          <span className="ml-1.5 text-[10px] font-mono text-slate-400">({logItem.machineId})</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-medium">
                            {logItem.operatorName || logItem.operator || 'Floor Worker'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-300">
                          {logItem.colour && logItem.colour !== '-' && <span className="mr-2 text-indigo-300">{logItem.colour}</span>}
                          {logItem.size && logItem.size !== '-' && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                              Sz {logItem.size}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-black text-emerald-400 text-sm">
                          {formatNumber(logItem.qty)} <span className="text-[10px] font-normal text-slate-400">{unit}</span>
                          {logItem.rawQty && logItem.multiplier && logItem.multiplier > 1 && (
                            <div className="text-[9px] text-amber-400/80 font-normal">
                              ({logItem.rawQty} × {logItem.multiplier})
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-400 text-[11px]">
                          {logItem.notes || '-'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(logItem, mach, { label: logItem.timeSlot, display: logItem.timeSlot })}
                              className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition"
                              title="Edit quantity / worker"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(logItem)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* Edit Hourly Production Log Modal */}
      {editingLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                  Floor Entry Management
                </span>
                <h3 className="text-base font-bold text-white">
                  Edit Hourly Output ({getMachineUnit(editingLogModal.machine)})
                </h3>
              </div>
              <button
                onClick={() => setEditingLogModal(null)}
                className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* If multiple logs in this slot, allow selecting which worker's batch to edit/delete */}
              {editingLogModal.logsList && editingLogModal.logsList.length > 1 && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300">
                      Multiple Operator Batches in this Slot ({editingLogModal.logsList.length}):
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {editingLogModal.logsList.map((entry, idx) => {
                      const isSelected = editingLogModal.log?.id === entry.id;
                      return (
                        <div
                          key={entry.id || idx}
                          onClick={() => handleSelectLogToEdit(entry)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400">{entry.operator || entry.operatorName || 'Worker'}</span>
                            <span className="text-[10px] text-slate-400">({entry.size ? `Sz ${entry.size}` : ''} {entry.colour || ''})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-amber-300 font-bold">{formatNumber(entry.qty)} {getMachineUnit(editingLogModal.machine)}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLog(entry);
                              }}
                              className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                              title="Delete this entry"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Station & Slot Info */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Station / Machine:</span>
                  <span className="font-bold text-white font-mono">
                    {editingLogModal.machine?.name || editingLogModal.log?.machineName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Time Window:</span>
                  <span className="font-bold text-cyan-400 font-mono">
                    {editingLogModal.slot?.display || editingLogModal.slot?.label || editingLogModal.log?.timeSlot}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Component Unit:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {getMachineUnit(editingLogModal.machine)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Produced Quantity ({getMachineUnit(editingLogModal.machine)}):
                </label>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold text-white font-mono focus:outline-none focus:border-blue-500"
                  placeholder="Enter quantity"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Operator Name:
                </label>
                <input
                  type="text"
                  value={editOperator}
                  onChange={(e) => setEditOperator(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                  placeholder="Worker name"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Notes:
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  placeholder="Optional floor notes"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleDeleteLog(editingLogModal.log)}
                disabled={isSubmittingEdit}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs border border-rose-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLogModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
