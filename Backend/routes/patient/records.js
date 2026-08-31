// routes/patient/records.js
const express = require('express');
const router = express.Router();

const patientProtect = require('../../middleware/patientProtect');
const upload = require('../../middleware/upload');
const {
   createRecord,
   getRecords,
   getRecordById,
   deleteRecord,
} = require('../../controllers/recordController');

// All routes below require a valid patient JWT
router.use(patientProtect);

// POST   /api/patient/records            (multipart/form-data, field: "document")
// GET    /api/patient/records?category=&search=
router.route('/')
   .post(upload.single('document'), createRecord)
   .get(getRecords);

// GET    /api/patient/records/:id
// DELETE /api/patient/records/:id
router.route('/:id')
   .get(getRecordById)
   .delete(deleteRecord);

module.exports = router;
