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
        if (m.assignedStyles && m.assignedStyles.length > 0 && !selectedStyle) {
          const firstStyle =
            typeof m.assignedStyles[0] === 'string'
              ? m.assignedStyles[0]
              : m.assignedStyles[0]?.name || m.assignedStyles[0]?.code || 'Style';
          setSelectedStyle(firstStyle);
        }
        if (m.assignedColours && m.assignedColours.length > 0 && !selectedColour) {
          setSelectedColour(m.assignedColours[0]);
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
  const dryCutMultiplier = isDryCut ? (String(selectedSize).trim() === '16' ? 45 : 50) : 1;
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
      const payload = {
        machineId: machine.code || machine.id,
        style: selectedStyle,
        size: selectedSize,
        colour: selectedColour,
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

  return (
    <div className="max-w-xl mx-auto space-y-4 animate-fade-in pb-12">
      {/* Mobile Top App Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white tracking-tight">
                Floor Operator Portal
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                LIVE QR
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Station Sync • Direct Floor Entry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          )}

          <button
            onClick={onBackToDashboard}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Machine Identity Banner with Switcher */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs">
              {machine?.code || machineId}
            </span>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {machine?.category || 'Loop'} Division
            </span>
          </div>

          {/* Machine Switcher Dropdown */}
          <select
            value={machineId}
            onChange={(e) => {
              setMachineId(e.target.value);
              fetchMachineDetails(e.target.value);
            }}
            aria-label="Switch Machine"
            className="bg-slate-950 border border-slate-700 text-xs font-semibold rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {machinesList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code})
              </option>
            ))}
          </select>
        </div>

        {/* Machine Name & Header */}
        <div className="border-b border-slate-800/80 pb-3">
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            {machine?.name || 'Loading Station...'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {machine?.type || 'Manufacturing Station'} • Quota: {formatNumber(dailyTarget)} pcs/day
          </p>
        </div>

        {/* ======================================================= */}
        {/* 1. OPERATOR NAME SELECTION (From Admin Worker List)    */}
        {/* ======================================================= */}
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

        {/* ======================================================= */}
        {/* 2. AUTOMATIC SHIFT & TIME SLOT SELECTION               */}
        {/* ======================================================= */}
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

          {/* Shift Toggle Buttons: Day Shift vs Night Shift */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleShiftChange('Day Shift')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition border ${
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
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition border ${
                currentShift === 'Night Shift'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500 shadow-sm ring-1 ring-indigo-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Night Shift (21:30 - 07:30)</span>
            </button>
          </div>

          {/* Time Slot Selector Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1 text-[11px]">
              <span className="text-slate-400 font-semibold">Active Time Slot:</span>
              <span className="font-mono font-bold text-cyan-400">
                {selectedTimeSlot}
              </span>
            </div>

            <select
              value={selectedTimeSlot}
              onChange={(e) => handleSelectTimeSlot(e.target.value)}
              aria-label="Time Slot Selector"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {currentSlots.map((slot) => (
                <option key={slot.id} value={slot.label} className="bg-slate-900 text-white">
                  {slot.label} ({slot.display})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Slot Touch Pills (Horizontal Scrolling for Mobile) */}
          <div className="pt-1">
            <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">
              Tap to pick hour:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
              {currentSlots.map((slot) => {
                const isSelected = selectedTimeSlot === slot.label;
                return (
                  <button
                    type="button"
                    key={slot.id}
                    onClick={() => handleSelectTimeSlot(slot.label)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold whitespace-nowrap transition border ${
                      isSelected
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Real-Time Target Gauge / Calculator */}
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
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                targetAchieved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-500'
              }`}
              style={{ width: `${projectedProgress}%` }}
            ></div>
          </div>

          {/* Dynamic Real-Time Remaining Display */}
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

        {/* Success Banner on Batch Submission */}
        {successBanner && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between animate-bounce">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold">Production Batch Recorded!</div>
                <div className="text-[11px] text-emerald-400">
                  +{successBanner.qty} pcs of Size {successBanner.size} logged for Slot {successBanner.timeSlot} at {successBanner.time}
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-300">SYNCED</span>
          </div>
        )}

        {/* --- DATA ENTRY FORM (Prepopulated from Admin Setup) --- */}
        <form onSubmit={handleSubmitBatch} className="space-y-4 pt-1 text-xs">
          {/* 1. Style Selector (Prepopulated from Admin) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Assigned Style</span>
            </label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              required
              aria-label="Assigned Style Selector"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-blue-500"
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

          {/* 2. Colour Selector (Prepopulated from Admin) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              <span>Assigned Colour Set</span>
            </label>
            <select
              value={selectedColour}
              onChange={(e) => setSelectedColour(e.target.value)}
              required
              aria-label="Assigned Colour Selector"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-cyan-500"
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

          {/* 3. Size Selector (Prepopulated from Admin - Big Touch Buttons) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select Production Size</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Tap to select</span>
            </label>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
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
                    className={`py-3 rounded-2xl font-mono text-sm font-black border transition active:scale-95 text-center ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/40 ring-2 ring-emerald-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Produced Quantity Input */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{isDryCut ? 'Input Units (Dry Cut Multiplier Applies)' : 'Produced Quantity (Pieces)'}</span>
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
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center justify-between">
                <span className="font-semibold">⚡ Multiplier for Size {selectedSize}:</span>
                <span className="font-mono font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 text-amber-200">
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
              className="w-full bg-slate-950 border-2 border-slate-700 rounded-2xl px-4 py-3 text-white font-mono font-black text-lg focus:outline-none focus:border-blue-500 shadow-inner"
            />

            {/* Quick Increment Buttons for Touch Screen Operation */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[50, 100, 250, 500].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => handleQuickAdd(amt)}
                  className="py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 font-mono font-bold text-xs border border-slate-750 transition active:scale-95"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Floor Notes (Optional) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Floor Notes / Inspection Memo (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tension ok, yarn spool changed"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 6. Submit Button */}
          <button
            type="submit"
            disabled={submitting || !currentInputQty || !selectedSize}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Recording Batch...' : `Log ${currentInputQty > 0 ? formatNumber(currentInputQty) + ' pcs' : 'Batch'}`}</span>
          </button>
        </form>

        {/* Live Status Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Machine {machine?.code || machineId} Active</span>
          </div>
          <span>Shift: {currentShift}</span>
        </div>
      </div>
    </div>
  );
}
