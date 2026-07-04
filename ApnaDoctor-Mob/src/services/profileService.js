// src/services/profileService.js
//
// Used by: app/doctor/profile.js, app/doctor/profile-edit.js

import api from './api';

// GET /doctor/profile/me  → full doctor document (minus password)
export async function getMyProfile() {
   const { data } = await api.get('/doctor/profile/me');
   return data;
}

// PATCH /doctor/profile/me
// body: { name, qualification, experience, hospital, videoFee, chatFee, bio, specialization }
export async function updateMyProfile(updates) {
   const { data } = await api.patch('/doctor/profile/me', updates);
   return data;
}

// POST /doctor/profile/me/photo  (multipart/form-data, field name: "photo")
export async function uploadMyPhoto(fileUri) {
   const formData = new FormData();
   formData.append('photo', {
      uri: fileUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
   });

   const { data } = await api.post('/doctor/profile/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
   });
   return data;
}
