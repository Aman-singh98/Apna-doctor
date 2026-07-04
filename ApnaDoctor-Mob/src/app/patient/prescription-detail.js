import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
   Alert,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

const prescription = {
   id: 'RX-20260615-001',
   date: '15 June 2026',
   validTill: '15 July 2026',
   doctor: {
      name: 'Dr. Rajesh Kumar',
      spec: 'Cardiologist',
      regNo: 'MCI-2009-04521',
      clinic: 'HeartCare Clinic, Connaught Place, New Delhi',
      phone: '+91 98100 12345',
   },
   patient: {
      name: 'Rahul Sharma',
      age: '28 Yrs',
      gender: 'Male',
      weight: '72 kg',
      bloodGroup: 'B+',
   },
   diagnosis: ['Essential Hypertension (I10)', 'Ischemic Heart Disease (I25.9)'],
   vitals: {
      bp: '138 / 86 mmHg',
      pulse: '82 bpm',
      temp: '98.6 °F',
   },
   medicines: [
      {
         id: '1',
         name: 'Metoprolol Succinate',
         strength: '25 mg',
         form: 'Tablet',
         dose: '1-0-1',
         duration: '30 Days',
         notes: 'Take after meals. Do not crush.',
      },
      {
         id: '2',
         name: 'Aspirin',
         strength: '75 mg',
         form: 'Tablet',
         dose: '0-1-0',
         duration: '30 Days',
         notes: 'Take with plenty of water.',
      },
      {
         id: '3',
         name: 'Atorvastatin',
         strength: '10 mg',
         form: 'Tablet',
         dose: '0-0-1',
         duration: '30 Days',
         notes: 'Take at bedtime.',
      },
   ],
   instructions: [
      'Avoid smoking and alcohol completely.',
      'Low-salt, low-fat diet recommended.',
      'Walk 30 minutes daily.',
      'Monitor blood pressure twice daily.',
      'Return for follow-up in 4 weeks.',
   ],
   followUp: '15 July 2026',
};

const DOSE_LABELS = { morning: 'M', afternoon: 'A', evening: 'E' };

function parseDose(dose) {
   const parts = dose.split('-');
   return [
      { label: 'Morning', val: parts[0] === '1' ? '1 Tab' : 'Skip' },
      { label: 'Afternoon', val: parts[1] === '1' ? '1 Tab' : 'Skip' },
      { label: 'Evening', val: parts[2] === '1' ? '1 Tab' : 'Skip' },
   ];
}

