import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
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
import { deletePrescription, getPrescriptions } from '../../../src/services/prescriptionService';

const TEAL = '#1A7E8A';
const RED = '#E24B4A';

// Formats a backend ISO date string (e.g. "2026-06-24T00:00:00.000Z")
// into the "24 Jun 2026" style the card already displays.
function formatDate(isoDate) {
   if (!isoDate) return '—';
   const d = new Date(isoDate);
   if (Number.isNaN(d.getTime())) return '—';
   return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DoctorPrescriptionsScreen() {
   const router = useRouter();
   const [query, setQuery] = useState('');
   const [prescriptions, setPrescriptions] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState(null);
   const [deletingId, setDeletingId] = useState(null);

   const loadPrescriptions = useCallback(async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
         const data = await getPrescriptions();
         setPrescriptions(Array.isArray(data) ? data : []);
      } catch (err) {
         setError('Could not load prescriptions. Pull down to try again.');
      } finally {
         setLoading(false);
         setRefreshing(false);
      }
   }, []);

   // Refetch every time this screen comes into focus — including the first
   // mount, and again whenever we navigate back here after Send/Edit. Using
   // `silent: true` keeps the existing list on screen (no full-screen
   // spinner) while the fresh data loads in the background.
   useFocusEffect(
      useCallback(() => {
         loadPrescriptions({ silent: true });
      }, [loadPrescriptions])
   );

   function handleRefresh() {
      setRefreshing(true);
      loadPrescriptions({ silent: true });
   }

   const filtered = prescriptions.filter(p =>
      (p.patientName || '').toLowerCase().includes(query.toLowerCase()) ||
      (p.diagnosis || '').toLowerCase().includes(query.toLowerCase())
   );

   function handleEdit(rx) {
      router.push({
         pathname: '/doctor/prescription-write',
         params: {
            id: rx._id,
            patientName: rx.patientName,
            diagnosis: rx.diagnosis,
            editMode: '1',
         },
      });
   }

   function handleDelete(rx) {
      Alert.alert(
         'Delete Prescription',
         `Delete the prescription for ${rx.patientName}? This cannot be undone.`,
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete',
               style: 'destructive',
               onPress: async () => {
                  setDeletingId(rx._id);
                  try {
                     await deletePrescription(rx._id);
                     // Update local state directly rather than re-fetching —
                     // avoids a network round trip and keeps the row removal instant.
                     setPrescriptions(prev => prev.filter(p => p._id !== rx._id));
                  } catch (err) {
                     Alert.alert('Error', 'Could not delete prescription. Please try again.');
                  } finally {
                     setDeletingId(null);
                  }
               },
            },
         ]
      );
   }

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Prescriptions</Text>
            <TouchableOpacity
               style={styles.addBtn}
               onPress={() => router.push('/doctor/prescription-write')}
            >
               <Ionicons name="add" size={22} color={TEAL} />
            </TouchableOpacity>
         </View>

         {/* Search */}
         <View style={styles.searchRow}>
            <Ionicons name="search" size={19} color="#888" style={{ marginRight: 8 }} />
            <TextInput
               style={styles.searchInput}
               placeholder="Search patient or diagnosis..."
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
                        {prescriptions.length === 0 ? 'No prescriptions yet' : 'No prescriptions found'}
                     </Text>
                  </View>
               ) : filtered.map(rx => (
                  <TouchableOpacity key={rx._id} style={styles.card} activeOpacity={0.85}>
                     <View style={styles.cardHeader}>
                        <View style={styles.rxIcon}>
                           <MaterialCommunityIcons name="prescription" size={22} color={TEAL} />
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={styles.patientName}>{rx.patientName}</Text>
                           <Text style={styles.diagnosis}>{rx.diagnosis}</Text>
                        </View>
                        <View style={styles.sentBadge}>
                           <Ionicons name="checkmark-circle" size={13} color="#1D9E75" style={{ marginRight: 4 }} />
                           <Text style={styles.sentTxt}>Sent</Text>
                        </View>
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
                        <View style={styles.actionRow}>
                           <TouchableOpacity
                              style={styles.editBtn}
                              onPress={() => handleEdit(rx)}
                              disabled={deletingId === rx._id}
                           >
                              <Ionicons name="create-outline" size={14} color={TEAL} />
                              <Text style={styles.editBtnTxt}>Edit</Text>
                           </TouchableOpacity>
                           <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => handleDelete(rx)}
                              disabled={deletingId === rx._id}
                           >
                              {deletingId === rx._id ? (
                                 <ActivityIndicator size="small" color={RED} />
                              ) : (
                                 <Ionicons name="trash-outline" size={14} color={RED} />
                              )}
                           </TouchableOpacity>
                        </View>
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
   addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 4 },
   searchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
   scroll: { padding: 16, paddingBottom: 100 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center', paddingHorizontal: 32 },
   retryBtn: { marginTop: 16, borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
   retryTxt: { color: TEAL, fontWeight: '700', fontSize: 13 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   rxIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   patientName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
   diagnosis: { fontSize: 12, color: '#888', marginTop: 2 },
   sentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F5EE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
   sentTxt: { fontSize: 12, fontWeight: '700', color: '#085041' },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 10 },
   cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   footerTxt: { fontSize: 12, color: '#666' },
   actionRow: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
   editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
   editBtnTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   deleteBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: '#f5d6d5', backgroundColor: '#FDF2F2', alignItems: 'center', justifyContent: 'center' },
   fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
