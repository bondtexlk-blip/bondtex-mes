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
} from '../data/seedData.js';
import { firestoreSync, firebaseRealtime } from '../firebase.js';

const STORAGE_KEY = 'bondtex_loop_real_v9';
const VAULT_KEY = 'bondtex_permanent_vault_backup';
const OLD_STORAGE_KEYS = ['bondtex_loop_real_v9', 'bondtex_loop_real_v8', 'bondtex_loop_real_v7'];

class ClientDatabaseStore {
  constructor() {
    this.categories = [];
    this.orders = [];
    this.machines = [];
    this.workers = [];
    this.productionLogs = JSON.parse(JSON.stringify(initialProductionLogs));
    this.deliveryReceivedLogs = JSON.parse(JSON.stringify(initialDeliveryReceivedLogs));
    this.outsourceConsignments = [];
    this.productionPlans = [];
    this.subscribers = [];
    this.lastSaved = null;
    this.deviceId = 'srv';
    this.init();
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

  notifySubscribers() {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Subscriber callback notification error:', err);
      }
    });
  }

  // Apply real-time cloud state pushed from Firebase Realtime Database
  applyCloudState(cloudState) {
    if (!cloudState) return;
    if (cloudState.lastUpdated && cloudState.lastUpdated === this.lastSaved) return;

    // Multi-Device Data Protection & Anti-Downgrade Guard:
    // Ensures no older device, reset script, or transient sync ever regresses factory production progress
    const localTotProd = (this.orders || []).reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0);
    const cloudTotProd = Array.isArray(cloudState.orders)
      ? cloudState.orders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0)
      : 0;

    if (Array.isArray(cloudState.orders) && cloudState.orders.length > 0) {
      if (cloudTotProd >= localTotProd) {
        // Cloud state has equal or greater verified production -> accept cloud orders
        this.orders = cloudState.orders;
      } else {
        // DANGER GUARD ACTIVATED: Cloud payload has LESS production than local state!
        // Never clobber or wipe factory floor progress! Safe-merge orders preserving maximum progress.
        const mergedOrders = this.orders.map((localOrd) => {
          const cloudOrd = cloudState.orders.find((co) => co.id === localOrd.id);
          if (!cloudOrd) return localOrd;
          return {
            ...cloudOrd,
            ...localOrd,
            productionQty: Math.max(Number(localOrd.productionQty) || 0, Number(cloudOrd.productionQty) || 0),
            deliveryQty: Math.max(Number(localOrd.deliveryQty) || 0, Number(cloudOrd.deliveryQty) || 0),
            floorProductionQty: Math.max(Number(localOrd.floorProductionQty) || 0, Number(cloudOrd.floorProductionQty) || 0),
            dailyLogs: (localOrd.dailyLogs && localOrd.dailyLogs.length >= (cloudOrd.dailyLogs?.length || 0))
              ? localOrd.dailyLogs
              : (cloudOrd.dailyLogs || []),
          };
        });
        cloudState.orders.forEach((co) => {
          if (!mergedOrders.some((mo) => mo.id === co.id)) {
            mergedOrders.push(co);
          }
        });
        this.orders = mergedOrders;

        // Auto-heal cloud database by re-broadcasting higher ground truth
        setTimeout(() => {
          this.save(true);
        }, 600);
      }
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
    if (Array.isArray(cloudState.productionLogs) && cloudState.productionLogs.length > 0) {
      const existingLogIds = new Set((this.productionLogs || []).map((l) => l.id));
      const newLogs = cloudState.productionLogs.filter((l) => !existingLogIds.has(l.id));
      this.productionLogs = [...(this.productionLogs || []), ...newLogs];
    }
    if (Array.isArray(cloudState.deliveryReceivedLogs) && cloudState.deliveryReceivedLogs.length > 0) {
      const existingDelIds = new Set((this.deliveryReceivedLogs || []).map((l) => l.id));
      const newLogs = cloudState.deliveryReceivedLogs.filter((l) => !existingDelIds.has(l.id));
      this.deliveryReceivedLogs = [...(this.deliveryReceivedLogs || []), ...newLogs];
    }
    if (Array.isArray(cloudState.outsourceConsignments)) {
      this.outsourceConsignments = cloudState.outsourceConsignments;
    }
    if (Array.isArray(cloudState.productionPlans)) {
      this.productionPlans = cloudState.productionPlans;
    }

    this.ensureSpecialMachines();
    this.ensureOrderCalculations();
    this.lastSaved = cloudState.lastUpdated || new Date().toISOString();

    if (typeof window !== 'undefined') {
      try {
        const payloadStr = JSON.stringify({
          categories: this.categories,
          orders: this.orders,
          machines: this.machines,
          workers: this.workers,
          productionLogs: this.productionLogs,
          deliveryReceivedLogs: this.deliveryReceivedLogs,
          outsourceConsignments: this.outsourceConsignments || [],
          productionPlans: this.productionPlans || [],
          lastSaved: this.lastSaved,
        });
        localStorage.setItem(STORAGE_KEY, payloadStr);
        localStorage.setItem(VAULT_KEY, payloadStr);
      } catch {
        // ignore storage quota errors
      }
    }

    this.notifySubscribers();
  }

  init() {
    this.subscribers = [];
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

    try {
      let parsed = null;
      if (typeof window !== 'undefined') {
        const rawPrimary = localStorage.getItem(STORAGE_KEY);
        if (rawPrimary) {
          try { parsed = JSON.parse(rawPrimary); } catch {}
        }
        if (!parsed || !Array.isArray(parsed.orders) || parsed.orders.length === 0) {
          const rawVault = localStorage.getItem(VAULT_KEY);
          if (rawVault) {
            try { parsed = JSON.parse(rawVault); } catch {}
          }
        }
        if (!parsed || !Array.isArray(parsed.orders) || parsed.orders.length === 0) {
          for (const key of OLD_STORAGE_KEYS) {
            try {
              const rawOld = localStorage.getItem(key);
              if (rawOld) {
                const oldObj = JSON.parse(rawOld);
                if (Array.isArray(oldObj.orders) && oldObj.orders.length > 0) {
                  parsed = oldObj;
                  break;
                }
              }
            } catch {}
          }
        }
      }

      if (parsed && Array.isArray(parsed.orders) && parsed.orders.length > 0) {
        this.categories = Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : JSON.parse(JSON.stringify(initialCategories));
        this.orders = parsed.orders;
        this.machines = (Array.isArray(parsed.machines) ? parsed.machines : JSON.parse(JSON.stringify(initialMachines)))
          .filter((m) => m.id !== 'MCH-CMP' && m.code !== 'MCH-CMP' && !((m.name || '').toLowerCase().includes('compress')));
        this.workers = Array.isArray(parsed.workers) ? parsed.workers : JSON.parse(JSON.stringify(initialWorkers));
        this.productionLogs = Array.isArray(parsed.productionLogs) && parsed.productionLogs.length ? parsed.productionLogs : JSON.parse(JSON.stringify(initialProductionLogs));
        this.deliveryReceivedLogs = Array.isArray(parsed.deliveryReceivedLogs) && parsed.deliveryReceivedLogs.length ? parsed.deliveryReceivedLogs : JSON.parse(JSON.stringify(initialDeliveryReceivedLogs));
        this.outsourceConsignments = Array.isArray(parsed.outsourceConsignments) ? parsed.outsourceConsignments : [];
        this.productionPlans = Array.isArray(parsed.productionPlans) ? parsed.productionPlans : [];
        this.lastSaved = parsed.lastSaved || null;
      } else {
        this.reset(false);
      }
    } catch {
      this.reset(false);
    }
    this.ensureSpecialMachines();
    this.ensureOrderCalculations();

    // Connect to Firebase Realtime Database for live cross-device sync (Laptop <-> Phone)
    if (typeof window !== 'undefined') {
      // 1. Initial Cloud Pull (ensures phone or laptop always opens with latest cloud data)
      firebaseRealtime
        .pullState()
        .then((cloudState) => {
          if (cloudState && Array.isArray(cloudState.orders) && cloudState.orders.length > 0) {
            this.applyCloudState(cloudState);
          }
        })
        .catch(() => {});

      // 2. Realtime SSE Listener (when laptop saves, phone updates immediately in real-time)
      this.unsubscribeCloud = firebaseRealtime.listenToChanges((cloudState) => {
        if (cloudState && cloudState.lastDeviceId !== this.deviceId) {
          this.applyCloudState(cloudState);
        }
      });
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
      if (o.balanceQty <= 0) {
        o.status = 'Completed';
      } else if (o.deliveryQty >= o.orderQty * 0.9) {
        o.status = 'Ahead';
      } else if (o.deliveryQty === 0) {
        o.status = 'Scheduled';
      } else {
        o.status = 'Behind Plan';
      }
    });
  }

  save(broadcastToCloud = true) {
    try {
      this.ensureOrderCalculations();
      const nowIso = new Date().toISOString();
      this.lastSaved = nowIso;

      const payload = {
        categories: this.categories,
        orders: this.orders,
        machines: this.machines,
        workers: this.workers,
        productionLogs: this.productionLogs,
        deliveryReceivedLogs: this.deliveryReceivedLogs,
        outsourceConsignments: this.outsourceConsignments || [],
        productionPlans: this.productionPlans || [],
        lastSaved: nowIso,
        lastUpdated: nowIso,
        lastDeviceId: this.deviceId,
      };

      if (typeof window !== 'undefined') {
        try {
          const payloadStr = JSON.stringify(payload);
          localStorage.setItem(STORAGE_KEY, payloadStr);
          localStorage.setItem(VAULT_KEY, payloadStr);
        } catch {
          // ignore quota
        }
      }

      // Automatically broadcast state to Firebase Realtime Database
      if (broadcastToCloud && typeof window !== 'undefined') {
        firebaseRealtime.pushState(payload);
        firebaseRealtime.pushSnapshot(payload);
      }

      this.notifySubscribers();
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  reset(broadcastToCloud = true) {
    this.categories = JSON.parse(JSON.stringify(initialCategories));
    this.orders = JSON.parse(JSON.stringify(initialOrders));
    this.machines = JSON.parse(JSON.stringify(initialMachines));
    this.workers = JSON.parse(JSON.stringify(initialWorkers));
    this.productionLogs = JSON.parse(JSON.stringify(initialProductionLogs));
    this.deliveryReceivedLogs = JSON.parse(JSON.stringify(initialDeliveryReceivedLogs));
    this.outsourceConsignments = [];
    this.productionPlans = [];
    this.ensureSpecialMachines();
    this.save(broadcastToCloud);
    return { success: true, count: this.orders.length };
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
    const newOrder = {
      id: `ORD-${String(nextIdx).padStart(3, '0')}`,
      poNumber: orderData.poNumber || `450299${1500 + nextIdx}`,
      rmMaterial: orderData.rmMaterial || '200150259454A2',
      colour: orderData.colour || 'Standard Black',
      size: String(orderData.size || '10'),
      category: orderData.category || 'Loop',
      style: orderData.style || 'Loop Elastic Band',
      styleCode: orderData.styleCode || 'LP-NEW',
      barcode: `BTX-${orderData.poNumber || nextIdx}-${orderData.size || '10'}`,
      orderQty: Number(orderData.orderQty) || 10000,
      productionQty: 0,
      deliveryQty: 0,
      balanceQty: Number(orderData.orderQty) || 10000,
      deliveryBalanceQty: Number(orderData.orderQty) || 10000,
      startDate: new Date().toISOString().split('T')[0],
      targetDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'Scheduled',
      priority: orderData.priority || 'Normal',
      dailyLogs: [],
    };
    this.orders.unshift(newOrder);
    this.save();
    firestoreSync.saveDocument('orders', newOrder.id, newOrder);
    return newOrder;
  }

  addDailyLog(orderId, logData) {
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
    this.save();
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
    this.save();
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
    this.save();
    return true;
  }

  submitWorkerProduction(data) {
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

    this.save();
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
    this.save();
    firestoreSync.saveDocument('workers', newWorker.id, newWorker);
    return newWorker;
  }

  updateWorker(id, workerData) {
    const index = this.workers.findIndex((w) => w.id === id || w.empId === id);
    if (index === -1) return null;
    this.workers[index] = { ...this.workers[index], ...workerData };
    this.save();
    firestoreSync.saveDocument('workers', this.workers[index].id, this.workers[index]);
    return this.workers[index];
  }

  deleteWorker(id) {
    const index = this.workers.findIndex((w) => w.id === id || w.empId === id);
    if (index === -1) return false;
    this.workers.splice(index, 1);
    this.save();
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

    this.save();
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

    this.save();
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

    this.save();

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

    this.save();

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
    this.save();

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

    this.save();

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
    this.save();
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
}

export const dbStore = new ClientDatabaseStore();
export default dbStore;
