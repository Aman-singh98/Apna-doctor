import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
   ActivityIndicator,
   Image,
   Modal,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDoctors } from '../../services/patientDoctorService';

const TEAL = '#1A7E8A';

// Maps a raw API doctor document into the shape this screen renders.
// Adjust the right-hand field names here if your backend uses different keys
// (e.g. if experience comes back as `experienceYears` instead of `experience`).
function normalizeDoctor(d) {
   return {
      id: d._id || d.id,
      name: d.name ? `Dr. ${d.name}` : 'Doctor',
      spec: d.specialization || 'General Physician',
      exp: d.experience != null ? `${d.experience} Yrs` : '—',
      rating: d.rating != null ? String(d.rating) : '0',
      reviews: d.reviewsCount != null ? String(d.reviewsCount) : '0',
      fee: d.consultationFee != null ? d.consultationFee : 0,
      available: d.availability || 'Tomorrow',
      nextSlot: d.nextSlot || 'Check availability',
      photo: d.photoUrl || null,
   };
}

export default function DoctorListScreen() {
   const router = useRouter();
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedSpec, setSelectedSpec] = useState('All');
   const [filterModalVisible, setFilterModalVisible] = useState(false);

   // Filters state
   const [ratingFilter, setRatingFilter] = useState('All');
   const [feeFilter, setFeeFilter] = useState('All');
   const [availFilter, setAvailFilter] = useState('All');

   // Data state
   const [doctors, setDoctors] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);

   const loadDoctors = useCallback(async () => {
      try {
         setLoading(true);
         setError(null);
         const data = await getDoctors();
         setDoctors(data.map(normalizeDoctor));
      } catch (err) {
         console.error('Failed to load doctors:', err);
         setError('Could not load doctors. Tap to retry.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      loadDoctors();
   }, [loadDoctors]);

   // Specializations tab list is now derived from whatever doctors actually
   // came back, instead of a hardcoded list that can drift out of sync.
   const specializations = useMemo(() => {
      const unique = Array.from(new Set(doctors.map(d => d.spec))).sort();
      return ['All', ...unique];
   }, [doctors]);

   const filteredDoctors = doctors.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            d.spec.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpec = selectedSpec === 'All' || d.spec === selectedSpec;

      let matchesRating = true;
      if (ratingFilter === '4.8+') matchesRating = parseFloat(d.rating) >= 4.8;
      else if (ratingFilter === '4.9+') matchesRating = parseFloat(d.rating) >= 4.9;

      let matchesFee = true;
      if (feeFilter === 'Under 500') matchesFee = d.fee <= 500;
      else if (feeFilter === '500 - 800') matchesFee = d.fee >= 500 && d.fee <= 800;
      else if (feeFilter === 'Above 800') matchesFee = d.fee > 800;

      let matchesAvail = true;
      if (availFilter !== 'All') matchesAvail = d.available === availFilter;

      return matchesSearch && matchesSpec && matchesRating && matchesFee && matchesAvail;
   });

   const resetFilters = () => {
      setRatingFilter('All');
      setFeeFilter('All');
      setAvailFilter('All');
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={'#fff'} />
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Find Doctor</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterTrigger}>
               <Ionicons name="funnel-outline" size={20} color={TEAL} />
            </TouchableOpacity>
         </View>

         {/* Search Box */}
         <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
            <TextInput
               style={styles.searchInput}
               placeholder="Search doctors, symptoms, clinics..."
               value={searchQuery}
               onChangeText={setSearchQuery}
            />
         </View>

         {/* Specializations list */}
         <View style={{ marginBottom: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specScroll}>
               {specializations.map(s => (
                  <TouchableOpacity
                     key={s}
                     style={[styles.specTab, selectedSpec === s && styles.specTabActive]}
                     onPress={() => setSelectedSpec(s)}
                  >
                     <Text style={[styles.specTxt, selectedSpec === s && styles.specTxtActive]}>{s}</Text>
                  </TouchableOpacity>
               ))}
            </ScrollView>
         </View>

         {/* Doctor Cards Scroll */}
         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {loading ? (
               <View style={styles.emptyView}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.emptyTxt}>Loading doctors...</Text>
               </View>
            ) : error ? (
               <TouchableOpacity style={styles.emptyView} onPress={loadDoctors}>
                  <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>{error}</Text>
               </TouchableOpacity>
            ) : filteredDoctors.length === 0 ? (
               <View style={styles.emptyView}>
                  <Ionicons name="medical-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>No doctors found matching filters</Text>
               </View>
            ) : (
               filteredDoctors.map(d => (
                  <TouchableOpacity
                     key={d.id}
                     style={styles.card}
                     onPress={() => router.push({ pathname: '/patient/doctor-detail', params: { docId: d.id, docName: d.name, spec: d.spec, rating: d.rating, fee: d.fee } })}
                  >
                     <View style={styles.cardBody}>
                        <View style={styles.avatar}>
                           {d.photo ? (
                              <Image source={{ uri: d.photo }} style={styles.avatarImg} />
                           ) : (
                              <Text style={styles.avatarTxt}>Dr</Text>
                           )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                           <View style={styles.row}>
                              <Text style={styles.docName}>{d.name}</Text>
                              <View style={styles.ratingRow}>
                                 <Ionicons name="star" size={13} color="#F5C27A" />
                                 <Text style={styles.ratingTxt}>{d.rating}</Text>
                              </View>
                           </View>
                           <Text style={styles.docSpec}>{d.spec} · {d.exp} Exp</Text>
                           <Text style={styles.docFee}>Consultation: ₹{d.fee}</Text>

                           <View style={styles.slotBadge}>
                              <Ionicons name="calendar-outline" size={12} color="#1D9E75" style={{ marginRight: 4 }} />
                              <Text style={styles.slotBadgeTxt}>Next: {d.nextSlot}</Text>
                           </View>
                        </View>
                     </View>
                     <View style={styles.cardFooter}>
                        <Text style={styles.reviewsTxt}>{d.reviews} Patient Stories</Text>
                        <Text style={styles.bookActionTxt}>Book Visit →</Text>
                     </View>
                  </TouchableOpacity>
               ))
            )}
         </ScrollView>

         {/* Filters Drawer Modal */}
         <Modal
            visible={filterModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setFilterModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <SafeAreaView style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                     <Text style={styles.modalTitle}>Filter Doctors</Text>
                     <TouchableOpacity onPress={resetFilters}>
                        <Text style={styles.resetTxt}>Reset All</Text>
                     </TouchableOpacity>
                  </View>

                  {/* Rating filter */}
                  <Text style={styles.label}>Patient Rating</Text>
                  <View style={styles.pickerRow}>
                     {['All', '4.8+', '4.9+'].map(r => (
                        <TouchableOpacity
                           key={r}
                           style={[styles.opt, ratingFilter === r && styles.optActive]}
                           onPress={() => setRatingFilter(r)}
                        >
                           <Text style={[styles.optTxt, ratingFilter === r && styles.optTxtActive]}>{r}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  {/* Fee filter */}
                  <Text style={styles.label}>Consultation Fee</Text>
                  <View style={styles.pickerRow}>
                     {['All', 'Under 500', '500 - 800', 'Above 800'].map(f => (
                        <TouchableOpacity
                           key={f}
                           style={[styles.opt, feeFilter === f && styles.optActive]}
                           onPress={() => setFeeFilter(f)}
                        >
                           <Text style={[styles.optTxt, feeFilter === f && styles.optTxtActive]}>{f}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  {/* Availability filter */}
                  <Text style={styles.label}>Availability</Text>
                  <View style={styles.pickerRow}>
                     {['All', 'Today', 'Tomorrow'].map(a => (
                        <TouchableOpacity
                           key={a}
                           style={[styles.opt, availFilter === a && styles.optActive]}
                           onPress={() => setAvailFilter(a)}
                        >
                           <Text style={[styles.optTxt, availFilter === a && styles.optTxtActive]}>{a}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnCancel]}
                        onPress={() => setFilterModalVisible(false)}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Close</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnConfirm]}
                        onPress={() => setFilterModalVisible(false)}
                     >
                        <Text style={styles.modalBtnConfirmTxt}>Apply Filters</Text>
                     </TouchableOpacity>
                  </View>
               </SafeAreaView>
            </View>
         </Modal>

      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   filterTrigger: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginTop: 14, marginBottom: 14 },
   searchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
   specScroll: { paddingHorizontal: 16, gap: 8 },
   specTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
   specTabActive: { backgroundColor: TEAL, borderColor: TEAL },
   specTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   specTxtActive: { color: '#fff' },
   scroll: { paddingHorizontal: 16, paddingBottom: 24 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardBody: { flexDirection: 'row', padding: 14, alignItems: 'center' },
   avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
   avatarImg: { width: 56, height: 56, borderRadius: 28 },
   avatarTxt: { fontSize: 18, fontWeight: 'bold', color: TEAL },
   row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
   docName: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   ratingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF6E9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
   ratingTxt: { fontSize: 11, fontWeight: '700', color: '#B67512', marginLeft: 3 },
   docSpec: { fontSize: 12, color: '#666', marginTop: 2 },
   docFee: { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 4 },
   slotBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F5EE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 8 },
   slotBadgeTxt: { fontSize: 11, fontWeight: '600', color: '#085041' },
   cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
   reviewsTxt: { fontSize: 11, color: '#888', fontWeight: '500' },
   bookActionTxt: { fontSize: 12, color: TEAL, fontWeight: 'bold' },

   // Modal styling
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
   resetTxt: { fontSize: 13, fontWeight: '600', color: '#E24B4A' },
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 12, marginBottom: 8 },
   pickerRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
   opt: { borderWidth: 1.5, borderColor: '#eee', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fafafa', minWidth: 80, alignItems: 'center' },
   optActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   optTxt: { fontSize: 12, fontWeight: '600', color: '#666' },
   optTxtActive: { color: TEAL },
   modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 28, marginBottom: 10 },
   modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },
});
