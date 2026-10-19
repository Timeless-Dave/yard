// Cheap online flag with no Firebase SDK. Landing and local games can
// import this without downloading the 700kB vendor chunk.
const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

export const ONLINE = Boolean(
  USE_EMULATORS
  || (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID)
);
