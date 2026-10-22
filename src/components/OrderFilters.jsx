import React from 'react';
import {
  Search,
  Barcode,
  Calendar,
  Filter,
  RotateCcw,
  Tag,
  Layers,
  ChevronDown,
  X,
  Palette,
  Package,
} from 'lucide-react';

export default function OrderFilters({
  filters,
  setFilters,
  metadata,
  onOpenBarcodeScanner,
  onResetFilters,
  totalResults,
}) {
  const categories = ['All', 'Loop', 'Strap', 'T-shirt', 'Other'];
  const statuses = ['All', 'On Track', 'Behind Plan', 'Ahead', 'Completed'];

  const handleTextSearch = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  };

  const handleCategoryChange = (cat) => {
    setFilters((prev) => ({ ...prev, category: cat }));
  };

  const handlePoChange = (e) => {
    setFilters((prev) => ({ ...prev, poNumber: e.target.value }));
  };

  const handleRmChange = (e) => {
    setFilters((prev) => ({ ...prev, rmMaterial: e.target.value }));
  };

  const handleColourChange = (e) => {
    setFilters((prev) => ({ ...prev, colour: e.target.value }));
  };

  const handleStyleChange = (e) => {
    setFilters((prev) => ({ ...prev, style: e.target.value }));
  };

  const handleSizeChange = (e) => {
    setFilters((prev) => ({ ...prev, size: e.target.value }));
  };

  const handleStartDateChange = (e) => {
    setFilters((prev) => ({ ...prev, startDate: e.target.value }));
  };

  const handleEndDateChange = (e) => {
    setFilters((prev) => ({ ...prev, endDate: e.target.value }));
  };

  const hasActiveFilters =
    filters.search ||
    (filters.poNumber && filters.poNumber !== 'All') ||
    (filters.rmMaterial && filters.rmMaterial !== 'All') ||
    (filters.colour && filters.colour !== 'All') ||
    (filters.category && filters.category !== 'All') ||
    (filters.style && filters.style !== 'All') ||
    (filters.size && filters.size !== 'All') ||
    (filters.status && filters.status !== 'All') ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-xl space-y-4">
      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Category:
          </span>
          {categories.map((cat) => {
            const isSelected = (filters.category || 'All').toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-white font-bold">{totalResults}</span> orders
        </div>
      </div>

      {/* Advanced Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        {/* 1. Global Search Bar (PO #, Barcode, RM Material, Colour) */}
        <div className="lg:col-span-4 relative">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Search PO # / RM / Colour / Barcode
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={handleTextSearch}
              placeholder="e.g. 4502991550, 200150259454A2, Black..."
              className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((p) => ({ ...p, search: '' }))}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onOpenBarcodeScanner}
              title="Open Barcode Scanner"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-300 p-1"
            >
              <Barcode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. PO # Selector Dropdown */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            PO #
          </label>
          <select
            value={filters.poNumber || 'All'}
            onChange={handlePoChange}
            aria-label="PO Number Selector"
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="All">All POs ({metadata?.poNumbers?.length || 0})</option>
            {(metadata?.poNumbers || []).map((po) => (
              <option key={po} value={po}>
                {po}
              </option>
            ))}
          </select>
        </div>

        {/* 3. RM Material Dropdown */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            RM Material
          </label>
          <select
            value={filters.rmMaterial || 'All'}
            onChange={handleRmChange}
            aria-label="RM Material Selector"
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="All">All RM Materials</option>
            {(metadata?.rmMaterials || []).map((rm) => (
              <option key={rm} value={rm}>
                {rm}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Colour Dropdown */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Colour
          </label>
          <select
            value={filters.colour || 'All'}
            onChange={handleColourChange}
            aria-label="Colour Selector"
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 truncate"
          >
            <option value="All">All Colours</option>
            {(metadata?.colours || []).map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Size Selector Dropdown (dynamically populated: 10, 12, 14, 16, 18) */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Size
          </label>
          <select
            value={filters.size || 'All'}
            onChange={handleSizeChange}
            aria-label="Size Selector"
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono font-bold"
          >
            <option value="All">All Sizes ({metadata?.sizes?.length || 0})</option>
            {(metadata?.sizes || []).map((sz) => (
              <option key={sz} value={sz}>
                Size {sz}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Style Selector & Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
        {/* Style Selector */}
        <div className="lg:col-span-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Style Description
          </label>
          <select
            value={filters.style || 'All'}
            onChange={handleStyleChange}
            aria-label="Style Description Selector"
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 truncate"
          >
            <option value="All">All Styles ({metadata?.styles?.length || 0})</option>
            {(metadata?.styles || []).map((st) => (
              <option key={st.code} value={st.code}>
                [{st.category}] {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="lg:col-span-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Start Date (On or after)
          </label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={handleStartDateChange}
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
          />
        </div>

        {/* End Date */}
        <div className="lg:col-span-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Target Completion (On or before)
          </label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={handleEndDateChange}
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Filter bottom row with Status & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs border-t border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px] font-medium">Tracking Status:</span>
          <div className="flex items-center gap-1">
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setFilters((p) => ({ ...p, status: st }))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  (filters.status || 'All') === st
                    ? 'bg-slate-700 text-white font-bold ring-1 ring-slate-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-rose-400 hover:bg-slate-700 hover:text-rose-300 transition text-xs font-semibold ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
