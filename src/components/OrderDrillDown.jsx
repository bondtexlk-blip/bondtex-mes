import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Filter,
  Download,
  Barcode,
  Search,
  PackageCheck,
  Factory,
  Truck,
  Scale,
  RefreshCw,
} from 'lucide-react';
import OrderFilters from './OrderFilters';
import OrderTable from './OrderTable';
import { formatNumber, formatCompactNumber } from '../utils/formatters';
import { api } from '../api/client';

export default function OrderDrillDown({
  initialCategory = 'All',
  onBackToDashboard,
  onViewDailyTracking,
  onLogProduction,
  onPrintBarcode,
  onOpenBarcodeScanner,
  metadata,
}) {
  const [filters, setFilters] = useState({
    search: '',
    poNumber: 'All',
    rmMaterial: 'All',
    colour: 'All',
    category: initialCategory,
    style: 'All',
    size: 'All',
    status: 'All',
    startDate: '',
    endDate: '',
  });

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('poNumber');
  const [sortOrder, setSortOrder] = useState('asc');

  // Load filtered orders whenever filters or sort changes
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        sortBy,
        sortOrder,
      };
      const res = await api.getOrders(params);
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filters, sortBy, sortOrder]);

  // If initialCategory changes externally
  useEffect(() => {
    if (initialCategory) {
      setFilters((prev) => ({ ...prev, category: initialCategory }));
    }
  }, [initialCategory]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      poNumber: 'All',
      rmMaterial: 'All',
      colour: 'All',
      category: 'All',
      style: 'All',
      size: 'All',
      status: 'All',
      startDate: '',
      endDate: '',
    });
  };

  const handleExportCsv = () => {
    const exportUrl = api.getExportUrl({ ...filters, sortBy, sortOrder });
    window.open(exportUrl, '_blank');
  };

  // Filtered totals
  const totalOrderQty = orders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0);
  const totalProductionQty = orders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0);
  const totalDeliveryQty = orders.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0);
  const totalBalanceQty = Math.max(0, totalOrderQty - totalProductionQty);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4 text-blue-400" />
            <span>Back to Overview</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Order Details & Search Drill-Down
            </h1>
            <p className="text-xs text-slate-400">
              Query purchase orders by barcode or PO #, select style/size, and analyze daily Plan vs Actual tracking
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition self-start sm:self-auto"
          title="Refresh table"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filtered Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <PackageCheck className="w-4 h-4 text-blue-400" />
            <span>Filtered Order Qty</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white font-mono">
            {formatNumber(totalOrderQty)} <span className="text-xs text-slate-400 font-normal">pcs</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Factory className="w-4 h-4 text-emerald-400" />
            <span>Filtered Production</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-400 font-mono">
            {formatNumber(totalProductionQty)} <span className="text-xs text-slate-400 font-normal">pcs</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Truck className="w-4 h-4 text-cyan-400" />
            <span>Filtered Delivery</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-cyan-400 font-mono">
            {formatNumber(totalDeliveryQty)} <span className="text-xs text-slate-400 font-normal">pcs</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Scale className="w-4 h-4 text-amber-400" />
            <span>Filtered Balance</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-400 font-mono">
            {formatNumber(totalBalanceQty)} <span className="text-xs text-slate-400 font-normal">pcs</span>
          </div>
        </div>
      </div>

      {/* Advanced Search & Filters */}
      <OrderFilters
        filters={filters}
        setFilters={setFilters}
        metadata={metadata}
        onOpenBarcodeScanner={onOpenBarcodeScanner}
        onResetFilters={handleResetFilters}
        totalResults={orders.length}
      />

      {/* Comprehensive Data Table */}
      <OrderTable
        orders={orders}
        loading={loading}
        onViewDailyTracking={onViewDailyTracking}
        onLogProduction={onLogProduction}
        onPrintBarcode={onPrintBarcode}
        onExportCsv={handleExportCsv}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />
    </div>
  );
}
