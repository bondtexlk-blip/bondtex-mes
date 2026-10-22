import React from 'react';
import {
  RefreshCw,
  Layers,
  Shirt,
  Boxes,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users,
  Zap,
} from 'lucide-react';
import { formatNumber, formatCompactNumber } from '../utils/formatters';

export default function CategoryCards({ categories = [], onSelectCategory }) {
  const getCategoryDetails = (catId) => {
    switch (catId) {
      case 'Loop':
        return {
          icon: RefreshCw,
          themeGradient: 'from-blue-600/20 via-slate-900/40 to-slate-900',
          borderColor: 'border-blue-500/30 hover:border-blue-400',
          iconBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
          progressBar: 'bg-gradient-to-r from-blue-600 to-indigo-500',
          accentBadge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          leadText: 'High tension elastic loops & hook-fasteners',
        };
      case 'Strap':
        return {
          icon: Layers,
          themeGradient: 'from-emerald-600/20 via-slate-900/40 to-slate-900',
          borderColor: 'border-emerald-500/30 hover:border-emerald-400',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
          progressBar: 'bg-gradient-to-r from-emerald-600 to-teal-500',
          accentBadge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          leadText: 'Military & commercial webbing bonded straps',
        };
      case 'T-shirt':
        return {
          icon: Shirt,
          themeGradient: 'from-amber-600/20 via-slate-900/40 to-slate-900',
          borderColor: 'border-amber-500/30 hover:border-amber-400',
          iconBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
          progressBar: 'bg-gradient-to-r from-amber-600 to-orange-500',
          accentBadge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          leadText: 'Knitted crewneck, polo blanks & sportswear',
        };
      case 'Other':
        return {
          icon: Boxes,
          themeGradient: 'from-purple-600/20 via-slate-900/40 to-slate-900',
          borderColor: 'border-purple-500/30 hover:border-purple-400',
          iconBg: 'bg-purple-500/20 text-purple-400 border border-purple-500/40',
          progressBar: 'bg-gradient-to-r from-purple-600 to-pink-500',
          accentBadge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          leadText: 'Damask trims, heat seals, zippers & patches',
        };
      default:
        return {
          icon: Boxes,
          themeGradient: 'from-slate-700/20 via-slate-900/40 to-slate-900',
          borderColor: 'border-slate-700 hover:border-slate-500',
          iconBg: 'bg-slate-700 text-slate-300 border border-slate-600',
          progressBar: 'bg-blue-600',
          accentBadge: 'bg-slate-700 text-slate-300',
          leadText: 'Specialty factory components',
        };
    }
  };

  const defaultCategoryList = ['Loop', 'Strap', 'T-shirt', 'Other'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Production Categories</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              4 Units
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Click any category card to open detailed metrics and Plan vs Actual tracking analysis
          </p>
        </div>
        <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 self-start sm:self-auto">
          Tip: Click card to inspect
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {defaultCategoryList.map((catId) => {
          const category = categories.find((c) => c.id.toLowerCase() === catId.toLowerCase()) || {
            id: catId,
            name: catId,
            orderQty: 0,
            productionQty: 0,
            deliveryQty: 0,
            balanceQty: 0,
            completionRate: 0,
            totalOrders: 0,
            linesActive: 0,
            supervisor: 'Staff In Charge',
          };

          const style = getCategoryDetails(catId);
          const IconComp = style.icon;
          const completionRate = category.orderQty > 0
            ? Math.round((category.productionQty / category.orderQty) * 100)
            : 0;

          return (
            <div
              key={catId}
              onClick={() => onSelectCategory(catId)}
              className={`relative group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-b ${style.themeGradient} border ${style.borderColor} p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${style.iconBg} shadow-sm group-hover:scale-110 transition-transform`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                      {category.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <span>{category.totalOrders} POs</span>
                      <span>•</span>
                      <span>{category.linesActive || 4} Lines</span>
                    </div>
                  </div>
                </div>

                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.accentBadge}`}>
                  {catId === 'Loop' ? 'LP' : catId === 'Strap' ? 'ST' : catId === 'T-shirt' ? 'TS' : 'OT'}
                </span>
              </div>

              {/* Tagline */}
              <p className="text-[11px] text-slate-400 mb-4 line-clamp-1">
                {style.leadText}
              </p>

              {/* Metrics grid inside card */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 mb-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Order Qty</div>
                  <div className="text-sm font-bold text-slate-100 font-mono">
                    {formatCompactNumber(category.orderQty)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Produced</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {formatCompactNumber(category.productionQty)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Delivered</div>
                  <div className="text-sm font-bold text-cyan-400 font-mono">
                    {formatCompactNumber(category.deliveryQty)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Balance</div>
                  <div className="text-sm font-bold text-amber-400 font-mono">
                    {formatCompactNumber(category.balanceQty)}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">Production Progress</span>
                  <span className="text-[11px] font-bold text-slate-200 font-mono">
                    {completionRate}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${style.progressBar} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.min(100, completionRate)}%` }}
                  ></div>
                </div>
              </div>

              {/* Card Footer action */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[110px]">{category.supervisor || 'Shift Sup.'}</span>
                </span>
                <span className="flex items-center gap-1 text-blue-400 group-hover:translate-x-1 transition-transform">
                  View Details &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
