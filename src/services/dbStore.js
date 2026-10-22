// Client-side Reactive Production Database Engine for Bondtex MES
// Provides instant offline/browser storage and real-time synchronization with Firebase Firestore.
import {
  initialCategories,
  rawProductionRows,
  initialMachines,
  initialWorkers,
  initialOrders,
  initialProductionLogs,
} from '../data/seedData.js';
import { firestoreSync } from '../firebase.js';

const STORAGE_KEY = 'bondtex_production_db_v4';

class ClientDatabaseStore {
  constructor() {
    this.categories = [];
    this.orders = [];
    this.machines = [];
    this.workers = [];
    this.productionLogs = [];
    this.init();
  }

  init() {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        this.categories = parsed.categories?.length ? parsed.categories : JSON.parse(JSON.stringify(initialCategories));
        this.orders = parsed.orders?.length ? parsed.orders : JSON.parse(JSON.stringify(initialOrders));
        this.machines = parsed.machines?.length ? parsed.machines : JSON.parse(JSON.stringify(initialMachines));
        this.workers = parsed.workers?.length ? parsed.workers : JSON.parse(JSON.stringify(initialWorkers));
        this.productionLogs = Array.isArray(parsed.productionLogs) ? parsed.productionLogs : [];
      } else {
        this.reset();
      }
    } catch {
      this.reset();
    }
    this.ensureSpecialMachines();
  }

  save() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            categories: this.categories,
            orders: this.orders,
            machines: this.machines,
            workers: this.workers,
            productionLogs: this.productionLogs,
            lastSaved: new Date().toISOString(),
          })
        );
      }
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  reset() {
    this.categories = JSON.parse(JSON.stringify(initialCategories));
    this.orders = JSON.parse(JSON.stringify(initialOrders));
    this.machines = JSON.parse(JSON.stringify(initialMachines));
    this.workers = JSON.parse(JSON.stringify(initialWorkers));
    this.productionLogs = [];
    this.ensureSpecialMachines();
    this.save();
    return { success: true, count: this.orders.length };
  }

  ensureSpecialMachines() {
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
        assignedStyles: ['Strap Webbing Band - 39H6', 'Strap Bonded Band - 39H6'],
        assignedColours: ['Marzipan 39H6', 'Black 093 54A2'],
        assignedSizes: ['10', '12', '14', '16', '18'],
        assignedPos: ['4502991532', '4502991538'],
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
        assignedStyles: ['Strap Webbing Band - 39H6', 'Strap Bonded Band - 39H6'],
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
        assignedStyles: ['Strap Webbing Band - 39H6', 'Strap Bonded Band - 39H6'],
        assignedColours: ['Marzipan 39H6'],
        assignedSizes: ['10', '12', '14', '16', '18'],
        assignedPos: ['4502991532'],
        qrPayload: 'MCH-IRN',
        notes: 'Thermal curing bed (Synchronized with Compress Machine for Strap)',
        todayLogs: [],
      },
      {
        id: 'MCH-CMP',
        code: 'MCH-CMP',
        name: 'Compress Machine',
        type: 'High-Tension Hydraulic Strap Compressor',
        category: 'Strap',
        operatorName: 'Kamal Gunaratne',
        shift: 'Day Shift',
        status: 'Active',
        dailyTargetQty: 2600,
        assignedStyles: ['Strap Webbing Band - 39H6', 'Strap Bonded Band - 39H6'],
        assignedColours: ['Marzipan 39H6'],
        assignedSizes: ['10', '12', '14', '16', '18'],
        assignedPos: ['4502991532'],
        qrPayload: 'MCH-CMP',
        notes: 'Hydraulic strap compressor (Synchronized with Iron Machine for Strap)',
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
        assignedStyles: ['Strap Webbing Band - 39H6', 'Strap Bonded Band - 39H6'],
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
  }

  // Categories summary calculation
  getCategoriesSummary() {
    return this.categories.map((cat) => {
      const catOrders = this.orders.filter((o) => o.category.toLowerCase() === cat.id.toLowerCase());
      const orderQty = catOrders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0);
      const productionQty = catOrders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0);
      const deliveryQty = catOrders.reduce((sum, o) => sum + (Number(o.deliveryQty) || 0), 0);
      const balanceQty = Math.max(0, orderQty - productionQty);
      const deliveryBalanceQty = Math.max(0, orderQty - deliveryQty);

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
    const totalBalanceQty = Math.max(0, totalOrderQty - totalProductionQty);
    const totalDeliveryBalance = Math.max(0, totalOrderQty - totalDeliveryQty);

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
    order.balanceQty = Math.max(0, order.orderQty - order.productionQty);
    order.deliveryBalanceQty = Math.max(0, order.orderQty - order.deliveryQty);

    if (order.balanceQty === 0) order.status = 'Completed';
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

  submitWorkerProduction(data) {
    const { machineId, style, size, colour, producedQty, poNumber, shift, operatorName, timeSlot, notes } = data;
    const qty = Number(producedQty) || 0;
    if (qty <= 0) throw new Error('Produced quantity must be greater than 0');

    const machine = this.getMachineById(machineId);
    if (!machine) throw new Error(`Machine '${machineId}' not found`);

    const isDryCut = (machine.name || '').toLowerCase().includes('dry cut') || (machine.code || '').toLowerCase().includes('dry');
    let multiplier = 1;
    let rawQty = qty;
    let effectiveQty = qty;

    if (isDryCut) {
      const sz = String(size || '').trim();
      multiplier = sz === '16' ? 45 : 50;
      effectiveQty = rawQty * multiplier;
    }

    let matchedOrder = null;
    if (poNumber) {
      matchedOrder = this.orders.find((o) => o.poNumber === poNumber && String(o.size) === String(size));
    }
    if (!matchedOrder && style && size) {
      matchedOrder = this.orders.find(
        (o) => (o.style === style || o.styleCode === style) && String(o.size) === String(size) && (!colour || o.colour === colour)
      );
    }
    if (!matchedOrder && size) {
      matchedOrder = this.orders.find((o) => String(o.size) === String(size) && o.category.toLowerCase() === machine.category.toLowerCase());
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (matchedOrder) {
      matchedOrder.productionQty += effectiveQty;
      matchedOrder.balanceQty = Math.max(0, matchedOrder.orderQty - matchedOrder.productionQty);

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

      if (matchedOrder.balanceQty === 0) matchedOrder.status = 'Completed';
      else if (matchedOrder.productionQty >= matchedOrder.orderQty * 0.9) matchedOrder.status = 'Ahead';
    }

    const logEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
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

    // Synchronize Iron Machine & Compress Machine for Strap Workflow
    const isIron = (machine.name || '').toLowerCase().includes('iron') || (machine.code || '').toLowerCase().includes('irn');
    const isCompress = (machine.name || '').toLowerCase().includes('compress') || (machine.code || '').toLowerCase().includes('cmp');

    if ((isIron || isCompress) && (machine.category === 'Strap' || !machine.category)) {
      const peerCode = isIron ? 'MCH-CMP' : 'MCH-IRN';
      const peerMachine = this.machines.find((m) => m.code === peerCode || m.id === peerCode);
      if (peerMachine) {
        if (!peerMachine.todayLogs) peerMachine.todayLogs = [];
        peerMachine.todayLogs.unshift({
          ...logEntry,
          id: `LOG-SYNC-${Date.now()}`,
          notes: `${notes || 'Strap workflow log'} [Synced from ${machine.name}]`,
        });
      }
    }

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

  getDailyProduction(params = {}) {
    const category = params.category || 'Loop';
    const targetDate = params.date || new Date().toISOString().split('T')[0];

    const categoryOrders = this.orders.filter((o) => o.category.toLowerCase() === category.toLowerCase());
    const relevantLogs = (this.productionLogs || []).filter(
      (l) => l.category?.toLowerCase() === category.toLowerCase() && l.date === targetDate
    );

    const tableRows = categoryOrders.map((order) => {
      const orderLogs = relevantLogs.filter((l) => l.poNumber === order.poNumber && String(l.size) === String(order.size));
      const todayOutput = orderLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      const latestDaily = (order.dailyLogs || []).find((dl) => dl.date === targetDate);
      const dayPlan = latestDaily ? Number(latestDaily.planQty) : Math.round(order.orderQty / 10);

      return {
        id: order.id,
        poNumber: order.poNumber,
        rmMaterial: order.rmMaterial,
        colour: order.colour,
        style: order.style,
        styleCode: order.styleCode,
        size: order.size,
        orderQty: order.orderQty,
        productionQty: order.productionQty,
        balanceQty: order.balanceQty,
        todayOutput,
        dayPlan,
        status: order.status,
        logsCount: orderLogs.length,
      };
    });

    const totalOrderQty = categoryOrders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0);
    const totalProductionQty = categoryOrders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0);
    const totalBalanceQty = Math.max(0, totalOrderQty - totalProductionQty);
    const todayTotalOutput = relevantLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    const todayTargetQuota = tableRows.reduce((sum, r) => sum + r.dayPlan, 0);
    const targetAchievementRate = todayTargetQuota > 0 ? Math.round((todayTotalOutput / todayTargetQuota) * 100) : 0;

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
        totalProductionQty,
        totalBalanceQty,
        todayTotalOutput,
        todayTargetQuota,
        targetAchievementRate,
        activeOperatorsCount: activeOperators.length,
        activeMachinesCount: activeMachines.length,
        totalBatchesToday: relevantLogs.length,
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
    const { shift = 'Day Shift', machineId = 'All' } = params;

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

    const priorityCodes = ['MCH-CUT', 'MCH-PUS', 'MCH-IRN', 'MCH-CMP', 'MCH-DRY'];
    let targetMachines = this.machines.filter((m) => {
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

    const ironAndCompressLogs = [];
    const ironMach = this.machines.find((m) => (m.name || '').toLowerCase().includes('iron'));
    const cmpMach = this.machines.find((m) => (m.name || '').toLowerCase().includes('compress'));

    if (ironMach && ironMach.todayLogs) ironAndCompressLogs.push(...ironMach.todayLogs);
    if (cmpMach && cmpMach.todayLogs) {
      cmpMach.todayLogs.forEach((l) => {
        if (!ironAndCompressLogs.some((e) => e.timeSlot === l.timeSlot && e.qty === l.qty && e.size === l.size)) {
          ironAndCompressLogs.push(l);
        }
      });
    }

    const machineTables = targetMachines.map((m) => {
      const isCutting = (m.name || '').toLowerCase().includes('cutting') || (m.code || '').toLowerCase().includes('cut');
      const isPusing = (m.name || '').toLowerCase().includes('pusing') || (m.code || '').toLowerCase().includes('pus');
      const isIron = (m.name || '').toLowerCase().includes('iron') || (m.code || '').toLowerCase().includes('irn');
      const isCompress = (m.name || '').toLowerCase().includes('compress') || (m.code || '').toLowerCase().includes('cmp');
      const isDryCut = (m.name || '').toLowerCase().includes('dry cut') || (m.code || '').toLowerCase().includes('dry');
      const isSyncedStrap = isIron || isCompress;

      const dailyTarget = Number(m.dailyTargetQty) || 2600;
      const expectedHourlyTarget = Math.round(dailyTarget / workingHours);

      let sourceLogs = isSyncedStrap ? ironAndCompressLogs : m.todayLogs || [];
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
          workerName = primary.operator || primary.operatorName || workerName;
          style = primary.style || (m.assignedStyles && m.assignedStyles[0]) || '-';
          colour = primary.colour || (m.assignedColours && m.assignedColours[0]) || '-';
          size = String(primary.size || (m.assignedSizes && m.assignedSizes[0]) || '-');
          notes = primary.notes || '';

          slotLogs.forEach((l) => {
            const lSize = String(l.size || size).trim();
            let lMult = 1;
            if (isDryCut) {
              lMult = lSize === '16' ? 45 : 50;
              multiplier = lMult;
              const input = l.rawQty || (l.qty ? Math.round(l.qty / lMult) : 0);
              rawQty += input;
              actualOutput += l.qty || input * lMult;
            } else {
              rawQty += Number(l.qty) || 0;
              actualOutput += Number(l.qty) || 0;
            }
          });
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
        };
      });

      const totalProduced = slotRows.reduce((sum, s) => sum + s.actualOutput, 0);
      const totalTarget = dailyTarget;
      const netVariance = totalProduced - totalTarget;
      const achievementRate = totalTarget > 0 ? Math.round((totalProduced / totalTarget) * 100) : 0;

      let specialRule = '';
      if (isCutting) specialRule = 'Strap Division Cutting Unit';
      else if (isPusing) specialRule = 'Strap Division Pusing Unit';
      else if (isIron) specialRule = '🔗 Synced with Compress Machine (Strap Workflow)';
      else if (isCompress) specialRule = '🔗 Synced with Iron Machine (Strap Workflow)';
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
        isCompress,
        isSyncedStrap,
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

    return {
      shift,
      workingHours,
      summary: {
        totalHourlyOutput,
        totalTargetQuota,
        overallNetVariance,
        activeMachinesCount: machineTables.length,
      },
      machines: machineTables,
    };
  }
}

export const dbStore = new ClientDatabaseStore();
export default dbStore;
