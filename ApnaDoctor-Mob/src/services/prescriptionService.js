import api from './api';

// GET /prescriptions  (optionally filtered by search query)
export async function getPrescriptions(params = {}) {
   const { data } = await api.get('/prescriptions', { params });
   return data;
}

// GET /prescriptions/:id
export async function getPrescriptionById(id) {
   const { data } = await api.get(`/prescriptions/${id}`);
   return data;
}

// POST /prescriptions
// body: { patientName, diagnosis, medicines: [{name, dosage, frequency, duration, instructions}], notes, followUp }
export async function createPrescription(payload) {
   const { data } = await api.post('/prescriptions', payload);
   return data;
}

// PUT /prescriptions/:id
// body: same shape as createPrescription's payload
export async function updatePrescription(id, payload) {
   const { data } = await api.put(`/prescriptions/${id}`, payload);
   return data;
}

// DELETE /prescriptions/:id
export async function deletePrescription(id) {
   const { data } = await api.delete(`/prescriptions/${id}`);
   return data;
}
