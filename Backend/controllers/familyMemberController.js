const FamilyMember = require('../models/FamilyMember');

const ALLOWED_RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling'];

// GET /api/patient/family-members
// Returns all family sub-profiles belonging to the logged-in patient.
exports.getFamilyMembers = async (req, res) => {
   try {
      const members = await FamilyMember.find({ patient: req.user.id }).sort({ createdAt: 1 });
      return res.status(200).json(members);
   } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch family members' });
   }
};

// POST /api/patient/family-members
// Body: { name, relation, age, bloodGroup }
exports.addFamilyMember = async (req, res) => {
   try {
      const { name, relation, age, bloodGroup } = req.body;

      if (!name || !String(name).trim() || !age || !String(age).trim()) {
         return res.status(400).json({ message: 'Name and age are required' });
      }

      if (relation && !ALLOWED_RELATIONS.includes(relation)) {
         return res.status(400).json({ message: 'Invalid relation type' });
      }

      const member = await FamilyMember.create({
         patient: req.user.id,
         name: String(name).trim(),
         relation: relation || 'Spouse',
         age: String(age).trim(),
         bloodGroup: bloodGroup ? String(bloodGroup).trim() : '',
      });

      return res.status(201).json(member);
   } catch (err) {
      if (err.name === 'ValidationError') {
         return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Failed to add family member' });
   }
};

// DELETE /api/patient/family-members/:id
exports.deleteFamilyMember = async (req, res) => {
   try {
      // Scoping the query to `patient: req.user.id` ensures a patient can
      // only ever delete their own family members, not someone else's.
      const member = await FamilyMember.findOneAndDelete({
         _id: req.params.id,
         patient: req.user.id,
      });

      if (!member) {
         return res.status(404).json({ message: 'Family member not found' });
      }

      return res.status(200).json({ message: 'Family member removed' });
   } catch (err) {
      return res.status(500).json({ message: 'Failed to remove family member' });
   }
};
