// Used by: app/otp.js, app/patient-terms.js, app/patient-signup.js
//
// Patient-side auth actions — sendOtp, verifyOtp, acceptTerms, signup.
//
// IMPORTANT: this uses the same shared `api` instance and the same token
// storage (authStorage.js) as the rest of the app — NOT a separate patient
// token key. api.js only attaches a token by calling authStorage.getToken(),
// so verifyOtp() below saves the token via authStorage.saveToken(). If a
// patient's token were stored anywhere else, every authenticated request
// (accept-terms, signup, and any future patient-protected route) would go
// out with no Authorization header and fail with 401.
//
// This also means a device is effectively logged in as ONE identity at a
// time (whichever token was last saved — doctor or patient). That matches
// the login screen's role switcher (pick doctor or patient, then log in),
// so it should be fine — but flagging it in case the app ever needs a
// doctor and patient session active simultaneously on the same device.

import api from './api';
import { saveToken, clearToken } from './authStorage';

// POST /patient/auth/send-otp
// body: { phone }
export async function sendOtp(phone) {
   const { data } = await api.post('/patient/auth/send-otp', { phone });
   return data;
}

// POST /patient/auth/verify-otp
// body: { phone, otp } → { token, hasAcceptedTerms, hasCompletedProfile }
// Saves the token via authStorage so the shared `api` instance starts
// attaching it to every request automatically — no extra wiring needed.
export async function verifyOtp(phone, otp) {
   const { data } = await api.post('/patient/auth/verify-otp', { phone, otp });
   if (data?.token) {
      await saveToken(data.token);
   }
   return data;
}

// POST /patient/me/accept-terms  (JWT required — attached automatically)
export async function acceptTerms() {
   const { data } = await api.post('/patient/me/accept-terms');
   return data;
}

// POST /patient/me/signup  (JWT required)
// body: { name, email, gender, dob, bloodGroup, weight }
export async function submitPatientSignup(payload) {
   const { data } = await api.post('/patient/me/signup', payload);
   return data;
}

// Call on patient logout.
export async function logoutPatient() {
   await clearToken();
}