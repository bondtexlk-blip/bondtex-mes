import React, { useState, useEffect } from 'react';
import {
  Activity,
  Barcode,
  PlusCircle,
  RotateCcw,
  Clock,
  Layers,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';

export default function Navbar({
  activeView,
  setActiveView,
  onOpenNewOrder,
  onOpenBarcodeScanner,
  onResetData,
  currentShift,
  setCurrentShift,
  theme = 'dark',
  onToggleTheme,
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Brand & Factory identity */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActiveView('dashboard')}
            className="cursor-pointer relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 shadow-lg shadow-blue-500/20 text-white font-black text-xl tracking-wider"
          >
            <span>B</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                onClick={() => setActiveView('dashboard')}
                className="cursor-pointer text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent"
              >
                BONDTEX
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                MES v2.4
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Apparel & Narrow Fabric Manufacturing Suite
            </p>
          </div>
        </div>

        {/* Center: Top View Switcher Pills */}
        <div className="hidden lg:flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveView('daily-production')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              activeView === 'daily-production'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-cyan-400 hover:text-cyan-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Daily Production
          </button>
          <button
            onClick={() => setActiveView('hourly-production')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              activeView === 'hourly-production'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Hourly Production
          </button>
          <button
            onClick={() => setActiveView('delivery-received')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              activeView === 'delivery-received'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-purple-400 hover:text-purple-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Delivery & Received
          </button>
          <button
            onClick={() => setActiveView('drilldown')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeView === 'drilldown'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Orders & POs
          </button>
          <button
            onClick={() => setActiveView('admin')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeView === 'admin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin QR Setup
          </button>
          <button
            onClick={() => setActiveView('worker')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              activeView === 'worker'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Worker Portal
          </button>
        </div>

        {/* Center: Shift selector & Live Production Clock */}
        <div className="hidden md:flex items-center gap-3 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 text-slate-400 border-r border-slate-700 pr-3">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono text-slate-200">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Shift selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Shift:</span>
            <select
              value={currentShift}
              onChange={(e) => setCurrentShift(e.target.value)}
              aria-label="Shift Selector"
              className="bg-slate-900 border border-slate-700 text-xs font-semibold rounded-lg px-2 py-0.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Shifts</option>
              <option value="Shift A">Shift A</option>
              <option value="Shift B">Shift B</option>
              <option value="Shift C">Shift C</option>
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Dark / Light Mode Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition shadow-sm"
              title={theme === 'dark' ? 'Switch to Light Mode (Factory Floor)' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden xl:inline text-[11px] font-semibold text-amber-300">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="hidden xl:inline text-[11px] font-semibold text-indigo-500">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Barcode Scanner Quick trigger */}
          <button
            onClick={onOpenBarcodeScanner}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition shadow-sm hover:border-slate-600"
            title="Scan PO Barcode"
          >
            <Barcode className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* Reset Demo Data */}
          <button
            onClick={onResetData}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 text-xs transition"
            title="Reset to fresh Bondtex seed data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* New Order Button */}
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-600/30 transition transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Order</span>
          </button>
        </div>
      </div>
    </header>
  );
}
