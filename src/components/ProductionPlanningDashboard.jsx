import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  Cpu,
  ArrowRight,
  RefreshCw,
  Sliders,
  FileSpreadsheet,
  Zap,
  Info,
  Check,
  Building2,
  CalendarDays,
  Target,
  ShieldCheck,
  TrendingUp,
  Plus,
  Trash2,
  Package,
  FileText,
  FileDown,
  Scissors,
  Box,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';
import {
  generateProductionPlanWithGemini,
  generateDailyAiAnalysisWithGemini,
  calculateWorkingDays,
  PLANNING_TIME_SLOTS,
  DEFAULT_HOLIDAYS_2026,
} from '../services/geminiService';
import { exportProductionPlanToExcel } from '../utils/excelExport';
import { exportDailyAiPlanPdf } from '../utils/dailyAiReportPdf';

export default function ProductionPlanningDashboard({ onShowToast, theme = 'dark' }) {
  const [orders, setOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [targetType, setTargetType] = useState('balance'); // 'balance' | 'total' | 'custom'
  const [customQty, setCustomQty] = useState('');

  // Date Selection (default: today to +8 days)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultEndStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 9);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(defaultEndStr);
  const [includeSaturdays, setIncludeSaturdays] = useState(false);
  const [includeSundays, setIncludeSundays] = useState(false);
  const [rampUpMode, setRampUpMode] = useState('capacity_standard'); // 'capacity_standard' | 'none'

  // Generated Plan & State
  const [plan, setPlan] = useState(null);
  const [activeTabMachine, setActiveTabMachine] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Manual Material & Inventory Input State
  const [materials, setMaterials] = useState(() => {
    try {
      const saved = localStorage.getItem('bondtex_planning_materials');
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: 'mat-1',
              name: 'Fabric Strips (1350mm)',
              quantity: 350,
              unit: 'Strips',
              notes: 'Elastic woven band base (Yield 65 pcs/strip)',
            },
            {
              id: 'mat-2',
              name: 'Adhesive Tape (10mm)',
              quantity: 472.5,
              unit: 'Meters',
              notes: 'Inner bonding layer (1350mm strip length)',
            },
            {
              id: 'mat-3',
              name: 'Adhesive Tape (17mm)',
              quantity: 472.5,
              unit: 'Meters',
              notes: 'Outer bonding layer (1350mm strip length)',
            },
          ];
    } catch {
      return [];
    }
  });

  const [newMaterial, setNewMaterial] = useState({
    name: '',
    quantity: '',
    unit: 'Meters',
    notes: '',
  });

  // AI Daily Analysis State
  const [aiDailyAnalysis, setAiDailyAnalysis] = useState(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState(todayStr);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Load initial orders & machines
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [ordersRes, machinesRes, activePlanRes] = await Promise.all([
          api.getOrders(),
          api.getMachines(),
          api.getActiveProductionPlan().catch(() => ({ success: false })),
        ]);

        if (ordersRes?.orders) {
          setOrders(ordersRes.orders);
          // Auto-select Talc 12 or active order
          const preferredOrder =
            ordersRes.orders.find((o) => o.poNumber === '4502991562' && String(o.size) === '12') ||
            ordersRes.orders.find((o) => o.balanceQty > 0) ||
            ordersRes.orders[0];

          if (preferredOrder) {
            setSelectedOrderId(preferredOrder.id);
          }
        }

        if (machinesRes?.success && machinesRes.data) {
          setMachines(machinesRes.data);
        }

        if (activePlanRes?.success && activePlanRes.data) {
          setPlan(activePlanRes.data);
          if (activePlanRes.data.assignedMachines?.[0]) {
            setActiveTabMachine(activePlanRes.data.assignedMachines[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading planning data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Selected Order Object
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Compute Target Quantity
  const plannedQuantity = useMemo(() => {
    if (!selectedOrder) return 0;
    if (targetType === 'balance') {
      return selectedOrder.balanceQty > 0 ? selectedOrder.balanceQty : selectedOrder.orderQty;
    }
    if (targetType === 'custom') {
      return Number(customQty) || selectedOrder.balanceQty || selectedOrder.orderQty;
    }
    return selectedOrder.orderQty;
  }, [selectedOrder, targetType, customQty]);

  // Working Days Calculation
  const calendarMetrics = useMemo(() => {
    return calculateWorkingDays(startDate, endDate, {
      includeSaturdays,
      includeSundays,
    });
  }, [startDate, endDate, includeSaturdays, includeSundays]);

  // Generate Plan Handler
  const handleGeneratePlan = async () => {
    if (!selectedOrder) {
      if (onShowToast) onShowToast('Please select a production order to plan', 'error');
      return;
    }
    if (calendarMetrics.count === 0) {
      if (onShowToast) onShowToast('Selected range has 0 working days. Adjust date range or weekend toggles.', 'error');
      return;
    }

    try {
      setGenerating(true);
      setSavedSuccess(false);

      const generated = await generateProductionPlanWithGemini({
        order: selectedOrder,
        targetQuantity: plannedQuantity,
        startDate,
        endDate,
        machines,
        includeSaturdays,
        includeSundays,
        rampUp: rampUpMode,
      });

      setPlan(generated);
      if (generated.assignedMachines?.[0]) {
        setActiveTabMachine(generated.assignedMachines[0].id);
      }

      // Automatically persist to dbStore
      await api.saveProductionPlan(generated);
      setSavedSuccess(true);

      // Trigger initial AI Daily Production & Material Analysis
      try {
        const dailyAnalysis = await generateDailyAiAnalysisWithGemini({
          order: selectedOrder,
          plan: generated,
          materials,
          targetDate: startDate,
        });
        setAiDailyAnalysis(dailyAnalysis);
      } catch (e) {
        console.warn('Initial daily analysis note:', e);
      }

      if (onShowToast) {
        onShowToast('Gemini AI Production Plan successfully generated and scheduled!', 'success');
      }
    } catch (err) {
      console.error('Plan generation failed:', err);
      if (onShowToast) onShowToast('Failed to generate plan. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Add Manual Material Handler
  const handleAddMaterial = (e) => {
    if (e) e.preventDefault();
    if (!newMaterial.name.trim()) {
      if (onShowToast) onShowToast('Please enter material name (e.g. Fabric Strips)', 'error');
      return;
    }
    const numQty = Number(newMaterial.quantity) || 0;
    if (numQty <= 0) {
      if (onShowToast) onShowToast('Please enter a valid positive quantity', 'error');
      return;
    }

    const item = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: newMaterial.name.trim(),
      quantity: numQty,
      unit: newMaterial.unit || 'Meters',
      notes: newMaterial.notes.trim() || '-',
    };

    const updated = [...materials, item];
    setMaterials(updated);
    try {
      localStorage.setItem('bondtex_planning_materials', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNewMaterial({ name: '', quantity: '', unit: 'Meters', notes: '' });
    if (onShowToast) onShowToast(`Added "${item.name}" (${item.quantity} ${item.unit})`);
  };

  // Remove Material Handler
  const handleRemoveMaterial = (id) => {
    const updated = materials.filter((m) => m.id !== id);
    setMaterials(updated);
    try {
      localStorage.setItem('bondtex_planning_materials', JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (onShowToast) onShowToast('Removed material item');
  };

  // Auto-calculate Standard Materials based on order size and yield
  const handleAutoAddStandardMaterials = () => {
    if (!selectedOrder) return;
    const sizeStr = String(selectedOrder.size || '12');
    const targetPcs = plannedQuantity || selectedOrder.orderQty || 5000;

    const yieldMap = {
      '10': { yieldPerStrip: 70, tapeA: '9mm', tapeB: '16mm' },
      '12': { yieldPerStrip: 65, tapeA: '10mm', tapeB: '17mm' },
      '14': { yieldPerStrip: 58, tapeA: '11mm', tapeB: '18mm' },
      '16': { yieldPerStrip: 61, tapeA: '12mm', tapeB: '19mm' },
      '18': { yieldPerStrip: 48, tapeA: '13mm', tapeB: '20mm' },
    };
    const spec = yieldMap[sizeStr] || { yieldPerStrip: 65, tapeA: '10mm', tapeB: '17mm' };
    const requiredStrips = Math.ceil(targetPcs / spec.yieldPerStrip);
    const requiredMeters = Number((requiredStrips * 1.35).toFixed(2));

    const standardItems = [
      {
        id: `mat-${Date.now()}-1`,
        name: `Fabric Strips 1350mm (Size ${sizeStr})`,
        quantity: requiredStrips,
        unit: 'Strips',
        notes: `Yield: ${spec.yieldPerStrip} pcs/strip (${requiredMeters} meters)`,
      },
      {
        id: `mat-${Date.now()}-2`,
        name: `Adhesive Tape ${spec.tapeA} (1350mm strip)`,
        quantity: requiredMeters,
        unit: 'Meters',
        notes: `Inner adhesive backing for Size ${sizeStr}`,
      },
      {
        id: `mat-${Date.now()}-3`,
        name: `Adhesive Tape ${spec.tapeB} (1350mm strip)`,
        quantity: requiredMeters,
        unit: 'Meters',
        notes: `Outer adhesive backing for Size ${sizeStr}`,
      },
    ];

    const merged = [...materials, ...standardItems];
    setMaterials(merged);
    try {
      localStorage.setItem('bondtex_planning_materials', JSON.stringify(merged));
    } catch {
      // ignore
    }
    if (onShowToast) onShowToast(`Auto-added standard Fabric Strips & Twin Adhesive Tape for Size ${sizeStr}!`);
  };

  // Run AI Daily Analysis Handler
  const handleRunAiDailyAnalysis = async (customDate = selectedAnalysisDate) => {
    if (!selectedOrder) {
      if (onShowToast) onShowToast('Please select a production order first', 'error');
      return;
    }
    try {
      setAnalyzingAi(true);
      const analysis = await generateDailyAiAnalysisWithGemini({
        order: selectedOrder,
        plan,
        materials,
        targetDate: customDate || todayStr,
      });
      setAiDailyAnalysis(analysis);
      if (onShowToast) onShowToast('Daily AI production & material analysis generated!', 'success');
    } catch (err) {
      console.error('Failed to run AI daily analysis:', err);
      if (onShowToast) onShowToast('Analysis error: ' + err.message, 'error');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Download Daily AI Report PDF Handler
  const handleDownloadDailyPdf = () => {
    if (!selectedOrder) {
      if (onShowToast) onShowToast('Please select an order first', 'error');
      return;
    }
    try {
      setExportingPdf(true);
      exportDailyAiPlanPdf({
        plan,
        order: selectedOrder,
        materials,
        aiAnalysis: aiDailyAnalysis,
        targetDate: selectedAnalysisDate || todayStr,
      });
      if (onShowToast) onShowToast('Daily AI Report PDF downloaded successfully!', 'success');
    } catch (err) {
      if (onShowToast) onShowToast('Failed to export PDF report: ' + err.message, 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  // Export to Excel Handler
  const handleExportExcel = () => {
    if (!plan) {
      if (onShowToast) onShowToast('Please generate an AI schedule first', 'error');
      return;
    }
    const ok = exportProductionPlanToExcel(plan);
    if (ok) {
      if (onShowToast) onShowToast('Downloaded Excel production schedule workbook!', 'success');
    } else {
      if (onShowToast) onShowToast('Excel export failed', 'error');
    }
  };

  // Save / Activate Plan Handler
  const handleActivatePlan = async () => {
    if (!plan) return;
    try {
      setSavingPlan(true);
      await api.saveProductionPlan(plan);
      setSavedSuccess(true);
      if (onShowToast) {
        onShowToast('Production plan activated as primary factory schedule!', 'success');
      }
    } catch {
      if (onShowToast) onShowToast('Error activating plan', 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  const selectedMachinePlan = useMemo(() => {
    if (!plan) return null;
    return (plan.assignedMachines || []).find((m) => m.id === activeTabMachine) || plan.assignedMachines?.[0];
  }, [plan, activeTabMachine]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-inner">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                AI Production Planning & Scheduling Engine
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                Gemini 3.8 Flash
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                10 Shift Slots
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Intelligent line balancing, holiday filtering, machine-wise capacity allocation & native multi-sheet Excel export
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadDailyPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-950/50 cursor-pointer disabled:opacity-50"
            title="Download Daily AI Production & Material Plan PDF"
          >
            {exportingPdf ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 text-cyan-300" />
            )}
            <span>Download Daily AI Report (PDF)</span>
          </button>

          {plan && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 cursor-pointer"
              title="Download separate Excel sheets for each machine"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-indigo-950/50 cursor-pointer"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating AI Plan...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generate AI Schedule</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Interactive Input Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT CARD: ORDER SELECTION & PLANNED QUANTITY */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>1. Select Production Order</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {orders.length} Active PO Lines
            </span>
          </div>

          {/* Order Dropdown */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
              Active Factory PO Line:
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              aria-label="Select Production Order"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-indigo-500 cursor-pointer shadow-inner"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id} className="bg-slate-900 text-white py-1">
                  PO {o.poNumber} • {o.colour} • Sz {o.size} — Bal: {formatNumber(o.balanceQty)} pcs ({o.status})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Order Summary Chip */}
          {selectedOrder && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-slate-900/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Order Qty</span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatNumber(selectedOrder.orderQty)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Produced</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatNumber(selectedOrder.productionQty)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Balance Left</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formatNumber(selectedOrder.balanceQty)}
                </span>
              </div>
            </div>
          )}

          {/* Target Quantity Basis */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
              Schedule Quantity Basis:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('balance')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border ${
                  targetType === 'balance'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500 ring-1 ring-amber-500/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Remaining Balance
              </button>
              <button
                type="button"
                onClick={() => setTargetType('total')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border ${
                  targetType === 'total'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500 ring-1 ring-blue-500/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Full Order Qty
              </button>
              <button
                type="button"
                onClick={() => setTargetType('custom')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border ${
                  targetType === 'custom'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Custom Qty
              </button>
            </div>

            {targetType === 'custom' && (
              <input
                type="number"
                placeholder="Enter custom target pcs..."
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>
        </div>

        {/* RIGHT CARD: CALENDAR, TIMELINE & WORKING DAYS LOGIC */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>2. Timeline & Working Days Filtering</span>
            </span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md font-bold">
              {calendarMetrics.count} Working Days
            </span>
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
                Start Date:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Production Start Date"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
                End Date (Planned Target):
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="Production End Date"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Working Days Summary Pills */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Days</span>
              <span className="font-mono font-bold text-white text-sm">
                {calendarMetrics.totalCalendarDays}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Working Days</span>
              <span className="font-mono font-bold text-cyan-400 text-sm">
                {calendarMetrics.count}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Off Days</span>
              <span className="font-mono font-bold text-rose-400 text-sm">
                {calendarMetrics.offDays}
              </span>
            </div>
          </div>

          {/* Weekend & Factory Calendar Filters */}
          <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeSaturdays}
                  onChange={(e) => setIncludeSaturdays(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 bg-slate-950 border-slate-700"
                />
                <span>Include Saturdays</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeSundays}
                  onChange={(e) => setIncludeSundays(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 bg-slate-950 border-slate-700"
                />
                <span>Include Sundays</span>
              </label>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>18 Poya & Public Holidays Filtered</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MANUAL MATERIAL & INVENTORY INPUT SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                3. Manual Material & Inventory Input
              </h3>
              <p className="text-[11px] text-slate-400">
                Type and add required raw materials and quantities (e.g., Fabric Strips, Adhesive Tape) for the scheduled production
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoAddStandardMaterials}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
              title="Auto-calculate required Fabric Strips & Twin Adhesive Tape matching selected order size and yield"
            >
              <Scissors className="w-3.5 h-3.5 text-cyan-400" />
              <span>Auto-Calculate Standard Strips & Tape</span>
            </button>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
              {materials.length} Materials Active
            </span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddMaterial} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
              Raw Material / Item Name:
            </label>
            <input
              type="text"
              placeholder="e.g. Fabric Strips, Adhesive Tape..."
              value={newMaterial.name}
              onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
              Required Qty:
            </label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 500"
              value={newMaterial.quantity}
              onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
              Unit:
            </label>
            <select
              value={newMaterial.unit}
              onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 shadow-inner cursor-pointer"
            >
              <option value="Meters">Meters (m)</option>
              <option value="Strips">Strips (1350mm)</option>
              <option value="Rolls">Rolls</option>
              <option value="Kg">Kg</option>
              <option value="Pcs">Pieces (pcs)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
              Specification / Notes:
            </label>
            <input
              type="text"
              placeholder="e.g. Width 10mm, Length 1350mm..."
              value={newMaterial.notes}
              onChange={(e) => setNewMaterial({ ...newMaterial, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition cursor-pointer"
              title="Add Material"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Materials Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Material / Item</th>
                <th className="py-2.5 px-3 text-right">Required Quantity</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Specification / Notes</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {materials.length > 0 ? (
                materials.map((mat, idx) => (
                  <tr key={mat.id || idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      <Box className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{mat.name}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right text-emerald-300">
                      {Number(mat.quantity).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">{mat.unit}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-xs">{mat.notes || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterial(mat.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-4 text-center text-xs text-slate-500 italic">
                    No materials entered yet. Use the inputs above or click "Auto-Calculate Standard Strips & Tape".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. AI-DRIVEN DAILY PRODUCTION & MATERIAL ANALYSIS CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Gemini AI Daily Production & Material Analysis</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Live AI Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Daily operational intelligence: Active running items, expected completions, and material usage requirements
              </p>
            </div>
          </div>

          {/* Date Selector & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Analysis Date:</span>
              <input
                type="date"
                value={selectedAnalysisDate}
                onChange={(e) => {
                  setSelectedAnalysisDate(e.target.value);
                  handleRunAiDailyAnalysis(e.target.value);
                }}
                className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              disabled={analyzingAi}
              onClick={() => handleRunAiDailyAnalysis(selectedAnalysisDate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-950/40 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzingAi ? 'animate-spin' : ''}`} />
              <span>{analyzingAi ? 'Analyzing...' : 'Re-Analyze with Gemini'}</span>
            </button>

            <button
              type="button"
              disabled={exportingPdf}
              onClick={handleDownloadDailyPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-950/40 cursor-pointer disabled:opacity-50"
            >
              {exportingPdf ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-cyan-300" />
              )}
              <span>Download Daily AI Report (PDF)</span>
            </button>
          </div>
        </div>

        {/* 4 Core Analysis Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: What specific production/items are running today? */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <Layers className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">
                1. Running Production & Active Items Today
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {aiDailyAnalysis?.runningProductionToday ||
                `Active lines are operating for PO #${selectedOrder?.poNumber || '4502991562'} producing Style "${selectedOrder?.style || 'Loop Elastic Band'}" in Colour "${selectedOrder?.colour || 'Talc 69-09-47 57H1'}" (Size ${selectedOrder?.size || '12'}) across assigned machines with continuous 10-slot shift scheduling.`}
            </p>
          </div>

          {/* Card 2: What orders or batches are expected to be completed today? */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Target className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                2. Expected Batch & Order Completions Today
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {aiDailyAnalysis?.expectedCompletionsToday ||
                `Planned run targets a milestone batch of ~${formatNumber(Math.ceil(plannedQuantity / Math.max(1, calendarMetrics.count)))} pcs today. Successfully completing this batch reduces the open order balance toward scheduled delivery.`}
            </p>
          </div>

          {/* Card 3: Exact production targets and material usage requirements */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Package className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                3. Exact Production Targets & Material Usage Requirements
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {aiDailyAnalysis?.productionTargetsAndMaterials ||
                `Daily target quota is allocated across machines. Material inventory staging required: ${materials.length > 0 ? materials.map((m) => `${m.name} (${Number(m.quantity).toLocaleString()} ${m.unit})`).join(', ') : 'Standard Fabric Strips (1350mm) and Twin Adhesive Tape'} to prevent operator starvation.`}
            </p>
          </div>

          {/* Card 4: Line balancing, buffer allocation & risk advice */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Zap className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                4. Line Balancing, Buffer & Scrap Optimization
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {aiDailyAnalysis?.lineBalancingAndRisks ||
                'Maintain balanced feeder tensions between active stations. Pre-stage next batch material rolls before the 12:45 handover and 15:15 tea break to minimize line idle time and trim scrap.'}
            </p>
          </div>
        </div>
      </div>

      {/* 5. AI Planning Results & Detailed Schedule */}
      {plan ? (
        <div className="space-y-6">
          {/* Gemini AI Strategic Advisory Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Gemini AI Industrial Scheduling Guidance</span>
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono border ${
                    plan.bottleneckRisk === 'High'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : plan.bottleneckRisk === 'Medium'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  Bottleneck Risk: {plan.bottleneckRisk}
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Target: {formatNumber(plan.targetQty)} pcs
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              {plan.aiStrategySummary}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Target Line Pace
                </span>
                <span className="font-mono font-bold text-cyan-300 text-sm">
                  {plan.recommendedLineSpeed}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Daily Quota (Line Average)
                </span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatNumber(plan.averageDailyTarget)} pcs / day
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Shift Buffer Advisory
                </span>
                <span className="text-[11px] text-slate-300">
                  {plan.shiftBufferRecommendation}
                </span>
              </div>
            </div>
          </div>

          {/* Day-by-Day Master Breakdown Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Master Day-by-Day Production Output Targets
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {plan.scheduleDays?.length || 0} Working Schedule Dates
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Day #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Day</th>
                    <th className="py-3 px-3 text-right">Daily Total (pcs)</th>
                    {(plan.assignedMachines || []).map((m) => (
                      <th key={m.id} className="py-3 px-3 text-right">
                        {m.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(plan.scheduleDays || []).map((day) => (
                    <tr key={day.date} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-bold text-indigo-400">Day {day.dayNumber}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{day.date}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans">{day.dayName}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                        {formatNumber(day.totalDailyTarget)}
                      </td>
                      {(plan.assignedMachines || []).map((m) => {
                        const mPlan = (day.machinePlans || []).find(
                          (mp) => mp.machineId === m.id || mp.machineCode === m.code
                        );
                        return (
                          <td key={m.id} className="py-2.5 px-3 text-right text-slate-300">
                            {formatNumber(mPlan?.dailyTarget || 0)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Machine-Specific Hourly Breakdown Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Hourly Shift Slots Breakdown by Machine (10 Exact Shift Windows)
                </h3>
              </div>

              {/* Machine Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {(plan.assignedMachines || []).map((m) => {
                  const isSelected = activeTabMachine === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveTabMachine(m.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {m.name} ({m.code})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Machine Hourly Grid */}
            {selectedMachinePlan && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span>
                    Station: <strong className="text-white">{selectedMachinePlan.name}</strong> •{' '}
                    {selectedMachinePlan.type}
                  </span>
                  <span>
                    Operator: <strong className="text-indigo-400">{selectedMachinePlan.operatorName}</strong> • Rated:{' '}
                    {selectedMachinePlan.dailyTargetQty || 3000} pcs/day
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {PLANNING_TIME_SLOTS.map((slot, sIdx) => {
                    // Average pcs across all days for this slot
                    const slotTotal = (plan.scheduleDays || []).reduce((sum, d) => {
                      const mPlan = (d.machinePlans || []).find(
                        (mp) => mp.machineId === selectedMachinePlan.id || mp.machineCode === selectedMachinePlan.code
                      );
                      const target = (mPlan?.hourlySlots || []).find((s) => s.label === slot.label);
                      return sum + (target?.targetQty || 0);
                    }, 0);

                    const avgPerDay = Math.round(slotTotal / Math.max(1, plan.scheduleDays?.length || 1));

                    return (
                      <div
                        key={slot.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 shadow-sm hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Slot {sIdx + 1}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                            {slot.type}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-xs text-white">
                          {slot.label}
                        </div>
                        <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/80">
                          <span className="text-[10px] text-slate-400">Target Pace:</span>
                          <span className="font-mono font-extrabold text-sm text-indigo-400">
                            ~{avgPerDay.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">pcs</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 space-y-3">
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 w-fit mx-auto">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-base font-bold text-white">Ready to Generate AI Production Plan</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Select your order, choose start and end dates, and click <strong>"Generate AI Schedule"</strong>.
            Gemini will calculate the optimal machine-wise distribution and 10 hourly shift slot targets.
          </p>
        </div>
      )}
    </div>
  );
}
