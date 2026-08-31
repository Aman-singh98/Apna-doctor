// models/Record.js
const mongoose = require('mongoose');

const RECORD_CATEGORIES = ['Lab Reports', 'Prescriptions', 'Vaccines'];

const recordSchema = new mongoose.Schema(
   {
      patient: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Patient',
         required: true,
         index: true,
      },
      title: {
         type: String,
         required: [true, 'Record title is required'],
         trim: true,
      },
      category: {
         type: String,
         enum: RECORD_CATEGORIES,
         required: [true, 'Record category is required'],
      },
      // Doctor / lab / portal name the record came from — free text, not a ref,
      // since it may not correspond to a Doctor account in the system
      // (e.g. "CoWIN Portal", "Max Labs").
      providerName: {
         type: String,
         required: [true, 'Provider name is required'],
         trim: true,
      },
      fileUrl: {
         type: String,
         required: true,
      },
      filePublicId: {
         type: String,
         required: true,
      },
      fileType: {
         type: String, // original mimetype, e.g. 'application/pdf', 'image/jpeg'
         required: true,
      },
      fileSizeBytes: {
         type: Number,
         required: true,
      },
   },
   { timestamps: true }
);

recordSchema.index({ patient: 1, category: 1 });
recordSchema.index({ patient: 1, title: 'text', providerName: 'text' });

module.exports = mongoose.model('Record', recordSchema);
module.exports.RECORD_CATEGORIES = RECORD_CATEGORIES;
