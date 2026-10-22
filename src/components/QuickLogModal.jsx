import React, { useState } from 'react';
import {
  X,
  Edit3,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';

export default function QuickLogModal({ order, onClose, onSuccess }) {
  if (!order) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [planQty, setPlanQty] = useState('2500');
  const [actualQty, setActualQty] = useState('2600');
  const [deliveryQty, setDeliveryQty] = useState('2000');
  const [notes, setNotes] = useState('Shift A optimal production run');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const logData = {
        date,
        planQty: Number(planQty) || 0,
        actualQty: Number(actualQty) || 0,
        deliveryQty: Number(deliveryQty) || 0,
        notes,
      };

      const res = await api.addDailyLog(order.id, logData);
      if (res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res.message || 'Failed to update log');
      }
    } catch (err) {
      setError(err.message || 'Server error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Log Daily Production
              </h3>
              <p className="text-xs text-slate-400">
                PO: <span className="text-slate-200 font-mono font-bold">{order.poNumber}</span> ({order.category})
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Status Overview */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-slate-400 text-[10px] block">Order Qty</span>
              <span className="font-mono font-bold text-white">{formatNumber(order.orderQty)}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Current Prod</span>
              <span className="font-mono font-bold text-emerald-400">{formatNumber(order.productionQty)}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Current Bal</span>
              <span className="font-mono font-bold text-amber-400">{formatNumber(order.balanceQty)}</span>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              Production Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
            />
          </div>

          {/* Daily Plan Target */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              Daily Target Plan (Pieces)
            </label>
            <input
              type="number"
              min="0"
              value={planQty}
              onChange={(e) => setPlanQty(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Daily Actual Production */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              Actual Output Produced Today (Pieces)
            </label>
            <input
              type="number"
              min="0"
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
              required
              className="w-full bg-slate-950 border border-blue-600/70 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Dispatched / Delivered */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              Quantity Dispatched / Delivered (Pieces)
            </label>
            <input
              type="number"
              min="0"
              value={deliveryQty}
              onChange={(e) => setDeliveryQty(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              Shift Observation / Quality Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Line 2 running at 104% efficiency"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition shadow-lg shadow-blue-600/30"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Production Log'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
