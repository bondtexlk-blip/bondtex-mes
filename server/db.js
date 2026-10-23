import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initialCategories,
  initialOrders,
  initialMachines,
  initialWorkers,
  initialProductionLogs,
} from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'production_data.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class ProductionDatabase {
  constructor() {
    this.categories = [];
    this.orders = [];
    this.machines = [];
    this.workers = [];
    this.productionLogs = [];
    this.deliveryReceivedLogs = [];
    this.outsourceConsignments = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.categories = Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : JSON.parse(JSON.stringify(initialCategories));
        this.orders = Array.isArray(parsed.orders) ? parsed.orders : JSON.parse(JSON.stringify(initialOrders));
        this.machines = Array.isArray(parsed.machines) ? parsed.machines : JSON.parse(JSON.stringify(initialMachines));
        this.workers = Array.isArray(parsed.workers) ? parsed.workers : JSON.parse(JSON.stringify(initialWorkers));
        this.productionLogs = Array.isArray(parsed.productionLogs) ? parsed.productionLogs : JSON.parse(JSON.stringify(initialProductionLogs));
        this.deliveryReceivedLogs = Array.isArray(parsed.deliveryReceivedLogs) ? parsed.deliveryReceivedLogs : [];
        this.outsourceConsignments = Array.isArray(parsed.outsourceConsignments) ? parsed.outsourceConsignments : [];
        this.ensureSpecialMachines();
        this.ensureOrderCalculations();
      } else {
        this.reset();
      }
    } catch (err) {
      console.error('Error loading production data, falling back to seed:', err);
      this.reset();
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

  save() {
    try {
      this.ensureOrderCalculations();
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
          {
            categories: this.categories,
            orders: this.orders,
            machines: this.machines,
            workers: this.workers,
            productionLogs: this.productionLogs,
            deliveryReceivedLogs: this.deliveryReceivedLogs,
            outsourceConsignments: this.outsourceConsignments || [],
            lastUpdated: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  reset() {
    this.categories = JSON.parse(JSON.stringify(initialCategories));
    this.orders = JSON.parse(JSON.stringify(initialOrders));
    this.machines = JSON.parse(JSON.stringify(initialMachines));
    this.workers = JSON.parse(JSON.stringify(initialWorkers));
    this.productionLogs = JSON.parse(JSON.stringify(initialProductionLogs));
    this.deliveryReceivedLogs = [];
    this.ensureSpecialMachines();
    // Ensure all machines start with clean empty logs
    this.machines.forEach((m) => {
      m.todayLogs = [];
    });
    this.save();
    return {
      success: true,
      count: this.orders.length,
      machinesCount: this.machines.length,
      workersCount: this.workers.length,
      logsCount: this.productionLogs.length,
    };
  }

  // Category summary calculation
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

      // Aggregated daily plan vs actual for this category
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

  // Detailed single category metric
  getCategoryDetails(categoryId) {
    const categories = this.getCategoriesSummary();
    const target = categories.find((c) => c.id.toLowerCase() === categoryId.toLowerCase());
    if (!target) return null;

    const catOrders = this.orders.filter((o) => o.category.toLowerCase() === categoryId.toLowerCase());

    // Style breakdown
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

  // Overall factory metrics
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

  // Get orders with rich filtering including PO #, RM Material, Colour, Size, Style, Category
  getOrders(params = {}) {
    let result = [...this.orders];

    const {
      search,
      poNumber,
      rmMaterial,
      colour,
      category,
      style,
      size,
      startDate,
      endDate,
      status,
      sortBy = 'poNumber',
      sortOrder = 'asc',
      page,
      limit,
    } = params;

    // Search by PO Number, Barcode, RM Material, Colour, or Style
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

    // Direct PO # filter
    if (poNumber && poNumber.toLowerCase() !== 'all') {
      result = result.filter((o) => o.poNumber && o.poNumber.toLowerCase() === poNumber.toLowerCase());
    }

    // RM Material filter
    if (rmMaterial && rmMaterial.toLowerCase() !== 'all') {
      result = result.filter((o) => o.rmMaterial && o.rmMaterial.toLowerCase() === rmMaterial.toLowerCase());
    }

    // Colour filter
    if (colour && colour.toLowerCase() !== 'all') {
      result = result.filter((o) => o.colour && o.colour.toLowerCase() === colour.toLowerCase());
    }

    // Category filter
    if (category && category.toLowerCase() !== 'all') {
      result = result.filter((o) => o.category.toLowerCase() === category.toLowerCase());
    }

    // Style filter
    if (style && style.toLowerCase() !== 'all') {
      result = result.filter(
        (o) =>
          (o.styleCode && o.styleCode.toLowerCase() === style.toLowerCase()) ||
          (o.style && o.style.toLowerCase().includes(style.toLowerCase()))
      );
    }

    // Size filter (exact numerical match like '10', '12', '14', '16', '18')
    if (size && size.toLowerCase() !== 'all') {
      result = result.filter((o) => o.size && o.size.toLowerCase() === size.toLowerCase());
    }

    // Status filter
    if (status && status.toLowerCase() !== 'all') {
      result = result.filter((o) => o.status.toLowerCase() === status.toLowerCase());
    }

    // Date range filter
    if (startDate) {
      result = result.filter((o) => {
        const orderStart = o.startDate || '';
        return orderStart >= startDate;
      });
    }

    if (endDate) {
      result = result.filter((o) => {
        const orderEnd = o.targetDate || '';
        return orderEnd <= endDate;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB || '', undefined, { numeric: true });
        return sortOrder === 'desc' ? -cmp : cmp;
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    const totalCount = result.length;

    // Optional Pagination
    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const startIndex = (pageNum - 1) * limitNum;
      result = result.slice(startIndex, startIndex + limitNum);

      return {
        orders: result,
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      };
    }

    return {
      orders: result,
      total: totalCount,
    };
  }

  getOrderById(id) {
    if (!id) return null;
    const clean = id.trim().toLowerCase();
    return (
      this.orders.find(
        (o) =>
          o.id.toLowerCase() === clean ||
          o.poNumber.toLowerCase() === clean ||
          (o.barcode && o.barcode.toLowerCase() === clean)
      ) || null
    );
  }

  addOrder(orderData) {
    const id = `ORD-${String(this.orders.length + 1).padStart(3, '0')}`;
    const poNumber = orderData.poNumber || `450299${Math.floor(1500 + Math.random() * 150)}`;
    const category = orderData.category || 'Other';
    const size = String(orderData.size || '12');
    const barcode = orderData.barcode || `BTX-${poNumber}-${size}`;

    const orderQty = Number(orderData.orderQty) || 0;
    const productionQty = Number(orderData.productionQty) || 0;
    const deliveryQty = Number(orderData.deliveryQty) || 0;
    const balanceQty = orderQty - productionQty;
    const deliveryBalanceQty = orderQty - deliveryQty;

    const newOrder = {
      id,
      poNumber,
      rmMaterial: orderData.rmMaterial || '200150259454A2',
      colour: orderData.colour || 'Black 093 54A2',
      barcode,
      category,
      style: orderData.style || 'Custom Style',
      styleCode: orderData.styleCode || orderData.style?.split(' ')[0] || 'STY-001',
      size,
      orderQty,
      productionQty,
      deliveryQty,
      balanceQty,
      deliveryBalanceQty,
      startDate: orderData.startDate || new Date().toISOString().split('T')[0],
      targetDate: orderData.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: orderData.status || 'On Track',
      priority: orderData.priority || 'Medium',
      dailyLogs: orderData.dailyLogs || [],
    };

    this.orders.unshift(newOrder);
    this.save();
    return newOrder;
  }

  addDailyLog(orderId, logEntry) {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    if (!order.dailyLogs) {
      order.dailyLogs = [];
    }

    const planQty = Number(logEntry.planQty) || 0;
    const actualQty = Number(logEntry.actualQty) || 0;
    const deliveryQty = Number(logEntry.deliveryQty) || 0;

    order.dailyLogs.push({
      date: logEntry.date || new Date().toISOString().split('T')[0],
      planQty,
      actualQty,
      deliveryQty,
      notes: logEntry.notes || '',
    });

    order.productionQty += actualQty;
    order.deliveryQty += deliveryQty;
    order.balanceQty = order.orderQty - order.productionQty;
    order.deliveryBalanceQty = order.orderQty - order.deliveryQty;

    if (order.balanceQty <= 0) {
      order.status = 'Completed';
    } else if (actualQty < planQty * 0.85) {
      order.status = 'Behind Plan';
    } else if (actualQty > planQty * 1.05) {
      order.status = 'Ahead';
    } else {
      order.status = 'On Track';
    }

    this.save();
    return order;
  }

  // Barcode / PO lookup
  lookupBarcode(code) {
    if (!code) return null;
    const clean = code.trim().toLowerCase();
    return this.orders.find(
      (o) =>
        (o.barcode && o.barcode.toLowerCase() === clean) ||
        (o.poNumber && o.poNumber.toLowerCase() === clean) ||
        (o.rmMaterial && o.rmMaterial.toLowerCase() === clean)
    );
  }

  // Dynamic filter metadata strictly from actual dataset
  getFilterMetadata() {
    const styles = [
      ...new Set(
        this.orders.map((o) => ({
          name: o.style,
          code: o.styleCode || o.style,
          category: o.category,
        }))
      ),
    ];

    const uniqueStyles = [];
    const seenStyles = new Set();
    for (const item of styles) {
      if (!seenStyles.has(item.code)) {
        seenStyles.add(item.code);
        uniqueStyles.push(item);
      }
    }

    // Sizes sorted numerically
    const sizes = [...new Set(this.orders.map((o) => o.size).filter(Boolean))].sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    // Unique Colours
    const colours = [...new Set(this.orders.map((o) => o.colour).filter(Boolean))].sort();

    // Unique RM Materials
    const rmMaterials = [...new Set(this.orders.map((o) => o.rmMaterial).filter(Boolean))].sort();

    // Unique PO numbers
    const poNumbers = [...new Set(this.orders.map((o) => o.poNumber).filter(Boolean))].sort();

    return {
      categories: ['Loop', 'Strap', 'T-shirt', 'Other'],
      styles: uniqueStyles,
      sizes,
      colours,
      rmMaterials,
      poNumbers,
    };
  }

  // Aggregated Plan vs Actual time series
  getTimeSeries(category = 'All') {
    let relevantOrders = this.orders;
    if (category && category.toLowerCase() !== 'all') {
      relevantOrders = relevantOrders.filter((o) => o.category.toLowerCase() === category.toLowerCase());
    }

    const dateMap = {};

    relevantOrders.forEach((order) => {
      (order.dailyLogs || []).forEach((log) => {
        if (!dateMap[log.date]) {
          dateMap[log.date] = {
            date: log.date,
            planQty: 0,
            actualQty: 0,
            deliveryQty: 0,
            variance: 0,
          };
        }
        dateMap[log.date].planQty += Number(log.planQty) || 0;
        dateMap[log.date].actualQty += Number(log.actualQty) || 0;
        dateMap[log.date].deliveryQty += Number(log.deliveryQty) || 0;
      });
    });

    const series = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    series.forEach((item) => {
      item.variance = item.actualQty - item.planQty;
      item.efficiency = item.planQty > 0 ? Math.round((item.actualQty / item.planQty) * 100) : 100;
    });

    return series;
  }

  // --- MACHINE & WORKER QR WORKFLOW METHODS ---

  getMachines() {
    return this.machines.map((m) => {
      const todayLogs = m.todayLogs || [];
      const todayProduced = todayLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      const dailyTarget = Number(m.dailyTargetQty) || 2000;
      const todayRemaining = Math.max(0, dailyTarget - todayProduced);
      const todayProgress = dailyTarget > 0 ? Math.min(100, Math.round((todayProduced / dailyTarget) * 100)) : 0;

      return {
        ...m,
        todayProduced,
        todayRemaining,
        todayProgress,
        logsCount: todayLogs.length,
      };
    });
  }

  getMachineById(id) {
    if (!id) return null;
    const clean = id.trim().toLowerCase();
    const machines = this.getMachines();
    return (
      machines.find(
        (m) =>
          m.id.toLowerCase() === clean ||
          m.code.toLowerCase() === clean ||
          m.name.toLowerCase() === clean ||
          (m.qrPayload && m.qrPayload.toLowerCase() === clean)
      ) || null
    );
  }

  saveMachine(machineData) {
    let machine = this.machines.find(
      (m) => m.id === machineData.id || m.code === machineData.code || m.name === machineData.name
    );

    const code = machineData.code || machineData.id || `MCH-${String(this.machines.length + 1).padStart(2, '0')}`;
    const qrPayload = machineData.qrPayload || code; // Static permanent QR payload!

    if (machine) {
      // Update existing
      machine.name = machineData.name || machine.name;
      machine.code = code;
      machine.type = machineData.type || machine.type;
      machine.category = machineData.category || machine.category;
      machine.operatorName = machineData.operatorName || machine.operatorName;
      machine.shift = machineData.shift || machine.shift;
      machine.status = machineData.status || machine.status;
      machine.dailyTargetQty = Number(machineData.dailyTargetQty) || machine.dailyTargetQty || 2500;
      machine.assignedStyles = machineData.assignedStyles || machine.assignedStyles || [];
      machine.assignedColours = machineData.assignedColours || machine.assignedColours || [];
      machine.assignedSizes = machineData.assignedSizes || machine.assignedSizes || [];
      machine.assignedPos = machineData.assignedPos || machine.assignedPos || [];
      machine.qrPayload = qrPayload;
      machine.notes = machineData.notes || machine.notes;
    } else {
      // Create new
      machine = {
        id: code,
        code,
        name: machineData.name || `Machine ${String(this.machines.length + 1).padStart(2, '0')}`,
        type: machineData.type || 'Production Machine',
        category: machineData.category || 'Loop',
        operatorName: machineData.operatorName || 'Floor Operator',
        shift: machineData.shift || 'Shift A',
        status: machineData.status || 'Active',
        dailyTargetQty: Number(machineData.dailyTargetQty) || 2500,
        assignedStyles: machineData.assignedStyles || [],
        assignedColours: machineData.assignedColours || [],
        assignedSizes: machineData.assignedSizes || ['10', '12', '14'],
        assignedPos: machineData.assignedPos || [],
        qrPayload,
        notes: machineData.notes || '',
        todayLogs: [],
      };
      this.machines.push(machine);
    }

    this.save();
    return this.getMachineById(machine.id);
  }

  deleteMachine(id) {
    if (!id) return false;
    const clean = String(id).trim().toLowerCase();
    const index = this.machines.findIndex(
      (m) =>
        (m.id && m.id.toLowerCase() === clean) ||
        (m.code && m.code.toLowerCase() === clean) ||
        (m.name && m.name.toLowerCase() === clean)
    );
    if (index === -1) return false;
    this.machines.splice(index, 1);
    this.save();
    return true;
  }

  // Worker floor production submission
  submitWorkerProduction(data) {
    const { machineId, style, size, colour, producedQty, poNumber, shift, operatorName, timeSlot, notes } = data;
    const qty = Number(producedQty) || 0;
    if (qty <= 0) {
      throw new Error('Produced quantity must be greater than 0');
    }

    const machine = this.machines.find(
      (m) =>
        m.id.toLowerCase() === machineId.toLowerCase() ||
        m.code.toLowerCase() === machineId.toLowerCase() ||
        (m.qrPayload && m.qrPayload.toLowerCase() === machineId.toLowerCase())
    );

    if (!machine) {
      throw new Error(`Machine '${machineId}' not found in registry`);
    }

    // 1. Dry Cut Multiplier Logic:
    // Size 10, 12, 14, 18 -> x50, Size 16 -> x45
    const isDryCut =
      (machine.name || '').toLowerCase().includes('dry cut') ||
      (machine.code || '').toLowerCase().includes('dry');

    let multiplier = 1;
    let rawQty = qty;
    let effectiveQty = qty;

    if (isDryCut) {
      const sz = String(size || '').trim();
      if (sz === '16') {
        multiplier = 45;
      } else if (['10', '12', '14', '18'].includes(sz)) {
        multiplier = 50;
      } else {
        multiplier = 50;
      }
      effectiveQty = rawQty * multiplier;
    }

    // 2. Locate matching order in dataset
    let matchedOrder = null;
    if (poNumber) {
      matchedOrder = this.orders.find((o) => o.poNumber === poNumber && String(o.size) === String(size));
    }
    if (!matchedOrder && style && size) {
      matchedOrder = this.orders.find(
        (o) =>
          (o.style === style || o.styleCode === style) &&
          String(o.size) === String(size) &&
          (!colour || o.colour === colour)
      );
    }
    if (!matchedOrder && size) {
      matchedOrder = this.orders.find(
        (o) => String(o.size) === String(size) && o.category.toLowerCase() === machine.category.toLowerCase()
      );
    }

    // 3. Update order if matched
    const isLoopInsert =
      (machine.name || '').toLowerCase().includes('loop insert') ||
      (machine.name || '').toLowerCase().includes('insert loop') ||
      ((machine.name || '').toLowerCase().includes('insert') && (machine.name || '').toLowerCase().includes('loop')) ||
      (machine.code || '').toLowerCase() === 'mch-06';

    const todayStr = new Date().toISOString().split('T')[0];
    if (matchedOrder) {
      if (matchedOrder.floorProductionQty === undefined || matchedOrder.floorProductionQty === null) {
        matchedOrder.floorProductionQty = Number(matchedOrder.productionQty) || 0;
      }
      // ONLY Loop Insert can increase floorProductionQty!
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

    // 4. Log to Machine todayLogs
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

    // 5. Log to global production logs
    const globalLogEntry = {
      id: logEntry.id,
      date: todayStr,
      timestamp: logEntry.timestamp,
      time: logEntry.time,
      timeSlot: timeSlot || 'Current Window',
      shift: shift || machine.shift,
      category: machine.category,
      machineId: machine.code || machine.id,
      machineName: machine.name,
      operatorName: operatorName || machine.operatorName,
      poNumber: matchedOrder?.poNumber || poNumber || 'PO-PROD-BATCH',
      style: style || matchedOrder?.style || 'Standard',
      size: String(size),
      colour: colour || matchedOrder?.colour || 'Standard',
      qty: effectiveQty,
      rawQty,
      multiplier,
      notes: logEntry.notes,
    };
    if (!this.productionLogs) this.productionLogs = [];
    this.productionLogs.unshift(globalLogEntry);

    // 7. Update worker statistics
    if (this.workers && this.workers.length > 0) {
      const activeWorkerName = operatorName || machine.operatorName;
      const worker = this.workers.find((w) => w.name === activeWorkerName);
      if (worker) {
        worker.todayOutput = (worker.todayOutput || 0) + effectiveQty;
        worker.todayProduced = (worker.todayProduced || 0) + effectiveQty;
        worker.batchesLogged = (worker.batchesLogged || 0) + 1;
      }
    }

    // 8. Recalculate and persist
    this.save();

    const updatedMachine = this.getMachineById(machine.id);

    return {
      success: true,
      submission: logEntry,
      machine: updatedMachine,
      order: matchedOrder,
      message: `Successfully logged ${qty} pcs for Size ${size} on ${machine.name}`,
    };
  }

  // --- WORKER MANAGEMENT METHODS ---

  getWorkers() {
    return this.workers.map((w) => {
      // Calculate today's output produced by this worker
      const todayStr = new Date().toISOString().split('T')[0];
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

  getWorkerById(id) {
    if (!id) return null;
    return this.workers.find((w) => w.id === id || w.empId === id || w.name?.toLowerCase() === id.toLowerCase()) || null;
  }

  addWorker(workerData) {
    const nextNum = this.workers.length + 1;
    const newWorker = {
      id: `WRK-${String(nextNum).padStart(2, '0')}`,
      name: workerData.name || 'New Operator',
      empId: workerData.empId || `EMP-${1040 + nextNum}`,
      category: workerData.category || 'Loop',
      shift: workerData.shift || 'Shift A',
      status: workerData.status || 'Active',
      phone: workerData.phone || '',
      assignedMachine: workerData.assignedMachine || 'MCH-01',
      notes: workerData.notes || '',
      createdAt: new Date().toISOString(),
    };
    this.workers.push(newWorker);
    this.save();
    return newWorker;
  }

  updateWorker(id, workerData) {
    const worker = this.getWorkerById(id);
    if (!worker) return null;

    worker.name = workerData.name || worker.name;
    worker.empId = workerData.empId || worker.empId;
    worker.category = workerData.category || worker.category;
    worker.shift = workerData.shift || worker.shift;
    worker.status = workerData.status || worker.status;
    worker.phone = workerData.phone !== undefined ? workerData.phone : worker.phone;
    worker.assignedMachine = workerData.assignedMachine !== undefined ? workerData.assignedMachine : worker.assignedMachine;
    worker.notes = workerData.notes !== undefined ? workerData.notes : worker.notes;

    this.save();
    return worker;
  }

  deleteWorker(id) {
    const index = this.workers.findIndex((w) => w.id === id || w.empId === id);
    if (index === -1) return false;
    this.workers.splice(index, 1);
    this.save();
    return true;
  }

  updateProductionLog(logId, updatedData = {}) {
    if (!logId) return null;
    const logIndex = (this.productionLogs || []).findIndex((l) => l.id === logId);
    if (logIndex === -1) return null;

    const oldLog = this.productionLogs[logIndex];
    const oldQty = Number(oldLog.qty) || 0;
    const newQty = updatedData.qty !== undefined ? Number(updatedData.qty) : oldQty;
    const qtyDelta = newQty - oldQty;

    const updatedLog = {
      ...oldLog,
      ...updatedData,
      qty: newQty,
      rawQty: updatedData.rawQty !== undefined ? Number(updatedData.rawQty) : newQty,
      operator: updatedData.operator || updatedData.operatorName || oldLog.operator,
      operatorName: updatedData.operatorName || updatedData.operator || oldLog.operatorName,
      notes: updatedData.notes !== undefined ? updatedData.notes : oldLog.notes,
    };
    this.productionLogs[logIndex] = updatedLog;

    // Update inside machine.todayLogs
    const mach = this.machines.find(
      (m) =>
        m.code === oldLog.machineId ||
        m.id === oldLog.machineId ||
        (m.name || '').toLowerCase() === (oldLog.machineName || '').toLowerCase()
    );
    if (mach && Array.isArray(mach.todayLogs)) {
      const mIdx = mach.todayLogs.findIndex(
        (l) => l.id === logId || (l.timeSlot === oldLog.timeSlot && l.size === oldLog.size && Number(l.qty) === oldQty)
      );
      if (mIdx !== -1) {
        mach.todayLogs[mIdx] = {
          ...mach.todayLogs[mIdx],
          ...updatedData,
          qty: newQty,
          rawQty: updatedLog.rawQty,
          operator: updatedLog.operator,
          operatorName: updatedLog.operatorName,
          notes: updatedLog.notes,
        };
      }
    }

    // If machine is Loop Insert, adjust floorProductionQty on the matched order
    const isLoopInsert =
      (mach?.name || oldLog.machineName || '').toLowerCase().includes('loop insert') ||
      (mach?.name || oldLog.machineName || '').toLowerCase().includes('insert loop') ||
      ((mach?.name || oldLog.machineName || '').toLowerCase().includes('insert') && (mach?.name || oldLog.machineName || '').toLowerCase().includes('loop')) ||
      (mach?.code || oldLog.machineId || '').toLowerCase() === 'mch-06';

    if (isLoopInsert && qtyDelta !== 0) {
      const order = this.orders.find(
        (o) => o.poNumber === oldLog.poNumber && String(o.size) === String(oldLog.size)
      );
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

  deleteProductionLog(logId) {
    if (!logId) return false;
    const logIndex = (this.productionLogs || []).findIndex((l) => l.id === logId);
    if (logIndex === -1) return false;

    const oldLog = this.productionLogs[logIndex];
    const oldQty = Number(oldLog.qty) || 0;

    // Remove from global log
    this.productionLogs.splice(logIndex, 1);

    // Remove from machine.todayLogs
    const mach = this.machines.find(
      (m) =>
        m.code === oldLog.machineId ||
        m.id === oldLog.machineId ||
        (m.name || '').toLowerCase() === (oldLog.machineName || '').toLowerCase()
    );
    if (mach && Array.isArray(mach.todayLogs)) {
      const mIdx = mach.todayLogs.findIndex(
        (l) => l.id === logId || (l.timeSlot === oldLog.timeSlot && l.size === oldLog.size && Number(l.qty) === oldQty)
      );
      if (mIdx !== -1) {
        mach.todayLogs.splice(mIdx, 1);
      }
    }

    // If machine is Loop Insert, deduct from floorProductionQty
    const isLoopInsert =
      (mach?.name || oldLog.machineName || '').toLowerCase().includes('loop insert') ||
      (mach?.name || oldLog.machineName || '').toLowerCase().includes('insert loop') ||
      ((mach?.name || oldLog.machineName || '').toLowerCase().includes('insert') && (mach?.name || oldLog.machineName || '').toLowerCase().includes('loop')) ||
      (mach?.code || oldLog.machineId || '').toLowerCase() === 'mch-06';

    if (isLoopInsert) {
      const order = this.orders.find(
        (o) => o.poNumber === oldLog.poNumber && String(o.size) === String(oldLog.size)
      );
      if (order && order.floorProductionQty !== undefined) {
        order.floorProductionQty = Math.max(0, (Number(order.floorProductionQty) || 0) - oldQty);
      }
    }

    this.save();
    return true;
  }

  // --- DEDICATED DAILY PRODUCTION DASHBOARD (LOOP) ---

  getDailyProduction(params = {}) {
    const category = params.category || 'Loop';
    const targetDate = params.date || new Date().toISOString().split('T')[0];

    // Filter orders by category
    const categoryOrders = this.orders.filter(
      (o) => o.category.toLowerCase() === category.toLowerCase()
    );

    // Filter production logs for today for this category
    const relevantLogs = (this.productionLogs || []).filter(
      (l) => l.category.toLowerCase() === category.toLowerCase() && l.date === targetDate
    );

    // Filter today's Permanent Deliveries
    const todayPermanentDeliveries = (this.deliveryReceivedLogs || []).filter((l) => {
      const matchDate = !l.date || l.date === targetDate;
      const isPermanent = l.type === 'Delivery' && (l.subCategory === 'Permanent' || !l.subCategory);
      return isPermanent && matchDate;
    });
    const todayPermanentTotal = todayPermanentDeliveries.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    // Compute today's output per order / size
    const tableRows = categoryOrders.map((order) => {
      // Find today's logs for this specific order/size
      const orderLogs = relevantLogs.filter(
        (l) => l.poNumber === order.poNumber && String(l.size) === String(order.size)
      );
      const todayOutput = orderLogs.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

      // Latest daily plan target if available
      const latestDaily = (order.dailyLogs || []).find((dl) => dl.date === targetDate);
      const dayPlan = latestDaily ? Number(latestDaily.planQty) : Math.round(order.orderQty / 10);

      const numOrderQty = Number(order.orderQty) || 0;
      const numProductionQty = Number(order.productionQty) || 0;
      const numFloorProductionQty = Number(order.floorProductionQty !== undefined ? order.floorProductionQty : order.productionQty) || 0;
      const numDeliveryQty = Number(order.deliveryQty) || 0;
      // Balance allows negative values when actual/delivery exceeds order plan
      const calculatedBalance = numOrderQty - numDeliveryQty;

      // Permanent delivery logged today for this specific order
      const orderDeliveries = todayPermanentDeliveries.filter(
        (l) => l.poNumber === order.poNumber && String(l.size) === String(order.size)
      );
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

    // Summary Totals
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

    // Active workers & machines in this category
    const activeOperators = [...new Set(relevantLogs.map((l) => l.operatorName).filter(Boolean))];
    const activeMachines = [...new Set(relevantLogs.map((l) => l.machineName || l.machineId).filter(Boolean))];

    // Graph 1: Hourly Production Performance Timeline
    // Group logs by time intervals
    const hourlyMap = {};
    ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'].forEach((slot) => {
      hourlyMap[slot] = { time: slot, output: 0, target: Math.round(todayTargetQuota / 8) };
    });

    relevantLogs.forEach((log) => {
      const timeStr = log.time || '';
      // Map to nearest slot or use raw time
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

    // Graph 2: Performance by Size Breakdown
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

    const sizeBreakdown = Object.values(sizeMap).sort((a, b) => {
      const nA = parseInt(a.rawSize, 10);
      const nB = parseInt(b.rawSize, 10);
      return nA - nB;
    });

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

  ensureSpecialMachines() {
    const initialLen = (this.machines || []).length;
    this.machines = (this.machines || []).filter(
      (m) => m.id !== 'MCH-CMP' && m.code !== 'MCH-CMP' && !((m.name || '').toLowerCase().includes('compress'))
    );
    let modified = this.machines.length !== initialLen;

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

    let modified = false;
    for (const spec of specialSpecs) {
      const idx = this.machines.findIndex(
        (m) => m.id === spec.id || m.code === spec.code
      );
      if (idx === -1) {
        this.machines.push(spec);
        modified = true;
      }
    }
    if (modified) {
      this.save();
    }
  }

  // Hourly Production Dashboard Aggregation
  getHourlyProduction(params = {}) {
    this.ensureSpecialMachines();

    const {
      shift = 'Day Shift',
      date = new Date().toISOString().split('T')[0],
      machineId = 'All',
    } = params;

    // Shift time slots
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

    // Special machines prioritized order as requested:
    // 1. Cutting Machine (Strap)
    // 2. Pusing Machine (Strap)
    // 3. Iron Machine (Strap)
    // 4. Dry Cut Machine (Multiplier Logic)
    const priorityCodes = ['MCH-CUT', 'MCH-PUS', 'MCH-IRN', 'MCH-DRY'];

    let targetMachines = this.machines.filter((m) => {
      if (m.id === 'MCH-CMP' || m.code === 'MCH-CMP' || (m.name || '').toLowerCase().includes('compress')) return false;
      if (machineId !== 'All' && m.id !== machineId && m.code !== machineId) return false;
      return true;
    });

    // Sort so priority machines appear in order, followed by other machines
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
      // Formula: Divide daily target by working hours to get expected hourly target
      const expectedHourlyTarget = Math.round(dailyTarget / workingHours);

      let sourceLogs = m.todayLogs || [];

      // Filter logs by shift if specified
      const shiftLogs = sourceLogs.filter((l) => {
        if (shift !== 'All' && l.shift && l.shift !== shift) return false;
        return true;
      });

      // Build each hourly slot row
      const slotRows = activeSlots.map((slot) => {
        const slotLogs = shiftLogs.filter((l) => {
          const lSlot = (l.timeSlot || '').trim();
          return lSlot === slot.label || lSlot === slot.id || lSlot.replace(/\s+/g, '') === slot.label.replace(/\s+/g, '');
        });

        // Calculate actual output
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
              logActual = l.qty || (input * lMult);
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
          if (actualOutput >= expectedHourlyTarget) {
            status = 'Ahead';
          } else if (actualOutput >= expectedHourlyTarget * 0.9) {
            status = 'On Track';
          } else {
            status = 'Behind Plan';
          }
        }

        return {
          id: slot.id,
          timeSlot: slot.label,
          display: slot.display,
          workerName,
          style,
          colour, // Placed directly before Size
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

      // Special rule tag
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

    // Build Summary Matrix:
    // Rows: All machines from top to bottom
    // Col 1: Machine (Code & Name)
    // Col 2: Colour
    // Col 3: Size
    // Cols 4..N: Hourly time slots horizontally
    // Last Col: Total Output / Daily Target
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

    return {
      shift,
      date,
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
      items = [], // Multiple size entries support
      notes = '',
      handlerName = 'Dispatcher',
    } = payload;

    const todayStr = new Date().toISOString().split('T')[0];
    const createdLogs = [];

    // Normalize entries: either payload.items or single entry
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
    const todayStr = new Date().toISOString().split('T')[0];

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
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = allLogs.filter((l) => l.date === todayStr);

    const outsourceDeliveredToday = todayLogs
      .filter((l) => l.type === 'Delivery' && l.subCategory === 'Outsource')
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const permanentDeliveredToday = todayLogs
      .filter((l) => l.type === 'Delivery' && l.subCategory === 'Permanent')
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const totalReceivedToday = todayLogs
      .filter((l) => l.type === 'Received')
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const partnerBreakdown = {
      Saroja: todayLogs.filter((l) => l.outsourcePartner === 'Saroja').reduce((sum, l) => sum + Number(l.qty), 0),
      Anoja: todayLogs.filter((l) => l.outsourcePartner === 'Anoja').reduce((sum, l) => sum + Number(l.qty), 0),
      Iresh: todayLogs.filter((l) => l.outsourcePartner === 'Iresh').reduce((sum, l) => sum + Number(l.qty), 0),
    };

    return {
      success: true,
      logs: list.slice(0, Number(limit) || 100),
      totalLogs: list.length,
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
          // Also remove open consignment if unreceived
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
}

export const db = new ProductionDatabase();
