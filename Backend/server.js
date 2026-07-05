// Entry point for Apna Doctor backend.
// Boot order: env → DB → Firebase → Express routes
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Fail fast at boot if serviceAccountKey.json is missing / malformed
require('./config/firebaseAdmin');

// ── Route files ───────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');

// Doctor onboarding/auth routes (OTP, terms, signup, status)
const doctorAuthRoutes = require('./routes/doctorAuth');
const doctorMeRoutes = require('./routes/doctorMe');

// Doctor self-service routes (profile, dashboard, availability, schedule)
const doctorProfileRoutes = require('./routes/doctorProfileRoutes');

// Admin approval routes (no auth middleware yet — see routes/admin.js)
const adminRoutes = require('./routes/admin');

// Admin patient management routes (no auth middleware yet — see routes/adminPatientRoutes.js)
const adminPatientRoutes = require('./routes/patient/adminPatientRoutes');

// Admin appointment management routes (no auth middleware yet — see routes/adminAppointmentRoutes.js)
const adminAppointmentRoutes = require('./routes/adminAppointmentRoutes');

// Doctor-facing prescription routes (create/list/update/delete, scoped to doctor)
const prescriptionRoutes = require('./routes/prescriptionRoutes');

// Patient-facing prescription routes — read-only view of prescriptions a
// doctor has issued to the logged-in patient. Distinct from
// prescriptionRoutes above (doctor-facing, full CRUD).
const patientPrescriptionRoutes = require('./routes/patientPrescriptionRoutes');

// Doctor-facing appointment routes (list/today/detail/complete/cancel, scoped to doctor)
const appointmentRoutes = require('./routes/appointmentRoutes');

// Doctor-facing support ticket routes (create/list/view own tickets, reply)
const doctorTicketRoutes = require('./routes/doctorTicketRoutes');

// Patient onboarding/auth routes (OTP, terms, signup) — a patient's own login,
// parallel to doctorAuthRoutes / doctorMeRoutes.
const patientAuthRoutes = require('./routes/patient/patientAuth');
const patientMeRoutes = require('./routes/patient/patientMe');

// Doctor-facing patient routes — lets a doctor list/view patients they've
// consulted with. Distinct from patientAuthRoutes/patientMeRoutes above.
const patientRoutes = require('./routes/patientRoutes');

// Patient family members & emergency contacts routes
const familyMembersRoutes = require('./routes/familyMembers');
const emergencyContactsRoutes = require('./routes/emergencyContacts');

// Patient-facing appointment routes — list/cancel/reschedule the patient's
// own appointments. Distinct from appointmentRoutes (doctor-facing).
const patientAppointmentRoutes = require('./routes/patientAppointmentRoutes');

// Patient-facing doctor browse routes — search/list approved doctors and
// check slot availability. Distinct from doctorRoutes (admin-only).
const patientDoctorRoutes = require('./routes/patient/patientDoctorRoutes');

// Patient-facing support ticket routes (create/list/view own tickets)
const ticketRoutes = require('./routes/ticketRoutes');

// Admin support ticket management routes (list all, update status, reply)
const adminTicketRoutes = require('./routes/adminTicketRoutes');
const patientRecordsRoutes = require('./routes/patient/records');
const patientMedicalHistoryRoutes = require('./routes/patient/medicalHistory');

// Patient-facing review routes — rate & review a doctor after a completed
// appointment; also serves a doctor's aggregate rating for doctor-detail.js
const reviewRoutes = require('./routes/reviewRoutes');

// Doctor-facing review routes — lets a doctor see their own reviews +
// aggregate rating (profile.js "Patient Reviews" section, dashboard.js stat)
const doctorReviewRoutes = require('./routes/doctorReviewRoutes');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

const app = express();

// ── Global Middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // extended: true needed for multipart form fallback

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
	res.status(200).json({ success: true, message: 'Apna Doctor API is running.' })
);

// ── Existing Routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);

// ── Doctor Onboarding Routes ──────────────────────────────────────────────────
// POST /api/doctor/auth/send-otp
// POST /api/doctor/auth/verify-otp
app.use('/api/doctor/auth', doctorAuthRoutes);

// GET  /api/doctor/me/status        (requires JWT)
// POST /api/doctor/me/accept-terms  (requires JWT)
// POST /api/doctor/me/signup        (requires JWT, multipart/form-data)
app.use('/api/doctor/me', doctorMeRoutes);

// ── Doctor Self-Profile Routes ────────────────────────────────────────────────
// GET    /api/doctor/profile/me
// PATCH  /api/doctor/profile/me
// POST   /api/doctor/profile/me/photo
// GET    /api/doctor/profile/me/dashboard
// PATCH  /api/doctor/profile/me/availability
// GET    /api/doctor/profile/me/reviews
// GET/PUT /api/doctor/profile/me/schedule
app.use('/api/doctor/profile', doctorProfileRoutes);

// ── Admin Approval Routes ─────────────────────────────────────────────────────
// GET  /api/admin/doctors?status=pending
// POST /api/admin/doctors/:doctorId/approve
// POST /api/admin/doctors/:doctorId/reject
app.use('/api/admin/doctors', adminRoutes);

// ── Admin Patient Management Routes ───────────────────────────────────────────
// GET   /api/admin/patients?search=&status=&page=&limit=
// GET   /api/admin/patients/stats
// GET   /api/admin/patients/:id
// PATCH /api/admin/patients/:id/suspend
// PATCH /api/admin/patients/:id/unsuspend
app.use('/api/admin/patients', adminPatientRoutes);

