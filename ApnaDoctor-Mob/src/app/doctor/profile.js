import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Image,
   LayoutAnimation,
   Platform,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   UIManager,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DoctorBottomNav from '../../components/DoctorBottomNav';
import ReviewAccordionItem from '../../components/ReviewAccordionItem';
import { getMyProfile } from '../../services/profileService';
import { getMyReviews } from '../../services/doctorReviewService';

const TEAL = '#1A7E8A';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
   UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DoctorProfileScreen() {
   const router = useRouter();
   const [loading, setLoading] = useState(true);
   const [doctor, setDoctor] = useState(null);

   const [reviews, setReviews] = useState([]);
   const [avgRating, setAvgRating] = useState(null);
   const [reviewCount, setReviewCount] = useState(0);
   const [reviewsLoading, setReviewsLoading] = useState(true);
   const [reviewsSectionOpen, setReviewsSectionOpen] = useState(false);

   useEffect(() => {
      let isMounted = true;
      const load = async () => {
         try {
            const data = await getMyProfile();
            if (isMounted) setDoctor(data);
         } catch (err) {
            if (isMounted) Alert.alert('Error', 'Could not load your profile.');
         } finally {
            if (isMounted) setLoading(false);
         }
      };
      load();
      return () => { isMounted = false; };
   }, []);

   useEffect(() => {
      let isMounted = true;
      const loadReviews = async () => {
         try {
            const res = await getMyReviews();
            if (isMounted) {
               setReviews(res.reviews);
               setAvgRating(res.avgRating);
               setReviewCount(res.count);
            }
         } catch (err) {
            // Non-fatal — Rating stat just falls back to "—" and the
            // reviews section shows its own error state below.
            console.warn('Failed to load reviews:', err?.message);
         } finally {
            if (isMounted) setReviewsLoading(false);
         }
      };
      loadReviews();
      return () => { isMounted = false; };
   }, []);

   // Refresh when coming back from profile-edit (expo-router focus effect
   // could also be used here via useFocusEffect if you prefer live refresh)

   const menuSections = [
      {
         section: 'Profile & Practice',
         items: [
            { label: 'Edit Profile', icon: 'person-outline', route: '/doctor/profile-edit' },
            { label: 'Availability Schedule', icon: 'calendar-outline', route: '/doctor/schedule' },
            { label: 'Prescriptions Issued', icon: 'document-text-outline', route: '/doctor/prescriptions' },
            { label: 'Earnings & Payouts', icon: 'cash-outline', route: '/doctor/earnings' },
         ],
      },
      {
         section: 'Support',
         items: [
            { label: 'Notifications', icon: 'notifications-outline', route: '/doctor/notifications' },
            { label: 'Help & Support', icon: 'chatbubbles-outline', route: '/doctor/support' },
         ],
      },
      {
         section: 'Preferences',
         items: [
            { label: 'App Settings', icon: 'settings-outline', route: '/doctor/settings' },
         ],
      },
   ];

   const handleLogout = () => {
      Alert.alert(
         'Confirm Logout',
         'Are you sure you want to log out of ApnaDoctor?',
         [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => router.replace('/') },
         ]
      );
   };

   if (loading) {
      return (
         <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={TEAL} />
         </SafeAreaView>
      );
   }

   const initials = (doctor?.name || 'Dr')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
               {/* Profile Header */}
               <View style={styles.profileHeader}>
                  <View style={styles.avatarWrap}>
                     {doctor?.photoUrl ? (
                        <Image source={{ uri: doctor.photoUrl }} style={styles.avatarImg} />
                     ) : (
                        <Text style={styles.avatarTxt}>{initials}</Text>
                     )}
                     {doctor?.approvalStatus === 'approved' && (
                        <View style={styles.verifiedBadge}>
                           <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                     )}
                  </View>
                  <Text style={styles.name}>{doctor?.name || 'Doctor'}</Text>
                  <Text style={styles.spec}>
                     {[doctor?.specialization, doctor?.qualification].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.hospital}>{doctor?.hospital}</Text>

                  <View style={styles.statsRow}>
                     {[
                        { label: 'Experience', value: doctor?.experience != null ? `${doctor.experience} yrs` : '—' },
                        { label: 'Rating', value: avgRating ? `${avgRating.toFixed(1)}★` : '—' },
                     ].map(s => (
                        <View key={s.label} style={styles.statItem}>
                           <Text style={styles.statValue}>{s.value}</Text>
                           <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                     ))}
                  </View>
               </View>

               {/* Fees Card */}
               <View style={styles.feesCard}>
                  <View style={styles.feesRow}>
                     <View style={styles.feesIconBg}>
                        <Ionicons name="videocam-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.feesLabel}>Video Consultation</Text>
                     <Text style={styles.feesValue}>₹{doctor?.videoFee ?? 0}</Text>
                  </View>
                  <View style={[styles.feesRow, { borderTopWidth: 1, borderTopColor: '#f5f5f5', marginTop: 8, paddingTop: 8 }]}>
                     <View style={styles.feesIconBg}>
                        <Ionicons name="chatbubbles-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.feesLabel}>Chat Consultation</Text>
                     <Text style={styles.feesValue}>₹{doctor?.chatFee ?? 0}</Text>
                  </View>
               </View>

               {/* Patient Reviews */}
               <View style={[styles.sectionContainer, styles.reviewsSectionCard]}>
                  <TouchableOpacity
                     style={styles.reviewsHeaderRow}
                     activeOpacity={0.7}
                     onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setReviewsSectionOpen(prev => !prev);
                     }}
                  >
                     <Text style={styles.sectionTitle}>Patient Reviews</Text>
                     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {reviewCount > 0 && (
                           <Text style={styles.reviewsCountTxt}>
                              {avgRating?.toFixed(1)}★ · {reviewCount} review{reviewCount === 1 ? '' : 's'}
                           </Text>
                        )}
                        <Ionicons
                           name={reviewsSectionOpen ? 'chevron-up' : 'chevron-down'}
                           size={16}
                           color="#aaa"
                           style={{ marginLeft: 8 }}
                        />
                     </View>
                  </TouchableOpacity>

                  {reviewsSectionOpen && (
                     reviewsLoading ? (
                        <View style={[styles.menuGroup, styles.reviewsEmptyBox]}>
                           <ActivityIndicator size="small" color={TEAL} />
                        </View>
                     ) : reviews.length === 0 ? (
                        <View style={[styles.menuGroup, styles.reviewsEmptyBox]}>
                           <Ionicons name="star-outline" size={28} color="#ccc" />
                           <Text style={styles.reviewsEmptyTxt}>
                              No reviews yet. They'll show up here once patients rate a completed consultation.
                           </Text>
                        </View>
                     ) : (
                        reviews.map(rev => (
                           <ReviewAccordionItem
                              key={rev._id}
                              review={rev}
                              defaultOpen={false}
                              collapsible={true}
                           />
                        ))
                     )
                  )}
               </View>
               {menuSections.map(sec => (
                  <View key={sec.section} style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>{sec.section}</Text>
                     <View style={styles.menuGroup}>
                        {sec.items.map((item, idx) => (
                           <TouchableOpacity
                              key={item.label}
                              style={[styles.menuItem, idx === sec.items.length - 1 && styles.lastMenuItem]}
                              onPress={() => router.push(item.route)}
                           >
                              <View style={styles.menuLeft}>
                                 <View style={styles.menuIconBg}>
                                    <Ionicons name={item.icon} size={20} color={TEAL} />
                                 </View>
                                 <Text style={styles.menuTxt}>{item.label}</Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color="#aaa" />
                           </TouchableOpacity>
                        ))}
                     </View>
                  </View>
               ))}

               {/* Logout */}
               <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={20} color="#E24B4A" style={{ marginRight: 8 }} />
                  <Text style={styles.logoutTxt}>Log Out</Text>
               </TouchableOpacity>

               <Text style={styles.versionTxt}>ApnaDoctor Doctor App · v1.0.0</Text>
            </ScrollView>
         </View>

         <DoctorBottomNav activeTab="profile" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   container: { flex: 1, paddingBottom: 65 },
   scroll: { padding: 16, paddingBottom: 30 },
   profileHeader: { alignItems: 'center', marginVertical: 12 },
   avatarWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: TEAL, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, overflow: 'hidden' },
   avatarImg: { width: 88, height: 88, borderRadius: 44 },
   avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 30 },
   verifiedBadge: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1D9E75', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
   name: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginTop: 14 },
   spec: { fontSize: 14, color: TEAL, fontWeight: '600', marginTop: 4 },
   hospital: { fontSize: 13, color: '#888', marginTop: 4 },
   statsRow: { flexDirection: 'row', gap: 24, marginTop: 20, paddingHorizontal: 20 },
   statItem: { alignItems: 'center' },
   statValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
   statLabel: { fontSize: 12, color: '#888', marginTop: 3 },
   feesCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginTop: 16, marginBottom: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   feesRow: { flexDirection: 'row', alignItems: 'center' },
   feesIconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
   feesLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
   feesValue: { fontSize: 15, fontWeight: '700', color: TEAL },
   sectionContainer: { marginTop: 18 },
   reviewsSectionCard: {
      backgroundColor: '#fff',
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: '#D9EEF1',
      padding: 14,
      elevation: 3,
      shadowColor: TEAL,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
   },
   sectionTitle: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2, marginLeft: 4 },
   menuGroup: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   lastMenuItem: { borderBottomWidth: 0 },
   menuLeft: { flexDirection: 'row', alignItems: 'center' },
   menuIconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
   menuTxt: { fontSize: 14, fontWeight: '600', color: '#333' },
   reviewsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, marginLeft: 4, marginRight: 4 },
   reviewsCountTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   reviewsEmptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 20 },
   reviewsEmptyTxt: { fontSize: 12.5, color: '#999', textAlign: 'center', marginTop: 10, lineHeight: 18 },
   reviewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   reviewCardHeader: { flexDirection: 'row', alignItems: 'center' },
   reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   reviewAvatarTxt: { fontSize: 13, fontWeight: 'bold', color: TEAL },
   reviewerName: { fontSize: 13.5, fontWeight: '700', color: '#1a1a1a' },
   reviewDate: { fontSize: 11, color: '#999', marginTop: 1 },
   starRow: { flexDirection: 'row', gap: 1 },
   reviewComment: { fontSize: 12.5, color: '#555', lineHeight: 18, marginTop: 8 },
   logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#FCEBEB', borderRadius: 16, paddingVertical: 14, marginTop: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   logoutTxt: { fontSize: 14, fontWeight: 'bold', color: '#E24B4A' },
   versionTxt: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 24, marginBottom: 16 },
});
