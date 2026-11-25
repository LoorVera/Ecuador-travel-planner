import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Configuración web de Firebase.
 *
 * Estos valores son PÚBLICOS por diseño: Vite los inyecta en el bundle del
 * navegador y la seguridad real la aplican las reglas de Firestore/Storage.
 * Se leen de variables de entorno VITE_* para no tener credenciales escritas
 * en el código (ver .env.example).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Falta la configuración pública de Firebase. Define VITE_FIREBASE_* en .env.local (ver .env.example).',
  );
}

const app = initializeApp(firebaseConfig);

// Exportamos auth y db para que Zustand y los componentes puedan usarlos
export const auth = getAuth(app);
export const db = getFirestore(app);
