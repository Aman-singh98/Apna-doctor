// ─── Firebase Client Config (Expo app) ────────────────────────────────────────
// These values come from: Firebase Console → Project Settings → General →
// "Your apps" → select the WEB app (not the Android app) → SDK setup and
// configuration → "Config". They are PUBLIC by design (safe to ship in the
// app bundle) — this is completely different from serviceAccountKey.json,
// which must never leave your backend.
//
// npm install firebase @react-native-async-storage/async-storage
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
   apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
   authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
   projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
   storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
   messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
   appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth throws if called twice (e.g. on fast refresh) — fall back
// to getAuth() in that case.
let firebaseAuth;
try {
   firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
   });
} catch (e) {
   firebaseAuth = getAuth(app);
}

// React Native's networking stack doesn't fully support the streaming
// connection (WebChannel) Firestore uses by default — this often surfaces
// as "Failed to get document because the client is offline" even when the
// device has a perfectly good connection. experimentalForceLongPolling
// switches Firestore to plain HTTP long-polling, which works reliably on RN.
export const firestore = initializeFirestore(app, {
   experimentalForceLongPolling: true,
   useFetchStreams: false,
});

export const firebaseAuthInstance = firebaseAuth;
