// API Client for Bondtex Production Dashboard
// Provides seamless auto-detection: connects to live backend API when available,
// and gracefully falls back to the client-side reactive Firestore / LocalStorage engine
// on Firebase Hosting without ever crashing on HTML/JSON parse errors.

import { dbStore } from '../services/dbStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Safely executes a fetch request and verifies JSON content type.
 * Returns null if the server returned HTML (e.g., Firebase Hosting SPA rewrite) or failed.
 */
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Returned HTML or other non-JSON response
      return null;
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  // 1. Factory overview
  getOverview: async () => {
    const remote = await safeFetchJson(`${BASE_URL}/overview`);
    if (remote && remote.success) return remote;
    return { success: true, data: dbStore.getFactoryOverview() };
  },

  // 2. Categories summary
  getCategories: async () => {
    const remote = await safeFetchJson(`${BASE_URL}/categories`);
    if (remote && remote.success) return remote;
    return { success: true, data: dbStore.getCategoriesSummary() };
  },

  // 3. Single category details
  getCategoryDetails: async (category) => {
    const remote = await safeFetchJson(`${BASE_URL}/categories/${encodeURIComponent(category)}`);
    if (remote && remote.success) return remote;
    const data = dbStore.getCategoryDetails(category);
    if (!data) throw new Error(`Category '${category}' not found`);
    return { success: true, data };
  },

  // 4. Orders with filters
  getOrders: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });
    const remote = await safeFetchJson(`${BASE_URL}/orders?${params.toString()}`);
    if (remote && remote.success) return remote;
    const result = dbStore.getOrders(filters);
    return { success: true, ...result };
  },

  // 5. Single order
  getOrderById: async (id) => {
    const remote = await safeFetchJson(`${BASE_URL}/orders/${encodeURIComponent(id)}`);
    if (remote && remote.success) return remote;
    const order = dbStore.getOrderById(id);
    if (!order) throw new Error('Order not found');
    return { success: true, data: order };
  },

  // 6. Create new order
  createOrder: async (orderData) => {
    const remote = await safeFetchJson(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (remote && remote.success) return remote;
    const newOrder = dbStore.createOrder(orderData);
    return { success: true, data: newOrder };
  },

  // 7. Add daily log
  addDailyLog: async (orderId, logData) => {
    const remote = await safeFetchJson(`${BASE_URL}/orders/${encodeURIComponent(orderId)}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    });
    if (remote && remote.success) return remote;
    const updated = dbStore.addDailyLog(orderId, logData);
    if (!updated) throw new Error('Order not found');
    return { success: true, data: updated };
  },

  // 8. Dynamic Plan vs Actual time series
  getPlanVsActual: async (category = 'All') => {
    const remote = await safeFetchJson(`${BASE_URL}/plan-vs-actual?category=${encodeURIComponent(category)}`);
    if (remote && remote.success) return remote;
    const series = dbStore.getTimeSeries(category);
    return { success: true, category, data: series };
  },

  // 9. Barcode search
  searchBarcode: async (code) => {
    const remote = await safeFetchJson(`${BASE_URL}/barcode/${encodeURIComponent(code)}`);
    if (remote && remote.success) return remote;
    const match = dbStore.lookupBarcode(code);
    if (!match) throw new Error(`No order found for barcode: ${code}`);
    return { success: true, data: match };
  },

  // 10. Filter metadata
  getMetadata: async () => {
    const remote = await safeFetchJson(`${BASE_URL}/metadata`);
    if (remote && remote.success) return remote;
    return { success: true, data: dbStore.getMetadata() };
  },

  // 11. Reset Database
  resetDb: async () => {
    const remote = await safeFetchJson(`${BASE_URL}/reset`, { method: 'POST' });
    if (remote && remote.success) return remote;
    const res = dbStore.reset();
    return { success: true, message: 'Database reset to initial clean data', ...res };
  },

  // 12. Machines API (Admin & Worker)
  getMachines: async () => {
    const remote = await safeFetchJson(`${BASE_URL}/machines`);
    if (remote && remote.success) return remote;
    return { success: true, data: dbStore.getMachines() };
  },

  getMachineById: async (id) => {
    const remote = await safeFetchJson(`${BASE_URL}/machines/${encodeURIComponent(id)}`);
    if (remote && remote.success) return remote;
    const machine = dbStore.getMachineById(id);
    if (!machine) throw new Error(`Machine '${id}' not found`);
    return { success: true, data: machine };
  },

  saveMachine: async (machineData) => {
    const remote = await safeFetchJson(`${BASE_URL}/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(machineData),
    });
    if (remote && remote.success) return remote;
    const saved = dbStore.saveMachine(machineData);
    return { success: true, data: saved, message: 'Machine configuration saved successfully' };
  },

  deleteMachine: async (id) => {
    const remote = await safeFetchJson(`${BASE_URL}/machines/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (remote && remote.success) return remote;
    const success = dbStore.deleteMachine(id);
    if (!success) throw new Error(`Machine '${id}' not found`);
    return { success: true, message: `Machine '${id}' deleted successfully` };
  },

  // 13. Worker Production Batch Submission (from Mobile Floor QR Scan)
  submitWorkerBatch: async (batchData) => {
    const remote = await safeFetchJson(`${BASE_URL}/worker/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData),
    });
    if (remote && remote.success) return remote;
    const result = dbStore.submitWorkerProduction(batchData);
    return { success: true, ...result };
  },

  // 14. Network Info for QR Generation
  getNetworkInfo: async () => {
    const remote = await safeFetchJson(`${BASE_URL}/network-info`);
    if (remote && remote.success) return remote;
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const port = typeof window !== 'undefined' ? window.location.port : '5000';
    return {
      success: true,
      data: {
        primaryIp: host,
        port: port || (window.location.protocol === 'https:' ? '443' : '80'),
        allIps: [host],
      },
    };
  },

  // 15. Worker Management API
  getWorkers: async () => {
    const remote = await safeFetchJson(`${BASE_URL}/workers`);
    if (remote && remote.success) return remote;
    return { success: true, data: dbStore.getWorkers() };
  },

  createWorker: async (workerData) => {
    const remote = await safeFetchJson(`${BASE_URL}/workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerData),
    });
    if (remote && remote.success) return remote;
    const newWorker = dbStore.addWorker(workerData);
    return { success: true, data: newWorker, message: 'Worker registered successfully' };
  },

  updateWorker: async (id, workerData) => {
    const remote = await safeFetchJson(`${BASE_URL}/workers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerData),
    });
    if (remote && remote.success) return remote;
    const updated = dbStore.updateWorker(id, workerData);
    if (!updated) throw new Error('Worker not found');
    return { success: true, data: updated, message: 'Worker updated successfully' };
  },

  deleteWorker: async (id) => {
    const remote = await safeFetchJson(`${BASE_URL}/workers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (remote && remote.success) return remote;
    const success = dbStore.deleteWorker(id);
    if (!success) throw new Error('Worker not found');
    return { success: true, message: 'Worker deleted successfully' };
  },

  // 16. Dedicated Daily Production Dashboard (Loop focus)
  getDailyProduction: async (category = 'Loop', date = '') => {
    let cat = 'Loop';
    let dt = '';
    if (typeof category === 'object' && category !== null) {
      cat = category.category || 'Loop';
      dt = category.date || '';
    } else {
      cat = category || 'Loop';
      dt = date || '';
    }
    const params = new URLSearchParams();
    if (cat) params.append('category', cat);
    if (dt) params.append('date', dt);
    const remote = await safeFetchJson(`${BASE_URL}/daily-production?${params.toString()}`);
    if (remote && remote.success) return remote;
    const data = dbStore.getDailyProduction({ category: cat, date: dt });
    return { success: true, data };
  },

  // 17. Dedicated Hourly Production Dashboard (Machine breakdown, multiplier, Target vs Actual)
  getHourlyProduction: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.shift) q.append('shift', params.shift);
    if (params.date) q.append('date', params.date);
    if (params.category) q.append('category', params.category);
    if (params.machineId) q.append('machineId', params.machineId);
    const remote = await safeFetchJson(`${BASE_URL}/hourly-production?${q.toString()}`);
    if (remote && remote.success) return remote;
    const data = dbStore.getHourlyProduction(params);
    return { success: true, data };
  },

  updateProductionLog: async (logId, data = {}) => {
    const remote = await safeFetchJson(`${BASE_URL}/production-logs/${encodeURIComponent(logId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (remote && remote.success) return remote;
    const updated = dbStore.updateProductionLog(logId, data);
    return { success: !!updated, data: updated };
  },

  deleteProductionLog: async (logId, query = {}) => {
    const q = new URLSearchParams();
    if (query.machineId) q.append('machineId', query.machineId);
    if (query.timeSlot) q.append('timeSlot', query.timeSlot);
    if (query.date) q.append('date', query.date);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const remote = await safeFetchJson(`${BASE_URL}/production-logs/${encodeURIComponent(logId)}${qs}`, {
      method: 'DELETE',
    });
    if (remote && remote.success) return remote;
    const ok = dbStore.deleteProductionLog(logId, query);
    return { success: ok };
  },

  // 18. Delivery & Received Workflow API
  getDeliveryReceivedLogs: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.type) q.append('type', params.type);
    if (params.subCategory) q.append('subCategory', params.subCategory);
    if (params.partner) q.append('partner', params.partner);
    if (params.poNumber) q.append('poNumber', params.poNumber);
    if (params.search) q.append('search', params.search);
    if (params.limit) q.append('limit', params.limit);
    if (params.date) q.append('date', params.date);
    const remote = await safeFetchJson(`${BASE_URL}/delivery-received?${q.toString()}`);
    if (remote && remote.success) return remote;
    return dbStore.getDeliveryReceivedLogs(params);
  },

  recordDeliveryReceived: async (payload) => {
    const remote = await safeFetchJson(`${BASE_URL}/delivery-received`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (remote && remote.success) return remote;
    return dbStore.recordDeliveryReceived(payload);
  },

  updateDeliveryReceived: async (id, data) => {
    const remote = await safeFetchJson(`${BASE_URL}/delivery-received/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (remote && remote.success) return remote;
    return dbStore.updateDeliveryReceived(id, data);
  },

  deleteDeliveryReceived: async (id) => {
    const remote = await safeFetchJson(`${BASE_URL}/delivery-received/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (remote && remote.success) return remote;
    return dbStore.deleteDeliveryReceived(id);
  },

  // 18B. Outsource Consignments Management & Inbound Return Confirmation
  getOutsourceConsignments: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.partner) q.append('partner', params.partner);
    if (params.status) q.append('status', params.status);
    if (params.search) q.append('search', params.search);
    const remote = await safeFetchJson(`${BASE_URL}/outsource-consignments?${q.toString()}`);
    if (remote && remote.success) return remote;
    return dbStore.getOutsourceConsignments(params);
  },

  receiveOutsourceConsignment: async (id, data = {}) => {
    const remote = await safeFetchJson(`${BASE_URL}/outsource-consignments/${encodeURIComponent(id)}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (remote && remote.success) return remote;
    return dbStore.receiveOutsourceConsignment(id, data);
  },

  // 19. Export CSV URL
  getExportUrl: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });
    return `${BASE_URL}/export/csv?${params.toString()}`;
  },
  // 20. Realtime Cross-Device Multi-Screen Sync Listener (Laptop <-> Phone)
  subscribe: (listener) => dbStore.subscribe(listener),

  // 21. Trigger Manual Cloud Sync from Firebase Realtime Database
  syncCloud: async () => {
    return dbStore.pullCloudState ? dbStore.pullCloudState() : null;
  },
};

export default api;
