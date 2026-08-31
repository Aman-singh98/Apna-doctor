// Patient-facing support ticket calls. Thin wrapper around the shared `api`
// axios instance (src/services/api.js) — same pattern as prescriptionService,
// patientAuthService, etc. Mirrors the doctor app's ticketService.js exactly,
// just pointed at the patient routes.
//
// Routes (see backend/routes/ticketRoutes.js, mounted at
// /api/patient/tickets in server.js — all require a logged-in patient via
// patientProtect):
//   POST   /patient/tickets              createTicket
//   GET    /patient/tickets              getMyTickets
//   GET    /patient/tickets/:id          getTicketById
//   POST   /patient/tickets/:id/replies  addTicketReply
//
// Responses are wrapped as { success, data }, matching ticketController.js.

import api from './api';

/**
 * @param {{ category: string, subject: string, description: string }} payload
 * @returns {Promise<object>} created ticket
 */
export const createTicket = async ({ category, subject, description }) => {
   const res = await api.post('/patient/tickets', { category, subject, description });
   return res.data.data ?? res.data;
};

/**
 * @returns {Promise<object[]>} the logged-in patient's tickets
 */
export const getMyTickets = async () => {
   const res = await api.get('/patient/tickets');
   return res.data.data ?? res.data;
};

/**
 * @param {string} id
 * @returns {Promise<object>} single ticket, including its reply thread
 */
export const getTicketById = async (id) => {
   const res = await api.get(`/patient/tickets/${id}`);
   return res.data.data ?? res.data;
};

/**
 * @param {string} id
 * @param {string} message
 * @returns {Promise<object>} updated ticket (with the new reply appended)
 */
export const addTicketReply = async (id, message) => {
   const res = await api.post(`/patient/tickets/${id}/replies`, { message });
   return res.data.data ?? res.data;
};
