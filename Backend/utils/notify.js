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

/**
 * Broadcasts a notification to every active admin — used for events the
 * whole support team should see (e.g. a patient/doctor replying on a
 * ticket), where there's no single "owner" admin to target.
 *
 * Fans out to notify() per admin so each gets their own Notification row
 * and push, using the same best-effort semantics (one admin's push failure
 * never blocks another's).
 *
 * @param {Object} params - same shape as notify(), minus recipientId/recipientRole
 */
async function notifyAllAdmins({ type, title, desc, meta = {} }) {
  const Admin = require('../models/Admin');
  const admins = await Admin.find({ isActive: true }).select('_id');
  await Promise.all(
    admins.map((admin) =>
      notify({ recipientId: admin._id, recipientRole: 'admin', type, title, desc, meta }).catch((err) =>
        console.error('[notifyAllAdmins] failed for admin', admin._id.toString(), err.message)
      )
    )
  );
}

module.exports = { notify, notifyAllAdmins };
