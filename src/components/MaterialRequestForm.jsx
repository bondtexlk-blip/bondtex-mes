import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Send,
  Sparkles,
  Smartphone,
  Layers,
  RotateCcw,
  ShieldCheck,
  User,
  Hash,
  FileText,
  MapPin,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';
import { api } from '../api/client';

const CYCLE_OPTIONS = [
  '08:00 - 10:00 (Cycle 1)',
  '10:00 - 12:00 (Cycle 2)',
  '12:30 - 14:30 (Cycle 3)',
  '14:30 - 16:30 (Cycle 4)',
  '17:00 - 19:00 (Cycle 5)',
  '19:30 - 21:30 (OT Cycle)',
];

const DEPARTMENT_OPTIONS = [
  'Strap Section Loom Line 1',
  'Strap Section Loom Line 2',
  'Loop Assembly Station 1',
  'Loop Assembly Station 2',
  'Packing Line 1',
  'T-Shirt Bonding Line',
  'Elastic Knitting Bay',
  'Other Section',
];

const MACHINE_OPTIONS = [
  'MCH-01',
  'MCH-02',
  'MCH-03',
  'MCH-04',
  'MCH-05',
  'MCH-06',
  'Station-General',
];

export default function MaterialRequestForm({
  onBackToDashboard,
  onShowToast,
  isRestrictedMode = false,
  initialItemId = '',
  theme = 'dark',
  onToggleTheme,
}) {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);

  // Form Fields
  const [selectedItemId, setSelectedItemId] = useState(initialItemId || '');
  const [requestedQty, setRequestedQty] = useState('');
  const [productionCycle, setProductionCycle] = useState(CYCLE_OPTIONS[1]);
  const [requesterName, setRequesterName] = useState(() => {
    try {
      return localStorage.getItem('bondtex_last_requester_name') || '';
    } catch {
      return '';
    }
  });
  const [requesterEmpId, setRequesterEmpId] = useState(() => {
    try {
      return localStorage.getItem('bondtex_last_requester_empid') || '';
    } catch {
      return '';
    }
  });
  const [department, setDepartment] = useState(DEPARTMENT_OPTIONS[0]);
  const [machineCode, setMachineCode] = useState(MACHINE_OPTIONS[0]);
  const [poNumber, setPoNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load Inventory Items for selection
  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await api.getInventoryItems();
      if (res && res.items) {
        setInventoryItems(res.items);
        if (!selectedItemId && res.items.length > 0) {
          // Preselect first or matching item
          if (initialItemId) {
            const match = res.items.find((i) => i.id === initialItemId || i.code === initialItemId);
            if (match) setSelectedItemId(match.id);
            else setSelectedItemId(res.items[0].id);
          } else {
            setSelectedItemId(res.items[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load inventory items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    const unsub = api.subscribe(() => {
      loadItems();
    });
    return unsub;
  }, []);

  const selectedItem = inventoryItems.find((i) => i.id === selectedItemId);

  // Handle Quick Qty Add
  const handleAddQty = (amount) => {
    const current = Number(requestedQty) || 0;
    setRequestedQty(String(current + amount));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedItemId) {
      setErrorMessage('Please select a raw material from the store list.');
      return;
    }

    const qty = Number(requestedQty);
    if (!qty || qty <= 0) {
      setErrorMessage('Please enter a valid requested quantity greater than 0.');
      return;
    }

    if (!requesterName.trim()) {
      setErrorMessage('Please enter the requester name.');
      return;
    }

    try {
      setSubmitting(true);
      // Persist requester info for fast future requests
      try {
        localStorage.setItem('bondtex_last_requester_name', requesterName.trim());
        if (requesterEmpId) localStorage.setItem('bondtex_last_requester_empid', requesterEmpId.trim());
      } catch {}

      const payload = {
        itemId: selectedItemId,
        itemCode: selectedItem?.code || '',
        requestedQty: qty,
        productionCycle,
        requesterName: requesterName.trim(),
        requesterEmpId: requesterEmpId.trim(),
        department,
        machineCode,
        poNumber: poNumber.trim(),
        purpose: purpose.trim() || `Material request for ${productionCycle}`,
      };

      const res = await api.createMaterialRequest(payload);
      if (res.success && res.data) {
        setSubmittedRequest(res.data);
        if (onShowToast) {
          onShowToast(`Material Request #${res.data.id} submitted for Storekeeper Approval!`);
        }
      } else {
        setErrorMessage(res.message || 'Failed to submit request.');
      }
    } catch (err) {
      console.error('Failed to create material request:', err);
      setErrorMessage(err.message || 'Error submitting material request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedRequest(null);
    setRequestedQty('');
    setPurpose('');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Mobile Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition active:scale-95"
                title="Back to MES Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-emerald-500/20">
                B
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span>Material Request</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                    QR Floor Form
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400">2-Hour Production Cycle Requisition</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
              </button>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] hidden sm:inline">Store Connected</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-xl mx-auto w-full flex flex-col justify-center">
        {submittedRequest ? (
          /* SUCCESS CONFIRMATION VIEW */
          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                Awaiting Storekeeper Approval
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Request #{submittedRequest.id} Submitted!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Your material request has entered the storekeeper pending queue. Under strict store logic, inventory will be deducted automatically once approved.
              </p>
            </div>

            {/* Request Summary Card */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Material Requested:</span>
                <span className="font-bold text-white text-right">{submittedRequest.itemName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Requested Quantity:</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  {submittedRequest.requestedQty?.toLocaleString()} {submittedRequest.unit}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Production Cycle:</span>
                <span className="font-semibold text-cyan-300">{submittedRequest.productionCycle}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Requester:</span>
                <span className="font-semibold text-slate-200">
                  {submittedRequest.requesterName} {submittedRequest.requesterEmpId ? `(${submittedRequest.requesterEmpId})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Department / Machine:</span>
                <span className="font-semibold text-slate-300">
                  {submittedRequest.department} / {submittedRequest.machineCode}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-400">Time Submitted:</span>
                <span className="font-mono text-slate-400">
                  {new Date(submittedRequest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Submit Another Request</span>
              </button>
              {onBackToDashboard && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700/80 transition active:scale-95"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
          </div>
        ) : (
          /* MATERIAL REQUEST INPUT FORM */
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 animate-fade-in"
          >
            {/* Form Header info */}
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Boxes className="w-4 h-4" />
                <span>Raw Material Requisition</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Floor Material Request
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Submit raw material requirements for your 2-hour production cycle.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Raw Material Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Select Raw Material:</span>
                {selectedItem && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      selectedItem.currentStock <= 0
                        ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                        : selectedItem.currentStock <= selectedItem.reorderLevel
                        ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    }`}
                  >
                    Store Balance: {selectedItem.currentStock?.toLocaleString()} {selectedItem.unit}
                  </span>
                )}
              </label>

              <div className="relative">
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 appearance-none pr-10"
                >
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.name} — Avail: {item.currentStock?.toLocaleString()} {item.unit}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {selectedItem && (
                <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                  <span>Code: <span className="font-mono text-cyan-300">{selectedItem.code}</span></span>
                  <span>Location: <span className="text-slate-300">{selectedItem.location || 'Warehouse'}</span></span>
                </div>
              )}
            </div>

            {/* 2. Required Quantity for 2-Hour Cycle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Required Quantity (2-Hour Cycle):
                </label>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Unit: {selectedItem?.unit || 'Units'}
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={requestedQty}
                  onChange={(e) => setRequestedQty(e.target.value)}
                  placeholder={`Enter required quantity in ${selectedItem?.unit || 'units'}...`}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-base font-extrabold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Quick increment buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase mr-1">Quick:</span>
                {[10, 50, 100, 500].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleAddQty(num)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono font-bold border border-slate-700/80 transition active:scale-95"
                  >
                    +{num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRequestedQty('')}
                  className="ml-auto text-[10px] text-slate-400 hover:text-rose-400 underline"
                >
                  Clear
                </button>
              </div>

              {/* Warning if requested qty > stock */}
              {selectedItem && Number(requestedQty) > selectedItem.currentStock && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Requested quantity exceeds available store balance ({selectedItem.currentStock} {selectedItem.unit}). Storekeeper approval required.</span>
                </p>
              )}
            </div>

            {/* 3. Production Cycle Slot */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>2-Hour Production Cycle:</span>
              </label>
              <select
                value={productionCycle}
                onChange={(e) => setProductionCycle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-cyan-300 focus:outline-none focus:border-cyan-500"
              >
                {CYCLE_OPTIONS.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {cycle}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Requester Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Requester Name:</span>
                </label>
                <input
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="e.g. Kamal Gunawardena"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>Employee ID (Optional):</span>
                </label>
                <input
                  type="text"
                  value={requesterEmpId}
                  onChange={(e) => setRequesterEmpId(e.target.value)}
                  placeholder="e.g. EMP-104"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 5. Department & Machine */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Production Section / Line:</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                >
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-slate-400" />
                  <span>Machine / Station:</span>
                </label>
                <select
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 font-mono"
                >
                  {MACHINE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 6. PO Number & Purpose (Optional) */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" />
                  <span>PO Number / Style Reference (Optional):</span>
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g. 4502991532 / Style B-902"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">
                  Purpose / Notes for Storekeeper (Optional):
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. High priority morning export run..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Strict Store Logic Reminder */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Storekeeper Strict Approval:</strong> Submitted requests remain in pending status until the storekeeper explicitly approves and issues the items.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-sm transition shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting Request...' : 'Submit 2-Hour Material Request'}</span>
            </button>
          </form>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="py-4 text-center text-[10px] text-slate-500 border-t border-slate-900">
        Bondtex MES v2.4 • Production Inventory & QR Requisition Workflow
      </footer>
    </div>
  );
}
