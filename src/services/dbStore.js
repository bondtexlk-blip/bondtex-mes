// Client-side Reactive Production Database Engine for Bondtex MES
// Provides instant offline/browser storage and real-time synchronization with Firebase Firestore.
import {
  initialCategories,
  rawProductionRows,
  initialMachines,
  initialWorkers,
  initialOrders,
  initialProductionLogs,
  initialDeliveryReceivedLogs,
  initialInventoryItems,
  initialMaterialRequests,
  initialInventoryLogs,
} from '../data/seedData.js';
import { firestoreSync, firebaseRealtime } from '../firebase.js';

const STORAGE_KEY = 'bondtex_loop_real_v9';
const VAULT_KEY = 'bondtex_permanent_vault_backup';
const WORKSPACES_STORAGE_KEY = 'bondtex_workspaces_archive_v1';
const ACTIVE_WORKSPACE_KEY = 'bondtex_active_workspace_v1';
const OLD_STORAGE_KEYS = ['bondtex_loop_real_v9', 'bondtex_loop_real_v8', 'bondtex_loop_real_v7'];

export const DEFAULT_WORKSPACE = {
  id: 'ws_baseline_2026',
  buyerName: 'Bondtex Primary (MAS / Brandix)',
  name: 'Factory Baseline Order (22-Oct Ground Truth)',
  notes: 'Master factory ground truth dataset initialized with baseline orders and tracking history.',
  createdAt: '2026-10-22T08:00:00.000Z',
  status: 'Active',
};

class ClientDatabaseStore {
  constructor() {
    this.categories = JSON.parse(JSON.stringify(initialCategories));
    this.orders = JSON.parse(JSON.stringify(initialOrders));
    this.machines = JSON.parse(JSON.stringify(initialMachines));
    this.workers = JSON.parse(JSON.stringify(initialWorkers));
    this.productionLogs = JSON.parse(JSON.stringify(initialProductionLogs));
    this.deliveryReceivedLogs = JSON.parse(JSON.stringify(initialDeliveryReceivedLogs));
    this.outsourceConsignments = [];
    this.productionPlans = [];
    this.inventoryItems = JSON.parse(JSON.stringify(initialInventoryItems));
    this.materialRequests = JSON.parse(JSON.stringify(initialMaterialRequests));
    this.inventoryLogs = JSON.parse(JSON.stringify(initialInventoryLogs));
    this.activeWorkspace = { ...DEFAULT_WORKSPACE };
    this.workspaces = [];
    this.subscribers = [];
    this.lastSaved = null;
    this.lastAppliedCloudTimestamp = null;
    this.isIntentionalReset = false;
    this._notifyTimeout = null;
    this.deviceId = 'srv';
    this.initialized = false;

    // Load cached database instantly from LocalStorage on construction (0ms delay)
    this.loadSynchronousLocalCache();

    this.ensureSpecialMachines();
    this.ensureOrderCalculations();

    this.readyPromise = this.init();
  }

  loadSynchronousLocalCache() {
    try {
      this.deviceId =
        typeof window !== 'undefined'
          ? localStorage.getItem('bondtex_dev_id') ||
            (() => {
              const id = 'DEV-' + Math.random().toString(36).slice(2, 9) + '-' + Date.now();
              try {
                localStorage.setItem('bondtex_dev_id', id);
              } catch {}
              return id;
            })()
          : 'srv';

      let parsed = null;
      if (typeof window !== 'undefined') {
        const rawPrimary = localStorage.getItem(STORAGE_KEY);
        if (rawPrimary) {
          try { parsed = JSON.parse(rawPrimary); } catch {}
        }
        if (!parsed) {
          const rawVault = localStorage.getItem(VAULT_KEY);
          if (rawVault) {
            try { parsed = JSON.parse(rawVault); } catch {}
          }
        }
      }

      if (parsed && Array.isArray(parsed.orders)) {
        this.categories = Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : this.categories;
        this.orders = parsed.orders;
        this.machines = (Array.isArray(parsed.machines) ? parsed.machines : this.machines)
          .filter((m) => m.id !== 'MCH-CMP' && m.code !== 'MCH-CMP' && !((m.name || '').toLowerCase().includes('compress')));
        this.workers = Array.isArray(parsed.workers) ? parsed.workers : this.workers;
        this.productionLogs = Array.isArray(parsed.productionLogs) ? parsed.productionLogs : [];
        this.deliveryReceivedLogs = Array.isArray(parsed.deliveryReceivedLogs) ? parsed.deliveryReceivedLogs : [];
        this.outsourceConsignments = Array.isArray(parsed.outsourceConsignments) ? parsed.outsourceConsignments : [];
        this.productionPlans = Array.isArray(parsed.productionPlans) ? parsed.productionPlans : [];
        this.inventoryItems = Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems : this.inventoryItems;
        this.materialRequests = Array.isArray(parsed.materialRequests) ? parsed.materialRequests : [];
        this.inventoryLogs = Array.isArray(parsed.inventoryLogs) ? parsed.inventoryLogs : [];
        this.lastSaved = parsed.lastSaved || null;

        if (parsed.activeWorkspace && parsed.activeWorkspace.id) {
          this.activeWorkspace = parsed.activeWorkspace;
        } else if (typeof window !== 'undefined') {
          const rawActive = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
          if (rawActive) {
            try { this.activeWorkspace = JSON.parse(rawActive); } catch {}
          }
        }

        if (Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0) {
          this.workspaces = parsed.workspaces;
        }
      }
    } catch (err) {
      console.warn('Local cache sync warning:', err);
    }
  }

