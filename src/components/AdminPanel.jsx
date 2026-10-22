import React, { useState, useEffect } from 'react';
import {
  Settings,
  QrCode,
  Printer,
  Save,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Palette,
  Hash,
  Users,
  Target,
  Smartphone,
  Eye,
  Activity,
  Wifi,
  Globe,
  RotateCw,
  Edit2,
  Trash2,
  UserPlus,
  Search,
  Filter,
  ShieldCheck,
  Briefcase,
  Clock,
  X,
  ChevronRight,
  Sun,
  Moon,
  Check,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import MachineQrPrintModal from './MachineQrPrintModal';
import { formatNumber } from '../utils/formatters';
import { buildMachinePortalUrl, resolveProductionHost, PRODUCTION_HOST } from '../utils/urlHelper';

// Standard Factory Colour Swatches Map
const COLOUR_SWATCH_MAP = {
  'Black 093 54A2': { bg: '#18181b', border: '#3f3f46', text: '#ffffff' },
  'Marzipan 39H6': { bg: '#d4a373', border: '#b5835a', text: '#18181b' },
  'Praline 65H8': { bg: '#bc6c25', border: '#9b561c', text: '#ffffff' },
  'Ganache 33F6': { bg: '#4a2c1d', border: '#331e13', text: '#ffffff' },
  'Talc 69-09-47 57H1': { bg: '#e7e5e4', border: '#d6d3d1', text: '#18181b' },
  'Optic White 001': { bg: '#f8fafc', border: '#cbd5e1', text: '#18181b' },
  'Navy Blue 042': { bg: '#1e3a8a', border: '#172554', text: '#ffffff' },
  'Olive Drab 88': { bg: '#3f4f2c', border: '#2e3a1f', text: '#ffffff' },
  'Steel Grey 55': { bg: '#64748b', border: '#475569', text: '#ffffff' },
};

function getSwatch(col) {
  if (!col) return { bg: '#475569', border: '#64748b', text: '#ffffff' };
  return COLOUR_SWATCH_MAP[col] || { bg: '#334155', border: '#475569', text: '#ffffff' };
}

export default function AdminPanel({
  metadata = {},
  onNavigateToWorker,
  onShowToast,
  onDataUpdated,
  theme = 'dark',
  onToggleTheme,
}) {
  const [adminTab, setAdminTab] = useState('machines'); // 'machines' | 'workers'
  const [machines, setMachines] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState('MCH-01');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printModalMachine, setPrintModalMachine] = useState(null);

  // Network Host State for Mobile-friendly QR codes (defaults to live production cloud URL)
  const [networkHost, setNetworkHost] = useState(() => resolveProductionHost());
  const [detectedLocalIp, setDetectedLocalIp] = useState('');
  const [allNetworkInterfaces, setAllNetworkInterfaces] = useState([]);

  // Custom Colour & Size Add Inputs
  const [customColourInput, setCustomColourInput] = useState('');
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [sizeTypeTab, setSizeTypeTab] = useState('numbered'); // 'numbered' | 'alpha'

  // Master colour repository (combines default reference + metadata + custom added)
  const defaultColoursList = [
    'Black 093 54A2',
    'Marzipan 39H6',
    'Praline 65H8',
    'Ganache 33F6',
    'Talc 69-09-47 57H1',
  ];
  const [availableColours, setAvailableColours] = useState(defaultColoursList);

  // Form State for editing the selected machine
  const [formData, setFormData] = useState({
    id: 'MCH-01',
    code: 'MCH-01',
    name: 'Machine 01',
    type: 'High Speed Elastic Loom L1',
    category: 'Loop',
    operatorName: 'Sunil Perera',
    shift: 'Shift A',
    status: 'Active',
    dailyTargetQty: 2500,
    assignedStyles: ['Loop Elastic Band - 54A2'],
    assignedColours: ['Black 093 54A2'],
    assignedSizes: ['10', '12', '14', '16'],
    notes: 'Primary elastic loop line with auto tension feed',
  });

  // Worker Management State
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerCategoryFilter, setWorkerCategoryFilter] = useState('All');
  const [workerShiftFilter, setWorkerShiftFilter] = useState('All');
  const [workerForm, setWorkerForm] = useState({
    name: '',
    empId: '',
    category: 'Loop',
    shift: 'Shift A',
    assignedMachine: 'Machine 01 (MCH-01)',
    status: 'Active',
  });

  // Fetch machines, workers, and network info from backend
  const loadData = async () => {
    try {
      setLoading(true);
      const [machinesRes, netRes, workersRes] = await Promise.all([
        api.getMachines().catch(() => ({ success: false })),
        api.getNetworkInfo().catch(() => ({ success: false })),
        api.getWorkers().catch(() => ({ success: false })),
      ]);

      if (machinesRes && machinesRes.success && Array.isArray(machinesRes.data)) {
        setMachines(machinesRes.data);
        const current = machinesRes.data.find((m) => m && (m.id === selectedMachineId || m.code === selectedMachineId)) || machinesRes.data[0];
        if (current) {
          setSelectedMachineId(current.id || current.code);
          populateForm(current);
        }
      }

      if (workersRes && workersRes.success && Array.isArray(workersRes.data)) {
        setWorkers(workersRes.data);
      }

      if (netRes && netRes.success && netRes.data) {
        const ip = netRes.data.localIp || '';
        setDetectedLocalIp(ip);
        setAllNetworkInterfaces(netRes.data.allInterfaces || []);
      }

      // Ensure networkHost is always a phone-accessible production URL rather than localhost
      setNetworkHost((prev) => {
        if (prev && !prev.includes('127.0.0.1') && !prev.includes('localhost')) {
          return prev;
        }
        return resolveProductionHost();
      });
    } catch (err) {
      console.error('Error loading admin data:', err);
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync available colours if metadata updates
  useEffect(() => {
    if (metadata?.colours && Array.isArray(metadata.colours)) {
      setAvailableColours((prev) => {
        const set = new Set([...(prev || []), ...metadata.colours]);
        return Array.from(set);
      });
    }
  }, [metadata]);

  const populateForm = (m) => {
    if (!m) return;
    const colours = Array.isArray(m.assignedColours) ? m.assignedColours : ['Black 093 54A2'];
    const sizes = Array.isArray(m.assignedSizes) ? m.assignedSizes : ['10', '12', '14'];
    const styles = Array.isArray(m.assignedStyles)
      ? m.assignedStyles.map((s) => (typeof s === 'string' ? s : (s?.name || s?.code || 'Style')))
      : ['Loop Elastic Band - 54A2'];

    // Ensure machine colours are in availableColours
    setAvailableColours((prev) => {
      const set = new Set([...(prev || []), ...colours]);
      return Array.from(set);
    });

    setFormData({
      id: m.id || m.code || 'MCH-01',
      code: m.code || m.id || 'MCH-01',
      name: m.name || 'Machine 01',
      type: m.type || 'Standard Production Unit',
      category: m.category || 'Loop',
      operatorName: m.operatorName || (workers && workers.length > 0 ? workers[0]?.name || '' : 'Floor Operator'),
      shift: m.shift || 'Shift A',
      status: m.status || 'Active',
      dailyTargetQty: Number(m.dailyTargetQty) || 2500,
      assignedStyles: styles,
      assignedColours: colours,
      assignedSizes: sizes,
      notes: m.notes || '',
    });
  };

  const handleSelectMachine = (machineId) => {
    setSelectedMachineId(machineId);
    if (machineId === 'NEW') {
      const nextNum = (machines || []).length + 1;
      const code = `MCH-${String(nextNum).padStart(2, '0')}`;
      setFormData({
        id: code,
        code,
        name: `Machine ${String(nextNum).padStart(2, '0')}`,
        type: 'Standard Production Unit',
        category: 'Loop',
        operatorName: workers && workers.length > 0 ? workers[0]?.name || '' : 'Assigned Operator',
        shift: 'Shift A',
        status: 'Active',
        dailyTargetQty: 2500,
        assignedStyles: ['Loop Elastic Band - 54A2'],
        assignedColours: ['Black 093 54A2', 'Marzipan 39H6'],
        assignedSizes: ['10', '12', '14', '16'],
        notes: '',
      });
    } else {
      const m = (machines || []).find((item) => item && (item.id === machineId || item.code === machineId));
      if (m) populateForm(m);
    }
  };

  // Toggle selection for colours
  const toggleColour = (col) => {
    setFormData((prev) => {
      const current = prev.assignedColours || [];
      const updated = current.includes(col)
        ? current.filter((c) => c !== col)
        : [...current, col];
      return { ...prev, assignedColours: updated };
    });
  };

  // Select All Colours
  const handleSelectAllColours = () => {
    setFormData((prev) => ({
      ...prev,
      assignedColours: [...availableColours],
    }));
    if (onShowToast) onShowToast(`Selected all ${availableColours.length} colours`);
  };

  // Clear All Colours
  const handleClearColours = () => {
    setFormData((prev) => ({
      ...prev,
      assignedColours: [],
    }));
  };

  // Add Custom Colour to Machine & Palette
  const handleAddCustomColour = (e) => {
    e.preventDefault();
    const trimmed = customColourInput.trim();
    if (!trimmed) return;

    if (!availableColours.includes(trimmed)) {
      setAvailableColours((prev) => [...prev, trimmed]);
    }
    setFormData((prev) => ({
      ...prev,
      assignedColours: (prev.assignedColours || []).includes(trimmed)
        ? prev.assignedColours
        : [...(prev.assignedColours || []), trimmed],
    }));
    setCustomColourInput('');
    if (onShowToast) onShowToast(`Added colour "${trimmed}"!`);
  };

  // Toggle selection for sizes
  const toggleSize = (sz) => {
    setFormData((prev) => {
      const current = prev.assignedSizes || [];
      const updated = current.includes(sz)
        ? current.filter((s) => s !== sz)
        : [...current, sz];
      return { ...prev, assignedSizes: updated };
    });
  };

  // Select Standard Numbered Sizes
  const handleSelectStandardSizes = () => {
    const std = ['10', '12', '14', '16', '18'];
    setFormData((prev) => ({
      ...prev,
      assignedSizes: std,
    }));
    if (onShowToast) onShowToast('Assigned standard size set (10 - 18)');
  };

  // Clear All Sizes
  const handleClearSizes = () => {
    setFormData((prev) => ({
      ...prev,
      assignedSizes: [],
    }));
  };

  // Add Custom Size
  const handleAddCustomSize = (e) => {
    e.preventDefault();
    const trimmed = customSizeInput.trim().toUpperCase();
    if (!trimmed) return;

    setFormData((prev) => ({
      ...prev,
      assignedSizes: (prev.assignedSizes || []).includes(trimmed)
        ? prev.assignedSizes
        : [...(prev.assignedSizes || []), trimmed],
    }));
    setCustomSizeInput('');
    if (onShowToast) onShowToast(`Added size "${trimmed}"!`);
  };

  // Toggle selection for styles (safely handles object or string)
  const toggleStyle = (st) => {
    const styleName = typeof st === 'string' ? st : (st?.name || st?.code || String(st));
    setFormData((prev) => {
      const current = (prev.assignedStyles || []).map((s) => (typeof s === 'string' ? s : (s?.name || s?.code || 'Style')));
      const updated = current.includes(styleName)
        ? current.filter((s) => s !== styleName)
        : [...current, styleName];
      return { ...prev, assignedStyles: updated };
    });
  };

  // Submit / Save Machine Configuration
  const handleSaveMachine = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      if (onShowToast) onShowToast('Machine name is required', 'error');
      return;
    }
    const sizes = formData.assignedSizes || [];
    const colours = formData.assignedColours || [];
    if (sizes.length === 0) {
      if (onShowToast) onShowToast('Please assign at least one Size to this machine', 'error');
      return;
    }
    if (colours.length === 0) {
      if (onShowToast) onShowToast('Please assign at least one Colour to this machine', 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await api.saveMachine(formData);
      if (res && res.success) {
        if (onShowToast) onShowToast(`Static QR & setup saved for ${formData.name}!`);
        await loadData();
        if (onDataUpdated) onDataUpdated();
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Open Add Worker Modal
  const handleOpenAddWorker = () => {
    const nextNum = (workers || []).length + 1;
    setEditingWorker(null);
    setWorkerForm({
      name: '',
      empId: `EMP-${100 + nextNum}`,
      category: 'Loop',
      shift: 'Shift A',
      assignedMachine: machines && machines.length > 0 ? `${machines[0]?.name} (${machines[0]?.code})` : '',
      status: 'Active',
    });
    setWorkerModalOpen(true);
  };

  // Open Edit Worker Modal
  const handleOpenEditWorker = (worker) => {
    if (!worker) return;
    setEditingWorker(worker);
    setWorkerForm({
      name: worker.name || '',
      empId: worker.empId || '',
      category: worker.category || 'Loop',
      shift: worker.shift || 'Shift A',
      assignedMachine: worker.assignedMachine || '',
      status: worker.status || 'Active',
    });
    setWorkerModalOpen(true);
  };

  // Save Worker
  const handleSaveWorker = async (e) => {
    e.preventDefault();
    if (!workerForm.name.trim()) {
      if (onShowToast) onShowToast('Worker name is required', 'error');
      return;
    }
    if (!workerForm.empId.trim()) {
      if (onShowToast) onShowToast('Employee ID is required', 'error');
      return;
    }

    try {
      if (editingWorker) {
        const res = await api.updateWorker(editingWorker.id, workerForm);
        if (res && res.success) {
          if (onShowToast) onShowToast(`Worker ${workerForm.name} updated successfully!`);
        }
      } else {
        const res = await api.createWorker(workerForm);
        if (res && res.success) {
          if (onShowToast) onShowToast(`Worker ${workerForm.name} registered successfully!`);
        }
      }
      setWorkerModalOpen(false);
      const workersRes = await api.getWorkers();
      if (workersRes && workersRes.success) setWorkers(workersRes.data || []);
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    }
  };

  // Delete Worker
  const handleDeleteWorker = async (worker) => {
    if (!worker) return;
    if (!window.confirm(`Are you sure you want to delete worker "${worker.name}" (${worker.empId})?`)) {
      return;
    }
    try {
      const res = await api.deleteWorker(worker.id);
      if (res && res.success) {
        if (onShowToast) onShowToast(`Worker ${worker.name} deleted.`);
        const workersRes = await api.getWorkers();
        if (workersRes && workersRes.success) setWorkers(workersRes.data || []);
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    }
  };

  // Delete Machine Station
  const handleDeleteMachine = async (machine) => {
    if (!machine) return;
    const mName = machine.name || 'Machine';
    const mCode = machine.code || machine.id || '';
    if (!window.confirm(`Are you sure you want to delete machine station "${mName}" (${mCode})? This will permanently remove its QR entry.`)) {
      return;
    }
    try {
      const res = await api.deleteMachine(machine.id || machine.code);
      if (res && res.success) {
        if (onShowToast) onShowToast(`Machine ${mName} deleted successfully!`);
        await loadData();
      } else {
        if (onShowToast) onShowToast(res?.message || 'Failed to delete machine', 'error');
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Error deleting machine', 'error');
    }
  };

  // Filtered workers list
  const filteredWorkers = (workers || []).filter((w) => {
    if (!w) return false;
    if (workerCategoryFilter !== 'All' && w.category !== workerCategoryFilter) return false;
    if (workerShiftFilter !== 'All' && w.shift !== workerShiftFilter) return false;
    if (workerSearch && workerSearch.trim()) {
      const q = workerSearch.toLowerCase();
      const matchName = (w.name || '').toLowerCase().includes(q);
      const matchEmp = (w.empId || '').toLowerCase().includes(q);
      const matchMach = (w.assignedMachine || '').toLowerCase().includes(q);
      if (!matchName && !matchEmp && !matchMach) return false;
    }
    return true;
  });

  // Compute Static permanent QR URL using live production cloud host or custom host
  const effectiveHost = resolveProductionHost(networkHost);
  const staticQrUrl = buildMachinePortalUrl(formData?.code || formData?.id || 'MCH-01', effectiveHost);

  const assignedColoursList = formData?.assignedColours || [];
  const assignedSizesList = formData?.assignedSizes || [];
  const assignedStylesList = (formData?.assignedStyles || []).map((s) =>
    typeof s === 'string' ? s : (s?.name || s?.code || 'Style')
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-1.5">
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Plant Management & Floor Configuration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Admin Control & Machine QR Setup
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Configure machine static QR codes encoded with local network IP, assign production styles, colour sets, sizes, and manage floor operators.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Quick Dark/Light Mode Switch in Admin */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm"
                title="Toggle Dark / Light Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                <span className="hidden sm:inline">{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
              </button>
            )}

            {/* Sub-tab Navigation */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAdminTab('machines')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                  adminTab === 'machines'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Machine QR Setup</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('workers')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                  adminTab === 'workers'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Worker Management</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-cyan-300 font-mono">
                  {(workers || []).length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* TAB 1: MACHINE QR SETUP & FLEET OVERVIEW                  */}
      {/* ========================================================== */}
      {adminTab === 'machines' && (
        <div className="space-y-6">
          {/* Main Configuration Grid: Setup Form (Left) & Permanent QR Generator (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Machine Details & Scope Configurator */}
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Machine Configuration</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono">
                      {formData?.code || 'MCH-01'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Choose a machine to configure assigned colours, sizes, and daily target
                  </p>
                </div>

                {/* Quick machine picker */}
                <select
                  value={selectedMachineId}
                  onChange={(e) => handleSelectMachine(e.target.value)}
                  aria-label="Select Machine"
                  className="bg-slate-950 border border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {(machines || []).filter(Boolean).map((m) => (
                    <option key={m.id || m.code} value={m.id || m.code}>
                      {m.name || 'Machine'} ({m.category || 'General'})
                    </option>
                  ))}
                  <option value="NEW">+ Configure New Machine</option>
                </select>
              </div>

              <form onSubmit={handleSaveMachine} className="space-y-4 text-xs">
                {/* Machine Name & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Machine Name (e.g. Machine 01)
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g. Machine 01"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Category Division
                    </label>
                    <select
                      value={formData.category || 'Loop'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      aria-label="Category Selector"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Loop">Loop (Elastic & Fasteners)</option>
                      <option value="Strap">Strap (Nylon & Polyester Webbings)</option>
                      <option value="T-shirt">T-shirt (Knitted Apparel & Blanks)</option>
                      <option value="Other">Other (Trims & Accessories)</option>
                    </select>
                  </div>
                </div>

                {/* Operator (Dropdown from Worker Management) & Shift */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Assigned Operator Name
                      </label>
                      <button
                        type="button"
                        onClick={() => setAdminTab('workers')}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        + Manage Workers
                      </button>
                    </div>
                    <select
                      value={formData.operatorName || ''}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        const foundWorker = (workers || []).find((w) => w && w.name === selectedName);
                        setFormData((prev) => ({
                          ...prev,
                          operatorName: selectedName,
                          shift: foundWorker?.shift || prev.shift,
                        }));
                      }}
                      aria-label="Assigned Operator Selector"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Select Registered Operator --</option>
                      {(workers || []).filter(Boolean).map((w) => (
                        <option key={w.id || w.name} value={w.name}>
                          {w.name} ({w.empId || 'EMP'}) • {w.category || 'Division'} • {w.shift || 'Shift'}
                        </option>
                      ))}
                      {formData.operatorName && !(workers || []).some((w) => w && w.name === formData.operatorName) && (
                        <option value={formData.operatorName}>{formData.operatorName} (Custom)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Default Shift
                    </label>
                    <select
                      value={formData.shift || 'Shift A'}
                      onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                      aria-label="Shift Selector"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Day Shift">Day Shift (07:45 - 21:30)</option>
                      <option value="Night Shift">Night Shift (21:30 - 07:30)</option>
                      <option value="Shift A">Shift A (Morning)</option>
                      <option value="Shift B">Shift B (Evening)</option>
                      <option value="Shift C">Shift C (Night)</option>
                    </select>
                  </div>
                </div>

                {/* Daily Target Qty */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Daily Manufacturing Target (Pieces / Day)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="100"
                      step="50"
                      value={formData.dailyTargetQty || 2500}
                      onChange={(e) => setFormData({ ...formData, dailyTargetQty: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-14 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                      pcs
                    </span>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* ENHANCED COLOUR SETS ASSIGNMENT WITH SWATCHES & ADD INPUT */}
                {/* ========================================================= */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Assign Colour Sets for Production</span>
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {assignedColoursList.length} of {(availableColours || []).length} Colours Active
                      </span>
                    </div>

                    {/* Quick Selection Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllColours}
                        className="px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 text-[10px] font-bold"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearColours}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-[10px] font-semibold"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Active Selected Colour Tags Bar */}
                  {assignedColoursList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                      {assignedColoursList.map((col) => {
                        const swatch = getSwatch(col);
                        return (
                          <span
                            key={col}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-950 border border-slate-700 text-white shadow-xs"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border"
                              style={{ backgroundColor: swatch.bg, borderColor: swatch.border }}
                            ></span>
                            <span className="truncate max-w-[140px]">{col}</span>
                            <button
                              type="button"
                              onClick={() => toggleColour(col)}
                              className="text-slate-400 hover:text-rose-400 transition ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Available Colour Swatch Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                    {(availableColours || []).map((col) => {
                      const isChecked = assignedColoursList.includes(col);
                      const swatch = getSwatch(col);

                      return (
                        <button
                          type="button"
                          key={col}
                          onClick={() => toggleColour(col)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition text-xs font-semibold ${
                            isChecked
                              ? 'bg-blue-600/20 text-white border-blue-500 ring-1 ring-blue-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-4 h-4 rounded-full shrink-0 border shadow-sm"
                              style={{ backgroundColor: swatch.bg, borderColor: swatch.border }}
                            ></span>
                            <span className="truncate">{col}</span>
                          </div>

                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] border shrink-0 ${
                              isChecked
                                ? 'bg-blue-500 border-blue-400 text-white font-bold'
                                : 'border-slate-700 bg-slate-800 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add New Custom Colour Code */}
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={customColourInput}
                      onChange={(e) => setCustomColourInput(e.target.value)}
                      placeholder="Add new colour code (e.g. Navy 042)..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomColour}
                      disabled={!customColourInput.trim()}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-semibold text-xs border border-slate-700 transition disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* ENHANCED SIZES ASSIGNMENT WITH NUMBERED / ALPHA & CUSTOM  */}
                {/* ========================================================= */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Assign Sizes for this Machine</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {assignedSizesList.length} Selected
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectStandardSizes}
                        className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-[10px] font-bold"
                      >
                        Standard 10-18
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSizes}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-[10px] font-semibold"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Size Preset Switcher Tabs */}
                  <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setSizeTypeTab('numbered')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        sizeTypeTab === 'numbered'
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Numbered (10, 12, 14, 16, 18, 20...)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSizeTypeTab('alpha')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        sizeTypeTab === 'alpha'
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Alpha (XS, S, M, L, XL, 2XL)
                    </button>
                  </div>

                  {/* Size Buttons Grid */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(sizeTypeTab === 'numbered'
                      ? ['10', '12', '14', '16', '18', '20', '22', '24']
                      : ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
                    ).map((sz) => {
                      const isChecked = assignedSizesList.includes(sz);
                      return (
                        <button
                          type="button"
                          key={sz}
                          onClick={() => toggleSize(sz)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-mono font-black border transition ${
                            isChecked
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30 ring-1 ring-emerald-300'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          Size {sz}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Size Adder */}
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      placeholder="Add custom size (e.g. 26 or Free)..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSize}
                      disabled={!customSizeInput.trim()}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-semibold text-xs border border-slate-700 transition disabled:opacity-40"
                    >
                      + Add Size
                    </button>
                  </div>
                </div>

                {/* Styles Assignment */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Assigned Styles</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {assignedStylesList.length} Selected
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 max-h-56 overflow-y-auto pr-1">
                    {(metadata?.styles || [
                      'Loop Elastic Band - 54A2',
                      'Loop Fastener Trim - 54A2',
                      'Strap Heavy Webbing - 39H6',
                      'T-shirt Jersey Rib - 65H8',
                    ]).map((st) => {
                      const styleName = typeof st === 'string' ? st : (st?.name || st?.code || 'Style');
                      const styleCode = typeof st === 'string' ? st : (st?.code || styleName);
                      const styleCategory = typeof st === 'object' && st?.category ? st.category : '';
                      const isChecked =
                        assignedStylesList.includes(styleName) || assignedStylesList.includes(styleCode);

                      return (
                        <button
                          type="button"
                          key={styleCode || styleName}
                          onClick={() => toggleStyle(styleName)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition text-xs ${
                            isChecked
                              ? 'bg-amber-500/15 text-white border-amber-500/50 ring-1 ring-amber-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {styleCategory && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-700 text-amber-400 font-mono shrink-0">
                                {styleCategory}
                              </span>
                            )}
                            <span className="font-medium truncate text-white">{styleName}</span>
                          </div>
                          <span className="text-[10px] text-amber-400 font-mono shrink-0 ml-2">
                            {isChecked ? '✓ Assigned' : '+ Add'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleSelectMachine('NEW')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition"
                  >
                    Reset / New
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition transform active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save & Update Static QR'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Permanent Static QR Code Generator & Network Config */}
            <div className="lg:col-span-5 space-y-5">
              {/* Network Host Settings Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Mobile QR Portal Target URL
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono">
                    Cloud Live
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Encoded into station QR codes so mobile devices can scan and load the data-filling interface without <code className="text-rose-400 font-mono text-[10px]">ERR_CONNECTION_REFUSED</code> errors.
                </p>

                {/* Host Preset Selectors */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setNetworkHost(PRODUCTION_HOST)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition border flex items-center gap-1.5 ${
                      effectiveHost === PRODUCTION_HOST
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span>Cloud Live ({PRODUCTION_HOST.replace('https://', '')})</span>
                  </button>

                  {detectedLocalIp && !detectedLocalIp.includes('127.0.0.1') && (
                    <button
                      type="button"
                      onClick={() => setNetworkHost(`http://${detectedLocalIp}:5000`)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition border flex items-center gap-1.5 ${
                        effectiveHost.includes(detectedLocalIp)
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <Wifi className="w-3 h-3 text-blue-400" />
                      <span>Local Wi-Fi ({detectedLocalIp})</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Host Address (Encoded into QR):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={networkHost}
                      onChange={(e) => setNetworkHost(e.target.value)}
                      placeholder={PRODUCTION_HOST}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setNetworkHost(resolveProductionHost())}
                      title="Reset to live production hosting URL"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Permanent QR Code Badge Display */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
                <div className="flex items-center justify-between w-full border-b border-slate-800 pb-3">
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Permanent Station Badge
                    </span>
                    <span className="font-extrabold text-white text-base">
                      {formData?.name || 'Machine'}
                    </span>
                  </div>

                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold">
                    {formData?.code || 'MCH'}
                  </span>
                </div>

                {/* Printed QR Frame */}
                <div className="p-5 bg-white rounded-2xl shadow-xl shadow-blue-900/10 border-4 border-slate-800">
                  <QRCodeSVG
                    value={staticQrUrl || 'http://localhost:5000'}
                    size={200}
                    level="H"
                    includeMargin={false}
                    aria-label={`QR Code for ${formData?.name || 'Machine'}`}
                  />
                </div>

                {/* Target URL Preview */}
                <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 break-all text-left space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold">
                    Encoded Scan Destination:
                  </span>
                  <a
                    href={staticQrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span className="truncate">{staticQrUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>

                {/* Quick Print & Floor Actions */}
                <div className="w-full grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPrintModalMachine({
                        ...formData,
                        assignedColours: assignedColoursList,
                        assignedSizes: assignedSizesList,
                      })
                    }
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-750 text-white font-semibold text-xs border border-slate-700 transition shadow-sm"
                  >
                    <Printer className="w-4 h-4 text-cyan-400" />
                    <span>Print Badge</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToWorker && onNavigateToWorker(formData?.code || formData?.id || 'MCH-01')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-emerald-600/20"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open Portal</span>
                  </button>
                </div>

                {/* Scope Summary Pill Box */}
                <div className="w-full p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-2 text-left">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Current Assigned Scope:
                  </span>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Sizes:</span>
                    <span className="font-mono font-bold text-white">
                      {Array.isArray(assignedSizesList) && assignedSizesList.length > 0 ? assignedSizesList.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Colours:</span>
                    <span className="font-semibold text-cyan-300 truncate max-w-[170px]">
                      {Array.isArray(assignedColoursList) && assignedColoursList.length > 0 ? assignedColoursList.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Daily Target:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatNumber(formData?.dailyTargetQty || 2500)} pcs/day
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fleet Overview of All Machines */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Plant Floor Machines Fleet (Static QR Active)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Live status, daily target quota adherence, and assigned operators
                </p>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {(machines || []).length} Active Stations
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(machines || []).filter(Boolean).map((m) => {
                const todayProduced = Number(m.todayProduced) || 0;
                const target = Number(m.dailyTargetQty) || 2500;
                const progress = target > 0 ? Math.round((todayProduced / target) * 100) : 0;
                const remaining = Math.max(0, target - todayProduced);

                return (
                  <div
                    key={m.id || m.code}
                    className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{m.name || 'Machine'}</span>
                          <span className="text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded">
                            {m.code || m.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {m.category || 'General'} Division • {m.shift || 'Shift A'}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {m.status || 'Active'}
                      </span>
                    </div>

                    {/* Operator */}
                    <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/60 p-2 rounded-xl">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{m.operatorName || 'Floor Worker'}</span>
                    </div>

                    {/* Daily Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">Today's Progress</span>
                        <span className="font-mono font-bold text-slate-200 text-[11px]">
                          {formatNumber(todayProduced)} / {formatNumber(target)} ({progress}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-slate-500 flex justify-between pt-0.5">
                        <span>Quota: {formatNumber(target)} pcs</span>
                        <span className={remaining === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                          {remaining === 0 ? 'Target Reached!' : `${formatNumber(remaining)} pcs left`}
                        </span>
                      </div>
                    </div>

                    {/* Scope Badges */}
                    <div className="pt-1 flex flex-wrap gap-1 text-[10px]">
                      {(m.assignedSizes || []).map((sz) => (
                        <span
                          key={sz}
                          className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono font-bold border border-slate-800"
                        >
                          Sz {sz}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMachineId(m.id || m.code);
                          populateForm(m);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        Edit Config &rarr;
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrintModalMachine(m)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                          title="Print Machine QR"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateToWorker && onNavigateToWorker(m.code || m.id)}
                          className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30"
                          title="Open Worker Floor Portal"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMachine(m)}
                          className="p-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 transition"
                          title="Delete Machine Station"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: WORKER TEAM & OPERATOR MANAGEMENT                  */}
      {/* ========================================================== */}
      {adminTab === 'workers' && (
        <div className="space-y-6">
          {/* Top Worker KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Registered Operators
              </span>
              <div className="text-2xl font-black text-white font-mono mt-1">
                {(workers || []).length}
              </div>
              <span className="text-[11px] text-slate-400">All shifts & categories</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Active on Plant Floor
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {(workers || []).filter((w) => w && w.status === 'Active').length}
              </div>
              <span className="text-[11px] text-emerald-400/80">Currently assigned</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Loop Category Operators
              </span>
              <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
                {(workers || []).filter((w) => w && w.category === 'Loop').length}
              </div>
              <span className="text-[11px] text-cyan-400/80">Loop division team</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Today's Worker Logged Output
              </span>
              <div className="text-2xl font-black text-blue-400 font-mono mt-1">
                {formatNumber((workers || []).reduce((acc, w) => acc + (w?.todayOutput || w?.todayProduced || 0), 0))}
              </div>
              <span className="text-[11px] text-slate-400">Pieces recorded today</span>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                    placeholder="Search by name, ID, machine..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={workerCategoryFilter}
                  onChange={(e) => setWorkerCategoryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="All">All Categories</option>
                  <option value="Loop">Loop</option>
                  <option value="Strap">Strap</option>
                  <option value="T-shirt">T-shirt</option>
                  <option value="Other">Other</option>
                </select>

                {/* Shift Filter */}
                <select
                  value={workerShiftFilter}
                  onChange={(e) => setWorkerShiftFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="All">All Shifts</option>
                  <option value="Shift A">Shift A</option>
                  <option value="Shift B">Shift B</option>
                  <option value="Shift C">Shift C</option>
                  <option value="Day Shift">Day Shift</option>
                  <option value="Night Shift">Night Shift</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleOpenAddWorker}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition transform active:scale-95 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Register New Worker</span>
              </button>
            </div>

            {/* Workers Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/90 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <th className="py-3 px-4">Operator / Employee</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Shift</th>
                    <th className="py-3 px-4">Assigned Machine</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Today Output</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredWorkers.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-850/50 transition">
                      {/* Name & Emp ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shadow-sm">
                            {w.name ? w.name[0] : 'W'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{w.name}</div>
                            <div className="font-mono text-[10px] text-slate-400">{w.empId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold text-[11px]">
                          {w.category}
                        </span>
                      </td>

                      {/* Shift */}
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">
                        {w.shift}
                      </td>

                      {/* Machine */}
                      <td className="py-3.5 px-4">
                        <span className="text-slate-300 font-medium">{w.assignedMachine || 'Floor Unassigned'}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            w.status === 'Active'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : w.status === 'On Leave'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              w.status === 'Active' ? 'bg-emerald-400' : w.status === 'On Leave' ? 'bg-amber-400' : 'bg-slate-400'
                            }`}
                          ></span>
                          <span>{w.status}</span>
                        </span>
                      </td>

                      {/* Today Output */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-xs">
                        {formatNumber(w.todayOutput || w.todayProduced || 0)} pcs
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditWorker(w)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Edit Worker Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWorker(w)}
                            className="p-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 transition"
                            title="Delete Worker"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredWorkers.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-slate-500">
                        No operators matching the selected filter or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: ADD / EDIT WORKER                                  */}
      {/* ========================================================== */}
      {workerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-extrabold text-white">
                  {editingWorker ? 'Edit Operator Details' : 'Register New Floor Operator'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWorkerModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorker} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                  placeholder="e.g. Priyantha Silva"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={workerForm.empId}
                    onChange={(e) => setWorkerForm({ ...workerForm, empId: e.target.value })}
                    placeholder="e.g. EMP-110"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Category Division
                  </label>
                  <select
                    value={workerForm.category}
                    onChange={(e) => setWorkerForm({ ...workerForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="Loop">Loop</option>
                    <option value="Strap">Strap</option>
                    <option value="T-shirt">T-shirt</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Work Shift
                  </label>
                  <select
                    value={workerForm.shift}
                    onChange={(e) => setWorkerForm({ ...workerForm, shift: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="Day Shift">Day Shift</option>
                    <option value="Night Shift">Night Shift</option>
                    <option value="Shift A">Shift A (Morning)</option>
                    <option value="Shift B">Shift B (Evening)</option>
                    <option value="Shift C">Shift C (Night)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Floor Status
                  </label>
                  <select
                    value={workerForm.status}
                    onChange={(e) => setWorkerForm({ ...workerForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Primary Assigned Machine
                </label>
                <select
                  value={workerForm.assignedMachine}
                  onChange={(e) => setWorkerForm({ ...workerForm, assignedMachine: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
                >
                  {(machines || []).filter(Boolean).map((m) => (
                    <option key={m.id || m.code} value={`${m.name || 'Machine'} (${m.code || m.id})`}>
                      {m.name || 'Machine'} ({m.code || m.id}) - {m.category || 'General'}
                    </option>
                  ))}
                  <option value="Floor Roving Operator">Floor Roving Operator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setWorkerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/30"
                >
                  {editingWorker ? 'Update Worker' : 'Register Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print QR Badge Modal */}
      {printModalMachine && (
        <MachineQrPrintModal
          machine={printModalMachine}
          networkHost={effectiveHost}
          onClose={() => setPrintModalMachine(null)}
        />
      )}
    </div>
  );
}
