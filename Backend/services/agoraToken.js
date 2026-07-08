const { RtcTokenBuilder, RtcRole } = require('agora-token');

function generateAgoraToken(channelName, uid, role = 'publisher') {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expireSeconds = parseInt(process.env.AGORA_TOKEN_EXPIRY_SECONDS, 10);

  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireSeconds;

  const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId, appCertificate, channelName, uid, rtcRole, privilegeExpireTime
  );

  return { token, appId, channelName, uid, expiresAt: privilegeExpireTime };
}

module.exports = { generateAgoraToken };
