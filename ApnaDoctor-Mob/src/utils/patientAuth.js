// Utility wrapper around the patient auth service — kept for import-path
// consistency with utils/doctorAuth.js on the doctor side.
//
// NOTE: This file previously contained a stray copy of the
// PatientSignupScreen component instead of these exports, which is why
// `import { submitPatientSignup } from './utils/patientAuth'` in
// patient-signup.js was resolving to `undefined` and throwing before any
// API request could fire.

export {
   sendOtp,
   verifyOtp,
   acceptTerms,
   submitPatientSignup,
   logoutPatient,
} from '../services/patientAuthService';
