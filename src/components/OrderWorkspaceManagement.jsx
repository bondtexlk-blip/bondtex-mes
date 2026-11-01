import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building,
  Sparkles,
  Calendar,
  Check,
  Search,
  ExternalLink,
  ChevronDown,
  Calculator,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber, formatDate } from '../utils/formatters';

export default function OrderWorkspaceManagement({
  onShowToast,
  onDataUpdated,
}) {
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State for "Option 1: Start New Order"
  const [buyerName, setBuyerName] = useState('');
  const [workspaceTitle, setWorkspaceTitle] = useState('');
  const [workspaceNotes, setWorkspaceNotes] = useState('');
  const [resetMode, setResetMode] = useState('zero_counts'); // 'zero_counts' | 'blank'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for "Option 2: Select Previous Order"
  const [selectedPreviousId, setSelectedPreviousId] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'create' | 'switch' | 'delete', targetId?: string, targetName?: string }

  // Load Workspaces Data
  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await api.getWorkspaces();
      if (res && res.success !== false) {
        setActiveWorkspace(res.activeWorkspace || null);
        setWorkspaces(res.workspaces || []);
        if (res.activeWorkspace?.id) {
          setSelectedPreviousId(res.activeWorkspace.id);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      onShowToast?.('Failed to load order workspaces', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
    const unsubscribe = api.subscribe(() => {
      loadWorkspaces();
    });
    return unsubscribe;
  }, []);

  // Action: Create New Order Workspace
  const handleCreateOrderWorkspace = async () => {
    if (!buyerName.trim()) {
      onShowToast?.('Please enter a Buyer Name to create a new order workspace', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createOrderWorkspace({
        buyerName: buyerName.trim(),
        workspaceName: workspaceTitle.trim(),
        notes: workspaceNotes.trim(),
        resetMode,
      });

      if (res && res.success !== false) {
        onShowToast?.(
          `New Order Workspace activated for "${buyerName.trim()}"! All counts reset to 0.`,
          'success'
        );
        // Reset form
        setBuyerName('');
        setWorkspaceTitle('');
        setWorkspaceNotes('');
        setConfirmDialog(null);
        await loadWorkspaces();
        if (onDataUpdated) onDataUpdated();
      } else {
        onShowToast?.(res?.message || 'Failed to create workspace', 'error');
      }
    } catch (err) {
      console.error('Create workspace error:', err);
      onShowToast?.(err.message || 'Error creating workspace', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Switch to Previous Order Workspace
  const handleSwitchWorkspace = async (targetId) => {
    const wsId = targetId || selectedPreviousId;
    if (!wsId) {
      onShowToast?.('Please select a previous order to load', 'error');
      return;
    }

    if (wsId === activeWorkspace?.id) {
      onShowToast?.('This order workspace is already active.', 'info');
      setConfirmDialog(null);
      return;
    }

    try {
      setIsSwitching(true);
      const res = await api.switchOrderWorkspace(wsId);
      if (res && res.success !== false) {
        onShowToast?.(
          `Loaded previous order workspace! Dashboard and metrics updated.`,
          'success'
        );
        setConfirmDialog(null);
        await loadWorkspaces();
        if (onDataUpdated) onDataUpdated();
      } else {
        onShowToast?.(res?.message || 'Failed to load order workspace', 'error');
      }
    } catch (err) {
      console.error('Switch workspace error:', err);
      onShowToast?.(err.message || 'Error switching workspace', 'error');
    } finally {
      setIsSwitching(false);
    }
  };

  // Action: Delete Archived Workspace
  const handleDeleteWorkspace = async (targetId) => {
    if (!targetId) return;
    try {
      const res = await api.deleteOrderWorkspace(targetId);
      if (res && res.success !== false) {
        onShowToast?.('Archived workspace deleted.', 'success');
        setConfirmDialog(null);
        await loadWorkspaces();
      } else {
        onShowToast?.(res?.message || 'Failed to delete workspace', 'error');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Error deleting workspace', 'error');
    }
  };

  // Action: Export Workspace Snapshot as JSON
  const handleExportWorkspaceJson = (ws) => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(ws, null, 2));
      const downloadAnchor = document.createElement('a');
      const safeBuyer = (ws.buyerName || 'Order').replace(/[^a-zA-Z0-9_-]/g, '_');
      const datePart = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `Bondtex_Order_${safeBuyer}_${datePart}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      onShowToast?.(`Exported JSON backup for "${ws.buyerName || ws.name}"`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      onShowToast?.('Failed to export order workspace', 'error');
    }
  };

  // Filtered list of previous workspaces
  const filteredWorkspaces = workspaces.filter((w) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (w.buyerName || '').toLowerCase().includes(q) ||
      (w.name || '').toLowerCase().includes(q) ||
      (w.notes || '').toLowerCase().includes(q) ||
      (w.id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. CURRENT ACTIVE GLOBAL WORKSPACE BANNER                      */}
      {/* ============================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Active Global Order
              </span>

              <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700">
                ID: {activeWorkspace?.id || 'ws_default'}
              </span>

              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Created {formatDate(activeWorkspace?.createdAt || new Date())}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0 shadow-inner">
                <Building className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {activeWorkspace?.buyerName || 'Primary Ground Truth Order'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  {activeWorkspace?.name || 'Factory Production Dataset'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              <strong className="text-slate-200">Global State Lock:</strong> Anyone opening the live Bondtex MES link (floor workers on QR mobile phones, line managers, and executive dashboards) will strictly see the production counts, orders, and daily metrics of this active workspace.
            </p>
          </div>

          {/* Quick Active Metrics Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-center p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Active Orders</span>
              <span className="text-base font-extrabold text-white font-mono">{activeWorkspace?.orderCount ?? 0}</span>
            </div>

            <div className="text-center p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Order Qty</span>
              <span className="text-base font-extrabold text-slate-100 font-mono">{formatNumber(activeWorkspace?.totalOrderQty ?? 0)}</span>
            </div>

            <div className="text-center p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">Production</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">{formatNumber(activeWorkspace?.totalProductionQty ?? 0)}</span>
            </div>

            <div className="text-center p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">Balance</span>
              <span className="text-base font-extrabold text-amber-400 font-mono">{formatNumber(activeWorkspace?.totalBalanceQty ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. DUAL ACTION GRID: OPTION 1 & OPTION 2                       */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ------------------------------------------------------------ */}
        {/* OPTION 1: CREATE NEW ORDER WORKSPACE (Left: 6 Cols)           */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <FolderPlus className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  Option 1
                </span>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Start New Order Workspace
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Safely archives the current order and resets all production counts & balances to ZERO.
              </p>
            </div>
          </div>

          {/* Form Inputs */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!buyerName.trim()) {
                onShowToast?.('Buyer Name is required', 'error');
                return;
              }
              setConfirmDialog({
                type: 'create',
                targetName: buyerName.trim(),
              });
            }}
            className="space-y-4"
          >
            {/* 1. Buyer Name (Required) */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>Buyer / Brand Name <span className="text-rose-400">*</span></span>
                <span className="text-[10px] text-slate-400">e.g. Marks & Spencer, Nike, Brandix</span>
              </label>
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Enter Buyer Name..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs font-medium placeholder-slate-500 outline-none transition"
              />
            </div>

            {/* 2. Order / Workspace Title (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>Order Title / Batch Code <span className="text-slate-500">(Optional)</span></span>
                <span className="text-[10px] text-slate-400">Defaults to "Order - [Buyer Name]"</span>
              </label>
              <input
                type="text"
                value={workspaceTitle}
                onChange={(e) => setWorkspaceTitle(e.target.value)}
                placeholder={buyerName.trim() ? `Order - ${buyerName.trim()}` : 'e.g. PO-BATCH-2026-M&S-Q4'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs font-medium placeholder-slate-500 outline-none transition"
              />
            </div>

            {/* 3. Reference Notes (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                <span>Production Notes / Style Range <span className="text-slate-500">(Optional)</span></span>
              </label>
              <input
                type="text"
                value={workspaceNotes}
                onChange={(e) => setWorkspaceNotes(e.target.value)}
                placeholder="e.g. Elastic Loop Insert run, Delivery scheduled for December"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs font-medium placeholder-slate-500 outline-none transition"
              />
            </div>

            {/* 4. Reset Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2">
                <span>Order Directory Initialization Setup</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  onClick={() => setResetMode('zero_counts')}
                  className={`cursor-pointer p-3 rounded-xl border transition ${
                    resetMode === 'zero_counts'
                      ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${resetMode === 'zero_counts' ? 'border-amber-400' : 'border-slate-600'}`}>
                      {resetMode === 'zero_counts' && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
                    </span>
                    <span>Zero All Counts</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Retains current PO catalog structure, but resets production, floor qty, and balances to <strong>0</strong>.
                  </p>
                </div>

                <div
                  onClick={() => setResetMode('blank')}
                  className={`cursor-pointer p-3 rounded-xl border transition ${
                    resetMode === 'blank'
                      ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${resetMode === 'blank' ? 'border-amber-400' : 'border-slate-600'}`}>
                      {resetMode === 'blank' && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
                    </span>
                    <span>Blank Order Table (0 Orders)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Starts completely fresh with 0 orders. Perfect for uploading a new buyer Excel/CSV sheet.
                  </p>
                </div>
              </div>
            </div>

            {/* Safe Archive Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-700/40 text-xs text-amber-200/90 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">Safe Archive Protection Active</p>
                <p className="text-[11px] leading-relaxed text-amber-200/80">
                  Your current active data, logs, and production history are automatically saved into the "Previous Orders" list before the reset occurs. You can switch back at any time.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !buyerName.trim()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-900/30 transition hover:scale-[1.01] active:scale-[0.99]"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <FolderPlus className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>Start New Order & Reset All Counts to ZERO</span>
            </button>
          </form>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* OPTION 2: LOAD PREVIOUS ORDER WORKSPACE (Right: 6 Cols)       */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                    Option 2
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Load Previous Order Workspace
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Switch the entire dashboard dynamically to review how any past order was executed.
                </p>
              </div>
            </div>

            {/* Quick Dropdown Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-200">
                <span>Select Previous Order from Archives</span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedPreviousId}
                    onChange={(e) => setSelectedPreviousId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white text-xs font-semibold appearance-none outline-none transition pr-9"
                  >
                    <option value="">-- Choose a past order workspace --</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.buyerName || 'Order'} — {w.name || w.id} ({w.orderCount || 0} orders, {formatNumber(w.totalOrderQty || 0)} pcs) {w.id === activeWorkspace?.id ? '★ [ACTIVE]' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedPreviousId) {
                      onShowToast?.('Please select a past order from the list', 'error');
                      return;
                    }
                    const target = workspaces.find((w) => w.id === selectedPreviousId);
                    setConfirmDialog({
                      type: 'switch',
                      targetId: selectedPreviousId,
                      targetName: target?.buyerName || target?.name || selectedPreviousId,
                    });
                  }}
                  disabled={isSwitching || !selectedPreviousId || selectedPreviousId === activeWorkspace?.id}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-900/30 transition shrink-0"
                >
                  {isSwitching ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  )}
                  <span>Load Order</span>
                </button>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search archived orders by buyer name, title, or ID..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs placeholder-slate-500 outline-none focus:border-slate-700 transition"
              />
            </div>

            {/* Interactive Scrollable Archives List */}
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {filteredWorkspaces.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                  No previous order workspaces found matching "{searchTerm}".
                </div>
              ) : (
                filteredWorkspaces.map((ws) => {
                  const isActive = ws.id === activeWorkspace?.id;
                  return (
                    <div
                      key={ws.id}
                      className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md'
                          : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-xs truncate">
                            {ws.buyerName || 'Order'}
                          </span>
                          {isActive ? (
                            <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold bg-slate-800 text-slate-400">
                              Archived
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>{ws.name || ws.id}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-300">
                            {ws.orderCount || 0} orders ({formatNumber(ws.totalOrderQty || 0)} pcs)
                          </span>
                          <span>•</span>
                          <span>{formatDate(ws.createdAt || ws.archivedAt)}</span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                type: 'switch',
                                targetId: ws.id,
                                targetName: ws.buyerName || ws.name || ws.id,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-semibold transition"
                            title="Load and activate this past order"
                          >
                            Load Order
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Loaded
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExportWorkspaceJson(ws)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Export JSON backup of this workspace"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {!isActive && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                type: 'delete',
                                targetId: ws.id,
                                targetName: ws.buyerName || ws.name,
                              })
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition"
                            title="Delete archived workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Sync Note */}
          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Synchronized with Firebase Realtime Database</span>
            <span className="font-mono">{workspaces.length} Total Saved Workspaces</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. CALCULATION PAGE ISOLATION NOTICE                           */}
      {/* ============================================================== */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Calculator className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
              <span>Calculation Page Protection & Isolation</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                Fixed Logic
              </span>
            </h4>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              As required, the material consumption formulas (1,350mm strip base length, yield per strip for sizes 10–18, adhesive tape A/B metrics, and batch matrix) on the <strong>Material Calculation</strong> page remain entirely fixed, isolated, and untouched by order workspace creation or resets.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. CONFIRMATION MODAL                                          */}
      {/* ============================================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.type === 'delete'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : confirmDialog.type === 'create'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}
              >
                {confirmDialog.type === 'delete' ? (
                  <Trash2 className="w-5 h-5" />
                ) : confirmDialog.type === 'create' ? (
                  <FolderPlus className="w-5 h-5" />
                ) : (
                  <RotateCcw className="w-5 h-5" />
                )}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  {confirmDialog.type === 'delete'
                    ? 'Delete Archived Workspace?'
                    : confirmDialog.type === 'create'
                    ? 'Start New Order Workspace?'
                    : 'Load Previous Order Workspace?'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Target: <strong className="text-slate-200">{confirmDialog.targetName}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmDialog.type === 'delete' ? (
                <>This action will permanently delete this archived order snapshot. This cannot be undone.</>
              ) : confirmDialog.type === 'create' ? (
                <>
                  Your current active data and historical logs will be safely archived to the previous orders list. All production counts, floor quantities, and balances will be reset to <strong>ZERO</strong> for this new order.
                </>
              ) : (
                <>
                  The ENTIRE dashboard and all associated pages (Daily Tracking, Hourly Output, Orders Directory, Delivery Logs) will dynamically switch to display the historical data of <strong>"{confirmDialog.targetName}"</strong>.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>

              {confirmDialog.type === 'delete' ? (
                <button
                  type="button"
                  onClick={() => handleDeleteWorkspace(confirmDialog.targetId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-900/30"
                >
                  Delete Archive
                </button>
              ) : confirmDialog.type === 'create' ? (
                <button
                  type="button"
                  onClick={handleCreateOrderWorkspace}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-900/30"
                >
                  Confirm & Reset to 0
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSwitchWorkspace(confirmDialog.targetId)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-900/30"
                >
                  Load Order Workspace
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
