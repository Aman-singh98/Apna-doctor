// utils/doctorAuth.js
//
// All doctor auth API calls and local token management live here.
// The screens (otp.js, doctor-terms.js, doctor-signup.js, doctor-pending.js)
// import from this file — no raw API calls in screen components.

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const TOKEN_KEY       = 'doctor_auth_token';
const DOCTOR_KEY      = 'doctor_data';

// ── Token helpers ──────────────────────────────────────────────────────────────

export async function saveAuthData(token, doctor) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY,  token],
    [DOCTOR_KEY, JSON.stringify(doctor)],
  ]);
}

export async function clearAuthData() {
  await AsyncStorage.multiRemove([TOKEN_KEY, DOCTOR_KEY]);
}

// ── OTP flow ───────────────────────────────────────────────────────────────────

export async function sendOtp(phone) {
  const res = await api.post('/doctor/auth/send-otp', { phone });
  return res.data; // { success, message }
}

// Returns { hasAcceptedTerms, approvalStatus } so the calling screen
// can decide which route to push without a second network call.
export async function verifyOtp(phone, otp) {
  const res = await api.post('/doctor/auth/verify-otp', { phone, otp });
  const { token, doctor } = res.data;
  await saveAuthData(token, doctor);
  return doctor; // { hasAcceptedTerms, approvalStatus }
}

// ── Used by otp.js after successful verify ────────────────────────────────────

export async function hasAcceptedTerms() {
  const raw = await AsyncStorage.getItem(DOCTOR_KEY);
  if (!raw) return false;
  return JSON.parse(raw).hasAcceptedTerms === true;
}

export async function getApprovalStatus() {
  // Always fetch fresh from server — cached status can be stale
  try {
    const res = await api.get('/doctor/me/status');
    return res.data.approvalStatus;
  } catch {
    // Fall back to local cache if network fails
    const raw = await AsyncStorage.getItem(DOCTOR_KEY);
    return raw ? JSON.parse(raw).approvalStatus : null;
  }
}

// ── Used by doctor-terms.js ───────────────────────────────────────────────────

export async function markTermsAccepted() {
  await api.post('/doctor/me/accept-terms');
  // Update local cache so hasAcceptedTerms() returns true immediately
  const raw = await AsyncStorage.getItem(DOCTOR_KEY);
  if (raw) {
    const data = JSON.parse(raw);
    data.hasAcceptedTerms = true;
    await AsyncStorage.setItem(DOCTOR_KEY, JSON.stringify(data));
  }
}

// ── Used by doctor-signup.js ──────────────────────────────────────────────────
//
// documents: { medicalLicense: { uri, name, type }, idProof: { uri, name, type } }
// These come from expo-document-picker or expo-image-picker results.
// The mock in doctor-signup.js passes fake strings — replace them with
// real file objects once you wire up a real picker.

export async function submitDoctorSignup({ name, qualification, regNumber, hospital, experience, specialization, documents }) {
  const form = new FormData();

  form.append('name',           name);
  form.append('qualification',  qualification);
  form.append('regNumber',      regNumber);
  form.append('hospital',       hospital || '');
  form.append('experience',     String(experience || ''));
  form.append('specialization', specialization);

  // Append real file objects when you replace the mock uploader.
  // Format expected by React Native FormData:
  //   form.append('medicalLicense', { uri, name, type });
  if (documents.medicalLicense?.uri) {
    form.append('medicalLicense', {
      uri:  documents.medicalLicense.uri,
      name: documents.medicalLicense.name || 'medicalLicense.pdf',
      type: documents.medicalLicense.type || 'application/pdf',
    });
  }
  if (documents.idProof?.uri) {
    form.append('idProof', {
      uri:  documents.idProof.uri,
      name: documents.idProof.name || 'idProof.pdf',
      type: documents.idProof.type || 'application/pdf',
    });
  }

  const res = await api.post('/doctor/me/signup', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// ── DEV ONLY: simulate admin approval locally ─────────────────────────────────
// Used by the [Dev] button in doctor-pending.js. Remove once real admin is live.
export async function __devApproveDoctor() {
  const raw = await AsyncStorage.getItem(DOCTOR_KEY);
  if (!raw) return;
  const data = JSON.parse(raw);
  data.approvalStatus = 'approved';
  await AsyncStorage.setItem(DOCTOR_KEY, JSON.stringify(data));
}
