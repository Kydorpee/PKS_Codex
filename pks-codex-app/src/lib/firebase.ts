/**
 * Conexão com o Firebase (login anônimo + Firestore). A configuração vem do arquivo `.env`
 * (veja `.env.example`); as variáveis EXPO_PUBLIC_* entram no app na hora do build.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = !!(config.apiKey && config.projectId && config.appId);

let services: { auth: Auth; db: Firestore } | undefined;

export function firebase() {
  if (!services) {
    if (!firebaseConfigured) throw new Error('Firebase não configurado: preencha o arquivo .env.');
    const app = initializeApp(config);
    services = {
      auth: initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }),
      // Campos opcionais (undefined) são simplesmente omitidos no documento.
      db: initializeFirestore(app, { ignoreUndefinedProperties: true }),
    };
  }
  return services;
}
