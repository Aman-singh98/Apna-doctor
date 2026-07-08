// src/services/authStorage.js
//
// Role-namespaced JWT storage. A single device can hold a valid patient
// token AND a valid doctor token at the same time — they no longer share
// one AsyncStorage key and overwrite each other.
//
// `active_auth_role` tracks whichever role most recently logged in, so the
// shared axios instance in api.js knows which token to attach to a given
// request without every call site having to specify a role explicitly.
//
// USAGE:
//   Patient login:  await savePatientToken(token)
//   Doctor login:   await saveDoctorToken(token)
//   Patient logout: await clearPatientToken()
//   Doctor logout:  await clearDoctorToken()
//   api.js interceptor: await getActiveToken()

import AsyncStorage from '@react-native-async-storage/async-storage';

const PATIENT_TOKEN_KEY = 'patient_auth_token';
const DOCTOR_TOKEN_KEY = 'doctor_auth_token';
const ACTIVE_ROLE_KEY = 'active_auth_role'; // 'patient' | 'doctor'

// ── Patient token ────────────────────────────────────────────────────────
export async function savePatientToken(token) {
   try {
      await AsyncStorage.setItem(PATIENT_TOKEN_KEY, token);
      await AsyncStorage.setItem(ACTIVE_ROLE_KEY, 'patient');
   } catch (err) {
      console.error('Failed to save patient auth token:', err);
   }
}

export async function getPatientToken() {
   try {
      return await AsyncStorage.getItem(PATIENT_TOKEN_KEY);
   } catch (err) {
      console.error('Failed to read patient auth token:', err);
      return null;
   }
}

export async function clearPatientToken() {
   try {
      await AsyncStorage.removeItem(PATIENT_TOKEN_KEY);
      const active = await AsyncStorage.getItem(ACTIVE_ROLE_KEY);
      if (active === 'patient') {
         await AsyncStorage.removeItem(ACTIVE_ROLE_KEY);
      }
   } catch (err) {
      console.error('Failed to clear patient auth token:', err);
   }
}

// ── Doctor token ─────────────────────────────────────────────────────────
export async function saveDoctorToken(token) {
   try {
      await AsyncStorage.setItem(DOCTOR_TOKEN_KEY, token);
      await AsyncStorage.setItem(ACTIVE_ROLE_KEY, 'doctor');
   } catch (err) {
      console.error('Failed to save doctor auth token:', err);
   }
}

export async function getDoctorToken() {
   try {
      return await AsyncStorage.getItem(DOCTOR_TOKEN_KEY);
   } catch (err) {
      console.error('Failed to read doctor auth token:', err);
      return null;
   }
}

export async function clearDoctorToken() {
   try {
      await AsyncStorage.removeItem(DOCTOR_TOKEN_KEY);
      const active = await AsyncStorage.getItem(ACTIVE_ROLE_KEY);
      if (active === 'doctor') {
         await AsyncStorage.removeItem(ACTIVE_ROLE_KEY);
      }
   } catch (err) {
      console.error('Failed to clear doctor auth token:', err);
   }
}

// ── Active role (whichever logged in most recently) ─────────────────────
// Used by api.js's request interceptor to decide which token to attach,
// and by its response interceptor to decide which token to clear on 401.
export async function getActiveRole() {
   try {
      return await AsyncStorage.getItem(ACTIVE_ROLE_KEY);
   } catch (err) {
      console.error('Failed to read active auth role:', err);
      return null;
   }
}

export async function getActiveToken() {
   const role = await getActiveRole();
   if (role === 'doctor') return getDoctorToken();
   if (role === 'patient') return getPatientToken();
   return null;
}

export async function clearActiveToken() {
   const role = await getActiveRole();
   if (role === 'doctor') return clearDoctorToken();
   if (role === 'patient') return clearPatientToken();
}
