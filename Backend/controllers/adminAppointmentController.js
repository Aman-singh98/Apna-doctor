// controllers/adminAppointmentController.js
//
// Admin-facing appointment management. Read-mostly + cancel — admins don't
// mark appointments "complete" (that stays a doctor action, see
// controllers/appointmentController.js). No auth middleware yet, matching
// the current state of adminPatientController.js / routes/admin.js.
//
// NOTE: assumes the Doctor model has a `name` field — adjust the $lookup /
// populate select below if it's actually `fullName` or similar.

const Appointment = require('../models/Appointment');

// ── GET /api/admin/appointments ────────────────────────────────────────────
// Query: ?status=upcoming|completed|cancelled&search=&page=&limit=
exports.listAppointments = async (req, res, next) => {
   try {
      const { status, search = '', page = 1, limit = 10 } = req.query;
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

      const match = {};
      if (status && status !== 'All') match.status = status.toLowerCase();

      const pipeline = [
         { $match: match },
         {
            $lookup: {
               from: 'doctors',
               localField: 'doctor',
               foreignField: '_id',
               as: 'doctorInfo',
            },
         },
         { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
      ];

      if (search) {
         const re = new RegExp(search, 'i');
         pipeline.push({
            $match: {
               $or: [
                  { patientName: re },
                  { patientPhone: re },
                  { 'doctorInfo.name': re },
               ],
            },
         });
      }

      const countResult = await Appointment.aggregate([...pipeline, { $count: 'total' }]);
      const total = countResult[0]?.total || 0;

      pipeline.push(
         { $sort: { date: -1 } },
         { $skip: (pageNum - 1) * limitNum },
         { $limit: limitNum },
         {
            $project: {
               patientName: 1,
               patientPhone: 1,
               fee: 1,
               date: 1,
               type: 1,
               status: 1,
               diagnosis: 1,
               cancelReason: 1,
               createdAt: 1,
               doctorId: '$doctorInfo._id',
               doctorName: '$doctorInfo.name',
            },
         }
      );

      const appointments = await Appointment.aggregate(pipeline);

      res.status(200).json({
         success: true,
         total,
         page: pageNum,
         pages: Math.max(Math.ceil(total / limitNum), 1),
         appointments,
      });
   } catch (err) {
      next(err);
   }
};

// ── GET /api/admin/appointments/stats ──────────────────────────────────────
exports.getAppointmentStats = async (req, res, next) => {
   try {
      const [total, upcoming, completed, cancelled] = await Promise.all([
         Appointment.countDocuments(),
         Appointment.countDocuments({ status: 'upcoming' }),
         Appointment.countDocuments({ status: 'completed' }),
         Appointment.countDocuments({ status: 'cancelled' }),
      ]);

      res.status(200).json({ success: true, stats: { total, upcoming, completed, cancelled } });
   } catch (err) {
      next(err);
   }
};

// ── GET /api/admin/appointments/:id ────────────────────────────────────────
exports.getAppointmentById = async (req, res, next) => {
   try {
      const appointment = await Appointment.findById(req.params.id)
         .populate('doctor', 'name email phone specialization')
         .populate('patient', 'name phone')
         .populate('familyMember', 'name relation');

      if (!appointment) {
         return res.status(404).json({ success: false, message: 'Appointment not found.' });
      }

      res.status(200).json({ success: true, appointment });
   } catch (err) {
      next(err);
   }
};

// ── PATCH /api/admin/appointments/:id/cancel ───────────────────────────────
// Body: { reason }
exports.cancelAppointment = async (req, res, next) => {
   try {
      const { reason } = req.body;

      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
         return res.status(404).json({ success: false, message: 'Appointment not found.' });
      }
      if (appointment.status === 'cancelled') {
         return res.status(400).json({ success: false, message: 'Appointment is already cancelled.' });
      }

      appointment.status = 'cancelled';
      appointment.cancelReason = reason || 'Cancelled by admin';
      await appointment.save();

      res.status(200).json({ success: true, message: 'Appointment cancelled.', appointment });
   } catch (err) {
      next(err);
   }
};
