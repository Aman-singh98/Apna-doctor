import { API_BASE_URL } from '../config';

export async function fetchAgoraToken(appointmentId, role) {
  const res = await fetch(`${API_BASE_URL}/consultation/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ appointment_id: appointmentId, role }),
  });
  if (!res.ok) throw new Error('Failed to get call token');
  return res.json(); // { token, appId, channelName, uid, expiresAt }
}
