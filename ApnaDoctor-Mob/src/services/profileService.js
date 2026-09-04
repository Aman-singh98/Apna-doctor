// src/services/profileService.js
//
// Used by: app/doctor/profile.js, app/doctor/profile-edit.js

import api from './api';

// GET /doctor/profile/me  → full doctor document (minus password)
export async function getMyProfile() {
   const { data } = await api.get('/doctor/profile/me');
   return data;
}

// PATCH /doctor/profile/me
// body: { name, qualification, experience, hospital, videoFee, chatFee, bio, specialization }
export async function updateMyProfile(updates) {
   const { data } = await api.patch('/doctor/profile/me', updates);
   return data;
}

// POST /doctor/profile/me/photo  (multipart/form-data, field name: "photo")
export async function uploadMyPhoto(fileUri) {
   const formData = new FormData();
   formData.append('photo', {
      uri: fileUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
   });

   // IMPORTANT: do NOT set 'Content-Type': 'multipart/form-data' manually.
   // React Native's networking layer auto-generates the multipart
   // Content-Type header for a FormData body, including the required
   // `boundary=...` parameter — a manually-set header without a boundary
   // produces a body multer can't parse. See utils/doctorAuth.js for the
   // same note on submitDoctorSignup.
   const { data } = await api.post('/doctor/profile/me/photo', formData);
   return data;
}

// POST /doctor/profile/me/signature  (multipart/form-data, field name: "signature")
// Accepts either a PDF or an image file — a doctor's signature can be
// uploaded either way at signup (see doctor-signup.js's SIGNATURE_SLOT,
// which offers "upload a PDF" or "draw it"), so editing it later needs to
// support the same two shapes rather than assuming it's always an image.
// `file` is { uri, name, type } — same shape doctor-signup.js already
// builds for its documents map.
export async function uploadMySignature(file) {
   const formData = new FormData();
   formData.append('signature', {
      uri: file.uri,
      name: file.name,
      type: file.type,
   });

   const { data } = await api.post('/doctor/profile/me/signature', formData);
   return data;
}

// GET /doctor/me/payout-kyc
// Returns only masked/non-sensitive payout fields (panLast4, bankAccountLast4,
// upiIdMasked, ifscCode, legalBusinessName, businessType, contactEmail) plus
// payoutStatus — never the encrypted PAN/bank/UPI values. Used by
// profile-edit.js's "Account & Payout Details" section so a doctor can see
// what's currently on file before re-submitting via submitPayoutKyc()
// (utils/doctorAuth.js), which is the same endpoint doctor-signup.js uses.
export async function getMyPayoutInfo() {
   const { data } = await api.get('/doctor/me/payout-kyc');
   return data;
}
