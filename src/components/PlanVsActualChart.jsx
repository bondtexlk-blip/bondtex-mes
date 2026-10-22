import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatNumber, formatShortDate } from '../utils/formatters';

export default function PlanVsActualChart({
  data = [],
  title = 'Plan vs Actual Qty Tracking',
  subtitle = 'Daily target plan vs actual production output',
  categoryName = 'All Categories',
}) {
  const [chartType, setChartType] = useState('composed'); // 'composed', 'bar', 'line'
  const [showDelivery, setShowDelivery] = useState(true);

  // Compute summary stats
  const totalPlan = data.reduce((acc, curr) => acc + (Number(curr.planQty) || 0), 0);
  const totalActual = data.reduce((acc, curr) => acc + (Number(curr.actualQty) || 0), 0);
  const totalDelivery = data.reduce((acc, curr) => acc + (Number(curr.deliveryQty) || 0), 0);
  const variance = totalActual - totalPlan;
  const efficiency = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 100) : 100;

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const plan = payload.find((p) => p.dataKey === 'planQty')?.value || 0;
      const actual = payload.find((p) => p.dataKey === 'actualQty')?.value || 0;
      const delivery = payload.find((p) => p.dataKey === 'deliveryQty')?.value || 0;
      const dayDiff = actual - plan;
      const dayEff = plan > 0 ? Math.round((actual / plan) * 100) : 100;

      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs min-w-[210px] space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {label}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                dayDiff >= 0
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              {dayEff}% Eff.
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                Daily Target Plan:
              </span>
              <span className="font-mono font-semibold text-slate-200">
                {formatNumber(plan)} pcs
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                Actual Production:
              </span>
              <span className="font-mono font-bold text-blue-400">
                {formatNumber(actual)} pcs
              </span>
            </div>

            {showDelivery && (
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  Dispatched:
                </span>
                <span className="font-mono font-semibold text-emerald-400">
                  {formatNumber(delivery)} pcs
                </span>
              </div>
            )}
          </div>

          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Day Variance:</span>
            <span
              className={`font-mono font-bold ${
                dayDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {dayDiff >= 0 ? `+${formatNumber(dayDiff)}` : formatNumber(dayDiff)} pcs
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl space-y-4">
      {/* Top Header & Chart Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-medium">
              {categoryName}
            </span>
          </div>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>

        {/* Chart View Switches */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs">
            <button
              onClick={() => setChartType('composed')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                chartType === 'composed'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Combined
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                chartType === 'bar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bars
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                chartType === 'line'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trends
            </button>
          </div>

          <button
            onClick={() => setShowDelivery(!showDelivery)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
              showDelivery
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showDelivery ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            Delivery
          </button>
        </div>
      </div>

      {/* Dynamic Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
        <div>
          <span className="text-slate-400 text-[11px] block">Total Target Plan</span>
          <span className="text-sm sm:text-base font-bold text-slate-200 font-mono">
            {formatNumber(totalPlan)} pcs
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px] block">Total Actual Output</span>
          <span className="text-sm sm:text-base font-bold text-blue-400 font-mono">
            {formatNumber(totalActual)} pcs
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px] block">Variance (+ / -)</span>
          <span
            className={`text-sm sm:text-base font-bold font-mono flex items-center gap-1 ${
              variance >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {variance >= 0 ? (
              <ArrowUpRight className="w-4 h-4 inline" />
            ) : (
              <ArrowDownRight className="w-4 h-4 inline" />
            )}
            {variance >= 0 ? `+${formatNumber(variance)}` : formatNumber(variance)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px] block">Overall Plan Adherence</span>
          <span
            className={`text-sm sm:text-base font-bold font-mono ${
              efficiency >= 100
                ? 'text-emerald-400'
                : efficiency >= 90
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {efficiency}%
          </span>
        </div>
      </div>

      {/* Main Responsive Chart */}
      <div className="h-72 w-full pt-2">
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <Clock className="w-8 h-8 text-slate-600 mb-2" />
            <span>No daily tracking logs available for this period</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'composed' ? (
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', color: '#94a3b8' }}
                />
                {/* Target Plan bar or line */}
                <Bar
                  dataKey="planQty"
                  name="Plan Target"
                  fill="#475569"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey="actualQty"
                  name="Actual Output"
                  fill="url(#actualGradient)"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                {showDelivery && (
                  <Line
                    type="monotone"
                    dataKey="deliveryQty"
                    name="Delivered"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </ComposedChart>
            ) : chartType === 'bar' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#64748b" fontSize={11} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                />
                <Bar dataKey="planQty" name="Plan Target" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actualQty" name="Actual Output" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                {showDelivery && (
                  <Bar dataKey="deliveryQty" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#64748b" fontSize={11} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                />
                <Line
                  type="monotone"
                  dataKey="planQty"
                  name="Plan Target"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="actualQty"
                  name="Actual Output"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                {showDelivery && (
                  <Line
                    type="monotone"
                    dataKey="deliveryQty"
                    name="Delivered"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
