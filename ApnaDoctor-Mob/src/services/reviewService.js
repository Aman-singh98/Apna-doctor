// src/services/reviewService.js
//
// Used by: app/patient/appointments.js, app/patient/doctor-detail.js
//
// Adjust the `import api from './api'` path/instance if your project's other
// services (e.g. appointmentService.js) import it differently.

import api from './api';

// POST /patient/reviews   body: { appointmentId, rating, comment }
export async function addReview({ appointmentId, rating, comment }) {
   const { data } = await api.post('/patient/reviews', { appointmentId, rating, comment });
   return data;
}

// PUT /patient/reviews/:id   body: { rating, comment }
export async function updateReview(reviewId, { rating, comment }) {
   const { data } = await api.put(`/patient/reviews/${reviewId}`, { rating, comment });
   return data;
}

// DELETE /patient/reviews/:id
export async function deleteReview(reviewId) {
   const { data } = await api.delete(`/patient/reviews/${reviewId}`);
   return data;
}

// GET /patient/reviews/mine
// Returns the logged-in patient's own reviews (used to know, per completed
// appointment, whether it's already been reviewed).
export async function getMyReviews() {
   const { data } = await api.get('/patient/reviews/mine');
   return data;
}

// GET /patient/reviews/doctor/:doctorId
// Returns { reviews, avgRating, count } for a doctor's profile page.
export async function getDoctorReviews(doctorId) {
   const { data } = await api.get(`/patient/reviews/doctor/${doctorId}`);
   return data;
}
