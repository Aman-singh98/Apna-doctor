// config/companyConfig.js
//
// Business identity used on generated invoice PDFs (see
// services/invoicePdfService.js). Values transcribed from the official
// letterhead artwork supplied for invoicing (assets/invoice-letterhead.jpg).
//
// If any of these change (new phone number, GSTIN issued, new address),
// update here — nothing else in the codebase should hardcode them.

module.exports = {
   legalName: 'Apna Doctor Healthcare LLP',
   tagline: 'Care Anytime Anywhere',
   phone: '82782-88099',
   email: 'apdcare77@gmail.com',
   website: 'apdcare.in',
   address: 'Hisar, Haryana, India',

   // Not yet registered — see constants/gstConstants.js note (2). Fill in
   // once available; invoicePdfService will automatically stop printing the
   // "not yet registered" notice as soon as this is non-null.
   gstin: null,
};
