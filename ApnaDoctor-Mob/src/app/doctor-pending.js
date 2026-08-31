import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { __devApproveDoctor, getFullStatus } from '../utils/doctorAuth';

const TEAL = '#1A7E8A';
const RED = '#E24B4A';
const AMBER = '#F5A623';

export default function DoctorPendingScreen() {
   const router = useRouter();
   const [checking, setChecking] = useState(false);
   const [loading, setLoading] = useState(true);
   const [status, setStatus] = useState(null); // { approvalStatus, rejectionReason, suspensionReason }

   const fetchStatus = useCallback(async () => {
      try {
         const data = await getFullStatus();
         setStatus(data);
         if (data.approvalStatus === 'approved') {
            router.replace('/doctor/dashboard');
         }
      } catch {
         // stay on screen, show generic state below
      }
   }, [router]);

   useEffect(() => {
      (async () => {
         setLoading(true);
         await fetchStatus();
         setLoading(false);
      })();
   }, [fetchStatus]);

   const handleRefresh = async () => {
      setChecking(true);
      await fetchStatus();
      setChecking(false);
      if (status?.approvalStatus === 'pending') {
         Alert.alert('Still Pending', 'Your request is still under review. Please check back later.');
      }
   };

   const handleContactSupport = () => {
      Alert.alert('Contact Admin Support', 'Email: admin@apnadoctor.in\nPhone: 1800-890-2345');
   };

   const handleDevApprove = async () => {
      await __devApproveDoctor();
      Alert.alert('Dev Mode', 'Marked as approved locally. Tap Refresh to continue.');
   };

   if (loading) {
      return (
         <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
               <ActivityIndicator size="large" color={TEAL} />
            </View>
         </SafeAreaView>
      );
   }

   const isRejected = status?.approvalStatus === 'rejected';
   const isSuspended = status?.approvalStatus === 'suspended';

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#f8fbfc" />
         <View style={styles.container}>

            {isRejected ? (
               <>
                  <View style={[styles.iconWrap, { backgroundColor: '#FCEBEB' }]}>
                     <Ionicons name="close-circle" size={48} color={RED} />
                  </View>
                  <Text style={styles.title}>Verification Rejected</Text>
                  <Text style={styles.subtitle}>
                     Your profile could not be verified. Please review the reason below, fix the
                     issue, and resubmit your details.
                  </Text>
                  {status?.rejectionReason ? (
                     <View style={[styles.reasonCard, { borderColor: '#F6C9C8', backgroundColor: '#FDF4F4' }]}>
                        <Text style={styles.reasonLabel}>Reason</Text>
                        <Text style={styles.reasonText}>{status.rejectionReason}</Text>
                     </View>
                  ) : null}

                  <TouchableOpacity
                     style={styles.refreshBtn}
                     onPress={() => router.replace('/doctor-signup')}
                     activeOpacity={0.85}
                  >
                     <Ionicons name="create-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                     <Text style={styles.refreshBtnTxt}>Resubmit Details</Text>
                  </TouchableOpacity>
               </>
            ) : isSuspended ? (
               <>
                  <View style={[styles.iconWrap, { backgroundColor: '#FEF3E2' }]}>
                     <Ionicons name="alert-circle" size={48} color={AMBER} />
                  </View>
                  <Text style={styles.title}>Account Suspended</Text>
                  <Text style={styles.subtitle}>
                     Your account has been temporarily suspended. You won't be able to accept
                     consultations until this is resolved.
                  </Text>
                  {status?.suspensionReason ? (
                     <View style={[styles.reasonCard, { borderColor: '#FBE3B8', backgroundColor: '#FEFAF0' }]}>
                        <Text style={styles.reasonLabel}>Reason</Text>
                        <Text style={styles.reasonText}>{status.suspensionReason}</Text>
                     </View>
                  ) : null}
               </>
            ) : (
               <>
                  <View style={styles.iconWrap}>
                     <MaterialCommunityIcons name="clock-outline" size={48} color={TEAL} />
                  </View>
                  <Text style={styles.title}>Request Under Review</Text>
                  <Text style={styles.subtitle}>
                     Thanks for signing up! Your profile and documents have been sent to our admin
                     team for verification. This usually takes 24–48 hours.
                  </Text>

                  <View style={styles.stepsCard}>
                     <View style={styles.stepRow}>
                        <Ionicons name="checkmark-circle" size={18} color="#1D9E75" />
                        <Text style={styles.stepTxt}>Profile submitted</Text>
                     </View>
                     <View style={styles.stepRow}>
                        <Ionicons name="time" size={18} color={AMBER} />
                        <Text style={styles.stepTxt}>Admin verification in progress</Text>
                     </View>
                     <View style={styles.stepRow}>
                        <Ionicons name="ellipse-outline" size={18} color="#ccc" />
                        <Text style={[styles.stepTxt, { color: '#aaa' }]}>Account activated</Text>
                     </View>
                  </View>

                  <TouchableOpacity
                     style={styles.refreshBtn}
                     onPress={handleRefresh}
                     disabled={checking}
                     activeOpacity={0.85}
                  >
                     <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 8 }} />
                     <Text style={styles.refreshBtnTxt}>{checking ? 'Checking...' : 'Refresh Status'}</Text>
                  </TouchableOpacity>
               </>
            )}

            <TouchableOpacity style={styles.contactBtn} onPress={handleContactSupport}>
               <Text style={styles.contactBtnTxt}>Contact Admin Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/')}>
               <Text style={styles.logoutBtnTxt}>Log Out</Text>
            </TouchableOpacity>

            {/* Remove this block once real admin approval is wired up */}
            <TouchableOpacity style={styles.devBtn} onPress={handleDevApprove}>
               <Text style={styles.devBtnTxt}>[Dev] Simulate Admin Approval</Text>
            </TouchableOpacity>
         </View>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
   iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
   title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
   subtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 10, lineHeight: 20, paddingHorizontal: 10 },
   reasonCard: { width: '100%', borderRadius: 14, padding: 14, marginTop: 18, borderWidth: 1 },
   reasonLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
   reasonText: { fontSize: 13.5, color: '#333', lineHeight: 20 },
   stepsCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 24, borderWidth: 1, borderColor: '#f0f0f0', gap: 14 },
   stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
   stepTxt: { fontSize: 13.5, fontWeight: '600', color: '#333' },
   refreshBtn: { flexDirection: 'row', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', marginTop: 28, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   refreshBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
   contactBtn: { marginTop: 16, paddingVertical: 6 },
   contactBtnTxt: { color: TEAL, fontSize: 13, fontWeight: '600' },
   logoutBtn: { marginTop: 10, paddingVertical: 6 },
   logoutBtnTxt: { color: '#888', fontSize: 13, fontWeight: '600' },
   devBtn: { marginTop: 28, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed' },
   devBtnTxt: { color: '#aaa', fontSize: 11, fontWeight: '600' },
});
