const express = require('express');
const {
   getFamilyMembers,
   addFamilyMember,
   deleteFamilyMember,
} = require('../controllers/familyMemberController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

router.get('/', getFamilyMembers);
router.post('/', addFamilyMember);
router.delete('/:id', deleteFamilyMember);

module.exports = router;

// Mount this in your main router alongside patientMe, e.g.:
//   app.use('/api/patient/family-members', require('./routes/patient/familyMembers.routes'));