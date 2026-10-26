import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Layers,
  Scissors,
  Download,
  Printer,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  ChevronDown,
  Percent,
  Hash,
  Ruler,
  TrendingUp,
  PackageCheck,
  Search,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';

// Base Engineering Constants
export const STRIP_BASE_LENGTH_MM = 1350; // 1350 mm
export const STRIP_BASE_LENGTH_M = 1.35; // 1.35 meters

export const SIZES = ['10', '12', '14', '16', '18'];

export const MATERIAL_SPECS = {
  '10': {
    size: '10',
    yieldPerStrip: 70, // Size 10: 70 pcs per 1350mm strip
    tapeA: '9mm',
    tapeB: '16mm',
    tapeAWidthMm: 9,
    tapeBWidthMm: 16,
  },
  '12': {
    size: '12',
    yieldPerStrip: 65, // Size 12: 65 pcs per 1350mm strip
    tapeA: '10mm',
    tapeB: '17mm',
    tapeAWidthMm: 10,
    tapeBWidthMm: 17,
  },
  '14': {
    size: '14',
    yieldPerStrip: 58, // Size 14: 58 pcs per 1350mm strip
    tapeA: '11mm',
    tapeB: '18mm',
    tapeAWidthMm: 11,
    tapeBWidthMm: 18,
  },
  '16': {
    size: '16',
    yieldPerStrip: 61, // Size 16: 61 pcs per 1350mm strip
    tapeA: '12mm',
    tapeB: '19mm',
    tapeAWidthMm: 12,
    tapeBWidthMm: 19,
  },
  '18': {
    size: '18',
    yieldPerStrip: 48, // Size 18: 48 pcs per 1350mm strip
    tapeA: '13mm',
    tapeB: '20mm',
    tapeAWidthMm: 13,
    tapeBWidthMm: 20,
  },
};

