// ─── DOCTOR-SIDE FILE ──────────────────────────────────────────────────────
// app/doctor/consultation-call.js
//
// Video/audio call screen opened from the DOCTOR app when a doctor joins
// a consultation. Do not confuse with the patient-side file of the same
// filename (app/patient/consultation-call.js) — same name, different folder,
// different role passed to fetchAgoraToken('doctor'), and this version also
// calls completeAppointment() on hangup + offers the "Write Rx" shortcut.
// ─────────────────────────────────────────────────────────────────────────

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   PermissionsAndroid,
   Platform,
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
import { completeAppointment } from '../../services/appointmentService';

const TEAL = '#1A7E8A';

// See patient/consultation-call.js for why this runtime request is required
// even though app.json already declares these permissions.
async function requestCallPermissions(needsCamera) {
   if (Platform.OS !== 'android') return true;
   const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
   if (needsCamera) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
   const granted = await PermissionsAndroid.requestMultiple(perms);
   return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export default function DoctorConsultationCallScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const insets = useSafeAreaInsets();

   const appointmentId = params.appointmentId;
   const patientName = params.patientName || 'Patient';
   const diagnosis = params.diagnosis || '';
   const patientInitials = patientName.split(' ').map((w) => w[0]).join('').toUpperCase();

   const engineRef = useRef(null);
   const [isMuted, setIsMuted] = useState(false);
   const [isCamOff, setIsCamOff] = useState(false);
   const [callTime, setCallTime] = useState(0);
   const [connecting, setConnecting] = useState(true);
   const [remoteUid, setRemoteUid] = useState(null);
   const [callInfo, setCallInfo] = useState(null);

   useEffect(() => {
      if (!appointmentId) {
         Alert.alert('Missing appointment', 'No appointment was specified for this call.', [
            { text: 'OK', onPress: () => router.back() },
         ]);
      }
   }, [appointmentId]);

   useEffect(() => {
      if (!appointmentId) return;
      let mounted = true;

      const setup = async () => {
         try {
            const data = await fetchAgoraToken(appointmentId, 'doctor');
            if (!mounted) return;
            setCallInfo(data);

            const permsGranted = await requestCallPermissions(data.appointmentType === 'Video');
            if (!mounted) return;
            if (!permsGranted) {
               Alert.alert(
                  'Permission required',
                  `Please allow microphone${data.appointmentType === 'Video' ? ' and camera' : ''} access to join this consultation.`,
                  [{ text: 'OK', onPress: () => router.back() }]
               );
               return;
            }

            const engine = createAgoraRtcEngine();
            engineRef.current = engine;
            engine.initialize({
               appId: data.appId,
               channelProfile: ChannelProfileType.ChannelProfileCommunication,
            });

            engine.registerEventHandler({
               onJoinChannelSuccess: () => setConnecting(false),
               onUserJoined: (_connection, uid) => setRemoteUid(uid),
               onUserOffline: () => setRemoteUid(null),
               onError: (err) => console.warn('Agora error:', err),
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

   const endCallAndCleanup = () => {
      engineRef.current?.leaveChannel();
      engineRef.current?.release();
      engineRef.current = null;
   };

   const handleHangup = () => {
      Alert.alert(
         'End Consultation',
         'Are you sure you want to end this consultation call?',
         [
            { text: 'Continue', style: 'cancel' },
            {
               text: 'End Call',
               style: 'destructive',
               onPress: async () => {
                  endCallAndCleanup();
                  try {
                     if (appointmentId) await completeAppointment(appointmentId);
                  } catch (err) {
                     console.warn('Failed to mark appointment completed:', err);
                  }
                  Alert.alert(
                     'Consultation Ended',
                     'Would you like to write a prescription for this patient?',
                     [
                        { text: 'Skip', onPress: () => router.replace('/doctor/dashboard') },
                        {
                           text: 'Write Rx',
                           onPress: () => router.replace({
                              pathname: '/doctor/prescription-write',
                              params: { patientName, diagnosis },
                           }),
                        },
                     ]
                  );
               },
            },
         ]
      );
   };

   return (
      <View style={styles.safe}>
         <StatusBar barStyle="light-content" backgroundColor="#121212" />

         <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <View style={styles.connectionStatus}>
               <View style={[styles.greenDot, connecting && styles.dotConnecting]} />
               <Text style={styles.statusTxt}>{connecting ? 'Connecting…' : 'Live'}</Text>
            </View>
            <View style={styles.timerContainer}>
               <Text style={styles.timerTxt}>{formatTime(callTime)}</Text>
            </View>
         </View>

         <View style={styles.mainFeed}>
            {connecting ? (
               <View style={styles.videoPlaceholder}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.videoLabel}>Connecting to {patientName}…</Text>
               </View>
            ) : callInfo?.appointmentType === 'Video' && remoteUid != null ? (
               <RtcSurfaceView style={styles.remoteVideo} canvas={{ uid: remoteUid }} />
            ) : (
               <View style={styles.avatarLargeBg}>
                  <Text style={styles.avatarLargeTxt}>{patientInitials}</Text>
                  <Text style={styles.feedStatusTxt}>{patientName}</Text>
                  <Text style={styles.feedStatusSub}>{diagnosis || (remoteUid == null ? 'Waiting to join…' : 'Audio consultation')}</Text>
               </View>
            )}

            {callInfo?.appointmentType === 'Video' && !isCamOff && !connecting && (
               <View style={styles.pipContainer}>
                  <RtcSurfaceView style={styles.pipVideo} canvas={{ uid: 0 }} />
                  <View style={styles.pipLabelBg}>
                     <Text style={styles.pipLabelTxt}>You</Text>
                  </View>
               </View>
            )}
         </View>

         <View style={[styles.controlsPanel, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.patientHeader}>
               <View>
                  <Text style={styles.patientName}>{patientName}</Text>
                  <Text style={styles.patientIssue}>{diagnosis}</Text>
               </View>
               <TouchableOpacity
                  style={styles.rxPillBtn}
                  onPress={() => router.push({
                     pathname: '/doctor/prescription-write',
                     params: { patientName, diagnosis },
                  })}
               >
                  <Ionicons name="document-text-outline" size={14} color={TEAL} style={{ marginRight: 4 }} />
                  <Text style={styles.rxPillTxt}>Write Rx</Text>
               </TouchableOpacity>
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
   mainFeed: { flex: 1, position: 'relative' },
   remoteVideo: { flex: 1 },
   videoPlaceholder: { flex: 1, backgroundColor: '#1F1F1F', justifyContent: 'center', alignItems: 'center' },
   videoLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 'bold', marginTop: 16 },
   avatarLargeBg: { flex: 1, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
   avatarLargeTxt: { fontSize: 64, fontWeight: 'bold', color: TEAL },
   feedStatusTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 18 },
   feedStatusSub: { color: '#aaa', fontSize: 13, marginTop: 4 },
   pipContainer: { position: 'absolute', top: 80, right: 20, width: 90, height: 130, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', elevation: 5 },
   pipVideo: { flex: 1, backgroundColor: '#333' },
   pipLabelBg: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   pipLabelTxt: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
   controlsPanel: { backgroundColor: 'rgba(18,18,18,0.97)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
   patientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
   patientName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
   patientIssue: { color: '#888', fontSize: 12, marginTop: 2 },
   rxPillBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
   rxPillTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
   circleBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
   circleBtnActive: { backgroundColor: '#E24B4A' },
   circleBtnHangup: { backgroundColor: '#E24B4A', width: 58, height: 58, borderRadius: 29 },
});
