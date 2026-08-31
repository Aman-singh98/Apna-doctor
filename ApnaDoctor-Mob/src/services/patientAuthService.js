// Used by: app/otp.js, app/patient-terms.js, app/patient-signup.js,
// app/settingsScreen.js (via utils/patientAuth.js re-export)
//
// Patient-side auth actions — sendOtp, verifyOtp, acceptTerms, signup.
//
// Token storage: uses the patient-specific slot in authStorage.js
// (savePatientToken/clearPatientToken) — separate from the doctor token,
// so logging into one role never overwrites the other's session. The
// shared `api` instance always attaches whichever role logged in most
// recently (see authStorage.js's `active_auth_role` tracking), so no extra
// wiring is needed on any individual request here.

import api from './api';
import { savePatientToken, clearPatientToken } from './authStorage';

// POST /patient/auth/send-otp
// body: { phone }
export async function sendOtp(phone) {
   const { data } = await api.post('/patient/auth/send-otp', { phone });
   return data;
}

// POST /patient/auth/verify-otp
// body: { phone, otp } → { token, hasAcceptedTerms, hasCompletedProfile }
// Saves the token under the patient-specific storage key so the shared
// `api` instance starts attaching it to every request automatically once
// this becomes the active role — no extra wiring needed.
export async function verifyOtp(phone, otp) {
   const { data } = await api.post('/patient/auth/verify-otp', { phone, otp });
   if (data?.token) {
      await savePatientToken(data.token);
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

// Call on patient logout / account deletion.
export async function logoutPatient() {
   await clearPatientToken();
}
