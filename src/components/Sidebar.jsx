import React from 'react';
import {
  LayoutDashboard,
  Layers,
  RefreshCw,
  Shirt,
  Boxes,
  TableProperties,
  BarChart3,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
  Smartphone,
  QrCode,
  Calendar,
  Clock,
  Truck,
} from 'lucide-react';

export default function Sidebar({
  activeView,
  setActiveView,
  selectedCategory,
  onSelectCategory,
  categories = [],
  isOpen,
  setIsOpen,
}) {
  const getCategoryIcon = (id) => {
    switch (id) {
      case 'Loop':
        return <RefreshCw className="w-4 h-4 text-blue-400" />;
      case 'Strap':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'T-shirt':
        return <Shirt className="w-4 h-4 text-amber-400" />;
      case 'Other':
        return <Boxes className="w-4 h-4 text-purple-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] z-30 w-64 bg-slate-900/95 lg:bg-slate-900/60 border-r border-slate-800 p-4 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Main Views */}
          <div>
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Navigation
            </p>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setActiveView('dashboard');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeView === 'dashboard'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 text-blue-400" />
                  <span>Overview Dashboard</span>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  All
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveView('daily-production');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeView === 'daily-production'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Daily Production</span>
                </div>
                <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-1.5 py-0.5 rounded font-mono">
                  Loop Focus
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveView('hourly-production');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeView === 'hourly-production'
                    ? 'bg-blue-600/15 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Hourly Production</span>
                </div>
                <span className="text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded font-mono">
                  Machines
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveView('delivery-received');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeView === 'delivery-received'
                    ? 'bg-purple-600/15 text-purple-400 border border-purple-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-purple-400" />
                  <span>Delivery & Received</span>
                </div>
                <span className="text-[10px] bg-purple-950/80 text-purple-400 border border-purple-800/50 px-1.5 py-0.5 rounded font-mono">
                  QR Logic
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveView('drilldown');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeView === 'drilldown'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <TableProperties className="w-4 h-4 text-cyan-400" />
                  <span>Orders & Drill-Down</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                  <Search className="w-2.5 h-2.5" />
                  Filter
                </span>
              </button>

              {/* Admin Panel & Static QR Generation */}
              <button
                onClick={() => {
                  setActiveView('admin');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeView === 'admin'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-amber-400" />
                  <span>Admin & QR Setup</span>
                </div>
                <span className="text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded font-mono">
                  Config
                </span>
              </button>

              {/* Worker / Operator Mobile Interface */}
              <button
                onClick={() => {
                  setActiveView('worker');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeView === 'worker'
                    ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Worker QR Portal</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                  <QrCode className="w-2.5 h-2.5" />
                  Floor
                </span>
              </button>
            </nav>
          </div>

          {/* 4 Main Production Categories as requested */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Production Categories (4)
              </p>
            </div>

            <div className="space-y-1">
              {['Loop', 'Strap', 'T-shirt', 'Other'].map((catId) => {
                const catData = categories.find((c) => c.id.toLowerCase() === catId.toLowerCase());
                const isSelected = selectedCategory === catId;

                return (
                  <button
                    key={catId}
                    onClick={() => {
                      onSelectCategory(catId);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition text-left group ${
                      isSelected
                        ? 'bg-slate-800 text-white border border-slate-700 shadow-md ring-1 ring-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 group-hover:scale-105 transition-transform">
                        {getCategoryIcon(catId)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">{catId}</div>
                        <div className="text-[10px] text-slate-400">
                          {catData?.linesActive || 0} active lines
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block text-[11px] font-mono font-bold text-slate-200">
                        {catData ? `${Math.round((catData.productionQty / (catData.orderQty || 1)) * 100)}%` : '--'}
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {catData?.totalOrders || 0} POs
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Status Summary Card */}
          <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-[11px] font-medium">Factory Status</span>
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Lines
              </span>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              28 production lines active across Loop, Strap, T-shirt & Trims.
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Bondtex MES Engine</span>
          <span className="text-slate-400 font-mono">v2.4.0</span>
        </div>
      </aside>
    </>
  );
}
