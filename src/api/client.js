// API Client for Bondtex Production Dashboard

const BASE_URL = '/api';

export const api = {
  // Get factory overview (totals + all 4 categories)
  getOverview: async () => {
    const res = await fetch(`${BASE_URL}/overview`);
    if (!res.ok) throw new Error('Failed to fetch factory overview');
    return res.json();
  },

  // Get categories summary
  getCategories: async () => {
    const res = await fetch(`${BASE_URL}/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  // Get single category details
  getCategoryDetails: async (category) => {
    const res = await fetch(`${BASE_URL}/categories/${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error(`Failed to fetch category details for ${category}`);
    return res.json();
  },

  // Get orders with filters
  getOrders: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });
    const res = await fetch(`${BASE_URL}/orders?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  // Get single order
  getOrderById: async (id) => {
    const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Order not found');
    return res.json();
  },

  // Create new order
  createOrder: async (orderData) => {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create order');
    }
    return res.json();
  },

  // Log daily output (Plan vs Actual)
  addDailyLog: async (orderId, logData) => {
    const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(orderId)}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to log daily production');
    }
    return res.json();
  },

  // Dynamic Plan vs Actual time series
  getPlanVsActual: async (category = 'All') => {
    const res = await fetch(`${BASE_URL}/plan-vs-actual?category=${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error('Failed to fetch plan vs actual data');
    return res.json();
  },

  // Barcode search
  searchBarcode: async (code) => {
    const res = await fetch(`${BASE_URL}/barcode/${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error('Barcode not found');
    return res.json();
  },

  // Metadata for filter dropdowns
  getMetadata: async () => {
    const res = await fetch(`${BASE_URL}/metadata`);
    if (!res.ok) throw new Error('Failed to fetch filter metadata');
    return res.json();
  },

  // Reset DB
  resetDb: async () => {
    const res = await fetch(`${BASE_URL}/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset database');
    return res.json();
  },

  // Machines API (Admin & Worker)
  getMachines: async () => {
    const res = await fetch(`${BASE_URL}/machines`);
    if (!res.ok) throw new Error('Failed to fetch machines');
    return res.json();
  },

  getMachineById: async (id) => {
    const res = await fetch(`${BASE_URL}/machines/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Machine '${id}' not found`);
    return res.json();
  },

  saveMachine: async (machineData) => {
    const res = await fetch(`${BASE_URL}/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(machineData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save machine configuration');
    }
    return res.json();
  },

  submitWorkerBatch: async (batchData) => {
    const res = await fetch(`${BASE_URL}/worker/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to submit production batch');
    }
    return res.json();
  },

  // Local Network Information for Mobile QR Codes
  getNetworkInfo: async () => {
    const res = await fetch(`${BASE_URL}/network-info`);
    if (!res.ok) throw new Error('Failed to get network info');
    return res.json();
  },

  // Worker Management API
  getWorkers: async () => {
    const res = await fetch(`${BASE_URL}/workers`);
    if (!res.ok) throw new Error('Failed to fetch workers');
    return res.json();
  },

  createWorker: async (workerData) => {
    const res = await fetch(`${BASE_URL}/workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create worker');
    }
    return res.json();
  },

  updateWorker: async (id, workerData) => {
    const res = await fetch(`${BASE_URL}/workers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update worker');
    }
    return res.json();
  },

  deleteWorker: async (id) => {
    const res = await fetch(`${BASE_URL}/workers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete worker');
    }
    return res.json();
  },

  // Dedicated Daily Production Dashboard (Loop focus)
  getDailyProduction: async (category = 'Loop', date = '') => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (date) params.append('date', date);
    const res = await fetch(`${BASE_URL}/daily-production?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch daily production dashboard data');
    return res.json();
  },

  // Dedicated Hourly Production Dashboard (Machine breakdown, multiplier, Target vs Actual)
  getHourlyProduction: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.shift) q.append('shift', params.shift);
    if (params.date) q.append('date', params.date);
    if (params.category) q.append('category', params.category);
    if (params.machineId) q.append('machineId', params.machineId);
    const res = await fetch(`${BASE_URL}/hourly-production?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch hourly production data');
    return res.json();
  },

  // Export CSV url
  getExportUrl: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });
    return `${BASE_URL}/export/csv?${params.toString()}`;
  },
};
