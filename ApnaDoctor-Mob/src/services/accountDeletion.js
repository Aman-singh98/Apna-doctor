// utils/accountDeletion.js
//
// Shared "Delete Account Permanently" API calls for both roles, following
// the same pattern as doctorAuth.js (no raw API calls inside screens).
//
// ASSUMPTION: services/api.js already attaches the Bearer token via a
// request interceptor (that's implied by doctorAuth.js's verifyOtp/sendOtp
// calls never setting an Authorization header manually). If that's not the
// case, pass the token in explicitly here — happy to adjust once I can see
// api.js.
//
// Backend routes (see routes/accountDeletionRoutes.js):
//   POST /api/patient/account/delete
//   POST /api/patient/account/cancel-delete
//   POST /api/doctor/account/delete
//   POST /api/doctor/account/cancel-delete

// ─── ACCOUNT DELETION FLOW (Patient + Doctor) ──────────────────────────────
//
// 1. REQUEST   User taps "Delete Account Permanently" in Settings.
//              → POST /api/{patient|doctor}/account/delete
//              → accountStatus: 'active' → 'pending_deletion'
//              → deletionScheduledAt set to now + 15 days (grace period)
//              → Patient: their upcoming appointments are auto-cancelled
//              → Doctor:  blocked if upcoming appointments exist (must
//                         resolve first); otherwise pulled off the
//                         bookable-doctors list (available: false)
//              → User is signed out locally but the account is NOT deleted yet
//
// 2. GRACE     Account sits as 'pending_deletion' for 15 days.
//    PERIOD    → Login is disallowed while in this state (add check in
//              verify-otp controller)
//              → User can undo any time before the deadline:
//                → POST /api/{patient|doctor}/account/cancel-delete
//                → accountStatus reverts to 'active'
//
// 3. FINALIZE  A daily background job (jobs/accountDeletionJob.js) checks
//              for accounts past deletionScheduledAt and:
//              → Anonymizes PII (name, phone, email, photo, etc.)
//              → Sets accountStatus: 'deleted', deletedAt: now
//              → Document is NEVER removed — Appointments, Prescriptions,
//                and Reviews keep a valid ref (satisfies medical/financial
//                retention rules) while the identity behind them is scrubbed
// ─────────────────────────────────────────────────────────────────────────

import api from '../services/api';

export async function requestAccountDeletion(role) {
   const base = role === 'doctor' ? '/doctor/account' : '/patient/account';
   const res = await api.post(`${base}/delete`);
   return res.data; // { success, message, scheduledFor }
}

export async function cancelAccountDeletion(role) {
   const base = role === 'doctor' ? '/doctor/account' : '/patient/account';
   const res = await api.post(`${base}/cancel-delete`);
   return res.data; // { success, message }
}
