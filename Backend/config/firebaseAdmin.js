// ─── Firebase Admin Config ────────────────────────────────────────────────────
// Initialises the Firebase Admin SDK at boot.
// Requires serviceAccountKey.json in /config/ (gitignored).
// Exports the messaging instance for use in controllers.
const admin = require('firebase-admin');
const path  = require('path');

// Fail immediately at server start if the key file is missing
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const messaging = admin.messaging();

module.exports = { messaging };