export default function MaterialCalculationDashboard({
  onBackToDashboard,
  onShowToast,
  theme = 'dark',
}) {
  // Mode: 'Loop Strips' | 'Adhesive Tape'
  const [selectedMaterial, setSelectedMaterial] = useState('Loop Strips');
  // Selected Size: '10' | '12' | '14' | '16' | '18'
  const [selectedSize, setSelectedSize] = useState('10');
  // Order Quantity in pcs
  const [orderQty, setOrderQty] = useState(1000);
  // View layout: 'single' | 'batch'
  const [calcView, setCalcView] = useState('single');

  // Batch Mode quantities for all 5 sizes
  const [batchQuantities, setBatchQuantities] = useState({
    '10': 1000,
    '12': 1000,
    '14': 1000,
    '16': 1000,
    '18': 1000,
  });

  // Active orders from system for optional pre-fill
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedPoPreload, setSelectedPoPreload] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load existing orders to allow pre-filling order quantities
  useEffect(() => {
    let isMounted = true;
    api.getOrders({ limit: 50 })
      .then((res) => {
        if (isMounted && res && res.orders) {
          setActiveOrders(res.orders);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Pre-fill quantity and size from an existing system order
  const handlePreloadOrder = (poNum) => {
    setSelectedPoPreload(poNum);
    if (!poNum) return;
    const match = activeOrders.find((o) => o.poNumber === poNum || o.id === poNum);
    if (match) {
      const matchSize = String(match.size).trim();
      if (SIZES.includes(matchSize)) {
        setSelectedSize(matchSize);
      }
      const qty = Number(match.orderQty) || Number(match.balanceQty) || 1000;
      setOrderQty(qty);
      if (onShowToast) {
        onShowToast(`Loaded PO #${match.poNumber} (${match.colour || ''}, Size ${match.size}, ${qty.toLocaleString()} pcs)`, 'info');
      }
    }
  };

  // Current single calculation variables
  const currentSpec = MATERIAL_SPECS[selectedSize] || MATERIAL_SPECS['10'];
  const cleanOrderQty = Math.max(0, Number(orderQty) || 0);

  // Formula: Required Strips = Math.ceil(Order Quantity / pcs per strip for selected size)
  const requiredStrips = cleanOrderQty > 0 ? Math.ceil(cleanOrderQty / currentSpec.yieldPerStrip) : 0;
  const totalLinearMeters = (requiredStrips * STRIP_BASE_LENGTH_M).toFixed(2);
  const potentialPiecesCapacity = requiredStrips * currentSpec.yieldPerStrip;
  const bufferPieces = Math.max(0, potentialPiecesCapacity - cleanOrderQty);

  // Adhesive Tape specific metrics for current selected size
  const tapeAStrips = requiredStrips;
  const tapeAMeters = (tapeAStrips * STRIP_BASE_LENGTH_M).toFixed(2);
  const tapeBStrips = requiredStrips;
  const tapeBMeters = (tapeBStrips * STRIP_BASE_LENGTH_M).toFixed(2);
  const totalCombinedTapeStrips = tapeAStrips + tapeBStrips;
  const totalCombinedTapeMeters = (Number(tapeAMeters) + Number(tapeBMeters)).toFixed(2);

  // Quick Quantity Presets
  const handleQuickAdd = (delta) => {
    setOrderQty((prev) => Math.max(0, (Number(prev) || 0) + delta));
  };

  const handleSetExact = (val) => {
    setOrderQty(val);
  };

  // Batch calculations across all sizes
  const batchCalculations = SIZES.map((sz) => {
    const spec = MATERIAL_SPECS[sz];
    const qty = Math.max(0, Number(batchQuantities[sz]) || 0);
    const strips = qty > 0 ? Math.ceil(qty / spec.yieldPerStrip) : 0;
    const meters = Number((strips * STRIP_BASE_LENGTH_M).toFixed(2));
    const totalCapacity = strips * spec.yieldPerStrip;
    const surplus = Math.max(0, totalCapacity - qty);
    return {
      size: sz,
      spec,
      qty,
      strips,
      meters,
      totalCapacity,
      surplus,
      tapeA: spec.tapeA,
      tapeB: spec.tapeB,
      tapeMetersEach: meters,
      combinedTapeMeters: Number((meters * 2).toFixed(2)),
    };
  });

  const batchTotals = {
    totalQty: batchCalculations.reduce((sum, item) => sum + item.qty, 0),
    totalStrips: batchCalculations.reduce((sum, item) => sum + item.strips, 0),
    totalMeters: Number(batchCalculations.reduce((sum, item) => sum + item.meters, 0).toFixed(2)),
    totalTapeMeters: Number(batchCalculations.reduce((sum, item) => sum + item.combinedTapeMeters, 0).toFixed(2)),
  };

  // Generate and Download PDF Report
  const handleDownloadPdf = () => {
    try {
      setGeneratingPdf(true);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // 1. Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 36, 'F');

      // Decorative accent line
      doc.setFillColor(56, 189, 248); // sky-400
      doc.rect(0, 36, 210, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('BONDTEX APPAREL & NARROW FABRIC MANUFACTURING', 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('MES MATERIAL CONSUMPTION & YIELD CALCULATION REPORT', 14, 23);
      doc.text(`Generated: ${todayStr} ${timeStr} | Base Strip Length: 1,350 mm (1.35 m)`, 14, 29);

      // 2. Metadata Box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(14, 43, 182, 28, 3, 3, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('REPORT PARAMETERS & SPECIFICATIONS', 18, 50);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(`Material Type: ${selectedMaterial}`, 18, 57);
      doc.text(`Selected Size: Size ${selectedSize}`, 18, 64);

      doc.text(`Order Quantity: ${cleanOrderQty.toLocaleString()} pcs`, 95, 57);
      doc.text(`Yield per 1350mm Strip: ${currentSpec.yieldPerStrip} pcs/strip`, 95, 64);

      doc.text(`Calculation Mode: ${calcView === 'single' ? 'Single Size' : 'Multi-Size Batch'}`, 150, 57);
      doc.text(`Formula: Math.ceil(Qty / Yield)`, 150, 64);

      // 3. Main Calculation Results Card
      let startY = 78;

      if (selectedMaterial === 'Loop Strips' || calcView === 'single') {
        doc.setFillColor(238, 242, 255); // indigo-50
        doc.setDrawColor(199, 210, 254); // indigo-200
        doc.roundedRect(14, startY, 182, 38, 3, 3, 'FD');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 27, 75); // indigo-950
        doc.text('LOOP STRIPS REQUIREMENTS (1350 mm)', 18, startY + 8);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);

        // Grid of 4 metrics
        doc.text('Required 1350mm Strips:', 18, startY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.text(`${requiredStrips.toLocaleString()} strips`, 18, startY + 25);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Total Linear Meters:', 70, startY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 148, 136); // teal-600
        doc.setFontSize(13);
        doc.text(`${totalLinearMeters} m`, 70, startY + 25);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Total Piece Capacity:', 120, startY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.text(`${potentialPiecesCapacity.toLocaleString()} pcs`, 120, startY + 25);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Surplus / Buffer Pieces:', 160, startY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235); // blue-600
        doc.setFontSize(12);
        doc.text(`+${bufferPieces.toLocaleString()} pcs`, 160, startY + 25);

        startY += 45;
      }

      // 4. Adhesive Tape Section if selected or included
      if (selectedMaterial === 'Adhesive Tape' || selectedMaterial === 'Loop Strips') {
        doc.setFillColor(254, 243, 199); // amber-50
        doc.setDrawColor(253, 230, 138); // amber-200
        doc.roundedRect(14, startY, 182, 38, 3, 3, 'FD');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(120, 53, 15); // amber-950
        doc.text(`ADHESIVE TAPE CONSUMPTION (Size ${selectedSize} requires ${currentSpec.tapeA} & ${currentSpec.tapeB})`, 18, startY + 8);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);

        // Tape A
        doc.text(`Tape Width A: ${currentSpec.tapeA}`, 18, startY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text(`${tapeAStrips.toLocaleString()} strips (${tapeAMeters} m)`, 18, startY + 25);

        // Tape B
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Tape Width B: ${currentSpec.tapeB}`, 85, startY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text(`${tapeBStrips.toLocaleString()} strips (${tapeBMeters} m)`, 85, startY + 25);

        // Total Adhesive
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Combined Adhesive Total:', 145, startY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(217, 119, 6); // amber-600
        doc.setFontSize(12);
        doc.text(`${totalCombinedTapeMeters} meters`, 145, startY + 25);

        startY += 45;
      }

      // 5. Complete Multi-Size Reference Table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('STANDARD FACTORY YIELD & ADHESIVE TAPE SPECIFICATION MATRIX', 14, startY + 4);

      // Table Header
      const thY = startY + 8;
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(14, thY, 182, 7, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Size', 18, thY + 5);
      doc.text('Strip Base Length', 35, thY + 5);
      doc.text('Yield / Strip', 70, thY + 5);
      doc.text('Adhesive Tape A', 105, thY + 5);
      doc.text('Adhesive Tape B', 140, thY + 5);
      doc.text('Status / Rule', 170, thY + 5);

      let rowY = thY + 7;
      SIZES.forEach((sz, idx) => {
        const spec = MATERIAL_SPECS[sz];
        const isCurrent = sz === selectedSize;

        if (isCurrent) {
          doc.setFillColor(224, 242, 254); // sky-100 highlight
        } else if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252); // slate-50
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.rect(14, rowY, 182, 6.5, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', isCurrent ? 'bold' : 'normal');
        if (isCurrent) {
          doc.setTextColor(2, 132, 199);
        } else {
          doc.setTextColor(30, 41, 59);
        }

        doc.text(`Size ${sz}`, 18, rowY + 4.5);
        doc.text('1,350 mm (1.35m)', 35, rowY + 4.5);
        doc.text(`${spec.yieldPerStrip} pcs / strip`, 70, rowY + 4.5);
        doc.text(`${spec.tapeA} (1350mm)`, 105, rowY + 4.5);
        doc.text(`${spec.tapeB} (1350mm)`, 140, rowY + 4.5);
        doc.text(isCurrent ? '★ Selected' : 'Standard', 170, rowY + 4.5);

        rowY += 6.5;
      });

      // 6. Signatures and Approval Section
      const signY = 240;
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);

      // Line 1: Prepared By
      doc.line(18, signY, 68, signY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Prepared By (Floor Supervisor)', 18, signY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Name / Emp ID: ________________', 18, signY + 9);

      // Line 2: Store / Material In-Charge
      doc.line(78, signY, 128, signY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Material / Store In-Charge', 78, signY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Issued Rolls: __________________', 78, signY + 9);

      // Line 3: Approved By
      doc.line(138, signY, 188, signY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Approved By (Plant Manager)', 138, signY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Signature & Date: _____________', 138, signY + 9);

      // 7. Footer
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('CONFIDENTIAL • BONDTEX APPAREL & NARROW FABRIC MANUFACTURING • AUTOMATED MES CALCULATION SUITE', 14, 280);
      doc.text('Formula Rule: Required Strips = Math.ceil(Order Quantity / Yield) • All rights reserved.', 14, 284);

      // Save PDF
      const filename = `Bondtex_Material_Calculation_${selectedMaterial.replace(/\s+/g, '_')}_Size${selectedSize}_${todayStr}.pdf`;
      doc.save(filename);

      if (onShowToast) {
        onShowToast(`Downloaded PDF calculation report: ${filename}`, 'success');
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      if (onShowToast) {
        onShowToast('Failed to export PDF: ' + err.message, 'error');
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ========================================================= */}
      {/* 1. TOP HEADER BANNER & STATS STRIP                        */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-950/70 via-slate-900 to-cyan-950/70 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-bold uppercase tracking-wider">
              <Calculator className="w-3.5 h-3.5" />
              <span>Material Consumption & Yield Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Strip & Tape Calculation</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
                Base: {STRIP_BASE_LENGTH_MM} mm
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Engineering yield computation for <strong>Loop Strips</strong> (70, 65, 58, 61, 48 pcs/strip) and dual-width <strong>Adhesive Tape</strong> allocation (9mm through 20mm) across all garment sizes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher: Single Size vs Batch Matrix */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCalcView('single')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  calcView === 'single'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Single Calculator</span>
              </button>
              <button
                type="button"
                onClick={() => setCalcView('batch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  calcView === 'batch'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multi-Size Matrix</span>
              </button>
            </div>

            {/* PDF Export Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/30 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
              title="Download official PDF report for production floor"
            >
              <Download className={`w-4 h-4 ${generatingPdf ? 'animate-bounce' : ''}`} />
              <span>{generatingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-2 text-xs font-semibold"
              title="Print Calculation View"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-teal-500/30">
            <div className="flex items-center justify-between text-teal-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Required 1350mm Strips</span>
              <Scissors className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {formatNumber(requiredStrips)} <span className="text-xs font-normal text-slate-400">strips</span>
            </div>
            <div className="text-[10px] text-teal-400/80 mt-1">
              Formula: Math.ceil({cleanOrderQty.toLocaleString()} ÷ {currentSpec.yieldPerStrip})
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-cyan-500/30">
            <div className="flex items-center justify-between text-cyan-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Fabric Length</span>
              <Ruler className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {totalLinearMeters} <span className="text-xs font-normal text-slate-400">meters</span>
            </div>
            <div className="text-[10px] text-cyan-400/80 mt-1">
              {requiredStrips} strips × 1.35 m
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-amber-500/30">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Adhesive Widths (Sz {selectedSize})</span>
              <Ruler className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">
              {currentSpec.tapeA} & {currentSpec.tapeB}
            </div>
            <div className="text-[10px] text-amber-400/80 mt-1">
              {totalCombinedTapeMeters} total meters needed
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-purple-500/30">
            <div className="flex items-center justify-between text-purple-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Yield Output Rate</span>
              <Percent className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {currentSpec.yieldPerStrip} <span className="text-xs font-normal text-slate-400">pcs/strip</span>
            </div>
            <div className="text-[10px] text-purple-400/80 mt-1">
              Capacity: {potentialPiecesCapacity.toLocaleString()} pcs (+{bufferPieces} buffer)
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MAIN CALCULATION WORKBENCH                             */}
      {/* ========================================================= */}
      {calcView === 'single' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Input Form & Dropdowns (Col 1-5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Calculation Input</h3>
                    <p className="text-[11px] text-slate-400">Select material type, garment size & pieces</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOrderQty(1000);
                    setSelectedSize('10');
                    setSelectedMaterial('Loop Strips');
                    setSelectedPoPreload('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Reset Calculator"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. Material Dropdown Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Material Option:
                </label>
                <div className="relative">
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white appearance-none focus:outline-none focus:border-teal-500 transition cursor-pointer"
                  >
                    <option value="Loop Strips">Loop Strips (1350 mm)</option>
                    <option value="Adhesive Tape">Adhesive Tape (Dual-Width 1350 mm)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Quick Toggle Pills */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMaterial('Loop Strips')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      selectedMaterial === 'Loop Strips'
                        ? 'bg-teal-600/20 border-teal-500 text-teal-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Loop Strips</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMaterial('Adhesive Tape')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      selectedMaterial === 'Adhesive Tape'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Adhesive Tape</span>
                  </button>
                </div>
              </div>

              {/* 2. Size Selection Menu & Pills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Garment Size:
                  </label>
                  <span className="text-[10px] text-teal-400 font-mono">
                    Yield: {currentSpec.yieldPerStrip} pcs / strip
                  </span>
                </div>

                <div className="relative">
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white appearance-none focus:outline-none focus:border-teal-500 transition cursor-pointer"
                  >
                    <option value="10">Size 10 (Yield: 70 pcs • Tape: 9mm & 16mm)</option>
                    <option value="12">Size 12 (Yield: 65 pcs • Tape: 10mm & 17mm)</option>
                    <option value="14">Size 14 (Yield: 58 pcs • Tape: 11mm & 18mm)</option>
                    <option value="16">Size 16 (Yield: 61 pcs • Tape: 12mm & 19mm)</option>
                    <option value="18">Size 18 (Yield: 48 pcs • Tape: 13mm & 20mm)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* 5 Clickable Size Buttons */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {SIZES.map((sz) => {
                    const isSelected = selectedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition flex flex-col items-center border ${
                          isSelected
                            ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md scale-102'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-black">{sz}</span>
                        <span className="text-[9px] opacity-80">{MATERIAL_SPECS[sz].yieldPerStrip}p</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Desired Order Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Desired Order Quantity (pcs):
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Target Output Pieces
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    placeholder="Enter piece count (e.g. 1000)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-mono font-black text-white focus:outline-none focus:border-teal-500 transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    PCS
                  </span>
                </div>

                {/* Quick Add Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {[100, 500, 1000, 2500, 5000].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => handleQuickAdd(delta)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold font-mono transition border border-slate-700/80"
                    >
                      +{delta >= 1000 ? `${delta / 1000}k` : delta}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSetExact(1000)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] font-bold font-mono transition border border-slate-700/80"
                  >
                    1,000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExact(5000)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] font-bold font-mono transition border border-slate-700/80"
                  >
                    5,000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExact(10000)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] font-bold font-mono transition border border-slate-700/80"
                  >
                    10,000
                  </button>
                </div>
              </div>

              {/* Optional: Preload from Live PO */}
              {activeOrders.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Search className="w-3 h-3 text-cyan-400" />
                      <span>Pre-fill from Live Factory PO:</span>
                    </span>
                  </div>
                  <select
                    value={selectedPoPreload}
                    onChange={(e) => handlePreloadOrder(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="">-- Select Active PO to auto-populate --</option>
                    {activeOrders.map((o) => (
                      <option key={o.id || o.poNumber} value={o.poNumber}>
                        PO #{o.poNumber} • {o.colour} (Size {o.size}) - {formatNumber(o.orderQty)} pcs
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Reference Rules Box */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-300 text-xs font-bold">
                <Info className="w-4 h-4 text-teal-400" />
                <span>Yield & Multiplier Rules (Base: 1350 mm)</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                  <span>Size 10</span>
                  <span className="text-white font-bold">70 pcs / strip</span>
                  <span className="text-amber-400">9mm + 16mm Tape</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                  <span>Size 12</span>
                  <span className="text-white font-bold">65 pcs / strip</span>
                  <span className="text-amber-400">10mm + 17mm Tape</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                  <span>Size 14</span>
                  <span className="text-white font-bold">58 pcs / strip</span>
                  <span className="text-amber-400">11mm + 18mm Tape</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                  <span>Size 16</span>
                  <span className="text-white font-bold">61 pcs / strip</span>
                  <span className="text-amber-400">12mm + 19mm Tape</span>
                </div>
                <div className="flex items-center justify-between py-1 font-mono">
                  <span>Size 18</span>
                  <span className="text-white font-bold">48 pcs / strip</span>
                  <span className="text-amber-400">13mm + 20mm Tape</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Output Display, Detailed Calculations & Breakdown (Col 6-12) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Primary Result Banner */}
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border border-teal-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                    Engineered Calculation Result
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    {selectedMaterial === 'Loop Strips' ? 'Loop Strips Consumption' : 'Dual-Width Adhesive Tape Requirement'}
                  </h2>
                </div>
                <div className="px-3 py-1 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono font-bold text-xs">
                  Size {selectedSize} • {cleanOrderQty.toLocaleString()} pcs
                </div>
              </div>

              {/* Loop Strips Calculation Output */}
              {selectedMaterial === 'Loop Strips' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-950/80 border border-teal-500/40 shadow-inner">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-teal-400 mb-1 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Required 1350mm Strips</span>
                      </div>
                      <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                        {formatNumber(requiredStrips)}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Formula: <code className="text-teal-300 font-mono">Math.ceil({cleanOrderQty} / {currentSpec.yieldPerStrip})</code>
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-950/80 border border-cyan-500/40 shadow-inner">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
                        <Ruler className="w-3.5 h-3.5" />
                        <span>Total Linear Length</span>
                      </div>
                      <div className="text-4xl sm:text-5xl font-black text-cyan-300 font-mono tracking-tight">
                        {totalLinearMeters} <span className="text-lg font-bold text-slate-400">m</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Formula: <code className="text-cyan-300 font-mono">{requiredStrips} strips × 1.35 m</code>
                      </p>
                    </div>
                  </div>

                  {/* Production Capacity & Yield Analysis */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-slate-400">Total Strip Production Capacity:</span>
                      <div className="font-mono font-bold text-white text-base">
                        {potentialPiecesCapacity.toLocaleString()} pcs
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-400">Order Piece Target:</span>
                      <div className="font-mono font-bold text-slate-300 text-base">
                        {cleanOrderQty.toLocaleString()} pcs
                      </div>
                    </div>
                    <div className="space-y-0.5 sm:text-right">
                      <span className="text-slate-400">Excess / Safety Buffer:</span>
                      <div className="font-mono font-bold text-emerald-400 text-base">
                        +{bufferPieces.toLocaleString()} pcs ({potentialPiecesCapacity > 0 ? ((bufferPieces / cleanOrderQty) * 100).toFixed(1) : 0}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Adhesive Tape Calculation Output */}
              {selectedMaterial === 'Adhesive Tape' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
                      <Ruler className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-200">
                        Size {selectedSize} Dual-Width Requirement
                      </h4>
                      <p className="text-xs text-amber-300/80">
                        Every single piece strip requires two separate adhesive tapes: <strong>{currentSpec.tapeA}</strong> width AND <strong>{currentSpec.tapeB}</strong> width (both at 1,350 mm length).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tape A */}
                    <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-500/40 shadow-inner space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                          Adhesive Tape A ({currentSpec.tapeA})
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 text-[10px] font-mono border border-amber-800/40">
                          Width: {currentSpec.tapeA}
                        </span>
                      </div>
                      <div className="text-3xl font-black text-white font-mono">
                        {formatNumber(tapeAStrips)} <span className="text-sm font-normal text-slate-400">strips</span>
                      </div>
                      <div className="text-xl font-bold text-amber-400 font-mono">
                        {tapeAMeters} <span className="text-xs font-normal text-slate-400">linear meters</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {tapeAStrips} strips × 1.35m = {tapeAMeters}m
                      </p>
                    </div>

                    {/* Tape B */}
                    <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-500/40 shadow-inner space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                          Adhesive Tape B ({currentSpec.tapeB})
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 text-[10px] font-mono border border-amber-800/40">
                          Width: {currentSpec.tapeB}
                        </span>
                      </div>
                      <div className="text-3xl font-black text-white font-mono">
                        {formatNumber(tapeBStrips)} <span className="text-sm font-normal text-slate-400">strips</span>
                      </div>
                      <div className="text-xl font-bold text-amber-400 font-mono">
                        {tapeBMeters} <span className="text-xs font-normal text-slate-400">linear meters</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {tapeBStrips} strips × 1.35m = {tapeBMeters}m
                      </p>
                    </div>
                  </div>

                  {/* Combined Adhesive Totals Bar */}
                  <div className="p-5 rounded-2xl bg-slate-950/90 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Combined Total Adhesive Tape Consumption</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Sum of Tape A ({currentSpec.tapeA}) and Tape B ({currentSpec.tapeB}) combined
                      </p>
                    </div>

                    <div className="flex items-baseline gap-4 sm:text-right">
                      <div>
                        <div className="text-xs text-slate-400">Total Tape Strips:</div>
                        <div className="font-mono font-black text-white text-lg">
                          {formatNumber(totalCombinedTapeStrips)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-amber-400">Total Tape Meters:</div>
                        <div className="font-mono font-black text-amber-400 text-2xl">
                          {totalCombinedTapeMeters} m
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Complete Specification Table */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Full Size Specification Matrix</h3>
                  <p className="text-[11px] text-slate-400">Standard Yield & Adhesive specifications across all sizes</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5 text-teal-400" />
                  <span>Export Matrix</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Strip Length</th>
                      <th className="py-3 px-4">Yield / Strip</th>
                      <th className="py-3 px-4">Tape Width A</th>
                      <th className="py-3 px-4">Tape Width B</th>
                      <th className="py-3 px-4 text-right">Required (for {cleanOrderQty.toLocaleString()} pcs)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {SIZES.map((sz) => {
                      const spec = MATERIAL_SPECS[sz];
                      const isCurrent = sz === selectedSize;
                      const reqStripsForSize = cleanOrderQty > 0 ? Math.ceil(cleanOrderQty / spec.yieldPerStrip) : 0;
                      const reqMetersForSize = (reqStripsForSize * STRIP_BASE_LENGTH_M).toFixed(2);

                      return (
                        <tr
                          key={sz}
                          onClick={() => setSelectedSize(sz)}
                          className={`cursor-pointer transition ${
                            isCurrent
                              ? 'bg-teal-950/30 text-teal-200'
                              : 'hover:bg-slate-800/40 text-slate-300'
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                              isCurrent ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-white'
                            }`}>
                              Size {sz}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                            1,350 mm (1.35m)
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                            {spec.yieldPerStrip} pcs / strip
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-amber-300">
                            {spec.tapeA}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-amber-300">
                            {spec.tapeB}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-teal-400">
                            {formatNumber(reqStripsForSize)} strips ({reqMetersForSize}m)
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap font-sans">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSize(sz);
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                                isCurrent
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                              }`}
                            >
                              {isCurrent ? 'Selected' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* MULTI-SIZE BATCH CALCULATION MATRIX                       */
        /* ========================================================= */
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden space-y-6 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-400" />
                <span>Multi-Size Batch Order Calculation Matrix</span>
              </h3>
              <p className="text-xs text-slate-400">
                Input piece quantities across all sizes simultaneously to compute aggregate Loop Strip & Adhesive Tape totals.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBatchQuantities({
                    '10': 1000,
                    '12': 1000,
                    '14': 1000,
                    '16': 1000,
                    '18': 1000,
                  });
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition"
              >
                Reset to 1k each
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Batch PDF</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Garment Size</th>
                  <th className="py-3.5 px-4">Yield / 1350mm</th>
                  <th className="py-3.5 px-4">Input Order Qty (pcs)</th>
                  <th className="py-3.5 px-4 text-right">Required Strips</th>
                  <th className="py-3.5 px-4 text-right">Loop Fabric (Meters)</th>
                  <th className="py-3.5 px-4">Adhesive Width A</th>
                  <th className="py-3.5 px-4">Adhesive Width B</th>
                  <th className="py-3.5 px-4 text-right">Adhesive Tape (Meters)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {batchCalculations.map((row) => (
                  <tr key={row.size} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold text-xs">
                        Size {row.size}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-300">
                      {row.spec.yieldPerStrip} pcs / strip
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={batchQuantities[row.size]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchQuantities((prev) => ({
                            ...prev,
                            [row.size]: val,
                          }));
                        }}
                        className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-teal-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-black text-white text-sm">
                      {formatNumber(row.strips)} strips
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-black text-cyan-300">
                      {row.meters} m
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-amber-300 font-bold">
                      {row.tapeA} ({row.meters}m)
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-amber-300 font-bold">
                      {row.tapeB} ({row.meters}m)
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-black text-amber-400">
                      {row.combinedTapeMeters} m
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-950 font-mono font-black text-xs border-t-2 border-slate-800 text-white">
                <tr>
                  <td colSpan={2} className="py-4 px-4 text-teal-400 uppercase tracking-wider">
                    Grand Totals Across All Sizes:
                  </td>
                  <td className="py-4 px-4 text-emerald-400 text-sm">
                    {formatNumber(batchTotals.totalQty)} pcs
                  </td>
                  <td className="py-4 px-4 text-right text-teal-300 text-base">
                    {formatNumber(batchTotals.totalStrips)} strips
                  </td>
                  <td className="py-4 px-4 text-right text-cyan-300 text-base">
                    {batchTotals.totalMeters} m
                  </td>
                  <td colSpan={2} className="py-4 px-4 text-slate-400 text-center text-[11px]">
                    Dual Widths Allocated (9mm - 20mm)
                  </td>
                  <td className="py-4 px-4 text-right text-amber-300 text-base">
                    {batchTotals.totalTapeMeters} m
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
