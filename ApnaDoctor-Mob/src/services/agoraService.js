// src/services/agoraService.js
//
// Used by: app/patient/consultation-call.js, app/doctor/consultation-call.js
//
// role must be 'doctor' or 'patient' — determines which protected endpoint
// gets called, matching the doctorProtect / patientProtect split used
// everywhere else in this project (see appointmentService.js vs
// patientAppointmentService.js for the same convention).

import api from './api';

export async function fetchAgoraToken(appointmentId, role) {
   const path = role === 'doctor' ? '/consultation/token' : '/patient/consultation/token';
   const { data } = await api.post(path, { appointmentId });
   return data; // { token, appId, channelName, uid, expiresAt, isDoctor, appointmentType }
}
