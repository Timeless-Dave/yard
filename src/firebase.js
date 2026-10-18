import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

export const ONLINE = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = ONLINE && !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = ONLINE ? getAuth(app) : null;
export const db = ONLINE ? getFirestore(app) : null;
export const rtdb = ONLINE ? getDatabase(app) : null;
export const functions = ONLINE ? getFunctions(app) : null;

if (!ONLINE) {
  console.warn(
    "[The Yard] No Firebase credentials found (VITE_FIREBASE_*). " +
      "Running in offline/single-player demo mode — see firebase/README.md to turn on multiplayer."
  );
}
