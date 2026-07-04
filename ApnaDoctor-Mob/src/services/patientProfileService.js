// src/services/patientProfileService.js
//
// Used by: app/patient/profile.js, app/patient/profile-edit.js
// Mirrors src/services/profileService.js (the doctor equivalent).

import api from './api';

// GET /patient/me  → full patient document (photo, name, email, etc.)
export async function getMyPatientProfile() {
   const { data } = await api.get('/patient/me');
   return data;
}

// POST /patient/me/photo  (multipart/form-data, field name: "photo")
// fileUri: local URI returned by expo-image-picker (result.assets[0].uri)
export async function uploadMyPatientPhoto(fileUri) {
   const formData = new FormData();
   formData.append('photo', {
      uri: fileUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
   });

   const { data } = await api.post('/patient/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
   });
   return data; // { photo: { url } }
}
