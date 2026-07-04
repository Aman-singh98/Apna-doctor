// controllers/recordController.js
const Record = require('../models/Record');
const { RECORD_CATEGORIES } = require('../models/Record');
const { uploadBuffer, deleteByPublicId } = require('../services/cloudinaryService');

function formatFileSize(bytes) {
   if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
   return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function serializeRecord(doc) {
   return {
      id: doc._id.toString(),
      title: doc.title,
      type: doc.category,
      doc: doc.providerName,
      date: doc.createdAt,
      size: formatFileSize(doc.fileSizeBytes),
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
   };
}

// POST /api/patient/records  (multipart/form-data, field: "document")
async function createRecord(req, res, next) {
   try {
      const { title, category, providerName } = req.body;

      if (!title || !title.trim() || !providerName || !providerName.trim()) {
         return res.status(400).json({ success: false, message: 'Title and provider name are required' });
      }
      if (!category || !RECORD_CATEGORIES.includes(category)) {
         return res.status(400).json({
            success: false,
            message: `Category must be one of: ${RECORD_CATEGORIES.join(', ')}`,
         });
      }
      if (!req.file) {
         return res.status(400).json({ success: false, message: 'A document file is required' });
      }

      // resource_type "auto" lets Cloudinary correctly store PDFs (raw) vs
      // images, unlike cloudinaryService's default of "image".
      const { url, publicId } = await uploadBuffer(req.file.buffer, {
         folder: 'apna-doctor/patient-records',
         resource_type: 'auto',
      });

      const record = await Record.create({
         patient: req.user.id,
         title: title.trim(),
         category,
         providerName: providerName.trim(),
         fileUrl: url,
         filePublicId: publicId,
         fileType: req.file.mimetype,
         fileSizeBytes: req.file.size,
      });

      return res.status(201).json({ success: true, data: serializeRecord(record) });
   } catch (err) {
      next(err);
   }
}

// GET /api/patient/records?category=&search=
async function getRecords(req, res, next) {
   try {
      const { category, search } = req.query;
      const filter = { patient: req.user.id };

      if (category && category !== 'All') {
         if (!RECORD_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, message: 'Invalid category filter' });
         }
         filter.category = category;
      }

      if (search && search.trim()) {
         const regex = new RegExp(search.trim(), 'i');
         filter.$or = [{ title: regex }, { providerName: regex }];
      }

      const records = await Record.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: records.map(serializeRecord) });
   } catch (err) {
      next(err);
   }
}

// GET /api/patient/records/:id
async function getRecordById(req, res, next) {
   try {
      const record = await Record.findOne({ _id: req.params.id, patient: req.user.id });
      if (!record) {
         return res.status(404).json({ success: false, message: 'Record not found' });
      }
      return res.status(200).json({ success: true, data: serializeRecord(record) });
   } catch (err) {
      next(err);
   }
}

// DELETE /api/patient/records/:id
async function deleteRecord(req, res, next) {
   try {
      const record = await Record.findOne({ _id: req.params.id, patient: req.user.id });
      if (!record) {
         return res.status(404).json({ success: false, message: 'Record not found' });
      }

      await deleteByPublicId(record.filePublicId);
      await record.deleteOne();

      return res.status(200).json({ success: true, message: 'Record deleted' });
   } catch (err) {
      next(err);
   }
}

module.exports = { createRecord, getRecords, getRecordById, deleteRecord };
