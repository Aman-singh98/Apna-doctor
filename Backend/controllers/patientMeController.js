const Patient = require('../models/Patient');
const { uploadBuffer, deleteByPublicId } = require('../services/cloudinaryService');

// GET /api/patient/me
// Returns the logged-in patient's full profile, including their photo.
exports.getMe = async (req, res) => {
   try {
      const patient = await Patient.findById(req.user.id);
      if (!patient) {
         return res.status(404).json({ message: 'Patient not found' });
      }
      res.json(patient);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
   }
};

// POST /api/patient/me/accept-terms
exports.acceptTerms = async (req, res) => {
   try {
      const patient = await Patient.findByIdAndUpdate(
         req.user.id,
         { hasAcceptedTerms: true },
         { new: true }
      );
      if (!patient) {
         return res.status(404).json({ message: 'Patient not found' });
      }
      res.json({ hasAcceptedTerms: patient.hasAcceptedTerms });
   } catch (err) {
      res.status(500).json({ message: 'Failed to accept terms', error: err.message });
   }
};

// POST /api/patient/me/signup
// body: { name, email, gender, dob, bloodGroup, weight }
// Matches the fields collected on app/patient-signup.js.
exports.signup = async (req, res) => {
   try {
      const { name, email, gender, dob, bloodGroup, weight } = req.body;

      if (!name?.trim() || !gender || !dob?.trim()) {
         return res.status(400).json({ message: 'Name, gender, and date of birth are required' });
      }
      if (email?.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
         return res.status(400).json({ message: 'Please provide a valid email address' });
      }

      const patient = await Patient.findByIdAndUpdate(
         req.user.id,
         { name, email, gender, dob, bloodGroup, weight, hasCompletedProfile: true },
         { new: true, runValidators: true }
      );
      if (!patient) {
         return res.status(404).json({ message: 'Patient not found' });
      }

      res.json(patient);
   } catch (err) {
      res.status(500).json({ message: 'Failed to save profile', error: err.message });
   }
};

// POST /api/patient/me/photo  (multipart/form-data, field name: "photo")
// Uploads the image to Cloudinary, swaps it onto the patient doc, and
// best-effort deletes the previous photo (if any) so old images don't
// pile up in the Cloudinary account.
exports.uploadPhoto = async (req, res) => {
   try {
      if (!req.file) {
         return res.status(400).json({ message: 'No photo file provided' });
      }

      // publicId is select:false by default — pull it in explicitly so we
      // can clean up the old image after a successful re-upload.
      const patient = await Patient.findById(req.user.id).select('+photo.publicId');
      if (!patient) {
         return res.status(404).json({ message: 'Patient not found' });
      }

      const oldPublicId = patient.photo?.publicId;

      const { url, publicId } = await uploadBuffer(req.file.buffer, {
         folder: 'apna-doctor/patient-photos',
      });

      patient.photo = { url, publicId };
      await patient.save();

      if (oldPublicId) {
         deleteByPublicId(oldPublicId); // fire-and-forget, errors swallowed in cloudinaryService
      }

      res.json({ photo: { url: patient.photo.url } });
   } catch (err) {
      res.status(500).json({ message: 'Failed to upload photo', error: err.message });
   }
};
