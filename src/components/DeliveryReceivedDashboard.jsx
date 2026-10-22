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
  Cpu,
  RotateCcw,
  Edit2,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import { resolveProductionHost } from '../utils/urlHelper';

export default function DeliveryReceivedDashboard({ onShowToast, onNavigateToView, theme = 'dark' }) {
  // 1. Multi-Step Workflow State
  // Type: 'Delivery' | 'Received'
  const [selectedType, setSelectedType] = useState('Delivery');

  // Outsource Consignments (Awaiting Return on Received Page)
  const [consignments, setConsignments] = useState([]);
  const [receivingConsignmentId, setReceivingConsignmentId] = useState(null);
  const [receiveInputQty, setReceiveInputQty] = useState({});
  const [receiveHandler, setReceiveHandler] = useState('Store Inbound');
  const [receiveNotes, setReceiveNotes] = useState('');

  // Delivery Sub-Category: 'Outsource' | 'Permanent'
  const [selectedDeliverySub, setSelectedDeliverySub] = useState('Outsource');

  // Outsource Partner: 'Saroja' | 'Anoja' | 'Iresh'
  const [selectedPartner, setSelectedPartner] = useState('Saroja');

  // Received Source: 'Saroja' | 'Anoja' | 'Iresh' | 'Factory'
  const [receivedSource, setReceivedSource] = useState('Saroja');

  // 2. Orders, Machines & Selection State
  const [orders, setOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activeMachine, setActiveMachine] = useState(null);
  const [selectedPo, setSelectedPo] = useState('4502991550');
  const [selectedColour, setSelectedColour] = useState('Black 093 54A2');
  // Staged entries map: key = `${poNumber}__${colour}__${size}` => quantity
  const [stagedEntries, setStagedEntries] = useState({});
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

  // Edit Transaction Modal State
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editPartner, setEditPartner] = useState('Saroja');
  const [editSubCategory, setEditSubCategory] = useState('Outsource');
  const [editHandler, setEditHandler] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Load orders, machines, transaction history, and active outsource consignments
  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, logsRes, machinesRes, consignmentsRes] = await Promise.all([
        api.getOrders({ limit: 100 }),
        api.getDeliveryReceivedLogs(),
        api.getMachines().catch(() => ({ success: false })),
        api.getOutsourceConsignments().catch(() => ({ success: false, data: [] })),
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

      if (machinesRes && machinesRes.data) {
        setMachines(machinesRes.data);
      }

      if (consignmentsRes && consignmentsRes.data) {
        setConsignments(consignmentsRes.data);
      }
    } catch (err) {
      console.error('Error loading delivery/received data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Confirm Inbound Return of Outsource Consignment (with customizable pieces for partial return)
  const handleConfirmReturn = async (consignment) => {
    if (!consignment) return;
    const defaultPcs = Number(consignment.remainingQty) || 0;
    const entered = receiveInputQty[consignment.id];
    const returnQty = entered !== undefined && entered !== '' ? Number(entered) : defaultPcs;

    if (!returnQty || returnQty <= 0) {
      if (onShowToast) onShowToast('Please enter a valid piece count greater than 0', 'error');
      return;
    }

    try {
      setReceivingConsignmentId(consignment.id);
      const res = await api.receiveOutsourceConsignment(consignment.id, {
        receivedQty: returnQty,
        handlerName: receiveHandler || 'Store Inbound',
        notes: receiveNotes || `Outsource batch return from ${consignment.partner}`,
      });

      if (res && res.success) {
        playBeep();
        if (onShowToast) onShowToast(res.message || `Received ${returnQty.toLocaleString()} pcs from ${consignment.partner}!`, 'success');
        setReceiveInputQty((prev) => {
          const next = { ...prev };
          delete next[consignment.id];
          return next;
        });
        await loadData();
      } else {
        if (onShowToast) onShowToast(res?.message || 'Failed to confirm return', 'error');
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Error confirming return', 'error');
    } finally {
      setReceivingConsignmentId(null);
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

  // Switch PO & auto-select its first colour (without resetting entered quantities)
  const handleSelectPo = (po) => {
    setSelectedPo(po);
    const poItems = orders.filter((o) => o.poNumber === po);
    if (
      poItems.length > 0 &&
      (!selectedColour || !poItems.some((o) => o.colour.toLowerCase() === selectedColour.toLowerCase()))
    ) {
      setSelectedColour(poItems[0].colour);
    }
  };

  const getEntryKey = (po, col, sz) => `${po}__${col}__${sz}`;

  // Get current quantity for a size under selected PO & Colour
  const getSizeQuantity = (size) => {
    const key = getEntryKey(selectedPo, selectedColour, size);
    return stagedEntries[key] || '';
  };

  // Handle quantity changes for a specific size under current PO & Colour
  const handleQuantityChange = (size, val) => {
    const cleanNum = val.replace(/[^0-9]/g, '');
    const key = getEntryKey(selectedPo, selectedColour, size);
    setStagedEntries((prev) => {
      const next = { ...prev };
      if (!cleanNum || cleanNum === '0') {
        delete next[key];
      } else {
        next[key] = cleanNum;
      }
      return next;
    });
  };

  // Quick add helper
  const handleQuickAdd = (size, delta) => {
    const key = getEntryKey(selectedPo, selectedColour, size);
    const current = Number(stagedEntries[key]) || 0;
    const nextVal = Math.max(0, current + delta);
    setStagedEntries((prev) => {
      const next = { ...prev };
      if (nextVal <= 0) {
        delete next[key];
      } else {
        next[key] = String(nextVal);
      }
      return next;
    });
  };

  // Fill maximum balance
  const handleFillMaxBalance = (size, balance) => {
    const key = getEntryKey(selectedPo, selectedColour, size);
    setStagedEntries((prev) => ({
      ...prev,
      [key]: String(balance),
    }));
  };

  // Remove a single staged entry
  const handleRemoveStagedItem = (keyToRemove) => {
    setStagedEntries((prev) => {
      const next = { ...prev };
      delete next[keyToRemove];
      return next;
    });
  };

  // Explicitly clear all entered quantities
  const handleClearInputs = () => {
    setStagedEntries({});
    if (onShowToast) onShowToast('Reset all staged quantities', 'info');
  };

  // All staged items across any PO, Colour, and Size
  const allStagedItems = Object.entries(stagedEntries)
    .filter(([_, q]) => Number(q) > 0)
    .map(([key, q]) => {
      const [po, col, sz] = key.split('__');
      const orderMatch = orders.find(
        (o) =>
          o.poNumber === po &&
          (o.colour || '').toLowerCase() === (col || '').toLowerCase() &&
          String(o.size) === String(sz)
      );
      return {
        key,
        poNumber: po,
        colour: col,
        size: sz,
        qty: Number(q),
        orderMatch,
      };
    });

  // Total calculated pieces across ALL staged items
  const totalEnteredQty = allStagedItems.reduce((sum, item) => sum + item.qty, 0);

  // Helper to count entered pieces for a specific colour under current PO
  const getColourEnteredQty = (col) => {
    return allStagedItems
      .filter(
        (item) => item.poNumber === selectedPo && (item.colour || '').toLowerCase() === (col || '').toLowerCase()
      )
      .reduce((sum, item) => sum + item.qty, 0);
  };

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
      setScannerStatus('Camera Live • Position Machine / PO QR in frame');
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

  // Process Scanned Code (Machine QR / PO QR / Barcode / Test Preset)
  const handleProcessScan = (codeRaw) => {
    const rawInput = (codeRaw || barcodeInput || '').trim();
    if (!rawInput) return;

    playBeep();
    setLastScannedCode(rawInput);

    // 1. Extract Machine Code or PO Number from URLs or Raw Strings
    let candidateCode = rawInput;
    let urlMachine = null;
    let urlPo = null;

    try {
      if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
        const parsedUrl = new URL(rawInput);
        urlMachine = parsedUrl.searchParams.get('machine');
        urlPo = parsedUrl.searchParams.get('po') || parsedUrl.searchParams.get('order');
      } else if (rawInput.includes('machine=')) {
        const match = rawInput.match(/machine=([^&#\s]+)/i);
        if (match) urlMachine = decodeURIComponent(match[1]);
      } else if (rawInput.includes('po=')) {
        const match = rawInput.match(/po=([^&#\s]+)/i);
        if (match) urlPo = decodeURIComponent(match[1]);
      }
    } catch {
      // Continue with raw text
    }

    const machineSearchTerm = (urlMachine || candidateCode).trim().toLowerCase();

    // 2. Machine QR Detection & Auto-Binding
    const matchedMachine = machines.find((m) => {
      return (
        (m.code && m.code.toLowerCase() === machineSearchTerm) ||
        (m.id && m.id.toLowerCase() === machineSearchTerm) ||
        (m.name && m.name.toLowerCase() === machineSearchTerm) ||
        (m.qrPayload && m.qrPayload.toLowerCase() === machineSearchTerm)
      );
    });

    if (matchedMachine) {
      setActiveMachine(matchedMachine);
      if (matchedMachine.operatorName) {
        setHandlerName(matchedMachine.operatorName);
      }

      // Auto-assign matching PO & Colour from machine's assigned scope
      let targetPo = null;
      if (matchedMachine.assignedPos && matchedMachine.assignedPos.length > 0) {
        targetPo = matchedMachine.assignedPos.find((p) => orders.some((o) => o.poNumber === p));
      }
      if (!targetPo && matchedMachine.category) {
        const catOrder = orders.find(
          (o) => (o.category || '').toLowerCase() === matchedMachine.category.toLowerCase()
        );
        if (catOrder) targetPo = catOrder.poNumber;
      }
      if (!targetPo && orders.length > 0) {
        targetPo = orders[0].poNumber;
      }

      if (targetPo) {
        setSelectedPo(targetPo);
        const poOrders = orders.filter((o) => o.poNumber === targetPo);
        const machineCol = (matchedMachine.assignedColours || []).find((c) =>
          poOrders.some((o) => o.colour.toLowerCase() === c.toLowerCase())
        );
        if (machineCol) {
          setSelectedColour(machineCol);
        } else if (poOrders.length > 0) {
          setSelectedColour(poOrders[0].colour);
        }
      }

      setScannerStatus(`✅ Station Linked: ${matchedMachine.name} (${matchedMachine.code})`);
      if (onShowToast) {
        onShowToast(`Station Linked: ${matchedMachine.name} (${matchedMachine.code}) • Data Form Ready`, 'success');
      }
      setBarcodeInput('');
      return;
    }

    // 3. Purchase Order / Barcode Detection
    const poSearchTerm = (urlPo || candidateCode).trim();
    let matchedOrder = orders.find(
      (o) =>
        o.barcode === poSearchTerm ||
        o.poNumber === poSearchTerm ||
        o.id === poSearchTerm
    );

    if (!matchedOrder && poSearchTerm.includes('-')) {
      const parts = poSearchTerm.split('-');
      const possiblePo = parts.find((p) => orders.some((o) => o.poNumber === p));
      if (possiblePo) {
        matchedOrder = orders.find((o) => o.poNumber === possiblePo);
      }
    }

    if (matchedOrder) {
      setSelectedPo(matchedOrder.poNumber);
      setSelectedColour(matchedOrder.colour);
      if (matchedOrder.size) {
        const key = getEntryKey(matchedOrder.poNumber, matchedOrder.colour, matchedOrder.size);
        setStagedEntries((prev) => ({
          ...prev,
          [key]: prev[key] || '100',
        }));
      }
      setScannerStatus(`✅ Scanned PO #${matchedOrder.poNumber} (${matchedOrder.colour})`);
      if (onShowToast) {
        onShowToast(`Scanned: PO ${matchedOrder.poNumber} • ${matchedOrder.colour} (Size ${matchedOrder.size})`, 'success');
      }
    } else {
      setScannerStatus(`⚠️ Unrecognized QR / Barcode: '${rawInput}'`);
      if (onShowToast) onShowToast(`Unrecognized barcode or machine QR: ${rawInput}`, 'error');
    }

    setBarcodeInput('');
  };

  // Form Submission
  const handleSubmitTransaction = async (e) => {
    e.preventDefault();

    if (allStagedItems.length === 0) {
      if (onShowToast) onShowToast('Please enter a quantity for at least one size before saving', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const items = allStagedItems.map((item) => ({
        poNumber: item.poNumber,
        colour: item.colour,
        size: item.size,
        qty: item.qty,
      }));

      const payload = {
        type: selectedType,
        subCategory: selectedType === 'Delivery' ? selectedDeliverySub : 'Received',
        outsourcePartner:
          selectedType === 'Delivery' && selectedDeliverySub === 'Outsource'
            ? selectedPartner
            : selectedType === 'Received'
            ? receivedSource
            : null,
        poNumber: selectedPo,
        colour: selectedColour,
        items,
        notes: activeMachine ? `${notes ? notes + ' | ' : ''}[Station: ${activeMachine.name}]` : notes,
        handlerName,
      };

      const res = await api.recordDeliveryReceived(payload);

      if (res && res.success) {
        playBeep();
        const effectMsg =
          selectedType === 'Delivery'
            ? selectedDeliverySub === 'Outsource'
              ? `Deducted ${totalEnteredQty.toLocaleString()} pcs from Day's Target (Outsourced to ${selectedPartner})`
              : `Deducted ${totalEnteredQty.toLocaleString()} pcs from System Balance & Product Quantity (Permanent Dispatch)`
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

        // Reset entered quantities upon successful transaction
        setStagedEntries({});
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

  // Open Edit Modal for a Transaction
  const handleOpenEdit = (log) => {
    setEditingTransaction(log);
    setEditQty(String(log.qty || ''));
    setEditPartner(log.outsourcePartner || 'Saroja');
    setEditSubCategory(log.subCategory || 'Outsource');
    setEditHandler(log.handlerName || '');
    setEditNotes(log.notes || '');
  };

  // Save Transaction Edits & Re-synchronize Database Balances
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTransaction) return;
    const num = Number(editQty);
    if (!num || num <= 0) {
      if (onShowToast) onShowToast('Please enter a valid quantity greater than zero', 'error');
      return;
    }

    try {
      setSavingEdit(true);
      const res = await api.updateDeliveryReceived(editingTransaction.id, {
        qty: num,
        outsourcePartner: editPartner,
        subCategory: editSubCategory,
        handlerName: editHandler,
        notes: editNotes,
      });

      if (res && res.success) {
        playBeep();
        if (onShowToast) onShowToast(res.message || 'Transaction updated and balances recalculated!', 'success');
        setEditingTransaction(null);
        await loadData();
      } else {
        if (onShowToast) onShowToast(res?.message || 'Failed to update transaction', 'error');
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Error updating transaction', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Transaction & Reverse Impacts
  const handleDeleteTransaction = async (log) => {
    const confirmMsg = `Are you sure you want to delete transaction #${log.id} (${formatNumber(log.qty)} pcs of PO ${log.poNumber}, Size ${log.size})?\n\nThis will permanently reverse the deduction and restore the quantity back to balances!`;
    if (window.confirm(confirmMsg)) {
      try {
        setLoading(true);
        const res = await api.deleteDeliveryReceived(log.id);
        if (res && res.success) {
          playBeep();
          if (onShowToast) onShowToast(res.message || `Transaction #${log.id} deleted. Balances reversed!`, 'success');
          await loadData();
        } else {
          if (onShowToast) onShowToast(res?.message || 'Failed to delete transaction', 'error');
        }
      } catch (err) {
        if (onShowToast) onShowToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Test Barcodes & Machine Presets
  const testBarcodes = [
    { label: 'Station: MCH-01 (Loop 01)', code: 'MCH-01', type: 'machine' },
    { label: 'Station: MCH-CUT (Cutting)', code: 'MCH-CUT', type: 'machine' },
    { label: 'Station: MCH-PUS (Pusing)', code: 'MCH-PUS', type: 'machine' },
    { label: 'Station: MCH-IRN (Iron)', code: 'MCH-IRN', type: 'machine' },
    { label: 'Station: MCH-CMP (Compress)', code: 'MCH-CMP', type: 'machine' },
    { label: 'Station: MCH-DRY (Dry Cut)', code: 'MCH-DRY', type: 'machine' },
    { label: 'QR URL (?machine=MCH-01)', code: '/?view=worker&machine=MCH-01', type: 'machine' },
    { label: 'PO 4502991550 (Black)', code: '4502991550', type: 'po' },
    { label: 'PO 4502991532 (Marzipan)', code: '4502991532', type: 'po' },
    { label: 'PO 4502991599 (Praline)', code: '4502991599', type: 'po' },
    { label: 'PO 4502991520 (Ganache)', code: '4502991520', type: 'po' },
    { label: 'PO 4502991562 (Talc)', code: '4502991562', type: 'po' },
    { label: 'Full Barcode (Sz 10)', code: 'BTX-4502991550-10', type: 'po' },
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
            {/* ACTIVE SCANNED MACHINE / STATION BADGE */}
            {activeMachine && (
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Station: {activeMachine.name}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-300 border border-cyan-500/40">
                        {activeMachine.code || activeMachine.id}
                      </span>
                    </div>
                    <div className="text-[11px] text-cyan-300/80 mt-0.5">
                      Operator: <strong className="text-white">{activeMachine.operatorName || 'Floor Operator'}</strong> • {activeMachine.category} Division • {activeMachine.shift || 'Shift A'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMachine(null)}
                  className="self-start sm:self-auto text-[11px] text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition"
                >
                  Unlink Station
                </button>
              </div>
            )}

            {/* STEP 1: INITIAL SELECTION (Delivery vs Received) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Step 1: Initial Selection</span>
                </label>
                <div className="flex items-center gap-2">
                  {totalEnteredQty > 0 && (
                    <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                      Preserved: {totalEnteredQty.toLocaleString()} pcs
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">Choose Transaction Type</span>
                </div>
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
                      <div className="text-[10px] text-emerald-400 font-semibold">Deducts from Balance & Product Qty</div>
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

            {/* STEP 3B: RECEIVED SOURCE & OUTSOURCE CONSIGNMENTS SELECTION (if Received) */}
            {selectedType === 'Received' && (
              <div className="space-y-4 pt-4 border-t border-slate-800 animate-fade-in">
                {/* ACTIVE OUTSOURCE CONSIGNMENTS AWAITING RETURN */}
                <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <ArrowDownToLine className="w-4 h-4 text-purple-400" />
                        <span>Active Outsource Consignments (Awaiting Return)</span>
                      </h4>
                      <p className="text-[11px] text-purple-300/80 mt-0.5">
                        Track dispatched lots sent to Saroja, Anoja, & Iresh. Confirm returned pieces below (supports partial returns).
                      </p>
                    </div>
                    <span className="self-start sm:self-auto text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-500/30">
                      {(consignments || []).filter((c) => c.status !== 'Completed').length} Pending Lots
                    </span>
                  </div>

                  {(consignments || []).filter((c) => c.status !== 'Completed').length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                      No pending outsource consignments awaiting return. All partner dispatches are reconciled!
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {(consignments || []).filter((c) => c.status !== 'Completed').map((c) => {
                        const defaultPcs = c.remainingQty;
                        const currentVal = receiveInputQty[c.id] !== undefined ? receiveInputQty[c.id] : defaultPcs;
                        const isSaving = receivingConsignmentId === c.id;

                        return (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/40 transition space-y-2.5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-lg bg-purple-600/20 text-purple-300 font-mono font-bold text-[11px] border border-purple-500/30">
                                  {c.partner}
                                </span>
                                <span className="font-mono text-white text-xs font-bold">
                                  PO #{c.poNumber}
                                </span>
                                <span className="text-slate-300 text-xs">
                                  {c.colour} (Sz {c.size})
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {c.dispatchDate}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs">
                                <div className="text-slate-400 text-[11px]">
                                  Sent: <strong className="text-white font-mono">{c.sentQty?.toLocaleString()}</strong>
                                </div>
                                <div className="text-emerald-400 text-[11px]">
                                  Received: <strong className="font-mono">{c.receivedQty?.toLocaleString()}</strong>
                                </div>
                                <div className="text-amber-400 text-[11px]">
                                  Pending: <strong className="font-mono">{c.remainingQty?.toLocaleString()}</strong> pcs
                                </div>
                              </div>
                            </div>

                            {/* Return Confirmation Inputs */}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                              <div className="flex-1 flex items-center gap-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                                  Returned Pcs:
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={currentVal}
                                  onChange={(e) =>
                                    setReceiveInputQty((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Enter returned pieces..."
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-purple-200 font-mono font-bold focus:outline-none focus:border-purple-500"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleConfirmReturn(c)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 shadow-md shadow-emerald-600/20 shrink-0"
                              >
                                {isSaving ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirm Receipt</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* MANUAL AD-HOC INBOUND SECTION */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                        2
                      </span>
                      <span>Or Manual Inbound Entry (Ad-hoc Source):</span>
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
                <div className="flex items-center gap-2">
                  {totalEnteredQty > 0 && (
                    <button
                      type="button"
                      onClick={handleClearInputs}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold hover:bg-rose-500/25 transition"
                      title="Clear entered quantities"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Quantities</span>
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400">PO, Colour & Sizes</span>
                </div>
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

              {/* Colour Selector with Multi-Selection Quantities Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400">
                    Select Product Colour:
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Tap to switch colour without losing entered quantities
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColours.map((col) => {
                    const enteredForCol = getColourEnteredQty(col);
                    const isSelected = selectedColour.toLowerCase() === col.toLowerCase();
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setSelectedColour(col)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-1 ring-blue-300'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>{col}</span>
                        {enteredForCol > 0 && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                              isSelected ? 'bg-white text-blue-900' : 'bg-cyan-500/20 text-cyan-300'
                            }`}
                          >
                            +{enteredForCol.toLocaleString()} pcs
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Size Quantity Input Grid */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Enter Quantities for Available Sizes (pcs):</span>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    Total: {totalEnteredQty.toLocaleString()} pcs (Preserved)
                  </span>
                </label>

                <div className="space-y-2">
                  {currentSizeOrders.map((orderRow) => {
                    const size = String(orderRow.size);
                    const qtyVal = getSizeQuantity(size);
                    const orderQty = Number(orderRow.orderQty) || 0;
                    const productionQty = Number(orderRow.productionQty) || 0;
                    const calculatedBalance = Math.max(0, orderQty - productionQty);

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
                              Plan: {formatNumber(orderQty)} | Actual: {formatNumber(productionQty)} | Balance: <span className="text-amber-400 font-bold">{formatNumber(calculatedBalance)}</span> pcs
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
                              onClick={() => handleFillMaxBalance(size, calculatedBalance)}
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

              {/* STAGED DISPATCH ITEMS REVIEW PANEL (Holds entries across multiple colours/sizes) */}
              {allStagedItems.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Staged Dispatch Review ({allStagedItems.length} line items)
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                      Batch Total: {totalEnteredQty.toLocaleString()} pcs
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {allStagedItems.map((item) => (
                      <div
                        key={item.key}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="px-2 py-0.5 rounded-lg bg-blue-600/20 text-blue-300 font-mono font-bold text-[11px] border border-blue-500/30">
                            PO #{item.poNumber}
                          </span>
                          <span className="text-slate-300 font-medium truncate">
                            {item.colour}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono font-bold text-[11px]">
                            Sz {item.size}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-black text-cyan-300">
                            {item.qty.toLocaleString()} pcs
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveStagedItem(item.key)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Remove from batch"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                    from the <strong>Day's Target</strong>. Production Qty & System Balance are NOT reduced (goods are sent outside and logged for return in the Received page).
                  </div>
                ) : (
                  <div className="text-xs text-emerald-300/90 leading-relaxed">
                    📦 <strong>Permanent Delivery (Customer Dispatch)</strong>: Deducts{' '}
                    <span className="font-mono font-bold text-white">
                      {totalEnteredQty.toLocaleString()} pcs
                    </span>{' '}
                    from the <strong>Remaining Balance</strong> to fulfill the order! (Manufactured Production Qty is preserved).
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
                <div className="flex flex-col items-center justify-center p-3 text-center space-y-2">
                  <div className="p-2 rounded-xl bg-white shadow-lg inline-block">
                    <QRCodeSVG
                      value={`${resolveProductionHost()}/?view=delivery-received`}
                      size={110}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-cyan-300 font-bold block">
                      Delivery & Received Direct QR
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Scan with mobile to open this workflow
                    </span>
                  </div>
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
                Quick Test Machines & POs:
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {testBarcodes.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => handleProcessScan(preset.code)}
                    className="p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-left transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-cyan-400 group-hover:text-cyan-300 truncate">
                        {preset.code}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        preset.type === 'machine' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {preset.type === 'machine' ? 'Machine' : 'PO'}
                      </span>
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
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 text-xs">
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
                            ? `Deducted ${formatNumber(log.qty)} pcs from System Balance & Product Qty`
                            : `Received ${formatNumber(log.qty)} pcs`
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-sans whitespace-nowrap text-[11px]">
                        {log.handlerName || 'Operator'}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(log)}
                            className="p-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition shadow-sm active:scale-95"
                            title="Edit Transaction Quantity / Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(log)}
                            className="p-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 transition shadow-sm active:scale-95"
                            title="Delete Transaction & Reverse Balances"
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

      {/* ========================================================= */}
      {/* EDIT TRANSACTION MODAL & BALANCE RECONCILIATION DIALOG    */}
      {/* ========================================================= */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Edit Transaction #{editingTransaction.id}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    PO #{editingTransaction.poNumber} • {editingTransaction.colour} • Size {editingTransaction.size}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTransaction(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Transaction Type Info */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block uppercase">Transaction Type</span>
                  <span className="font-bold text-white">
                    {editingTransaction.type} ({editingTransaction.subCategory || 'Standard'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">Originally Recorded</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {formatNumber(editingTransaction.qty)} pcs
                  </span>
                </div>
              </div>

              {/* 1. Adjusted Quantity Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Adjust Quantity (pcs):
                </label>
                <input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono font-black text-lg focus:outline-none focus:border-blue-500"
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Difference:{' '}
                  <span
                    className={
                      Number(editQty) > Number(editingTransaction.qty)
                        ? 'text-amber-400 font-bold'
                        : 'text-emerald-400 font-bold'
                    }
                  >
                    {Number(editQty) - Number(editingTransaction.qty) >= 0 ? '+' : ''}
                    {Number(editQty) - Number(editingTransaction.qty)} pcs
                  </span>{' '}
                  (system balances and quotas will be automatically reversed and reconciled)
                </div>
              </div>

              {/* 2. Sub-Category Selector if Delivery */}
              {editingTransaction.type === 'Delivery' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Delivery Sub-Category:
                  </label>
                  <select
                    value={editSubCategory}
                    onChange={(e) => setEditSubCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                  >
                    <option value="Outsource">Outsource (Deducts from Day's Target)</option>
                    <option value="Permanent">Permanent (Deducts from Balance & Product Qty)</option>
                  </select>
                </div>
              )}

              {/* 3. Partner / Unit */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Partner / Unit Destination:
                </label>
                <select
                  value={editPartner}
                  onChange={(e) => setEditPartner(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="Saroja">Saroja</option>
                  <option value="Anoja">Anoja</option>
                  <option value="Iresh">Iresh</option>
                  <option value="Factory">Factory</option>
                </select>
              </div>

              {/* 4. Operator Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Operator / Handler Name:
                </label>
                <input
                  type="text"
                  value={editHandler}
                  onChange={(e) => setEditHandler(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 5. Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Reference Notes:
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit || !editQty || Number(editQty) <= 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Recalculating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save & Update Balances</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
