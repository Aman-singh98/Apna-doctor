// src/services/patientAppointmentService.js
//
// Used by: app/patient/appointments.js
//
// Distinct from src/services/appointmentService.js, which is doctor-facing.
// This one talks to the patient-scoped endpoints.

import api from './api';

// GET /api/patient/appointments
export async function getAppointments() {
   const { data } = await api.get('/patient/appointments');
   return data;
}

// POST /api/patient/appointments
// payload: { doctorId, date (ISO string), type: 'Video'|'Audio'|'Chat', familyMemberId?, fee? }
export async function bookAppointment(payload) {
   const { data } = await api.post('/patient/appointments', payload);
   return data;
}

// GET /api/patient/appointments/:id
export async function getAppointmentById(id) {
   const { data } = await api.get(`/patient/appointments/${id}`);
   return data;
}

// PATCH /api/patient/appointments/:id/cancel   (body: { reason })
export async function cancelAppointment(id, reason) {
   const { data } = await api.patch(`/patient/appointments/${id}/cancel`, { reason });
   return data;
}

// PATCH /api/patient/appointments/:id/reschedule   (body: { date })
// `date` must be an ISO datetime string for the new slot.
export async function rescheduleAppointment(id, date) {
   const { data } = await api.patch(`/patient/appointments/${id}/reschedule`, { date });
   return data;
}
