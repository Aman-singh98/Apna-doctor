// constants/doctorFees.js
//
// Single source of truth for doctor categories, revenue split, and fixed
// consultation fees. Used by doctor-signup.js, profile.js, and
// profile-edit.js so the numbers never drift out of sync between screens.
//
// NOTE: These values should match whatever the backend uses to compute
// fees/payouts. If you ever change a price here, update the backend
// config too (see doctorFeeConfig on the server side).

export const DOCTOR_CATEGORIES = [
   {
      key: 'gp',
      label: 'MBBS (General Physician)',
      shortLabel: 'General Physician',
      splitDoctor: 70,
      splitPlatform: 30,
      fees: { video: 399, audio: 299, chat: 199 },
   },
   {
      key: 'specialist',
      label: 'Specialist (MD)',
      shortLabel: 'Specialist',
      splitDoctor: 75,
      splitPlatform: 25,
      fees: { video: 599, audio: 499, chat: 299 },
   },
   {
      key: 'super_specialist',
      label: 'Super Specialist (MBBS / MD / DM)',
      shortLabel: 'Super Specialist',
      splitDoctor: 80,
      splitPlatform: 20,
      fees: { video: 999, audio: 799, chat: 599 },
   },
];

export const getCategoryByKey = (key) =>
   DOCTOR_CATEGORIES.find((c) => c.key === key) || null;

export const getFeesForCategory = (key) => {
   const cat = getCategoryByKey(key);
   return cat ? cat.fees : { video: 0, audio: 0, chat: 0 };
};

export const getCategoryLabel = (key) => {
   const cat = getCategoryByKey(key);
   return cat ? cat.shortLabel : '';
};

// Specializations grouped under each category. Once a doctor picks a
// category, the specialization chip list is filtered to this set.
export const SPECIALIZATIONS_BY_CATEGORY = {
   gp: ['General Physician'],
   specialist: [
      'Cardiologist', 'Dermatologist', 'Neurologist', 'Orthopedic',
      'Pediatrician', 'Psychiatrist', 'Gynecologist', 'ENT Specialist',
   ],
   super_specialist: [
      'Cardiac Surgeon', 'Neurosurgeon', 'Oncologist', 'Nephrologist',
      'Gastroenterologist', 'Endocrinologist',
   ],
};
