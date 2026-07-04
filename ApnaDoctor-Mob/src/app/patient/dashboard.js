import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   Image,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PatientBottomNav from '../../components/PatientBottomNav';
import { getMyPatientProfile } from '../../services/patientProfileService';
import { getAppointments } from '../../services/patientAppointmentService';

const TEAL = '#1A7E8A';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Same formatting used in appointments.js, kept identical so dates read the
// same way across both screens: "Today, 3:00 PM" / "Tomorrow, 11:00 AM" / "12 Jun 2026, 6:30 PM"
function formatApptDate(isoDate) {
   const d = new Date(isoDate);
   if (isNaN(d.getTime())) return '';

   const now = new Date();
   const isSameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

   const tomorrow = new Date(now);
   tomorrow.setDate(now.getDate() + 1);

   const timeTxt = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

   if (isSameDay(d, now)) return `Today, ${timeTxt}`;
   if (isSameDay(d, tomorrow)) return `Tomorrow, ${timeTxt}`;

   return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${timeTxt}`;
}

// Maps a raw API appointment (doctor populated, real status enum) into the
// shape this screen renders. Mirrors mapAppointment() in appointments.js.
function mapAppointment(a) {
   return {
      id: a._id,
      doctor: a.doctor?.name ? `Dr. ${a.doctor.name}` : 'Doctor',
      spec: a.doctor?.specialization || '',
      type: a.type,
      date: formatApptDate(a.date),
      status: a.status,
   };
}

// Turns "Rahul Sharma" into "RS" for the avatar fallback.
function getInitials(name) {
   if (!name) return '';
   return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
}

function getGreeting() {
   const hour = new Date().getHours();
   if (hour < 12) return 'Good morning,';
   if (hour < 17) return 'Good afternoon,';
   return 'Good evening,';
}

export default function PatientDashboard() {
   const router = useRouter();

   const [patient, setPatient] = useState(null);
   const [profileLoading, setProfileLoading] = useState(true);

   const [appointments, setAppointments] = useState([]);
   const [apptLoading, setApptLoading] = useState(true);

   const loadProfile = useCallback(async () => {
      try {
         setProfileLoading(true);
         const data = await getMyPatientProfile();
         setPatient(data);
      } catch (err) {
         console.error('Failed to load patient profile:', err);
      } finally {
         setProfileLoading(false);
      }
   }, []);

   const loadAppointments = useCallback(async () => {
      try {
         setApptLoading(true);
         const data = await getAppointments();
         const upcoming = data.map(mapAppointment).filter(a => a.status === 'upcoming');
         setAppointments(upcoming.slice(0, 2));
      } catch (err) {
         console.error('Failed to load appointments:', err);
      } finally {
         setApptLoading(false);
      }
   }, []);

   useEffect(() => {
      loadProfile();
      loadAppointments();
   }, [loadProfile, loadAppointments]);

   const patientName = patient?.name || 'Patient';
   const photoUrl = patient?.photo?.url;

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={"#fff"} />
         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
               <View>
                  <Text style={styles.greeting}>{getGreeting()}</Text>
                  <Text style={styles.name}>{profileLoading ? 'Loading...' : patientName}</Text>
               </View>
               <TouchableOpacity
                  style={styles.avatarWrap}
                  onPress={() => router.push('/patient/profile')}
               >
                  {photoUrl ? (
                     <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
                  ) : (
                     <Text style={styles.avatarTxt}>{getInitials(patientName) || 'P'}</Text>
                  )}
               </TouchableOpacity>
            </View>

            {/* Health card */}
            <View style={styles.healthCard}>
               <View style={styles.healthHeader}>
                  <Text style={styles.healthTitle}>Your health summary</Text>
                  <Ionicons name="heart" size={18} color="#fff" />
               </View>
               <View style={styles.healthRow}>
                  {[
                     { label: 'Blood group', value: patient?.bloodGroup || '—' },
                     { label: 'Age', value: patient?.age ? String(patient.age) : '—' },
                     { label: 'Weight', value: patient?.weight ? `${patient.weight} kg` : '—' },
                  ].map(h => (
                     <View key={h.label} style={styles.healthItem}>
                        <Text style={styles.healthVal}>{h.value}</Text>
                        <Text style={styles.healthLabel}>{h.label}</Text>
                     </View>
                  ))}
               </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>What do you need?</Text>
            <View style={styles.quickGrid}>
               {[
                  { icon: 'search', lib: 'ionicons', label: 'Find doctor', route: '/patient/doctor-list' },
                  { icon: 'videocam', lib: 'ionicons', label: 'Video consult', route: '/patient/doctor-list' },
                  { icon: 'chatbubbles', lib: 'ionicons', label: 'Chat doctor', route: '/patient/doctor-list' },
                  { icon: 'file-tray-full', lib: 'ionicons', label: 'My records', route: '/patient/records' },
               ].map((q, idx) => (
                  <TouchableOpacity
                     key={idx}
                     style={styles.quickCard}
                     onPress={() => router.push(q.route)}
                  >
                     <View style={styles.quickIconBg}>
                        <Ionicons name={q.icon} size={24} color={TEAL} />
                     </View>
                     <Text style={styles.quickLabel}>{q.label}</Text>
                  </TouchableOpacity>
               ))}
            </View>

            {/* Upcoming Appointments */}
            <View style={styles.sectionHeaderRow}>
               <Text style={styles.sectionTitle}>Upcoming appointments</Text>
               <TouchableOpacity onPress={() => router.push('/patient/appointments')}>
                  <Text style={styles.seeAllTxt}>See all</Text>
               </TouchableOpacity>
            </View>

            {apptLoading ? (
               <Text style={styles.emptyTxt}>Loading appointments...</Text>
            ) : appointments.length === 0 ? (
               <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={28} color="#ccc" />
                  <Text style={styles.emptyTxt}>No upcoming appointments</Text>
               </View>
            ) : (
               appointments.map(a => (
                  <View key={a.id} style={styles.apptCard}>
                     <View style={styles.apptAvatar}>
                        <Text style={styles.apptAvatarTxt}>{getInitials(a.doctor)}</Text>
                     </View>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.apptName}>{a.doctor}</Text>
                        <Text style={styles.apptSpec}>{a.spec}</Text>
                        <View style={styles.metaRow}>
                           <Ionicons name={a.type === 'Video' ? 'videocam' : 'chatbubble'} size={12} color="#888" style={{ marginRight: 4 }} />
                           <Text style={styles.apptMeta}>{a.date} · {a.type}</Text>
                        </View>
                     </View>
                     <TouchableOpacity
                        style={styles.joinBtn}
                        onPress={() => {
                           if (a.type === 'Video') {
                              router.push('/patient/consultation-call');
                           } else {
                              router.push('/patient/consultation-chat');
                           }
                        }}
                     >
                        <Text style={styles.joinTxt}>Join</Text>
                     </TouchableOpacity>
                  </View>
               ))
            )}

            {/* Recent prescriptions */}
            <View style={styles.sectionHeaderRow}>
               <Text style={styles.sectionTitle}>Recent prescriptions</Text>
               <TouchableOpacity onPress={() => router.push('/patient/records')}>
                  <Text style={styles.seeAllTxt}>History</Text>
               </TouchableOpacity>
            </View>
            <View style={styles.rxCard}>
               <View style={styles.rxHeader}>
                  <View>
                     <Text style={styles.rxDoc}>Dr. Rajesh Kumar</Text>
                     <Text style={styles.rxDate}>15 Jun 2026</Text>
                  </View>
                  <MaterialCommunityIcons name="file-pdf-box" size={28} color="#E24B4A" />
               </View>
               <Text style={styles.rxMeds}>Metoprolol 25mg, Aspirin 75mg</Text>
               <TouchableOpacity
                  style={styles.rxBtn}
                  onPress={() => router.push('/patient/prescription-detail')}
               >
                  <Text style={styles.rxBtnTxt}>View Prescription</Text>
               </TouchableOpacity>
            </View>

         </ScrollView>

         {/* Bottom Nav */}
         <PatientBottomNav activeTab="home" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   scroll: { padding: 16, paddingBottom: 100 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
   greeting: { fontSize: 13, color: '#666', fontWeight: '500' },
   name: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginTop: 2 },
   avatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#378ADD', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#378ADD', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, overflow: 'hidden' },
   avatarImg: { width: 48, height: 48, borderRadius: 24 },
   avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
   healthCard: { backgroundColor: '#1A7E8A', borderRadius: 16, padding: 18, marginBottom: 24, elevation: 3, shadowColor: '#1A7E8A', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
   healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
   healthTitle: { fontSize: 14, color: '#CBEBE3', fontWeight: '600' },
   healthRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
   healthItem: { alignItems: 'center' },
   healthVal: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
   healthLabel: { fontSize: 12, color: '#CBEBE3', marginTop: 2 },
   sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
   sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
   seeAllTxt: { fontSize: 13, fontWeight: '600', color: TEAL },
   quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
   quickCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   quickIconBg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
   quickLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
   apptCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   apptAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' },
   apptAvatarTxt: { fontSize: 15, fontWeight: 'bold', color: '#085041' },
   apptName: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   apptSpec: { fontSize: 12, color: TEAL, fontWeight: '500', marginTop: 1 },
   metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
   apptMeta: { fontSize: 12, color: '#666' },
   joinBtn: { backgroundColor: '#1A7E8A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, elevation: 1 },
   joinTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   emptyCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', paddingVertical: 24, marginBottom: 10 },
   emptyTxt: { fontSize: 13, color: '#999', marginTop: 8, marginBottom: 10 },
   rxCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
   rxDoc: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   rxDate: { fontSize: 12, color: '#666', marginTop: 2 },
   rxMeds: { fontSize: 13, color: '#555', marginBottom: 14 },
   rxBtn: { borderWidth: 1.5, borderColor: TEAL, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
   rxBtnTxt: { color: TEAL, fontSize: 13, fontWeight: 'bold' },
});
