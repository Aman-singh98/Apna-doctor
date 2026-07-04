// src/services/authStorage.js
//
// Tiny wrapper around AsyncStorage for the doctor's JWT token.
// You said you'll build login yourself — this file is the "contract"
// your login screen needs to follow so the rest of the app (api.js)
// keeps working automatically.
//
// WHEN YOU BUILD LOGIN, do this on a successful login response:
//     import { saveToken } from '../services/authStorage';
//     await saveToken(response.data.token);
//
// On logout, do this:
//     import { clearToken } from '../services/authStorage';
//     await clearToken();
//
// That's the entire integration. Nothing else in the app needs to change.

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'doctor_auth_token';

export async function saveToken(token) {
   try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
   } catch (err) {
      console.error('Failed to save auth token:', err);
   }
}

export async function getToken() {
   try {
      return await AsyncStorage.getItem(TOKEN_KEY);
   } catch (err) {
      console.error('Failed to read auth token:', err);
      return null;
   }
}

export async function clearToken() {
   try {
      await AsyncStorage.removeItem(TOKEN_KEY);
   } catch (err) {
      console.error('Failed to clear auth token:', err);
   }
}
