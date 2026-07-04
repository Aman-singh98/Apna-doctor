//
// Used by: app/patient/medical-history.js
// Same pattern as recordService.js / profileService.js.

import api from './api';

// GET /patient/medical-history → { conditions, allergies, medications, updatedAt }
export async function getMyMedicalHistory() {
   const { data } = await api.get('/patient/medical-history');
   return data;
}

// PUT /patient/medical-history
// body: { conditions: string[], allergies: string[], medications: string[] }
export async function updateMyMedicalHistory(history) {
   const { data } = await api.put('/patient/medical-history', history);
   return data;
}
