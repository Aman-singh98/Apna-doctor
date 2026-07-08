// ─── PATIENT-SIDE FILE ─────────────────────────────────────────────────────
// app/patient/consultation-call.js
//
// Video/audio call screen opened from the PATIENT app when a patient joins
// a consultation. Do not confuse with the doctor-side file of the same
// filename (app/doctor/consultation-call.js) — same name, different folder,
// different role passed to fetchAgoraToken('patient').
// ─────────────────────────────────────────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
   ChannelProfileType,
   ClientRoleType,
   createAgoraRtcEngine,
   RtcSurfaceView,
} from 'react-native-agora';

import { fetchAgoraToken } from '../../services/agoraService';

const TEAL = '#1A7E8A';

export default function ConsultationCallScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const insets = useSafeAreaInsets();

   // Required — the whole call is scoped to this appointment.
   const appointmentId = params.appointmentId;
   const docName = params.docName || 'Doctor';
   const spec = params.spec || '';
   const callType = params.callType || 'Video'; // 'Video' | 'Audio'

   const engineRef = useRef(null);
   const [isMuted, setIsMuted] = useState(false);
   const [isCamOff, setIsCamOff] = useState(callType === 'Audio');
   const [callTime, setCallTime] = useState(0);
   const [connecting, setConnecting] = useState(true);
   const [remoteUid, setRemoteUid] = useState(null);
   const [callInfo, setCallInfo] = useState(null); // { appId, channelName, uid }

   // ── Guard: no appointmentId means we don't know which call to join ────────
   useEffect(() => {
      if (!appointmentId) {
         Alert.alert('Missing appointment', 'No appointment was specified for this call.', [
            { text: 'OK', onPress: () => router.back() },
         ]);
      }
   }, [appointmentId]);

   // ── Join the Agora channel on mount ────────────────────────────────────────
   useEffect(() => {
      if (!appointmentId) return;
      let mounted = true;

      const setup = async () => {
         try {
            const data = await fetchAgoraToken(appointmentId, 'patient');
            if (!mounted) return;
            setCallInfo(data);

            const engine = createAgoraRtcEngine();
            engineRef.current = engine;
            engine.initialize({
               appId: data.appId,
               channelProfile: ChannelProfileType.ChannelProfileCommunication,
            });

            engine.registerEventHandler({
               onJoinChannelSuccess: () => {
                  setConnecting(false);
               },
               onUserJoined: (_connection, uid) => {
                  setRemoteUid(uid);
               },
               onUserOffline: () => {
                  setRemoteUid(null);
               },
               onError: (err) => {
                  console.warn('Agora error:', err);
               },
            });

            if (data.appointmentType === 'Video') {
               engine.enableVideo();
            } else {
               engine.disableVideo();
               engine.enableAudio();
            }

            engine.joinChannel(data.token, data.channelName, data.uid, {
               clientRoleType: ClientRoleType.ClientRoleBroadcaster,
            });
         } catch (err) {
            console.warn('Failed to join consultation:', err);
            Alert.alert('Connection failed', 'Could not connect to the consultation. Please try again.', [
               { text: 'OK', onPress: () => router.back() },
            ]);
         }
      };

      setup();

      return () => {
         mounted = false;
         if (engineRef.current) {
            engineRef.current.leaveChannel();
            engineRef.current.release();
            engineRef.current = null;
         }
      };
   }, [appointmentId]);

   // ── Call duration timer — starts only once actually connected ─────────────
   useEffect(() => {
      if (connecting) return;
      const interval = setInterval(() => setCallTime((prev) => prev + 1), 1000);
      return () => clearInterval(interval);
   }, [connecting]);

   const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
   };

   const toggleMute = () => {
      const next = !isMuted;
      setIsMuted(next);
      engineRef.current?.muteLocalAudioStream(next);
   };

   const toggleCam = () => {
      const next = !isCamOff;
      setIsCamOff(next);
      engineRef.current?.enableLocalVideo(!next);
   };

   const handleHangup = () => {
      Alert.alert(
         'End Consultation',
         'Are you sure you want to end this consultation call?',
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'End Call',
               style: 'destructive',
               onPress: () => {
                  engineRef.current?.leaveChannel();
                  engineRef.current?.release();
                  engineRef.current = null;
                  Alert.alert('Consultation Ended', 'Your prescription will be uploaded shortly. Thank you!', [
                     { text: 'OK', onPress: () => router.replace('/patient/dashboard') },
                  ]);
               },
            },
         ]
      );
   };

   return (
      <View style={styles.safe}>
         <StatusBar barStyle="light-content" backgroundColor="#121212" />

         {/* Top Bar */}
         <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <View style={styles.connectionStatus}>
               <View style={[styles.greenDot, connecting && styles.dotConnecting]} />
               <Text style={styles.statusTxt}>{connecting ? 'Connecting…' : 'Live'}</Text>
            </View>
            <View style={styles.timerContainer}>
               <Text style={styles.timerTxt}>{formatTime(callTime)}</Text>
            </View>
         </View>

         {/* Main Feed */}
         <View style={styles.mainFeed}>
            {connecting ? (
               <View style={styles.videoPlaceholder}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.videoLabel}>Connecting to {docName}…</Text>
               </View>
            ) : callInfo?.appointmentType === 'Video' && remoteUid != null ? (
               <RtcSurfaceView
                  style={styles.remoteVideo}
                  canvas={{ uid: remoteUid }}
               />
            ) : (
               <View style={styles.avatarLargeBg}>
                  <Text style={styles.avatarLargeTxt}>Dr</Text>
                  <Text style={styles.feedStatusTxt}>{docName}</Text>
                  <Text style={styles.feedStatusSub}>{spec || (remoteUid == null ? 'Waiting to join…' : 'Audio consultation')}</Text>
               </View>
            )}

            {/* Local Self Video PIP — only meaningful for video calls */}
            {callInfo?.appointmentType === 'Video' && !isCamOff && !connecting && (
               <View style={styles.pipContainer}>
                  <RtcSurfaceView style={styles.pipVideo} canvas={{ uid: 0 }} />
                  <View style={styles.pipLabelBg}>
                     <Text style={styles.pipLabelTxt}>You</Text>
                  </View>
               </View>
            )}
         </View>

         {/* Controls */}
         <View style={[styles.controlsPanel, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.docHeader}>
               <Text style={styles.docName}>{docName}</Text>
               <Text style={styles.docSpec}>{spec}</Text>
            </View>

            <View style={styles.controlsRow}>
               <TouchableOpacity
                  style={[styles.circleBtn, isMuted && styles.circleBtnActive]}
                  onPress={toggleMute}
               >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#fff' : '#121212'} />
               </TouchableOpacity>

               {callInfo?.appointmentType === 'Video' && (
                  <TouchableOpacity
                     style={[styles.circleBtn, isCamOff && styles.circleBtnActive]}
                     onPress={toggleCam}
                  >
                     <Ionicons name={isCamOff ? 'videocam-off' : 'videocam'} size={24} color={isCamOff ? '#fff' : '#121212'} />
                  </TouchableOpacity>
               )}

               <TouchableOpacity
                  style={[styles.circleBtn, styles.circleBtnHangup]}
                  onPress={handleHangup}
               >
                  <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
               </TouchableOpacity>
            </View>
         </View>
      </View>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#121212' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10, position: 'absolute', top: 0, left: 0, right: 0 },
   connectionStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
   greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D9E75', marginRight: 6 },
   dotConnecting: { backgroundColor: '#E2B33A' },
   statusTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
   timerContainer: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
   timerTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
   mainFeed: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
   remoteVideo: { flex: 1, width: '100%' },
   videoPlaceholder: { flex: 1, width: '100%', backgroundColor: '#1F1F1F', justifyContent: 'center', alignItems: 'center' },
   videoLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 'bold', marginTop: 16 },
   avatarLargeBg: { flex: 1, width: '100%', backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
   avatarLargeTxt: { fontSize: 64, fontWeight: 'bold', color: TEAL },
   feedStatusTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 18 },
   feedStatusSub: { color: '#aaa', fontSize: 13, marginTop: 4 },
   pipContainer: { position: 'absolute', top: 80, right: 20, width: 90, height: 130, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', elevation: 5 },
   pipVideo: { flex: 1, backgroundColor: '#333' },
   pipLabelBg: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   pipLabelTxt: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
   controlsPanel: { backgroundColor: 'rgba(20, 20, 20, 0.95)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 },
   docHeader: { alignItems: 'center', marginBottom: 20 },
   docName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
   docSpec: { color: '#888', fontSize: 12, marginTop: 2 },
   controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
   circleBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
   circleBtnActive: { backgroundColor: '#E24B4A' },
   circleBtnHangup: { backgroundColor: '#E24B4A', width: 56, height: 56, borderRadius: 28 },
});