  // Subscribe to live database updates from any device (laptop, phone, tablet)
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.subscribers.push(listener);
      return () => {
        this.subscribers = this.subscribers.filter((l) => l !== listener);
      };
    }
    return () => {};
  }

  // Sanitize workspace list for state serialization (strips heavy nested orders arrays from archive summaries)
  getCleanWorkspacesList() {
    return (this.workspaces || []).map((w) => {
      const { orders, productionLogs, deliveryReceivedLogs, outsourceConsignments, productionPlans, ...meta } = w;
      return meta;
    });
  }

  // Debounced notification to eliminate high-frequency React re-renders and CPU lockups
  notifySubscribers() {
    if (this._notifyTimeout) clearTimeout(this._notifyTimeout);
    this._notifyTimeout = setTimeout(() => {
      this.subscribers.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          console.error('Subscriber callback notification error:', err);
        }
      });
    }, 50);
  }

  // Apply real-time cloud state pushed from Firebase Realtime Database
  applyCloudState(cloudState) {
    if (!cloudState) return;
    if (cloudState.lastDeviceId && cloudState.lastDeviceId === this.deviceId) return;

    // Strict timestamp comparison: only apply if cloud is ACTUALLY NEWER than local
    if (cloudState.lastUpdated && this.lastSaved) {
      const cloudTime = new Date(cloudState.lastUpdated).getTime();
      const localTime = new Date(this.lastSaved).getTime();
      if (!isNaN(cloudTime) && !isNaN(localTime) && cloudTime <= localTime) {
        return;
      }
    }

    // Guard against re-applying the exact same cloud snapshot repeatedly
    if (cloudState.lastUpdated && cloudState.lastUpdated === this.lastAppliedCloudTimestamp) {
      return;
    }

    const cloudWsId = cloudState.activeWorkspace?.id || cloudState.activeWorkspaceId;
    const localWsId = this.activeWorkspace?.id;

    // ANTI-REVERT WORKSPACE CREATION GUARD:
    // If the local active workspace was created AFTER this cloudState was updated,
    // this incoming cloudState is obsolete (from a previous workspace) and MUST NOT revert our workspace!
    if (this.activeWorkspace?.createdAt && cloudState.lastUpdated) {
      const cloudUpdateTime = new Date(cloudState.lastUpdated).getTime();
      const localWsCreatedTime = new Date(this.activeWorkspace.createdAt).getTime();
      if (!isNaN(cloudUpdateTime) && !isNaN(localWsCreatedTime) && cloudWsId !== localWsId) {
        if (cloudUpdateTime <= localWsCreatedTime) {
          console.warn(`[Sync Guard] Ignoring stale cloud state from previous workspace (cloud: ${cloudWsId}, local: ${localWsId}). Auto-healing cloud ground truth.`);
          this.forceSaveToCloud();
          return;
        }
      }
    }

    // INTENTIONAL RESET ANTI-DOWNGRADE GUARD:
    // When the user intentionally created a new zeroed workspace, do not allow incoming cloud state
    // from a different or older workspace to overwrite the zeroed counts!
    if (this.isIntentionalReset && cloudWsId !== localWsId) {
      console.warn(`[Sync Guard] Bypassing cloud overwrite: intentional workspace reset is active for ${localWsId}. Re-asserting ground truth.`);
      this.forceSaveToCloud();
      return;
    }

    this.lastAppliedCloudTimestamp = cloudState.lastUpdated;

    // 1. GLOBAL WORKSPACE SWITCH DETECTION:
    // If the cloud state has an activeWorkspaceId different from local, this is an intentional
    // global workspace switch or new order activation performed by the Admin.
    const isDifferentWorkspace = Boolean(cloudWsId && localWsId && cloudWsId !== localWsId);

    if (isDifferentWorkspace) {
      console.log(`[Cloud Sync] Global Workspace switch detected: ${localWsId} -> ${cloudWsId} (${cloudState.activeWorkspace?.buyerName || ''})`);
      this.activeWorkspace = cloudState.activeWorkspace || {
        id: cloudWsId,
        buyerName: cloudState.buyerName || 'Active Order',
        status: 'Active',
      };
      if (Array.isArray(cloudState.workspaces)) {
        this.workspaces = cloudState.workspaces;
      }
      this.orders = Array.isArray(cloudState.orders) ? cloudState.orders : [];
      this.productionLogs = Array.isArray(cloudState.productionLogs) ? cloudState.productionLogs : [];
      this.deliveryReceivedLogs = Array.isArray(cloudState.deliveryReceivedLogs) ? cloudState.deliveryReceivedLogs : [];
      this.outsourceConsignments = Array.isArray(cloudState.outsourceConsignments) ? cloudState.outsourceConsignments : [];
      this.productionPlans = Array.isArray(cloudState.productionPlans) ? cloudState.productionPlans : [];
      if (Array.isArray(cloudState.inventoryItems)) this.inventoryItems = cloudState.inventoryItems;
      if (Array.isArray(cloudState.materialRequests)) this.materialRequests = cloudState.materialRequests;
      if (Array.isArray(cloudState.inventoryLogs)) this.inventoryLogs = cloudState.inventoryLogs;
      if (Array.isArray(cloudState.categories) && cloudState.categories.length) this.categories = cloudState.categories;
      if (Array.isArray(cloudState.machines)) this.machines = cloudState.machines;
      if (Array.isArray(cloudState.workers)) this.workers = cloudState.workers;

      this.ensureSpecialMachines();
      this.ensureOrderCalculations();
      this.lastSaved = cloudState.lastUpdated || new Date().toISOString();

      if (typeof window !== 'undefined') {
        try {
          const payloadStr = JSON.stringify({
            activeWorkspace: this.activeWorkspace,
            activeWorkspaceId: this.activeWorkspace?.id,
            workspaces: this.workspaces,
            categories: this.categories,
            orders: this.orders,
            machines: this.machines,
            workers: this.workers,
            productionLogs: this.productionLogs,
            deliveryReceivedLogs: this.deliveryReceivedLogs,
            outsourceConsignments: this.outsourceConsignments || [],
            productionPlans: this.productionPlans || [],
            inventoryItems: this.inventoryItems || [],
            materialRequests: this.materialRequests || [],
            inventoryLogs: this.inventoryLogs || [],
            lastSaved: this.lastSaved,
          });
          localStorage.setItem(STORAGE_KEY, payloadStr);
          localStorage.setItem(VAULT_KEY, payloadStr);
          localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(this.workspaces));
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(this.activeWorkspace));
        } catch {}
      }

      this.notifySubscribers();
      return;
    }

    // Inside the SAME workspace:
    if (cloudState.activeWorkspace) {
      this.activeWorkspace = cloudState.activeWorkspace;
    }
    if (Array.isArray(cloudState.workspaces)) {
      this.workspaces = cloudState.workspaces;
    }
    if (Array.isArray(cloudState.orders)) {
      this.orders = cloudState.orders;
    }
    if (Array.isArray(cloudState.categories) && cloudState.categories.length) {
      this.categories = cloudState.categories;
    }
    if (Array.isArray(cloudState.machines)) {
      this.machines = cloudState.machines.filter(
        (m) => m.id !== 'MCH-CMP' && m.code !== 'MCH-CMP' && !((m.name || '').toLowerCase().includes('compress'))
      );
    }
    if (Array.isArray(cloudState.workers)) {
      this.workers = cloudState.workers;
    }
    if (Array.isArray(cloudState.productionLogs)) {
      this.productionLogs = cloudState.productionLogs;
    }
    if (Array.isArray(cloudState.deliveryReceivedLogs)) {
      this.deliveryReceivedLogs = cloudState.deliveryReceivedLogs;
    }
    if (Array.isArray(cloudState.outsourceConsignments)) {
      this.outsourceConsignments = cloudState.outsourceConsignments;
    }
    if (Array.isArray(cloudState.productionPlans)) {
      this.productionPlans = cloudState.productionPlans;
    }
    if (Array.isArray(cloudState.inventoryItems)) {
      this.inventoryItems = cloudState.inventoryItems;
    }
    if (Array.isArray(cloudState.materialRequests)) {
      this.materialRequests = cloudState.materialRequests;
    }
    if (Array.isArray(cloudState.inventoryLogs)) {
      this.inventoryLogs = cloudState.inventoryLogs;
    }

    this.ensureSpecialMachines();
    this.ensureOrderCalculations();
    this.lastSaved = cloudState.lastUpdated || new Date().toISOString();

    if (typeof window !== 'undefined') {
      try {
        const payloadStr = JSON.stringify({
          activeWorkspace: this.activeWorkspace,
          activeWorkspaceId: this.activeWorkspace?.id,
          workspaces: this.workspaces || [],
          categories: this.categories,
          orders: this.orders,
          machines: this.machines,
          workers: this.workers,
          productionLogs: this.productionLogs,
          deliveryReceivedLogs: this.deliveryReceivedLogs,
          outsourceConsignments: this.outsourceConsignments || [],
          productionPlans: this.productionPlans || [],
          inventoryItems: this.inventoryItems || [],
          materialRequests: this.materialRequests || [],
          inventoryLogs: this.inventoryLogs || [],
          lastSaved: this.lastSaved,
        });
        localStorage.setItem(STORAGE_KEY, payloadStr);
        localStorage.setItem(VAULT_KEY, payloadStr);
        localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(this.workspaces || []));
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(this.activeWorkspace));
      } catch {
        // ignore storage quota errors
      }
    }

    this.notifySubscribers();
  }

  async init() {
    this.subscribers = [];

    // Background cloud hydration with 3.5s timeout (never blocks instant UI rendering)
    if (typeof fetch !== 'undefined') {
      try {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 3500));
        const syncPromise = Promise.allSettled([
          firebaseRealtime.getActiveWorkspacePointer(),
          firebaseRealtime.pullState(),
          firebaseRealtime.pullInventory(),
        ]);

        const raceResult = await Promise.race([syncPromise, timeoutPromise]);
        if (raceResult !== 'timeout' && Array.isArray(raceResult)) {
          const [ptrRes, stateRes, invRes] = raceResult;
          const cloudActivePointer = ptrRes.status === 'fulfilled' ? ptrRes.value : null;
          const cloudState = stateRes.status === 'fulfilled' ? stateRes.value : null;
          const cloudInventory = invRes.status === 'fulfilled' ? invRes.value : null;

          // 1. Strict Inventory Hydration from Cloud Ground Truth
          if (cloudInventory && Array.isArray(cloudInventory.inventoryItems)) {
            this.inventoryItems = cloudInventory.inventoryItems;
            if (Array.isArray(cloudInventory.materialRequests)) this.materialRequests = cloudInventory.materialRequests;
            if (Array.isArray(cloudInventory.inventoryLogs)) this.inventoryLogs = cloudInventory.inventoryLogs;
          } else if (cloudState && Array.isArray(cloudState.inventoryItems)) {
            this.inventoryItems = cloudState.inventoryItems;
            if (Array.isArray(cloudState.materialRequests)) this.materialRequests = cloudState.materialRequests;
            if (Array.isArray(cloudState.inventoryLogs)) this.inventoryLogs = cloudState.inventoryLogs;
          }

          // 2. Strict Workspaces List Hydration from Cloud
          if (cloudState && Array.isArray(cloudState.workspaces) && cloudState.workspaces.length > 0) {
            this.workspaces = cloudState.workspaces;
          }

          // 3. Strict Active Workspace Hydration from Cloud Active Pointer
          const targetActiveId = cloudActivePointer?.id || cloudState?.activeWorkspaceId || cloudState?.activeWorkspace?.id;

          if (targetActiveId) {
            if (cloudState && !cloudState.activeWorkspaceId && cloudActivePointer?.id === targetActiveId) {
              cloudState.activeWorkspaceId = targetActiveId;
              cloudState.activeWorkspace = cloudActivePointer;
            }
            if (cloudState && (cloudState.activeWorkspaceId === targetActiveId || cloudState.activeWorkspace?.id === targetActiveId)) {
              this.activeWorkspace = cloudState.activeWorkspace || cloudActivePointer || {
                id: targetActiveId,
                buyerName: cloudState.buyerName || 'Active Order',
                status: 'Active',
              };
              this.orders = Array.isArray(cloudState.orders) ? cloudState.orders : [];
              this.productionLogs = Array.isArray(cloudState.productionLogs) ? cloudState.productionLogs : [];
              this.deliveryReceivedLogs = Array.isArray(cloudState.deliveryReceivedLogs) ? cloudState.deliveryReceivedLogs : [];
              this.outsourceConsignments = Array.isArray(cloudState.outsourceConsignments) ? cloudState.outsourceConsignments : [];
              this.productionPlans = Array.isArray(cloudState.productionPlans) ? cloudState.productionPlans : [];
              if (Array.isArray(cloudState.categories) && cloudState.categories.length) this.categories = cloudState.categories;
              if (Array.isArray(cloudState.machines)) this.machines = cloudState.machines;
              if (Array.isArray(cloudState.workers)) this.workers = cloudState.workers;
            } else {
              let targetWs = (this.workspaces || []).find((w) => w.id === targetActiveId);
              if (!targetWs) {
                targetWs = await firebaseRealtime.getWorkspaceArchive(targetActiveId);
              }
              if (targetWs) {
                this.activeWorkspace = {
                  id: targetWs.id,
                  buyerName: targetWs.buyerName || 'Active Order',
                  name: targetWs.name || `Order - ${targetWs.buyerName || targetWs.id}`,
                  notes: targetWs.notes || '',
                  status: 'Active',
                  createdAt: targetWs.createdAt || new Date().toISOString(),
                };
                this.orders = Array.isArray(targetWs.orders) ? targetWs.orders : [];
                this.productionLogs = Array.isArray(targetWs.productionLogs) ? targetWs.productionLogs : [];
                this.deliveryReceivedLogs = Array.isArray(targetWs.deliveryReceivedLogs) ? targetWs.deliveryReceivedLogs : [];
                this.outsourceConsignments = Array.isArray(targetWs.outsourceConsignments) ? targetWs.outsourceConsignments : [];
                this.productionPlans = Array.isArray(targetWs.productionPlans) ? targetWs.productionPlans : [];
              } else if (cloudState) {
                this.applyCloudState(cloudState);
              }
            }
          } else if (cloudState) {
            this.applyCloudState(cloudState);
          }

          if (this.activeWorkspace && this.activeWorkspace.id) {
            const actIdx = (this.workspaces || []).findIndex((w) => w.id === this.activeWorkspace.id);
            const actObj = {
              ...this.activeWorkspace,
              status: 'Active',
            };
            if (actIdx >= 0) {
              this.workspaces[actIdx] = { ...this.workspaces[actIdx], ...actObj };
            } else {
              this.workspaces.unshift(actObj);
            }
          }

          this.ensureSpecialMachines();
          this.ensureOrderCalculations();

          if (cloudState && cloudState.lastUpdated) {
            this.lastSaved = cloudState.lastUpdated;
            this.lastAppliedCloudTimestamp = cloudState.lastUpdated;
          }

          this.notifySubscribers();
        }
      } catch (err) {
        console.warn('Initial background cloud sync error:', err);
      }

      // Connect SSE Listener (real-time stream without polling flooding)
      this.unsubscribeCloud = firebaseRealtime.listenToChanges((cloudState) => {
        if (cloudState && cloudState.lastDeviceId !== this.deviceId) {
          this.applyCloudState(cloudState);
        }
      });
    }

    this.initialized = true;
    return true;
  }

  async pullCloudState() {
    if (typeof window === 'undefined') return null;
    try {
      const [cloudActivePointer, cloudState, cloudInventory] = await Promise.all([
        firebaseRealtime.getActiveWorkspacePointer(),
        firebaseRealtime.pullState(),
        firebaseRealtime.pullInventory(),
      ]);

      if (cloudInventory && Array.isArray(cloudInventory.inventoryItems) && cloudInventory.inventoryItems.length > 0) {
        this.inventoryItems = cloudInventory.inventoryItems;
        if (Array.isArray(cloudInventory.materialRequests)) this.materialRequests = cloudInventory.materialRequests;
        if (Array.isArray(cloudInventory.inventoryLogs)) this.inventoryLogs = cloudInventory.inventoryLogs;
      }

      if (cloudState) {
        if (!Array.isArray(cloudState.inventoryItems) || cloudState.inventoryItems.length === 0) {
          cloudState.inventoryItems = this.inventoryItems;
          cloudState.materialRequests = this.materialRequests;
          cloudState.inventoryLogs = this.inventoryLogs;
        }
      }

      const targetActiveId = cloudActivePointer?.id || cloudState?.activeWorkspaceId || cloudState?.activeWorkspace?.id;
      if (targetActiveId && targetActiveId !== this.activeWorkspace?.id) {
        if (cloudState && (cloudState.activeWorkspaceId === targetActiveId || cloudState.activeWorkspace?.id === targetActiveId)) {
          this.applyCloudState(cloudState);
        } else {
          let targetWs = this.workspaces.find((w) => w.id === targetActiveId);
          if (!targetWs) {
            targetWs = await firebaseRealtime.getWorkspaceArchive(targetActiveId);
          }
          if (targetWs) {
            this.switchOrderWorkspace(targetActiveId);
          } else if (cloudState) {
            this.applyCloudState(cloudState);
          }
        }
      } else if (cloudState) {
        this.applyCloudState(cloudState);
      }
      return { success: true, activeWorkspace: this.activeWorkspace };
    } catch (e) {
      console.warn('pullCloudState note:', e);
      return { success: false, error: e?.message };
    }
  }

  ensureOrderCalculations() {
    this.orders.forEach((o) => {
      o.orderQty = Number(o.orderQty) || 0;
      o.deliveryQty = Number(o.deliveryQty) || 0;
      o.productionQty = Number(o.productionQty) || o.deliveryQty;
      if (o.floorProductionQty === undefined || o.floorProductionQty === null) {
        o.floorProductionQty = o.productionQty;
      } else {
        o.floorProductionQty = Number(o.floorProductionQty) || 0;
      }
      // Balance allows negative values when actual/delivery exceeds order plan
      o.balanceQty = o.orderQty - o.deliveryQty;
      o.deliveryBalanceQty = o.balanceQty;
      if (o.orderQty > 0 && o.balanceQty <= 0) {
        o.status = 'Completed';
      } else if (o.deliveryQty >= o.orderQty * 0.9 && o.orderQty > 0) {
        o.status = 'Ahead';
      } else if (o.deliveryQty === 0) {
        o.status = 'Scheduled';
      } else {
        o.status = 'Behind Plan';
      }
    });
  }

  async save(broadcastToCloud = true) {
    try {
      this.ensureOrderCalculations();
      const nowIso = new Date().toISOString();
      this.lastSaved = nowIso;

      if (!this.activeWorkspace || !this.activeWorkspace.id) {
        this.activeWorkspace = { ...DEFAULT_WORKSPACE };
      }

      const payload = {
        activeWorkspace: this.activeWorkspace,
        activeWorkspaceId: this.activeWorkspace.id,
        workspaces: this.getCleanWorkspacesList(),
        categories: this.categories,
        orders: this.orders,
        machines: this.machines,
        workers: this.workers,
        productionLogs: this.productionLogs,
        deliveryReceivedLogs: this.deliveryReceivedLogs,
        outsourceConsignments: this.outsourceConsignments || [],
        productionPlans: this.productionPlans || [],
        inventoryItems: this.inventoryItems || [],
        materialRequests: this.materialRequests || [],
        inventoryLogs: this.inventoryLogs || [],
        lastSaved: nowIso,
        lastUpdated: nowIso,
        lastDeviceId: this.deviceId,
      };

      if (typeof window !== 'undefined') {
        try {
          const payloadStr = JSON.stringify(payload);
          localStorage.setItem(STORAGE_KEY, payloadStr);
          localStorage.setItem(VAULT_KEY, payloadStr);
          localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(this.workspaces || []));
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(this.activeWorkspace));
        } catch {
          // ignore quota
        }
      }

      // Automatically broadcast state to Firebase Realtime Database and AWAIT confirmation
      if (broadcastToCloud && typeof fetch !== 'undefined') {
        const promises = [
          firebaseRealtime.setActiveWorkspacePointer(this.activeWorkspace),
          firebaseRealtime.pushState(payload),
          firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs),
          firebaseRealtime.saveWorkspaceArchive({
            ...this.activeWorkspace,
            orders: this.orders,
            productionLogs: this.productionLogs,
            deliveryReceivedLogs: this.deliveryReceivedLogs,
            outsourceConsignments: this.outsourceConsignments || [],
            productionPlans: this.productionPlans || [],
          }),
        ];
        await Promise.allSettled(promises);
      }

      this.notifySubscribers();
      return true;
    } catch (e) {
      console.warn('Failed to save state:', e);
      return false;
    }
  }

  // Forcefully push the entire current local state/data directly to Firebase Realtime Database
  async forceSaveToCloud() {
    try {
      this.ensureOrderCalculations();
      const nowIso = new Date().toISOString();
      this.lastSaved = nowIso;

      if (!this.activeWorkspace || !this.activeWorkspace.id) {
        this.activeWorkspace = { ...DEFAULT_WORKSPACE };
      }

      const payload = {
        activeWorkspace: this.activeWorkspace,
        activeWorkspaceId: this.activeWorkspace.id,
        workspaces: this.getCleanWorkspacesList(),
        categories: this.categories,
        orders: this.orders,
        machines: this.machines,
        workers: this.workers,
        productionLogs: this.productionLogs,
        deliveryReceivedLogs: this.deliveryReceivedLogs,
        outsourceConsignments: this.outsourceConsignments || [],
        productionPlans: this.productionPlans || [],
        inventoryItems: this.inventoryItems || [],
        materialRequests: this.materialRequests || [],
        inventoryLogs: this.inventoryLogs || [],
        lastSaved: nowIso,
        lastUpdated: nowIso,
        lastDeviceId: this.deviceId,
      };

      if (typeof window !== 'undefined') {
        try {
          const payloadStr = JSON.stringify(payload);
          localStorage.setItem(STORAGE_KEY, payloadStr);
          localStorage.setItem(VAULT_KEY, payloadStr);
          localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(this.workspaces || []));
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(this.activeWorkspace));
        } catch (storageErr) {
          console.warn('LocalStorage save warning:', storageErr);
        }
      }

      // Overwrite all dedicated Firebase endpoints synchronously
      if (typeof fetch !== 'undefined') {
        const promises = [
          firebaseRealtime.setActiveWorkspacePointer(this.activeWorkspace),
          firebaseRealtime.pushState(payload),
          firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs),
          firebaseRealtime.saveWorkspaceArchive({
            ...this.activeWorkspace,
            orders: this.orders,
            productionLogs: this.productionLogs,
            deliveryReceivedLogs: this.deliveryReceivedLogs,
            outsourceConsignments: this.outsourceConsignments || [],
            productionPlans: this.productionPlans || [],
          }),
        ];
        await Promise.allSettled(promises);
      }

      this.notifySubscribers();
      return {
        success: true,
        lastSaved: nowIso,
        activeWorkspace: this.activeWorkspace,
        counts: {
          orders: (this.orders || []).length,
          inventoryItems: (this.inventoryItems || []).length,
          productionLogs: (this.productionLogs || []).length,
          machines: (this.machines || []).length,
          workers: (this.workers || []).length,
        },
        message: 'Database Updated Successfully',
      };
    } catch (err) {
      console.error('Force save to cloud error:', err);
      throw err;
    }
  }

  // ==========================================================
  // ORDER WORKSPACE MANAGEMENT ENGINE (GLOBAL WORKSPACE STATE)
  // ==========================================================

  getActiveWorkspace() {
    if (!this.activeWorkspace || !this.activeWorkspace.id) {
      this.activeWorkspace = { ...DEFAULT_WORKSPACE };
    }
    return {
      ...this.activeWorkspace,
      orderCount: (this.orders || []).length,
      totalOrderQty: (this.orders || []).reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0),
      totalProductionQty: (this.orders || []).reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0),
      totalFloorQty: (this.orders || []).reduce((sum, o) => sum + (Number(o.floorProductionQty) || Number(o.productionQty) || 0), 0),
      totalDeliveryQty: (this.orders || []).reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0),
      totalBalanceQty: (this.orders || []).reduce((sum, o) => sum + (Number(o.balanceQty) || 0), 0),
    };
  }

  getWorkspaces() {
    const active = this.getActiveWorkspace();
    const list = (this.workspaces || []).map((w) => {
      const orderList = Array.isArray(w.orders) ? w.orders : [];
      const isActive = w.id === active.id;
      return {
        id: w.id,
        buyerName: w.buyerName || 'Unnamed Buyer',
        name: w.name || `Order - ${w.buyerName || w.id}`,
        notes: w.notes || '',
        createdAt: w.createdAt,
        archivedAt: w.archivedAt,
        status: isActive ? 'Active' : (w.status || 'Archived'),
        orderCount: isActive ? this.orders.length : (w.orderCount !== undefined ? w.orderCount : orderList.length),
        totalOrderQty: isActive
          ? this.orders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0)
          : (w.totalOrderQty !== undefined ? w.totalOrderQty : orderList.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0)),
        totalProductionQty: isActive
          ? this.orders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0)
          : (w.totalProductionQty !== undefined ? w.totalProductionQty : orderList.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0)),
        totalFloorQty: isActive
          ? this.orders.reduce((sum, o) => sum + (Number(o.floorProductionQty) || Number(o.productionQty) || 0), 0)
          : (w.totalFloorQty !== undefined ? w.totalFloorQty : orderList.reduce((sum, o) => sum + (Number(o.floorProductionQty) || Number(o.productionQty) || 0), 0)),
        totalDeliveryQty: isActive
          ? this.orders.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0)
          : (w.totalDeliveryQty !== undefined ? w.totalDeliveryQty : orderList.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0)),
        totalBalanceQty: isActive
          ? this.orders.reduce((sum, o) => sum + (Number(o.balanceQty) || 0), 0)
          : (w.totalBalanceQty !== undefined ? w.totalBalanceQty : orderList.reduce((sum, o) => sum + (Number(o.balanceQty) || 0), 0)),
        orders: orderList,
      };
    });

    return {
      activeWorkspace: active,
      workspaces: list,
    };
  }

  async createOrderWorkspace({ buyerName, workspaceName, notes = '', resetMode = 'zero_counts' }) {
    if (!buyerName || !buyerName.trim()) {
      throw new Error('Buyer Name is required to start a new order workspace.');
    }

    const cleanBuyer = buyerName.trim();
    const cleanTitle = (workspaceName && workspaceName.trim()) || `Order - ${cleanBuyer}`;
    const nowIso = new Date().toISOString();

    // 1. Safely snapshot and archive the current active workspace before resetting
    const currentWsId = this.activeWorkspace?.id || `ws_${Date.now()}_archived`;
    const currentSnapshot = {
      id: currentWsId,
      buyerName: this.activeWorkspace?.buyerName || 'Previous Order',
      name: this.activeWorkspace?.name || `Order - ${this.activeWorkspace?.buyerName || 'Archived'}`,
      notes: this.activeWorkspace?.notes || '',
      createdAt: this.activeWorkspace?.createdAt || nowIso,
      archivedAt: nowIso,
      status: 'Archived',
      orderCount: this.orders.length,
      totalOrderQty: this.orders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0),
      totalProductionQty: this.orders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0),
      totalFloorQty: this.orders.reduce((sum, o) => sum + (Number(o.floorProductionQty) || Number(o.productionQty) || 0), 0),
      totalDeliveryQty: this.orders.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0),
      totalBalanceQty: this.orders.reduce((sum, o) => sum + (Number(o.balanceQty) || 0), 0),
      orders: JSON.parse(JSON.stringify(this.orders)),
      productionLogs: JSON.parse(JSON.stringify(this.productionLogs)),
      deliveryReceivedLogs: JSON.parse(JSON.stringify(this.deliveryReceivedLogs)),
      outsourceConsignments: JSON.parse(JSON.stringify(this.outsourceConsignments || [])),
      productionPlans: JSON.parse(JSON.stringify(this.productionPlans || [])),
    };

    // Update or insert into workspaces list
    const existingIdx = this.workspaces.findIndex((w) => w.id === currentWsId);
    if (existingIdx >= 0) {
      this.workspaces[existingIdx] = currentSnapshot;
    } else {
      this.workspaces.unshift(currentSnapshot);
    }

    // 2. Create the new workspace
    const newWsId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newWorkspace = {
      id: newWsId,
      buyerName: cleanBuyer,
      name: cleanTitle,
      notes: notes.trim(),
      createdAt: nowIso,
      status: 'Active',
    };

    // 3. ZERO ALL COUNTS LOGIC:
    // PO catalog structure strictly remains, but ALL numerical counts (floor qty, production qty, delivery qty, balances) are strictly set to 0.
    const catalogSource = (this.orders && this.orders.length > 0)
      ? this.orders
      : JSON.parse(JSON.stringify(initialOrders));

    if (resetMode === 'blank') {
      this.orders = [];
    } else {
      this.orders = catalogSource.map((o, idx) => ({
        ...o,
        id: o.id || `ORD-${String(idx + 1).padStart(3, '0')}`,
        orderQty: 0,
        floorProductionQty: 0,
        productionQty: 0,
        deliveryQty: 0,
        balanceQty: 0,
        deliveryBalanceQty: 0,
        dailyLogs: [],
        status: 'Scheduled',
      }));
    }

    // Reset all production activity logs for this new workspace
    this.productionLogs = [];
    this.deliveryReceivedLogs = [];
    this.outsourceConsignments = [];
    this.productionPlans = [];

    // Clear machine floor logs
    if (Array.isArray(this.machines)) {
      this.machines.forEach((m) => {
        m.todayLogs = [];
      });
    }

    // Set active workspace
    this.activeWorkspace = newWorkspace;

    // Add new workspace snapshot to workspaces list
    const newWorkspaceSnapshot = {
      ...newWorkspace,
      orderCount: this.orders.length,
      totalOrderQty: 0,
      totalProductionQty: 0,
      totalFloorQty: 0,
      totalDeliveryQty: 0,
      totalBalanceQty: 0,
      orders: JSON.parse(JSON.stringify(this.orders)),
      productionLogs: [],
      deliveryReceivedLogs: [],
      outsourceConsignments: [],
      productionPlans: [],
    };
    this.workspaces.unshift(newWorkspaceSnapshot);

    // 4. Update the singular active workspace pointer and archives in Firebase immediately and await
    if (typeof fetch !== 'undefined') {
      await Promise.allSettled([
        firebaseRealtime.setActiveWorkspacePointer(newWorkspace),
        firebaseRealtime.saveWorkspaceArchive(currentSnapshot),
        firebaseRealtime.saveWorkspaceArchive(newWorkspaceSnapshot),
      ]);
    }

    // 5. Activate intentional reset guard and timestamps
    this.isIntentionalReset = true;
    this.lastSaved = nowIso;
    this.lastAppliedCloudTimestamp = nowIso;

    // 6. FORCE-PUSH the zeroed state directly to Firebase RTDB as the new ground truth
    await this.forceSaveToCloud();

    return {
      success: true,
      workspace: this.activeWorkspace,
      archivedPrevious: currentSnapshot,
      message: `Started new order workspace for "${cleanBuyer}"! Production counts, floor quantities, and balances reset to ZERO.`,
    };
  }

  async switchOrderWorkspace(targetWorkspaceId) {
    if (!targetWorkspaceId) throw new Error('Workspace ID is required to switch.');

    if (this.activeWorkspace?.id === targetWorkspaceId) {
      return { success: true, workspace: this.activeWorkspace, message: 'Already on active workspace.' };
    }

    const nowIso = new Date().toISOString();

    // 1. Snapshot current active workspace before leaving it
    let currentSnapshot = null;
    if (this.activeWorkspace) {
      const currentWsId = this.activeWorkspace.id;
      currentSnapshot = {
        ...this.activeWorkspace,
        archivedAt: nowIso,
        status: 'Archived',
        orderCount: this.orders.length,
        totalOrderQty: this.orders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0),
        totalProductionQty: this.orders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0),
        totalFloorQty: this.orders.reduce((sum, o) => sum + (Number(o.floorProductionQty) || Number(o.productionQty) || 0), 0),
        totalDeliveryQty: this.orders.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0),
        totalBalanceQty: this.orders.reduce((sum, o) => sum + (Number(o.balanceQty) || 0), 0),
        orders: JSON.parse(JSON.stringify(this.orders)),
        productionLogs: JSON.parse(JSON.stringify(this.productionLogs)),
        deliveryReceivedLogs: JSON.parse(JSON.stringify(this.deliveryReceivedLogs)),
        outsourceConsignments: JSON.parse(JSON.stringify(this.outsourceConsignments || [])),
        productionPlans: JSON.parse(JSON.stringify(this.productionPlans || [])),
      };

      const curIdx = this.workspaces.findIndex((w) => w.id === currentWsId);
      if (curIdx >= 0) {
        this.workspaces[curIdx] = currentSnapshot;
      } else {
        this.workspaces.unshift(currentSnapshot);
      }
    }

    // 2. Find target workspace in archives, or pull from Firebase RTDB
    let targetWs = this.workspaces.find((w) => w.id === targetWorkspaceId);
    if (!targetWs && typeof fetch !== 'undefined') {
      targetWs = await firebaseRealtime.getWorkspaceArchive(targetWorkspaceId);
    }
    if (!targetWs && typeof window !== 'undefined') {
      try {
        const rawArchives = localStorage.getItem(WORKSPACES_STORAGE_KEY);
        if (rawArchives) {
          const list = JSON.parse(rawArchives);
          if (Array.isArray(list)) targetWs = list.find((w) => w.id === targetWorkspaceId);
        }
      } catch {}
    }

    if (!targetWs) {
      throw new Error(`Workspace #${targetWorkspaceId} not found in archives.`);
    }

    // 3. Restore target workspace data
    const activeWsObj = {
      id: targetWs.id,
      buyerName: targetWs.buyerName || 'Loaded Order',
      name: targetWs.name || `Order - ${targetWs.buyerName || 'Loaded'}`,
      notes: targetWs.notes || '',
      createdAt: targetWs.createdAt || nowIso,
      status: 'Active',
    };
    this.activeWorkspace = activeWsObj;

    if ((!targetWs.orders || targetWs.orders.length === 0) && (targetWs.id === DEFAULT_WORKSPACE.id || (targetWs.id && targetWs.id.includes('baseline')))) {
      targetWs.orders = JSON.parse(JSON.stringify(initialOrders));
      targetWs.productionLogs = JSON.parse(JSON.stringify(initialProductionLogs));
      targetWs.deliveryReceivedLogs = JSON.parse(JSON.stringify(initialDeliveryReceivedLogs));
    }

    this.orders = Array.isArray(targetWs.orders) ? JSON.parse(JSON.stringify(targetWs.orders)) : [];
    this.productionLogs = Array.isArray(targetWs.productionLogs) ? JSON.parse(JSON.stringify(targetWs.productionLogs)) : [];
    this.deliveryReceivedLogs = Array.isArray(targetWs.deliveryReceivedLogs) ? JSON.parse(JSON.stringify(targetWs.deliveryReceivedLogs)) : [];
    this.outsourceConsignments = Array.isArray(targetWs.outsourceConsignments) ? JSON.parse(JSON.stringify(targetWs.outsourceConsignments)) : [];
    this.productionPlans = Array.isArray(targetWs.productionPlans) ? JSON.parse(JSON.stringify(targetWs.productionPlans)) : [];

    // Clear machine logs from previous workspace
    if (Array.isArray(this.machines)) {
      this.machines.forEach((m) => {
        m.todayLogs = (this.productionLogs || []).filter(
          (l) => l.machineId === m.id || l.machineCode === m.id || l.machineCode === m.code
        );
      });
    }

    this.ensureOrderCalculations();

    // 4. Update the singular active workspace pointer in Firebase & LocalStorage immediately and await
    if (typeof fetch !== 'undefined') {
      const promises = [
        firebaseRealtime.setActiveWorkspacePointer(activeWsObj),
      ];
      if (currentSnapshot) {
        promises.push(firebaseRealtime.saveWorkspaceArchive(currentSnapshot));
      }
      promises.push(
        firebaseRealtime.saveWorkspaceArchive({
          ...activeWsObj,
          orders: this.orders,
          productionLogs: this.productionLogs,
          deliveryReceivedLogs: this.deliveryReceivedLogs,
          outsourceConsignments: this.outsourceConsignments,
          productionPlans: this.productionPlans,
        })
      );
      await Promise.allSettled(promises);
    }

    this.isIntentionalReset = false;
    this.lastSaved = nowIso;
    this.lastAppliedCloudTimestamp = nowIso;

    // 5. Force-push to overwrite cloud ground truth
    await this.forceSaveToCloud();

    return {
      success: true,
      workspace: this.activeWorkspace,
      message: `Loaded previous order workspace "${targetWs.name || targetWs.buyerName}"! All metrics updated dynamically.`,
    };
  }

  async deleteOrderWorkspace(workspaceId) {
    if (this.activeWorkspace?.id === workspaceId) {
      throw new Error('Cannot delete the currently active order workspace. Switch to another order first.');
    }
    this.workspaces = this.workspaces.filter((w) => w.id !== workspaceId);
    if (typeof fetch !== 'undefined') {
      await firebaseRealtime.deleteWorkspaceArchive(workspaceId);
    }
    await this.save(true);
    return { success: true };
  }

  async reset(broadcastToCloud = true) {
    this.categories = JSON.parse(JSON.stringify(initialCategories));
    this.orders = JSON.parse(JSON.stringify(initialOrders));
    this.machines = JSON.parse(JSON.stringify(initialMachines));
    this.workers = JSON.parse(JSON.stringify(initialWorkers));
    this.productionLogs = JSON.parse(JSON.stringify(initialProductionLogs));
    this.deliveryReceivedLogs = JSON.parse(JSON.stringify(initialDeliveryReceivedLogs));
    this.outsourceConsignments = [];
    this.productionPlans = [];
    this.inventoryItems = JSON.parse(JSON.stringify(initialInventoryItems));
    this.materialRequests = JSON.parse(JSON.stringify(initialMaterialRequests));
    this.inventoryLogs = JSON.parse(JSON.stringify(initialInventoryLogs));
    this.ensureSpecialMachines();
    await this.save(broadcastToCloud);
    return { success: true, count: this.orders.length };
  }

  // Returns full serializable database state snapshot
  getState() {
    return {
      activeWorkspace: this.activeWorkspace,
      activeWorkspaceId: this.activeWorkspace?.id,
      workspaces: this.workspaces || [],
      categories: Array.isArray(this.categories) ? this.categories : [],
      orders: Array.isArray(this.orders) ? this.orders : [],
      machines: Array.isArray(this.machines) ? this.machines : [],
      workers: Array.isArray(this.workers) ? this.workers : [],
      productionLogs: Array.isArray(this.productionLogs) ? this.productionLogs : [],
      deliveryReceivedLogs: Array.isArray(this.deliveryReceivedLogs) ? this.deliveryReceivedLogs : [],
      outsourceConsignments: Array.isArray(this.outsourceConsignments) ? this.outsourceConsignments : [],
      productionPlans: Array.isArray(this.productionPlans) ? this.productionPlans : [],
      inventoryItems: this.inventoryItems || [],
      materialRequests: this.materialRequests || [],
      inventoryLogs: this.inventoryLogs || [],
      lastSaved: this.lastSaved || new Date().toISOString(),
      lastUpdated: this.lastSaved || new Date().toISOString(),
      lastDeviceId: this.deviceId || 'srv',
    };
  }

  ensureSpecialMachines() {
    this.machines = (this.machines || []).filter(
      (m) => m.id !== 'MCH-CMP' && m.code !== 'MCH-CMP' && !((m.name || '').toLowerCase().includes('compress'))
    );
    const specialSpecs = [
      {
        id: 'MCH-CUT',
        code: 'MCH-CUT',
        name: 'Cutting Machine',
        type: 'Strap Precision Rotary Slitter & Cutter',
        category: 'Strap',
        operatorName: 'Pradeep Silva',
        shift: 'Day Shift',
        status: 'Active',
        dailyTargetQty: 2600,
        assignedStyles: ['Strap Webbing Band - 39H6'],
        assignedColours: ['Marzipan 39H6', 'Black 093 54A2'],
        assignedSizes: ['10', '12', '14', '16', '18'],
        assignedPos: ['4502991532'],
        qrPayload: 'MCH-CUT',
        notes: 'Dedicated strap cutting section (Strap Category)',
        todayLogs: [],
      },
      {
        id: 'MCH-PUS',
        code: 'MCH-PUS',
        name: 'Pusing Machine',
        type: 'Continuous Belt Pusing / Fusing Unit',
        category: 'Strap',
        operatorName: 'Sanjeewa Silva',
        shift: 'Day Shift',
        status: 'Active',
        dailyTargetQty: 2600,
        assignedStyles: ['Strap Webbing Band - 39H6'],
        assignedColours: ['Marzipan 39H6'],
        assignedSizes: ['10', '12', '14', '16', '18'],
        assignedPos: ['4502991532'],
        qrPayload: 'MCH-PUS',
        notes: 'Pusing adhesive fusing station (Strap Category)',
        todayLogs: [],
      },
      {
        id: 'MCH-IRN',
        code: 'MCH-IRN',
        name: 'Iron Machine',
        type: 'Steam Ironing & Thermal Curing Bed',
        category: 'Strap',
        operatorName: 'Kamal Gunaratne',
        shift: 'Day Shift',
        status: 'Active',
        dailyTargetQty: 2600,
        assignedStyles: ['Strap Webbing Band - 39H6'],
        assignedColours: ['Marzipan 39H6'],
        assignedSizes: ['10', '12', '14', '16', '18'],
        assignedPos: ['4502991532'],
        qrPayload: 'MCH-IRN',
        notes: 'Thermal curing bed (Strap Category)',
        todayLogs: [],
      },
      {
        id: 'MCH-DRY',
        code: 'MCH-DRY',
        name: 'Dry Cut Machine',
        type: 'Automatic Dry Rotary Guillotine Cutter',
        category: 'Strap',
        operatorName: 'Anura Bandara',
        shift: 'Day Shift',
        status: 'Active',
        dailyTargetQty: 2600,
        assignedStyles: ['Strap Webbing Band - 39H6'],
        assignedColours: ['Marzipan 39H6', 'Black 093 54A2'],
        assignedSizes: ['10', '12', '14', '16', '18'],
        assignedPos: ['4502991532'],
        qrPayload: 'MCH-DRY',
        notes: 'Multiplier Logic: Size 10->x50, 12->x50, 14->x50, 16->x45, 18->x50',
        todayLogs: [],
      },
    ];

    for (const spec of specialSpecs) {
      const idx = this.machines.findIndex((m) => m.id === spec.id || m.code === spec.code);
      if (idx === -1) {
        this.machines.push(spec);
      }
    }

    const mch06 = this.machines.find((m) => m.id === 'MCH-06' || m.code === 'MCH-06');
    if (mch06) {
      mch06.assignedStyles = [
        'Loop Elastic Band - 54A2',
        'Loop Elastic Band - 39H6',
        'Loop Elastic Band - 65H8',
        'Loop Elastic Band - 33F6',
        'Loop Elastic Band - 57H1',
      ];
      mch06.assignedPos = ['4502991550', '4502991532', '4502991599', '4502991520', '4502991562'];
    }
  }

  // Categories summary calculation
  getCategoriesSummary() {
    return this.categories.map((cat) => {
      const catOrders = this.orders.filter((o) => o.category.toLowerCase() === cat.id.toLowerCase());
      const orderQty = catOrders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0);
      const productionQty = catOrders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0);
      const deliveryQty = catOrders.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0);
      const balanceQty = orderQty - productionQty;
      const deliveryBalanceQty = orderQty - deliveryQty;

      const statusCounts = {
        onTrack: catOrders.filter((o) => o.status === 'On Track').length,
        behindPlan: catOrders.filter((o) => o.status === 'Behind Plan').length,
        ahead: catOrders.filter((o) => o.status === 'Ahead').length,
        completed: catOrders.filter((o) => o.status === 'Completed').length,
      };

      const dailyMap = {};
      catOrders.forEach((order) => {
        (order.dailyLogs || []).forEach((log) => {
          if (!dailyMap[log.date]) {
            dailyMap[log.date] = { date: log.date, planQty: 0, actualQty: 0, deliveryQty: 0 };
          }
          dailyMap[log.date].planQty += Number(log.planQty) || 0;
          dailyMap[log.date].actualQty += Number(log.actualQty) || 0;
          dailyMap[log.date].deliveryQty += Number(log.deliveryQty) || 0;
        });
      });

      const dailyPlanVsActual = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      const completionRate = orderQty > 0 ? Math.round((productionQty / orderQty) * 100) : 0;
      const deliveryRate = orderQty > 0 ? Math.round((deliveryQty / orderQty) * 100) : 0;

      return {
        ...cat,
        orderQty,
        productionQty,
        deliveryQty,
        balanceQty,
        deliveryBalanceQty,
        completionRate,
        deliveryRate,
        totalOrders: catOrders.length,
        activeOrders: catOrders.filter((o) => o.status !== 'Completed').length,
        statusCounts,
        dailyPlanVsActual,
      };
    });
  }

  getCategoryDetails(categoryId) {
    const categories = this.getCategoriesSummary();
    const target = categories.find((c) => c.id.toLowerCase() === categoryId.toLowerCase());
    if (!target) return null;

    const catOrders = this.orders.filter((o) => o.category.toLowerCase() === categoryId.toLowerCase());
    const styleBreakdown = {};
    catOrders.forEach((o) => {
      const key = o.styleCode || o.style;
      if (!styleBreakdown[key]) {
        styleBreakdown[key] = {
          name: o.style,
          code: o.styleCode || o.style,
          rmMaterial: o.rmMaterial,
          colour: o.colour,
          orderQty: 0,
          productionQty: 0,
          deliveryQty: 0,
          ordersCount: 0,
        };
      }
      styleBreakdown[key].orderQty += o.orderQty;
      styleBreakdown[key].productionQty += o.productionQty;
      styleBreakdown[key].deliveryQty += o.deliveryQty;
      styleBreakdown[key].ordersCount += 1;
    });

    return {
      ...target,
      styles: Object.values(styleBreakdown),
      orders: catOrders,
    };
  }

  getFactoryOverview() {
    const categories = this.getCategoriesSummary();
    const totalOrderQty = categories.reduce((acc, c) => acc + c.orderQty, 0);
    const totalProductionQty = categories.reduce((acc, c) => acc + c.productionQty, 0);
    const totalDeliveryQty = categories.reduce((acc, c) => acc + c.deliveryQty, 0);
    const totalBalanceQty = totalOrderQty - totalProductionQty;
    const totalDeliveryBalance = totalOrderQty - totalDeliveryQty;

    return {
      totalOrderQty,
      totalProductionQty,
      totalDeliveryQty,
      totalBalanceQty,
      totalDeliveryBalance,
      overallCompletionRate: totalOrderQty > 0 ? Math.round((totalProductionQty / totalOrderQty) * 100) : 0,
      totalOrdersCount: this.orders.length,
      categories,
    };
  }

  getOrders(params = {}) {
    let result = [...this.orders];
    const { search, poNumber, rmMaterial, colour, category, style, size, status } = params;

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (o) =>
          (o.poNumber && o.poNumber.toLowerCase().includes(q)) ||
          (o.rmMaterial && o.rmMaterial.toLowerCase().includes(q)) ||
          (o.colour && o.colour.toLowerCase().includes(q)) ||
          (o.barcode && o.barcode.toLowerCase().includes(q)) ||
          (o.style && o.style.toLowerCase().includes(q)) ||
          (o.size && o.size.toLowerCase() === q)
      );
    }

    if (poNumber && poNumber.toLowerCase() !== 'all') {
      result = result.filter((o) => o.poNumber && o.poNumber.toLowerCase() === poNumber.toLowerCase());
    }
    if (rmMaterial && rmMaterial.toLowerCase() !== 'all') {
      result = result.filter((o) => o.rmMaterial && o.rmMaterial.toLowerCase() === rmMaterial.toLowerCase());
    }
    if (colour && colour.toLowerCase() !== 'all') {
      result = result.filter((o) => o.colour && o.colour.toLowerCase() === colour.toLowerCase());
    }
    if (category && category.toLowerCase() !== 'all') {
      result = result.filter((o) => o.category && o.category.toLowerCase() === category.toLowerCase());
    }
    if (style && style.toLowerCase() !== 'all') {
      result = result.filter(
        (o) => (o.style && o.style.toLowerCase() === style.toLowerCase()) || (o.styleCode && o.styleCode.toLowerCase() === style.toLowerCase())
      );
    }
    if (size && size.toLowerCase() !== 'all') {
      result = result.filter((o) => o.size && String(o.size) === String(size));
    }
    if (status && status.toLowerCase() !== 'all') {
      result = result.filter((o) => o.status && o.status.toLowerCase() === status.toLowerCase());
    }

    return {
      total: result.length,
      orders: result,
      summary: {
        totalOrderQty: result.reduce((s, o) => s + (Number(o.orderQty) || 0), 0),
        totalProductionQty: result.reduce((s, o) => s + (Number(o.productionQty) || 0), 0),
        totalDeliveryQty: result.reduce((s, o) => s + (Number(o.deliveryQty) || 0), 0),
      },
    };
  }

  getOrderById(id) {
    return this.orders.find((o) => o.id === id || o.poNumber === id || o.barcode === id) || null;
  }

  createOrder(orderData) {
    const nextIdx = this.orders.length + 1;
    const ordQty = Number(orderData.orderQty) || 0;
    const prodQty = Number(orderData.productionQty) || 0;
    const delivQty = Number(orderData.deliveryQty) || 0;
    const floorQty = orderData.floorProductionQty !== undefined ? Number(orderData.floorProductionQty) : prodQty;
    const balQty = orderData.balanceQty !== undefined ? Number(orderData.balanceQty) : (ordQty - delivQty);

    let initialStatus = orderData.status || 'On Track';
    if (balQty <= 0) initialStatus = 'Completed';
    else if (delivQty >= ordQty * 0.9) initialStatus = 'Ahead';

    const newOrder = {
      id: orderData.id || `ORD-${String(nextIdx).padStart(3, '0')}`,
      poNumber: String(orderData.poNumber || `450299${1500 + nextIdx}`).trim(),
      rmMaterial: String(orderData.rmMaterial || '200150259454A2').trim(),
      colour: String(orderData.colour || 'Standard Black').trim(),
      size: String(orderData.size || '10').trim(),
      category: String(orderData.category || 'Loop').trim(),
      style: String(orderData.style || 'Loop Elastic Band').trim(),
      styleCode: orderData.styleCode || (orderData.style ? (orderData.style.split(' - ')[1] || 'LP-NEW') : 'LP-NEW'),
      barcode: `BTX-${orderData.poNumber || nextIdx}-${orderData.size || '10'}`,
      orderQty: ordQty,
      floorProductionQty: floorQty,
      productionQty: prodQty,
      deliveryQty: delivQty,
      balanceQty: balQty,
      deliveryBalanceQty: balQty,
      startDate: orderData.startDate || new Date().toISOString().split('T')[0],
      targetDate: orderData.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: initialStatus,
      priority: orderData.priority || 'Normal',
      dailyLogs: orderData.dailyLogs || [],
      createdAt: new Date().toISOString(),
    };
    this.orders.unshift(newOrder);
    this.save(true);
    firestoreSync.saveDocument('orders', newOrder.id, newOrder);
    return newOrder;
  }

  async updateOrder(id, updates = {}) {
    const order = this.getOrderById(id);
    if (!order) return null;

    if (updates.poNumber !== undefined) order.poNumber = String(updates.poNumber).trim();
    if (updates.rmMaterial !== undefined) order.rmMaterial = String(updates.rmMaterial).trim();
    if (updates.colour !== undefined) order.colour = String(updates.colour).trim();
    if (updates.size !== undefined) order.size = String(updates.size).trim();
    if (updates.category !== undefined) order.category = String(updates.category).trim();
    if (updates.style !== undefined) order.style = String(updates.style).trim();
    if (updates.styleCode !== undefined) order.styleCode = String(updates.styleCode).trim();
    if (updates.priority !== undefined) order.priority = String(updates.priority).trim();
    if (updates.startDate !== undefined) order.startDate = updates.startDate;
    if (updates.targetDate !== undefined) order.targetDate = updates.targetDate;

    if (updates.orderQty !== undefined) order.orderQty = Number(updates.orderQty) || 0;
    if (updates.floorProductionQty !== undefined) order.floorProductionQty = Number(updates.floorProductionQty) || 0;
    if (updates.productionQty !== undefined) order.productionQty = Number(updates.productionQty) || 0;
    if (updates.deliveryQty !== undefined) order.deliveryQty = Number(updates.deliveryQty) || 0;

    if (updates.balanceQty !== undefined && updates.balanceQty !== '') {
      order.balanceQty = Number(updates.balanceQty);
    } else {
      order.balanceQty = order.orderQty - order.deliveryQty;
    }
    order.deliveryBalanceQty = order.balanceQty;

    // Recalculate status or accept custom status
    if (updates.status !== undefined && updates.status) {
      order.status = updates.status;
    } else if (order.balanceQty <= 0) {
      order.status = 'Completed';
    } else if (order.deliveryQty >= order.orderQty * 0.9 || order.productionQty >= order.orderQty * 0.9) {
      order.status = 'Ahead';
    }

    order.barcode = `BTX-${order.poNumber}-${order.size}`;
    order.updatedAt = new Date().toISOString();

    await this.save(true);
    firestoreSync.saveDocument('orders', order.id, order);
    return order;
  }

  async bulkCreateOrUpdateOrders(ordersList = []) {
    if (!Array.isArray(ordersList) || ordersList.length === 0) {
      return { success: false, message: 'No orders provided', count: 0 };
    }

    let createdCount = 0;
    let updatedCount = 0;
    const processedOrders = [];

    ordersList.forEach((raw) => {
      if (!raw || (!raw.poNumber && !raw.id)) return;

      const poClean = String(raw.poNumber || '').trim();
      const sizeClean = String(raw.size || '').trim();

      // Check if existing order matches by ID or (PO number + Size)
      const existing = (raw.id && this.getOrderById(raw.id)) ||
        this.orders.find((o) => o.poNumber === poClean && String(o.size) === sizeClean) ||
        (poClean && !sizeClean ? this.orders.find((o) => o.poNumber === poClean) : null);

      if (existing) {
        if (raw.rmMaterial) existing.rmMaterial = String(raw.rmMaterial).trim();
        if (raw.colour) existing.colour = String(raw.colour).trim();
        if (raw.size) existing.size = sizeClean;
        if (raw.category) existing.category = String(raw.category).trim();
        if (raw.style) existing.style = String(raw.style).trim();
        if (raw.orderQty !== undefined && raw.orderQty !== '') existing.orderQty = Number(raw.orderQty) || 0;
        if (raw.floorProductionQty !== undefined && raw.floorProductionQty !== '') existing.floorProductionQty = Number(raw.floorProductionQty) || 0;
        if (raw.productionQty !== undefined && raw.productionQty !== '') existing.productionQty = Number(raw.productionQty) || 0;
        if (raw.deliveryQty !== undefined && raw.deliveryQty !== '') existing.deliveryQty = Number(raw.deliveryQty) || 0;
        if (raw.balanceQty !== undefined && raw.balanceQty !== '') {
          existing.balanceQty = Number(raw.balanceQty);
        } else {
          existing.balanceQty = existing.orderQty - existing.deliveryQty;
        }
        existing.deliveryBalanceQty = existing.balanceQty;

        if (raw.status) {
          existing.status = String(raw.status).trim();
        } else if (existing.balanceQty <= 0) {
          existing.status = 'Completed';
        } else if (existing.deliveryQty >= existing.orderQty * 0.9) {
          existing.status = 'Ahead';
        }

        existing.barcode = `BTX-${existing.poNumber}-${existing.size}`;
        existing.updatedAt = new Date().toISOString();
        updatedCount++;
        processedOrders.push(existing);
        firestoreSync.saveDocument('orders', existing.id, existing);
      } else {
        const nextIdx = this.orders.length + 1;
        const ordQty = Number(raw.orderQty) || 0;
        const floorQty = raw.floorProductionQty !== undefined && raw.floorProductionQty !== '' ? Number(raw.floorProductionQty) || 0 : (Number(raw.productionQty) || 0);
        const prodQty = Number(raw.productionQty) || 0;
        const delivQty = Number(raw.deliveryQty) || 0;
        const balQty = raw.balanceQty !== undefined && raw.balanceQty !== '' ? Number(raw.balanceQty) : (ordQty - delivQty);

        let initialStatus = 'On Track';
        if (raw.status) initialStatus = String(raw.status).trim();
        else if (balQty <= 0) initialStatus = 'Completed';
        else if (delivQty >= ordQty * 0.9) initialStatus = 'Ahead';

        const newOrder = {
          id: raw.id || `ORD-${String(nextIdx).padStart(3, '0')}`,
          poNumber: poClean || `450299${1500 + nextIdx}`,
          rmMaterial: raw.rmMaterial || '200150259454A2',
          colour: raw.colour || 'Standard',
          size: sizeClean || '10',
          category: raw.category || 'Loop',
          style: raw.style || 'Loop Elastic Band',
          styleCode: raw.styleCode || (raw.style ? (raw.style.split(' - ')[1] || 'LP-NEW') : 'LP-NEW'),
          barcode: `BTX-${poClean || nextIdx}-${sizeClean || '10'}`,
          orderQty: ordQty,
          floorProductionQty: floorQty,
          productionQty: prodQty,
          deliveryQty: delivQty,
          balanceQty: balQty,
          deliveryBalanceQty: balQty,
          startDate: raw.startDate || new Date().toISOString().split('T')[0],
          targetDate: raw.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          status: initialStatus,
          priority: raw.priority || 'Normal',
          dailyLogs: [],
          createdAt: new Date().toISOString(),
        };

        this.orders.unshift(newOrder);
        createdCount++;
        processedOrders.push(newOrder);
        firestoreSync.saveDocument('orders', newOrder.id, newOrder);
      }
    });

    this.ensureOrderCalculations();
    await this.save(true);
    return {
      success: true,
      totalProcessed: processedOrders.length,
      createdCount,
      updatedCount,
      orders: processedOrders,
    };
  }

  async addDailyLog(orderId, logData) {
    const order = this.getOrderById(orderId);
    if (!order) return null;
    const actual = Number(logData.actualQty) || 0;
    const delivery = Number(logData.deliveryQty) || 0;

    order.productionQty += actual;
    order.deliveryQty += delivery;
    order.balanceQty = order.orderQty - order.productionQty;
    order.deliveryBalanceQty = order.orderQty - order.deliveryQty;

    if (order.balanceQty <= 0) order.status = 'Completed';
    else if (order.productionQty >= order.orderQty * 0.9) order.status = 'Ahead';

    if (!order.dailyLogs) order.dailyLogs = [];
    order.dailyLogs.push({
      date: logData.date || new Date().toISOString().split('T')[0],
      planQty: Number(logData.planQty) || Math.round(order.orderQty / 10),
      actualQty: actual,
      deliveryQty: delivery,
      notes: logData.notes || 'Daily log entry',
    });
    await this.save(true);
    firestoreSync.saveDocument('orders', order.id, order);
    return order;
  }

  getTimeSeries(category = 'All') {
    let relevantOrders = this.orders;
    if (category && category.toLowerCase() !== 'all') {
      relevantOrders = relevantOrders.filter((o) => o.category.toLowerCase() === category.toLowerCase());
    }

    const dateMap = {};
    relevantOrders.forEach((order) => {
      (order.dailyLogs || []).forEach((log) => {
        if (!dateMap[log.date]) {
          dateMap[log.date] = { date: log.date, planQty: 0, actualQty: 0, deliveryQty: 0, variance: 0 };
        }
        dateMap[log.date].planQty += Number(log.planQty) || 0;
        dateMap[log.date].actualQty += Number(log.actualQty) || 0;
        dateMap[log.date].deliveryQty += Number(log.deliveryQty) || 0;
      });
    });

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  lookupBarcode(code) {
    return this.orders.find((o) => o.barcode === code || o.poNumber === code) || null;
  }

  getMetadata() {
    const styles = [];
    const seenStyles = new Set();
    this.orders.forEach((o) => {
      const code = o.styleCode || o.style;
      if (!seenStyles.has(code)) {
        seenStyles.add(code);
        styles.push({ name: o.style, code, category: o.category });
      }
    });

    const sizes = [...new Set(this.orders.map((o) => String(o.size)).filter(Boolean))].sort((a, b) => {
      const nA = parseInt(a, 10);
      const nB = parseInt(b, 10);
      if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
      return a.localeCompare(b);
    });

    const colours = [...new Set(this.orders.map((o) => o.colour).filter(Boolean))].sort();
    const rmMaterials = [...new Set(this.orders.map((o) => o.rmMaterial).filter(Boolean))].sort();
    const poNumbers = [...new Set(this.orders.map((o) => o.poNumber).filter(Boolean))].sort();

    return {
      styles,
      sizes,
      colours,
      rmMaterials,
      poNumbers,
      categories: this.categories.map((c) => ({ id: c.id, name: c.name, code: c.code })),
    };
  }

  getMachines() {
    return this.machines.map((m) => {
      const logs = m.todayLogs || [];
      const todayTotal = logs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      return {
        ...m,
        todayProducedQty: todayTotal,
        todayLogsCount: logs.length,
      };
    });
  }

  getMachineById(id) {
    return (
      this.machines.find(
        (m) =>
          m.id.toLowerCase() === id.toLowerCase() ||
          m.code.toLowerCase() === id.toLowerCase() ||
          (m.qrPayload && m.qrPayload.toLowerCase() === id.toLowerCase())
      ) || null
    );
  }

  saveMachine(machineData) {
    const { id, code, name, category, dailyTargetQty, assignedStyles, assignedColours, assignedSizes, assignedPos, operatorName, shift } = machineData;
    let machine = this.machines.find((m) => m.id === id || m.code === code);
    if (machine) {
      if (name) machine.name = name;
      if (category) machine.category = category;
      if (dailyTargetQty !== undefined) machine.dailyTargetQty = Number(dailyTargetQty) || machine.dailyTargetQty;
      if (assignedStyles) machine.assignedStyles = assignedStyles;
      if (assignedColours) machine.assignedColours = assignedColours;
      if (assignedSizes) machine.assignedSizes = assignedSizes;
      if (assignedPos) machine.assignedPos = assignedPos;
      if (operatorName) machine.operatorName = operatorName;
      if (shift) machine.shift = shift;
    } else {
      machine = {
        id: id || `MCH-${String(this.machines.length + 1).padStart(2, '0')}`,
        code: code || `MCH-${String(this.machines.length + 1).padStart(2, '0')}`,
        name: name || 'New Machine Station',
        type: 'Custom Production Unit',
        category: category || 'Loop',
        operatorName: operatorName || 'Assigned Operator',
        shift: shift || 'Shift A',
        status: 'Active',
        dailyTargetQty: Number(dailyTargetQty) || 2500,
        assignedStyles: assignedStyles || [],
        assignedColours: assignedColours || [],
        assignedSizes: assignedSizes || [],
        assignedPos: assignedPos || [],
        qrPayload: id || code,
        todayLogs: [],
      };
      this.machines.push(machine);
    }
    this.save(true);
    firestoreSync.saveDocument('machines', machine.id, machine);
    return machine;
  }

  deleteMachine(id) {
    if (!id) return false;
    const clean = String(id).trim().toLowerCase();
    const idx = this.machines.findIndex(
      (m) => (m.id && m.id.toLowerCase() === clean) || (m.code && m.code.toLowerCase() === clean)
    );
    if (idx === -1) return false;
    this.machines.splice(idx, 1);
    this.save(true);
    return true;
  }

  async submitWorkerProduction(data) {
    const { machineId, style, size, colour, producedQty, poNumber, shift, operatorName, timeSlot, notes } = data;
    const qty = Number(producedQty) || 0;
    if (qty <= 0) throw new Error('Produced quantity must be greater than 0');

    const machine = this.getMachineById(machineId);
    if (!machine) throw new Error(`Machine '${machineId}' not found`);

    const isDryCut = (machine.name || '').toLowerCase().includes('dry cut') || (machine.code || '').toLowerCase().includes('dry');
    let multiplier = 1;
    let rawQty = 0;
    let effectiveQty = 0;

    if (isDryCut) {
      const sz = String(size || '').trim();
      multiplier = sz === '16' ? 45 : 50;
      if (data.rawQty !== undefined && data.rawQty !== null && Number(data.rawQty) > 0) {
        rawQty = Number(data.rawQty);
      } else {
        rawQty = Number(data.producedQty || data.quantity || data.qty) || 0;
      }
      effectiveQty = rawQty * multiplier;
    } else {
      rawQty = Number(data.rawQty || data.producedQty || data.quantity || data.qty) || 0;
      effectiveQty = rawQty;
    }

    let matchedOrder = null;
    const normColour = (colour || '').toLowerCase().trim();
    const strSize = String(size || '').trim();

    // 1. If PO, Size, and Colour are all provided (Exact match)
    if (poNumber && strSize && normColour) {
      matchedOrder = this.orders.find(
        (o) =>
          o.poNumber === poNumber &&
          String(o.size) === strSize &&
          ((o.colour || '').toLowerCase().trim() === normColour ||
           (o.colour || '').toLowerCase().includes(normColour) ||
           normColour.includes((o.colour || '').toLowerCase().trim()))
      );
    }

    // 2. If Colour and Size are provided (Matches exact order for floor entry)
    if (!matchedOrder && normColour && strSize) {
      matchedOrder = this.orders.find(
        (o) =>
          String(o.size) === strSize &&
          ((o.colour || '').toLowerCase().trim() === normColour ||
           (o.colour || '').toLowerCase().includes(normColour) ||
           normColour.includes((o.colour || '').toLowerCase().trim()))
      );
    }

    // 3. If Style and Size match
    if (!matchedOrder && style && strSize) {
      matchedOrder = this.orders.find(
        (o) =>
          (o.style === style || o.styleCode === style) &&
          String(o.size) === strSize &&
          (!normColour || (o.colour || '').toLowerCase().trim() === normColour)
      );
    }

    // 4. Fallback to PO and Size only if no colour was provided
    if (!matchedOrder && poNumber && strSize && !normColour) {
      matchedOrder = this.orders.find((o) => o.poNumber === poNumber && String(o.size) === strSize);
    }
    if (!matchedOrder && strSize && !normColour) {
      matchedOrder = this.orders.find((o) => String(o.size) === strSize && o.category.toLowerCase() === machine.category.toLowerCase());
    }

    const isLoopInsert =
      (machine.name || '').toLowerCase().includes('loop insert') ||
      (machine.name || '').toLowerCase().includes('insert loop') ||
      ((machine.name || '').toLowerCase().includes('insert') && (machine.name || '').toLowerCase().includes('loop')) ||
      (machine.code || '').toLowerCase() === 'mch-06';

    const todayStr = (data.date || new Date().toISOString().split('T')[0]).slice(0, 10);
    if (matchedOrder) {
      if (matchedOrder.floorProductionQty === undefined || matchedOrder.floorProductionQty === null) {
        matchedOrder.floorProductionQty = Number(matchedOrder.productionQty) || 0;
      }
      // ONLY Loop Insert increases floorProductionQty!
      if (isLoopInsert) {
        matchedOrder.floorProductionQty += effectiveQty;
      }
      // matchedOrder.productionQty is NOT touched here; only Permanent Delivery updates it!

      if (!matchedOrder.dailyLogs) matchedOrder.dailyLogs = [];
      const todayLog = matchedOrder.dailyLogs.find((l) => l.date === todayStr);
      if (todayLog) {
        todayLog.actualQty += effectiveQty;
      } else {
        matchedOrder.dailyLogs.push({
          date: todayStr,
          planQty: Math.round(matchedOrder.orderQty / 10),
          actualQty: effectiveQty,
          deliveryQty: 0,
          notes: `Batch from ${machine.name} (${operatorName || machine.operatorName}) - ${timeSlot || 'Slot'}`,
        });
      }
    }

    const logEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeSlot: timeSlot || 'Current Window',
      qty: effectiveQty,
      rawQty,
      multiplier,
      style: style || matchedOrder?.style || 'Standard',
      size: String(size),
      colour: colour || matchedOrder?.colour || 'Standard',
      poNumber: matchedOrder?.poNumber || poNumber || 'PO-PROD-BATCH',
      operator: operatorName || machine.operatorName,
      shift: shift || machine.shift,
      notes: notes || (isDryCut ? `Input ${rawQty} × ${multiplier} = ${effectiveQty} pcs` : 'Floor QR scan entry'),
    };

    if (!machine.todayLogs) machine.todayLogs = [];
    machine.todayLogs.unshift(logEntry);

    const globalLogEntry = {
      ...logEntry,
      date: todayStr,
      category: machine.category,
      machineId: machine.code || machine.id,
      machineName: machine.name,
      operatorName: operatorName || machine.operatorName,
    };
    if (!this.productionLogs) this.productionLogs = [];
    this.productionLogs.unshift(globalLogEntry);

    if (this.workers) {
      const activeWorkerName = operatorName || machine.operatorName;
      const worker = this.workers.find((w) => w.name === activeWorkerName);
      if (worker) {
        worker.todayOutput = (worker.todayOutput || 0) + effectiveQty;
        worker.todayProduced = (worker.todayProduced || 0) + effectiveQty;
        worker.batchesLogged = (worker.batchesLogged || 0) + 1;
      }
    }

    await this.save(true);
    // Background sync to Firestore
    firestoreSync.saveDocument('production_logs', logEntry.id, globalLogEntry);
    if (matchedOrder) firestoreSync.saveDocument('orders', matchedOrder.id, matchedOrder);
    firestoreSync.saveDocument('machines', machine.id, machine);

    return {
      success: true,
      submission: logEntry,
      machine,
      matchedOrder,
      effectiveQty,
      multiplier,
    };
  }

  getWorkers() {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.workers.map((w) => {
      const todayLogs = (this.productionLogs || []).filter(
        (l) => l.date === todayStr && l.operatorName?.toLowerCase() === w.name?.toLowerCase()
      );
      const todayProduced = todayLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      return {
        ...w,
        todayProduced,
        batchesLogged: todayLogs.length,
      };
    });
  }

  addWorker(workerData) {
    const nextNum = this.workers.length + 1;
    const newWorker = {
      id: `WRK-${String(nextNum).padStart(2, '0')}`,
      name: workerData.name || 'New Operator',
      empId: workerData.empId || `EMP-${1040 + nextNum}`,
      category: workerData.category || 'Loop',
      shift: workerData.shift || 'Shift A',
      status: 'Active',
      phone: workerData.phone || '+94 77 000 0000',
      assignedMachine: workerData.assignedMachine || 'MCH-01',
      todayProduced: 0,
      todayOutput: 0,
      batchesLogged: 0,
    };
    this.workers.push(newWorker);
    this.save(true);
    firestoreSync.saveDocument('workers', newWorker.id, newWorker);
    return newWorker;
  }

  updateWorker(id, workerData) {
    const index = this.workers.findIndex((w) => w.id === id || w.empId === id);
    if (index === -1) return null;
    this.workers[index] = { ...this.workers[index], ...workerData };
    this.save(true);
    firestoreSync.saveDocument('workers', this.workers[index].id, this.workers[index]);
    return this.workers[index];
  }

  deleteWorker(id) {
    const index = this.workers.findIndex((w) => w.id === id || w.empId === id);
    if (index === -1) return false;
    this.workers.splice(index, 1);
    this.save(true);
    return true;
  }

  findProductionLog(logId, query = {}) {
    if (!logId && !query.machineId) return null;

    // 1. Check in productionLogs by ID
    if (logId && Array.isArray(this.productionLogs)) {
      const idx = this.productionLogs.findIndex((l) => l.id === logId);
      if (idx !== -1) return { log: this.productionLogs[idx], source: 'productionLogs', index: idx };
    }

    // 2. Check in machines.todayLogs by ID
    if (logId && Array.isArray(this.machines)) {
      for (const m of this.machines) {
        if (Array.isArray(m.todayLogs)) {
          const idx = m.todayLogs.findIndex((l) => l.id === logId);
          if (idx !== -1) return { log: m.todayLogs[idx], machine: m, source: 'machine', index: idx };
        }
      }
    }

    // 3. Match by attributes if ID was synthetic or missing
    const targetMachine = query.machineId || query.machineCode;
    const targetSlot = (query.timeSlot || query.slotId || query.slotLabel || '').replace(/\s+/g, '');
    const targetDate = query.date ? String(query.date).slice(0, 10) : '';
    const targetSize = query.size !== undefined && query.size !== null && query.size !== '-' ? String(query.size).trim() : null;
    const targetQty = query.qty !== undefined && query.qty !== null ? Number(query.qty) : null;

    if (targetMachine) {
      if (Array.isArray(this.productionLogs)) {
        const idx = this.productionLogs.findIndex((l) => {
          const machMatch =
            l.machineId === targetMachine ||
            l.machineCode === targetMachine ||
            (l.machineName && l.machineName.toLowerCase() === targetMachine.toLowerCase());
          const slotMatch = !targetSlot || (l.timeSlot && l.timeSlot.replace(/\s+/g, '') === targetSlot);
          const dateMatch = !targetDate || (l.date || l.timestamp || '').slice(0, 10) === targetDate;
          const szMatch = !targetSize || String(l.size).trim() === targetSize;
          const qtyMatch = targetQty === null || Number(l.qty) === targetQty;
          return machMatch && slotMatch && dateMatch && szMatch && qtyMatch;
        });
        if (idx !== -1) return { log: this.productionLogs[idx], source: 'productionLogs', index: idx };
      }

      const mach = this.machines.find(
        (m) =>
          m.code === targetMachine ||
          m.id === targetMachine ||
          (m.name && m.name.toLowerCase() === targetMachine.toLowerCase())
      );
      if (mach && Array.isArray(mach.todayLogs)) {
        const idx = mach.todayLogs.findIndex((l) => {
          const slotMatch = !targetSlot || (l.timeSlot && l.timeSlot.replace(/\s+/g, '') === targetSlot);
          const dateMatch = !targetDate || (l.date || l.timestamp || '').slice(0, 10) === targetDate;
          const szMatch = !targetSize || String(l.size).trim() === targetSize;
          const qtyMatch = targetQty === null || Number(l.qty) === targetQty;
          return slotMatch && dateMatch && szMatch && qtyMatch;
        });
        if (idx !== -1) return { log: mach.todayLogs[idx], machine: mach, source: 'machine', index: idx };
      }
    }

    return null;
  }

  findLoopOrder(log) {
    if (!log) return null;
    const targetPo = log.poNumber;
    const targetSize = String(log.size || '').trim();
    const targetColour = (log.colour || '').toLowerCase().trim();

    let order = this.orders.find((o) => {
      const poMatch = targetPo && targetPo !== 'PO-PROD-BATCH' && o.poNumber === targetPo;
      const colMatch = targetColour && (o.colour || '').toLowerCase().trim() === targetColour;
      const szMatch = targetSize && String(o.size).trim() === targetSize;
      return (poMatch && szMatch) || (colMatch && szMatch);
    });
    if (!order && targetSize) {
      order = this.orders.find((o) => String(o.size).trim() === targetSize && (o.category || '').toLowerCase() === 'loop');
    }
    return order;
  }

  updateProductionLog(logId, updatedData = {}) {
    const found = this.findProductionLog(logId, updatedData);
    if (!found) return null;

    const oldLog = found.log;
    const oldQty = Number(oldLog.qty) || 0;
    const newQty = updatedData.qty !== undefined ? Number(updatedData.qty) : oldQty;
    const qtyDelta = newQty - oldQty;

    const effectiveId = oldLog.id || logId || `LOG-${Date.now()}`;
    const updatedLog = {
      ...oldLog,
      ...updatedData,
      id: effectiveId,
      qty: newQty,
      rawQty: updatedData.rawQty !== undefined ? Number(updatedData.rawQty) : newQty,
      operator: updatedData.operator || updatedData.operatorName || oldLog.operator,
      operatorName: updatedData.operatorName || updatedData.operator || oldLog.operatorName,
      notes: updatedData.notes !== undefined ? updatedData.notes : oldLog.notes,
    };

    // 1. Update in this.productionLogs
    if (!Array.isArray(this.productionLogs)) this.productionLogs = [];
    const pIdx = this.productionLogs.findIndex((l) => (l.id && l.id === effectiveId) || l === oldLog);
    if (pIdx !== -1) {
      this.productionLogs[pIdx] = updatedLog;
    } else {
      this.productionLogs.unshift(updatedLog);
    }

    // 2. Update inside machine.todayLogs & recalculate machine totals
    const targetMachineId = updatedLog.machineId || oldLog.machineId;
    const mach = this.machines.find(
      (m) =>
        m.code === targetMachineId ||
        m.id === targetMachineId ||
        (m.name || '').toLowerCase() === (updatedLog.machineName || oldLog.machineName || '').toLowerCase()
    );
    if (mach) {
      if (!Array.isArray(mach.todayLogs)) mach.todayLogs = [];
      const mIdx = mach.todayLogs.findIndex(
        (l) => (l.id && l.id === effectiveId) || l === oldLog || (l.timeSlot === oldLog.timeSlot && Number(l.qty) === oldQty)
      );
      if (mIdx !== -1) {
        mach.todayLogs[mIdx] = { ...mach.todayLogs[mIdx], ...updatedLog };
      } else {
        mach.todayLogs.unshift(updatedLog);
      }
      mach.todayProduced = mach.todayLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      mach.todayOutput = mach.todayProduced;
    }

    // 3. Loop Insert logic -> floorProductionQty
    const isLoopInsert =
      (mach?.name || updatedLog.machineName || oldLog.machineName || '').toLowerCase().includes('loop insert') ||
      (mach?.name || updatedLog.machineName || oldLog.machineName || '').toLowerCase().includes('insert loop') ||
      ((mach?.name || updatedLog.machineName || '').toLowerCase().includes('insert') && (mach?.name || '').toLowerCase().includes('loop')) ||
      (mach?.code || targetMachineId || '').toLowerCase() === 'mch-06';

    if (isLoopInsert && qtyDelta !== 0) {
      const order = this.findLoopOrder(updatedLog) || this.findLoopOrder(oldLog);
      if (order) {
        if (order.floorProductionQty === undefined || order.floorProductionQty === null) {
          order.floorProductionQty = Number(order.productionQty) || 0;
        }
        order.floorProductionQty = Math.max(0, (Number(order.floorProductionQty) || 0) + qtyDelta);
      }
    }

    this.save(true);
    return updatedLog;
  }

  deleteProductionLog(logId, query = {}) {
    const found = this.findProductionLog(logId, query);
    if (!found) return false;

    const oldLog = found.log;
    const oldQty = Number(oldLog.qty) || 0;
    const effectiveId = oldLog.id || logId;

    // 1. Remove from productionLogs
    if (Array.isArray(this.productionLogs)) {
      const pIdx = this.productionLogs.findIndex((l) => (l.id && l.id === effectiveId) || l === oldLog);
      if (pIdx !== -1) {
        this.productionLogs.splice(pIdx, 1);
      }
    }

    // 2. Remove from machine.todayLogs
    const targetMachineId = oldLog.machineId || query.machineId;
    const mach = this.machines.find(
      (m) =>
        m.code === targetMachineId ||
        m.id === targetMachineId ||
        (m.name || '').toLowerCase() === (oldLog.machineName || '').toLowerCase()
    );
    if (mach && Array.isArray(mach.todayLogs)) {
      const mIdx = mach.todayLogs.findIndex(
        (l) => (l.id && l.id === effectiveId) || l === oldLog || (l.timeSlot === oldLog.timeSlot && Number(l.qty) === oldQty)
      );
      if (mIdx !== -1) {
        mach.todayLogs.splice(mIdx, 1);
      }
      mach.todayProduced = mach.todayLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      mach.todayOutput = mach.todayProduced;
    }

    // 3. Loop Insert -> floorProductionQty deduction
    const isLoopInsert =
      (mach?.name || oldLog.machineName || '').toLowerCase().includes('loop insert') ||
      (mach?.name || oldLog.machineName || '').toLowerCase().includes('insert loop') ||
      ((mach?.name || oldLog.machineName || '').toLowerCase().includes('insert') && (mach?.name || '').toLowerCase().includes('loop')) ||
      (mach?.code || targetMachineId || '').toLowerCase() === 'mch-06';

    if (isLoopInsert) {
      const order = this.findLoopOrder(oldLog);
      if (order && order.floorProductionQty !== undefined) {
        order.floorProductionQty = Math.max(0, (Number(order.floorProductionQty) || 0) - oldQty);
      }
    }

    this.save(true);
    return true;
  }

  getDailyProduction(params = {}) {
    const category = params.category || 'Loop';
    const targetDate = params.date || new Date().toISOString().split('T')[0];

    const categoryOrders = this.orders.filter((o) => o.category.toLowerCase() === category.toLowerCase());
    const relevantLogs = (this.productionLogs || []).filter(
      (l) => l.category?.toLowerCase() === category.toLowerCase() && l.date === targetDate
    );

    // Today's Permanent Deliveries (dispatched from Delivery & Received page)
    const todayPermanentDeliveries = (this.deliveryReceivedLogs || []).filter((l) => {
      const matchDate = !l.date || l.date === targetDate;
      const isPermanent = l.type === 'Delivery' && (l.subCategory === 'Permanent' || !l.subCategory);
      return isPermanent && matchDate;
    });
    const todayPermanentTotal = todayPermanentDeliveries.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const tableRows = categoryOrders.map((order) => {
      const orderColour = (order.colour || '').toLowerCase().trim();
      const orderLogs = relevantLogs.filter((l) => {
        const matchPo = l.poNumber === order.poNumber;
        const matchSize = String(l.size) === String(order.size);
        const lColour = (l.colour || '').toLowerCase().trim();
        const matchColour = Boolean(orderColour && lColour && (lColour === orderColour || lColour.includes(orderColour) || orderColour.includes(lColour)));
        return matchSize && (matchColour || (matchPo && !lColour));
      });
      const todayOutput = orderLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      const latestDaily = (order.dailyLogs || []).find((dl) => dl.date === targetDate);
      const dayPlan = latestDaily ? Number(latestDaily.planQty) : Math.round(order.orderQty / 10);

      const numOrderQty = Number(order.orderQty) || 0;
      const numProductionQty = Number(order.productionQty) || 0;
      const numFloorProductionQty = Number(order.floorProductionQty !== undefined ? order.floorProductionQty : order.productionQty) || 0;
      const numDeliveryQty = Number(order.deliveryQty) || 0;
      // Balance allows negative values when actual/delivery exceeds order plan
      const calculatedBalance = numOrderQty - numDeliveryQty;

      // Permanent delivery logged today for this specific order
      const orderDeliveries = todayPermanentDeliveries.filter((l) => {
        const matchPo = l.poNumber === order.poNumber;
        const matchSize = String(l.size) === String(order.size);
        const lColour = (l.colour || '').toLowerCase().trim();
        const matchColour = Boolean(orderColour && lColour && (lColour === orderColour || lColour.includes(orderColour) || orderColour.includes(lColour)));
        return matchSize && (matchColour || (matchPo && !lColour));
      });
      const todayDelivered = orderDeliveries.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

      return {
        id: order.id,
        poNumber: order.poNumber,
        rmMaterial: order.rmMaterial,
        colour: order.colour,
        style: order.style,
        styleCode: order.styleCode,
        size: order.size,
        orderQty: numOrderQty,
        floorProductionQty: numFloorProductionQty,
        productionQty: numProductionQty,
        deliveryQty: numDeliveryQty,
        balanceQty: calculatedBalance,
        todayOutput,
        todayDelivered,
        dayPlan,
        status: order.status,
        logsCount: orderLogs.length,
      };
    });

    const totalOrderQty = categoryOrders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0);
    const totalFloorProductionQty = categoryOrders.reduce(
      (sum, o) => sum + (Number(o.floorProductionQty !== undefined ? o.floorProductionQty : o.productionQty) || 0),
      0
    );
    const totalProductionQty = categoryOrders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0);
    const totalDeliveryQty = categoryOrders.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0);
    const totalBalanceQty = totalOrderQty - totalDeliveryQty;
    const todayTotalOutput = relevantLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    const todayTargetQuota = tableRows.reduce((sum, r) => sum + r.dayPlan, 0);
    const targetAchievementRate = todayTargetQuota > 0 ? Math.round((todayPermanentTotal / todayTargetQuota) * 100) : 0;

    const activeOperators = [...new Set(relevantLogs.map((l) => l.operatorName).filter(Boolean))];
    const activeMachines = [...new Set(relevantLogs.map((l) => l.machineName || l.machineId).filter(Boolean))];

    const hourlyMap = {};
    ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'].forEach((slot) => {
      hourlyMap[slot] = { time: slot, output: 0, target: Math.round(todayTargetQuota / 8) };
    });

    relevantLogs.forEach((log) => {
      const timeStr = log.time || '';
      let slot = '09:00 AM';
      if (timeStr.includes('08:') || timeStr.includes('8:')) slot = '08:00 AM';
      else if (timeStr.includes('09:') || timeStr.includes('9:')) slot = '09:00 AM';
      else if (timeStr.includes('10:')) slot = '10:00 AM';
      else if (timeStr.includes('11:')) slot = '11:00 AM';
      else if (timeStr.includes('12:') || timeStr.includes('00:')) slot = '12:00 PM';
      else if (timeStr.includes('01:') || timeStr.includes('1:')) slot = '01:00 PM';
      else if (timeStr.includes('02:') || timeStr.includes('2:')) slot = '02:00 PM';
      else if (timeStr.includes('03:') || timeStr.includes('3:')) slot = '03:00 PM';
      if (hourlyMap[slot]) {
        hourlyMap[slot].output += Number(log.qty) || 0;
      }
    });

    const hourlyTimeline = Object.values(hourlyMap);
    const sizeMap = {};
    tableRows.forEach((r) => {
      if (!sizeMap[r.size]) {
        sizeMap[r.size] = { size: `Size ${r.size}`, rawSize: r.size, todayOutput: 0, target: 0, orderQty: 0, producedTotal: 0 };
      }
      sizeMap[r.size].todayOutput += r.todayOutput;
      sizeMap[r.size].target += r.dayPlan;
      sizeMap[r.size].orderQty += r.orderQty;
      sizeMap[r.size].producedTotal += r.productionQty;
    });

    const sizeBreakdown = Object.values(sizeMap).sort((a, b) => parseInt(a.rawSize, 10) - parseInt(b.rawSize, 10));

    return {
      category,
      date: targetDate,
      summary: {
        totalOrderQty,
        totalFloorProductionQty,
        totalProductionQty,
        totalDeliveryQty,
        totalBalanceQty,
        todayPermanentTotal,
        todayTotalOutput,
        todayTargetQuota,
        targetAchievementRate,
        activeOperatorsCount: activeOperators.length,
        activeMachinesCount: activeMachines.length,
        totalBatchesToday: relevantLogs.length,
        totalPermanentDispatches: todayPermanentDeliveries.length,
      },
      tableRows,
      charts: {
        hourlyTimeline,
        sizeBreakdown,
      },
      drillDownLogs: relevantLogs,
    };
  }

  getHourlyProduction(params = {}) {
    this.ensureSpecialMachines();
    const { shift = 'Day Shift', machineId = 'All', date } = params;
    const targetDate = (date || new Date().toISOString().split('T')[0]).slice(0, 10);

    const dayShiftSlots = [
      { id: '07:45-08:45', label: '07:45 - 08:45', display: '7.45 - 8.45 AM' },
      { id: '08:45-09:45', label: '08:45 - 09:45', display: '8.45 - 9.45 AM' },
      { id: '09:45-10:45', label: '09:45 - 10:45', display: '9.45 - 10.45 AM' },
      { id: '10:45-11:45', label: '10:45 - 11:45', display: '10.45 - 11.45 AM' },
      { id: '11:45-12:45', label: '11:45 - 12:45', display: '11.45 - 12.45 PM' },
      { id: '12:45-14:15', label: '12:45 - 14:15', display: '12.45 - 2.15 PM' },
      { id: '14:15-15:15', label: '14:15 - 15:15', display: '2.15 - 3.15 PM' },
      { id: '15:15-16:30', label: '15:15 - 16:30', display: '3.15 - 4.30 PM' },
      { id: '16:30-17:30', label: '16:30 - 17:30', display: '4.30 - 5.30 PM' },
      { id: '17:30-18:30', label: '17:30 - 18:30', display: '5.30 - 6.30 PM' },
      { id: '18:30-19:30', label: '18:30 - 19:30', display: '6.30 - 7.30 PM' },
      { id: '19:30-20:30', label: '19:30 - 20:30', display: '7.30 - 8.30 PM' },
      { id: '21:00-21:30', label: '21:00 - 21:30', display: '9.00 - 9.30 PM' },
    ];

    const nightShiftSlots = [
      { id: '21:30-22:30', label: '21:30 - 22:30', display: '9.30 - 10.30 PM' },
      { id: '22:30-23:30', label: '22:30 - 23:30', display: '10.30 - 11.30 PM' },
      { id: '23:30-00:30', label: '23:30 - 00:30', display: '11.30 - 12.30 AM' },
      { id: '00:30-01:30', label: '00:30 - 01:30', display: '12.30 - 1.30 AM' },
      { id: '01:30-02:30', label: '01:30 - 02:30', display: '1.30 - 2.30 AM' },
      { id: '02:30-03:30', label: '02:30 - 03:30', display: '2.30 - 3.30 AM' },
      { id: '03:30-04:30', label: '03:30 - 04:30', display: '3.30 - 4.30 AM' },
      { id: '04:30-05:30', label: '04:30 - 05:30', display: '4.30 - 5.30 AM' },
      { id: '05:30-06:30', label: '05:30 - 06:30', display: '5.30 - 6.30 AM' },
      { id: '06:30-07:30', label: '06:30 - 07:30', display: '6.30 - 7.30 AM' },
    ];

    const isNight = shift === 'Night Shift';
    const activeSlots = isNight ? nightShiftSlots : dayShiftSlots;
    const workingHours = isNight ? 10 : 13;

    const priorityCodes = ['MCH-CUT', 'MCH-PUS', 'MCH-IRN', 'MCH-DRY'];
    let targetMachines = this.machines.filter((m) => {
      if (m.id === 'MCH-CMP' || m.code === 'MCH-CMP' || (m.name || '').toLowerCase().includes('compress')) return false;
      if (machineId !== 'All' && m.id !== machineId && m.code !== machineId) return false;
      return true;
    });

    targetMachines.sort((a, b) => {
      const idxA = priorityCodes.indexOf(a.code || a.id);
      const idxB = priorityCodes.indexOf(b.code || b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    const machineTables = targetMachines.map((m) => {
      const isCutting = (m.name || '').toLowerCase().includes('cutting') || (m.code || '').toLowerCase().includes('cut');
      const isPusing = (m.name || '').toLowerCase().includes('pusing') || (m.code || '').toLowerCase().includes('pus');
      const isIron = (m.name || '').toLowerCase().includes('iron') || (m.code || '').toLowerCase().includes('irn');
      const isDryCut = (m.name || '').toLowerCase().includes('dry cut') || (m.code || '').toLowerCase().includes('dry');
      const isSyncedStrap = false;

      const dailyTarget = Number(m.dailyTargetQty) || 2600;
      const expectedHourlyTarget = Math.round(dailyTarget / workingHours);

      // Find all logs for this machine on targetDate from global productionLogs (authoritative)
      const machineGlobalLogs = (this.productionLogs || []).filter((l) => {
        const matchMach =
          l.machineId === m.id ||
          l.machineId === m.code ||
          (m.name && l.machineName && l.machineName.toLowerCase() === m.name.toLowerCase());
        const lDate = (l.date || l.timestamp || '').slice(0, 10);
        return matchMach && (!targetDate || lDate === targetDate);
      });

      // Also include any matching logs from m.todayLogs if not already in machineGlobalLogs
      const seenIds = new Set(machineGlobalLogs.map((l) => l.id).filter(Boolean));
      const extraLogs = (m.todayLogs || []).filter((l) => {
        if (l.id && seenIds.has(l.id)) return false;
        const lDate = (l.date || l.timestamp || '').slice(0, 10);
        return lDate === targetDate;
      });

      const sourceLogs = [...machineGlobalLogs, ...extraLogs];
      // Ensure all logs have stable unique IDs and machine tags
      sourceLogs.forEach((l, idx) => {
        if (!l.id) {
          l.id = `LOG-${m.code || m.id}-${(l.date || targetDate).replace(/-/g, '')}-${(l.timeSlot || '').replace(/[^0-9]/g, '')}-${idx}`;
        }
        if (!l.machineId) l.machineId = m.code || m.id;
        if (!l.machineName) l.machineName = m.name;
        if (!l.date) l.date = targetDate;
      });

      const shiftLogs = sourceLogs.filter((l) => {
        if (shift !== 'All' && l.shift && l.shift !== shift) return false;
        return true;
      });

      const slotRows = activeSlots.map((slot) => {
        const slotLogs = shiftLogs.filter((l) => {
          const lSlot = (l.timeSlot || '').trim();
          return lSlot === slot.label || lSlot === slot.id || lSlot.replace(/\s+/g, '') === slot.label.replace(/\s+/g, '');
        });

        let rawQty = 0;
        let actualOutput = 0;
        let multiplier = isDryCut ? 50 : 1;
        let workerName = m.operatorName || '-';
        let style = '-';
        let colour = '-';
        let size = '-';
        let notes = '-';

        if (slotLogs.length > 0) {
          const primary = slotLogs[0];
          style = primary.style || (m.assignedStyles && m.assignedStyles[0]) || '-';
          colour = primary.colour || (m.assignedColours && m.assignedColours[0]) || '-';
          size = String(primary.size || (m.assignedSizes && m.assignedSizes[0]) || '-');
          notes = primary.notes || '';

          // Group by worker name to support multi-worker stations (e.g. Insert Loop with ~20 operators)
          const workerMap = {};
          slotLogs.forEach((l) => {
            const wName = l.operator || l.operatorName || workerName;
            const lSize = String(l.size || size).trim();
            let lMult = 1;
            let logActual = 0;
            if (isDryCut) {
              lMult = lSize === '16' ? 45 : 50;
              multiplier = lMult;
              const input = l.rawQty || (l.qty ? Math.round(l.qty / lMult) : 0);
              rawQty += input;
              logActual = l.qty || input * lMult;
              actualOutput += logActual;
            } else {
              rawQty += Number(l.qty) || 0;
              logActual = Number(l.qty) || 0;
              actualOutput += logActual;
            }
            workerMap[wName] = (workerMap[wName] || 0) + logActual;
          });

          const workersList = Object.entries(workerMap).map(([name, qty]) => ({ name, qty }));
          if (workersList.length > 1) {
            workerName = workersList.map((w) => `${w.name}: ${w.qty.toLocaleString()}`).join(' | ');
          } else if (workersList.length === 1) {
            workerName = workersList[0].name;
          }
        }

        const variance = actualOutput - expectedHourlyTarget;
        const variancePct = expectedHourlyTarget > 0 ? Math.round((variance / expectedHourlyTarget) * 100) : 0;

        let status = 'Pending';
        if (actualOutput > 0) {
          if (actualOutput >= expectedHourlyTarget) status = 'Ahead';
          else if (actualOutput >= expectedHourlyTarget * 0.9) status = 'On Track';
          else status = 'Behind Plan';
        }

        return {
          id: slot.id,
          timeSlot: slot.label,
          display: slot.display,
          workerName,
          style,
          colour,
          size,
          isDryCut,
          rawQty,
          multiplier: isDryCut ? multiplier : 1,
          hourlyTarget: expectedHourlyTarget,
          actualOutput,
          variance,
          variancePct,
          status,
          notes,
          entriesCount: slotLogs.length,
          logs: slotLogs,
        };
      });

      const totalProduced = slotRows.reduce((sum, s) => sum + s.actualOutput, 0);
      const totalTarget = dailyTarget;
      const netVariance = totalProduced - totalTarget;
      const achievementRate = totalTarget > 0 ? Math.round((totalProduced / totalTarget) * 100) : 0;

      let specialRule = '';
      if (isCutting) specialRule = 'Strap Division Cutting Unit';
      else if (isPusing) specialRule = 'Strap Division Pusing Unit';
      else if (isIron) specialRule = 'Strap Division Steam Ironing & Thermal Curing Bed';
      else if (isDryCut) specialRule = '⚡ Dry Cut Multiplier: Sz 10/12/14/18 (×50), Sz 16 (×45)';

      return {
        id: m.id || m.code,
        code: m.code || m.id,
        name: m.name,
        type: m.type,
        category: m.category,
        operatorName: m.operatorName,
        shift: m.shift || shift,
        dailyTargetQty: dailyTarget,
        workingHours,
        expectedHourlyTarget,
        isCutting,
        isPusing,
        isIron,
        isCompress: false,
        isSyncedStrap: false,
        isDryCut,
        specialRule,
        slots: slotRows,
        totals: {
          totalTarget,
          totalProduced,
          netVariance,
          achievementRate,
        },
      };
    });

    const totalHourlyOutput = machineTables.reduce((sum, mt) => sum + mt.totals.totalProduced, 0);
    const totalTargetQuota = machineTables.reduce((sum, mt) => sum + mt.totals.totalTarget, 0);
    const overallNetVariance = totalHourlyOutput - totalTargetQuota;

    // Build Summary Matrix for Summary View table
    const summaryMatrix = machineTables.map((mt) => {
      const loggedColours = [...new Set(mt.slots.map((s) => s.colour).filter((c) => c && c !== '-'))];
      const loggedSizes = [...new Set(mt.slots.map((s) => s.size).filter((sz) => sz && sz !== '-'))];

      const machineRaw = targetMachines.find((m) => m.code === mt.code || m.id === mt.id) || mt;
      const colour = loggedColours.length > 0
        ? loggedColours.join(', ')
        : (machineRaw.assignedColours && machineRaw.assignedColours[0]) || '-';

      const size = loggedSizes.length > 0
        ? loggedSizes.join(', ')
        : (machineRaw.assignedSizes && machineRaw.assignedSizes.join(', ')) || '-';

      const slotOutputs = {};
      mt.slots.forEach((s) => {
        slotOutputs[s.id] = {
          qty: s.actualOutput,
          workerName: s.workerName,
          status: s.status,
          logs: s.logs || [],
          slotLabel: s.timeSlot,
        };
      });

      return {
        id: mt.id,
        code: mt.code,
        name: mt.name,
        category: mt.category,
        operatorName: mt.operatorName,
        colour,
        size,
        slotOutputs,
        totalProduced: mt.totals.totalProduced,
        dailyTarget: mt.totals.totalTarget,
        variance: mt.totals.netVariance,
        achievementRate: mt.totals.achievementRate,
      };
    });

    // Flatten all individual logs for targetDate to display in Log History view
    const allLogs = [];
    machineTables.forEach((mt) => {
      mt.slots.forEach((s) => {
        (s.logs || []).forEach((l) => {
          allLogs.push({
            ...l,
            machineId: mt.code || mt.id,
            machineName: mt.name,
            operatorName: l.operator || l.operatorName || mt.operatorName || 'Floor Worker',
            unit: (mt.name || '').toLowerCase().includes('cutting') || (mt.name || '').toLowerCase().includes('fusing') || (mt.name || '').toLowerCase().includes('iron') ? 'Straps' : 'pcs',
          });
        });
      });
    });

    return {
      date: targetDate,
      shift,
      workingHours,
      slots: activeSlots,
      summary: {
        totalHourlyOutput,
        totalTargetQuota,
        overallNetVariance,
        activeMachinesCount: machineTables.length,
      },
      summaryMatrix,
      machines: machineTables,
      allLogs,
    };
  }

  // Delivery & Received Multi-Step Workflow Engine
  recordDeliveryReceived(payload) {
    const {
      type = 'Delivery', // 'Delivery' | 'Received'
      subCategory = 'Outsource', // 'Outsource' | 'Permanent' | 'Internal'
      outsourcePartner = null, // 'Saroja' | 'Anoja' | 'Iresh'
      poNumber,
      colour,
      size,
      qty = 0,
      items = [],
      notes = '',
      handlerName = 'Dispatcher',
    } = payload;

    const todayStr = (payload.date || new Date().toISOString().split('T')[0]).slice(0, 10);
    const createdLogs = [];

    const entries = Array.isArray(items) && items.length > 0
      ? items
      : [{ size, qty, colour, poNumber }];

    for (const item of entries) {
      const targetPo = item.poNumber || poNumber;
      const targetColour = item.colour || colour;
      const targetSize = String(item.size || size || '').trim();
      const numQty = Math.max(1, Number(item.qty || qty) || 0);

      // Find matching order by PO #, Colour, Size
      const order = this.orders.find((o) => {
        const matchPo = o.poNumber === targetPo || o.id === targetPo;
        const matchColour = !targetColour || (o.colour || '').toLowerCase() === targetColour.toLowerCase();
        const matchSize = !targetSize || String(o.size).trim() === targetSize;
        return matchPo && matchColour && matchSize;
      }) || this.orders.find((o) => o.poNumber === targetPo);

      let calculationEffect = '';
      let dayTargetDeduction = 0;
      let balanceDeduction = 0;

      if (type === 'Delivery') {
        if (subCategory === 'Outsource') {
          // 1. Outsource Delivery: Deduct from day's target. Does NOT reduce factory production qty or order balance qty!
          // Goods are processed externally and must return to the plant. Consignment is opened in Received page.
          dayTargetDeduction = numQty;
          if (order) {
            order.dayTargetDeduction = (Number(order.dayTargetDeduction) || 0) + numQty;
          }
          const consignment = {
            id: `OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            dispatchDate: todayStr,
            dispatchTimestamp: new Date().toISOString(),
            partner: outsourcePartner || 'Saroja',
            poNumber: order ? order.poNumber : targetPo,
            colour: order ? order.colour : (targetColour || 'All'),
            size: order ? String(order.size) : (targetSize || 'All'),
            sentQty: numQty,
            receivedQty: 0,
            remainingQty: numQty,
            status: 'Pending Return',
            handlerName,
            notes: notes || `Outsource batch sent to ${outsourcePartner || 'Partner'}`,
            receiveHistory: [],
          };
          if (!this.outsourceConsignments) this.outsourceConsignments = [];
          this.outsourceConsignments.unshift(consignment);
          calculationEffect = `Deducted ${numQty.toLocaleString()} pcs from Day's Target. Consignment #${consignment.id} opened for ${outsourcePartner || 'Partner'} (Pending Return in Received page)`;
        } else if (subCategory === 'Permanent') {
          // Permanent Delivery increases Actual/Invoiced & reduces Balance to produce
          balanceDeduction = numQty;
          if (order) {
            order.productionQty = (Number(order.productionQty) || 0) + numQty;
            order.deliveryQty = (Number(order.deliveryQty) || 0) + numQty;
            order.balanceQty = (Number(order.orderQty) || 0) - order.deliveryQty;
            order.deliveryBalanceQty = order.balanceQty;

            if (order.balanceQty <= 0) {
              order.status = 'Completed';
            } else if (order.productionQty >= (Number(order.orderQty) || 0) * 0.9) {
              order.status = 'Ahead';
            } else {
              order.status = 'Behind Plan';
            }

            if (!order.dailyLogs) order.dailyLogs = [];
            order.dailyLogs.push({
              date: todayStr,
              planQty: 0,
              actualQty: 0,
              deliveryQty: numQty,
              notes: `Permanent Dispatch (${numQty} pcs)`,
            });
          }
          calculationEffect = `Deducted ${numQty.toLocaleString()} pcs from Remaining Balance (Remaining Balance: ${order ? order.balanceQty.toLocaleString() : 'N/A'} pcs, Total Delivered: ${order ? order.deliveryQty.toLocaleString() : 'N/A'} pcs)`;
        }
      } else {
        // Received Flow
        calculationEffect = `Received ${numQty.toLocaleString()} pcs into warehouse from ${outsourcePartner || 'Partner'}`;
      }

      const logEntry = {
        id: `DLR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        subCategory: type === 'Delivery' ? subCategory : 'Received',
        outsourcePartner: outsourcePartner || (type === 'Received' ? payload.receivedSource || 'Supplier' : null),
        poNumber: order ? order.poNumber : targetPo,
        colour: order ? order.colour : (targetColour || 'All'),
        size: order ? String(order.size) : (targetSize || 'All'),
        qty: numQty,
        calculationEffect,
        dayTargetDeduction,
        balanceDeduction,
        productQtyAfter: order ? order.productionQty : null,
        systemBalanceAfter: order ? order.balanceQty : null,
        orderStatusAfter: order ? order.status : null,
        date: todayStr,
        timestamp: new Date().toISOString(),
        handlerName,
        notes: notes || '',
      };

      if (!this.deliveryReceivedLogs) this.deliveryReceivedLogs = [];
      this.deliveryReceivedLogs.unshift(logEntry);
      createdLogs.push(logEntry);
    }

    this.save(true);

    return {
      success: true,
      message: `${type} transaction recorded successfully!`,
      logs: createdLogs,
    };
  }

  // Outsource Consignments Query (Pending Returns on Received page)
  getOutsourceConsignments(params = {}) {
    const { partner = 'All', status = 'All', search = '' } = params;
    let list = this.outsourceConsignments || [];

    if (partner !== 'All') {
      list = list.filter((c) => (c.partner || '').toLowerCase() === partner.toLowerCase());
    }
    if (status !== 'All') {
      list = list.filter((c) => (c.status || '').toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.poNumber || '').toLowerCase().includes(q) ||
        (c.partner || '').toLowerCase().includes(q) ||
        (c.colour || '').toLowerCase().includes(q) ||
        (c.size || '').toLowerCase().includes(q) ||
        (c.id || '').toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      data: list,
      totalCount: list.length,
      pendingCount: (this.outsourceConsignments || []).filter((c) => c.status !== 'Completed').length,
    };
  }

  // Confirm receipt of returned outsource pieces (handles partial deliveries)
  receiveOutsourceConsignment(id, data = {}) {
    if (!id) return { success: false, message: 'Missing consignment ID' };
    const consignment = (this.outsourceConsignments || []).find((c) => c.id === id);
    if (!consignment) {
      return { success: false, message: `Outsource consignment '${id}' not found` };
    }

    const returnQty = Math.max(1, Number(data.receivedQty || data.qty) || 0);
    const handler = data.handlerName || 'Store Inbound';
    const noteText = data.notes || '';
    const todayStr = (data.date || new Date().toISOString().split('T')[0]).slice(0, 10);

    consignment.receivedQty = (Number(consignment.receivedQty) || 0) + returnQty;
    consignment.remainingQty = Math.max(0, (Number(consignment.sentQty) || 0) - consignment.receivedQty);
    consignment.status = consignment.remainingQty === 0 ? 'Completed' : 'Partially Received';

    if (!consignment.receiveHistory) consignment.receiveHistory = [];
    consignment.receiveHistory.push({
      date: todayStr,
      timestamp: new Date().toISOString(),
      qty: returnQty,
      handlerName: handler,
      notes: noteText,
    });

    // Automatically record Received transaction in audit ledger
    const rcvLog = {
      id: `DLR-RCV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'Received',
      subCategory: 'Outsource Return',
      outsourcePartner: consignment.partner,
      poNumber: consignment.poNumber,
      colour: consignment.colour,
      size: consignment.size,
      qty: returnQty,
      calculationEffect: `Received ${returnQty.toLocaleString()} pcs returned from ${consignment.partner} (Remaining pending: ${consignment.remainingQty.toLocaleString()} pcs)`,
      dayTargetDeduction: 0,
      balanceDeduction: 0,
      productQtyAfter: null,
      systemBalanceAfter: null,
      orderStatusAfter: null,
      date: todayStr,
      timestamp: new Date().toISOString(),
      handlerName: handler,
      notes: noteText || `Return against consignment #${consignment.id}`,
    };

    if (!this.deliveryReceivedLogs) this.deliveryReceivedLogs = [];
    this.deliveryReceivedLogs.unshift(rcvLog);

    this.save(true);

    return {
      success: true,
      message: `Confirmed receipt of ${returnQty.toLocaleString()} pcs from ${consignment.partner}!`,
      consignment,
      log: rcvLog,
    };
  }

  getDeliveryReceivedLogs(params = {}) {
    const {
      type = 'All',
      subCategory = 'All',
      partner = 'All',
      poNumber = '',
      search = '',
      limit = 100,
    } = params;

    let list = this.deliveryReceivedLogs || [];

    if (type !== 'All') {
      list = list.filter((l) => l.type.toLowerCase() === type.toLowerCase());
    }
    if (subCategory !== 'All') {
      list = list.filter((l) => (l.subCategory || '').toLowerCase() === subCategory.toLowerCase());
    }
    if (partner !== 'All') {
      list = list.filter((l) => (l.outsourcePartner || '').toLowerCase() === partner.toLowerCase());
    }
    if (poNumber) {
      list = list.filter((l) => l.poNumber === poNumber);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (l.poNumber || '').toLowerCase().includes(q) ||
        (l.colour || '').toLowerCase().includes(q) ||
        (l.size || '').toLowerCase().includes(q) ||
        (l.outsourcePartner || '').toLowerCase().includes(q) ||
        (l.handlerName || '').toLowerCase().includes(q)
      );
    }

    // Summary calculations
    const allLogs = this.deliveryReceivedLogs || [];
    const targetDate = (params.date || new Date().toISOString().split('T')[0]).slice(0, 10);
    const dateLogs = allLogs.filter((l) => (l.date || l.timestamp || '').slice(0, 10) === targetDate);

    const outsourceDeliveredToday = dateLogs
      .filter((l) => l.type === 'Delivery' && l.subCategory === 'Outsource')
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const permanentDeliveredToday = dateLogs
      .filter((l) => l.type === 'Delivery' && l.subCategory === 'Permanent')
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const totalReceivedToday = dateLogs
      .filter((l) => l.type === 'Received')
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const partnerBreakdown = {
      Saroja: dateLogs.filter((l) => l.outsourcePartner === 'Saroja').reduce((sum, l) => sum + Number(l.qty), 0),
      Anoja: dateLogs.filter((l) => l.outsourcePartner === 'Anoja').reduce((sum, l) => sum + Number(l.qty), 0),
      Iresh: dateLogs.filter((l) => l.outsourcePartner === 'Iresh').reduce((sum, l) => sum + Number(l.qty), 0),
    };

    return {
      success: true,
      logs: list.slice(0, Number(limit) || 100),
      totalLogs: list.length,
      targetDate,
      summary: {
        outsourceDeliveredToday,
        permanentDeliveredToday,
        totalReceivedToday,
        partnerBreakdown,
      },
    };
  }

  deleteDeliveryReceived(id) {
    if (!id) return { success: false, message: 'Missing transaction ID' };
    const index = (this.deliveryReceivedLogs || []).findIndex((l) => l.id === id);
    if (index === -1) {
      return { success: false, message: `Transaction with ID '${id}' not found` };
    }

    const log = this.deliveryReceivedLogs[index];
    const qty = Number(log.qty) || 0;

    // Find the associated order
    const order = this.orders.find((o) => {
      const matchPo = o.poNumber === log.poNumber || o.id === log.poNumber;
      const matchColour = !log.colour || (o.colour || '').toLowerCase() === (log.colour || '').toLowerCase();
      const matchSize = !log.size || String(o.size).trim() === String(log.size).trim();
      return matchPo && matchColour && matchSize;
    }) || this.orders.find((o) => o.poNumber === log.poNumber);

    if (order) {
      if (log.type === 'Delivery') {
        if (log.subCategory === 'Outsource') {
          // Reverse day target deduction
          order.dayTargetDeduction = Math.max(0, (Number(order.dayTargetDeduction) || 0) - qty);
          const cIdx = (this.outsourceConsignments || []).findIndex((c) => c.poNumber === log.poNumber && c.sentQty === qty && c.receivedQty === 0);
          if (cIdx !== -1) this.outsourceConsignments.splice(cIdx, 1);
        } else if (log.subCategory === 'Permanent') {
          // Reverse permanent delivery deduction and production
          order.productionQty = (Number(order.productionQty) || 0) - qty;
          order.deliveryQty = (Number(order.deliveryQty) || 0) - qty;
          order.balanceQty = (Number(order.orderQty) || 0) - order.deliveryQty;
          order.deliveryBalanceQty = order.balanceQty;

          if (order.balanceQty <= 0) {
            order.status = 'Completed';
          } else if (order.productionQty >= (Number(order.orderQty) || 0) * 0.9) {
            order.status = 'Ahead';
          } else {
            order.status = 'Behind Plan';
          }

          if (order.dailyLogs) {
            const dlIdx = order.dailyLogs.findIndex(
              (l) => l.deliveryQty === qty && (l.notes || '').includes('Permanent Dispatch')
            );
            if (dlIdx !== -1) order.dailyLogs.splice(dlIdx, 1);
          }
        }
      }
    }

    this.deliveryReceivedLogs.splice(index, 1);
    this.save(true);

    return {
      success: true,
      message: `Transaction #${id} successfully deleted and balance impacts reversed.`,
      reversedQty: qty,
      order,
    };
  }

  updateDeliveryReceived(id, updateData = {}) {
    if (!id) return { success: false, message: 'Missing transaction ID' };
    const log = (this.deliveryReceivedLogs || []).find((l) => l.id === id);
    if (!log) {
      return { success: false, message: `Transaction with ID '${id}' not found` };
    }

    const oldQty = Number(log.qty) || 0;
    const newQty = updateData.qty !== undefined ? Math.max(1, Number(updateData.qty) || 0) : oldQty;
    const newPartner = updateData.outsourcePartner !== undefined ? updateData.outsourcePartner : log.outsourcePartner;
    const newHandler = updateData.handlerName !== undefined ? updateData.handlerName : log.handlerName;
    const newNotes = updateData.notes !== undefined ? updateData.notes : log.notes;
    const newSubCategory = updateData.subCategory !== undefined ? updateData.subCategory : log.subCategory;

    const order = this.orders.find((o) => {
      const matchPo = o.poNumber === log.poNumber || o.id === log.poNumber;
      const matchColour = !log.colour || (o.colour || '').toLowerCase() === (log.colour || '').toLowerCase();
      const matchSize = !log.size || String(o.size).trim() === String(log.size).trim();
      return matchPo && matchColour && matchSize;
    }) || this.orders.find((o) => o.poNumber === log.poNumber);

    if (order) {
      // 1. Revert previous impact
      if (log.type === 'Delivery') {
        if (log.subCategory === 'Outsource') {
          order.dayTargetDeduction = Math.max(0, (Number(order.dayTargetDeduction) || 0) - oldQty);
        } else if (log.subCategory === 'Permanent') {
          order.productionQty = (Number(order.productionQty) || 0) - oldQty;
          order.deliveryQty = (Number(order.deliveryQty) || 0) - oldQty;
          order.balanceQty = (Number(order.orderQty) || 0) - order.deliveryQty;
          order.deliveryBalanceQty = order.balanceQty;
        }
      }

      // 2. Apply new impact
      if (log.type === 'Delivery') {
        if (newSubCategory === 'Outsource') {
          order.dayTargetDeduction = (Number(order.dayTargetDeduction) || 0) + newQty;
          log.calculationEffect = `Deducted ${newQty.toLocaleString()} pcs from Day's Target (${newPartner || 'Outsource'})`;
        } else if (newSubCategory === 'Permanent') {
          order.productionQty = (Number(order.productionQty) || 0) + newQty;
          order.deliveryQty = (Number(order.deliveryQty) || 0) + newQty;
          order.balanceQty = (Number(order.orderQty) || 0) - order.deliveryQty;
          order.deliveryBalanceQty = order.balanceQty;

          if (order.balanceQty <= 0) {
            order.status = 'Completed';
          } else if (order.productionQty >= (Number(order.orderQty) || 0) * 0.9) {
            order.status = 'Ahead';
          } else {
            order.status = 'Behind Plan';
          }

          log.calculationEffect = `Deducted ${newQty.toLocaleString()} pcs from Remaining Balance (Remaining Balance: ${order.balanceQty.toLocaleString()} pcs, Total Delivered: ${order.deliveryQty.toLocaleString()} pcs)`;
        }
      }
    }

    if (updateData.date) {
      log.date = String(updateData.date).slice(0, 10);
    }
    log.qty = newQty;
    log.outsourcePartner = newPartner;
    log.handlerName = newHandler;
    log.notes = newNotes;
    log.subCategory = newSubCategory;
    log.systemBalanceAfter = order ? order.balanceQty : null;
    log.productQtyAfter = order ? order.productionQty : null;
    log.orderStatusAfter = order ? order.status : null;

    this.save(true);

    return {
      success: true,
      message: `Transaction #${id} updated and calculation impacts synchronized!`,
      log,
      order,
    };
  }

  // =========================================================================
  // PRODUCTION PLANNING & AI SCHEDULING ENGINE METHODS
  // =========================================================================
  saveProductionPlan(plan) {
    if (!plan || !plan.id) return { success: false, message: 'Invalid plan' };
    if (!this.productionPlans) this.productionPlans = [];
    const idx = this.productionPlans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) {
      this.productionPlans[idx] = plan;
    } else {
      this.productionPlans.unshift(plan);
    }
    this.save(true);
    return { success: true, plan };
  }

  getActiveProductionPlan(filter = {}) {
    if (!this.productionPlans || this.productionPlans.length === 0) return null;
    if (filter.orderId) {
      return this.productionPlans.find((p) => p.orderId === filter.orderId) || null;
    }
    if (filter.poNumber) {
      return this.productionPlans.find((p) => p.poNumber === filter.poNumber) || null;
    }
    return this.productionPlans[0];
  }

  getMachineHistoricalAverage(machineId) {
    const targetLogs = (this.productionLogs || []).filter(
      (l) => l.machineId === machineId || l.machineCode === machineId
    );
    if (targetLogs.length === 0) {
      const m = (this.machines || []).find((m) => m.id === machineId || m.code === machineId);
      return m?.dailyTargetQty || 2600;
    }
    // Group logs by unique dates
    const dateMap = {};
    targetLogs.forEach((l) => {
      const d = l.date || (l.timestamp ? l.timestamp.split('T')[0] : 'today');
      dateMap[d] = (dateMap[d] || 0) + (Number(l.qty) || 0);
    });
    const daysCount = Object.keys(dateMap).length;
    if (daysCount === 0) return 2600;
    const totalQty = Object.values(dateMap).reduce((a, b) => a + b, 0);
    return Math.round(totalQty / daysCount);
  }

  getMachineDayStats(machineId, dateStr = new Date().toISOString().split('T')[0]) {
    const machine = (this.machines || []).find((m) => m.id === machineId || m.code === machineId);
    const dayLogs = (this.productionLogs || []).filter(
      (l) => (l.machineId === machineId || l.machineCode === machineId) && l.date === dateStr
    );
    const todayProduced = dayLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    // Look for active plan target for this day & machine
    let plannedTarget = machine?.dailyTargetQty || 2600;
    const activePlan = this.getActiveProductionPlan();
    if (activePlan && Array.isArray(activePlan.scheduleDays)) {
      const scheduleDay = activePlan.scheduleDays.find((sd) => sd.date === dateStr);
      if (scheduleDay && Array.isArray(scheduleDay.machinePlans)) {
        const mPlan = scheduleDay.machinePlans.find(
          (mp) => mp.machineId === machineId || mp.machineCode === machineId
        );
        if (mPlan && mPlan.dailyTarget > 0) {
          plannedTarget = mPlan.dailyTarget;
        }
      }
    }

    const remainingQty = Math.max(0, plannedTarget - todayProduced);
    const historicalAverage = this.getMachineHistoricalAverage(machineId);

    return {
      machine,
      date: dateStr,
      todayProduced,
      dailyTarget: plannedTarget,
      remainingQty,
      historicalAverage,
      logs: dayLogs,
    };
  }

  // =========================================================================
  // PRODUCTION INVENTORY & STOREKEEPER APPROVAL WORKFLOW ENGINE
  // =========================================================================

  getInventoryItems(filters = {}) {
    let items = Array.isArray(this.inventoryItems) ? [...this.inventoryItems] : [];

    if (filters.category && filters.category !== 'All') {
      const catLower = filters.category.toLowerCase();
      items = items.filter((i) => (i.category || '').toLowerCase() === catLower);
    }

    if (filters.search) {
      const s = filters.search.toLowerCase().trim();
      items = items.filter(
        (i) =>
          (i.name || '').toLowerCase().includes(s) ||
          (i.code || '').toLowerCase().includes(s) ||
          (i.category || '').toLowerCase().includes(s) ||
          (i.location || '').toLowerCase().includes(s) ||
          (i.supplier || '').toLowerCase().includes(s)
      );
    }

    if (filters.status) {
      if (filters.status === 'Low') {
        items = items.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel);
      } else if (filters.status === 'Out') {
        items = items.filter((i) => i.currentStock <= 0);
      } else if (filters.status === 'InStock') {
        items = items.filter((i) => i.currentStock > i.reorderLevel);
      }
    }

    const allItems = this.inventoryItems || [];
    const pendingRequests = (this.materialRequests || []).filter((r) => r.status === 'Pending');

    const summary = {
      totalItems: allItems.length,
      inStockCount: allItems.filter((i) => i.currentStock > i.reorderLevel).length,
      lowStockCount: allItems.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel).length,
      outOfStockCount: allItems.filter((i) => i.currentStock <= 0).length,
      totalPendingRequests: pendingRequests.length,
    };

    return {
      items,
      summary,
      totalCount: items.length,
    };
  }

  getInventoryItemById(id) {
    return (this.inventoryItems || []).find((i) => i.id === id || i.code === id) || null;
  }

  async addInventoryItem(itemData) {
    if (!itemData || !itemData.name) {
      throw new Error('Material name is required');
    }
    if (!this.inventoryItems) this.inventoryItems = [];

    const newId = `INV-${String(this.inventoryItems.length + 1).padStart(3, '0')}`;
    const code = itemData.code?.trim() || `RM-${(itemData.category || 'GEN').slice(0, 2).toUpperCase()}-${String(Date.now()).slice(-4)}`;
    const currentStock = Math.max(0, Number(itemData.currentStock) || 0);
    const reorderLevel = Math.max(0, Number(itemData.reorderLevel) || 0);

    const newItem = {
      id: newId,
      code,
      name: itemData.name.trim(),
      category: itemData.category || 'Other',
      unit: itemData.unit || 'Units',
      currentStock,
      reorderLevel,
      location: itemData.location?.trim() || 'Warehouse Main Bay',
      supplier: itemData.supplier?.trim() || 'Bondtex Store Supplier',
      notes: itemData.notes?.trim() || '',
      lastUpdated: new Date().toISOString(),
    };

    this.inventoryItems.unshift(newItem);

    // Initial audit log
    if (currentStock > 0) {
      if (!this.inventoryLogs) this.inventoryLogs = [];
      this.inventoryLogs.unshift({
        id: `LOG-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: 'Item_Created',
        itemId: newItem.id,
        itemCode: newItem.code,
        itemName: newItem.name,
        qtyChange: currentStock,
        balanceBefore: 0,
        balanceAfter: currentStock,
        unit: newItem.unit,
        referenceId: 'INIT-STOCK',
        performedBy: itemData.createdBy || 'Storekeeper',
        department: 'Store Warehouse',
        notes: `Initial registration of ${newItem.name} with ${currentStock} ${newItem.unit}`,
      });
    }

    if (typeof fetch !== 'undefined') {
      await firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs);
    }
    await this.save(true);
    return { success: true, item: newItem };
  }

  async updateInventoryItem(id, updates) {
    const item = (this.inventoryItems || []).find((i) => i.id === id || i.code === id);
    if (!item) throw new Error(`Inventory item ${id} not found`);

    if (updates.name !== undefined) item.name = updates.name.trim();
    if (updates.code !== undefined) item.code = updates.code.trim();
    if (updates.category !== undefined) item.category = updates.category;
    if (updates.unit !== undefined) item.unit = updates.unit;
    if (updates.reorderLevel !== undefined) item.reorderLevel = Math.max(0, Number(updates.reorderLevel) || 0);
    if (updates.location !== undefined) item.location = (updates.location || '').trim();
    if (updates.supplier !== undefined) item.supplier = (updates.supplier || '').trim();
    if (updates.notes !== undefined) item.notes = (updates.notes || '').trim();
    item.lastUpdated = new Date().toISOString();

    if (!this.inventoryLogs) this.inventoryLogs = [];
    this.inventoryLogs.unshift({
      id: `LOG-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: 'Item_Updated',
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      qtyChange: 0,
      balanceBefore: item.currentStock,
      balanceAfter: item.currentStock,
      unit: item.unit,
      referenceId: 'EDIT-DETAILS',
      performedBy: updates.updatedBy || 'Storekeeper',
      department: 'Store Warehouse',
      notes: `Updated item details for ${item.name}`,
    });

    if (typeof fetch !== 'undefined') {
      await firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs);
    }
    await this.save(true);
    return { success: true, item };
  }

  async deleteInventoryItem(id) {
    const idx = (this.inventoryItems || []).findIndex((i) => i.id === id || i.code === id);
    if (idx === -1) throw new Error(`Inventory item ${id} not found`);
    const removed = this.inventoryItems[idx];
    this.inventoryItems.splice(idx, 1);

    if (!this.inventoryLogs) this.inventoryLogs = [];
    this.inventoryLogs.unshift({
      id: `LOG-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: 'Item_Deleted',
      itemId: removed.id,
      itemCode: removed.code,
      itemName: removed.name,
      qtyChange: -removed.currentStock,
      balanceBefore: removed.currentStock,
      balanceAfter: 0,
      unit: removed.unit,
      referenceId: 'DELETE-ITEM',
      performedBy: 'Storekeeper',
      department: 'Store Warehouse',
      notes: `Deleted raw material ${removed.name} (${removed.code}) from store inventory`,
    });

    if (typeof fetch !== 'undefined') {
      await Promise.allSettled([
        firebaseRealtime.deleteInventoryItem(removed.id),
        firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs),
      ]);
    }
    await this.save(true);
    return { success: true, item: removed };
  }

  async adjustInventoryStock(id, { adjustmentQty, type = 'Restock', notes = '', performedBy = 'Storekeeper' }) {
    const item = (this.inventoryItems || []).find((i) => i.id === id || i.code === id);
    if (!item) throw new Error(`Inventory item ${id} not found`);

    const delta = Number(adjustmentQty);
    if (isNaN(delta) || delta === 0) {
      throw new Error('Valid non-zero adjustment quantity is required');
    }

    const balanceBefore = Number(item.currentStock) || 0;
    const balanceAfter = Math.max(0, balanceBefore + delta);

    item.currentStock = balanceAfter;
    item.lastUpdated = new Date().toISOString();

    if (!this.inventoryLogs) this.inventoryLogs = [];
    const log = {
      id: `LOG-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: type || (delta > 0 ? 'Restock' : 'Adjustment'),
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      qtyChange: delta,
      balanceBefore,
      balanceAfter,
      unit: item.unit,
      referenceId: notes || 'STOCK-ADJUSTMENT',
      performedBy: performedBy || 'Storekeeper',
      department: 'Store Warehouse',
      notes: notes || `${type} of ${delta > 0 ? '+' : ''}${delta} ${item.unit} by ${performedBy}`,
    };
    this.inventoryLogs.unshift(log);

    if (typeof fetch !== 'undefined') {
      await firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs);
    }
    await this.save(true);
    return { success: true, item, log };
  }

  getMaterialRequests(filters = {}) {
    let requests = Array.isArray(this.materialRequests) ? [...this.materialRequests] : [];

    if (filters.status && filters.status !== 'All') {
      requests = requests.filter((r) => r.status === filters.status);
    }

    if (filters.search) {
      const s = filters.search.toLowerCase().trim();
      requests = requests.filter(
        (r) =>
          (r.id || '').toLowerCase().includes(s) ||
          (r.itemName || '').toLowerCase().includes(s) ||
          (r.itemCode || '').toLowerCase().includes(s) ||
          (r.requesterName || '').toLowerCase().includes(s) ||
          (r.department || '').toLowerCase().includes(s) ||
          (r.machineCode || '').toLowerCase().includes(s) ||
          (r.poNumber || '').toLowerCase().includes(s)
      );
    }

    if (filters.itemId) {
      requests = requests.filter((r) => r.itemId === filters.itemId);
    }

    // Sort newest first
    requests.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    return {
      requests,
      totalCount: requests.length,
      pendingCount: requests.filter((r) => r.status === 'Pending').length,
      approvedCount: requests.filter((r) => r.status === 'Approved').length,
      rejectedCount: requests.filter((r) => r.status === 'Rejected').length,
    };
  }

  async createMaterialRequest(requestData) {
    if (!this.materialRequests) this.materialRequests = [];

    const item = (this.inventoryItems || []).find(
      (i) => i.id === requestData.itemId || i.code === requestData.itemCode
    );

    if (!item) {
      throw new Error('Selected raw material item was not found in store inventory');
    }

    const requestedQty = Number(requestData.requestedQty);
    if (!requestedQty || requestedQty <= 0) {
      throw new Error('Please enter a valid requested quantity greater than 0');
    }

    const nextSeq = this.materialRequests.length + 1001;
    const reqId = `REQ-${nextSeq}`;

    const newRequest = {
      id: reqId,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      requestedQty,
      productionCycle: requestData.productionCycle || '2-Hour Standard Cycle',
      requesterName: requestData.requesterName?.trim() || 'Floor Operator',
      requesterEmpId: requestData.requesterEmpId?.trim() || '',
      department: requestData.department || 'Production Line',
      machineCode: requestData.machineCode || '',
      poNumber: requestData.poNumber?.trim() || '',
      purpose: requestData.purpose?.trim() || 'Material request for 2-hour production cycle',
      timestamp: new Date().toISOString(),
      status: 'Pending', // STRICT: Always pending until Storekeeper approval!
    };

    // STRICT: Do NOT deduct inventory stock here!
    this.materialRequests.unshift(newRequest);
    if (typeof fetch !== 'undefined') {
      await firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs);
    }
    await this.save(true);

    return {
      success: true,
      data: newRequest,
      message: `Material Request #${reqId} submitted! Waiting for storekeeper approval.`,
    };
  }

  async approveMaterialRequest(requestId, { approvedBy = 'Storekeeper', notes = '' } = {}) {
    const request = (this.materialRequests || []).find((r) => r.id === requestId);
    if (!request) {
      throw new Error(`Material Request #${requestId} not found`);
    }

    if (request.status !== 'Pending') {
      throw new Error(`Request #${requestId} has already been processed (Status: ${request.status})`);
    }

    const item = (this.inventoryItems || []).find((i) => i.id === request.itemId);
    if (!item) {
      throw new Error(`Inventory item for request #${requestId} not found`);
    }

    const requestedQty = Number(request.requestedQty) || 0;
    if (item.currentStock < requestedQty) {
      throw new Error(
        `Insufficient store stock! Available balance: ${item.currentStock} ${item.unit}, Requested: ${requestedQty} ${item.unit}. Cannot approve.`
      );
    }

    // STRICT LOGIC: Deduct requested quantity from store inventory only upon explicit approval!
    const stockBefore = Number(item.currentStock) || 0;
    item.currentStock = Math.max(0, stockBefore - requestedQty);
    const stockAfter = item.currentStock;
    item.lastUpdated = new Date().toISOString();

    // Mark request as Approved
    request.status = 'Approved';
    request.approvedAt = new Date().toISOString();
    request.approvedBy = approvedBy || 'Storekeeper';
    request.approvalNotes = notes || '';
    request.stockBefore = stockBefore;
    request.stockAfter = stockAfter;

    // Log the transaction
    if (!this.inventoryLogs) this.inventoryLogs = [];
    const log = {
      id: `LOG-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: 'Approved_Request',
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      qtyChange: -requestedQty,
      balanceBefore: stockBefore,
      balanceAfter: stockAfter,
      unit: item.unit,
      referenceId: request.id,
      performedBy: approvedBy || 'Storekeeper',
      department: request.department || 'Production Line',
      notes: notes || `Approved 2-hour cycle request #${request.id} for ${request.requesterName} (${request.productionCycle || ''})`,
    };
    this.inventoryLogs.unshift(log);

    if (typeof fetch !== 'undefined') {
      await firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs);
    }
    await this.save(true);

    return {
      success: true,
      request,
      item,
      log,
      message: `Request #${request.id} approved! Deducted ${requestedQty} ${item.unit} from ${item.name}. New balance: ${stockAfter} ${item.unit}.`,
    };
  }

  async rejectMaterialRequest(requestId, { rejectedBy = 'Storekeeper', reason = 'Declined by storekeeper' } = {}) {
    const request = (this.materialRequests || []).find((r) => r.id === requestId);
    if (!request) {
      throw new Error(`Material Request #${requestId} not found`);
    }

    if (request.status !== 'Pending') {
      throw new Error(`Request #${requestId} has already been processed (Status: ${request.status})`);
    }

    // STRICT: Stock is NOT deducted
    request.status = 'Rejected';
    request.rejectedAt = new Date().toISOString();
    request.rejectedBy = rejectedBy || 'Storekeeper';
    request.rejectionReason = reason || 'Declined by storekeeper';

    if (!this.inventoryLogs) this.inventoryLogs = [];
    const log = {
      id: `LOG-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: 'Rejected_Request',
      itemId: request.itemId,
      itemCode: request.itemCode,
      itemName: request.itemName,
      qtyChange: 0,
      balanceBefore: null,
      balanceAfter: null,
      unit: request.unit,
      referenceId: request.id,
      performedBy: rejectedBy || 'Storekeeper',
      department: request.department || 'Production Line',
      notes: `Rejected request #${request.id} (${request.requestedQty} ${request.unit}) - Reason: ${reason}`,
    };
    this.inventoryLogs.unshift(log);

    if (typeof fetch !== 'undefined') {
      await firebaseRealtime.pushInventory(this.inventoryItems, this.materialRequests, this.inventoryLogs);
    }
    await this.save(true);

    return {
      success: true,
      request,
      log,
      message: `Request #${request.id} rejected. No stock was deducted.`,
    };
  }

  getInventoryLogs(filters = {}) {
    let logs = Array.isArray(this.inventoryLogs) ? [...this.inventoryLogs] : [];

    if (filters.itemId) {
      logs = logs.filter((l) => l.itemId === filters.itemId);
    }

    if (filters.type && filters.type !== 'All') {
      logs = logs.filter((l) => l.type === filters.type);
    }

    if (filters.search) {
      const s = filters.search.toLowerCase().trim();
      logs = logs.filter(
        (l) =>
          (l.itemName || '').toLowerCase().includes(s) ||
          (l.itemCode || '').toLowerCase().includes(s) ||
          (l.referenceId || '').toLowerCase().includes(s) ||
          (l.performedBy || '').toLowerCase().includes(s) ||
          (l.department || '').toLowerCase().includes(s) ||
          (l.notes || '').toLowerCase().includes(s)
      );
    }

    logs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    return {
      logs,
      totalCount: logs.length,
    };
  }
}

export const dbStore = new ClientDatabaseStore();
export default dbStore;
