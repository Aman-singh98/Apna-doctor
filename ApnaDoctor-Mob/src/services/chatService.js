// ─── services/chatService.js ──────────────────────────────────────────────────
// Same file-location convention as your other services — sits in
// src/services/ alongside api.js, firebaseClient.js, etc.
import { signInWithCustomToken } from 'firebase/auth';
import {
   doc, setDoc, addDoc, collection, serverTimestamp,
   onSnapshot, query, orderBy, getDoc,
} from 'firebase/firestore';
import { firestore, firebaseAuthInstance } from './firebaseClient';
import api from './api';

// Exchanges your backend JWT for a Firebase session. `role` picks which
// protected endpoint to call — mirrors the same doctor/patient split you
// already use in agoraService.js's fetchAgoraToken().
async function ensureFirebaseSignedIn(role) {
   if (firebaseAuthInstance.currentUser) return firebaseAuthInstance.currentUser;

   const path = role === 'doctor' ? '/doctor/chat/firebase-token' : '/patient/chat/firebase-token';
   const { data } = await api.get(path);
   const cred = await signInWithCustomToken(firebaseAuthInstance, data.token);
   return cred.user;
}

// Creates the /chats/{appointmentId} doc the first time either side opens
// the chat. Safe to call repeatedly — setDoc with merge:true won't clobber
// lastMessage/updatedAt written by the other side.
async function ensureChatDoc({ appointmentId, patientId, doctorId, patientName, doctorName }) {
   const chatRef = doc(firestore, 'chats', appointmentId);
   const existing = await getDoc(chatRef);
   if (!existing.exists()) {
      await setDoc(chatRef, {
         patientId, doctorId, patientName, doctorName,
         lastMessage: '', updatedAt: serverTimestamp(),
      });
   }
   return chatRef;
}

// Subscribes to messages for a chat in real time. Returns an unsubscribe fn
// — call it in your useEffect cleanup.
function subscribeToMessages(appointmentId, onChange) {
   const q = query(
      collection(firestore, 'chats', appointmentId, 'messages'),
      orderBy('createdAt', 'asc')
   );
   return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onChange(msgs);
   }, (err) => {
      console.warn('Chat subscription error:', err.message);
   });
}

// Sends a message and bumps the chat doc's lastMessage preview.
async function sendMessage({ appointmentId, senderId, senderRole, text }) {
   const trimmed = text.trim();
   if (!trimmed) return;

   await addDoc(collection(firestore, 'chats', appointmentId, 'messages'), {
      senderId, senderRole, text: trimmed, createdAt: serverTimestamp(),
   });

   await setDoc(doc(firestore, 'chats', appointmentId), {
      lastMessage: trimmed, updatedAt: serverTimestamp(),
   }, { merge: true });
}

export { ensureFirebaseSignedIn, ensureChatDoc, subscribeToMessages, sendMessage };
