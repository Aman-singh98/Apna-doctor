//
// Used by: app/patient/notifications.js
// Mirrors the pattern in recordService.js — one function per endpoint,
// each returning the raw response body.

import api from './api';

// GET /patient/notifications?page=&limit=
export async function getMyNotifications(params = {}) {
   const { data } = await api.get('/patient/notifications', { params });
   return data;
}

// GET /patient/notifications/unread-count
export async function getUnreadCount() {
   const { data } = await api.get('/patient/notifications/unread-count');
   return data; // { count }
}

// PATCH /patient/notifications/:id/read
export async function markNotificationRead(id) {
   const { data } = await api.patch(`/patient/notifications/${id}/read`);
   return data;
}

// PATCH /patient/notifications/read-all
export async function markAllNotificationsRead() {
   const { data } = await api.patch('/patient/notifications/read-all');
   return data;
}

// DELETE /patient/notifications/clear
export async function clearAllNotifications() {
   const { data } = await api.delete('/patient/notifications/clear');
   return data;
}

// POST /patient/notifications/device-token
// input: { token, platform }  — platform: 'ios' | 'android' | 'web'
export async function registerDeviceToken({ token, platform }) {
   const { data } = await api.post('/patient/notifications/device-token', { token, platform });
   return data;
}
