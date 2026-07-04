// src/services/familyMemberService.js
import api from './api';

export const getFamilyMembers = () => api.get('/patient/family-members');

export const addFamilyMember = (data) => api.post('/patient/family-members', data);

export const deleteFamilyMember = (id) => api.delete(`/patient/family-members/${id}`);
