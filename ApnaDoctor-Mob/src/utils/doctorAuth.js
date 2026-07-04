// app/utils/doctorAuth.js
//
// Central helper for the doctor auth + onboarding flow. Imported by:
// index.js, otp.js, doctor-terms.js, doctor-signup.js, doctor-pending.js.
//
// Endpoint paths (confirmed against server.js):
//   POST /doctor/auth/send-otp         → doctorAuthController.sendOtpHandler
//   POST /doctor/auth/verify-otp       → doctorAuthController.verifyOtpHandler
//   GET  /doctor/me/status             → doctorMeController.getStatus
//   POST /doctor/me/accept-terms       → doctorMeController.acceptTerms
//   POST /doctor/me/signup (multipart) → doctorMeController.completeSignup
//
// NOTE: doctorMe.js uses the simple `middleware/auth.js` (valid token only),
// while doctorProfileRoutes.js (dashboard/availability) uses `doctorProtect`
// (valid token + approved). It isn't mounted in server.js yet — see the
// server.js change needed alongside this file.

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { clearToken, saveToken } from '../services/authStorage';

const DEV_APPROVED_KEY = '__dev_doctor_approved__';

// ── OTP ──────────────────────────────────────────────────────────────────
export async function sendOtp(phone) {
   const { data } = await api.post('/doctor/auth/send-otp', { phone });
   return data;
}

// Verifies OTP, saves the JWT, and returns the doctor object
// { hasAcceptedTerms, approvalStatus } straight from the server response,
// exactly as otp.js expects — no second request needed.
export async function verifyOtp(phone, otp) {
   const { data } = await api.post('/doctor/auth/verify-otp', { phone, otp });
   if (!data?.token) {
      throw new Error('No token returned from server.');
   }
   await saveToken(data.token);
   return data.doctor;
}

// ── Onboarding status (doctor-pending.js) ───────────────────────────────
// { approvalStatus, rejectionReason, suspensionReason }
export async function getFullStatus() {
   const { data } = await api.get('/doctor/me/status');

   // Dev-only local override — see __devApproveDoctor below.
   if (await getDevOverride()) {
      return { ...data, approvalStatus: 'approved' };
   }
   return data;
}

export async function markTermsAccepted() {
   const { data } = await api.post('/doctor/me/accept-terms');
   return data;
}

// ── Signup submission (doctor-signup.js, multipart) ─────────────────────
export async function submitDoctorSignup({ name, qualification, regNumber, hospital, experience, specialization, documents }) {
   const form = new FormData();
   form.append('name', name);
   form.append('qualification', qualification);
   form.append('regNumber', regNumber);
   form.append('hospital', hospital || '');
   form.append('experience', experience || '');
   form.append('specialization', specialization);

   Object.entries(documents).forEach(([fieldName, file]) => {
      form.append(fieldName, { uri: file.uri, name: file.name, type: file.type });
   });

   const { data } = await api.post('/doctor/me/signup', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
   });
   return data;
}

// ── Dev-only approval override ───────────────────────────────────────────
// Backs doctor-pending.js's "[Dev] Simulate Admin Approval" button. Stores
// a local-only flag — never touches the backend. Delete this + that button
// once real admin approval is wired end-to-end.
async function getDevOverride() {
   try {
      return (await AsyncStorage.getItem(DEV_APPROVED_KEY)) === 'true';
   } catch {
      return false;
   }
}

export async function __devApproveDoctor() {
   await AsyncStorage.setItem(DEV_APPROVED_KEY, 'true');
}

export async function logout() {
   await clearToken();
   await AsyncStorage.removeItem(DEV_APPROVED_KEY);
}
