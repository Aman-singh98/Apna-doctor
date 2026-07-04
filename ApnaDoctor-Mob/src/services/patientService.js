// src/services/patientService.js
//
// Used by: app/doctor/patients.js
//
// Example usage:
//   import { getPatients } from '../../src/services/patientService';
//   useEffect(() => { getPatients({ search: query }).then(setPatients); }, [query]);

import api from './api';

// GET /patients  (optionally filtered by ?search=name-or-condition)
export async function getPatients(params = {}) {
   const { data } = await api.get('/patients', { params });
   return data;
}

// GET /patients/:id  → full patient detail + visit history
export async function getPatientById(id) {
   const { data } = await api.get(`/patients/${id}`);
   return data;
}

// GET /api/patient/me
export async function getMyProfile() {
   const { data } = await api.get('/patient/me');
   return data;
}
