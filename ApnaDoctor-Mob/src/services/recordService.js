//
// Used by: app/patient/records.js
// Mirrors the pattern in profileService.js — one function per endpoint,
// each returning the raw response body ({ success, data, message }).

import { Platform } from 'react-native';
import api from './api';

// GET /patient/records?category=&search=
// params: { category?: string, search?: string }
export async function getMyRecords(params = {}) {
   const { data } = await api.get('/patient/records', { params });
   return data;
}

// GET /patient/records/:id
export async function getRecordById(id) {
   const { data } = await api.get(`/patient/records/${id}`);
   return data;
}

// POST /patient/records  (multipart/form-data, field name: "document")
// input: { title, category, providerName, file }
// `file` is whatever expo-document-picker's result.assets[0] gives you:
//   - native (iOS/Android): { uri, name, mimeType }
//   - web: { uri, name, mimeType, file: <browser File object> }
export async function createRecord({ title, category, providerName, file }) {
   const formData = new FormData();
   formData.append('title', title);
   formData.append('category', category);
   formData.append('providerName', providerName);

   if (Platform.OS === 'web' && file.file) {
      // Real browser FormData needs an actual File/Blob — the {uri,name,type}
      // object trick below only works with React Native's native FormData.
      formData.append('document', file.file, file.name || 'document');
   } else {
      formData.append('document', {
         uri: file.uri,
         name: file.name || 'document',
         type: file.mimeType || 'application/octet-stream',
      });
   }

   const { data } = await api.post('/patient/records', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
   });
   return data;
}

// DELETE /patient/records/:id
export async function deleteRecord(id) {
   const { data } = await api.delete(`/patient/records/${id}`);
   return data;
}
