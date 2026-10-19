import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { ONLINE } from "./onlineConfig.js";
export { ONLINE };

// VITE_USE_EMULATORS=true points the app at the local Firebase emulator
// suite (see `npm run test:e2e`) instead of a real project.
const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === "true";

const firebaseConfig = USE_EMULATORS
  ? {
      apiKey: "demo-key",
      authDomain: "demo-yard.firebaseapp.com",
      projectId: "demo-yard",
      appId: "demo-app",
      databaseURL: "http://127.0.0.1:9000?ns=demo-yard-default-rtdb",
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    };

const app = ONLINE ? getApps()[0] ?? initializeApp(firebaseConfig) : null;

export const auth = ONLINE ? getAuth(app) : null;
export const db = ONLINE ? getFirestore(app) : null;
export const rtdb = ONLINE ? getDatabase(app) : null;
export const functions = ONLINE ? getFunctions(app) : null;

if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectDatabaseEmulator(rtdb, "127.0.0.1", 9000);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

if (!ONLINE) {
  console.info(
    "[The Yard] Running single-player — no Firebase config (VITE_FIREBASE_*) was provided at build time. " +
      "See firebase/README.md to turn on accounts and multiplayer."
  );
}
