// ─── Firebase Admin Config ────────────────────────────────────────────────────
// Initialises the Firebase Admin SDK at boot.
// Requires serviceAccountKey.json in /config/ (gitignored).
// Exports `messaging` (push notifications) and `auth` (mints custom tokens
// so the app can sign in to Firebase as the *same* user it's already
// authenticated as on your own backend — this is what lets Firestore
// security rules trust request.auth.uid).
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
const auth = admin.auth();

module.exports = { messaging, auth };
