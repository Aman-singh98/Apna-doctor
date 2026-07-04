// Doctor-facing support ticket calls. Thin wrapper around the shared `api`
// axios instance (src/services/api.js) — same pattern as prescriptionService,
// patientService, etc. Mirrors the patient app's ticketService.js exactly,
// just pointed at the doctor routes.
//
// Routes (see backend/routes/doctorTicketRoutes.js, mounted at
// /api/doctor/tickets in server.js — all require a logged-in doctor via
// doctorProtect):
//   POST   /doctor/tickets              createTicket
//   GET    /doctor/tickets              getMyTickets
//   GET    /doctor/tickets/:id          getTicketById
//   POST   /doctor/tickets/:id/replies  addTicketReply
//
// Responses are wrapped as { success, data }, matching doctorTicketController.js.

import api from './api';

/**
 * @param {{ category: string, subject: string, description: string }} payload
 * @returns {Promise<object>} created ticket
 */
export const createTicket = async ({ category, subject, description }) => {
   const res = await api.post('/doctor/tickets', { category, subject, description });
   return res.data.data ?? res.data;
};

/**
 * @returns {Promise<object[]>} the logged-in doctor's tickets
 */
export const getMyTickets = async () => {
   const res = await api.get('/doctor/tickets');
   return res.data.data ?? res.data;
};

/**
 * @param {string} id
 * @returns {Promise<object>} single ticket, including its reply thread
 */
export const getTicketById = async (id) => {
   const res = await api.get(`/doctor/tickets/${id}`);
   return res.data.data ?? res.data;
};

/**
 * @param {string} id
 * @param {string} message
 * @returns {Promise<object>} updated ticket (with the new reply appended)
 */
export const addTicketReply = async (id, message) => {
   const res = await api.post(`/doctor/tickets/${id}/replies`, { message });
   return res.data.data ?? res.data;
};
