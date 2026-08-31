// src/services/dashboardService.js
//
// Used by: app/doctor/dashboard.js
//
// Example usage:
//   import { getDashboardStats, setAvailability } from '../../src/services/dashboardService';
//
//   useEffect(() => { getDashboardStats().then(setStats); }, []);
//
//   const toggleAvailability = async (next) => {
//     setAvailable(next); // optimistic update
//     try { await setAvailability(next); }
//     catch { setAvailable(!next); Alert.alert('Error', 'Could not update availability.'); }
//   };

import api from './api';

// GET /doctor/profile/me  → full profile, incl. name, specialization, photoUrl
export async function getMyProfile() {
   const { data } = await api.get('/doctor/profile/me');
   return data;
}

// GET /doctor/profile/me/dashboard  → { todayPatients, monthCount, todayEarnings, rating }
export async function getDashboardStats() {
   const { data } = await api.get('/doctor/profile/me/dashboard');
   return data;
}

// PATCH /doctor/profile/me/availability   body: { available: boolean }
export async function setAvailability(available) {
   const { data } = await api.patch('/doctor/profile/me/availability', { available });
   return data;
}

// GET /doctor/profile/me/reviews  → recent patient feedback
export async function getRecentReviews(params = {}) {
   const { data } = await api.get('/doctor/profile/me/reviews', { params });
   return data;
}

// GET /doctor/profile/me/schedule  → { schedule, isDefault }
export async function getSchedule() {
   const { data } = await api.get('/doctor/profile/me/schedule');
   return data;
}

// PUT /doctor/profile/me/schedule
// body: { activeDays, activeSlots, videoEnabled, audioEnabled, chatEnabled, maxPatients }
export async function updateSchedule(schedule) {
   const { data } = await api.put('/doctor/profile/me/schedule', schedule);
   return data;
}
