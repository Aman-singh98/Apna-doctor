// services/otpService.js
//
// All OTP logic lives here so swapping to a real SMS provider
// (Twilio, MSG91, Firebase, etc.) means editing only this file.

const DEV_OTP = '1234';

// In-memory store for dev. Replace with Redis or DB cache in production.
const otpStore = new Map();

async function sendOtp(phone) {
  if (process.env.NODE_ENV === 'production') {
    // TODO: integrate real SMS provider here
    // Example for MSG91:
    //   const response = await fetch(`https://api.msg91.com/api/v5/otp?...`);
    // Example for Twilio:
    //   await twilioClient.verify.v2.services(SID).verifications.create({ to: `+91${phone}`, channel: 'sms' });
    throw new Error('Real SMS provider not configured yet');
  }

  // Dev mode: static OTP, no SMS sent
  otpStore.set(phone, { otp: DEV_OTP, expiresAt: Date.now() + 5 * 60 * 1000 });
  console.log(`[DEV] OTP for ${phone}: ${DEV_OTP}`);
}

async function verifyOtp(phone, otp) {
  if (process.env.NODE_ENV === 'production') {
    // TODO: verify against real provider
    // Example for Twilio:
    //   const check = await twilioClient.verify.v2.services(SID).verificationChecks.create({ to: `+91${phone}`, code: otp });
    //   return check.status === 'approved';
    throw new Error('Real SMS provider not configured yet');
  }

  // Dev mode: accept static OTP for any phone
  return otp === DEV_OTP;
}

module.exports = { sendOtp, verifyOtp };
