// src/services/scheduleService.js
//
// Used by: app/doctor/schedule.js
//
// Example usage in handleSave():
//   import { saveSchedule } from '../../src/services/scheduleService';
//   await saveSchedule({ activeDays, activeSlots, videoEnabled, audioEnabled, chatEnabled, maxPatients });

import api from './api';

// GET /doctors/me/schedule
export async function getSchedule() {
   const { data } = await api.get('/doctors/me/schedule');
   return data;
}

// PUT /doctors/me/schedule
export async function saveSchedule(payload) {
   const { data } = await api.put('/doctors/me/schedule', payload);
   return data;
}
