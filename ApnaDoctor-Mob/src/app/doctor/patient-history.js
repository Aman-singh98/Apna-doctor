import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   RefreshControl,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPatientHistory } from '../../services/appointmentService';

const TEAL = '#1A7E8A';

const formatDate = (isoDate) =>
   new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Small pill used for conditions / allergies / medications chips.
const Chip = ({ label, tone = 'default' }) => (
   <View style={[styles.chip, tone === 'danger' && styles.chipDanger]}>
      <Text style={[styles.chipTxt, tone === 'danger' && styles.chipTxtDanger]}>{label}</Text>
   </View>
);

export default function PatientHistoryScreen() {
   const router = useRouter();
   const { appointmentId, patientName } = useLocalSearchParams();

   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState('');
   const [data, setData] = useState(null); // { medicalHistory, prescriptions }
   const [expandedId, setExpandedId] = useState(null);

   const load = useCallback(async ({ silent } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
         const res = await getPatientHistory(appointmentId);
         setData(res);
      } catch (err) {
         setError(err.response?.data?.message || 'Could not load patient history.');
      } finally {
         setLoading(false);
         setRefreshing(false);
      }
   }, [appointmentId]);

   useEffect(() => { load(); }, [load]);

   const onRefresh = () => {
      setRefreshing(true);
      load({ silent: true });
   };

   const history = data?.medicalHistory;
   const hasHistory = history && (
      history.conditions?.length || history.allergies?.length || history.medications?.length
   );
   const prescriptions = data?.prescriptions || [];

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         {/* Header */}
         <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <View>
               <Text style={styles.title}>Patient History</Text>
               {!!patientName && <Text style={styles.subtitle}>{patientName}</Text>}
            </View>
         </View>

         {loading ? (
            <View style={styles.emptyView}>
               <ActivityIndicator size="large" color={TEAL} />
               <Text style={styles.emptyTxt}>Loading history…</Text>
            </View>
         ) : error ? (
            <View style={styles.emptyView}>
               <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
               <Text style={styles.emptyTxt}>{error}</Text>
               <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
                  <Text style={styles.retryBtnTxt}>Retry</Text>
               </TouchableOpacity>
            </View>
         ) : (
            <ScrollView
               contentContainerStyle={styles.scroll}
               showsVerticalScrollIndicator={false}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[TEAL]} tintColor={TEAL} />}
            >
               {/* Medical History */}
               <Text style={styles.sectionLabel}>MEDICAL HISTORY</Text>
               <View style={styles.card}>
                  {!hasHistory ? (
                     <Text style={styles.emptyCardTxt}>No medical history recorded for this patient yet.</Text>
                  ) : (
                     <>
                        <View style={styles.historyBlock}>
                           <Text style={styles.historyBlockLabel}>Conditions</Text>
                           <View style={styles.chipRow}>
                              {history.conditions?.length
                                 ? history.conditions.map((c, i) => <Chip key={i} label={c} />)
                                 : <Text style={styles.noneTxt}>None recorded</Text>}
                           </View>
                        </View>
                        <View style={styles.historyBlock}>
                           <Text style={styles.historyBlockLabel}>Allergies</Text>
                           <View style={styles.chipRow}>
                              {history.allergies?.length
                                 ? history.allergies.map((a, i) => <Chip key={i} label={a} tone="danger" />)
                                 : <Text style={styles.noneTxt}>None recorded</Text>}
                           </View>
                        </View>
                        <View style={[styles.historyBlock, { marginBottom: 0 }]}>
                           <Text style={styles.historyBlockLabel}>Current Medications</Text>
                           <View style={styles.chipRow}>
                              {history.medications?.length
                                 ? history.medications.map((m, i) => <Chip key={i} label={m} />)
                                 : <Text style={styles.noneTxt}>None recorded</Text>}
                           </View>
                        </View>
                     </>
                  )}
               </View>

               {/* Prescription history */}
               <Text style={styles.sectionLabel}>PRESCRIPTION HISTORY ({prescriptions.length})</Text>
               {prescriptions.length === 0 ? (
                  <View style={styles.card}>
                     <Text style={styles.emptyCardTxt}>No past prescriptions for this patient.</Text>
                  </View>
               ) : (
                  prescriptions.map((p) => {
                     const isOpen = expandedId === p._id;
                     return (
                        <TouchableOpacity
                           key={p._id}
                           style={styles.rxCard}
                           activeOpacity={0.85}
                           onPress={() => setExpandedId(isOpen ? null : p._id)}
                        >
                           <View style={styles.rxTopRow}>
                              <View style={{ flex: 1 }}>
                                 <Text style={styles.rxDiagnosis}>{p.diagnosis}</Text>
                                 <Text style={styles.rxDate}>{formatDate(p.date)}</Text>
                              </View>
                              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#999" />
                           </View>

                           {isOpen && (
                              <View style={styles.rxDetail}>
                                 {p.medicines.map((m, i) => (
                                    <View key={m.id || i} style={styles.medRow}>
                                       <Ionicons name="medical-outline" size={14} color={TEAL} style={{ marginRight: 6, marginTop: 2 }} />
                                       <View style={{ flex: 1 }}>
                                          <Text style={styles.medName}>{m.name}</Text>
                                          <Text style={styles.medMeta}>
                                             {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ') || 'No dosage details'}
                                          </Text>
                                          {!!m.instructions && <Text style={styles.medInstructions}>{m.instructions}</Text>}
                                       </View>
                                    </View>
                                 ))}
                                 {!!p.notes && (
                                    <View style={styles.notesBlock}>
                                       <Text style={styles.notesLabel}>Notes</Text>
                                       <Text style={styles.notesTxt}>{p.notes}</Text>
                                    </View>
                                 )}
                                 {!!p.followUp && (
                                    <Text style={styles.followUpTxt}>Follow-up: {p.followUp}</Text>
                                 )}
                              </View>
                           )}
                        </TouchableOpacity>
                     );
                  })
               )}
            </ScrollView>
         )}
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingBottom: 12 },
   backBtn: { padding: 4, marginRight: 4 },
   title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
   subtitle: { fontSize: 13, color: '#888', marginTop: 1 },
   scroll: { paddingHorizontal: 16, paddingBottom: 32 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
   retryBtn: { marginTop: 16, backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
   retryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   sectionLabel: { fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f0f0f0' },
   emptyCardTxt: { fontSize: 13, color: '#999' },
   historyBlock: { marginBottom: 14 },
   historyBlockLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
   chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   chip: { backgroundColor: '#E8F5F7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
   chipTxt: { fontSize: 12, fontWeight: '600', color: TEAL },
   chipDanger: { backgroundColor: '#FDECEC' },
   chipTxtDanger: { color: '#C0392B' },
   noneTxt: { fontSize: 12, color: '#bbb', fontStyle: 'italic' },
   rxCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
   rxTopRow: { flexDirection: 'row', alignItems: 'center' },
   rxDiagnosis: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   rxDate: { fontSize: 12, color: '#888', marginTop: 2 },
   rxDetail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
   medRow: { flexDirection: 'row', marginBottom: 10 },
   medName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   medMeta: { fontSize: 12, color: '#888', marginTop: 1 },
   medInstructions: { fontSize: 12, color: '#555', marginTop: 2, fontStyle: 'italic' },
   notesBlock: { marginTop: 4, marginBottom: 8 },
   notesLabel: { fontSize: 11, fontWeight: '700', color: '#999' },
   notesTxt: { fontSize: 12, color: '#555', marginTop: 2 },
   followUpTxt: { fontSize: 12, color: TEAL, fontWeight: '600', marginTop: 2 },
});
