// routes/webhookRoutes.js
//
// Mounted in server.js with express.raw() ahead of the global
// express.json() middleware — see that file for why ordering matters here.
// No auth middleware: Razorpay calls this directly, unauthenticated except
// for the HMAC signature the controller verifies against the raw body.

const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controllers/webhookController');

router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;
