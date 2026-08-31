// app/utils/doctorAuth.js
//
// Central helper for the doctor auth + onboarding flow. Imported by:
// index.js, otp.js, doctor-terms.js, doctor-signup.js, doctor-pending.js,
// settingsScreen.js.
//
// Endpoint paths (confirmed against server.js):
//   POST /doctor/auth/send-otp         → doctorAuthController.sendOtpHandler
//   POST /doctor/auth/verify-otp       → doctorAuthController.verifyOtpHandler
//   GET  /doctor/me/status             → doctorMeController.getStatus
//   POST /doctor/me/accept-terms       → doctorMeController.acceptTerms
//   POST /doctor/me/signup (multipart) → doctorMeController.completeSignup
//   POST /doctor/me/payout-kyc         → doctorMeController.submitPayoutKyc (Phase 3, task 19)
//
// NOTE: doctorMe.js uses the simple `middleware/auth.js` (valid token only),
// while doctorProfileRoutes.js (dashboard/availability) uses `doctorProtect`
// (valid token + approved). It isn't mounted in server.js yet — see the
// server.js change needed alongside this file.
//
// Token storage: uses the doctor-specific slot in authStorage.js
// (saveDoctorToken/clearDoctorToken) — separate from the patient token, so
// logging into one role never overwrites the other's session.

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { clearDoctorToken, saveDoctorToken } from '../services/authStorage';

const DEV_APPROVED_KEY = '__dev_doctor_approved__';

// ── OTP ──────────────────────────────────────────────────────────────────
export async function sendOtp(phone) {
   const { data } = await api.post('/doctor/auth/send-otp', { phone });
   return data;
}

// Verifies OTP, saves the JWT under the doctor-specific storage key, and
// returns the doctor object { hasAcceptedTerms, approvalStatus } straight
// from the server response, exactly as otp.js expects — no second request
// needed.
export async function verifyOtp(phone, otp) {
   const { data } = await api.post('/doctor/auth/verify-otp', { phone, otp });
   if (!data?.token) {
      throw new Error('No token returned from server.');
   }
   await saveDoctorToken(data.token);
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
export async function submitDoctorSignup({ name, qualification, regNumber, hospital, experience, specialization, documents, category }) {
   const form = new FormData();
   form.append('name', name);
   form.append('qualification', qualification);
   form.append('regNumber', regNumber);
   form.append('hospital', hospital || '');
   form.append('experience', experience || '');
   form.append('specialization', specialization);
   form.append('category', category);

   Object.entries(documents).forEach(([fieldName, file]) => {
      form.append(fieldName, { uri: file.uri, name: file.name, type: file.type });
   });

   // IMPORTANT: do NOT set 'Content-Type': 'multipart/form-data' manually
   // here. React Native's networking layer auto-generates the multipart
   // Content-Type header for a FormData body, including the required
   // `boundary=...` parameter. A manually-set header without a boundary
   // overrides that and produces a body multer can't parse (req.files
   // ends up empty, or multer throws a "boundary not found" error) — the
   // signup request fails before it ever reaches completeSignup's logic.
   // axios v1 already detects a FormData body and strips the instance's
   // default 'Content-Type: application/json' (see services/api.js) for
   // us, so we just post the form with no headers override at all.
   const { data } = await api.post('/doctor/me/signup', form);
   return data;
}

// ── Payout KYC submission (doctor-signup.js, Phase 3 task 19) ───────────
// Separate call from submitDoctorSignup because payout KYC is plain JSON
// (no files) while signup is multipart/form-data. Called right after
// signup submission succeeds — see doctor-signup.js's handleSubmit for how
// a failure here is treated as non-blocking (the profile signup itself
// still goes through even if this fails).
export async function submitPayoutKyc({
   pan,
   legalBusinessName,
   businessType,
   contactEmail,
   bankAccountNumber,
   confirmBankAccountNumber,
   ifscCode,
   upiId,
}) {
   const { data } = await api.post('/doctor/me/payout-kyc', {
      pan,
      legalBusinessName,
      businessType,
      contactEmail,
      bankAccountNumber: bankAccountNumber || undefined,
      confirmBankAccountNumber: confirmBankAccountNumber || undefined,
      ifscCode: ifscCode || undefined,
      upiId: upiId || undefined,
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

// Call on doctor logout / account deletion. Named `logout` (not
// `clearAuthData`) — settingsScreen.js must import it as
// `import { logout as clearDoctorAuthData } from '../utils/doctorAuth'`.
export async function logout() {
   await clearDoctorToken();
   await AsyncStorage.removeItem(DEV_APPROVED_KEY);
}
