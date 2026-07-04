// src/services/notificationService.js
//
// Used by: app/doctor/notifications.js
//
// Example usage:
//   import { getNotifications, markAllRead, markRead } from '../../src/services/notificationService';
//   useEffect(() => { getNotifications().then(setNotifs); }, []);

import api from './api';

// GET /notifications
export async function getNotifications(params = {}) {
   const { data } = await api.get('/notifications', { params });
   return data;
}

// PATCH /notifications/:id/read
export async function markRead(id) {
   const { data } = await api.patch(`/notifications/${id}/read`);
   return data;
}

// PATCH /notifications/read-all
export async function markAllRead() {
   const { data } = await api.patch('/notifications/read-all');
   return data;
}
