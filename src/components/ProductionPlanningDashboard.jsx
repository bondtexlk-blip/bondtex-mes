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
  ChevronRight,
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
  Search,
  Filter,
  CheckCircle,
  Eye,
  Activity,
  ArrowUpRight,
  Flame,
  BarChart3,
  ListOrdered,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';
import { dbStore } from '../services/dbStore';
import {
  generateProductionPlanWithGemini,
  generateDailyAiAnalysisWithGemini,
  generateAdaptiveForecastWithGemini,
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

  // Embedded Production Table State
  const [tableCategory, setTableCategory] = useState('All'); // 'All' | 'Loop' | 'Strap'
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // AI Adaptive Forecast State
  const [aiAdaptiveForecast, setAiAdaptiveForecast] = useState(null);
  const [analyzingForecast, setAnalyzingForecast] = useState(false);

  // Standard Colour Swatch Mapping
  const COLOUR_SWATCH_MAP = {
    'Black 093 54A2': { bg: '#18181b', border: '#3f3f46', text: '#ffffff' },
    'Marzipan 39H6': { bg: '#d4a373', border: '#b5835a', text: '#18181b' },
    'Praline 65H8': { bg: '#bc6c25', border: '#9b561c', text: '#ffffff' },
    'Ganache 33F6': { bg: '#4a2c1d', border: '#331e13', text: '#ffffff' },
    'Talc 69-09-47 57H1': { bg: '#e7e5e4', border: '#d6d3d1', text: '#18181b' },
    'Optic White 001': { bg: '#f8fafc', border: '#cbd5e1', text: '#18181b' },
    'Navy Blue 042': { bg: '#1e3a8a', border: '#172554', text: '#ffffff' },
    'Olive Drab 88': { bg: '#3f4f2c', border: '#2e3a1f', text: '#ffffff' },
    'Steel Grey 55': { bg: '#64748b', border: '#475569', text: '#ffffff' },
  };

  const getSwatch = (col) => {
    if (!col) return { bg: '#475569', border: '#64748b', text: '#ffffff' };
    const lower = col.toLowerCase();
    for (const [key, val] of Object.entries(COLOUR_SWATCH_MAP)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        return val;
      }
    }
    return { bg: '#334155', border: '#475569', text: '#ffffff' };
  };

  // Helper to extract actual floor production output for a date from dbStore logs
  const getActualFloorOutputForDate = (dateStr, targetPo = '') => {
    try {
      const logs = dbStore.productionLogs || [];
      return logs
        .filter((l) => {
          const dMatch = (l.date || l.timestamp || '').slice(0, 10) === dateStr;
          const poMatch = !targetPo || l.poNumber === targetPo;
          return dMatch && poMatch;
        })
        .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    } catch {
      return 0;
    }
  };

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

  // Filtered Production Orders for Embedded Daily Production Table
  const filteredProductionOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      const matchesCat =
        tableCategory === 'All' ||
        (o.category && o.category.toLowerCase() === tableCategory.toLowerCase()) ||
        (tableCategory === 'Loop' && (o.style || '').toLowerCase().includes('loop')) ||
        (tableCategory === 'Strap' && (o.style || '').toLowerCase().includes('strap'));

      const q = tableSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (o.poNumber && o.poNumber.toLowerCase().includes(q)) ||
        (o.style && o.style.toLowerCase().includes(q)) ||
        (o.colour && o.colour.toLowerCase().includes(q)) ||
        (o.size && String(o.size).toLowerCase().includes(q)) ||
        (o.rmMaterial && o.rmMaterial.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });
  }, [orders, tableCategory, tableSearchQuery]);

  // Continuous Chronologically Ordered Date-Wise Schedule Breakdown
  const continuousDateSchedule = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    const days = [];
    const curr = new Date(start);
    let dayCounter = 1;
    let runningPlannedSum = 0;
    let runningActualSum = 0;

    const planMap = new Map();
    if (plan && Array.isArray(plan.scheduleDays)) {
      plan.scheduleDays.forEach((sd) => {
        planMap.set(sd.date, sd);
      });
    }

    const effectiveWorkingDays = Math.max(1, calendarMetrics.count);
    const baseDailyTarget = Math.ceil(plannedQuantity / effectiveWorkingDays);

    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getDay(); // 0: Sun, 6: Sat
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek];

      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;
      const holidayMatch = DEFAULT_HOLIDAYS_2026.find((h) => h.date === dateStr);

      let isWorkingDay = true;
      let nonWorkingReason = '';

      if (holidayMatch) {
        isWorkingDay = false;
        nonWorkingReason = holidayMatch.name;
      } else if (isSunday && !includeSundays) {
        isWorkingDay = false;
        nonWorkingReason = 'Sunday (Factory Rest Day)';
      } else if (isSaturday && !includeSaturdays) {
        isWorkingDay = false;
        nonWorkingReason = 'Saturday (Weekend Off)';
      }

      let plannedTarget = 0;
      let machineAllocations = [];
      const planDay = planMap.get(dateStr);

      if (isWorkingDay) {
        if (planDay && planDay.totalDailyTarget > 0) {
          plannedTarget = planDay.totalDailyTarget;
          machineAllocations = planDay.machineDailyPlans || planDay.machinePlans || [];
        } else {
          plannedTarget = baseDailyTarget;
          const assignedM = (plan?.assignedMachines || machines.slice(0, 2));
          const perM = Math.round(plannedTarget / Math.max(1, assignedM.length));
          machineAllocations = assignedM.map((m) => ({
            machineId: m.id,
            machineCode: m.code,
            machineName: m.name,
            dailyTarget: perM,
          }));
        }
        runningPlannedSum += plannedTarget;
      }

      // Check actual floor production logged for this date
      const actualProduced = getActualFloorOutputForDate(dateStr, selectedOrder?.poNumber);
      const isPastOrToday = dateStr <= todayStr;
      if (isPastOrToday && isWorkingDay) {
        runningActualSum += actualProduced;
      }

      const variance = isPastOrToday && isWorkingDay ? actualProduced - plannedTarget : 0;
      let status = 'Upcoming';
      if (!isWorkingDay) {
        status = 'Non-Working Day';
      } else if (isPastOrToday) {
        if (actualProduced >= plannedTarget) {
          status = 'Achieved / Surplus';
        } else {
          status = 'Deficit / Shortfall';
        }
      }

      days.push({
        date: dateStr,
        dayNumber: isWorkingDay ? dayCounter++ : null,
        dayName,
        isWorkingDay,
        nonWorkingReason,
        isPastOrToday,
        plannedTarget,
        actualProduced,
        variance,
        status,
        machineAllocations,
        cumulativePlanned: runningPlannedSum,
        cumulativeActual: runningActualSum,
        itemStyle: selectedOrder?.style || plan?.orderStyle || 'Loop Elastic Band - 54A2',
        itemColour: selectedOrder?.colour || plan?.orderColour || 'Standard',
        itemSize: selectedOrder?.size || plan?.orderSize || '12',
        poNumber: selectedOrder?.poNumber || plan?.orderPoNumber || '4502991562',
      });

      curr.setDate(curr.getDate() + 1);
    }

    return days;
  }, [startDate, endDate, calendarMetrics, plannedQuantity, plan, selectedOrder, machines, includeSaturdays, includeSundays, todayStr]);

  // Overall Adaptive Metrics for Dynamic AI Progress Tracking
  const adaptiveMetrics = useMemo(() => {
    const pastWorkingDays = continuousDateSchedule.filter((d) => d.isPastOrToday && d.isWorkingDay);
    const totalPlannedSoFar = pastWorkingDays.reduce((sum, d) => sum + d.plannedTarget, 0);
    const totalActualSoFar = pastWorkingDays.reduce((sum, d) => sum + d.actualProduced, 0);
    const netVarianceSoFar = totalActualSoFar - totalPlannedSoFar;

    const remainingFutureWorkingDays = continuousDateSchedule.filter((d) => !d.isPastOrToday && d.isWorkingDay).length || 1;
    const balanceRemainingToProduce = Math.max(0, (plannedQuantity || selectedOrder?.orderQty || 10000) - totalActualSoFar);
    const recalibratedDailyTarget = Math.ceil(balanceRemainingToProduce / remainingFutureWorkingDays);

    return {
      totalPlannedSoFar,
      totalActualSoFar,
      netVarianceSoFar,
      remainingFutureWorkingDays,
      balanceRemainingToProduce,
      recalibratedDailyTarget,
      achievementRate: totalPlannedSoFar > 0 ? Math.round((totalActualSoFar / totalPlannedSoFar) * 100) : 100,
    };
  }, [continuousDateSchedule, plannedQuantity, selectedOrder]);

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

  // Run AI Adaptive Forecast Handler
  const handleRunAdaptiveForecast = async () => {
    if (!selectedOrder) {
      if (onShowToast) onShowToast('Please select an order first', 'error');
      return;
    }
    try {
      setAnalyzingForecast(true);
      const forecast = await generateAdaptiveForecastWithGemini({
        order: selectedOrder,
        plan,
        dailyProgressRecords: continuousDateSchedule,
        netVariance: adaptiveMetrics.netVarianceSoFar,
        remainingDaysCount: adaptiveMetrics.remainingFutureWorkingDays,
        balanceRemaining: adaptiveMetrics.balanceRemainingToProduce,
      });
      setAiAdaptiveForecast(forecast);
      if (onShowToast) onShowToast('Dynamic AI Adaptive Forecast recalibrated!', 'success');
    } catch (err) {
      console.error('Failed to run adaptive forecast:', err);
      if (onShowToast) onShowToast('Forecast error: ' + err.message, 'error');
    } finally {
      setAnalyzingForecast(false);
    }
  };

  // Handle row selection from Embedded Production Table
  const handleSelectOrderForPlanning = (o) => {
    if (!o) return;
    setSelectedOrderId(o.id);
    const timelineEl = document.getElementById('planning-timeline-section');
    if (timelineEl) {
      timelineEl.scrollIntoView({ behavior: 'smooth' });
    }
    if (onShowToast) {
      onShowToast(`Selected PO #${o.poNumber} (${o.colour} Sz ${o.size}) for planning!`);
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
        adaptiveForecast: aiAdaptiveForecast,
        continuousDates: continuousDateSchedule,
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
      <div id="planning-timeline-section" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
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

      {/* 3. EMBEDDED PRODUCTION DATA TABLE (Daily Production & Quota Status) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-tight uppercase tracking-wider">
                  3. Daily Production & Quota Status
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  Floor Master Data
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete production orders, style details, colours, loop floor output, deliveries, and remaining balances
              </p>
            </div>
          </div>

          {/* Table Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Pills */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              {['All', 'Loop', 'Strap'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTableCategory(cat)}
                  className={`px-3 py-1 rounded-lg transition ${
                    tableCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO, style, colour..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-white font-medium text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-slate-950 text-slate-400 border border-slate-800">
              {filteredProductionOrders.length} lines
            </span>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Production / Style Name</th>
                <th className="py-3 px-3">Colour</th>
                <th className="py-3 px-3 text-center">Size</th>
                <th className="py-3 px-4 text-right">Order Qty</th>
                <th className="py-3 px-4 text-right">Floor Production Qty</th>
                <th className="py-3 px-4 text-right">Production Qty</th>
                <th className="py-3 px-4 text-right">Balance Qty</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredProductionOrders.length > 0 ? (
                filteredProductionOrders.map((row) => {
                  const isCurrent = selectedOrderId === row.id;
                  const progress =
                    row.orderQty > 0
                      ? Math.min(100, Math.round(((Number(row.productionQty) || 0) / Number(row.orderQty)) * 100))
                      : 0;

                  return (
                    <tr
                      key={row.id}
                      className={`transition ${
                        isCurrent
                          ? 'bg-indigo-950/40 border-l-4 border-l-indigo-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Style & PO */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs">
                            PO {row.poNumber}
                          </span>
                          {row.rmMaterial && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] border border-slate-700">
                              {row.rmMaterial}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                          {row.style || 'Loop Elastic Band'}
                        </div>
                      </td>

                      {/* Colour */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: getSwatch(row.colour) }}
                          />
                          <span className="truncate max-w-[130px]">{row.colour || 'Standard'}</span>
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-mono text-xs font-black border border-slate-700">
                          {row.size}
                        </span>
                      </td>

                      {/* Order Qty */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-100 text-xs">
                        {formatNumber(row.orderQty)}
                      </td>

                      {/* Floor Production Qty (Loop Insert Machine output) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-cyan-300 text-xs">
                          {formatNumber(row.floorProductionQty || 0)}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">Loop Floor</div>
                      </td>

                      {/* Production Qty (Delivery with progress bar) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div>
                          <span className="font-mono font-bold text-emerald-400 text-xs">
                            {formatNumber(row.productionQty)}
                          </span>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden inline-block">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{progress}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Balance Qty */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-xs">
                        <span
                          className={
                            row.balanceQty <= 0
                              ? 'text-emerald-400'
                              : row.balanceQty < (row.orderQty || 1000) * 0.2
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }
                        >
                          {formatNumber(row.balanceQty)}
                        </span>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {row.balanceQty <= 0 ? 'Completed' : 'Remaining'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            row.status === 'Completed'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {row.status || 'Active'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSelectOrderForPlanning(row)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 ring-1 ring-indigo-400'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                          }`}
                          title="Select this order line for AI planning"
                        >
                          {isCurrent ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-cyan-300" />
                              <span>Planning</span>
                            </>
                          ) : (
                            <>
                              <span>Plan This Order</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="py-6 text-center text-xs text-slate-400">
                    No production orders found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. CONTINUOUS DATE-WISE DAILY SCHEDULE BREAKDOWN */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-tight uppercase tracking-wider">
                  4. Continuous Date-Wise Daily Schedule Breakdown
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Chronological Horizon
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Every sequential calendar date with exact style, colour, size, daily target pcs, machine allocations, and floor variance
              </p>
            </div>
          </div>

          {/* Horizon Badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono">
              Horizon: <strong className="text-white">{startDate}</strong> to <strong className="text-white">{endDate}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
              {calendarMetrics.count} Working Days
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold font-mono">
              {calendarMetrics.offDays} Off Days
            </span>
          </div>
        </div>

        {/* Date Schedule Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Day #</th>
                <th className="py-3 px-3">Calendar Date</th>
                <th className="py-3 px-3">Calendar Status</th>
                <th className="py-3 px-3">Item / Style</th>
                <th className="py-3 px-3">Colour & Size</th>
                <th className="py-3 px-4 text-right">Daily Target (pcs)</th>
                <th className="py-3 px-4 text-left">Machine Allocations</th>
                <th className="py-3 px-4 text-right">Floor Actual</th>
                <th className="py-3 px-4 text-right">Variance</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {continuousDateSchedule.length > 0 ? (
                continuousDateSchedule.map((d) => {
                  const isToday = d.date === todayStr;
                  const isSelectedForAnalysis = selectedAnalysisDate === d.date;

                  return (
                    <tr
                      key={d.date}
                      className={`transition ${
                        isSelectedForAnalysis
                          ? 'bg-cyan-950/40 border-l-4 border-l-cyan-400'
                          : !d.isWorkingDay
                          ? 'bg-slate-950/50 text-slate-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Day # */}
                      <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                        {d.isWorkingDay ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px]">
                            Day {d.dayNumber}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[11px]">
                            Off
                          </span>
                        )}
                      </td>

                      {/* Date & Day */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white text-xs">{d.date}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{d.dayName}</div>
                      </td>

                      {/* Operational Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {d.isWorkingDay ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Working Day</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold text-[10px] border border-rose-500/30">
                            <span>{d.nonWorkingReason || 'Factory Rest Day'}</span>
                          </span>
                        )}
                      </td>

                      {/* Item Style & PO */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-white text-xs">
                          PO {d.poNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {d.itemStyle}
                        </div>
                      </td>

                      {/* Colour & Size */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: getSwatch(d.itemColour) }}
                          />
                          <span className="font-medium text-slate-200 text-xs">
                            {d.itemColour}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono text-[10px] font-bold border border-slate-700 ml-1">
                            Sz {d.itemSize}
                          </span>
                        </div>
                      </td>

                      {/* Daily Target Qty */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-mono font-black text-white text-xs">
                          {d.isWorkingDay ? formatNumber(d.plannedTarget) : '-'}
                        </span>
                        {d.isWorkingDay && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Cumul: {formatNumber(d.cumulativePlanned)}
                          </div>
                        )}
                      </td>

                      {/* Machine Allocation Breakdown */}
                      <td className="py-3 px-4">
                        {d.isWorkingDay && d.machineAllocations?.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {d.machineAllocations.map((m, mIdx) => (
                              <span
                                key={m.machineId || mIdx}
                                className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 font-mono text-[10px] border border-slate-800"
                              >
                                {m.machineCode || `M${mIdx + 1}`}:{' '}
                                <strong className="text-cyan-300">
                                  {formatNumber(m.dailyTarget || 0)}
                                </strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Floor Actual Output */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {d.isWorkingDay && d.isPastOrToday ? (
                          <span className="font-mono font-bold text-cyan-300 text-xs">
                            {formatNumber(d.actualProduced)} pcs
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Daily Variance */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {d.isWorkingDay && d.isPastOrToday ? (
                          <span
                            className={`font-mono font-bold text-xs ${
                              d.variance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {d.variance >= 0 ? `+${formatNumber(d.variance)}` : formatNumber(d.variance)}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Action: Select Date for Material Input & AI Analysis */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAnalysisDate(d.date);
                            const matEl = document.getElementById('manual-material-section');
                            if (matEl) {
                              matEl.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            isSelectedForAnalysis
                              ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400 font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                          }`}
                          title="Stage materials and view AI analysis for this date"
                        >
                          {isSelectedForAnalysis ? 'Active Day' : 'Stage Materials'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="py-6 text-center text-xs text-slate-400">
                    No dates in range. Please adjust start and end date above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. DYNAMIC AI DAILY ANALYSIS & ADAPTIVE FORECASTING */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-inner">
              <TrendingUp className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-tight uppercase tracking-wider">
                  5. Dynamic AI Daily Analysis & Forecasting
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Gemini Adaptive Pace Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Compares actual floor output against calculated targets, detects deficits/surpluses, and dynamically adjusts upcoming daily quotas
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={analyzingForecast}
            onClick={handleRunAdaptiveForecast}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-950/50 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzingForecast ? 'animate-spin' : ''}`} />
            <span>{analyzingForecast ? 'Recalibrating AI Pace...' : 'Recalibrate AI Forecast'}</span>
          </button>
        </div>

        {/* 4 Adaptive KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Cumulative Planned */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Cumulative Planned to Date
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-black text-xl text-white">
                {formatNumber(adaptiveMetrics.totalPlannedSoFar)}
              </span>
              <span className="text-xs text-slate-400">pcs</span>
            </div>
            <p className="text-[11px] text-slate-500">Scheduled quota for past & current working days</p>
          </div>

          {/* Card 2: Actual Floor Output */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Actual Floor Output
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-black text-xl text-cyan-300">
                {formatNumber(adaptiveMetrics.totalActualSoFar)}
              </span>
              <span className="text-xs text-slate-400">pcs</span>
            </div>
            <p className="text-[11px] text-slate-500">Verified QR machine entries from factory floor</p>
          </div>

          {/* Card 3: Net Variance */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Net Floor Variance
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`font-mono font-black text-xl ${
                  adaptiveMetrics.netVarianceSoFar >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {adaptiveMetrics.netVarianceSoFar >= 0 ? '+' : ''}
                {formatNumber(adaptiveMetrics.netVarianceSoFar)}
              </span>
              <span className="text-xs text-slate-400">pcs</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[10px] font-bold px-2 py-0.2 rounded-full font-mono border ${
                  adaptiveMetrics.netVarianceSoFar >= 0
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {adaptiveMetrics.netVarianceSoFar >= 0 ? 'Surplus Ahead' : 'Deficit Shortfall'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ({adaptiveMetrics.achievementRate}%)
              </span>
            </div>
          </div>

          {/* Card 4: Recalibrated Daily Target */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-1">
            <span className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider block">
              Recalibrated Daily Target
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-black text-xl text-amber-300">
                {formatNumber(adaptiveMetrics.recalibratedDailyTarget)}
              </span>
              <span className="text-xs text-slate-400">pcs / day</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Across {adaptiveMetrics.remainingFutureWorkingDays} remaining days to finish {formatNumber(adaptiveMetrics.balanceRemainingToProduce)} pcs
            </p>
          </div>
        </div>

        {/* Gemini AI Dynamic Pace & Deficit Recovery Panel */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Gemini AI Adaptive Pace & Recovery Guidance
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono border ${
                  (aiAdaptiveForecast?.paceStatus || '').includes('Ahead') || (aiAdaptiveForecast?.paceStatus || '').includes('On Track')
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                Pace Status: {aiAdaptiveForecast?.paceStatus || (adaptiveMetrics.netVarianceSoFar >= 0 ? 'Ahead of Schedule' : 'Pace Deficit')}
              </span>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-800/40 px-2 py-0.5 rounded">
                Adjusted Target: {aiAdaptiveForecast?.adjustedUpcomingDailyTarget || adaptiveMetrics.recalibratedDailyTarget} pcs/day
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {aiAdaptiveForecast?.deficitSurplusDiagnosis ||
              (adaptiveMetrics.netVarianceSoFar >= 0
                ? `Production floor is operating at a net surplus (+${formatNumber(adaptiveMetrics.netVarianceSoFar)} pcs). Maintain current machine feeds and shift quotas.`
                : `A cumulative deficit of ${formatNumber(Math.abs(adaptiveMetrics.netVarianceSoFar))} pcs has been identified against scheduled milestones. Upcoming daily quota recalibrated to ${formatNumber(adaptiveMetrics.recalibratedDailyTarget)} pcs/day across the remaining ${adaptiveMetrics.remainingFutureWorkingDays} working days to ensure on-time order completion.`)}
          </p>

          {aiAdaptiveForecast?.actionableRecoverySteps?.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Recommended Corrective Actions:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {aiAdaptiveForecast.actionableRecoverySteps.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-start gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. MANUAL MATERIAL & INVENTORY INPUT SECTION */}
      <div id="manual-material-section" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  6. Manual Material & Inventory Input
                </h3>
                {selectedAnalysisDate && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Staging for {selectedAnalysisDate}
                  </span>
                )}
              </div>
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

      {/* 7. AI-DRIVEN DAILY PRODUCTION & MATERIAL ANALYSIS CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>7. Gemini AI Daily Production & Material Analysis</span>
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

      {/* 8. AI Planning Results & Detailed Schedule */}
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
