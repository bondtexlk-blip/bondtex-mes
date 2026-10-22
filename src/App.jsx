import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MetricCards from './components/MetricCards';
import CategoryCards from './components/CategoryCards';
import PlanVsActualChart from './components/PlanVsActualChart';
import CategoryDetailModal from './components/CategoryDetailModal';
import OrderDrillDown from './components/OrderDrillDown';
import DailyBreakdownModal from './components/DailyBreakdownModal';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import NewOrderModal from './components/NewOrderModal';
import QuickLogModal from './components/QuickLogModal';
import BarcodeLabelModal from './components/BarcodeLabelModal';
import AdminPanel from './components/AdminPanel';
import WorkerPortal from './components/WorkerPortal';
import DailyProductionDashboard from './components/DailyProductionDashboard';
import HourlyProductionDashboard from './components/HourlyProductionDashboard';
import DeliveryReceivedDashboard from './components/DeliveryReceivedDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { api } from './api/client';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Layers,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Settings,
  Smartphone,
  QrCode,
  Calendar,
  Clock,
} from 'lucide-react';
import { formatNumber } from './utils/formatters';

export default function App() {
  // Theme State: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('bondtex_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('bondtex_theme', next);
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Navigation & View States: 'dashboard' | 'drilldown' | 'admin' | 'worker'
  // When users (management/boss) open the main base URL (e.g., https://bondtexlk-f16f5.web.app),
  // it must ALWAYS open the main full MES Dashboard / Home view.
  // The dedicated restricted Worker Portal is ONLY triggered via active QR scan (?view=worker).
  const [isRestrictedWorkerMode, setIsRestrictedWorkerMode] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        return params.get('view') === 'worker';
      }
      return false;
    } catch {
      return false;
    }
  });

  const [activeView, setActiveView] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam === 'worker') return 'worker';
        if (viewParam === 'daily-production' || viewParam === 'daily') return 'daily-production';
        if (viewParam === 'hourly-production' || viewParam === 'hourly') return 'hourly-production';
        if (viewParam === 'delivery-received' || viewParam === 'delivery') return 'delivery-received';
        if (viewParam === 'admin') return 'admin';
        if (viewParam === 'drilldown') return 'drilldown';
      }
      // Base URL ALWAYS defaults to main executive dashboard
      return 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [selectedCategoryModal, setSelectedCategoryModal] = useState(null);
  const [drilldownCategory, setDrilldownCategory] = useState('All');
  const [workerMachineId, setWorkerMachineId] = useState('MCH-01');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [currentShift, setCurrentShift] = useState('All');

  // Modals
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [selectedOrderForBreakdown, setSelectedOrderForBreakdown] = useState(null);
  const [selectedOrderForLog, setSelectedOrderForLog] = useState(null);
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState(null);

  // Data States
  const [overview, setOverview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [planVsActualData, setPlanVsActualData] = useState([]);
  const [metadata, setMetadata] = useState({ styles: [], sizes: [], colours: [], rmMaterials: [], poNumbers: [] });
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // URL Query Param Detection on load (e.g. ?view=worker&machine=MCH-01)
  useEffect(() => {
    try {
      if (!window.location.search) {
        // Base URL accessed without query parameters: always default to main executive dashboard
        setActiveView('dashboard');
        setIsRestrictedWorkerMode(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const machineParam = params.get('machine');

      if (viewParam === 'worker') {
        // Triggered exclusively by active station QR scan
        setActiveView('worker');
        setIsRestrictedWorkerMode(true);
        if (machineParam) setWorkerMachineId(machineParam);
      } else {
        setIsRestrictedWorkerMode(false);
        if (viewParam === 'daily-production' || viewParam === 'daily') {
          setActiveView('daily-production');
        } else if (viewParam === 'hourly-production' || viewParam === 'hourly') {
          setActiveView('hourly-production');
        } else if (viewParam === 'delivery-received' || viewParam === 'delivery') {
          setActiveView('delivery-received');
        } else if (viewParam === 'admin') {
          setActiveView('admin');
        } else if (viewParam === 'drilldown') {
          setActiveView('drilldown');
        } else {
          setActiveView('dashboard');
        }
      }
    } catch {
      setActiveView('dashboard');
      setIsRestrictedWorkerMode(false);
    }
  }, []);

  // Keyboard shortcut: Ctrl+B or Cmd+B toggles navigation sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial factory data & real-time sync
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, categoriesRes, chartRes, metaRes] = await Promise.all([
        api.getOverview(),
        api.getCategories(),
        api.getPlanVsActual('All'),
        api.getMetadata(),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (categoriesRes.success) setCategories(categoriesRes.data);
      if (chartRes.success) setPlanVsActualData(chartRes.data);
      if (metaRes.success) setMetadata(metaRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showToast('Error connecting to backend API', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // When a category card or sidebar category is clicked (e.g. Loop)
  const handleSelectCategory = async (catId) => {
    try {
      const res = await api.getCategoryDetails(catId);
      if (res.success) {
        setSelectedCategoryModal(res.data);
      }
    } catch (err) {
      console.error('Error fetching category details:', err);
      const found = categories.find((c) => c.id.toLowerCase() === catId.toLowerCase());
      if (found) setSelectedCategoryModal(found);
    }
  };

  // Navigate to Drill-Down with category pre-filtered
  const handleNavigateToDrillDown = (category = 'All') => {
    setDrilldownCategory(category);
    setActiveView('drilldown');
  };

  // Navigate directly to worker interface for a specific machine from inside management dashboard
  const handleNavigateToWorker = (machineId) => {
    setWorkerMachineId(machineId || 'MCH-01');
    setIsRestrictedWorkerMode(false); // Dashboard navigation is manager preview mode (Navbar & Sidebar remain accessible)
    setActiveView('worker');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset database to seed
  const handleResetData = async () => {
    if (window.confirm('Reset production tracking data to initial Bondtex seed records?')) {
      try {
        await api.resetDb();
        await loadDashboardData();
        showToast('Database reset to fresh Bondtex seed data successfully!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // Dedicated Fullscreen Worker Portal Interface (Restricted Floor Mode ONLY when actively scanned via QR code)
  if (isRestrictedWorkerMode && activeView === 'worker') {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#070b14] text-slate-100 flex flex-col overflow-y-auto z-50 selection:bg-blue-600 selection:text-white">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div
              className={`px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 ${
                notification.type === 'error'
                  ? 'bg-rose-950/90 text-rose-300 border-rose-500/50'
                  : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        <ErrorBoundary
          onReset={() => {
            setIsRestrictedWorkerMode(false);
            setActiveView('dashboard');
            try {
              window.history.replaceState({}, '', window.location.pathname);
            } catch {}
          }}
        >
          <WorkerPortal
            initialMachineId={workerMachineId}
            isRestrictedMode={true}
            onBackToDashboard={() => {
              setIsRestrictedWorkerMode(false);
              setActiveView('dashboard');
              try {
                window.history.replaceState({}, '', window.location.pathname);
              } catch {}
            }}
            onUnlockDashboard={() => {
              setIsRestrictedWorkerMode(false);
              setActiveView('dashboard');
              try {
                window.history.replaceState({}, '', window.location.pathname);
              } catch {}
            }}
            onShowToast={showToast}
            onDataUpdated={loadDashboardData}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 ${
              notification.type === 'error'
                ? 'bg-rose-950/90 text-rose-300 border-rose-500/50'
                : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenNewOrder={() => setNewOrderModalOpen(true)}
        onOpenBarcodeScanner={() => setBarcodeScannerOpen(true)}
        onResetData={handleResetData}
        currentShift={currentShift}
        setCurrentShift={setCurrentShift}
        theme={theme}
        onToggleTheme={toggleTheme}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      {/* Main Layout (Sidebar + Content Area) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          selectedCategory={selectedCategoryModal?.id}
          onSelectCategory={handleSelectCategory}
          categories={categories}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
        />

        {/* Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
          <ErrorBoundary onReset={() => setActiveView('dashboard')}>
            {activeView === 'dashboard' ? (
              /* 1. MAIN EXECUTIVE DASHBOARD PAGE */
              <div className="space-y-6 animate-fade-in">
                {/* Executive Welcome & Live Status Strip */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
                  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span>Bondtex Manufacturing Execution System (MES)</span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        Factory Production Tracking Dashboard
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                        Real-time visibility across plant lines, actual manufacturing output, delivery balances, and worker floor entries for Loop, Strap, T-shirt, and Other garment units.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => setActiveView('daily-production')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/30 active:scale-95"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Daily Production (Loop)</span>
                      </button>

                      <button
                        onClick={() => setActiveView('hourly-production')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition shadow-lg shadow-amber-600/30 active:scale-95"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Hourly Production</span>
                      </button>

                      <button
                        onClick={() => handleNavigateToDrillDown('All')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/30 active:scale-95"
                      >
                        <Search className="w-4 h-4" />
                        <span>Orders Drill-Down</span>
                      </button>

                      <button
                        onClick={() => setActiveView('admin')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700/80 font-semibold text-xs transition"
                      >
                        <Settings className="w-4 h-4 text-amber-400" />
                        <span>Admin QR Setup</span>
                      </button>

                      <button
                        onClick={() => setActiveView('worker')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition"
                      >
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>Worker Floor App</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Top Factory Key Metric Cards */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Total Factory Key Metrics
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
                      Updated live from MES floor entries
                    </span>
                  </div>

                  <MetricCards
                    orderQty={overview?.totalOrderQty || 0}
                    productionQty={overview?.totalProductionQty || 0}
                    deliveryQty={overview?.totalDeliveryQty || 0}
                    balanceQty={overview?.totalBalanceQty || 0}
                    deliveryBalanceQty={overview?.totalDeliveryBalance || 0}
                    onMetricClick={() => handleNavigateToDrillDown('All')}
                  />
                </div>

                {/* 4 Main Production Categories: Loop, Strap, T-shirt, and Other */}
                <CategoryCards
                  categories={categories}
                  onSelectCategory={handleSelectCategory}
                />

                {/* Dynamic Plan vs Actual Tracking Chart */}
                <PlanVsActualChart
                  data={planVsActualData}
                  title="Consolidated Daily Plan vs Actual Output"
                  subtitle="Daily target plans compared against actual production volume across all production lines"
                  categoryName="All Categories"
                />
              </div>
            ) : activeView === 'daily-production' ? (
              /* 2. DEDICATED DAILY PRODUCTION DASHBOARD (LOOP FOCUS) */
              <DailyProductionDashboard
                onNavigateToWorker={handleNavigateToWorker}
                onShowToast={showToast}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : activeView === 'hourly-production' ? (
              /* 2B. DEDICATED HOURLY PRODUCTION DASHBOARD (MACHINE BREAKDOWNS, TARGET VS ACTUAL, MULTIPLIERS) */
              <HourlyProductionDashboard
                onNavigateToWorker={handleNavigateToWorker}
                onShowToast={showToast}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : activeView === 'delivery-received' ? (
              /* 2C. DEDICATED DELIVERY & RECEIVED DASHBOARD (FIXED QR SCANNER & MULTI-STEP WORKFLOW) */
              <DeliveryReceivedDashboard
                onShowToast={showToast}
                onNavigateToView={(v) => setActiveView(v)}
                theme={theme}
              />
            ) : activeView === 'drilldown' ? (
              /* 3. DETAILED DRILL-DOWN & SEARCH PAGE */
              <OrderDrillDown
                initialCategory={drilldownCategory}
                onBackToDashboard={() => setActiveView('dashboard')}
                onViewDailyTracking={(order) => setSelectedOrderForBreakdown(order)}
                onLogProduction={(order) => setSelectedOrderForLog(order)}
                onPrintBarcode={(order) => setSelectedOrderForLabel(order)}
                onOpenBarcodeScanner={() => setBarcodeScannerOpen(true)}
                metadata={metadata}
              />
            ) : activeView === 'admin' ? (
              /* 4. ADMIN PANEL & STATIC QR GENERATION */
              <AdminPanel
                metadata={metadata}
                onNavigateToWorker={handleNavigateToWorker}
                onShowToast={showToast}
                onDataUpdated={loadDashboardData}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : (
              /* 5. WORKER / OPERATOR INTERFACE (PREVIEW IN DASHBOARD) */
              <WorkerPortal
                initialMachineId={workerMachineId}
                isRestrictedMode={false}
                onBackToDashboard={() => {
                  setActiveView('dashboard');
                  try {
                    window.history.replaceState({}, '', window.location.pathname);
                  } catch {}
                }}
                onShowToast={showToast}
                onDataUpdated={loadDashboardData}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* --- MODAL DIALOGS --- */}

      {/* 1. Category Detailed View Modal (Loop, Strap, T-shirt, Other) */}
      {selectedCategoryModal && (
        <CategoryDetailModal
          category={selectedCategoryModal}
          onClose={() => setSelectedCategoryModal(null)}
          onNavigateToDrillDown={handleNavigateToDrillDown}
        />
      )}

      {/* 2. Day-by-Day Plan vs Actual Breakdown Modal */}
      {selectedOrderForBreakdown && (
        <DailyBreakdownModal
          order={selectedOrderForBreakdown}
          onClose={() => setSelectedOrderForBreakdown(null)}
          onLogOutput={(order) => {
            setSelectedOrderForBreakdown(null);
            setSelectedOrderForLog(order);
          }}
        />
      )}

      {/* 3. Barcode Scanner Modal */}
      {barcodeScannerOpen && (
        <BarcodeScannerModal
          onClose={() => setBarcodeScannerOpen(false)}
          onOrderMatched={(order) => {
            setSelectedOrderForBreakdown(order);
          }}
        />
      )}

      {/* 4. New Production Order Modal */}
      {newOrderModalOpen && (
        <NewOrderModal
          metadata={metadata}
          onClose={() => setNewOrderModalOpen(false)}
          onSuccess={(newOrder) => {
            showToast(`Order ${newOrder.poNumber} created successfully!`);
            loadDashboardData();
          }}
        />
      )}

      {/* 5. Quick Log Output Modal */}
      {selectedOrderForLog && (
        <QuickLogModal
          order={selectedOrderForLog}
          onClose={() => setSelectedOrderForLog(null)}
          onSuccess={(updatedOrder) => {
            showToast(`Logged production for ${updatedOrder.poNumber}!`);
            loadDashboardData();
          }}
        />
      )}

      {/* 6. Printable Barcode Label Modal */}
      {selectedOrderForLabel && (
        <BarcodeLabelModal
          order={selectedOrderForLabel}
          onClose={() => setSelectedOrderForLabel(null)}
        />
      )}
    </div>
  );
}
