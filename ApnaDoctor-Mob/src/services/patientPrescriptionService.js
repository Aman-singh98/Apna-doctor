import api from './api';

// GET /patient/prescriptions  (optionally filtered by search query)
export async function getMyPrescriptions(params = {}) {
   const { data } = await api.get('/patient/prescriptions', { params });
   return data;
}

// GET /patient/prescriptions/:id
export async function getMyPrescriptionById(id) {
   const { data } = await api.get(`/patient/prescriptions/${id}`);
   return data;
}
