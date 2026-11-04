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
 * High-speed Realtime Database Sync Engine for multi-device live synchronization (Laptop, Phone, Tablet)
 */
export const firebaseRealtime = {
  // Singular Active Workspace Pointer in Firebase (survives refreshes & syncs globally across all devices)
  async setActiveWorkspacePointer(workspace) {
    if (!workspace || !workspace.id) return null;
    try {
      const payload = {
        id: workspace.id,
        buyerName: workspace.buyerName || 'Active Order',
        name: workspace.name || `Order - ${workspace.buyerName || workspace.id}`,
        notes: workspace.notes || '',
        status: 'Active',
        updatedAt: new Date().toISOString(),
      };
      await Promise.all([
        fetch(`${REALTIME_DB_URL}/activeWorkspace.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch(`${REALTIME_DB_URL}/activeWorkspaceId.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workspace.id),
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
      const res = await fetch(`${REALTIME_DB_URL}/activeWorkspace.json`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('Realtime cloud activeWorkspace pointer pull note:', err?.message);
      return null;
    }
  },

  async pushState(state) {
    try {
      const url = `${REALTIME_DB_URL}/state.json`;
      const promises = [
        fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        }),
      ];

      // Mirror active workspace pointer to dedicated endpoints for absolute ground truth
      const activeWs = state?.activeWorkspace || null;
      const activeWsId = state?.activeWorkspaceId || activeWs?.id || null;
      if (activeWs && activeWsId) {
        promises.push(
          fetch(`${REALTIME_DB_URL}/activeWorkspace.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activeWs),
          }),
          fetch(`${REALTIME_DB_URL}/activeWorkspaceId.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activeWsId),
          })
        );
      }

      // Mirror inventory to dedicated cloud endpoints for strict ground-truth persistence
      if (Array.isArray(state?.inventoryItems)) {
        promises.push(
          fetch(`${REALTIME_DB_URL}/inventoryItems.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.inventoryItems),
          })
        );
      }
      if (Array.isArray(state?.materialRequests)) {
        promises.push(
          fetch(`${REALTIME_DB_URL}/materialRequests.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.materialRequests),
          })
        );
      }
      if (Array.isArray(state?.inventoryLogs)) {
        promises.push(
          fetch(`${REALTIME_DB_URL}/inventoryLogs.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
          fetch(`${REALTIME_DB_URL}/inventoryItems.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inventoryItems),
          })
        );
      }
      if (Array.isArray(materialRequests)) {
        promises.push(
          fetch(`${REALTIME_DB_URL}/materialRequests.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(materialRequests),
          })
        );
      }
      if (Array.isArray(inventoryLogs)) {
        promises.push(
          fetch(`${REALTIME_DB_URL}/inventoryLogs.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
        fetch(`${REALTIME_DB_URL}/inventoryItems.json`),
        fetch(`${REALTIME_DB_URL}/materialRequests.json`),
        fetch(`${REALTIME_DB_URL}/inventoryLogs.json`),
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

  async deleteInventoryItem(itemId) {
    try {
      if (!itemId) return false;
      // Also delete from direct endpoint if present
      await fetch(`${REALTIME_DB_URL}/inventoryItems/${encodeURIComponent(itemId)}.json`, {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  },

  async deleteWorkspaceArchive(workspaceId) {
    try {
      if (!workspaceId) return false;
      const url = `${REALTIME_DB_URL}/workspaces/${encodeURIComponent(workspaceId)}.json`;
      await fetch(url, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  },

  async saveWorkspaceArchive(workspace) {
    try {
      if (!workspace || !workspace.id) return null;
      const url = `${REALTIME_DB_URL}/workspaces/${encodeURIComponent(workspace.id)}.json`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspace),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  async getWorkspaceArchive(workspaceId) {
    try {
      const url = `${REALTIME_DB_URL}/workspaces/${encodeURIComponent(workspaceId)}.json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async pullAllWorkspaces() {
    try {
      const url = `${REALTIME_DB_URL}/workspaces.json`;
      const res = await fetch(url);
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
      const url = `${REALTIME_DB_URL}/snapshots/${snapKey}.json`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const url = `${REALTIME_DB_URL}/state.json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('Realtime cloud pull note (offline):', err?.message);
      return null;
    }
  },

  listenToChanges(onUpdate) {
    if (typeof window === 'undefined') return () => {};

    let eventSource = null;
    let pollInterval = null;
    let stopped = false;

    const connectStream = () => {
      if (stopped) return;
      try {
        if (window.EventSource) {
          eventSource = new EventSource(`${REALTIME_DB_URL}/state.json`);
          eventSource.addEventListener('put', (e) => {
            try {
              const payload = JSON.parse(e.data);
              if (payload && payload.data) {
                if (payload.path === '/' || !payload.path) {
                  onUpdate(payload.data);
                }
              }
            } catch (err) {
              console.warn('SSE message parse error:', err);
            }
          });

          eventSource.onerror = () => {
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            if (!stopped) setTimeout(connectStream, 4000);
          };
        }
      } catch (err) {
        console.warn('EventSource initialization note:', err);
      }
    };

    connectStream();

    // Periodic fallback poll (every 4 seconds) to ensure mobile phones wake up and sync instantly on unlock
    pollInterval = setInterval(async () => {
      if (stopped) return;
      try {
        const cloudState = await firebaseRealtime.pullState();
        if (cloudState && cloudState.lastUpdated) {
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
    }, 4000);

    // Sync immediately on window focus / tab visibility change (e.g. user opens phone or switches back to tab)
    const handleFocus = async () => {
      try {
        const cloudState = await firebaseRealtime.pullState();
        if (cloudState && cloudState.lastUpdated) {
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
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus();
    });

    return () => {
      stopped = true;
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  },
};

export default firebaseConfig;
