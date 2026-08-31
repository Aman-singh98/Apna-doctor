// Target path in the app: app/patient/prescriptions.js
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
   ActivityIndicator,
   RefreshControl,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyPrescriptions } from '../../services/patientPrescriptionService';

const TEAL = '#1A7E8A';

// Same "24 Jun 2026" formatting used across the app (dashboard.js, records.js).
function formatDate(isoDate) {
   if (!isoDate) return '—';
   const d = new Date(isoDate);
   if (Number.isNaN(d.getTime())) return '—';
   return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDoctorName(rx) {
   // doctor is populated server-side ({ name }) — fall back gracefully if
   // it's ever missing or unpopulated (e.g. a stale cached response).
   if (rx.doctor && typeof rx.doctor === 'object' && rx.doctor.name) {
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

export default function PatientPrescriptionsScreen() {
   const router = useRouter();
   const [query, setQuery] = useState('');
   const [prescriptions, setPrescriptions] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState(null);

   const loadPrescriptions = useCallback(async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
         const data = await getMyPrescriptions();
         setPrescriptions(Array.isArray(data) ? data : []);
      } catch (err) {
         setError('Could not load your prescriptions. Pull down to try again.');
      } finally {
         setLoading(false);
         setRefreshing(false);
      }
   }, []);

   // Refetch on every focus (first mount + returning from detail screen),
   // same pattern as the doctor-side prescriptions.js.
   useFocusEffect(
      useCallback(() => {
         loadPrescriptions({ silent: true });
      }, [loadPrescriptions])
   );

   function handleRefresh() {
      setRefreshing(true);
      loadPrescriptions({ silent: true });
   }

   // Client-side filter, same as the doctor list — search is also sent to
   // the backend (?search=), this just keeps typing feel instant.
   const filtered = prescriptions.filter(rx =>
      getDoctorName(rx).toLowerCase().includes(query.toLowerCase()) ||
      (rx.diagnosis || '').toLowerCase().includes(query.toLowerCase())
   );

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>My Prescriptions</Text>
            <View style={{ width: 40 }} />
         </View>

         <View style={styles.searchRow}>
            <Ionicons name="search" size={19} color="#888" style={{ marginRight: 8 }} />
            <TextInput
               style={styles.searchInput}
               placeholder="Search doctor or diagnosis..."
               value={query}
               onChangeText={setQuery}
               placeholderTextColor="#aaa"
            />
            {query ? (
               <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#888" />
               </TouchableOpacity>
            ) : null}
         </View>

         {loading ? (
            <View style={styles.emptyView}>
               <ActivityIndicator size="large" color={TEAL} />
               <Text style={styles.emptyTxt}>Loading prescriptions...</Text>
            </View>
         ) : error ? (
            <View style={styles.emptyView}>
               <MaterialCommunityIcons name="alert-circle-outline" size={60} color="#ccc" />
               <Text style={styles.emptyTxt}>{error}</Text>
               <TouchableOpacity style={styles.retryBtn} onPress={() => loadPrescriptions()}>
                  <Text style={styles.retryTxt}>Retry</Text>
               </TouchableOpacity>
            </View>
         ) : (
            <ScrollView
               contentContainerStyle={styles.scroll}
               showsVerticalScrollIndicator={false}
               refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[TEAL]} tintColor={TEAL} />
               }
            >
               {filtered.length === 0 ? (
                  <View style={styles.emptyView}>
                     <MaterialCommunityIcons name="file-document-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>
                        {prescriptions.length === 0
                           ? 'No prescriptions yet — they will show up here after a doctor issues one.'
                           : 'No prescriptions found'}
                     </Text>
                  </View>
               ) : filtered.map(rx => (
                  <TouchableOpacity
                     key={rx._id}
                     style={styles.card}
                     activeOpacity={0.85}
                     onPress={() => router.push({ pathname: '/patient/prescription-detail', params: { id: rx._id } })}
                  >
                     <View style={styles.cardHeader}>
                        <View style={styles.rxIcon}>
                           <Text style={styles.rxIconTxt}>{getInitials(getDoctorName(rx))}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={styles.doctorName}>{getDoctorName(rx)}</Text>
                           <Text style={styles.diagnosis}>{rx.diagnosis}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#ccc" />
                     </View>

                     <View style={styles.divider} />

                     <View style={styles.cardFooter}>
                        <View style={styles.footerItem}>
                           <Ionicons name="calendar-outline" size={13} color="#888" />
                           <Text style={styles.footerTxt}>{formatDate(rx.date)}</Text>
                        </View>
                        <View style={styles.footerItem}>
                           <Ionicons name="medical-outline" size={13} color="#888" />
                           <Text style={styles.footerTxt}>
                              {(rx.medicines || []).length} medicine{(rx.medicines || []).length !== 1 ? 's' : ''}
                           </Text>
                        </View>
                        {!!rx.followUp && (
                           <View style={styles.footerItem}>
                              <Ionicons name="time-outline" size={13} color="#888" />
                              <Text style={styles.footerTxt}>Follow-up: {rx.followUp}</Text>
                           </View>
                        )}
                     </View>
                  </TouchableOpacity>
               ))}
            </ScrollView>
         )}
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 4 },
   searchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
   scroll: { padding: 16, paddingBottom: 40 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 32 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center' },
   retryBtn: { marginTop: 16, borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
   retryTxt: { color: TEAL, fontWeight: '700', fontSize: 13 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   rxIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' },
   rxIconTxt: { fontSize: 14, fontWeight: 'bold', color: '#085041' },
   doctorName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
   diagnosis: { fontSize: 12, color: '#888', marginTop: 2 },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 10 },
   cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
   footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   footerTxt: { fontSize: 12, color: '#666' },
});
