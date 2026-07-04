// src/services/api.js
//
// Single shared axios instance for the whole app.
// Every service file (appointmentService, prescriptionService, etc.)
// imports `api` from here instead of creating its own axios calls.
//
// WHY THIS FILE EXISTS:
// - One place to set the base URL (from .env)
// - One place to attach the doctor's JWT token to every request
// - One place to handle "token expired" globally
//
// You said login isn't built yet — that's fine. This file is ready
// for it. Once you build login, just call:
//     await saveToken(jwtFromLoginResponse)
// (see authStorage.js) and every request after that will automatically
// carry the token. You don't need to touch this file again.

import axios from 'axios';
import { getToken, clearToken } from './authStorage';

// ── Base URL ────────────────────────────────────────────────────────────────
// Pulled from .env (EXPO_PUBLIC_API_URL). Must be prefixed with
// EXPO_PUBLIC_ or Expo will not expose it to app code at runtime.
//
// IMPORTANT (read this before you debug a "network error" for an hour):
// - iOS Simulator:      http://localhost:5000/api  →  works
// - Android Emulator:   http://localhost:5000/api  →  DOES NOT work
//                       use   http://10.0.2.2:5000/api   instead
// - Physical phone (either OS): http://localhost:5000/api → DOES NOT work
//                       use your laptop's LAN IP, e.g. http://192.168.1.50:5000/api
//                       (find it with `ipconfig` on Windows or `ifconfig` on Mac/Linux,
//                       and make sure your phone is on the same Wi-Fi as your laptop)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
   baseURL: BASE_URL,
   timeout: 15000, // 15s — fail fast instead of hanging forever on a dead connection
   headers: {
      'Content-Type': 'application/json',
      // Force the browser to always hit the network instead of doing a
      // conditional (If-None-Match/If-Modified-Since) revalidation. On web,
      // a conditional request can come back as HTTP 304 Not Modified, which
      // falls outside axios's default validateStatus range (200-299) and
      // gets treated as a request *failure* — even though the data is
      // sitting right there in the cached response. That silently breaks
      // screens like book-appointment.js (which then shows "no doctors").
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
   },
});

// ── Request interceptor: attach JWT token automatically ─────────────────────
// Runs before every single request made through `api`.
// Once you implement login and call saveToken(), this starts working
// with zero extra code anywhere else.
api.interceptors.request.use(
   async (config) => {
      const token = await getToken();
      if (token) {
         config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
   },
   (error) => Promise.reject(error)
);

// ── Response interceptor: handle expired/invalid token globally ─────────────
// If the backend ever returns 401 (Unauthorized), it usually means the
// doctor's token expired or is invalid. We clear the stored token here.
// Later, when you have a login/navigation setup, you can also redirect
// to the login screen from this spot — left as a comment so you can
// wire it in once that screen exists.
api.interceptors.response.use(
   (response) => response,
   async (error) => {
      if (error.response?.status === 401) {
         await clearToken();
         // Example, once you have a router ref available outside components:
         // router.replace('/login');
      }
      return Promise.reject(error);
   }
);

export default api;
