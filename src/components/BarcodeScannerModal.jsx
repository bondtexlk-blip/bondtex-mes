import React, { useState } from 'react';
import {
  X,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  Volume2,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber, getStatusBadgeClass } from '../utils/formatters';

export default function BarcodeScannerModal({ onClose, onOrderMatched }) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [availableOrders, setAvailableOrders] = useState([]);

  useEffect(() => {
    api.getOrders({ limit: 6 })
      .then((res) => {
        if (res && res.orders) {
          setAvailableOrders(res.orders);
        }
      })
      .catch(() => {});
  }, []);

  // Play warehouse scanner beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Ignored if browser policy blocks initial audio
    }
  };

  const handleScanCode = async (codeToSearch) => {
    const code = codeToSearch || barcodeInput;
    if (!code || !code.trim()) return;

    try {
      setSearching(true);
      setError(null);
      setMatchedOrder(null);

      const res = await api.searchBarcode(code.trim());
      if (res.success && res.data) {
        playBeep();
        setMatchedOrder(res.data);
      } else {
        setError(`No order matched barcode '${code}'`);
      }
    } catch (err) {
      setError(err.message || `No order found for '${code}'`);
    } finally {
      setSearching(false);
    }
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                PO & Barcode Scanner Simulator
              </h3>
              <p className="text-xs text-slate-400">
                Scan or enter PO # to view RM Material, Colour, and Size records
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Visual Scanner Viewport */}
          <div className="relative h-32 rounded-2xl bg-slate-950 border-2 border-dashed border-cyan-500/40 flex flex-col items-center justify-center overflow-hidden">
            {/* Animated Laser beam */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-pulse"></div>

            {/* Barcode artwork graphic */}
            <div className="flex items-center gap-1 opacity-60">
              <div className="w-1.5 h-14 bg-white"></div>
              <div className="w-0.5 h-14 bg-white"></div>
              <div className="w-2.5 h-14 bg-white"></div>
              <div className="w-1 h-14 bg-white"></div>
              <div className="w-3 h-14 bg-white"></div>
              <div className="w-0.5 h-14 bg-white"></div>
              <div className="w-2 h-14 bg-white"></div>
              <div className="w-1 h-14 bg-white"></div>
              <div className="w-2.5 h-14 bg-white"></div>
              <div className="w-1.5 h-14 bg-white"></div>
            </div>

            <span className="text-[10px] text-cyan-400 font-mono mt-2 tracking-widest uppercase">
              Laser Viewport Ready • Scan PO / Barcode
            </span>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScanCode();
            }}
            className="space-y-2"
          >
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              PO # or Barcode Input
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan or enter PO # (e.g. 4502991550)"
                className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono font-bold"
              />
              <button
                type="submit"
                disabled={searching || !barcodeInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>
          </form>

          {/* Quick reference presets from active orders */}
          {availableOrders.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Active Orders in System:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {availableOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      setBarcodeInput(order.poNumber);
                      handleScanCode(order.poNumber);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-left transition text-xs group"
                  >
                    <div className="font-mono font-bold text-cyan-400 group-hover:text-cyan-300">
                      {order.poNumber}
                    </div>
                    <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                      {order.colour} ({order.category})
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      RM: {order.rmMaterial}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Match Result Card */}
          {matchedOrder && (
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300 uppercase">
                    Order Matched
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(
                    matchedOrder.status
                  )}`}
                >
                  {matchedOrder.status}
                </span>
              </div>

              <div className="text-xs space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">PO #:</span>
                  <span className="font-mono font-bold text-white text-sm">{matchedOrder.poNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RM Material:</span>
                  <span className="font-mono font-bold text-cyan-300">{matchedOrder.rmMaterial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Colour:</span>
                  <span className="font-semibold text-slate-200">{matchedOrder.colour}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Size:</span>
                  <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                    Size {matchedOrder.size}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Order Qty:</span>
                  <span className="font-mono text-slate-200">
                    {formatNumber(matchedOrder.orderQty)} pcs (Prod: {formatNumber(matchedOrder.productionQty)})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onOrderMatched(matchedOrder);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/30"
              >
                <span>Drill-Down to This Order</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
