//
// Used by: app/doctor/notifications.js
// Mirrors the pattern in recordService.js — one function per endpoint,
// each returning the raw response body.

import api from './api';

// GET /doctor/notifications?page=&limit=
export async function getMyNotifications(params = {}) {
   const { data } = await api.get('/doctor/notifications', { params });
   return data;
}

// GET /doctor/notifications/unread-count
export async function getUnreadCount() {
   const { data } = await api.get('/doctor/notifications/unread-count');
   return data; // { count }
}

// PATCH /doctor/notifications/:id/read
export async function markNotificationRead(id) {
   const { data } = await api.patch(`/doctor/notifications/${id}/read`);
   return data;
}

// PATCH /doctor/notifications/read-all
export async function markAllNotificationsRead() {
   const { data } = await api.patch('/doctor/notifications/read-all');
   return data;
}

// DELETE /doctor/notifications/clear
export async function clearAllNotifications() {
   const { data } = await api.delete('/doctor/notifications/clear');
   return data;
}

// POST /doctor/notifications/device-token
// input: { token, platform }  — platform: 'ios' | 'android' | 'web'
export async function registerDeviceToken({ token, platform }) {
   const { data } = await api.post('/doctor/notifications/device-token', { token, platform });
   return data;
}
