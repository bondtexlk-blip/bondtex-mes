import React from 'react';
import {
  PackageCheck,
  Factory,
  Truck,
  Scale,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CheckCircle2,
  Clock,
  Target,
} from 'lucide-react';
import { formatNumber, formatCompactNumber } from '../utils/formatters';

export default function MetricCards({
  orderQty = 0,
  productionQty = 0,
  deliveryQty = 0,
  balanceQty = 0,
  deliveryBalanceQty = 0,
  onMetricClick,
  categoryName,
}) {
  const completionRate = orderQty > 0 ? Math.round((productionQty / orderQty) * 100) : 0;
  const deliveryRate = orderQty > 0 ? Math.round((deliveryQty / orderQty) * 100) : 0;

  const cards = [
    {
      id: 'order',
      title: 'Order Qty',
      subtitle: 'Total Ordered Quantity',
      value: orderQty,
      icon: PackageCheck,
      color: 'blue',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      badge: 'Contract Base',
      progress: 100,
      progressColor: 'bg-blue-500',
      footer: `${categoryName ? `${categoryName} total booked volume` : 'All factory confirmed orders'}`,
    },
    {
      id: 'production',
      title: 'Production Qty',
      subtitle: 'Total Produced So Far',
      value: productionQty,
      icon: Factory,
      color: 'emerald',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      badge: `${completionRate}% Done`,
      progress: Math.min(100, completionRate),
      progressColor: 'bg-emerald-500',
      footer: `${formatCompactNumber(orderQty - productionQty)} remaining to produce`,
    },
    {
      id: 'delivery',
      title: 'Delivery Qty',
      subtitle: 'Total Dispatched / Delivered',
      value: deliveryQty,
      icon: Truck,
      color: 'cyan',
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      badge: `${deliveryRate}% Dispatched`,
      progress: Math.min(100, deliveryRate),
      progressColor: 'bg-cyan-500',
      footer: `${formatCompactNumber(deliveryBalanceQty || orderQty - deliveryQty)} pending delivery`,
    },
    {
      id: 'balance',
      title: 'Balance Qty',
      subtitle: 'Remaining Qty to Produce/Deliver',
      value: balanceQty,
      icon: Scale,
      color: balanceQty > 0 ? 'amber' : 'emerald',
      textColor: balanceQty > 0 ? 'text-amber-400' : 'text-emerald-400',
      bgColor: balanceQty > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      borderColor: balanceQty > 0 ? 'border-amber-500/20' : 'border-emerald-500/20',
      badge: balanceQty === 0 ? 'Fulfilled' : 'In Backlog',
      progress: Math.max(0, 100 - completionRate),
      progressColor: 'bg-amber-500',
      footer: `Production balance: ${formatNumber(balanceQty)} pcs`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            onClick={() => onMetricClick && onMetricClick(card.id)}
            className={`relative overflow-hidden rounded-2xl bg-slate-900/80 border ${card.borderColor} p-5 hover:border-slate-600 transition-all duration-200 group cursor-pointer shadow-lg hover:shadow-xl hover:translate-y-[-2px]`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${card.bgColor} ${card.textColor} border ${card.borderColor}`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[130px]">
                    {card.subtitle}
                  </p>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.bgColor} ${card.textColor} ${card.borderColor}`}
              >
                {card.badge}
              </span>
            </div>

            {/* Main Value */}
            <div className="mt-2 mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
                  {formatNumber(card.value)}
                </span>
                <span className="text-xs text-slate-400 font-medium">pcs</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2">
              <div
                className={`h-full ${card.progressColor} rounded-full transition-all duration-500`}
                style={{ width: `${card.progress}%` }}
              ></div>
            </div>

            {/* Card Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span className="truncate">{card.footer}</span>
              <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center font-medium">
                View &rarr;
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
