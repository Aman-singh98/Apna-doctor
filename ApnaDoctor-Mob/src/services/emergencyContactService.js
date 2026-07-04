// src/services/emergencyContactService.js
import api from './api';

export const getEmergencyContacts = () => api.get('/patient/emergency-contacts');

export const addEmergencyContact = (data) => api.post('/patient/emergency-contacts', data);

export const updateEmergencyContact = (id, data) => api.put(`/patient/emergency-contacts/${id}`, data);

export const deleteEmergencyContact = (id) => api.delete(`/patient/emergency-contacts/${id}`);
