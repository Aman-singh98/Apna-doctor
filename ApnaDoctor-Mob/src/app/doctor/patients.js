import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Image,
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
import DoctorBottomNav from '../../components/DoctorBottomNav';
import { getPatients } from '../../../src/services/patientService';

const TEAL = '#1A7E8A';

// dob is stored as a free-text "DD-MM-YYYY" string on the Patient model
// (not a Date), so age has to be parsed and computed on the frontend.
const calculateAge = (dobStr) => {
   if (!dobStr) return null;
   const parts = dobStr.split('-');
   if (parts.length !== 3) return null;
   const [day, month, year] = parts.map(Number);
   if (!day || !month || !year) return null;
   const dob = new Date(year, month - 1, day);
   if (Number.isNaN(dob.getTime())) return null;

   const today = new Date();
   let age = today.getFullYear() - dob.getFullYear();
   const beforeBirthdayThisYear =
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
   if (beforeBirthdayThisYear) age--;
   return age;
};

const formatLastVisit = (isoDate) =>
   isoDate
      ? new Date(isoDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'No visits yet';

// Maps a raw response row (Patient fields + computed lastVisit/condition/visits
// from the controller) into what this screen renders.
const mapPatient = (p) => ({
   id: p._id,
   name: p.name || 'Unknown',
   age: calculateAge(p.dob),
   gender: p.gender || '—',
   condition: p.condition?.trim() ? p.condition : 'No diagnosis yet',
   lastVisit: formatLastVisit(p.lastVisit),
   visits: p.visits || 0,
   photoUrl: p.photo?.url || '',
});

export default function DoctorPatientsScreen() {
   const router = useRouter();
   const [query, setQuery] = useState('');
   const [patients, setPatients] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState('');

   const loadPatients = useCallback(async (search, { silent } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
         const data = await getPatients({ search });
         setPatients(Array.isArray(data) ? data.map(mapPatient) : []);
      } catch (err) {
         setError(err.response?.data?.message || 'Could not load patients.');
      } finally {
         setLoading(false);
         setRefreshing(false);
      }
   }, []);

   // Debounce search so we're not firing a request on every keystroke.
   useEffect(() => {
      const t = setTimeout(() => loadPatients(query), 350);
      return () => clearTimeout(t);
   }, [query, loadPatients]);

   const onRefresh = () => {
      setRefreshing(true);
      loadPatients(query, { silent: true });
   };

   const filtered = patients;

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
               <Text style={styles.title}>My Patients</Text>
               <View style={styles.countBadge}>
                  <Text style={styles.countTxt}>{patients.length} total</Text>
               </View>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
               <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
               <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or condition..."
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

            {/* List */}
            {loading ? (
               <View style={styles.emptyView}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.emptyTxt}>Loading patients…</Text>
               </View>
            ) : error ? (
               <View style={styles.emptyView}>
                  <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => loadPatients(query)}>
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
                     <Ionicons name="people-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>No patients found</Text>
                  </View>
               ) : filtered.map(p => (
                  <TouchableOpacity
                     key={p.id}
                     style={styles.card}
                     activeOpacity={0.85}
                  >
                     <View style={styles.cardLeft}>
                        <View style={styles.avatar}>
                           {p.photoUrl ? (
                              <Image source={{ uri: p.photoUrl }} style={styles.avatarImg} />
                           ) : (
                              <Text style={styles.avatarTxt}>{p.name.split(' ').map(w => w[0]).join('')}</Text>
                           )}
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={styles.patientName}>{p.name}</Text>
                           <Text style={styles.meta}>{p.gender}{p.age != null ? ` · Age ${p.age}` : ''}</Text>
                           <View style={styles.conditionBadge}>
                              <Text style={styles.conditionTxt}>{p.condition}</Text>
                           </View>
                        </View>
                     </View>

                     <View style={styles.divider} />

                     <View style={styles.cardBottom}>
                        <View style={styles.statItem}>
                           <Ionicons name="calendar-outline" size={13} color="#888" />
                           <Text style={styles.statTxt}>Last: {p.lastVisit}</Text>
                        </View>
                        <View style={styles.statItem}>
                           <Ionicons name="repeat-outline" size={13} color="#888" />
                           <Text style={styles.statTxt}>{p.visits} visits</Text>
                        </View>
                        <TouchableOpacity
                           style={styles.viewBtn}
                           onPress={() => router.push({
                              pathname: '/doctor/prescription-write',
                              params: { patientName: p.name, diagnosis: p.condition }
                           })}
                        >
                           <Text style={styles.viewBtnTxt}>Write Rx</Text>
                        </TouchableOpacity>
                     </View>
                  </TouchableOpacity>
               ))}
            </ScrollView>
            )}
         </View>

         <DoctorBottomNav activeTab="patients" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   container: { flex: 1, paddingBottom: 65 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
   title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
   countBadge: { backgroundColor: '#E8F5F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
   countTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 12 },
   searchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
   scroll: { paddingHorizontal: 16, paddingBottom: 24 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
   retryBtn: { marginTop: 16, backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
   retryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
   avatarImg: { width: 48, height: 48, borderRadius: 24 },
   avatarTxt: { fontSize: 15, fontWeight: 'bold', color: TEAL },
   patientName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
   meta: { fontSize: 12, color: '#888', marginTop: 2 },
   conditionBadge: { backgroundColor: '#FEF5E7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
   conditionTxt: { fontSize: 11, fontWeight: '600', color: '#B67512' },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 10 },
   cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   statTxt: { fontSize: 12, color: '#666' },
   viewBtn: { marginLeft: 'auto', backgroundColor: TEAL, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
   viewBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});