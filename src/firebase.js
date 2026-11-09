// Firebase Web App & Firestore Integration for Bondtex MES
// Project ID: bondtexlk-f16f5

export const firebaseConfig = {
  projectId: "bondtexlk-f16f5",
  appId: "1:269334573360:web:112b6f9a8295cf173298f5",
  storageBucket: "bondtexlk-f16f5.firebasestorage.app",
  apiKey: "AIzaSyCovLz6uj8Ihvp07cbLccakKUlgieHfQZk",
  authDomain: "bondtexlk-f16f5.firebaseapp.com",
  messagingSenderId: "269334573360",
  measurementId: "G-FM48PWKK4M",
};

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

/**
 * Converts Javascript Object to Firestore REST Document Fields format
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map((v) => {
            if (typeof v === 'object' && v !== null) {
              return { mapValue: { fields: toFirestoreFields(v) } };
            }
            return { stringValue: String(v) };
          }),
        },
      };
    } else if (typeof val === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
    }
  }
  return fields;
}

/**
 * Converts Firestore REST Document to standard Javascript Object
 */
function fromFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null;
  const result = {};
  for (const [key, field] of Object.entries(doc.fields)) {
    if (field.stringValue !== undefined) result[key] = field.stringValue;
    else if (field.integerValue !== undefined) result[key] = Number(field.integerValue);
    else if (field.doubleValue !== undefined) result[key] = Number(field.doubleValue);
    else if (field.booleanValue !== undefined) result[key] = field.booleanValue;
    else if (field.nullValue !== undefined) result[key] = null;
    else if (field.arrayValue !== undefined) {
      result[key] = (field.arrayValue.values || []).map((v) => {
        if (v.mapValue) return fromFirestoreFields(v.mapValue.fields);
        return v.stringValue || v.integerValue || v.booleanValue;
      });
    } else if (field.mapValue !== undefined) {
      result[key] = fromFirestoreFields(field.mapValue.fields);
    }
  }
  return result;
}

function fromFirestoreFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) res[k] = Number(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.nullValue !== undefined) res[k] = null;
  }
  return res;
}

/**
 * Direct Lightweight Firestore REST Client for Browser & Node
 */
