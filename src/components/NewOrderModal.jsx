import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  PackagePlus,
  Calendar,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { api } from '../api/client';

export default function NewOrderModal({ onClose, onSuccess, metadata }) {
  const [category, setCategory] = useState('Loop');
  const [poNumber, setPoNumber] = useState('4502991550');
  const [rmMaterial, setRmMaterial] = useState('200150259454A2');
  const [colour, setColour] = useState('Black 093 54A2');
  const [style, setStyle] = useState('Loop Elastic Band - 54A2');
  const [size, setSize] = useState('10');
  const [orderQty, setOrderQty] = useState('20000');
  const [priority, setPriority] = useState('High');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rmDefaults = {
    Loop: { rm: '200150259454A2', col: 'Black 093 54A2', style: 'Loop Elastic Band - 54A2', po: '4502991550' },
    Strap: { rm: '200150259439H6', col: 'Marzipan 39H6', style: 'Strap Webbing Band - 39H6', po: '4502991532' },
    'T-shirt': { rm: '200150259465H8', col: 'Praline 65H8', style: 'T-Shirt Combed Knit - 65H8', po: '4502991599' },
    Other: { rm: '200150259433F6', col: 'Ganache 33F6', style: 'Specialty Trim Finish - 33F6', po: '4502991520' },
  };

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    const def = rmDefaults[newCat] || rmDefaults.Loop;
    setRmMaterial(def.rm);
    setColour(def.col);
    setStyle(def.style);
    setPoNumber(def.po);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const orderData = {
        category,
        poNumber,
        rmMaterial,
        colour,
        style,
        styleCode: style.split(' - ')[1] || '54A2',
        size,
        orderQty: Number(orderQty) || 0,
        productionQty: 0,
        deliveryQty: 0,
        startDate,
        targetDate,
        priority,
        status: 'On Track',
      };

      const res = await api.createOrder(orderData);
      if (res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res.message || 'Failed to create order');
      }
    } catch (err) {
      setError(err.message || 'Server error creating order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Create New Production Order
              </h3>
              <p className="text-xs text-slate-400">
                Book manufacturing contract into Bondtex MES pipeline
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

          {/* Category Selector */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              Production Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['Loop', 'Strap', 'T-shirt', 'Other'].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition text-center ${
                    category === cat
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* PO Number & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                PO Number (Purchase Order #)
              </label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                aria-label="Priority Level"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Normal">Normal</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical (Rush)</option>
              </select>
            </div>
          </div>

          {/* Style Description */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
              Style Code & Description
            </label>
            <input
              type="text"
              value={style || styleSuggestions[category][0]}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="e.g. LP-ELAST-901 HD Braided Elastic"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Size & Order Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Size
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="25mm, L, XL, etc."
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Order Quantity (Total Pieces)
              </label>
              <input
                type="number"
                min="100"
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Production Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Target Delivery Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Submit buttons */}
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
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Creating Order...' : 'Register Production Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
