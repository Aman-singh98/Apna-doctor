// src/services/doctorReviewService.js
//
// Used by: app/doctor/profile.js, app/doctor/dashboard.js
//
// Adjust the `import api from './api'` path/instance if your other doctor
// services (e.g. appointmentService.js) import it differently.

import api from './api';

// GET /doctor/reviews/mine
// Returns { reviews, avgRating, count } for the logged-in doctor.
export async function getMyReviews() {
   const { data } = await api.get('/doctor/reviews/mine');
   return data;
}
