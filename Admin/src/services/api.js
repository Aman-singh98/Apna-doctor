// Centralised API layer. All fetch calls live here — pages never call fetch directly.
// Base URL is read from .env:  VITE_API_URL=http://localhost:5000/api

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

// ── Helper: build headers ─────────────────────────────────────────────────────
const headers = (withAuth = true) => {
	const h = { 'Content-Type': 'application/json' };
	if (withAuth) {
		const token = sessionStorage.getItem('apna_token');
		if (token) h['Authorization'] = `Bearer ${token}`;
	}
	return h;
};

// ── Helper: handle response ───────────────────────────────────────────────────
// Throws a plain Error whose .message is the server's { message } string.
const handle = async (res) => {
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
	return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/** POST /auth/admin/login → { success, token, admin } */
export const apiLogin = (email, password) =>
	fetch(`${BASE}/auth/admin/login`, {
		method: 'POST',
		headers: headers(false),
		body: JSON.stringify({ email, password }),
	}).then(handle);

/** GET /auth/admin/me → { success, admin } */
export const apiGetMe = () =>
	fetch(`${BASE}/auth/admin/me`, { headers: headers() }).then(handle);

// ─────────────────────────────────────────────────────────────────────────────
// DOCTORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /doctors
 * @param {{ status?: string, search?: string, page?: number, limit?: number }} params
 * → { success, total, page, pages, doctors[] }
 */
export const apiGetDoctors = (params = {}) => {
	const qs = new URLSearchParams(
		Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
	).toString();
	return fetch(`${BASE}/doctors${qs ? `?${qs}` : ''}`, { headers: headers() }).then(handle);
};

/** GET /doctors/stats → { success, stats: { total, pending, verified, rejected, suspended } } */
export const apiGetDoctorStats = () =>
	fetch(`${BASE}/doctors/stats`, { headers: headers() }).then(handle);

/** GET /doctors/:id → { success, doctor } */
export const apiGetDoctorById = (id) =>
	fetch(`${BASE}/doctors/${id}`, { headers: headers() }).then(handle);

/** PATCH /doctors/:id/verify → { success, message, doctor } */
export const apiVerifyDoctor = (id) =>
	fetch(`${BASE}/doctors/${id}/verify`, { method: 'PATCH', headers: headers() }).then(handle);

/**
 * PATCH /doctors/:id/reject
 * @param {string} id
 * @param {string} reason
 */
export const apiRejectDoctor = (id, reason) =>
	fetch(`${BASE}/doctors/${id}/reject`, {
		method: 'PATCH',
		headers: headers(),
		body: JSON.stringify({ reason }),
	}).then(handle);

/**
 * PATCH /doctors/:id/suspend
 * @param {string} id
 * @param {string} reason
 */
export const apiSuspendDoctor = (id, reason) =>
	fetch(`${BASE}/doctors/${id}/suspend`, {
		method: 'PATCH',
		headers: headers(),
		body: JSON.stringify({ reason }),
	}).then(handle);

/** PATCH /doctors/:id/unsuspend → { success, message, doctor } */
export const apiUnsuspendDoctor = (id) =>
	fetch(`${BASE}/doctors/${id}/unsuspend`, { method: 'PATCH', headers: headers() }).then(handle);

// ─────────────────────────────────────────────────────────────────────────────
// PATIENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/patients
 * @param {{ status?: string, search?: string, page?: number, limit?: number }} params
 * → { success, total, page, pages, patients[] }
 */
export const apiGetPatients = (params = {}) => {
	const qs = new URLSearchParams(
		Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
	).toString();
	return fetch(`${BASE}/admin/patients${qs ? `?${qs}` : ''}`, { headers: headers() }).then(handle);
};

/** GET /admin/patients/stats → { success, stats: { total, active, suspended, profileComplete } } */
export const apiGetPatientStats = () =>
	fetch(`${BASE}/admin/patients/stats`, { headers: headers() }).then(handle);

/** GET /admin/patients/:id → { success, patient } */
export const apiGetPatientById = (id) =>
	fetch(`${BASE}/admin/patients/${id}`, { headers: headers() }).then(handle);

/** PATCH /admin/patients/:id/suspend → { success, message, patient } */
export const apiSuspendPatient = (id) =>
	fetch(`${BASE}/admin/patients/${id}/suspend`, { method: 'PATCH', headers: headers() }).then(handle);

/** PATCH /admin/patients/:id/unsuspend → { success, message, patient } */
export const apiUnsuspendPatient = (id) =>
	fetch(`${BASE}/admin/patients/${id}/unsuspend`, { method: 'PATCH', headers: headers() }).then(handle);

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/tickets
 * @param {{ status?: string, category?: string, search?: string, page?: number, limit?: number }} params
 * → { success, count, total, page, pages, data: [] }
 */
export const apiGetTickets = (params = {}) => {
	const qs = new URLSearchParams(
		Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
	).toString();
	return fetch(`${BASE}/admin/tickets${qs ? `?${qs}` : ''}`, { headers: headers() }).then(handle);
};

/** GET /admin/tickets/stats → { success, data: {...} } */
export const apiGetTicketStats = () =>
	fetch(`${BASE}/admin/tickets/stats`, { headers: headers() }).then(handle);

/** GET /admin/tickets/:id → { success, data: ticket } */
export const apiGetTicketById = (id) =>
	fetch(`${BASE}/admin/tickets/${id}`, { headers: headers() }).then(handle);

/**
 * PATCH /admin/tickets/:id
 * @param {string} id
 * @param {{ status?: string, priority?: string, assignedTo?: string, resolutionReason?: string }} updates
 * → { success, data: ticket }
 */
export const apiUpdateTicket = (id, updates) =>
	fetch(`${BASE}/admin/tickets/${id}`, {
		method: 'PATCH',
		headers: headers(),
		body: JSON.stringify(updates),
	}).then(handle);

/**
 * POST /admin/tickets/:id/replies
 * @param {string} id
 * @param {string} message
 * @param {string} senderName
 * → { success, data: ticket }
 */
export const apiReplyToTicket = (id, message, senderName) =>
	fetch(`${BASE}/admin/tickets/${id}/replies`, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify({ message, senderName }),
	}).then(handle);

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/appointments
 * @param {{ status?: string, search?: string, page?: number, limit?: number }} params
 * → { success, total, page, pages, appointments[] }
 */