export default function PrescriptionDetailScreen() {
   const router = useRouter();
   const [expanded, setExpanded] = useState(null);

   const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id);

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={'#fff'} />
         {/* Top bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Prescription</Text>
            <TouchableOpacity
               style={styles.downloadBtn}
               onPress={() => Alert.alert('Download', 'Prescription PDF saved to your device.')}
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
                  <Text style={styles.rxId}>Prescription ID: {prescription.id}</Text>
                  <Text style={styles.rxDate}>Date: {prescription.date}</Text>
                  <View style={styles.validBadge}>
                     <Ionicons name="checkmark-circle" size={13} color="#1D9E75" style={{ marginRight: 4 }} />
                     <Text style={styles.validTxt}>Valid till {prescription.validTill}</Text>
                  </View>
               </View>
            </View>

            {/* Doctor & Patient split */}
            <View style={styles.infoRow}>
               {/* Doctor Card */}
               <View style={[styles.infoCard, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.infoCardTitle}>Prescribed By</Text>
                  <View style={styles.docAvatar}>
                     <Text style={styles.docAvatarTxt}>RK</Text>
                  </View>
                  <Text style={styles.infoName}>{prescription.doctor.name}</Text>
                  <Text style={styles.infoSub}>{prescription.doctor.spec}</Text>
                  <Text style={styles.infoDetail}>Reg: {prescription.doctor.regNo}</Text>
               </View>

               {/* Patient Card */}
               <View style={[styles.infoCard, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.infoCardTitle}>Patient</Text>
                  <View style={[styles.docAvatar, { backgroundColor: '#E8F5F7' }]}>
                     <Text style={[styles.docAvatarTxt, { color: TEAL }]}>RS</Text>
                  </View>
                  <Text style={styles.infoName}>{prescription.patient.name}</Text>
                  <Text style={styles.infoSub}>{prescription.patient.age} · {prescription.patient.gender}</Text>
                  <Text style={styles.infoDetail}>Blood Group: {prescription.patient.bloodGroup}</Text>
               </View>
            </View>

            {/* Vitals at Consult */}
            <View style={styles.section}>
               <Text style={styles.sectionTitle}>Vitals at Consultation</Text>
               <View style={styles.vitalsRow}>
                  {[
                     { icon: 'heart-pulse', label: 'Blood Pressure', val: prescription.vitals.bp },
                     { icon: 'pulse', label: 'Pulse', val: prescription.vitals.pulse },
                     { icon: 'thermometer', label: 'Temperature', val: prescription.vitals.temp },
                  ].map(v => (
                     <View key={v.label} style={styles.vitalCard}>
                        <MaterialCommunityIcons name={v.icon} size={22} color={TEAL} />
                        <Text style={styles.vitalVal}>{v.val}</Text>
                        <Text style={styles.vitalLabel}>{v.label}</Text>
                     </View>
                  ))}
               </View>
            </View>

            {/* Diagnosis */}
            <View style={styles.section}>
               <Text style={styles.sectionTitle}>Diagnosis</Text>
               {prescription.diagnosis.map((d, i) => (
                  <View key={i} style={styles.diagRow}>
                     <View style={styles.diagDot} />
                     <Text style={styles.diagTxt}>{d}</Text>
                  </View>
               ))}
            </View>

            {/* Medicines */}
            <View style={styles.section}>
               <Text style={styles.sectionTitle}>Medicines Prescribed</Text>
               {prescription.medicines.map((med) => {
                  const isOpen = expanded === med.id;
                  const doseSlots = parseDose(med.dose);
                  return (
                     <View key={med.id} style={styles.medCard}>
                        <TouchableOpacity
                           style={styles.medHeader}
                           onPress={() => toggleExpand(med.id)}
                           activeOpacity={0.8}
                        >
                           <View style={styles.medIconBg}>
                              <MaterialCommunityIcons name="pill" size={22} color={TEAL} />
                           </View>
                           <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.medName}>{med.name}</Text>
                              <Text style={styles.medStrength}>{med.strength} · {med.form}</Text>
                           </View>
                           <View style={styles.medDuration}>
                              <Text style={styles.medDurationTxt}>{med.duration}</Text>
                           </View>
                           <Ionicons
                              name={isOpen ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#aaa"
                              style={{ marginLeft: 8 }}
                           />
                        </TouchableOpacity>

                        {isOpen && (
                           <View style={styles.medBody}>
                              <View style={styles.doseRow}>
                                 {doseSlots.map(ds => (
                                    <View
                                       key={ds.label}
                                       style={[
                                          styles.doseSlot,
                                          ds.val !== 'Skip' && styles.doseSlotActive,
                                       ]}
                                    >
                                       <Text style={[styles.doseSlotLabel, ds.val !== 'Skip' && styles.doseSlotLabelActive]}>
                                          {ds.label}
                                       </Text>
                                       <Text style={[styles.doseSlotVal, ds.val !== 'Skip' && styles.doseSlotValActive]}>
                                          {ds.val}
                                       </Text>
                                    </View>
                                 ))}
                              </View>
                              <View style={styles.medNoteRow}>
                                 <Ionicons name="information-circle-outline" size={15} color="#888" style={{ marginRight: 6 }} />
                                 <Text style={styles.medNote}>{med.notes}</Text>
                              </View>
                           </View>
                        )}
                     </View>
                  );
               })}
            </View>

            {/* Special Instructions */}
            <View style={styles.section}>
               <Text style={styles.sectionTitle}>Special Instructions</Text>
               <View style={styles.instructCard}>
                  {prescription.instructions.map((ins, i) => (
                     <View key={i} style={styles.instrRow}>
                        <Ionicons name="checkmark-circle" size={16} color={TEAL} style={{ marginRight: 8, marginTop: 2 }} />
                        <Text style={styles.instrTxt}>{ins}</Text>
                     </View>
                  ))}
               </View>
            </View>

            {/* Follow-Up */}
            <View style={styles.followUpCard}>
               <Ionicons name="calendar" size={20} color={TEAL} style={{ marginRight: 12 }} />
               <View>
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

            {/* Doctor Clinic Info */}
            <View style={styles.clinicCard}>
               <Text style={styles.infoCardTitle}>Doctor's Clinic</Text>
               <Text style={styles.clinicTxt}>{prescription.doctor.clinic}</Text>
               <TouchableOpacity
                  style={styles.callDocBtn}
                  onPress={() => Alert.alert('Calling', `Contacting ${prescription.doctor.name}...`)}
               >
                  <Ionicons name="call" size={16} color={TEAL} style={{ marginRight: 6 }} />
                  <Text style={styles.callDocTxt}>{prescription.doctor.phone}</Text>
               </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionBtns}>
               <TouchableOpacity
                  style={[styles.bigBtn, styles.bigBtnOutline]}
                  onPress={() => Alert.alert('Share', 'Prescription shared via WhatsApp/Email.')}
               >
                  <Ionicons name="share-social-outline" size={18} color={TEAL} style={{ marginRight: 8 }} />
                  <Text style={styles.bigBtnOutlineTxt}>Share</Text>
               </TouchableOpacity>
               <TouchableOpacity
                  style={[styles.bigBtn, styles.bigBtnFill]}
                  onPress={() => Alert.alert('Downloaded', 'Prescription PDF saved to your device.')}
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

   rxBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A7E8A', borderRadius: 16, padding: 16, marginBottom: 14 },
   rxBannerLeft: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
   rxSymbol: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
   rxId: { fontSize: 13, color: '#CBEBE3', fontWeight: '600' },
   rxDate: { fontSize: 12, color: '#9FE1CB', marginTop: 2 },
   validBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8 },
   validTxt: { fontSize: 11, color: '#E1F5EE', fontWeight: '600' },

   infoRow: { flexDirection: 'row', marginBottom: 14 },
   infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', alignItems: 'center', elevation: 1 },
   infoCardTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
   docAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
   docAvatarTxt: { fontSize: 14, fontWeight: 'bold', color: '#085041' },
   infoName: { fontSize: 13, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' },
   infoSub: { fontSize: 11, color: TEAL, marginTop: 2, textAlign: 'center' },
   infoDetail: { fontSize: 10, color: '#999', marginTop: 4, textAlign: 'center' },

   section: { marginBottom: 16 },
   sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },

   vitalsRow: { flexDirection: 'row', gap: 8 },
   vitalCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   vitalVal: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginTop: 6, textAlign: 'center' },
   vitalLabel: { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },

   diagRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
   diagDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL, marginTop: 5, marginRight: 10 },
   diagTxt: { fontSize: 13, color: '#333', fontWeight: '500', flex: 1, lineHeight: 20 },

   medCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 10, overflow: 'hidden', elevation: 1 },
   medHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
   medIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   medName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
   medStrength: { fontSize: 12, color: '#666', marginTop: 2 },
   medDuration: { backgroundColor: '#E8F5F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
   medDurationTxt: { fontSize: 11, color: TEAL, fontWeight: '700' },
   medBody: { backgroundColor: '#fafafa', borderTopWidth: 1, borderTopColor: '#f0f0f0', padding: 14 },
   doseRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
   doseSlot: { flex: 1, borderWidth: 1.5, borderColor: '#eee', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
   doseSlotActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   doseSlotLabel: { fontSize: 11, color: '#aaa', fontWeight: '600' },
   doseSlotLabelActive: { color: TEAL },
   doseSlotVal: { fontSize: 12, color: '#ccc', fontWeight: '700', marginTop: 3 },
   doseSlotValActive: { color: TEAL },
   medNoteRow: { flexDirection: 'row', alignItems: 'flex-start' },
   medNote: { fontSize: 12, color: '#666', flex: 1, lineHeight: 18 },

   instructCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   instrRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
   instrTxt: { fontSize: 13, color: '#444', flex: 1, lineHeight: 20 },

   followUpCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#CBEBE3' },
   followUpLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
   followUpDate: { fontSize: 14, color: '#085041', fontWeight: 'bold', marginTop: 2 },
   bookFollowBtn: { marginLeft: 'auto', borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
   bookFollowBtnTxt: { color: TEAL, fontSize: 12, fontWeight: 'bold' },

   clinicCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 20, elevation: 1 },
   clinicTxt: { fontSize: 13, color: '#555', lineHeight: 20, marginTop: 4, marginBottom: 10 },
   callDocBtn: { flexDirection: 'row', alignItems: 'center' },
   callDocTxt: { fontSize: 13, color: TEAL, fontWeight: '600' },

   actionBtns: { flexDirection: 'row', gap: 10, marginBottom: 10 },
   bigBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
   bigBtnOutline: { borderWidth: 1.5, borderColor: TEAL, backgroundColor: '#fff' },
   bigBtnOutlineTxt: { fontSize: 14, color: TEAL, fontWeight: 'bold' },
   bigBtnFill: { backgroundColor: TEAL, elevation: 2 },
   bigBtnFillTxt: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
});
