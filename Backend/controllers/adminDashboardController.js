// controllers/adminDashboardController.js
//
// Single endpoint that backs the Admin app's DashboardPage.jsx: stat cards,
// the revenue trend chart, the quick-stats list, and the recent
// appointments table. Previously all of that was hardcoded on the frontend
// (see Admin/src/pages/DashboardPage.jsx header comment) — this replaces
// the mock constants with real aggregates.
//
// Kept as one endpoint (rather than reusing /doctors/stats, /patients/stats,
// etc. individually) so the dashboard is a single round trip and the
// month-bucketed revenue trend / recent-appointments list (which no
// existing stats endpoint returns) can live in one place.

const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Ticket = require('../models/Ticket');
const { PAYMENT_STATUS } = require('../constants/paymentConstants');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// GET /api/admin/dashboard
exports.getDashboard = async (req, res, next) => {
   try {
      const now = new Date();

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

      // Window for the revenue trend chart: the 1st of the month 6 months
      // ago through now, so the chart always shows the current month plus
      // the 6 before it (7 points total, matching the old mock data).
      const trendStart = new Date(now.getFullYear(), now.getMonth() - 6, 1, 0, 0, 0, 0);

      const [
         doctorCounts,
         totalPatients,
         appointmentsToday,
         revenueThisMonthAgg,
         revenueTrendAgg,
         openTickets,
         activeConsultationsToday,
         refundRequests,
         newPatientsToday,
         recentAppointmentsRaw,
      ] = await Promise.all([
         Doctor.aggregate([
            { $match: { approvalStatus: { $ne: 'not_started' } } },
            { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
         ]),
         Patient.countDocuments({}),
         Appointment.countDocuments({ date: { $gte: startOfDay, $lte: endOfDay } }),
         Appointment.aggregate([
            { $match: { paymentStatus: PAYMENT_STATUS.PAID, date: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$fee' } } },
         ]),
         Appointment.aggregate([
            { $match: { paymentStatus: PAYMENT_STATUS.PAID, date: { $gte: trendStart } } },
            {
               $group: {
                  _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                  revenue: { $sum: '$fee' },
               },
            },
         ]),
         Ticket.countDocuments({ status: 'Open' }),
         Appointment.countDocuments({
            status: 'upcoming',
            date: { $gte: startOfDay, $lte: endOfDay },
         }),
         // "Refund requests" = paid bookings that were cancelled but haven't
         // been marked refunded yet — i.e. still awaiting admin action.
         // There's no separate refund-request queue in the schema, so this
         // is the closest real signal (mirrors what the Payments page would
         // flag as needing attention).
         Appointment.countDocuments({ status: 'cancelled', paymentStatus: PAYMENT_STATUS.PAID }),
         Patient.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
         Appointment.aggregate([
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
               $lookup: {
                  from: 'doctors',
                  localField: 'doctor',
                  foreignField: '_id',
                  as: 'doctorInfo',
               },
            },
            { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
            {
               $lookup: {
                  from: 'patients',
                  localField: 'patient',
                  foreignField: '_id',
                  as: 'patientInfo',
               },
            },
            { $unwind: { path: '$patientInfo', preserveNullAndEmptyArrays: true } },
            {
               $project: {
                  patient: { $ifNull: ['$patientInfo.name', '$patientName'] },
                  doctor: { $ifNull: ['$doctorInfo.name', 'Unassigned'] },
                  type: 1,
                  date: 1,
                  status: 1,
               },
            },
         ]),
      ]);

      const doctorByStatus = doctorCounts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
      const totalDoctors = Object.values(doctorByStatus).reduce((sum, n) => sum + n, 0);

      // Build a dense 7-point series (Jan..Jul style labels) even for months
      // with zero paid appointments, so the chart doesn't skip gaps.
      const revenueByKey = revenueTrendAgg.reduce((acc, r) => {
         acc[`${r._id.year}-${r._id.month}`] = r.revenue;
         return acc;
      }, {});
      const revenueTrend = [];
      for (let i = 6; i >= 0; i--) {
         const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
         const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
         revenueTrend.push({ month: MONTH_LABELS[d.getMonth()], revenue: revenueByKey[key] || 0 });
      }

      const revenueThisMonth = revenueThisMonthAgg[0]?.total || 0;

      res.status(200).json({
         success: true,
         stats: {
            totalDoctors,
            totalPatients,
            appointmentsToday,
            revenueThisMonth,
         },
         revenueTrend,
         quickStats: {
            pendingVerifications: doctorByStatus.pending || 0,
            activeConsultations: activeConsultationsToday,
            openSupportTickets: openTickets,
            refundRequests,
            newPatientsToday,
         },
         recentAppointments: recentAppointmentsRaw.map(a => ({
            id: a._id,
            patient: a.patient || 'Unknown patient',
            doctor: a.doctor ? `Dr. ${a.doctor}` : 'Unassigned',
            type: a.type,
            time: a.date,
            status: a.status,
         })),
      });
   } catch (err) {
      next(err);
   }
};
