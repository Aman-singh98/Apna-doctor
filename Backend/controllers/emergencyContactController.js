const EmergencyContact = require('../models/EmergencyContact');

// GET /api/patient/emergency-contacts
exports.getEmergencyContacts = async (req, res) => {
   try {
      const contacts = await EmergencyContact.find({ patient: req.user.id }).sort({ createdAt: 1 });
      return res.status(200).json(contacts);
   } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch emergency contacts' });
   }
};

// POST /api/patient/emergency-contacts
// Body: { name, relation, phone }
exports.addEmergencyContact = async (req, res) => {
   try {
      const { name, relation, phone } = req.body;

      if (!name?.trim() || !relation?.trim() || !phone?.trim()) {
         return res.status(400).json({ message: 'Name, relation and phone are required' });
      }

      const contact = await EmergencyContact.create({
         patient: req.user.id,
         name: name.trim(),
         relation: relation.trim(),
         phone: phone.trim(),
      });

      return res.status(201).json(contact);
   } catch (err) {
      if (err.name === 'ValidationError') {
         return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Failed to add emergency contact' });
   }
};

// PUT /api/patient/emergency-contacts/:id
// Body: { name, relation, phone }
exports.updateEmergencyContact = async (req, res) => {
   try {
      const { name, relation, phone } = req.body;

      if (!name?.trim() || !relation?.trim() || !phone?.trim()) {
         return res.status(400).json({ message: 'Name, relation and phone are required' });
      }

      // Scoping to `patient: req.user.id` ensures a patient can only ever
      // edit their own emergency contacts.
      const contact = await EmergencyContact.findOneAndUpdate(
         { _id: req.params.id, patient: req.user.id },
         { name: name.trim(), relation: relation.trim(), phone: phone.trim() },
         { new: true, runValidators: true }
      );

      if (!contact) {
         return res.status(404).json({ message: 'Emergency contact not found' });
      }

      return res.status(200).json(contact);
   } catch (err) {
      if (err.name === 'ValidationError') {
         return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Failed to update emergency contact' });
   }
};

// DELETE /api/patient/emergency-contacts/:id
exports.deleteEmergencyContact = async (req, res) => {
   try {
      const contact = await EmergencyContact.findOneAndDelete({
         _id: req.params.id,
         patient: req.user.id,
      });

      if (!contact) {
         return res.status(404).json({ message: 'Emergency contact not found' });
      }

      return res.status(200).json({ message: 'Emergency contact removed' });
   } catch (err) {
      return res.status(500).json({ message: 'Failed to remove emergency contact' });
   }
};
