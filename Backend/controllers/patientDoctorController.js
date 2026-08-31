// ─── Doctor Controller (Patient-facing browse) ────────────────────────────────
// Used by routes/patient/doctors.js
//
// Distinct from controllers/doctorController.js, which is ADMIN-facing
// (verify/reject/suspend). This one only ever returns doctors with
// approvalStatus: 'approved', and exposes an availability endpoint that
// computes real open slots instead of the hardcoded TIME_SLOTS/BOOKED_SLOTS
// mock in book-appointment.js.
//
// ASSUMPTIONS — adjust if wrong:
//   - Doctor.schedule.activeDays holds 3-letter day abbreviations: 'Mon'...'Sun'
//   - Doctor.schedule.activeSlots holds time strings like '09:00 AM'
//   - A doctor is bookable only when approvalStatus === 'approved' AND available === true

const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PUBLIC_DOCTOR_FIELDS =
   'name specialization qualification hospital experience bio photoUrl videoFee chatFee rating schedule available';

// GET /api/patient/doctors?specialization=&search=
exports.getDoctors = async (req, res) => {
   try {
      const { specialization, search } = req.query;

      const filter = { approvalStatus: 'approved' };
      if (specialization && specialization !== 'All') filter.specialization = specialization;
      if (search) {
         filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { specialization: { $regex: search, $options: 'i' } },
         ];
      }

      const doctors = await Doctor.find(filter).select(PUBLIC_DOCTOR_FIELDS);
      res.json(doctors);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch doctors', error: err.message });
   }
};

// GET /api/patient/doctors/:id
exports.getDoctorById = async (req, res) => {
   try {
      const doctor = await Doctor.findOne({
         _id: req.params.id,
         approvalStatus: 'approved',
      }).select(PUBLIC_DOCTOR_FIELDS);

      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }
      res.json(doctor);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch doctor', error: err.message });
   }
};

// GET /api/patient/doctors/:id/availability?date=YYYY-MM-DD
// Returns { activeSlots: [...], bookedSlots: [...], availableSlots: [...] }
// for the requested date, or availableSlots: [] if the doctor doesn't work that day.
exports.getAvailability = async (req, res) => {
   try {
      const { date } = req.query;
      const requestedDate = date ? new Date(date) : null;
      if (!requestedDate || isNaN(requestedDate.getTime())) {
         return res.status(400).json({ message: 'A valid date query param is required' });
      }

      const doctor = await Doctor.findOne({ _id: req.params.id, approvalStatus: 'approved' }).select('schedule');
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }

      const dayAbbr = DAY_ABBR[requestedDate.getDay()];
      const worksThisDay = doctor.schedule?.activeDays?.includes(dayAbbr);

      if (!worksThisDay) {
         return res.json({ activeSlots: [], bookedSlots: [], availableSlots: [] });
      }

      const startOfDay = new Date(requestedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(requestedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const bookedAppointments = await Appointment.find({
         doctor: doctor._id,
         date: { $gte: startOfDay, $lte: endOfDay },
         status: 'upcoming',
      }).select('date');

      const bookedSlots = bookedAppointments.map(a =>
         new Date(a.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );

      const activeSlots = doctor.schedule?.activeSlots || [];
      const availableSlots = activeSlots.filter(slot => !bookedSlots.includes(slot));

      res.json({ activeSlots, bookedSlots, availableSlots });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch availability', error: err.message });
   }
};
