import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   Alert,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function DoctorConsultationCallScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const patientName = params.patientName || 'Rahul Sharma';
   const diagnosis = params.diagnosis || 'Hypertension follow-up';
   const patientInitials = patientName.split(' ').map(w => w[0]).join('').toUpperCase();

   const insets = useSafeAreaInsets();
   const [isMuted, setIsMuted] = useState(false);
   const [isCamOff, setIsCamOff] = useState(false);
   const [callTime, setCallTime] = useState(0);

   useEffect(() => {
      const interval = setInterval(() => setCallTime(prev => prev + 1), 1000);
      return () => clearInterval(interval);
   }, []);

   const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
               onPress: () => {
                  Alert.alert(
                     'Consultation Ended',
                     'Would you like to write a prescription for this patient?',
                     [
                        { text: 'Skip', onPress: () => router.replace('/doctor/dashboard') },
                        {
                           text: 'Write Rx',
                           onPress: () => router.replace({
                              pathname: '/doctor/prescription-write',
                              params: { patientName, diagnosis }
                           })
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

         {/* Top Bar */}
         <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <View style={styles.connectionStatus}>
               <View style={styles.greenDot} />
               <Text style={styles.statusTxt}>HD Quality · Live</Text>
            </View>
            <View style={styles.timerContainer}>
               <Text style={styles.timerTxt}>{formatTime(callTime)}</Text>
            </View>
         </View>

         {/* Patient Video Feed */}
         <View style={styles.mainFeed}>
            {isCamOff ? (
               <View style={styles.avatarLargeBg}>
                  <Text style={styles.avatarLargeTxt}>{patientInitials}</Text>
                  <Text style={styles.feedStatusTxt}>{patientName}</Text>
                  <Text style={styles.feedStatusSub}>Patient · Camera Off</Text>
               </View>
            ) : (
               <View style={styles.videoPlaceholder}>
                  <Ionicons name="person" size={100} color="rgba(255,255,255,0.12)" />
                  <Text style={styles.videoLabel}>{patientName} (Patient Feed)</Text>
                  <Text style={styles.videoSub}>28 yrs · {diagnosis}</Text>
               </View>
            )}

            {/* Doctor Self PIP */}
            <View style={styles.pipContainer}>
               <View style={styles.pipCard}>
                  <Text style={styles.pipInitial}>RK</Text>
                  <View style={styles.pipLabelBg}>
                     <Text style={styles.pipLabelTxt}>You</Text>
                  </View>
               </View>
            </View>
         </View>

         {/* Controls Panel */}
         <View style={[styles.controlsPanel, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.patientHeader}>
               <View style={styles.patientHeaderLeft}>
                  <Text style={styles.patientName}>{patientName}</Text>
                  <Text style={styles.patientIssue}>{diagnosis}</Text>
               </View>
               <TouchableOpacity
                  style={styles.rxPillBtn}
                  onPress={() => router.push({
                     pathname: '/doctor/prescription-write',
                     params: { patientName, diagnosis }
                  })}
               >
                  <Ionicons name="document-text-outline" size={14} color={TEAL} style={{ marginRight: 4 }} />
                  <Text style={styles.rxPillTxt}>Write Rx</Text>
               </TouchableOpacity>
            </View>

            <View style={styles.controlsRow}>
               <TouchableOpacity
                  style={[styles.circleBtn, isMuted && styles.circleBtnActive]}
                  onPress={() => setIsMuted(!isMuted)}
               >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#fff' : '#121212'} />
               </TouchableOpacity>

               <TouchableOpacity
                  style={[styles.circleBtn, isCamOff && styles.circleBtnActive]}
                  onPress={() => setIsCamOff(!isCamOff)}
               >
                  <Ionicons name={isCamOff ? 'videocam-off' : 'videocam'} size={24} color={isCamOff ? '#fff' : '#121212'} />
               </TouchableOpacity>

               <TouchableOpacity
                  style={styles.circleBtn}
                  onPress={() => Alert.alert('Camera', 'Switched to front camera.')}
               >
                  <Ionicons name="camera-reverse" size={24} color="#121212" />
               </TouchableOpacity>

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
   statusTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
   timerContainer: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
   timerTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
   mainFeed: { flex: 1, position: 'relative' },
   videoPlaceholder: { flex: 1, backgroundColor: '#1F1F1F', justifyContent: 'center', alignItems: 'center' },
   videoLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 'bold', marginTop: 16 },
   videoSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
   avatarLargeBg: { flex: 1, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
   avatarLargeTxt: { fontSize: 64, fontWeight: 'bold', color: TEAL },
   feedStatusTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 18 },
   feedStatusSub: { color: '#aaa', fontSize: 13, marginTop: 4 },
   pipContainer: { position: 'absolute', top: 80, right: 20, width: 90, height: 130, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', elevation: 5 },
   pipCard: { flex: 1, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
   pipInitial: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
   pipLabelBg: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   pipLabelTxt: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
   controlsPanel: { backgroundColor: 'rgba(18,18,18,0.97)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
   patientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
   patientHeaderLeft: {},
   patientName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
   patientIssue: { color: '#888', fontSize: 12, marginTop: 2 },
   rxPillBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
   rxPillTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   controlsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
   circleBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
   circleBtnActive: { backgroundColor: '#E24B4A' },
   circleBtnHangup: { backgroundColor: '#E24B4A', width: 58, height: 58, borderRadius: 29 },
});
