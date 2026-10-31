import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  PlusCircle,
  Edit3,
  Calendar,
  AlertCircle,
  Package,
  Check,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../utils/formatters';

const PRESET_COLOURS = [
  { name: 'Black 093 54A2', bg: '#18181b', text: '#ffffff' },
  { name: 'Marzipan 39H6', bg: '#d4a373', text: '#18181b' },
  { name: 'Praline 65H8', bg: '#bc6c25', text: '#ffffff' },
  { name: 'Ganache 33F6', bg: '#4a2c1d', text: '#ffffff' },
  { name: 'Talc 69-09-47 57H1', bg: '#e7e5e4', text: '#18181b' },
  { name: 'Optic White 001', bg: '#f8fafc', text: '#18181b' },
  { name: 'Navy Blue 042', bg: '#1e3a8a', text: '#ffffff' },
];

const PRESET_SIZES = ['10', '12', '14', '16', '18', '20'];

export default function OrderFormModal({
  order = null, // null for 'Create New', object for 'Edit'
  isOpen,
  onClose,
  onSuccess,
}) {
  const isEditing = Boolean(order && order.id);

  const [poNumber, setPoNumber] = useState('');
  const [rmMaterial, setRmMaterial] = useState('');
  const [colour, setColour] = useState('');
  const [size, setSize] = useState('12');
  const [category, setCategory] = useState('Loop');
  const [style, setStyle] = useState('');
  const [orderQty, setOrderQty] = useState('');
  const [floorProductionQty, setFloorProductionQty] = useState('');
  const [productionQty, setProductionQty] = useState('');
  const [deliveryQty, setDeliveryQty] = useState('');
  const [balanceQty, setBalanceQty] = useState('');
  const [isBalanceAuto, setIsBalanceAuto] = useState(true);
  const [status, setStatus] = useState('On Track');
  const [priority, setPriority] = useState('Normal');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startDateRef = useRef(null);
  const targetDateRef = useRef(null);

  // Initialize or reset form state
  useEffect(() => {
    if (order) {
      setPoNumber(order.poNumber || '');
      setRmMaterial(order.rmMaterial || '');
      setColour(order.colour || '');
      setSize(String(order.size || '12'));
      setCategory(order.category || 'Loop');
      setStyle(order.style || '');
      setOrderQty(order.orderQty !== undefined ? String(order.orderQty) : '');
      setFloorProductionQty(
        order.floorProductionQty !== undefined
          ? String(order.floorProductionQty)
          : order.productionQty !== undefined
          ? String(order.productionQty)
          : '0'
      );
      setProductionQty(order.productionQty !== undefined ? String(order.productionQty) : '0');
      setDeliveryQty(order.deliveryQty !== undefined ? String(order.deliveryQty) : '0');
      setBalanceQty(order.balanceQty !== undefined ? String(order.balanceQty) : '');
      setIsBalanceAuto(false);
      setStatus(order.status || 'On Track');
      setPriority(order.priority || 'Normal');
      setStartDate(order.startDate || new Date().toISOString().split('T')[0]);
      setTargetDate(
        order.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
      );
    } else {
      setPoNumber('');
      setRmMaterial('200150259454A2');
      setColour('Black 093 54A2');
      setSize('12');
      setCategory('Loop');
      setStyle('Loop Elastic Band - 54A2');
      setOrderQty('10000');
      setFloorProductionQty('0');
      setProductionQty('0');
      setDeliveryQty('0');
      setBalanceQty('10000');
      setIsBalanceAuto(true);
      setStatus('On Track');
      setPriority('Normal');
      setStartDate(new Date().toISOString().split('T')[0]);
      setTargetDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    }
    setError(null);
  }, [order, isOpen]);

  // Auto calculate balance quantity when orderQty or deliveryQty changes (if in auto mode)
  useEffect(() => {
    if (isBalanceAuto) {
      const oQ = Number(orderQty) || 0;
      const dQ = Number(deliveryQty) || 0;
      setBalanceQty(String(oQ - dQ));
    }
  }, [orderQty, deliveryQty, isBalanceAuto]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!poNumber.trim()) {
      setError('Please provide a valid PO Number');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const numOrderQty = Number(orderQty) || 0;
      const numFloorQty = Number(floorProductionQty) || 0;
      const numProdQty = Number(productionQty) || 0;
      const numDelivQty = Number(deliveryQty) || 0;
      const numBalQty = balanceQty !== '' ? Number(balanceQty) : numOrderQty - numDelivQty;

      const payload = {
        poNumber: poNumber.trim(),
        rmMaterial: rmMaterial.trim() || '200150259454A2',
        colour: colour.trim() || 'Standard',
        size: String(size).trim() || '12',
        category: category || 'Loop',
        style: style.trim() || 'Loop Elastic Band',
        orderQty: numOrderQty,
        floorProductionQty: numFloorQty,
        productionQty: numProdQty,
        deliveryQty: numDelivQty,
        balanceQty: numBalQty,
        deliveryBalanceQty: numBalQty,
        status,
        priority,
        startDate: startDate || new Date().toISOString().split('T')[0],
        targetDate: targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      };

      let result;
      if (isEditing) {
        result = await api.updateOrder(order.id, payload);
      } else {
        result = await api.createOrder(payload);
      }

      if (result.success) {
        if (onSuccess) {
          onSuccess(result.data, isEditing ? 'updated' : 'created');
        }
        onClose();
      } else {
        setError(result.message || 'Operation failed');
      }
    } catch (err) {
      setError(err.message || 'Error saving order record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isEditing ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'}`}>
              {isEditing ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {isEditing ? `Edit Production Order • PO #${order.poNumber}` : 'Add New Production Order Record'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Modify directory fields and persist live changes to MES database' : 'Manually register a custom production contract line'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs text-slate-300">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identification & Material */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-400" />
              <span>Order Specifications</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* PO Number */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  PO # (Purchase Order):
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4502991562"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* RM Material */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  RM Material:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 200150259454A2"
                  value={rmMaterial}
                  onChange={(e) => setRmMaterial(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Loop">Loop</option>
                  <option value="Strap">Strap</option>
                  <option value="T-shirt">T-shirt</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Colour and Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Colour Description:
                </label>
                <span className="text-[10px] text-slate-500">Click quick swatch below or type custom</span>
              </div>
              <input
                type="text"
                placeholder="e.g. Talc 69-09-47 57H1, Black 093 54A2"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 mb-2"
              />

              {/* Quick Swatches */}
              <div className="flex flex-wrap items-center gap-1.5">
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColour(c.name)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] border transition cursor-pointer ${
                      colour === c.name
                        ? 'bg-blue-600/30 text-white border-blue-400 ring-1 ring-blue-400/40'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: c.bg }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size & Style */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Size */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Size:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10, 12, 14..."
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  {PRESET_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
                        size === s ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Style Name & Code:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Loop Elastic Band - 54A2"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Quantities & Production Tracking */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Directory Quantities (Pieces)</span>
              <button
                type="button"
                onClick={() => {
                  setIsBalanceAuto(true);
                  const o = Number(orderQty) || 0;
                  const d = Number(deliveryQty) || 0;
                  setBalanceQty(String(o - d));
                }}
                className="text-cyan-400 hover:underline text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Calculate Balance</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Order Qty */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Order Qty
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              {/* Floor Qty */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-cyan-400 mb-1">
                  Floor Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={floorProductionQty}
                  onChange={(e) => setFloorProductionQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 font-bold"
                />
              </div>

              {/* Production Qty */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-emerald-400 mb-1">
                  Production Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={productionQty}
                  onChange={(e) => setProductionQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              {/* Delivery Qty */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-blue-400 mb-1">
                  Delivery Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-blue-300 font-mono text-xs focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              {/* Balance Qty */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1">
                  Balance Qty
                </label>
                <input
                  type="number"
                  value={balanceQty}
                  onChange={(e) => {
                    setIsBalanceAuto(false);
                    setBalanceQty(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Status, Priority & Dates */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Status */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Status:
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="On Track">On Track</option>
                  <option value="Ahead">Ahead</option>
                  <option value="Behind Plan">Behind Plan</option>
                  <option value="Completed">Completed</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Priority:
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Normal">Normal</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Start Date:
                </label>
                <div className="relative flex items-center">
                  <input
                    ref={startDateRef}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        if (typeof e.target.showPicker === 'function') e.target.showPicker();
                      } catch (_) {}
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 cursor-pointer [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => startDateRef.current?.showPicker?.()}
                    className="absolute right-2 text-cyan-400 p-1"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Target Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Target Date:
                </label>
                <div className="relative flex items-center">
                  <input
                    ref={targetDateRef}
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        if (typeof e.target.showPicker === 'function') e.target.showPicker();
                      } catch (_) {}
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 cursor-pointer [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => targetDateRef.current?.showPicker?.()}
                    className="absolute right-2 text-cyan-400 p-1"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-xs font-bold transition shadow-lg cursor-pointer disabled:opacity-50 ${
                isEditing
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/50'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/50'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Production Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
