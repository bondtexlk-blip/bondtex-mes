import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Layers,
  Palette,
  Hash,
  Send,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Plus,
  Clock,
  User,
  Activity,
  History,
  ChevronDown,
  Sun,
  Moon,
  RotateCcw,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';
import {
  detectCurrentShift,
  detectCurrentTimeSlot,
  getSlotsForShift,
  DAY_SHIFT_SLOTS,
  NIGHT_SHIFT_SLOTS,
} from '../utils/timeSlots';

export default function WorkerPortal({
  initialMachineId = 'MCH-01',
  onBackToDashboard,
  isRestrictedMode = false,
  onUnlockDashboard,
  onShowToast,
  onDataUpdated,
  theme = 'dark',
  onToggleTheme,
}) {
  const [machineId, setMachineId] = useState(initialMachineId);
  const [machinesList, setMachinesList] = useState([]);
  const [machine, setMachine] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen Mode Handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Exit / Unlock Handler with Supervisor PIN Protection
  const handleExitClick = () => {
    if (isRestrictedMode) {
      const pin = window.prompt(
        '🔒 Restricted Factory Floor Mode:\nEnter Supervisor PIN to exit to management dashboard (PIN: 1234):'
      );
      if (pin === '1234' || pin === 'bondtex' || pin === 'admin') {
        try {
          window.history.replaceState({}, '', window.location.pathname);
        } catch {}
        if (onUnlockDashboard) onUnlockDashboard();
        else if (onBackToDashboard) onBackToDashboard();
        else window.location.href = window.location.pathname;
      } else if (pin !== null) {
        if (onShowToast) onShowToast('Incorrect Supervisor PIN', 'error');
      }
    } else {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
      if (onBackToDashboard) onBackToDashboard();
    }
  };

  // Shift & Time Slot State (Auto-detected from clock)
  const [currentShift, setCurrentShift] = useState(() => detectCurrentShift());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(() => detectCurrentTimeSlot());
  const [isAutoDetectedSlot, setIsAutoDetectedSlot] = useState(true);

  // Form State
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedColour, setSelectedColour] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [producedQty, setProducedQty] = useState('');
  const [notes, setNotes] = useState('');

  // Auto-resolve Style and PO Number based on colour in Loop production
  const resolveStyleAndPoForColour = (col) => {
    const c = (col || '').toLowerCase();
    if (c.includes('talc')) return { style: 'Loop Elastic Band - 57H1', poNumber: '4502991562' };
    if (c.includes('black')) return { style: 'Loop Elastic Band - 54A2', poNumber: '4502991550' };
    if (c.includes('marzipan')) return { style: 'Loop Elastic Band - 39H6', poNumber: '4502991532' };
    if (c.includes('praline')) return { style: 'Loop Elastic Band - 65H8', poNumber: '4502991599' };
    if (c.includes('ganache')) return { style: 'Loop Elastic Band - 33F6', poNumber: '4502991520' };
    return null;
  };

  const handleColourChange = (newColour) => {
    setSelectedColour(newColour);
    const resolved = resolveStyleAndPoForColour(newColour);
    if (resolved) {
      setSelectedStyle(resolved.style);
    }
  };

  // Audio Beep Feedback
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio might be muted
    }
  };

  // Keep clock-based slot in sync if user hasn't manually overridden
  useEffect(() => {
    const timer = setInterval(() => {
      if (isAutoDetectedSlot) {
        const autoShift = detectCurrentShift();
        const autoSlot = detectCurrentTimeSlot(new Date(), autoShift);
        setCurrentShift(autoShift);
        setSelectedTimeSlot(autoSlot);
      }
    }, 30000); // Check every 30s
    return () => clearInterval(timer);
  }, [isAutoDetectedSlot]);

  // Load Machine Details
  const fetchMachineDetails = async (idToFetch) => {
    try {
      setLoading(true);
      const [machineRes, allMachinesRes, workersRes] = await Promise.all([
        api.getMachineById(idToFetch || machineId),
        api.getMachines(),
        api.getWorkers().catch(() => ({ success: false })),
      ]);

      if (allMachinesRes.success) {
        setMachinesList(allMachinesRes.data || []);
      }

      if (workersRes.success && workersRes.data) {
        setWorkers(workersRes.data);
      }

      if (machineRes.success && machineRes.data) {
        const m = machineRes.data;
        setMachine(m);
        setMachineId(m.code || m.id);

        // Prepopulate operator
        if (!selectedOperator) {
          setSelectedOperator(m.operatorName || (workersRes?.data?.[0]?.name || 'Floor Worker'));
        }

        // Prepopulate first assigned style, colour, and size
        if (m.assignedColours && m.assignedColours.length > 0 && !selectedColour) {
          const initCol = m.assignedColours[0];
          setSelectedColour(initCol);
          const resolved = resolveStyleAndPoForColour(initCol);
          if (resolved) {
            setSelectedStyle(resolved.style);
          } else if (m.assignedStyles && m.assignedStyles.length > 0) {
            const firstStyle =
              typeof m.assignedStyles[0] === 'string'
                ? m.assignedStyles[0]
                : m.assignedStyles[0]?.name || m.assignedStyles[0]?.code || 'Style';
            setSelectedStyle(firstStyle);
          }
        } else if (m.assignedStyles && m.assignedStyles.length > 0 && !selectedStyle) {
          const firstStyle =
            typeof m.assignedStyles[0] === 'string'
              ? m.assignedStyles[0]
              : m.assignedStyles[0]?.name || m.assignedStyles[0]?.code || 'Style';
          setSelectedStyle(firstStyle);
        }
        if (m.assignedSizes && m.assignedSizes.length > 0 && !selectedSize) {
          setSelectedSize(m.assignedSizes[0]);
        }
      }
    } catch (err) {
      console.error('Error loading machine:', err);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachineDetails(initialMachineId);
    const unsubscribe = api.subscribe(() => {
      fetchMachineDetails(initialMachineId);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialMachineId]);

  // Handle Quick Add Quantity
  const handleQuickAdd = (amt) => {
    const current = parseInt(producedQty, 10) || 0;
    setProducedQty(String(current + amt));
  };

  // Switch Shift manually
  const handleShiftChange = (newShift) => {
    setCurrentShift(newShift);
    const slots = getSlotsForShift(newShift);
    if (slots.length > 0) {
      setSelectedTimeSlot(slots[0].label);
    }
    setIsAutoDetectedSlot(false);
  };

  // Select Slot manually
  const handleSelectTimeSlot = (slotLabel) => {
    setSelectedTimeSlot(slotLabel);
    setIsAutoDetectedSlot(false);
  };

  // Reset to auto-detected time slot
  const handleResetToCurrentTime = () => {
    const autoShift = detectCurrentShift();
    const autoSlot = detectCurrentTimeSlot(new Date(), autoShift);
    setCurrentShift(autoShift);
    setSelectedTimeSlot(autoSlot);
    setIsAutoDetectedSlot(true);
    if (onShowToast) onShowToast(`Reset to current window: ${autoSlot}`);
  };

  // Dry Cut Multiplier Calculation (Size 10,12,14,18 -> x50, Size 16 -> x45)
  const isDryCut =
    (machine?.name || '').toLowerCase().includes('dry cut') ||
    (machine?.code || '').toLowerCase().includes('dry');
  const getDryCutMultiplier = (sz) => {
    const s = String(sz || '').trim();
    if (s === '16') return 45;
    if (['10', '12', '14', '18'].includes(s)) return 50;
    return 50;
  };
  const dryCutMultiplier = isDryCut ? getDryCutMultiplier(selectedSize) : 1;
  const currentInputQty = parseInt(producedQty, 10) || 0;
  const effectiveBatchOutput = isDryCut ? currentInputQty * dryCutMultiplier : currentInputQty;

  // Live Target Calculations
  const dailyTarget = machine?.dailyTargetQty || 2500;
  const todayProducedBefore = machine?.todayProduced || 0;
  const projectedTotal = todayProducedBefore + effectiveBatchOutput;
  const projectedRemaining = Math.max(0, dailyTarget - projectedTotal);
  const targetAchieved = projectedTotal >= dailyTarget;
  const projectedProgress = dailyTarget > 0 ? Math.min(100, Math.round((projectedTotal / dailyTarget) * 100)) : 0;

  // Submit Handler
  const handleSubmitBatch = async (e) => {
    e.preventDefault();
    if (!currentInputQty || currentInputQty <= 0) {
      if (onShowToast) onShowToast('Please enter a valid produced quantity', 'error');
      return;
    }
    if (!selectedSize) {
      if (onShowToast) onShowToast('Please select a size', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const resolved = resolveStyleAndPoForColour(selectedColour);
      const effectivePo = resolved?.poNumber || '';
      const effectiveStyle = resolved?.style || selectedStyle;

      const payload = {
        machineId: machine.code || machine.id,
        style: effectiveStyle,
        size: selectedSize,
        colour: selectedColour,
        poNumber: effectivePo,
        producedQty: effectiveBatchOutput,
        rawQty: currentInputQty,
        multiplier: dryCutMultiplier,
        shift: currentShift,
        timeSlot: selectedTimeSlot,
        operatorName: selectedOperator || machine.operatorName || 'Floor Worker',
        notes: notes.trim(),
      };

      const res = await api.submitWorkerBatch(payload);
      if (res.success) {
        playBeep();
        setSuccessBanner({
          qty: effectiveBatchOutput,
          rawQty: currentInputQty,
          multiplier: dryCutMultiplier,
          isDryCut,
          size: selectedSize,
          timeSlot: selectedTimeSlot,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        setProducedQty('');
        setNotes('');

        // Refresh machine status & update management dashboard
        await fetchMachineDetails(machine.id);
        if (onDataUpdated) onDataUpdated();
        if (onShowToast) {
          const msg = isDryCut
            ? `Logged ${currentInputQty} units × ${dryCutMultiplier} = ${effectiveBatchOutput} pcs (${selectedTimeSlot})!`
            : `Logged ${effectiveBatchOutput} pcs (${selectedTimeSlot})!`;
          onShowToast(msg);
        }

        setTimeout(() => setSuccessBanner(null), 4000);
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const currentSlots = getSlotsForShift(currentShift);
  const todayMachineLogs = machine?.todayLogs || [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 animate-fade-in p-2 sm:p-4 lg:p-6 pb-12 flex-1 flex flex-col justify-start">
      {/* 1. Mobile/Tablet Top App Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 shrink-0">
            <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Floor Operator Portal
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                LIVE QR
              </span>
              {isRestrictedMode ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  RESTRICTED STATION
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  ADMIN LINK
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Station {machine?.code || machineId} • {machine?.name || 'Loading station...'} • Touch-Optimized Floor View
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition flex items-center gap-1.5 text-xs font-semibold"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter 100% Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          )}

          {/* Exit / Floor Unlock Button */}
          <button
            type="button"
            onClick={handleExitClick}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 transition flex items-center gap-1.5"
            title={isRestrictedMode ? 'Supervisor PIN required to exit floor station' : 'Exit to Main Dashboard'}
          >
            {isRestrictedMode ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : null}
            <span>{isRestrictedMode ? 'Supervisor Exit' : 'Exit'}</span>
          </button>
        </div>
      </div>

      {/* 2. Responsive 2-Column Floor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* ========================================================= */}
        {/* LEFT COLUMN: STATION IDENTITY, OPERATOR, SHIFT, QUOTA     */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-4 flex flex-col">
          {/* Machine Identity Banner */}
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-blue-600 text-white font-mono font-black text-xs shadow-md">
                  {machine?.code || machineId}
                </span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {machine?.category || 'Loop'} Division
                </span>
              </div>

              {/* Machine Switcher (Locked if floor restricted mode) */}
              {isRestrictedMode ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Station Locked</span>
                </div>
              ) : (
                <select
                  value={machineId}
                  onChange={(e) => {
                    setMachineId(e.target.value);
                    fetchMachineDetails(e.target.value);
                  }}
                  aria-label="Switch Machine"
                  className="bg-slate-950 border border-slate-700 text-xs font-semibold rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {machinesList.length === 0 ? (
                    <option value="">No Machines Registered</option>
                  ) : (
                    machinesList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Machine Name & Quota */}
            <div className="border-b border-slate-800/80 pb-3">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {machine?.name || (machinesList.length === 0 ? 'No Machines Configured' : 'Select Station')}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {machine?.type || 'Manufacturing Station'} • Quota: <strong className="text-slate-200">{formatNumber(dailyTarget)} pcs/day</strong>
              </p>
            </div>

            {/* Operator Selection */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Operator Name (Select Worker)</span>
                </label>
                <span className="text-[10px] text-blue-400 font-mono">
                  {workers.length} Registered
                </span>
              </div>

              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                aria-label="Floor Operator Selector"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-xs focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.name} className="bg-slate-900 text-white py-1">
                    {w.name} ({w.empId}) — {w.category} Division ({w.shift})
                  </option>
                ))}
                {machine?.operatorName && !workers.some((w) => w.name === machine.operatorName) && (
                  <option value={machine.operatorName} className="bg-slate-900 text-white py-1">
                    {machine.operatorName} (Machine Default)
                  </option>
                )}
              </select>
            </div>

            {/* Automatic Shift & Time Slot Selection */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Shift & Production Time Slot
                  </span>
                </div>

                {/* Auto-detected indicator / Reset */}
                <div className="flex items-center gap-1.5">
                  {isAutoDetectedSlot ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      AUTO CLOCK
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetToCurrentTime}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Auto Current
                    </button>
                  )}
                </div>
              </div>

              {/* Shift Toggle Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleShiftChange('Day Shift')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition border ${
                    currentShift === 'Day Shift'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm ring-1 ring-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Day Shift (07:45 - 21:30)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShiftChange('Night Shift')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition border ${
                    currentShift === 'Night Shift'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500 shadow-sm ring-1 ring-indigo-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Night Shift (21:30 - 07:30)</span>
                </button>
              </div>

              {/* Time Slot Touch Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                  <span className="text-slate-400 font-semibold">Active Window:</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {selectedTimeSlot}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                  {currentSlots.map((slot) => {
                    const isSelected = selectedTimeSlot === slot.label;
                    return (
                      <button
                        type="button"
                        key={slot.id}
                        onClick={() => handleSelectTimeSlot(slot.label)}
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold whitespace-nowrap transition border ${
                          isSelected
                            ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-300'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Dynamic Real-Time Target Gauge */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Today's Target Quota</span>
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {formatNumber(projectedTotal)} / {formatNumber(dailyTarget)} pcs
                </span>
              </div>

              {/* Progress Bar with Live Fill */}
              <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    targetAchieved
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                  }`}
                  style={{ width: `${projectedProgress}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Previously Produced</span>
                  <span className="font-mono font-bold text-slate-300">
                    {formatNumber(todayProducedBefore)} pcs
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase">
                    {targetAchieved ? 'Quota Exceeded' : 'Remaining To Target'}
                  </span>
                  <span
                    className={`text-sm font-mono font-extrabold ${
                      targetAchieved ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {targetAchieved
                      ? `+${formatNumber(projectedTotal - dailyTarget)} pcs bonus!`
                      : `${formatNumber(projectedRemaining)} pcs left`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: PRODUCTION ENTRY FORM (LARGE TOUCH PAD)     */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <Hash className="w-5 h-5 text-emerald-400" />
                  <span>Floor Production Batch Entry</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Select style, colour, size, and tap quantity to log batch directly into MES
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                STATION READY
              </span>
            </div>

            {/* Success Banner */}
            {successBanner && (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs flex items-center justify-between animate-bounce shadow-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-extrabold text-sm text-white">Batch Logged Successfully!</div>
                    <div className="text-xs text-emerald-300 mt-0.5">
                      +{formatNumber(successBanner.qty)} pcs of Size {successBanner.size} recorded for {successBanner.timeSlot} at {successBanner.time}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs font-black bg-emerald-500/20 px-3 py-1 rounded-xl border border-emerald-500/40 text-emerald-200">
                  MES SYNCED
                </span>
              </div>
            )}

            <form onSubmit={handleSubmitBatch} className="space-y-4 pt-1">
              {/* Style & Colour Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Style Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assigned Style</span>
                  </label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    required
                    aria-label="Assigned Style Selector"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-white font-bold text-xs focus:outline-none focus:border-blue-500"
                  >
                    {(machine?.assignedStyles && machine.assignedStyles.length > 0
                      ? machine.assignedStyles
                      : ['Loop Elastic Band - 54A2']
                    ).map((st) => {
                      const sName = typeof st === 'string' ? st : (st?.name || st?.code || 'Style');
                      return (
                        <option key={sName} value={sName}>
                          {sName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 2. Colour Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Assigned Colour Set</span>
                  </label>
                  <select
                    value={selectedColour}
                    onChange={(e) => handleColourChange(e.target.value)}
                    required
                    aria-label="Assigned Colour Selector"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-white font-bold text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {(machine?.assignedColours && machine.assignedColours.length > 0
                      ? machine.assignedColours
                      : ['Black 093 54A2']
                    ).map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Size Selector - Large Touch Buttons */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Select Production Size:</span>
                  </span>
                  <span className="text-xs text-emerald-400 font-mono font-bold">
                    {selectedSize ? `Selected: Size ${selectedSize}` : 'Please tap a size'}
                  </span>
                </label>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                  {(machine?.assignedSizes && machine.assignedSizes.length > 0
                    ? machine.assignedSizes
                    : ['10', '12', '14', '16']
                  ).map((sz) => {
                    const isSelected = selectedSize === sz;
                    return (
                      <button
                        type="button"
                        key={sz}
                        onClick={() => setSelectedSize(sz)}
                        className={`py-3.5 sm:py-4 rounded-2xl font-mono text-base sm:text-lg font-black border transition active:scale-95 text-center ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-xl shadow-emerald-600/40 ring-2 ring-emerald-300'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Produced Quantity Input */}
              <div className="space-y-2 pt-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span>{isDryCut ? 'Input Units (Dry Cut Multiplier Applies)' : 'Produced Batch Quantity (Pieces):'}</span>
                  {currentInputQty > 0 && (
                    <span className="text-emerald-400 font-mono font-bold">
                      {isDryCut ? (
                        <span>
                          {currentInputQty} × {dryCutMultiplier} = <span className="text-cyan-300 font-black">+{formatNumber(effectiveBatchOutput)} pcs</span>
                        </span>
                      ) : (
                        <span>+{formatNumber(currentInputQty)} pcs</span>
                      )}
                    </span>
                  )}
                </label>

                {isDryCut && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                    <span className="font-semibold">⚡ Dry Cut Multiplier for Size {selectedSize || '-'}:</span>
                    <span className="font-mono font-bold bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-200">
                      ×{dryCutMultiplier} factor ({String(selectedSize).trim() === '16' ? 'Size 16 = x45' : 'Size 10-14, 18 = x50'})
                    </span>
                  </div>
                )}

                <input
                  type="number"
                  min="1"
                  value={producedQty}
                  onChange={(e) => setProducedQty(e.target.value)}
                  placeholder={isDryCut ? `Enter units (will be multiplied by ${dryCutMultiplier})` : 'Enter batch pieces (e.g. 500)'}
                  required
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl px-5 py-4 text-white font-mono font-black text-2xl sm:text-3xl focus:outline-none shadow-inner text-center sm:text-left"
                />

                {/* Touch Screen Quick Increments (+50, +100, +250, +500, +1000 for pcs, or units for Dry Cut) */}
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {(isDryCut ? [5, 10, 20, 50, 100] : [50, 100, 250, 500, 1000]).map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => handleQuickAdd(amt)}
                      className="py-2.5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono font-bold text-xs sm:text-sm border border-slate-700 transition active:scale-95 shadow-sm"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Floor Notes (Optional) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Floor Notes / Quality Memo (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Tension ok, yarn spool changed"
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 6. Big Action Submit Button */}
              <button
                type="submit"
                disabled={submitting || !currentInputQty || !selectedSize}
                className="w-full h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-base sm:text-lg shadow-2xl shadow-emerald-600/30 transition transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Syncing Floor Batch to Database...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>
                      {currentInputQty > 0
                        ? `Log Batch: +${formatNumber(effectiveBatchOutput)} pcs (Size ${selectedSize})`
                        : 'Log Production Batch'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 3. Bottom Section: Station's Recent Logged Batches Stream */}
      {todayMachineLogs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Today's Batch Logs for {machine?.name || machineId}</span>
            </h3>
            <span className="text-[11px] font-mono text-cyan-400">
              {todayMachineLogs.length} Batches Recorded
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Slot</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3 text-right">Qty (pcs)</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {todayMachineLogs.slice(0, 8).map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-slate-850/50">
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {log.time || log.timestamp?.split('T')[1]?.substring(0, 5)}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold whitespace-nowrap">
                      {log.timeSlot || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-white font-bold whitespace-nowrap">
                      Size {log.size}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-400 whitespace-nowrap">
                      +{formatNumber(log.qty)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans whitespace-nowrap">
                      {log.operator || log.operatorName || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans truncate max-w-xs">
                      {log.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
