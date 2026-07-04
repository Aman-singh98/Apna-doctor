// src/services/patientDoctorService.js
//
// Used by: app/patient/doctor-list.js, app/patient/doctor-detail.js,
//          app/patient/book-appointment.js

import api from './api';

// GET /api/patient/doctors?specialization=&search=
export async function getDoctors(params = {}) {
   const { data } = await api.get('/patient/doctors', { params });
   return data;
}

// GET /api/patient/doctors/:id
export async function getDoctorById(id) {
   const { data } = await api.get(`/patient/doctors/${id}`);
   return data;
}

// GET /api/patient/doctors/:id/availability?date=YYYY-MM-DD
// Returns { activeSlots, bookedSlots, availableSlots }
export async function getAvailability(doctorId, isoDate) {
   const { data } = await api.get(`/patient/doctors/${doctorId}/availability`, {
      params: { date: isoDate },
   });
   return data;
}