export const firestoreSync = {
  async saveDocument(collection, docId, data) {
    try {
      const url = `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
      const fields = toFirestoreFields(data);
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        console.warn(`Firestore sync note for ${collection}/${docId}:`, res.statusText);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn('Firestore network sync skipped (offline mode active):', err?.message);
      return null;
    }
  },

  async getDocument(collection, docId) {
    try {
      const url = `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return fromFirestoreDocument(data);
    } catch {
      return null;
    }
  },

  async listDocuments(collection) {
    try {
      const url = `${FIRESTORE_BASE}/${collection}?key=${firebaseConfig.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.documents) return [];
      return data.documents.map(fromFirestoreDocument).filter(Boolean);
    } catch {
      return [];
    }
  },
};

export const REALTIME_DB_URL = 'https://bondtexlk-f16f5-default-rtdb.firebaseio.com';

/**
 * Standard Cache-Busting HTTP headers and URL builder
 * Completely prevents iOS WebKit / Safari from serving stale cached JSON state or stalling network polls
 */
export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export function getNoCacheUrl(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}&_r=${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * High-speed Realtime Database Sync Engine for multi-device live synchronization (Laptop, Phone, Tablet)
 */
export const firebaseRealtime = {
  // Singular Active Workspace Pointer in Firebase (survives refreshes & syncs globally across all devices)
  async setActiveWorkspacePointer(workspace) {
    if (!workspace || !workspace.id) return null;
    // Strict Permanent Hydration Lock: Never allow silent reversion to ws_baseline_2026
    if (workspace.id === 'ws_baseline_2026' && !workspace.forceAdminSeedReset) {
      console.warn('Blocked setActiveWorkspacePointer from setting obsolete ws_baseline_2026');
      return null;
    }
    try {
      const isVsLive = workspace.id === 'ws_live_production_vs' || workspace.id === 'ws_1793848480892_9ts9r';
      const targetId = isVsLive ? 'ws_live_production_vs' : workspace.id;
      const payload = {
        id: targetId,
        buyerName: isVsLive ? 'VS' : (workspace.buyerName || 'Active Order'),
        name: isVsLive ? 'VS Live Production' : (workspace.name || `Order - ${workspace.buyerName || workspace.id}`),
        notes: workspace.notes || '',
        status: 'Active',
        updatedAt: new Date().toISOString(),
      };
      await Promise.all([
        fetch(getNoCacheUrl(`${REALTIME_DB_URL}/activeWorkspace.json`), {
          method: 'PUT',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
          body: JSON.stringify(payload),
        }),
        fetch(getNoCacheUrl(`${REALTIME_DB_URL}/activeWorkspaceId.json`), {
          method: 'PUT',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
          body: JSON.stringify(targetId),
        }),
      ]);
      return payload;
    } catch (err) {
      console.warn('Realtime cloud activeWorkspace pointer push note:', err?.message);
      return null;
    }
  },

  async getActiveWorkspacePointer() {
    try {
      const res = await fetch(getNoCacheUrl(`${REALTIME_DB_URL}/activeWorkspace.json`), {
        cache: 'no-store',
        headers: NO_CACHE_HEADERS,
      });
      if (!res.ok) return null;
      const ws = await res.json();
      if (!ws || !ws.id || ws.id === 'ws_baseline_2026') {
        // Fallback strictly to live production workspace ws_live_production_vs
        return {
          id: 'ws_live_production_vs',
          buyerName: 'VS',
          name: 'VS Live Production',
          status: 'Active',
        };
      }
      if (ws.id === 'ws_live_production_vs' || ws.id === 'ws_1793848480892_9ts9r') {
        ws.id = 'ws_live_production_vs';
        ws.buyerName = 'VS';
        ws.name = 'VS Live Production';
      }
      return ws;
    } catch (err) {
      console.warn('Realtime cloud activeWorkspace pointer pull note:', err?.message);
      return null;
    }
  },

  async pushState(state) {
    try {
      const url = getNoCacheUrl(`${REALTIME_DB_URL}/state.json`);
      const activeWs = state?.activeWorkspace || null;
      const activeWsId = state?.activeWorkspaceId || activeWs?.id || null;
      const normalizedState = {
        ...state,
        activeWorkspace: activeWs,
        activeWorkspaceId: activeWsId,
      };
      const promises = [
        fetch(url, {
          method: 'PUT',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
          body: JSON.stringify(normalizedState),
        }),
      ];

      // Mirror active workspace pointer to dedicated endpoints for absolute ground truth
      if (activeWs && activeWsId) {
        promises.push(
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/activeWorkspace.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(activeWs),
          }),
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/activeWorkspaceId.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(activeWsId),
          })
        );
      }

      // Mirror inventory to dedicated cloud endpoints for strict ground-truth persistence
      if (Array.isArray(state?.inventoryItems)) {
        promises.push(
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/inventoryItems.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(state.inventoryItems),
          })
        );
      }
      if (Array.isArray(state?.materialRequests)) {
        promises.push(
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/materialRequests.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(state.materialRequests),
          })
        );
      }
      if (Array.isArray(state?.inventoryLogs)) {
        promises.push(
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/inventoryLogs.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(state.inventoryLogs),
          })
        );
      }

      const [res] = await Promise.all(promises);
      return await res.json();
    } catch (err) {
      console.warn('Realtime cloud push note (offline):', err?.message);
      return null;
    }
  },

  async pushInventory(inventoryItems, materialRequests, inventoryLogs) {
    try {
      const promises = [];
      if (Array.isArray(inventoryItems)) {
        promises.push(
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/inventoryItems.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(inventoryItems),
          })
        );
      }
      if (Array.isArray(materialRequests)) {
        promises.push(
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/materialRequests.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(materialRequests),
          })
        );
      }
      if (Array.isArray(inventoryLogs)) {
        promises.push(
          fetch(getNoCacheUrl(`${REALTIME_DB_URL}/inventoryLogs.json`), {
            method: 'PUT',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
            body: JSON.stringify(inventoryLogs),
          })
        );
      }
      await Promise.all(promises);
      return true;
    } catch (err) {
      console.warn('Realtime cloud inventory push note:', err?.message);
      return false;
    }
  },

  async pullInventory() {
    try {
      const [itemsRes, reqsRes, logsRes] = await Promise.all([
        fetch(getNoCacheUrl(`${REALTIME_DB_URL}/inventoryItems.json`), { cache: 'no-store', headers: NO_CACHE_HEADERS }),
        fetch(getNoCacheUrl(`${REALTIME_DB_URL}/materialRequests.json`), { cache: 'no-store', headers: NO_CACHE_HEADERS }),
        fetch(getNoCacheUrl(`${REALTIME_DB_URL}/inventoryLogs.json`), { cache: 'no-store', headers: NO_CACHE_HEADERS }),
      ]);
      const inventoryItems = itemsRes.ok ? await itemsRes.json() : null;
      const materialRequests = reqsRes.ok ? await reqsRes.json() : null;
      const inventoryLogs = logsRes.ok ? await logsRes.json() : null;

      const normalizeList = (val) => {
        if (!val) return null;
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.values(val);
        return null;
      };

      return {
        inventoryItems: normalizeList(inventoryItems),
        materialRequests: normalizeList(materialRequests),
        inventoryLogs: normalizeList(inventoryLogs),
      };
    } catch (err) {
      console.warn('Realtime cloud inventory pull note:', err?.message);
      return { inventoryItems: null, materialRequests: null, inventoryLogs: null };
    }
  },

  async pullDeletedLogIds() {
    try {
      const res = await fetch(getNoCacheUrl(`${REALTIME_DB_URL}/deletedLogIds.json`), {
        cache: 'no-store',
        headers: NO_CACHE_HEADERS,
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data) return [];
      return Array.isArray(data) ? data : Object.values(data);
    } catch {
      return [];
    }
  },

  async pushDeletedLogIds(deletedIds) {
    try {
      if (!Array.isArray(deletedIds)) return false;
      await fetch(getNoCacheUrl(`${REALTIME_DB_URL}/deletedLogIds.json`), {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
        body: JSON.stringify(deletedIds),
      });
      return true;
    } catch {
      return false;
    }
  },

  async deleteInventoryItem(itemId) {
    try {
      if (!itemId) return false;
      // Also delete from direct endpoint if present
      await fetch(getNoCacheUrl(`${REALTIME_DB_URL}/inventoryItems/${encodeURIComponent(itemId)}.json`), {
        method: 'DELETE',
        cache: 'no-store',
        headers: NO_CACHE_HEADERS,
      });
      return true;
    } catch {
      return false;
    }
  },

  async deleteWorkspaceArchive(workspaceId) {
    try {
      if (!workspaceId) return false;
      const url = getNoCacheUrl(`${REALTIME_DB_URL}/workspaces/${encodeURIComponent(workspaceId)}.json`);
      await fetch(url, { method: 'DELETE', cache: 'no-store', headers: NO_CACHE_HEADERS });
      return true;
    } catch {
      return false;
    }
  },

  async saveWorkspaceArchive(workspace) {
    try {
      if (!workspace || !workspace.id) return null;
      const url = getNoCacheUrl(`${REALTIME_DB_URL}/workspaces/${encodeURIComponent(workspace.id)}.json`);
      const res = await fetch(url, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
        body: JSON.stringify(workspace),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  async getWorkspaceArchive(workspaceId) {
    try {
      const url = getNoCacheUrl(`${REALTIME_DB_URL}/workspaces/${encodeURIComponent(workspaceId)}.json`);
      const res = await fetch(url, { cache: 'no-store', headers: NO_CACHE_HEADERS });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async pullAllWorkspaces() {
    try {
      const url = getNoCacheUrl(`${REALTIME_DB_URL}/workspaces.json`);
      const res = await fetch(url, { cache: 'no-store', headers: NO_CACHE_HEADERS });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data) return [];
      return Object.values(data);
    } catch {
      return [];
    }
  },

  async pushSnapshot(state) {
    try {
      if (!state || !Array.isArray(state.orders)) return null;
      const snapKey = new Date().toISOString().replace(/[:.]/g, '-');
      const url = getNoCacheUrl(`${REALTIME_DB_URL}/snapshots/${snapKey}.json`);
      await fetch(url, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...NO_CACHE_HEADERS },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          lastUpdated: state.lastUpdated,
          lastDeviceId: state.lastDeviceId,
          orderCount: state.orders.length,
          totalOrderQty: state.orders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0),
          totalProductionQty: state.orders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0),
          totalBalanceQty: state.orders.reduce((sum, o) => sum + (Number(o.balanceQty) || 0), 0),
          orders: state.orders,
          deliveryReceivedLogs: state.deliveryReceivedLogs || [],
        }),
      });
    } catch (err) {
      // offline snapshot ignore
    }
  },

  async pullState() {
    try {
      const url = getNoCacheUrl(`${REALTIME_DB_URL}/state.json`);
      const res = await fetch(url, {
        cache: 'no-store',
        headers: NO_CACHE_HEADERS,
      });
      if (!res.ok) return null;
      const state = await res.json();
      if (!state) return null;

      // Auto-hydrate active workspace pointer if missing directly from state.json
      if (!state.activeWorkspaceId && !state.activeWorkspace) {
        try {
          const wsPtr = await firebaseRealtime.getActiveWorkspacePointer();
          if (wsPtr && wsPtr.id) {
            state.activeWorkspace = wsPtr;
            state.activeWorkspaceId = wsPtr.id;
          }
        } catch {}
      }
      return state;
    } catch (err) {
      console.warn('Realtime cloud pull note (offline):', err?.message);
      return null;
    }
  },

  listenToChanges(onUpdate) {
    if (typeof window === 'undefined') return () => {};

    let eventSource = null;
    let pollInterval = null;
    let heartbeatInterval = null;
    let stopped = false;
    let lastHandledSnapshotKey = null;
    let lastEventReceived = Date.now();

    const processPayload = async (payload) => {
      try {
        lastEventReceived = Date.now();
        if (!payload) return;
        let state = null;
        if (payload.path === '/' || !payload.path) {
          state = payload.data;
          // If state payload is partial (e.g. from an atomic patch lacking logs or orders), pull the full state
          if (!state || (!state.productionLogs && !state.orders)) {
            state = await firebaseRealtime.pullState();
          }
        } else {
          // Subpath modification detected (e.g. /productionLogs, /orders, /inventory)
          state = await firebaseRealtime.pullState();
        }

        if (!state) return;

        // Auto-hydrate active workspace pointer if missing from state snapshot
        if (!state.activeWorkspaceId && !state.activeWorkspace) {
          try {
            const wsPtr = await firebaseRealtime.getActiveWorkspacePointer();
            if (wsPtr && wsPtr.id) {
              state.activeWorkspace = wsPtr;
              state.activeWorkspaceId = wsPtr.id;
            }
          } catch {}
        }

        // Actionable snapshot change detection: triggers on ANY change in log count, orders, or timestamp
        const stateLogsCount = Array.isArray(state.productionLogs) ? state.productionLogs.length : 0;
        const stateOrdersCount = Array.isArray(state.orders) ? state.orders.length : 0;
        const snapshotKey = `${state.lastUpdated || ''}_${stateLogsCount}_${stateOrdersCount}`;

        if (snapshotKey === lastHandledSnapshotKey) {
          return;
        }
        lastHandledSnapshotKey = snapshotKey;

        onUpdate(state);
      } catch (err) {
        console.warn('SSE message process note:', err);
      }
    };

    const connectStream = () => {
      if (stopped) return;
      try {
        if (eventSource) {
          try { eventSource.close(); } catch {}
          eventSource = null;
        }
        if (window.EventSource) {
          eventSource = new EventSource(`${REALTIME_DB_URL}/state.json`);
          lastEventReceived = Date.now();

          eventSource.addEventListener('put', (e) => {
            try {
              const payload = JSON.parse(e.data);
              processPayload(payload);
            } catch (err) {
              console.warn('SSE put parse error:', err);
            }
          });
          eventSource.addEventListener('patch', (e) => {
            try {
              const payload = JSON.parse(e.data);
              processPayload(payload);
            } catch (err) {
              console.warn('SSE patch parse error:', err);
            }
          });

          eventSource.onerror = () => {
            if (eventSource) {
              try { eventSource.close(); } catch {}
              eventSource = null;
            }
            if (!stopped) setTimeout(connectStream, 3000);
          };
        }
      } catch (err) {
        console.warn('EventSource initialization note:', err);
      }
    };

    connectStream();

    // Fast, reliable fallback poll (every 3 seconds with full cache-busting for multi-device cross-sync)
    pollInterval = setInterval(async () => {
      if (stopped) return;
      try {
        const cloudState = await firebaseRealtime.pullState();
        if (cloudState && (cloudState.orders || cloudState.productionLogs || cloudState.lastUpdated)) {
          const stateLogsCount = Array.isArray(cloudState.productionLogs) ? cloudState.productionLogs.length : 0;
          const stateOrdersCount = Array.isArray(cloudState.orders) ? cloudState.orders.length : 0;
          const snapshotKey = `${cloudState.lastUpdated || ''}_${stateLogsCount}_${stateOrdersCount}`;

          if (snapshotKey === lastHandledSnapshotKey) return;
          lastHandledSnapshotKey = snapshotKey;

          if (!Array.isArray(cloudState.inventoryItems)) {
            const inv = await firebaseRealtime.pullInventory();
            if (inv && Array.isArray(inv.inventoryItems)) {
              cloudState.inventoryItems = inv.inventoryItems;
              cloudState.materialRequests = inv.materialRequests || [];
              cloudState.inventoryLogs = inv.inventoryLogs || [];
            }
          }
          onUpdate(cloudState);
        }
      } catch {
        // ignore
      }
    }, 3000);

    // Watchdog heartbeat for iOS Safari / Mobile WebKit
    heartbeatInterval = setInterval(() => {
      if (stopped) return;
      const isStale = Date.now() - lastEventReceived > 25000;
      if (isStale || (eventSource && eventSource.readyState === 2)) {
        connectStream();
      }
    }, 12000);

    // Sync immediately on window focus, iOS bfcache restoration (pageshow), or tab visibility change
    const handleFocus = async () => {
      try {
        connectStream();
        const cloudState = await firebaseRealtime.pullState();
        if (cloudState && (cloudState.orders || cloudState.productionLogs || cloudState.lastUpdated)) {
          const stateLogsCount = Array.isArray(cloudState.productionLogs) ? cloudState.productionLogs.length : 0;
          const stateOrdersCount = Array.isArray(cloudState.orders) ? cloudState.orders.length : 0;
          const snapshotKey = `${cloudState.lastUpdated || ''}_${stateLogsCount}_${stateOrdersCount}`;

          if (snapshotKey === lastHandledSnapshotKey) return;
          lastHandledSnapshotKey = snapshotKey;

          if (!Array.isArray(cloudState.inventoryItems)) {
            const inv = await firebaseRealtime.pullInventory();
            if (inv && Array.isArray(inv.inventoryItems)) {
              cloudState.inventoryItems = inv.inventoryItems;
              cloudState.materialRequests = inv.materialRequests || [];
              cloudState.inventoryLogs = inv.inventoryLogs || [];
            }
          }
          onUpdate(cloudState);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    window.addEventListener('online', handleFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus();
    });

    return () => {
      stopped = true;
      if (eventSource) {
        try { eventSource.close(); } catch {}
      }
      if (pollInterval) clearInterval(pollInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  },
};

export default firebaseConfig;
