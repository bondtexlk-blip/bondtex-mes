import React from 'react';
import { X, Printer, Barcode, Check } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

export default function BarcodeLabelModal({ order, onClose }) {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-bold text-white">Production Barcode Label</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Label (White background standard sticker preview) */}
        <div className="p-6">
          <div
            id="printable-label"
            className="p-5 rounded-2xl bg-white text-slate-900 shadow-xl border-2 border-slate-300 font-sans space-y-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
              <div className="font-black text-lg tracking-wider text-slate-900">
                BONDTEX APPAREL
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded">
                  {order.category}
                </span>
              </div>
            </div>

            {/* PO & Barcode graphic */}
            <div className="text-center py-2 space-y-1">
              <div className="flex justify-center items-center gap-0.5 h-16 px-4 bg-slate-50 border border-slate-200 rounded-lg py-1">
                {/* Visual barcode representation */}
                {[2, 1, 3, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1].map(
                  (width, i) => (
                    <div
                      key={i}
                      className="h-full bg-slate-900"
                      style={{ width: `${width * 2}px`, margin: '0 1px' }}
                    ></div>
                  )
                )}
              </div>
              <div className="font-mono text-sm font-bold tracking-widest text-slate-900">
                *{order.barcode || order.poNumber}*
              </div>
            </div>

            {/* Info Table */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-300 pt-2">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">PO Number</span>
                <span className="font-mono font-bold text-slate-900">{order.poNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Size</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{order.size}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">RM Material</span>
                <span className="font-mono font-bold text-slate-900">{order.rmMaterial}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Colour</span>
                <span className="font-semibold text-slate-900">{order.colour}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Style</span>
                <span className="font-semibold text-slate-900 truncate block">{order.style}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Order Qty</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatNumber(order.orderQty)} pcs
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">QC Stamp</span>
                <span className="font-semibold text-emerald-700">PASS - VERIFIED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">Thermal sticker size: 100mm x 75mm</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print Label</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
