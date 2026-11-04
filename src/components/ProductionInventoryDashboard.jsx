import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Boxes,
  Warehouse,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Layers,
  Printer,
  Download,
  Copy,
  ExternalLink,
  ShieldCheck,
  Package,
  Calendar,
  FileSpreadsheet,
  X,
  User,
  Hash,
  MapPin,
  Building,
  Check,
  ChevronDown,
  Pencil,
  Trash2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import { resolveProductionHost, buildMaterialRequestUrl } from '../utils/urlHelper';

export default function ProductionInventoryDashboard({
  onShowToast,
  onOpenRequestForm,
  theme = 'dark',
}) {
  // Navigation tabs: 'inventory' | 'pending' | 'history' | 'logs' | 'qr'
  const [activeTab, setActiveTab] = useState('inventory');

  // Data states
  const [inventoryItems, setInventoryItems] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [summary, setSummary] = useState({
    totalItems: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalPendingRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState('All'); // 'All' | 'Low' | 'Out' | 'InStock'
  const [searchTerm, setSearchTerm] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('All');

  // Modals
  const [addMaterialModalOpen, setAddMaterialModalOpen] = useState(false);
  const [editMaterialModalOpen, setEditMaterialModalOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [selectedItemForDelete, setSelectedItemForDelete] = useState(null);
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedItemForQr, setSelectedItemForQr] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequestForReject, setSelectedRequestForReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load live inventory and request data
  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, reqRes, logRes] = await Promise.all([
        api.getInventoryItems(),
        api.getMaterialRequests(),
        api.getInventoryLogs(),
      ]);

      if (invRes && invRes.items) {
        setInventoryItems(invRes.items);
        if (invRes.summary) setSummary(invRes.summary);
      }
      if (reqRes && reqRes.requests) {
        setMaterialRequests(reqRes.requests);
      }
      if (logRes && logRes.logs) {
        setInventoryLogs(logRes.logs);
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
      if (onShowToast) onShowToast('Error connecting to inventory store', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = api.subscribe(() => {
      loadData();
    });
    return unsub;
  }, []);

  // Unique categories list for filter pills
  const categoriesList = useMemo(() => {
    const set = new Set();
    inventoryItems.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ['All', ...Array.from(set)];
  }, [inventoryItems]);

  // Filtered inventory items
  const filteredItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (stockStatusFilter === 'Low') {
        if (!(item.currentStock > 0 && item.currentStock <= item.reorderLevel)) return false;
      } else if (stockStatusFilter === 'Out') {
        if (item.currentStock > 0) return false;
      } else if (stockStatusFilter === 'InStock') {
        if (item.currentStock <= item.reorderLevel) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matches =
          (item.name || '').toLowerCase().includes(s) ||
          (item.code || '').toLowerCase().includes(s) ||
          (item.category || '').toLowerCase().includes(s) ||
          (item.location || '').toLowerCase().includes(s) ||
          (item.supplier || '').toLowerCase().includes(s);
        if (!matches) return false;
      }
      return true;
    });
  }, [inventoryItems, selectedCategory, stockStatusFilter, searchTerm]);

  // Pending Requests Queue
  const pendingRequests = useMemo(() => {
    return materialRequests.filter((r) => r.status === 'Pending');
  }, [materialRequests]);

  // Historical Requests (Approved & Rejected)
  const historicalRequests = useMemo(() => {
    return materialRequests.filter((r) => {
      if (requestStatusFilter === 'All') return r.status !== 'Pending';
      return r.status === requestStatusFilter;
    });
  }, [materialRequests, requestStatusFilter]);

  // QR URLs
  const generalQrUrl = useMemo(() => {
    return buildMaterialRequestUrl();
  }, []);

  // Handle Approve Request (STRICT DEDUCTION)
  const handleApproveRequest = async (request) => {
    const item = inventoryItems.find((i) => i.id === request.itemId);
    if (!item) {
      if (onShowToast) onShowToast('Inventory item not found for this request', 'error');
      return;
    }

    if (item.currentStock < request.requestedQty) {
      if (
        !window.confirm(
          `WARNING: Available balance (${item.currentStock} ${item.unit}) is less than requested quantity (${request.requestedQty} ${item.unit}). Do you want to proceed with full deduction?`
        )
      ) {
        return;
      }
    } else {
      if (
        !window.confirm(
          `Approve Request #${request.id} for ${request.requesterName}?\n\nItem: ${request.itemName}\nDeduct: ${request.requestedQty} ${request.unit}\nNew Store Balance: ${item.currentStock - request.requestedQty} ${item.unit}`
        )
      ) {
        return;
      }
    }

    try {
      setActionInProgress(true);
      const res = await api.approveMaterialRequest(request.id, {
        approvedBy: 'Storekeeper',
        notes: approvalNotes || `Approved for 2-hour cycle (${request.productionCycle || ''})`,
      });

      if (res.success) {
        if (onShowToast) {
          onShowToast(
            `Request #${request.id} Approved! Deducted ${request.requestedQty} ${item.unit} from ${item.name}.`
          );
        }
        setApprovalNotes('');
        await loadData();
      } else {
        if (onShowToast) onShowToast(res.message || 'Failed to approve request', 'error');
      }
    } catch (err) {
      console.error('Error approving request:', err);
      if (onShowToast) onShowToast(err.message || 'Error approving request', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (request) => {
    setSelectedRequestForReject(request);
    setRejectionReason('Stock reserved for high priority export order');
    setRejectModalOpen(true);
  };

  // Confirm Reject Request
  const handleConfirmReject = async () => {
    if (!selectedRequestForReject) return;
    try {
      setActionInProgress(true);
      const res = await api.rejectMaterialRequest(selectedRequestForReject.id, {
        rejectedBy: 'Storekeeper',
        reason: rejectionReason || 'Declined by storekeeper',
      });

      if (res.success) {
        if (onShowToast) {
          onShowToast(`Request #${selectedRequestForReject.id} Rejected. Store stock untouched.`);
        }
        setRejectModalOpen(false);
        setSelectedRequestForReject(null);
        await loadData();
      } else {
        if (onShowToast) onShowToast(res.message || 'Failed to reject request', 'error');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      if (onShowToast) onShowToast(err.message || 'Error rejecting request', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Copy QR Link
  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(generalQrUrl);
      setCopiedLink(true);
      if (onShowToast) onShowToast('Material Request QR Link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {}
  };

  // Print QR Code Station Card
  const handlePrintQr = () => {
    const printWindow = window.open('', '_blank', 'width=700,height=800');
    if (!printWindow) return;
    const url = selectedItemForQr
      ? buildMaterialRequestUrl(undefined, selectedItemForQr.id)
      : generalQrUrl;
    const title = selectedItemForQr
      ? `${selectedItemForQr.name} (${selectedItemForQr.code})`
      : 'All Store Raw Materials';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bondtex Material Request QR Card - ${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 40px;
              text-align: center;
              background: #fff;
              color: #0f172a;
            }
            .card {
              border: 3px solid #0f172a;
              border-radius: 24px;
              padding: 40px;
              max-width: 480px;
              margin: 0 auto;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .header {
              font-size: 26px;
              font-weight: 900;
              letter-spacing: -0.5px;
              margin-bottom: 4px;
            }
            .sub {
              font-size: 14px;
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 24px;
            }
            .qr-box {
              background: #f8fafc;
              border: 2px dashed #cbd5e1;
              border-radius: 20px;
              padding: 24px;
              display: inline-block;
              margin-bottom: 20px;
            }
            .badge {
              display: inline-block;
              background: #0ea5e9;
              color: #fff;
              font-size: 13px;
              font-weight: 800;
              padding: 6px 16px;
              border-radius: 9999px;
              margin-bottom: 16px;
            }
            .instr {
              font-size: 15px;
              font-weight: 600;
              color: #334155;
              line-height: 1.5;
            }
            .footer {
              margin-top: 30px;
              font-size: 11px;
              color: #94a3b8;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">BONDTEX MES</div>
            <div class="sub">Production Floor Material Requisition</div>
            <div class="badge">SCAN FOR 2-HOUR CYCLE DISPATCH</div>
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                url
              )}" width="240" height="240" alt="QR Code" />
            </div>
            <div class="instr">
              <strong>Scan with any smartphone camera</strong><br />
              Select required quantity for your 2-hour production run.<br />
              Routes directly to Storekeeper for instant issue approval.
            </div>
            <div class="footer">
              Target: ${url}<br />
              Generated: ${new Date().toLocaleString()}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export inventory to CSV
  const handleExportCsv = () => {
    if (inventoryItems.length === 0) return;
    const headers = ['Code', 'Name', 'Category', 'Current Stock', 'Unit', 'Reorder Level', 'Location', 'Supplier', 'Status'];
    const rows = inventoryItems.map((item) => [
      item.code,
      `"${item.name.replace(/"/g, '""')}"`,
      item.category,
      item.currentStock,
      item.unit,
      item.reorderLevel,
      `"${item.location || ''}"`,
      `"${item.supplier || ''}"`,
      item.currentStock <= 0 ? 'Out of Stock' : item.currentStock <= item.reorderLevel ? 'Low Stock' : 'Normal',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bondtex_Production_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (onShowToast) onShowToast('Inventory report exported as CSV!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Banner & Quick Actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
              <Warehouse className="w-4 h-4 text-emerald-400" />
              <span>Storekeeper & Floor Dispatch Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Production Inventory Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time store balance tracking, mobile QR requisition for 2-hour production cycles, and strict storekeeper approval verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Open / Print QR Button */}
            <button
              onClick={() => {
                setSelectedItemForQr(null);
                setQrModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/30 active:scale-95 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Material Request QR</span>
            </button>

            {/* Add New Raw Material */}
            <button
              onClick={() => setAddMaterialModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/30 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Raw Material</span>
            </button>

            {/* Open Mobile Request Form directly */}
            {onOpenRequestForm && (
              <button
                onClick={onOpenRequestForm}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-cyan-400" />
                <span>Open Request Form</span>
              </button>
            )}

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 font-semibold text-xs transition cursor-pointer"
              title="Export Inventory Balance to CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Inventory KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Items */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Raw Materials
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {summary.totalItems || inventoryItems.length}
            </span>
            <span className="text-xs text-slate-400">Unique SKUs</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span>Straps, Adhesive, Covers, Tissue</span>
          </div>
        </div>

        {/* In-Stock Healthy Items */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              In-Stock (Healthy)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {summary.inStockCount}
            </span>
            <span className="text-xs text-slate-400">Above Reorder</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400/80 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Store balance adequate</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => {
            setActiveTab('inventory');
            setStockStatusFilter(stockStatusFilter === 'Low' ? 'All' : 'Low');
          }}
          className={`cursor-pointer transition rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden border ${
            summary.lowStockCount > 0
              ? 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/30'
              : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">
              {summary.lowStockCount}
            </span>
            <span className="text-xs text-slate-400">Near Threshold</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-400 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Click to filter reorder items</span>
          </div>
        </div>

        {/* Pending Requests Queue (STRICT APPROVAL QUEUE) */}
        <div
          onClick={() => setActiveTab('pending')}
          className={`cursor-pointer transition rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden border ${
            pendingRequests.length > 0
              ? 'bg-gradient-to-tr from-cyan-950/40 to-blue-950/40 border-cyan-500/50 hover:border-cyan-400 ring-1 ring-cyan-500/20'
              : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              Pending Requests Queue
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
              <Clock className="w-4 h-4 animate-spin" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {pendingRequests.length}
            </span>
            <span className="text-xs text-cyan-300 font-semibold">Awaiting Approval</span>
          </div>
          <div className="mt-2 text-[11px] text-cyan-400 flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Strict Storekeeper Logic Active</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold overflow-x-auto">
          {/* Tab 1: Store Inventory */}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Store Inventory</span>
            <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded font-mono">
              {filteredItems.length}
            </span>
          </button>

          {/* Tab 2: Pending Approvals (Strict Logic) */}
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'pending'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Approvals</span>
            {pendingRequests.length > 0 && (
              <span className="text-[10px] bg-cyan-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>

          {/* Tab 3: Request History */}
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Dispatched History</span>
            <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded font-mono">
              {materialRequests.filter((r) => r.status !== 'Pending').length}
            </span>
          </button>

          {/* Tab 4: Transaction Logs */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'logs'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Audit Ledger</span>
          </button>

          {/* Tab 5: Material Request QR Station */}
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'qr'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Station Card</span>
          </button>
        </div>

        {/* Refresh button */}
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition active:scale-95 cursor-pointer"
          title="Refresh store inventory"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STORE INVENTORY BALANCE TABLE (STOREKEEPER VIEW) */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            {/* Category selection pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input & Stock status filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search code, material, bay..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="All">All Stock Levels</option>
                <option value="InStock">Healthy Stock</option>
                <option value="Low">Low Stock Alerts</option>
                <option value="Out">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Real-time Inventory Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Item Code</th>
                    <th className="py-3.5 px-4">Raw Material Details</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-right">Available Balance</th>
                    <th className="py-3.5 px-4 text-right">Reorder Level</th>
                    <th className="py-3.5 px-4">Warehouse Shelf</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Store Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <span>No inventory materials match the selected filters.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isOutOfStock = item.currentStock <= 0;
                      const isLowStock = !isOutOfStock && item.currentStock <= item.reorderLevel;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-800/40 transition group"
                        >
                          {/* Item Code */}
                          <td className="py-3.5 px-4 font-mono font-bold text-cyan-400 whitespace-nowrap">
                            {item.code}
                          </td>

                          {/* Raw Material Details */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-bold text-white text-xs sm:text-sm group-hover:text-emerald-300 transition">
                              {item.name}
                            </div>
                            {item.notes && (
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {item.notes}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Supplier: {item.supplier || 'Bondtex Stores'}
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {item.category}
                            </span>
                          </td>

                          {/* Real-time Available Balance */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono">
                            <div
                              className={`text-sm sm:text-base font-extrabold ${
                                isOutOfStock
                                  ? 'text-rose-400'
                                  : isLowStock
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {item.currentStock?.toLocaleString()}{' '}
                              <span className="text-xs font-semibold text-slate-400">
                                {item.unit}
                              </span>
                            </div>
                          </td>

                          {/* Reorder Level */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-slate-400">
                            {item.reorderLevel?.toLocaleString()} {item.unit}
                          </td>

                          {/* Location */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>{item.location || 'Warehouse Bay 1'}</span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-950/80 text-rose-300 border border-rose-600/50">
                                <XCircle className="w-3 h-3 text-rose-400" />
                                Out of Stock
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-950/80 text-amber-300 border border-amber-600/50">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                Reorder Alert
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Healthy
                              </span>
                            )}
                          </td>

                          {/* Store Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Restock / Adjust */}
                              <button
                                onClick={() => {
                                  setSelectedItemForAdjust(item);
                                  setAdjustStockModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px] transition active:scale-95 cursor-pointer"
                                title="Add Restock or Adjust Count"
                              >
                                Restock
                              </button>

                              {/* Edit Item Details */}
                              <button
                                onClick={() => {
                                  setSelectedItemForEdit(item);
                                  setEditMaterialModalOpen(true);
                                }}
                                className="p-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition active:scale-95 cursor-pointer"
                                title="Edit Raw Material Details"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-400" />
                              </button>

                              {/* Delete Item */}
                              <button
                                onClick={() => {
                                  setSelectedItemForDelete(item);
                                  setDeleteConfirmModalOpen(true);
                                }}
                                className="p-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition active:scale-95 cursor-pointer"
                                title="Delete Raw Material"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              </button>

                              {/* Item QR Code */}
                              <button
                                onClick={() => {
                                  setSelectedItemForQr(item);
                                  setQrModalOpen(true);
                                }}
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95 cursor-pointer"
                                title="Generate Item QR Code"
                              >
                                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PENDING APPROVALS QUEUE (STRICT STOREKEEPER WORKFLOW) */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-4 animate-fade-in">
          {/* Strict Logic Banner */}
          <div className="bg-gradient-to-r from-blue-950/50 via-cyan-950/40 to-slate-900 border border-cyan-500/40 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Strict Storekeeper Dispatch Control Active
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Requested materials <strong>are never deducted</strong> until the storekeeper explicitly clicks "Approve". Upon approval, the exact requested quantity is deducted from the live store inventory and an audit log is registered automatically.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 bg-cyan-950/80 px-3.5 py-1.5 rounded-xl border border-cyan-800/60 whitespace-nowrap">
              <span>{pendingRequests.length} Pending Floor Requests</span>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">All Requests Processed!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No floor material requests are currently awaiting storekeeper action. Operators can scan the QR code to submit new 2-hour production cycle requisitions.
              </p>
              <button
                onClick={() => {
                  setSelectedItemForQr(null);
                  setQrModalOpen(true);
                }}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white font-semibold text-xs shadow-lg shadow-cyan-600/30"
              >
                <QrCode className="w-4 h-4" />
                <span>Show Material Request QR</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingRequests.map((req) => {
                const item = inventoryItems.find((i) => i.id === req.itemId);
                const availableStock = item ? item.currentStock : 0;
                const isStockSufficient = availableStock >= req.requestedQty;

                return (
                  <div
                    key={req.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-3xl p-5 sm:p-6 shadow-xl transition space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 font-mono font-extrabold text-sm border border-cyan-500/30">
                          {req.id}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-white">
                            {req.requesterName}
                          </span>
                          {req.requesterEmpId && (
                            <span className="text-xs text-slate-400 font-mono ml-1.5">
                              ({req.requesterEmpId})
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400">
                            {req.department} • Machine: <span className="font-mono text-cyan-300">{req.machineCode || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-3 py-1 rounded-xl bg-blue-950 text-blue-300 border border-blue-800/60 font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>{req.productionCycle}</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(req.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Material details and stock comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                      {/* Material info */}
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Requested Material
                        </div>
                        <div className="text-sm font-black text-white mt-0.5">
                          {req.itemName}
                        </div>
                        <div className="text-xs text-cyan-400 font-mono mt-0.5">
                          Code: {req.itemCode} • Category: {req.category}
                        </div>
                        {req.poNumber && (
                          <div className="text-[11px] text-amber-300 font-mono mt-1">
                            PO Reference: {req.poNumber}
                          </div>
                        )}
                      </div>

                      {/* Requested Quantity vs Available Store Balance */}
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Quantity Requested
                        </div>
                        <div className="text-xl font-extrabold text-cyan-300 font-mono mt-0.5">
                          {req.requestedQty?.toLocaleString()}{' '}
                          <span className="text-xs font-semibold text-slate-400">{req.unit}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>Store Balance:</span>
                          <span
                            className={`font-mono font-bold ${
                              isStockSufficient ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {availableStock?.toLocaleString()} {req.unit}
                          </span>
                        </div>
                      </div>

                      {/* Stock Check Assessment */}
                      <div className="flex flex-col justify-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                          Balance Assessment
                        </div>
                        {isStockSufficient ? (
                          <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>
                              Sufficient stock. Balance after dispatch:{' '}
                              <strong>
                                {(availableStock - req.requestedQty)?.toLocaleString()} {req.unit}
                              </strong>
                            </span>
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>
                              Insufficient stock! Short by{' '}
                              <strong>
                                {(req.requestedQty - availableStock)?.toLocaleString()} {req.unit}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {req.purpose && (
                      <div className="text-xs text-slate-300 bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-700/50">
                        <span className="text-slate-400 font-semibold">Floor Note:</span> {req.purpose}
                      </div>
                    )}

                    {/* Action Buttons: Strict Approve or Reject */}
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => handleOpenRejectModal(req)}
                        disabled={actionInProgress}
                        className="px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/50 font-bold text-xs transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Reject Request</span>
                      </button>

                      <button
                        onClick={() => handleApproveRequest(req)}
                        disabled={actionInProgress}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shadow-lg shadow-emerald-600/30 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Approve & Deduct Stock</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DISPATCHED / REQUEST HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-fade-in">
          {/* Sub-filter */}
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Filter History:</span>
              {['All', 'Approved', 'Rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setRequestStatusFilter(status)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    requestStatusFilter === status
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Request ID</th>
                    <th className="py-3.5 px-4">Date & Cycle</th>
                    <th className="py-3.5 px-4">Requester / Line</th>
                    <th className="py-3.5 px-4">Raw Material</th>
                    <th className="py-3.5 px-4 text-right">Requested Qty</th>
                    <th className="py-3.5 px-4 text-center">Store Impact</th>
                    <th className="py-3.5 px-4">Status & Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {historicalRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No historical requests found.
                      </td>
                    </tr>
                  ) : (
                    historicalRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-400 whitespace-nowrap">
                          {req.id}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-white font-semibold">
                            {new Date(req.timestamp).toLocaleDateString()}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {req.productionCycle}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white font-bold">{req.requesterName}</div>
                          <div className="text-[11px] text-slate-400">
                            {req.department} • {req.machineCode}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white font-bold">{req.itemName}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">{req.itemCode}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                          {req.requestedQty?.toLocaleString()} {req.unit}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap font-mono text-[11px]">
                          {req.status === 'Approved' ? (
                            <span className="text-emerald-400 font-bold">
                              -{req.requestedQty} {req.unit}
                              {req.stockBefore !== undefined && (
                                <span className="block text-[10px] text-slate-400">
                                  ({req.stockBefore} → {req.stockAfter})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500">0 (Preserved)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {req.status === 'Approved' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Approved
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                By {req.approvedBy || 'Storekeeper'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-950/80 text-rose-300 border border-rose-600/50">
                                <XCircle className="w-3 h-3 text-rose-400" />
                                Rejected
                              </span>
                              {req.rejectionReason && (
                                <div className="text-[10px] text-rose-400/80 mt-0.5 truncate max-w-xs">
                                  {req.rejectionReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INVENTORY TRANSACTION AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Date / Time</th>
                    <th className="py-3.5 px-4">Event Type</th>
                    <th className="py-3.5 px-4">Raw Material</th>
                    <th className="py-3.5 px-4 text-right">Quantity Change</th>
                    <th className="py-3.5 px-4 text-right">Balance After</th>
                    <th className="py-3.5 px-4">Handler</th>
                    <th className="py-3.5 px-4">Audit Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {inventoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No inventory audit logs found.
                      </td>
                    </tr>
                  ) : (
                    inventoryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.type === 'Approved_Request'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                                : log.type === 'Restock'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                : log.type === 'Rejected_Request'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white font-bold">{log.itemName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.itemCode}</div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold">
                          {log.qtyChange > 0 ? (
                            <span className="text-emerald-400">+{log.qtyChange?.toLocaleString()} {log.unit}</span>
                          ) : log.qtyChange < 0 ? (
                            <span className="text-rose-400">{log.qtyChange?.toLocaleString()} {log.unit}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-white">
                          {log.balanceAfter !== null && log.balanceAfter !== undefined
                            ? `${log.balanceAfter?.toLocaleString()} ${log.unit}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                          {log.performedBy || 'Storekeeper'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                          {log.notes}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MATERIAL REQUEST QR STATION DISPLAY */}
      {/* ========================================================================= */}
      {activeTab === 'qr' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl max-w-3xl mx-auto space-y-6 text-center animate-fade-in">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider mb-2">
              <QrCode className="w-3.5 h-3.5" />
              Floor Station QR Code
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Scan for 2-Hour Material Requisition
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto mt-1">
              Place this QR card near production machines and packing lines. Operators scan with any mobile device to requisition materials for their current 2-hour production cycle.
            </p>
          </div>

          {/* Large crisp QR Code display */}
          <div className="bg-white p-6 rounded-3xl inline-block shadow-2xl shadow-cyan-500/20 border-4 border-cyan-500/30">
            <QRCodeSVG value={generalQrUrl} size={240} level="H" includeMargin={true} />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-mono text-cyan-300 font-semibold break-all max-w-md mx-auto">
              {generalQrUrl}
            </div>
            <div className="text-[11px] text-slate-500">
              Direct mobile-optimized link for floor requisitions
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handlePrintQr}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Station QR Card</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition active:scale-95 cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Direct URL'}</span>
            </button>

            {onOpenRequestForm && (
              <button
                onClick={onOpenRequestForm}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition active:scale-95 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Floor Form</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW RAW MATERIAL */}
      {/* ========================================================================= */}
      {addMaterialModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Plus className="w-4 h-4" />
                <span>Add New Raw Material Item</span>
              </div>
              <button
                onClick={() => setAddMaterialModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const name = form.matName.value.trim();
                const code = form.matCode.value.trim();
                const category = form.matCategory.value;
                const unit = form.matUnit.value;
                const currentStock = Number(form.matStock.value) || 0;
                const reorderLevel = Number(form.matReorder.value) || 0;
                const location = form.matLocation.value.trim();
                const supplier = form.matSupplier.value.trim();
                const notes = form.matNotes.value.trim();

                try {
                  const res = await api.addInventoryItem({
                    name,
                    code,
                    category,
                    unit,
                    currentStock,
                    reorderLevel,
                    location,
                    supplier,
                    notes,
                    createdBy: 'Storekeeper',
                  });

                  if (res.success) {
                    if (onShowToast) onShowToast(`Added raw material "${name}" to store!`);
                    setAddMaterialModalOpen(false);
                    await loadData();
                  } else {
                    if (onShowToast) onShowToast(res.message || 'Failed to add item', 'error');
                  }
                } catch (err) {
                  if (onShowToast) onShowToast(err.message, 'error');
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-slate-300">Material Name *</label>
                <input
                  name="matName"
                  required
                  placeholder="e.g. High Tenacity Bonded Nylon Straps 25mm"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Item Code (Optional)</label>
                  <input
                    name="matCode"
                    placeholder="e.g. RM-ST-25"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Category *</label>
                  <select
                    name="matCategory"
                    defaultValue="Straps"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="Straps">Straps</option>
                    <option value="Adhesive">Adhesive</option>
                    <option value="File Covers">File Covers</option>
                    <option value="Tissue">Tissue</option>
                    <option value="Yarn">Yarn</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Unit *</label>
                  <select
                    name="matUnit"
                    defaultValue="Meters"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="Meters">Meters</option>
                    <option value="Rolls">Rolls</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Kgs">Kgs</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Units">Units</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Initial Stock</label>
                  <input
                    type="number"
                    name="matStock"
                    defaultValue="1000"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Reorder Alert</label>
                  <input
                    type="number"
                    name="matReorder"
                    defaultValue="200"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Location / Shelf</label>
                  <input
                    name="matLocation"
                    placeholder="e.g. Rack S-01"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Supplier Name</label>
                  <input
                    name="matSupplier"
                    placeholder="e.g. Bondtex Primary Mills"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300">Technical Notes</label>
                <input
                  name="matNotes"
                  placeholder="e.g. Raw material specifications, batch info..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddMaterialModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1B: EDIT RAW MATERIAL DETAILS MODAL */}
      {/* ========================================================================= */}
      {editMaterialModalOpen && selectedItemForEdit && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Raw Material Details</h3>
                  <p className="text-xs text-slate-400">Modify catalog specifications, reorder triggers & shelf location</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditMaterialModalOpen(false);
                  setSelectedItemForEdit(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const name = form.matName.value.trim();
                const code = form.matCode.value.trim();
                const category = form.matCategory.value;
                const unit = form.matUnit.value;
                const reorderLevel = Number(form.matReorder.value) || 0;
                const location = form.matLocation.value.trim();
                const supplier = form.matSupplier.value.trim();
                const notes = form.matNotes.value.trim();

                try {
                  setActionInProgress(true);
                  const res = await api.updateInventoryItem(selectedItemForEdit.id, {
                    name,
                    code,
                    category,
                    unit,
                    reorderLevel,
                    location,
                    supplier,
                    notes,
                    updatedBy: 'Storekeeper',
                  });

                  if (res && res.success !== false) {
                    if (onShowToast) onShowToast(`Updated material "${name}" details successfully!`);
                    setEditMaterialModalOpen(false);
                    setSelectedItemForEdit(null);
                    await loadData();
                  } else {
                    if (onShowToast) onShowToast(res?.message || 'Failed to update item', 'error');
                  }
                } catch (err) {
                  if (onShowToast) onShowToast(err.message, 'error');
                } finally {
                  setActionInProgress(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-slate-300">Material Name *</label>
                <input
                  name="matName"
                  required
                  defaultValue={selectedItemForEdit.name}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Item Code *</label>
                  <input
                    name="matCode"
                    required
                    defaultValue={selectedItemForEdit.code}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Category *</label>
                  <select
                    name="matCategory"
                    defaultValue={selectedItemForEdit.category || 'Other'}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="Straps">Straps</option>
                    <option value="Adhesive">Adhesive</option>
                    <option value="File Covers">File Covers</option>
                    <option value="Tissue">Tissue</option>
                    <option value="Yarn">Yarn</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Unit of Measurement *</label>
                  <select
                    name="matUnit"
                    defaultValue={selectedItemForEdit.unit || 'Units'}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="Meters">Meters</option>
                    <option value="Rolls">Rolls</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Kgs">Kgs</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Units">Units</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Reorder Alert Level *</label>
                  <input
                    type="number"
                    name="matReorder"
                    required
                    min="0"
                    step="any"
                    defaultValue={selectedItemForEdit.reorderLevel}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Warehouse Shelf / Location</label>
                  <input
                    name="matLocation"
                    defaultValue={selectedItemForEdit.location || ''}
                    placeholder="e.g. Rack S-01, Shelf B"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Supplier Name</label>
                  <input
                    name="matSupplier"
                    defaultValue={selectedItemForEdit.supplier || ''}
                    placeholder="e.g. Bondtex Primary Mills"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300">Technical Notes / Specs</label>
                <input
                  name="matNotes"
                  defaultValue={selectedItemForEdit.notes || ''}
                  placeholder="e.g. High tenacity nylon yarn, 54A2 elastic strap..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditMaterialModalOpen(false);
                    setSelectedItemForEdit(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-blue-900/30 cursor-pointer"
                >
                  {actionInProgress ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1C: DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirmModalOpen && selectedItemForDelete && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Raw Material?</h3>
                <p className="text-xs text-slate-400">This action will remove the item from active store inventory.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="text-white font-bold">{selectedItemForDelete.name}</div>
              <div className="text-slate-400 font-mono text-[11px]">
                Code: <span className="text-cyan-400">{selectedItemForDelete.code}</span> | Category: <span className="text-slate-300">{selectedItemForDelete.category}</span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Current Available Stock: <span className="font-mono font-bold text-amber-400">{selectedItemForDelete.currentStock?.toLocaleString()} {selectedItemForDelete.unit}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete this material? All future floor QR requests for this code will be unavailable.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmModalOpen(false);
                  setSelectedItemForDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={async () => {
                  try {
                    setActionInProgress(true);
                    const res = await api.deleteInventoryItem(selectedItemForDelete.id);
                    if (res && res.success !== false) {
                      if (onShowToast) onShowToast(`Deleted "${selectedItemForDelete.name}" from store inventory!`);
                      setDeleteConfirmModalOpen(false);
                      setSelectedItemForDelete(null);
                      await loadData();
                    } else {
                      if (onShowToast) onShowToast(res?.message || 'Failed to delete item', 'error');
                    }
                  } catch (err) {
                    if (onShowToast) onShowToast(err.message, 'error');
                  } finally {
                    setActionInProgress(false);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                {actionInProgress ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RESTOCK / STOCK ADJUSTMENT MODAL */}
      {/* ========================================================================= */}
      {adjustStockModalOpen && selectedItemForAdjust && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Boxes className="w-4 h-4" />
                <span>Update Stock Balance</span>
              </div>
              <button
                onClick={() => setAdjustStockModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white text-sm">{selectedItemForAdjust.name}</div>
              <div className="text-slate-400 font-mono">
                Code: {selectedItemForAdjust.code} • Category: {selectedItemForAdjust.category}
              </div>
              <div className="text-emerald-400 font-extrabold text-sm pt-1">
                Current Balance: {selectedItemForAdjust.currentStock?.toLocaleString()}{' '}
                {selectedItemForAdjust.unit}
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const operation = form.operation.value; // 'add' or 'subtract'
                const qty = Number(form.adjQty.value) || 0;
                const delta = operation === 'add' ? qty : -qty;
                const notes = form.adjNotes.value.trim();

                if (delta === 0) return;

                try {
                  const res = await api.adjustInventoryStock(selectedItemForAdjust.id, {
                    adjustmentQty: delta,
                    type: operation === 'add' ? 'Restock' : 'Adjustment',
                    notes,
                    performedBy: 'Storekeeper',
                  });

                  if (res.success) {
                    if (onShowToast) {
                      onShowToast(
                        `Stock updated for ${selectedItemForAdjust.name}! New balance: ${res.item?.currentStock} ${selectedItemForAdjust.unit}`
                      );
                    }
                    setAdjustStockModalOpen(false);
                    await loadData();
                  } else {
                    if (onShowToast) onShowToast(res.message || 'Failed to update stock', 'error');
                  }
                } catch (err) {
                  if (onShowToast) onShowToast(err.message, 'error');
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-slate-300">Action Type</label>
                <select
                  name="operation"
                  defaultValue="add"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold"
                >
                  <option value="add">Add Inward Restock (+ Delivery / Batch)</option>
                  <option value="subtract">Manual Stock Reduction / Shrinkage (- Deduction)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-300">
                  Adjustment Quantity ({selectedItemForAdjust.unit}) *
                </label>
                <input
                  type="number"
                  name="adjQty"
                  required
                  min="1"
                  step="any"
                  placeholder={`Enter quantity in ${selectedItemForAdjust.unit}...`}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300">Audit Notes / Supplier PO</label>
                <input
                  name="adjNotes"
                  placeholder="e.g. GRN-9982 delivery from primary mill"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustStockModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REJECT REQUEST MODAL */}
      {/* ========================================================================= */}
      {rejectModalOpen && selectedRequestForReject && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <XCircle className="w-4 h-4" />
                <span>Reject Material Request #{selectedRequestForReject.id}</span>
              </div>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <p>
                Under strict store logic, declining this request will <strong>preserve store stock</strong> and mark the request as Rejected.
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono mt-2">
                Item: {selectedRequestForReject.itemName} ({selectedRequestForReject.requestedQty}{' '}
                {selectedRequestForReject.unit})<br />
                Requester: {selectedRequestForReject.requesterName} ({selectedRequestForReject.department})
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Reason for Rejection *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                placeholder="e.g. Stock reserved for high priority export order..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionInProgress}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: QR CODE DISPLAY MODAL */}
      {/* ========================================================================= */}
      {qrModalOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                <QrCode className="w-4 h-4" />
                <span>
                  {selectedItemForQr ? `QR: ${selectedItemForQr.name}` : 'General Material Request QR'}
                </span>
              </div>
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl inline-block shadow-lg border-2 border-cyan-500/30">
              <QRCodeSVG
                value={
                  selectedItemForQr
                    ? buildMaterialRequestUrl(undefined, selectedItemForQr.id)
                    : generalQrUrl
                }
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="text-xs text-slate-300">
              Scan with mobile phone to open the 2-hour production cycle material request form.
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={handlePrintQr}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Card</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
