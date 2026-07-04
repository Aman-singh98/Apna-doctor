import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Modal,
   RefreshControl,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DoctorBottomNav from '../../components/DoctorBottomNav';
import { getAppointments, completeAppointment } from '../../services/appointmentService';

const TEAL = '#1A7E8A';
const GREEN = '#1D9E75';

// Backend stores a single `date` (Date) field — compute the "Today"/"Tomorrow"/
// weekday label and the time string on the frontend rather than relying on
// separate fields that don't exist on the schema.
const formatDateLabel = (isoDate) => {
   const d = new Date(isoDate);
   const today = new Date();
   const tomorrow = new Date();
   tomorrow.setDate(today.getDate() + 1);

   const isSameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

   if (isSameDay(d, today)) return 'Today';
   if (isSameDay(d, tomorrow)) return 'Tomorrow';
   return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatTime = (isoDate) =>
   new Date(isoDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

// Maps a raw Appointment doc (from the API) to the shape this screen renders.
// `age` doesn't exist on the schema (dob is a free-text string on Patient,
// not populated here) — show phone instead. `issue` doesn't exist either —
// the schema calls it `diagnosis`, and it's typically filled in only after
// the consult via the prescription screen, so it may be empty for upcoming ones.
const mapAppointment = (a) => ({
   id: a._id,
   name: a.patientName,
   phone: a.patientPhone || '',
   type: a.type,
   status: a.status,
   issue: a.diagnosis?.trim() ? a.diagnosis : 'Not specified yet',
   dateLabel: formatDateLabel(a.date),
   timeLabel: formatTime(a.date),
   rawDate: a.date,
});

export default function DoctorAppointmentsScreen() {
   const router = useRouter();
   const [activeFilter, setActiveFilter] = useState('upcoming');
   const [appointments, setAppointments] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState('');
   const [selectedAppt, setSelectedAppt] = useState(null);
   const [detailModal, setDetailModal] = useState(false);

   const loadAppointments = useCallback(async (status, { silent } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
         const data = await getAppointments({ status });
         setAppointments(Array.isArray(data) ? data.map(mapAppointment) : []);
      } catch (err) {
         setError(err.response?.data?.message || 'Could not load appointments.');
      } finally {
         setLoading(false);
         setRefreshing(false);
      }
   }, []);

   useEffect(() => {
      loadAppointments(activeFilter);
   }, [activeFilter, loadAppointments]);

   const onRefresh = () => {
      setRefreshing(true);
      loadAppointments(activeFilter, { silent: true });
   };

   const filtered = appointments;

   const markComplete = async (id) => {
      try {
         await completeAppointment(id);
         setAppointments(prev => prev.filter(a => a.id !== id));
         setDetailModal(false);
         Alert.alert('Consultation Ended', 'The appointment has been marked as completed.');
      } catch (err) {
         Alert.alert('Error', err.response?.data?.message || 'Could not mark appointment as completed.');
      }
   };

   const startConsult = (appt) => {
      setDetailModal(false);
      const params = { patientName: appt.name, diagnosis: appt.issue };
      if (appt.type === 'Video' || appt.type === 'Audio') {
         router.push({ pathname: '/doctor/consultation-call', params });
      } else {
         router.push({ pathname: '/doctor/consultation-chat', params });
      }
   };

   const typeIcon = (type) => {
      if (type === 'Video') return 'videocam';
      if (type === 'Audio') return 'call';
      return 'chatbubbles';
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
               <Text style={styles.title}>Appointments</Text>
               <TouchableOpacity
                  style={styles.scheduleBtn}
                  onPress={() => router.push('/doctor/schedule')}
               >
                  <Ionicons name="calendar-outline" size={18} color="#fff" />
                  <Text style={styles.scheduleBtnTxt}>Schedule</Text>
               </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
               <TouchableOpacity
                  style={[styles.tab, activeFilter === 'upcoming' && styles.tabActive]}
                  onPress={() => setActiveFilter('upcoming')}
               >
                  <Text style={[styles.tabTxt, activeFilter === 'upcoming' && styles.tabTxtActive]}>Upcoming</Text>
               </TouchableOpacity>
               <TouchableOpacity
                  style={[styles.tab, activeFilter === 'completed' && styles.tabActive]}
                  onPress={() => setActiveFilter('completed')}
               >
                  <Text style={[styles.tabTxt, activeFilter === 'completed' && styles.tabTxtActive]}>Completed</Text>
               </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? (
               <View style={styles.emptyView}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.emptyTxt}>Loading appointments…</Text>
               </View>
            ) : error ? (
               <View style={styles.emptyView}>
                  <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => loadAppointments(activeFilter)}>
                     <Text style={styles.retryBtnTxt}>Retry</Text>
                  </TouchableOpacity>
               </View>
            ) : (
            <ScrollView
               contentContainerStyle={styles.scroll}
               showsVerticalScrollIndicator={false}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[TEAL]} tintColor={TEAL} />}
            >
               {filtered.length === 0 ? (
                  <View style={styles.emptyView}>
                     <Ionicons name="calendar-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>No appointments here</Text>
                  </View>
               ) : filtered.map(a => (
                  <TouchableOpacity
                     key={a.id}
                     style={styles.card}
                     onPress={() => { setSelectedAppt(a); setDetailModal(true); }}
                     activeOpacity={0.85}
                  >
                     <View style={styles.cardTop}>
                        <View style={styles.avatar}>
                           <Text style={styles.avatarTxt}>{a.name.split(' ').map(w => w[0]).join('')}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={styles.patientName}>{a.name}</Text>
                           {!!a.phone && <Text style={styles.ageGender}>{a.phone}</Text>}
                           <View style={styles.typeBadge}>
                              <Ionicons name={typeIcon(a.type)} size={11} color={TEAL} style={{ marginRight: 4 }} />
                              <Text style={styles.typeBadgeTxt}>{a.type} Consult</Text>
                           </View>
                        </View>
                        <View style={styles.timeBlock}>
                           <Text style={styles.timeDate}>{a.dateLabel}</Text>
                           <Text style={styles.timeVal}>{a.timeLabel}</Text>
                        </View>
                     </View>

                     <View style={styles.divider} />

                     <View style={styles.cardBottom}>
                        <Ionicons name="medical-outline" size={13} color="#888" style={{ marginRight: 6 }} />
                        <Text style={styles.issueTxt}>{a.issue}</Text>
                        {a.status === 'upcoming' && (
                           <TouchableOpacity
                              style={styles.startBtn}
                              onPress={() => startConsult(a)}
                           >
                              <Text style={styles.startBtnTxt}>Start</Text>
                           </TouchableOpacity>
                        )}
                        {a.status === 'completed' && (
                           <View style={styles.doneBadge}>
                              <Text style={styles.doneBadgeTxt}>Done</Text>
                           </View>
                        )}
                     </View>
                  </TouchableOpacity>
               ))}
            </ScrollView>
            )}
         </View>

         {/* Detail Modal */}
         <Modal
            visible={detailModal}
            transparent
            animationType="slide"
            onRequestClose={() => setDetailModal(false)}
         >
            <View style={styles.modalOverlay}>
               <SafeAreaView edges={['bottom']} style={styles.modalSheet}>
                  {selectedAppt && (
                     <>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Appointment Details</Text>

                        <View style={styles.modalPatientRow}>
                           <View style={styles.modalAvatar}>
                              <Text style={styles.modalAvatarTxt}>
                                 {selectedAppt.name.split(' ').map(w => w[0]).join('')}
                              </Text>
                           </View>
                           <View>
                              <Text style={styles.modalPatientName}>{selectedAppt.name}</Text>
                              {!!selectedAppt.phone && <Text style={styles.modalPatientAge}>{selectedAppt.phone}</Text>}
                           </View>
                        </View>

                        {[
                           { label: 'Consultation Type', value: selectedAppt.type },
                           { label: 'Date & Time', value: `${selectedAppt.dateLabel}, ${selectedAppt.timeLabel}` },
                           { label: 'Reason', value: selectedAppt.issue },
                           { label: 'Status', value: selectedAppt.status === 'upcoming' ? 'Scheduled' : 'Completed' },
                        ].map(row => (
                           <View key={row.label} style={styles.infoRow}>
                              <Text style={styles.infoLabel}>{row.label}</Text>
                              <Text style={styles.infoValue}>{row.value}</Text>
                           </View>
                        ))}

                        <View style={styles.modalBtnRow}>
                           <TouchableOpacity
                              style={[styles.modalBtn, styles.modalBtnCancel]}
                              onPress={() => setDetailModal(false)}
                           >
                              <Text style={styles.modalBtnCancelTxt}>Close</Text>
                           </TouchableOpacity>
                           {selectedAppt.status === 'upcoming' ? (
                              <>
                                 <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: '#f5f5f5', flex: 0.8 }]}
                                    onPress={() => {
                                       setDetailModal(false);
                                       router.push({
                                          pathname: '/doctor/prescription-write',
                                          params: { patientName: selectedAppt.name, diagnosis: selectedAppt.issue }
                                       });
                                    }}
                                 >
                                    <Text style={[styles.modalBtnCancelTxt, { color: TEAL }]}>Write Rx</Text>
                                 </TouchableOpacity>
                                 <TouchableOpacity
                                    style={[styles.modalBtn, styles.modalBtnConfirm]}
                                    onPress={() => startConsult(selectedAppt)}
                                 >
                                    <Text style={styles.modalBtnConfirmTxt}>Start Consult</Text>
                                 </TouchableOpacity>
                              </>
                           ) : (
                              <TouchableOpacity
                                 style={[styles.modalBtn, styles.modalBtnConfirm]}
                                 onPress={() => {
                                    setDetailModal(false);
                                    router.push({
                                       pathname: '/doctor/prescription-write',
                                       params: { patientName: selectedAppt.name, diagnosis: selectedAppt.issue }
                                    });
                                 }}
                              >
                                 <Text style={styles.modalBtnConfirmTxt}>Write Prescription</Text>
                              </TouchableOpacity>
                           )}
                        </View>
                     </>
                  )}
               </SafeAreaView>
            </View>
         </Modal>

         <DoctorBottomNav activeTab="appointments" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   container: { flex: 1, paddingBottom: 65 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
   title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
   scheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TEAL, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
   scheduleBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#eee', borderRadius: 10, padding: 3, marginBottom: 12 },
   tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
   tabActive: { backgroundColor: '#fff', elevation: 1 },
   tabTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   tabTxtActive: { color: TEAL },
   scroll: { paddingHorizontal: 16, paddingBottom: 24 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
   retryBtn: { marginTop: 16, backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
   retryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   avatarTxt: { fontSize: 14, fontWeight: 'bold', color: TEAL },
   patientName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
   ageGender: { fontSize: 12, color: '#888', marginTop: 1 },
   typeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
   typeBadgeTxt: { fontSize: 11, fontWeight: '600', color: TEAL },
   timeBlock: { alignItems: 'flex-end' },
   timeDate: { fontSize: 12, color: '#888' },
   timeVal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 10 },
   cardBottom: { flexDirection: 'row', alignItems: 'center' },
   issueTxt: { flex: 1, fontSize: 13, color: '#555' },
   startBtn: { backgroundColor: TEAL, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
   startBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
   doneBadge: { backgroundColor: '#E1F5EE', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
   doneBadgeTxt: { color: '#085041', fontSize: 12, fontWeight: 'bold' },
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
   modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
   modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16 },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
   modalPatientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fbfc', borderRadius: 14, padding: 14, marginBottom: 16 },
   modalAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   modalAvatarTxt: { fontSize: 16, fontWeight: 'bold', color: TEAL },
   modalPatientName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   modalPatientAge: { fontSize: 13, color: '#888', marginTop: 2 },
   infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
   infoLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
   infoValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
   modalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 4 },
   modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },
});