// ── Admin Appointment Management Routes ───────────────────────────────────────
// GET   /api/admin/appointments?status=&search=&page=&limit=
// GET   /api/admin/appointments/stats
// GET   /api/admin/appointments/:id
// PATCH /api/admin/appointments/:id/cancel
app.use('/api/admin/appointments', adminAppointmentRoutes);

// ── Doctor Prescription Routes ────────────────────────────────────────────────
// GET    /api/prescriptions
// GET    /api/prescriptions/:id
// POST   /api/prescriptions
// PUT    /api/prescriptions/:id
// DELETE /api/prescriptions/:id
app.use('/api/prescriptions', prescriptionRoutes);

// ── Patient Prescription Routes ───────────────────────────────────────────────
// GET /api/patient/prescriptions       (requires patient JWT) — list my Rx's
// GET /api/patient/prescriptions/:id   (requires patient JWT) — single Rx detail
app.use('/api/patient/prescriptions', patientPrescriptionRoutes);

// ── Doctor Appointment Routes ─────────────────────────────────────────────────
// GET    /api/appointments               (requires doctor JWT + approved status)
// GET    /api/appointments/today         (requires doctor JWT + approved status)
// GET    /api/appointments/:id           (requires doctor JWT + approved status)
// PATCH  /api/appointments/:id/complete  (requires doctor JWT + approved status)
// PATCH  /api/appointments/:id/cancel    (requires doctor JWT + approved status)
app.use('/api/appointments', appointmentRoutes);

// ── Doctor Support Ticket Routes ──────────────────────────────────────────────
// POST /api/doctor/tickets              (requires doctor JWT)
// GET  /api/doctor/tickets              (requires doctor JWT)
// GET  /api/doctor/tickets/:id          (requires doctor JWT)
// POST /api/doctor/tickets/:id/replies  (requires doctor JWT)
app.use('/api/doctor/tickets', doctorTicketRoutes);

// ── Patient Onboarding Routes ─────────────────────────────────────────────────
// POST /api/patient/auth/send-otp
// POST /api/patient/auth/verify-otp
app.use('/api/patient/auth', patientAuthRoutes);

// POST /api/patient/me/accept-terms  (requires patient JWT)
// POST /api/patient/me/signup        (requires patient JWT)
app.use('/api/patient/me', patientMeRoutes);

// ── Doctor-Facing Patient Routes ──────────────────────────────────────────────
// GET  /api/patients?search=       (requires doctor JWT)
// GET  /api/patients/:id           (requires doctor JWT)
app.use('/api/patients', patientRoutes);

// GET/POST/DELETE /api/patient/family-members
app.use('/api/patient/family-members', familyMembersRoutes);

// GET    /api/patient/appointments               (requires patient JWT)
// POST   /api/patient/appointments                (requires patient JWT)
// GET    /api/patient/appointments/:id            (requires patient JWT)
// PATCH  /api/patient/appointments/:id/cancel     (requires patient JWT)
// PATCH  /api/patient/appointments/:id/reschedule (requires patient JWT)
app.use('/api/patient/appointments', patientAppointmentRoutes);

// GET /api/patient/doctors                      (requires patient JWT)
// GET /api/patient/doctors/:id                   (requires patient JWT)
// GET /api/patient/doctors/:id/availability       (requires patient JWT)
app.use('/api/patient/doctors', patientDoctorRoutes);

// GET/POST/PUT/DELETE /api/patient/emergency-contacts
app.use('/api/patient/emergency-contacts', emergencyContactsRoutes);

// ── Patient Medical Records Routes ────────────────────────────────────────────
// POST   /api/patient/records            (requires patient JWT, multipart/form-data)
// GET    /api/patient/records             (requires patient JWT)
// GET    /api/patient/records/:id         (requires patient JWT)
// DELETE /api/patient/records/:id         (requires patient JWT)
app.use('/api/patient/records', patientRecordsRoutes);

// ── Patient Medical History Routes ────────────────────────────────────────────
// GET /api/patient/medical-history        (requires patient JWT)
// PUT /api/patient/medical-history        (requires patient JWT)
app.use('/api/patient/medical-history', patientMedicalHistoryRoutes);

// ── Patient Review Routes ─────────────────────────────────────────────────────
// POST   /api/patient/reviews                     (requires patient JWT)
// GET    /api/patient/reviews/mine                (requires patient JWT)
// GET    /api/patient/reviews/doctor/:doctorId    (requires patient JWT)
// PUT    /api/patient/reviews/:id                 (requires patient JWT)
// DELETE /api/patient/reviews/:id                 (requires patient JWT)
app.use('/api/patient/reviews', reviewRoutes);

// ── Doctor Review Routes ──────────────────────────────────────────────────────
// GET /api/doctor/reviews/mine  (requires doctor JWT + approved status)
app.use('/api/doctor/reviews', doctorReviewRoutes);

// ── Patient Support Ticket Routes ─────────────────────────────────────────────
// POST /api/patient/tickets              (requires patient JWT)
// GET  /api/patient/tickets              (requires patient JWT)
// GET  /api/patient/tickets/:id          (requires patient JWT)
// POST /api/patient/tickets/:id/replies  (requires patient JWT)
app.use('/api/patient/tickets', ticketRoutes);

// ── Admin Support Ticket Routes ───────────────────────────────────────────────
// GET   /api/admin/tickets?status=&category=&search=&page=&limit=
// GET   /api/admin/tickets/stats
// GET   /api/admin/tickets/:id
// PATCH /api/admin/tickets/:id/status
// POST  /api/admin/tickets/:id/replies
app.use('/api/admin/tickets', adminTicketRoutes);

// ── Error Handling (must be last) ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () =>
//   console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`)
// );
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () =>
	console.log(
		`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
	)
);
