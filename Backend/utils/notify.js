const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const { messaging } = require('../config/firebaseAdmin'); // adjust path to where firebaseAdmin.js lives

/**
 * Creates a notification row AND sends a push to every registered device
 * for that recipient. Call this from wherever the real event happens:
 * appointment booked, prescription uploaded, payment received, etc.
 *
 * @param {Object} params
 * @param {String} params.recipientId
 * @param {'patient'|'doctor'} params.recipientRole
 * @param {String} params.type
 * @param {String} params.title
 * @param {String} params.desc
 * @param {Object} [params.meta]
 */
async function notify({ recipientId, recipientRole, type, title, desc, meta = {} }) {
  // 1. Persist it — this is what the Notifications List screen reads
  const notif = await Notification.create({
    recipientId,
    recipientRole,
    type,
    title,
    desc,
    meta,
  });

  // 2. Push to all of this user's devices (best-effort, never throws up to caller)
  try {
    const tokens = await DeviceToken.find({ userId: recipientId }).select('token');
    if (tokens.length) {
      const message = {
        tokens: tokens.map((t) => t.token),
        notification: { title, body: desc },
        data: {
          type,
          notificationId: String(notif._id),
          ...Object.fromEntries(
            Object.entries(meta).map(([k, v]) => [k, String(v)]) // FCM data payload must be string:string
          ),
        },
      };
      const res = await messaging.sendEachForMulticast(message);

      // Clean up dead tokens (uninstalled app, etc.)
      res.responses.forEach((r, i) => {
        if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
          DeviceToken.deleteOne({ token: tokens[i].token }).catch(() => {});
        }
      });
    }
  } catch (err) {
    // Push failure should never block the actual business action (booking, payment, etc.)
    console.error('[notify] push failed:', err.message);
  }

  return notif;
}

module.exports = { notify };
