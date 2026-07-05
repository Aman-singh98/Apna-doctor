// src/services/appointmentService.js
//
// Used by: app/doctor/appointments.js, app/doctor/dashboard.js
//
// Replace the hardcoded `initialAppointments` array in those screens with
// calls to these functions. Example (in appointments.js):
//
//   import { getAppointments, completeAppointment } from '../../src/services/appointmentService';
//
//   useEffect(() => {
//     getAppointments({ status: activeFilter })
//       .then(setAppointments)
//       .catch(err => Alert.alert('Error', 'Could not load appointments.'));
//   }, [activeFilter]);
//
// Adjust the route paths below (`/appointments`, `/appointments/:id/complete`)
// to match your actual backend exactly — these are best guesses based on
// the REST pattern in doctorRoutes.js.

import api from './api';

// GET /appointments  (optionally filtered by status: 'upcoming' | 'completed')
export async function getAppointments(params = {}) {
   const { data } = await api.get('/appointments', { params });
   return data;
}

// GET /appointments/:id
export async function getAppointmentById(id) {
   const { data } = await api.get(`/appointments/${id}`);
   return data;
}

// PATCH /appointments/:id/complete
export async function completeAppointment(id) {
   const { data } = await api.patch(`/appointments/${id}/complete`);
   return data;
}

// PATCH /appointments/:id/cancel   (body: { reason })
export async function cancelAppointment(id, reason) {
   const { data } = await api.patch(`/appointments/${id}/cancel`, { reason });
   return data;
}

// GET /appointments/today  → used by dashboard.js for "Today's appointments"
export async function getTodayAppointments() {
   const { data } = await api.get('/appointments/today');
   return data;
}

// GET /appointments/:id/history  → patient's medical history + past prescriptions,
// used by app/doctor/patient-history.js (opened from the "History & Rx" link
// on the appointment detail modal)
export async function getPatientHistory(appointmentId) {
   const { data } = await api.get(`/appointments/${appointmentId}/history`);
   return data;
}
