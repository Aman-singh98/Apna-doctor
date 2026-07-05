// Target path in the app: app/patient/prescription-detail.js
//
// Rewritten to fetch a real prescription instead of rendering the hardcoded
// mock object the old version had. Fields shown are limited to what
// models/Prescription.js actually stores — vitals, clinic address, doctor
// reg. no., and the M/A/E dose grid from the old mock don't exist on the
// real schema, so they've been dropped rather than faked. If you want any
// of those back, they need to be added to the schema + prescription-write.js
// first (so real prescriptions actually carry that data).
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
   ActivityIndicator,
   Alert,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyPrescriptionById } from '../../services/patientPrescriptionService';

const TEAL = '#1A7E8A';

function formatDate(isoDate) {
   if (!isoDate) return '—';
   const d = new Date(isoDate);
   if (Number.isNaN(d.getTime())) return '—';
   return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDoctorName(rx) {
   if (rx?.doctor && typeof rx.doctor === 'object' && rx.doctor.name) {
      return `Dr. ${rx.doctor.name}`;
   }
   return 'Doctor';
}

function getInitials(name) {
   if (!name) return 'Dr';
   return name
      .replace(/^Dr\.?\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
}

export default function PrescriptionDetailScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const [prescription, setPrescription] = useState(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);
   const [expandedMedId, setExpandedMedId] = useState(null);

   const load = useCallback(async () => {
      if (!params.id) {
         setError('No prescription was specified.');
         setLoading(false);
         return;
      }
      setLoading(true);
      setError(null);
      try {
         const data = await getMyPrescriptionById(params.id);
         setPrescription(data);
      } catch (err) {
         setError('Could not load this prescription. Please try again.');
      } finally {
         setLoading(false);
      }
   }, [params.id]);

   useFocusEffect(
      useCallback(() => {
         load();
      }, [load])
   );

   const toggleExpand = (id) => setExpandedMedId(prev => (prev === id ? null : id));

   if (loading) {
      return (
         <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <View style={styles.topBar}>
               <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
               </TouchableOpacity>
               <Text style={styles.barTitle}>Prescription</Text>
               <View style={{ width: 40 }} />
            </View>
            <View style={styles.centerView}>
               <ActivityIndicator size="large" color={TEAL} />
               <Text style={styles.centerTxt}>Loading prescription...</Text>
            </View>
         </SafeAreaView>
      );
   }

   if (error || !prescription) {
      return (
         <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <View style={styles.topBar}>
               <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
               </TouchableOpacity>
               <Text style={styles.barTitle}>Prescription</Text>
               <View style={{ width: 40 }} />
            </View>
            <View style={styles.centerView}>
               <MaterialCommunityIcons name="alert-circle-outline" size={60} color="#ccc" />
               <Text style={styles.centerTxt}>{error || 'Prescription not found.'}</Text>
               <TouchableOpacity style={styles.retryBtn} onPress={load}>
                  <Text style={styles.retryTxt}>Retry</Text>
               </TouchableOpacity>
            </View>
         </SafeAreaView>
      );
   }

   const doctorName = getDoctorName(prescription);

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Prescription</Text>
            <TouchableOpacity
               style={styles.downloadBtn}
               onPress={() => Alert.alert('Coming Soon', 'PDF export for prescriptions is not wired up yet.')}
            >
               <Ionicons name="download-outline" size={22} color={TEAL} />
            </TouchableOpacity>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Rx Header Banner */}
            <View style={styles.rxBanner}>
               <View style={styles.rxBannerLeft}>
                  <Text style={styles.rxSymbol}>℞</Text>
               </View>
               <View style={{ flex: 1 }}>
                  <Text style={styles.rxId}>Prescription ID: {prescription._id?.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.rxDate}>Date: {formatDate(prescription.date)}</Text>
               </View>
            </View>

            {/* Doctor & Patient split */}
            <View style={styles.infoRow}>
               <View style={[styles.infoCard, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.infoCardTitle}>Prescribed By</Text>
                  <View style={styles.docAvatar}>
                     <Text style={styles.docAvatarTxt}>{getInitials(doctorName)}</Text>
                  </View>
                  <Text style={styles.infoName}>{doctorName}</Text>
               </View>

               <View style={[styles.infoCard, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.infoCardTitle}>Patient</Text>
                  <View style={[styles.docAvatar, { backgroundColor: '#E8F5F7' }]}>
                     <Text style={[styles.docAvatarTxt, { color: TEAL }]}>{getInitials(prescription.patientName) || '?'}</Text>
                  </View>
                  <Text style={styles.infoName}>{prescription.patientName}</Text>
                  {!!prescription.patientPhone && <Text style={styles.infoSub}>{prescription.patientPhone}</Text>}
               </View>
            </View>

            {/* Diagnosis */}
            <View style={styles.section}>
               <Text style={styles.sectionTitle}>Diagnosis</Text>
               <View style={styles.diagCard}>
                  <Text style={styles.diagTxt}>{prescription.diagnosis}</Text>
               </View>
            </View>

            {/* Medicines */}
            <View style={styles.section}>
               <Text style={styles.sectionTitle}>
                  Medicines Prescribed ({(prescription.medicines || []).length})
               </Text>
               {(prescription.medicines || []).map((med) => {
                  const medId = med.id || med.name;
                  const isOpen = expandedMedId === medId;
                  const hasDetails = !!(med.frequency || med.instructions);
                  return (
                     <View key={medId} style={styles.medCard}>
                        <TouchableOpacity
                           style={styles.medHeader}
                           onPress={() => hasDetails && toggleExpand(medId)}
                           activeOpacity={hasDetails ? 0.8 : 1}
                        >
                           <View style={styles.medIconBg}>
                              <MaterialCommunityIcons name="pill" size={22} color={TEAL} />
                           </View>
                           <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.medName}>{med.name}</Text>
                              {!!med.dosage && <Text style={styles.medStrength}>{med.dosage}</Text>}
                           </View>
                           {!!med.duration && (
                              <View style={styles.medDuration}>
                                 <Text style={styles.medDurationTxt}>{med.duration}</Text>
                              </View>
                           )}
                           {hasDetails && (
                              <Ionicons
                                 name={isOpen ? 'chevron-up' : 'chevron-down'}
                                 size={18}
                                 color="#aaa"
                                 style={{ marginLeft: 8 }}
                              />
                           )}
                        </TouchableOpacity>

                        {isOpen && hasDetails && (
                           <View style={styles.medBody}>
                              {!!med.frequency && (
                                 <View style={styles.medDetailRow}>
                                    <Ionicons name="time-outline" size={15} color="#888" style={{ marginRight: 6 }} />
                                    <Text style={styles.medDetailTxt}>{med.frequency}</Text>
                                 </View>
                              )}
                              {!!med.instructions && (
                                 <View style={styles.medDetailRow}>
                                    <Ionicons name="information-circle-outline" size={15} color="#888" style={{ marginRight: 6 }} />
                                    <Text style={styles.medDetailTxt}>{med.instructions}</Text>
                                 </View>
                              )}
                           </View>
                        )}
                     </View>
                  );
               })}
            </View>

            {/* Notes */}
            {!!prescription.notes && (
               <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Doctor's Notes</Text>
                  <View style={styles.instructCard}>
                     <Text style={styles.instrTxt}>{prescription.notes}</Text>
                  </View>
               </View>
            )}

            {/* Follow-Up */}
            {!!prescription.followUp && (
               <View style={styles.followUpCard}>
                  <Ionicons name="calendar" size={20} color={TEAL} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                     <Text style={styles.followUpLabel}>Next Follow-Up</Text>
                     <Text style={styles.followUpDate}>{prescription.followUp}</Text>
                  </View>
                  <TouchableOpacity
                     style={styles.bookFollowBtn}
                     onPress={() => router.push('/patient/book-appointment')}
                  >
                     <Text style={styles.bookFollowBtnTxt}>Book Slot</Text>
                  </TouchableOpacity>
               </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionBtns}>
               <TouchableOpacity
                  style={[styles.bigBtn, styles.bigBtnOutline]}
                  onPress={() => Alert.alert('Coming Soon', 'Sharing prescriptions is not wired up yet.')}
               >
                  <Ionicons name="share-social-outline" size={18} color={TEAL} style={{ marginRight: 8 }} />
                  <Text style={styles.bigBtnOutlineTxt}>Share</Text>
               </TouchableOpacity>
               <TouchableOpacity
                  style={[styles.bigBtn, styles.bigBtnFill]}
                  onPress={() => Alert.alert('Coming Soon', 'PDF export for prescriptions is not wired up yet.')}
               >
                  <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.bigBtnFillTxt}>Download PDF</Text>
               </TouchableOpacity>
            </View>

         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   downloadBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   scroll: { padding: 16, paddingBottom: 40 },
   centerView: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
   centerTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center' },
   retryBtn: { marginTop: 16, borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
   retryTxt: { color: TEAL, fontWeight: '700', fontSize: 13 },

   rxBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A7E8A', borderRadius: 16, padding: 16, marginBottom: 14 },
   rxBannerLeft: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
   rxSymbol: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
   rxId: { fontSize: 13, color: '#CBEBE3', fontWeight: '600' },
   rxDate: { fontSize: 12, color: '#9FE1CB', marginTop: 2 },

   infoRow: { flexDirection: 'row', marginBottom: 14 },
   infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', alignItems: 'center', elevation: 1 },
   infoCardTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
   docAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
   docAvatarTxt: { fontSize: 14, fontWeight: 'bold', color: '#085041' },
   infoName: { fontSize: 13, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' },
   infoSub: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },

   section: { marginBottom: 16 },
   sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },

   diagCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   diagTxt: { fontSize: 14, color: '#333', fontWeight: '500', lineHeight: 20 },

   medCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 10, overflow: 'hidden', elevation: 1 },
   medHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
   medIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   medName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
   medStrength: { fontSize: 12, color: '#666', marginTop: 2 },
   medDuration: { backgroundColor: '#E8F5F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
   medDurationTxt: { fontSize: 11, color: TEAL, fontWeight: '700' },
   medBody: { backgroundColor: '#fafafa', borderTopWidth: 1, borderTopColor: '#f0f0f0', padding: 14, gap: 8 },
   medDetailRow: { flexDirection: 'row', alignItems: 'flex-start' },
   medDetailTxt: { fontSize: 12, color: '#666', flex: 1, lineHeight: 18 },

   instructCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   instrTxt: { fontSize: 13, color: '#444', lineHeight: 20 },

   followUpCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#CBEBE3' },
   followUpLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
   followUpDate: { fontSize: 14, color: '#085041', fontWeight: 'bold', marginTop: 2 },
   bookFollowBtn: { marginLeft: 12, borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
   bookFollowBtnTxt: { color: TEAL, fontSize: 12, fontWeight: 'bold' },

   actionBtns: { flexDirection: 'row', gap: 10, marginBottom: 10 },
   bigBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
   bigBtnOutline: { borderWidth: 1.5, borderColor: TEAL, backgroundColor: '#fff' },
   bigBtnOutlineTxt: { fontSize: 14, color: TEAL, fontWeight: 'bold' },
   bigBtnFill: { backgroundColor: TEAL, elevation: 2 },
   bigBtnFillTxt: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
});
