const mongoose = require('mongoose');
const { Schema } = mongoose;

const familyMemberSchema = new Schema(
   {
      // The patient account that owns this family sub-profile.
      patient: {
         type: Schema.Types.ObjectId,
         ref: 'Patient',
         required: true,
         index: true,
      },

      name: { type: String, trim: true, required: true },

      relation: {
         type: String,
         enum: ['Spouse', 'Child', 'Parent', 'Sibling'],
         required: true,
      },

      // Kept as a String to match the free-text "Age" input on the
      // family-members.js screen, same convention as Patient.dob.
      age: { type: String, trim: true, required: true },

      bloodGroup: { type: String, trim: true, default: '' },
   },
   { timestamps: true }
);

module.exports = mongoose.model('FamilyMember', familyMemberSchema);
