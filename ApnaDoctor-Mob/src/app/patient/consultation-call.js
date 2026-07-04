import React, { useState, useEffect } from 'react';
import {
   View, Text, StyleSheet, TouchableOpacity,
   StatusBar, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function ConsultationCallScreen() {
   const router = useRouter();
   const insets = useSafeAreaInsets();
   const [isMuted, setIsMuted] = useState(false);
   const [isCamOff, setIsCamOff] = useState(false);
   const [callTime, setCallTime] = useState(0);

   // Simple active timer for call duration
   useEffect(() => {
      const interval = setInterval(() => {
         setCallTime(prev => prev + 1);
      }, 1000);
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
            { text: 'Cancel', style: 'cancel' },
            { 
               text: 'End Call', 
               style: 'destructive', 
               onPress: () => {
                  Alert.alert('Consultation Ended', 'Your prescription will be uploaded shortly. Thank you!', [
                     { text: 'OK', onPress: () => router.replace('/patient/dashboard') }
                  ]);
               } 
            }
         ]
      );
   };

   return (
      <View style={styles.safe}>
         <StatusBar barStyle="light-content" backgroundColor="#121212" />
         
         {/* Top Bar overlays on top of video */}
         <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <View style={styles.connectionStatus}>
               <View style={styles.greenDot} />
               <Text style={styles.statusTxt}>HD Quality · Live</Text>
            </View>
            <View style={styles.timerContainer}>
               <Text style={styles.timerTxt}>{formatTime(callTime)}</Text>
            </View>
         </View>

         {/* Call Background / Doctor Feed View */}
         <View style={styles.mainFeed}>
            {isCamOff ? (
               <View style={styles.avatarLargeBg}>
                  <Text style={styles.avatarLargeTxt}>RK</Text>
                  <Text style={styles.feedStatusTxt}>Dr. Rajesh Kumar</Text>
                  <Text style={styles.feedStatusSub}>Consulting Physician</Text>
               </View>
            ) : (
               <View style={styles.videoPlaceholder}>
                  <Ionicons name="person" size={100} color="rgba(255,255,255,0.15)" />
                  <Text style={styles.videoLabel}>Dr. Rajesh Kumar (Feed)</Text>
                  <Text style={styles.videoSub}>Active cardiology consult session</Text>
               </View>
            )}

            {/* Floating Patient Self Video PIP */}
            <View style={styles.pipContainer}>
               <View style={styles.pipCard}>
                  <Text style={styles.pipInitial}>RS</Text>
                  <View style={styles.pipLabelBg}>
                     <Text style={styles.pipLabelTxt}>You</Text>
                  </View>
               </View>
            </View>
         </View>

         {/* Bottom Controls Overlay Panel */}
         <View style={[styles.controlsPanel, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.docHeader}>
               <Text style={styles.docName}>Dr. Rajesh Kumar</Text>
               <Text style={styles.docSpec}>Cardiology Specialist</Text>
            </View>

            <View style={styles.controlsRow}>
               {/* Audio Mute toggle */}
               <TouchableOpacity 
                  style={[styles.circleBtn, isMuted && styles.circleBtnActive]} 
                  onPress={() => setIsMuted(!isMuted)}
               >
                  <Ionicons 
                     name={isMuted ? "mic-off" : "mic"} 
                     size={24} 
                     color={isMuted ? "#fff" : "#121212"} 
                  />
               </TouchableOpacity>

               {/* Video Camera toggle */}
               <TouchableOpacity 
                  style={[styles.circleBtn, isCamOff && styles.circleBtnActive]} 
                  onPress={() => setIsCamOff(!isCamOff)}
               >
                  <Ionicons 
                     name={isCamOff ? "videocam-off" : "videocam"} 
                     size={24} 
                     color={isCamOff ? "#fff" : "#121212"} 
                  />
               </TouchableOpacity>

               {/* Flip camera mock */}
               <TouchableOpacity 
                  style={styles.circleBtn} 
                  onPress={() => Alert.alert('Camera Switch', 'Switched to front camera.')}
               >
                  <Ionicons name="camera-reverse" size={24} color="#121212" />
               </TouchableOpacity>

               {/* Hangup Red button */}
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
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, zIndex: 10, position: 'absolute', top: 0, left: 0, right: 0 },
   connectionStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
   greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D9E75', marginRight: 6 },
   statusTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
   timerContainer: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
   timerTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
   mainFeed: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
   videoPlaceholder: { flex: 1, width: '100%', backgroundColor: '#1F1F1F', justifyContent: 'center', alignItems: 'center' },
   videoLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 'bold', marginTop: 16 },
   videoSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
   avatarLargeBg: { flex: 1, width: '100%', backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
   avatarLargeTxt: { fontSize: 64, fontWeight: 'bold', color: TEAL },
   feedStatusTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 18 },
   feedStatusSub: { color: '#aaa', fontSize: 13, marginTop: 4 },
   pipContainer: { position: 'absolute', top: 80, right: 20, width: 90, height: 130, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   pipCard: { flex: 1, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', position: 'relative' },
   pipInitial: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
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
