import React from 'react';
import {
  X,
  RefreshCw,
  Layers,
  Shirt,
  Boxes,
  ArrowRight,
  ExternalLink,
  Users,
  Activity,
  Calendar,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import MetricCards from './MetricCards';
import PlanVsActualChart from './PlanVsActualChart';
import { formatNumber, formatCompactNumber } from '../utils/formatters';

export default function CategoryDetailModal({
  category,
  onClose,
  onNavigateToDrillDown,
}) {
  if (!category) return null;

  const getCategoryIcon = (id) => {
    switch (id) {
      case 'Loop':
        return <RefreshCw className="w-6 h-6 text-blue-400" />;
      case 'Strap':
        return <Layers className="w-6 h-6 text-emerald-400" />;
      case 'T-shirt':
        return <Shirt className="w-6 h-6 text-amber-400" />;
      case 'Other':
        return <Boxes className="w-6 h-6 text-purple-400" />;
      default:
        return <Layers className="w-6 h-6 text-slate-400" />;
    }
  };

  const completionRate = category.orderQty > 0
    ? Math.round((category.productionQty / category.orderQty) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Top Header */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-inner">
                {getCategoryIcon(category.id)}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {category.name} Production
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    Category {category.code || 'CAT'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                  {category.description || 'Category overview and daily performance metrics.'}
                </p>
              </div>
            </div>

            {/* Quick meta pills */}
            <div className="flex items-center gap-3 self-start sm:self-auto text-xs">
              <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block font-medium">SUPERVISOR</span>
                <span className="text-slate-200 font-semibold">{category.supervisor || 'Shift Sup.'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block font-medium">ACTIVE LINES</span>
                <span className="text-emerald-400 font-bold font-mono">{category.linesActive || 6} Lines</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[calc(85vh-8rem)] overflow-y-auto">
          {/* Key Metric Cards: Order Qty, Production Qty, Delivery Qty, Balance Qty */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Key Production Metrics
              </h3>
              <span className="text-xs font-medium text-slate-400 font-mono">
                Overall Progress: {completionRate}%
              </span>
            </div>

            <MetricCards
              orderQty={category.orderQty}
              productionQty={category.productionQty}
              deliveryQty={category.deliveryQty}
              balanceQty={category.balanceQty}
              deliveryBalanceQty={category.deliveryBalanceQty}
              categoryName={category.name}
              onMetricClick={() => {
                onClose();
                onNavigateToDrillDown(category.id);
              }}
            />
          </div>

          {/* Plan vs Actual Dynamic Chart */}
          <PlanVsActualChart
            data={category.dailyPlanVsActual || []}
            title={`${category.name} - Plan vs Actual Output`}
            subtitle="Comparing daily manufacturing planned targets against actual output"
            categoryName={category.name}
          />

          {/* Styles Breakdown for this Category */}
          {category.styles && category.styles.length > 0 && (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Style Breakdown in {category.name}
                </h4>
                <span className="text-xs text-slate-400">
                  {category.styles.length} Active Styles
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {category.styles.map((st, idx) => {
                  const styleProgress = st.orderQty > 0 ? Math.round((st.productionQty / st.orderQty) * 100) : 0;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                          {st.name}
                        </span>
                        <span className="text-slate-400 font-mono font-medium">
                          {formatNumber(st.productionQty)} / {formatNumber(st.orderQty)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, styleProgress)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{st.ordersCount} Purchase Orders</span>
                        <span className="text-emerald-400 font-bold">{styleProgress}% Complete</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation to Drill-Down */}
        <div className="p-4 sm:p-6 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Want to search individual POs, scan barcodes, or filter by size/style?
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onNavigateToDrillDown(category.id);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/30"
            >
              <span>View All {category.name} Orders in Drill-Down</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
