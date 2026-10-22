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

export default firebaseConfig;
