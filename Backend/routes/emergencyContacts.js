const express = require('express');
const {
   getEmergencyContacts,
   addEmergencyContact,
   updateEmergencyContact,
   deleteEmergencyContact,
} = require('../controllers/emergencyContactController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

router.get('/', getEmergencyContacts);
router.post('/', addEmergencyContact);
router.put('/:id', updateEmergencyContact);
router.delete('/:id', deleteEmergencyContact);

module.exports = router;

// Mount this alongside your other patient routes, e.g.:
//   app.use('/api/patient/emergency-contacts', require('./routes/patient/emergencyContacts.routes'));
