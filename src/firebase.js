// Firebase Web App Configuration for Bondtex MES
// Project ID: bondtexlk-f16f5

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_REPLACE_WITH_YOUR_KEY",
  authDomain: "bondtexlk-f16f5.firebaseapp.com",
  projectId: "bondtexlk-f16f5",
  storageBucket: "bondtexlk-f16f5.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "184963124129",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:184963124129:web:bondtexmes",
};

let app = null;

/**
 * Initializes and returns the Firebase app instance safely
 */
export async function getFirebaseApp() {
  if (app) return app;
  try {
    const { initializeApp } = await import('firebase/app');
    app = initializeApp(firebaseConfig);
    return app;
  } catch (err) {
    console.warn('Firebase SDK not loaded or running in standalone mode:', err?.message);
    return null;
  }
}

export default getFirebaseApp;