export const apiGetAppointments = (params = {}) => {
	const qs = new URLSearchParams(
		Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
	).toString();
	return fetch(`${BASE}/admin/appointments${qs ? `?${qs}` : ''}`, { headers: headers() }).then(handle);
};

/** GET /admin/appointments/stats → { success, stats: {...} } */
export const apiGetAppointmentStats = () =>
	fetch(`${BASE}/admin/appointments/stats`, { headers: headers() }).then(handle);

/** GET /admin/appointments/:id → { success, appointment } */
export const apiGetAppointmentById = (id) =>
	fetch(`${BASE}/admin/appointments/${id}`, { headers: headers() }).then(handle);

/**
 * PATCH /admin/appointments/:id/cancel
 * @param {string} id
 * @param {string} reason
 * → { success, message, appointment }
 */
export const apiCancelAppointment = (id, reason) =>
	fetch(`${BASE}/admin/appointments/${id}/cancel`, {
		method: 'PATCH',
		headers: headers(),
		body: JSON.stringify({ reason }),
	}).then(handle);

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/notifications?page=&limit=
 * → Notification[]
 */
export const apiGetNotifications = (params = {}) => {
	const qs = new URLSearchParams(
		Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
	).toString();
	return fetch(`${BASE}/admin/notifications${qs ? `?${qs}` : ''}`, { headers: headers() }).then(handle);
};

/** GET /admin/notifications/unread-count → { count } */
export const apiGetUnreadCount = () =>
	fetch(`${BASE}/admin/notifications/unread-count`, { headers: headers() }).then(handle);

/** PATCH /admin/notifications/:id/read → Notification */
export const apiMarkNotificationRead = (id) =>
	fetch(`${BASE}/admin/notifications/${id}/read`, { method: 'PATCH', headers: headers() }).then(handle);

/** PATCH /admin/notifications/read-all → { message } */
export const apiMarkAllNotificationsRead = () =>
	fetch(`${BASE}/admin/notifications/read-all`, { method: 'PATCH', headers: headers() }).then(handle);

/** DELETE /admin/notifications/clear → { message } */
export const apiClearNotifications = () =>
	fetch(`${BASE}/admin/notifications/clear`, { method: 'DELETE', headers: headers() }).then(handle);

/**
 * POST /admin/notifications/device-token
 * Registers a token for web push. Requires the admin panel to set up its
 * own Firebase Web SDK + service worker to obtain `token` — this call just
 * sends whatever token that flow produces to the backend.
 * @param {string} token
 * @param {string} [platform] - defaults to 'web' for the admin panel
 */
export const apiRegisterDeviceToken = (token, platform = 'web') =>
	fetch(`${BASE}/admin/notifications/device-token`, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify({ token, platform }),
	}).then(handle);
