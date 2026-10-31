import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Upload,
  RefreshCw,
  Plus,
  RefreshCcw,
} from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import { api } from '../api/client';

export default function BulkUploadModal({
  isOpen,
  onClose,
  parsedData,
  fileName,
  existingOrders = [],
  onSuccess,
}) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !parsedData) return null;

  const orders = parsedData.orders || [];

  // Match existing orders to determine how many are new vs updates
  const existingSet = new Set(
    existingOrders.map((o) => `${String(o.poNumber).trim()}__${String(o.size).trim()}`)
  );

  let newCount = 0;
  let updateCount = 0;
  let totalPieces = 0;

  orders.forEach((o) => {
    const key = `${String(o.poNumber).trim()}__${String(o.size).trim()}`;
    if (existingSet.has(key)) {
      updateCount++;
    } else {
      newCount++;
    }
    totalPieces += Number(o.orderQty) || 0;
  });

  const handleConfirmImport = async () => {
    try {
      setImporting(true);
      setError(null);
      const res = await api.bulkCreateOrUpdateOrders(orders);
      if (res && res.success !== false) {
        if (onSuccess) {
          onSuccess(res);
        }
        onClose();
      } else {
        setError(res?.message || 'Bulk upload failed');
      }
    } catch (err) {
      setError(err.message || 'Error importing orders into database');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Confirm Bulk Orders Upload</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                  {fileName}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Review parsed production orders before committing them to the factory database
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Total Rows Parsed</div>
              <div className="text-xl font-extrabold text-white font-mono">{orders.length}</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-emerald-400 mb-0.5 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                <span>New Orders</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-400 font-mono">{newCount}</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-cyan-400 mb-0.5 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3" />
                <span>Existing (Updates)</span>
              </div>
              <div className="text-xl font-extrabold text-cyan-400 font-mono">{updateCount}</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-indigo-400 mb-0.5">Total Planned Volume</div>
              <div className="text-xl font-extrabold text-indigo-300 font-mono">{formatNumber(totalPieces)} pcs</div>
            </div>
          </div>

          {/* Warnings if any */}
          {parsedData.errors && parsedData.errors.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Header or Row Warnings ({parsedData.errors.length}):</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-200/80">
                {parsedData.errors.slice(0, 4).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {parsedData.errors.length > 4 && <li>...and {parsedData.errors.length - 4} more skipped rows</li>}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider text-[10px]">
                Data Preview (First {Math.min(orders.length, 100)} Records):
              </span>
              <span>Matching 11 Directory Columns</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">PO #</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">RM Material</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Colour</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Size</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Category</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Style</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Order Qty</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Floor Qty</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Production Qty</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Delivery Qty</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Balance Qty</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {orders.slice(0, 100).map((row, idx) => {
                    const isExisting = existingSet.has(`${String(row.poNumber).trim()}__${String(row.size).trim()}`);
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 font-mono font-bold text-white whitespace-nowrap">
                          {row.poNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-cyan-300 whitespace-nowrap">
                          {row.rmMaterial}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-200">
                          {row.colour}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-white whitespace-nowrap">
                          {row.size}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                          {row.category}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-300 max-w-[150px] truncate">
                          {row.style}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                          {formatNumber(row.orderQty)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-cyan-300 whitespace-nowrap">
                          {formatNumber(row.floorProductionQty)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-400 whitespace-nowrap">
                          {formatNumber(row.productionQty)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-400 whitespace-nowrap">
                          {formatNumber(row.deliveryQty)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">
                          {formatNumber(row.balanceQty)}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isExisting
                                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isExisting ? 'Update' : 'New'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Clicking Confirm will commit <strong className="text-white">{orders.length}</strong> orders to your active database.
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing Orders...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Confirm & Import ({orders.length} Records)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
