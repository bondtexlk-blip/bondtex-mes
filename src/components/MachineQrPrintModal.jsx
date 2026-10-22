import React from 'react';
import { X, Printer, QrCode, Check, ShieldCheck, Factory, User, Hash, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function MachineQrPrintModal({ machine, networkHost, onClose }) {
  if (!machine) return null;

  const handlePrint = () => {
    window.print();
  };

  // Ensure we use the computer's network IP instead of localhost
  const effectiveHost = networkHost || (typeof window !== 'undefined' ? window.location.origin : '');
  const qrUrl = `${effectiveHost}/?view=worker&machine=${machine.code || machine.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Top Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-bold text-white">
              Permanent Machine QR Card (Wi-Fi Print Ready)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Card Preview (Clean White Background for Physical Laminated Tag) */}
        <div className="p-6">
          <div
            id="printable-machine-card"
            className="bg-white text-slate-900 rounded-2xl p-6 shadow-2xl border-4 border-slate-900 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl">
                  B
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-wider text-slate-900 uppercase">
                    BONDTEX MES
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Machine Station ID Tag
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block bg-slate-900 text-white font-mono font-black text-xs px-2.5 py-1 rounded">
                  {machine.code || machine.id}
                </span>
                <div className="text-[10px] font-bold text-blue-700 uppercase mt-0.5">
                  {machine.category} Division
                </div>
              </div>
            </div>

            {/* Machine Name & Type */}
            <div className="text-center py-1">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {machine.name}
              </h3>
              <p className="text-xs font-semibold text-slate-600">
                {machine.type || 'Production Unit'} • {machine.shift || 'Shift A'}
              </p>
            </div>

            {/* QR Code Centerpiece */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 space-y-2">
              <div className="p-3 bg-white rounded-xl shadow-md border border-slate-200">
                <QRCodeSVG
                  value={qrUrl}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="text-center">
                <span className="text-[11px] font-mono font-bold text-slate-900 uppercase tracking-wider block">
                  STATIC PERMANENT QR CODE
                </span>
                <span className="text-[10px] text-slate-600 font-medium flex items-center justify-center gap-1 mt-0.5">
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span>Wi-Fi Network Scan: {qrUrl}</span>
                </span>
              </div>
            </div>

            {/* Assigned Scope (Sizes & Colours) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Assigned Sizes
                </span>
                <div className="flex flex-wrap gap-1">
                  {(machine.assignedSizes || []).map((sz) => (
                    <span
                      key={sz}
                      className="px-1.5 py-0.5 rounded bg-white text-slate-900 border border-slate-300 font-mono font-black text-[11px]"
                    >
                      {sz}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Assigned Colours
                </span>
                <div className="space-y-0.5 truncate text-[11px] font-semibold text-slate-800">
                  {(machine.assignedColours || []).map((col) => (
                    <div key={col} className="truncate">• {col}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Operator and Target Footer */}
            <div className="flex items-center justify-between border-t-2 border-slate-900 pt-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">
                  Station Operator
                </span>
                <span className="font-bold text-slate-900">
                  {machine.operatorName || 'Assigned Worker'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">
                  Daily Quota Target
                </span>
                <span className="font-mono font-black text-blue-700 text-sm">
                  {machine.dailyTargetQty?.toLocaleString() || '2,500'} pcs/day
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-emerald-400 font-mono truncate max-w-[240px]">
            {qrUrl}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print Laminated Badge</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
