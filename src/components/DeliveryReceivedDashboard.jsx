import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  QrCode,
  Camera,
  CameraOff,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  RefreshCw,
  Clock,
  Calendar,
  Layers,
  FileText,
  Printer,
  Sparkles,
  ChevronRight,
  Filter,
  PackageCheck,
  Check,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';

export default function DeliveryReceivedDashboard({ onShowToast, onNavigateToView, theme = 'dark' }) {
  // 1. Multi-Step Workflow State
  // Type: 'Delivery' | 'Received'
  const [selectedType, setSelectedType] = useState('Delivery');

  // Delivery Sub-Category: 'Outsource' | 'Permanent'
  const [selectedDeliverySub, setSelectedDeliverySub] = useState('Outsource');

  // Outsource Partner: 'Saroja' | 'Anoja' | 'Iresh'
  const [selectedPartner, setSelectedPartner] = useState('Saroja');

  // Received Source: 'Saroja' | 'Anoja' | 'Iresh' | 'Factory'
  const [receivedSource, setReceivedSource] = useState('Saroja');

  // 2. Orders & Selection State
  const [orders, setOrders] = useState([]);
  const [selectedPo, setSelectedPo] = useState('4502991550');
  const [selectedColour, setSelectedColour] = useState('Black 093 54A2');
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [handlerName, setHandlerName] = useState('Floor Dispatcher');
  const [notes, setNotes] = useState('');

  // 3. Transactions & Summary State
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    outsourceDeliveredToday: 0,
    permanentDeliveredToday: 0,
    totalReceivedToday: 0,
    partnerBreakdown: { Saroja: 0, Anoja: 0, Iresh: 0 },
  });
  const [filterType, setFilterType] = useState('All');
  const [filterPartner, setFilterPartner] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);

  // 4. Fixed QR Scanner Interface State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('Ready • Awaiting Scan');
  const [lastScannedCode, setLastScannedCode] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Play warehouse scanner beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio playback failsafe
    }
  };

  // Load orders and transaction history
  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, logsRes] = await Promise.all([
        api.getOrders({ limit: 100 }),
        api.getDeliveryReceivedLogs(),
      ]);

      if (ordersRes && ordersRes.orders) {
        setOrders(ordersRes.orders);
        if (ordersRes.orders.length > 0 && !selectedPo) {
          setSelectedPo(ordersRes.orders[0].poNumber);
          setSelectedColour(ordersRes.orders[0].colour);
        }
      }

      if (logsRes && logsRes.logs) {
        setLogs(logsRes.logs);
        if (logsRes.summary) setSummary(logsRes.summary);
      }
    } catch (err) {
      console.error('Error loading delivery/received data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      stopCamera();
    };
  }, []);

  // Filter orders matching currently selected PO
  const currentPoOrders = orders.filter((o) => o.poNumber === selectedPo);
  const availableColours = Array.from(new Set(currentPoOrders.map((o) => o.colour)));

  // Available sizes for currently selected PO & Colour
  const currentSizeOrders = currentPoOrders.filter(
    (o) => !selectedColour || o.colour.toLowerCase() === selectedColour.toLowerCase()
  );

  // Switch PO & auto-select its first colour
  const handleSelectPo = (po) => {
    setSelectedPo(po);
    const poItems = orders.filter((o) => o.poNumber === po);
    if (poItems.length > 0) {
      setSelectedColour(poItems[0].colour);
      setSizeQuantities({});
    }
  };

  // Handle quantity changes for a specific size
  const handleQuantityChange = (size, val) => {
    const cleanNum = val.replace(/[^0-9]/g, '');
    setSizeQuantities((prev) => ({
      ...prev,
      [size]: cleanNum,
    }));
  };

  // Quick add helper
  const handleQuickAdd = (size, delta) => {
    const current = Number(sizeQuantities[size]) || 0;
    const nextVal = Math.max(0, current + delta);
    setSizeQuantities((prev) => ({
      ...prev,
      [size]: String(nextVal),
    }));
  };

  // Fill maximum balance
  const handleFillMaxBalance = (size, balance) => {
    setSizeQuantities((prev) => ({
      ...prev,
      [size]: String(balance),
    }));
  };

  // Total calculated pieces across all sizes
  const totalEnteredQty = Object.values(sizeQuantities).reduce(
    (sum, q) => sum + (Number(q) || 0),
    0
  );

  // Fixed QR Scanner: Camera handler
  const startCamera = async () => {
    try {
      setCameraActive(true);
      setScannerStatus('Activating Video Camera Sensor...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScannerStatus('Camera Live • Position QR / Barcode in frame');
    } catch (err) {
      console.warn('Camera access unavailable:', err);
      setCameraActive(false);
      setScannerStatus('Camera not accessible. Use Laser Scanner / Manual Input');
      if (onShowToast) onShowToast('Camera access blocked. Use the barcode field below.', 'info');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScannerStatus('Ready • Awaiting Scan');
  };

  // Process Scanned Code (either from input or camera or test buttons)
  const handleProcessScan = (codeRaw) => {
    const code = (codeRaw || barcodeInput || '').trim();
    if (!code) return;

    playBeep();
    setLastScannedCode(code);

    // Look for matching order by barcode or PO #
    // Barcode format: BTX-4502991550-10 or 4502991550
    let matchedOrder = orders.find(
      (o) => o.barcode === code || o.poNumber === code || o.id === code
    );

    if (!matchedOrder && code.includes('-')) {
      const parts = code.split('-');
      const possiblePo = parts.find((p) => orders.some((o) => o.poNumber === p));
      if (possiblePo) {
        matchedOrder = orders.find((o) => o.poNumber === possiblePo);
      }
    }

    if (matchedOrder) {
      setSelectedPo(matchedOrder.poNumber);
      setSelectedColour(matchedOrder.colour);
      if (matchedOrder.size) {
        setSizeQuantities({ [matchedOrder.size]: '100' });
      }
      setScannerStatus(`✅ Scanned PO #${matchedOrder.poNumber} (${matchedOrder.colour})`);
      if (onShowToast) {
        onShowToast(`Scanned: PO ${matchedOrder.poNumber} • ${matchedOrder.colour} (Size ${matchedOrder.size})`);
      }
    } else {
      setScannerStatus(`⚠️ Code '${code}' scanned - not in registered POs`);
      if (onShowToast) onShowToast(`Unrecognized barcode: ${code}`, 'error');
    }

    setBarcodeInput('');
  };

  // Form Submission
  const handleSubmitTransaction = async (e) => {
    e.preventDefault();

    // Prepare items with quantity > 0
    const items = [];
    currentSizeOrders.forEach((orderRow) => {
      const qty = Number(sizeQuantities[orderRow.size]) || 0;
      if (qty > 0) {
        items.push({
          poNumber: orderRow.poNumber,
          colour: orderRow.colour,
          size: orderRow.size,
          qty,
        });
      }
    });

    if (items.length === 0) {
      if (onShowToast) onShowToast('Please enter a quantity for at least one size', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        type: selectedType,
        subCategory: selectedType === 'Delivery' ? selectedDeliverySub : 'Received',
        outsourcePartner: selectedType === 'Delivery' && selectedDeliverySub === 'Outsource' ? selectedPartner : (selectedType === 'Received' ? receivedSource : null),
        poNumber: selectedPo,
        colour: selectedColour,
        items,
        notes,
        handlerName,
      };

      const res = await api.recordDeliveryReceived(payload);

      if (res && res.success) {
        playBeep();
        const effectMsg = selectedType === 'Delivery'
          ? (selectedDeliverySub === 'Outsource'
              ? `Deducted ${totalEnteredQty.toLocaleString()} pcs from Day's Target (Outsourced to ${selectedPartner})`
              : `Deducted ${totalEnteredQty.toLocaleString()} pcs from System Balance (Permanent Dispatch)`)
          : `Received ${totalEnteredQty.toLocaleString()} pcs into warehouse (from ${receivedSource})`;

        setSuccessBanner({
          type: selectedType,
          subCategory: selectedDeliverySub,
          partner: selectedPartner,
          totalQty: totalEnteredQty,
          effectMsg,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        if (onShowToast) onShowToast(effectMsg, 'success');

        // Reset entered quantities
        setSizeQuantities({});
        setNotes('');

        // Reload data and recalculate
        await loadData();

        setTimeout(() => setSuccessBanner(null), 5000);
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to save transaction', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Test Barcodes Preset List
  const testBarcodes = [
    { label: 'PO 4502991550 (Black)', code: '4502991550' },
    { label: 'PO 4502991532 (Marzipan)', code: '4502991532' },
    { label: 'PO 4502991599 (Praline)', code: '4502991599' },
    { label: 'PO 4502991520 (Ganache)', code: '4502991520' },
    { label: 'PO 4502991562 (Talc)', code: '4502991562' },
    { label: 'Full Barcode (Sz 10)', code: 'BTX-4502991550-10' },
  ];

  // Filter logs for table
  const filteredLogs = logs.filter((l) => {
    if (filterType !== 'All' && l.type.toLowerCase() !== filterType.toLowerCase()) return false;
    if (filterPartner !== 'All' && l.outsourcePartner !== filterPartner) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        (l.poNumber || '').toLowerCase().includes(q) ||
        (l.colour || '').toLowerCase().includes(q) ||
        (l.size || '').toLowerCase().includes(q) ||
        (l.outsourcePartner || '').toLowerCase().includes(q) ||
        (l.handlerName || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ========================================================= */}
      {/* HEADER BANNER & STATS STRIP                               */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <Truck className="w-3.5 h-3.5" />
              <span>Logistics & Dispatch Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Delivery & Received</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                Fixed QR Interface
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Multi-step workflow terminal: Outsource dispatching to <strong>Saroja</strong>, <strong>Anoja</strong>, and <strong>Iresh</strong> (deducts from Day's Target) or Permanent Customer Delivery (deducts from System Balance).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-2 text-xs font-semibold"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Key Summary Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-blue-500/30">
            <div className="flex items-center justify-between text-blue-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Outsource Today</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {formatNumber(summary.outsourceDeliveredToday || 0)} <span className="text-xs font-normal text-slate-400">pcs</span>
            </div>
            <div className="text-[10px] text-blue-400/80 mt-1 truncate">
              Saroja: {summary.partnerBreakdown?.Saroja || 0} • Anoja: {summary.partnerBreakdown?.Anoja || 0} • Iresh: {summary.partnerBreakdown?.Iresh || 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/30">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Permanent Delivered</span>
              <PackageCheck className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {formatNumber(summary.permanentDeliveredToday || 0)} <span className="text-xs font-normal text-slate-400">pcs</span>
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-1">
              ⚡ Deducted from System Balance
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-purple-500/30">
            <div className="flex items-center justify-between text-purple-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Received</span>
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {formatNumber(summary.totalReceivedToday || 0)} <span className="text-xs font-normal text-slate-400">pcs</span>
            </div>
            <div className="text-[10px] text-purple-400/80 mt-1">
              Returns & warehouse receipts
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-amber-500/30">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Logged Transactions</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {logs.length} <span className="text-xs font-normal text-slate-400">records</span>
            </div>
            <div className="text-[10px] text-amber-400/80 mt-1">
              Full audit trail preserved
            </div>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/50 shadow-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Transaction Completed • {successBanner.totalQty.toLocaleString()} pcs
              </h4>
              <p className="text-xs text-emerald-300">{successBanner.effectMsg}</p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-900/40 px-3 py-1 rounded-xl">
            {successBanner.time}
          </span>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN TWO-COLUMN WORKFLOW TERMINAL                         */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================= */}
        {/* LEFT COLUMN (COL 1-7): MULTI-STEP WORKFLOW FORM           */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSubmitTransaction}
            className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl space-y-6 backdrop-blur-sm"
          >
            {/* STEP 1: INITIAL SELECTION (Delivery vs Received) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Step 1: Initial Selection</span>
                </label>
                <span className="text-[11px] text-slate-400">Choose Transaction Type</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType('Delivery')}
                  className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                    selectedType === 'Delivery'
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-600/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      selectedType === 'Delivery' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowUpFromLine className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm tracking-tight">Delivery</div>
                    <div className="text-[11px] opacity-80">Outbound dispatch from floor</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('Received')}
                  className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                    selectedType === 'Received'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-600/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      selectedType === 'Received' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <ArrowDownToLine className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm tracking-tight">Received</div>
                    <div className="text-[11px] opacity-80">Inbound return to warehouse</div>
                  </div>
                </button>
              </div>
            </div>

            {/* STEP 2: DELIVERY SUB-CATEGORIES (Outsource vs Permanent) */}
            {selectedType === 'Delivery' && (
              <div className="space-y-3 pt-4 border-t border-slate-800 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Step 2: Delivery Sub-Category</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Select Dispatch Destination</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDeliverySub('Outsource')}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                      selectedDeliverySub === 'Outsource'
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl ${
                        selectedDeliverySub === 'Outsource' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs">Outsource</div>
                      <div className="text-[10px] text-amber-400 font-semibold">Deducts from Day's Target</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDeliverySub('Permanent')}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                      selectedDeliverySub === 'Permanent'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl ${
                        selectedDeliverySub === 'Permanent' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs">Permanent</div>
                      <div className="text-[10px] text-emerald-400 font-semibold">Deducts from System Balance</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: OUTSOURCE PARTNER SELECTION (Saroja, Anoja, Iresh) */}
            {selectedType === 'Delivery' && selectedDeliverySub === 'Outsource' && (
              <div className="space-y-3 pt-4 border-t border-slate-800 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <span>Step 3: Select Outsource Partner</span>
                  </label>
                  <span className="text-[11px] text-amber-400 font-semibold">Required Partner</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {['Saroja', 'Anoja', 'Iresh'].map((partner) => (
                    <button
                      key={partner}
                      type="button"
                      onClick={() => setSelectedPartner(partner)}
                      className={`p-3 rounded-2xl border text-center transition ${
                        selectedPartner === partner
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 border-amber-400 text-white shadow-lg shadow-orange-600/20 scale-102'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="text-xs font-extrabold tracking-tight">{partner}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">Outsource Unit</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3B: RECEIVED SOURCE SELECTION (if Received) */}
            {selectedType === 'Received' && (
              <div className="space-y-3 pt-4 border-t border-slate-800 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Received From Source:</span>
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['Saroja', 'Anoja', 'Iresh', 'Factory'].map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setReceivedSource(src)}
                      className={`p-2.5 rounded-xl border text-center transition text-xs font-bold ${
                        receivedSource === src
                          ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: PRODUCT & QUANTITY PARAMETERS */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    4
                  </span>
                  <span>Step 4: Product & Quantity Parameters</span>
                </label>
                <span className="text-[11px] text-slate-400">PO, Colour & Sizes</span>
              </div>

              {/* PO Number Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Select Purchase Order (PO #):
                </label>
                <select
                  value={selectedPo}
                  onChange={(e) => handleSelectPo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white font-mono focus:outline-none focus:border-blue-500"
                >
                  {Array.from(new Set(orders.map((o) => o.poNumber))).map((po) => {
                    const sample = orders.find((o) => o.poNumber === po);
                    return (
                      <option key={po} value={po}>
                        PO #{po} — {sample?.colour || 'Loop'} ({sample?.category})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Colour Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Select Product Colour:
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableColours.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setSelectedColour(col);
                        setSizeQuantities({});
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        selectedColour.toLowerCase() === col.toLowerCase()
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                          : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-Size Quantity Input Grid */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Enter Quantities for Available Sizes (pcs):</span>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    Total: {totalEnteredQty.toLocaleString()} pcs
                  </span>
                </label>

                <div className="space-y-2">
                  {currentSizeOrders.map((orderRow) => {
                    const size = String(orderRow.size);
                    const qtyVal = sizeQuantities[size] || '';
                    const balance = Number(orderRow.balanceQty) || 0;
                    const orderQty = Number(orderRow.orderQty) || 0;

                    return (
                      <div
                        key={size}
                        className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 font-black font-mono text-sm flex items-center justify-center">
                            {size}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white">
                              Size {size} — {orderRow.colour}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Plan: {formatNumber(orderQty)} | Balance: <span className="text-amber-400 font-bold">{formatNumber(balance)}</span> pcs
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={qtyVal}
                            onChange={(e) => handleQuantityChange(size, e.target.value)}
                            placeholder="0 pcs"
                            className="w-24 sm:w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-right font-mono font-bold text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                          />

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(size, 50)}
                              className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 font-mono"
                            >
                              +50
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(size, 100)}
                              className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 font-mono"
                            >
                              +100
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFillMaxBalance(size, balance)}
                              className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[10px] font-bold"
                              title="Fill All Remaining Balance"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Handler & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Operator / Dispatcher Name:
                  </label>
                  <input
                    type="text"
                    value={handlerName}
                    onChange={(e) => setHandlerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Optional Reference Notes:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Batch #4, Outsource lot A..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-1 placeholder-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* REAL-TIME CALCULATION IMPACT PREVIEW BOX */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Calculation Logic & System Impact:</span>
              </div>

              {selectedType === 'Delivery' ? (
                selectedDeliverySub === 'Outsource' ? (
                  <div className="text-xs text-amber-300/90 leading-relaxed">
                    ⚡ <strong>Outsource Delivery ({selectedPartner})</strong>: Deducts{' '}
                    <span className="font-mono font-bold text-white">
                      {totalEnteredQty.toLocaleString()} pcs
                    </span>{' '}
                    from the <strong>Day's Target</strong>.
                  </div>
                ) : (
                  <div className="text-xs text-emerald-300/90 leading-relaxed">
                    📦 <strong>Permanent Delivery (Customer Dispatch)</strong>: Deducts{' '}
                    <span className="font-mono font-bold text-white">
                      {totalEnteredQty.toLocaleString()} pcs
                    </span>{' '}
                    from the <strong>System Balance</strong>, advancing order completion status!
                  </div>
                )
              ) : (
                <div className="text-xs text-purple-300/90 leading-relaxed">
                  📥 <strong>Received Return ({receivedSource})</strong>: Logs{' '}
                  <span className="font-mono font-bold text-white">
                    {totalEnteredQty.toLocaleString()} pcs
                  </span>{' '}
                  into warehouse receipts.
                </div>
              )}
            </div>

            {/* SAVE BUTTON */}
            <button
              type="submit"
              disabled={submitting || totalEnteredQty === 0}
              className={`w-full py-4 rounded-2xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 transition shadow-xl disabled:opacity-50 ${
                selectedType === 'Delivery'
                  ? selectedDeliverySub === 'Outsource'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-600/20'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Transaction & Syncing Database...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {selectedType === 'Delivery'
                      ? selectedDeliverySub === 'Outsource'
                        ? `Save Outsource Delivery (-${totalEnteredQty.toLocaleString()} pcs Target)`
                        : `Save Permanent Delivery (-${totalEnteredQty.toLocaleString()} pcs Balance)`
                      : `Save Received Batch (+${totalEnteredQty.toLocaleString()} pcs)`}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN (COL 8-12): FIXED QR SCANNER INTERFACE       */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-24 rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl space-y-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Fixed QR / Barcode Scanner
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Live Video Viewport & Hardware Scanner Receiver
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={cameraActive ? stopCamera : startCamera}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                  cameraActive
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                }`}
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Cam</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Camera</span>
                  </>
                )}
              </button>
            </div>

            {/* SCANNER VIEWPORT */}
            <div className="relative h-44 rounded-2xl bg-slate-950 border-2 border-dashed border-cyan-500/40 flex flex-col items-center justify-center overflow-hidden group">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <div className="flex items-center gap-1 opacity-70">
                    <div className="w-1.5 h-12 bg-cyan-400"></div>
                    <div className="w-0.5 h-12 bg-cyan-400"></div>
                    <div className="w-2.5 h-12 bg-cyan-400"></div>
                    <div className="w-1 h-12 bg-cyan-400"></div>
                    <div className="w-3 h-12 bg-cyan-400"></div>
                    <div className="w-0.5 h-12 bg-cyan-400"></div>
                    <div className="w-2 h-12 bg-cyan-400"></div>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                    Scan Gun Laser Sensor Active
                  </span>
                </div>
              )}

              {/* Animated Laser Beam */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_#22d3ee] animate-pulse"></div>

              {/* Crosshair Overlay */}
              <div className="absolute inset-4 border border-cyan-500/20 rounded-xl pointer-events-none flex items-center justify-center">
                <Scan className="w-10 h-10 text-cyan-400/40 animate-pulse" />
              </div>
            </div>

            {/* Scanner Status Indicator */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono text-cyan-400 text-[11px] truncate">{scannerStatus}</span>
              {lastScannedCode && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Last: {lastScannedCode}
                </span>
              )}
            </div>

            {/* Manual Barcode / Scanner Gun Catch Field */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProcessScan();
              }}
              className="space-y-1.5"
            >
              <label className="text-[11px] font-bold text-slate-400 uppercase">
                Hardware Scanner Input / Manual Entry:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan or enter PO / Barcode..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                />
                <button
                  type="submit"
                  disabled={!barcodeInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  Lookup
                </button>
              </div>
            </form>

            {/* Quick Test Presets */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Quick Test Verified POs:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {testBarcodes.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => handleProcessScan(preset.code)}
                    className="p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-left transition group"
                  >
                    <div className="font-mono text-[11px] font-bold text-cyan-400 group-hover:text-cyan-300 truncate">
                      {preset.code}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {preset.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TRANSACTION AUDIT LOG & HISTORY TABLE                     */}
      {/* ========================================================= */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl space-y-4 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Delivery & Received Transaction Ledger</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                {filteredLogs.length} Records
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Complete real-time log of Outsource Dispatches, Permanent Customer Deliveries, and Inbound Receipts.
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Delivery">Deliveries</option>
              <option value="Received">Received</option>
            </select>

            <select
              value={filterPartner}
              onChange={(e) => setFilterPartner(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Partners</option>
              <option value="Saroja">Saroja</option>
              <option value="Anoja">Anoja</option>
              <option value="Iresh">Iresh</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ledger..."
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Sub-Category</th>
                <th className="py-3 px-4">Partner / Destination</th>
                <th className="py-3 px-4">PO #</th>
                <th className="py-3 px-4">Colour</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Calculation Impact</th>
                <th className="py-3 px-4">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                    No transactions found in ledger matching your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isDelivery = log.type === 'Delivery';
                  const isOutsource = log.subCategory === 'Outsource';
                  const isPermanent = log.subCategory === 'Permanent';

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(log.timestamp || log.date).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isDelivery
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          }`}
                        >
                          {log.type}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isOutsource
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : isPermanent
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {log.subCategory || 'Received'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                        {log.outsourcePartner || '-'}
                      </td>

                      <td className="py-3 px-4 font-bold text-cyan-400 whitespace-nowrap">
                        {log.poNumber}
                      </td>

                      <td className="py-3 px-4 text-slate-300 font-sans whitespace-nowrap">
                        {log.colour || '-'}
                      </td>

                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                        {log.size}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-white whitespace-nowrap">
                        {formatNumber(log.qty)} pcs
                      </td>

                      <td className="py-3 px-4 text-[11px] font-sans whitespace-nowrap text-slate-300">
                        {log.calculationEffect || (
                          isOutsource
                            ? `Deducted ${formatNumber(log.qty)} pcs from Day's Target`
                            : isPermanent
                            ? `Deducted ${formatNumber(log.qty)} pcs from System Balance`
                            : `Received ${formatNumber(log.qty)} pcs`
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-sans whitespace-nowrap text-[11px]">
                        {log.handlerName || 'Operator'}
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
  );
}
