import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Image,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DoctorBottomNav from '../../components/DoctorBottomNav';
import ReviewAccordionItem from '../../components/ReviewAccordionItem';
import { getDashboardStats, getMyProfile, setAvailability } from '../../services/dashboardService';
import { getTodayAppointments } from '../../services/appointmentService';
import { getMyReviews } from '../../services/doctorReviewService';

const TEAL = '#1A7E8A';
const GREEN = '#1D9E75';

// Backend gives back { patientName, date, type, status, diagnosis? } — map
// that onto the shape this screen already renders (name/time/type/status/issue).
// Mirrors mapAppointment in app/doctor/appointments.js.
const formatTime = (isoDate) =>
   new Date(isoDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const mapTodayAppointment = (a) => ({
   id: a._id,
   name: a.patientName,
   time: formatTime(a.date),
   type: a.type,
   status: a.status,
   issue: a.diagnosis?.trim() ? a.diagnosis : '',
});

export default function DoctorDashboard() {
   const router = useRouter();
   const [available, setAvailable] = useState(true);
   const [loadingAvailability, setLoadingAvailability] = useState(true);
   const [updatingAvailability, setUpdatingAvailability] = useState(false);
   const [profile, setProfile] = useState(null);
   const [todayAppointments, setTodayAppointments] = useState([]);
   const [apptsLoading, setApptsLoading] = useState(true);
   const [apptsError, setApptsError] = useState('');

   // Latest reviews + rating for the "Recent patient feedback" section and
   // the "My rating" stat card, both previously hardcoded.
   const [recentReviews, setRecentReviews] = useState([]);
   const [avgRating, setAvgRating] = useState(null);
   const [reviewsLoading, setReviewsLoading] = useState(true);

   useEffect(() => {
      let isMounted = true;
      (async () => {
         try {
            const res = await getMyReviews();
            if (isMounted) {
               setRecentReviews(res.reviews.slice(0, 2));
               setAvgRating(res.avgRating);
            }
         } catch (err) {
            console.warn('Failed to load reviews:', err?.message);
         } finally {
            if (isMounted) setReviewsLoading(false);
         }
      })();
      return () => { isMounted = false; };
   }, []);

   // Load today's real appointments for the "Today's appointments" section.
   useEffect(() => {
      let isMounted = true;
      (async () => {
         try {
            const data = await getTodayAppointments();
            if (isMounted) setTodayAppointments(Array.isArray(data) ? data.map(mapTodayAppointment) : []);
         } catch (err) {
            if (isMounted) setApptsError('Could not load today\'s appointments.');
            console.warn('Failed to load today\'s appointments:', err?.message);
         } finally {
            if (isMounted) setApptsLoading(false);
         }
      })();
      return () => { isMounted = false; };
   }, []);

   // Load the doctor's real availability from the backend on mount.
   // NOTE: assumes getDashboardStats()'s response includes an `available`
   // field (in addition to todayPatients/monthCount/todayEarnings/rating).
   // If your /doctors/me/dashboard endpoint doesn't return that yet, add
   // `available: doctor.available` to its response on the backend.
   useEffect(() => {
      let isMounted = true;
      (async () => {
         try {
            const stats = await getDashboardStats();
            if (isMounted && typeof stats?.available === 'boolean') {
               setAvailable(stats.available);
            }
         } catch (err) {
            // Non-fatal: dashboard still renders, just keeps the default.
            console.warn('Failed to load availability status:', err?.message);
         } finally {
            if (isMounted) setLoadingAvailability(false);
         }
      })();
      return () => { isMounted = false; };
   }, []);

   // Load the doctor's profile (name, specialization, photoUrl) for the header.
   useEffect(() => {
      let isMounted = true;
      (async () => {
         try {
            const data = await getMyProfile();
            if (isMounted) setProfile(data);
         } catch (err) {
            // Non-fatal: header falls back to placeholder initials/text.
            console.warn('Failed to load profile:', err?.message);
         }
      })();
      return () => { isMounted = false; };
   }, []);

   const displayName = profile?.name || 'Dr. Rajesh Kumar';
   const initials = displayName
      .replace(/^Dr\.?\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'DR';

   const handleToggleAvailability = async () => {
      if (updatingAvailability) return; // guard against double-taps
      const next = !available;
      setAvailable(next); // optimistic update
      setUpdatingAvailability(true);
      try {
         await setAvailability(next);
      } catch (err) {
         setAvailable(!next); // revert on failure
         Alert.alert(
            'Error',
            'Could not update your availability. Please check your connection and try again.'
         );
      } finally {
         setUpdatingAvailability(false);
      }
   };

   const quickActions = [
      { icon: 'calendar-outline', label: 'Schedule', route: '/doctor/schedule' },
      { icon: 'document-text-outline', label: 'Prescriptions', route: '/doctor/prescriptions' },
      { icon: 'people-outline', label: 'My Patients', route: '/doctor/patients' },
      { icon: 'cash-outline', label: 'Earnings', route: '/doctor/earnings' },
   ];

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
               <View>
                  <Text style={styles.greeting}>Good morning,</Text>
                  <Text style={styles.name}>{displayName}</Text>
                  <Text style={styles.spec}>
                     {profile?.specialization || 'Cardiologist'} · {profile?.qualification || 'MBBS, MD'}
                  </Text>
               </View>
               <TouchableOpacity
                  style={styles.avatarWrap}
                  onPress={() => router.push('/doctor/profile')}
               >
                  {profile?.photoUrl ? (
                     <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} />
                  ) : (
                     <Text style={styles.avatarTxt}>{initials}</Text>
                  )}
               </TouchableOpacity>
            </View>

            {/* Availability Toggle */}
            <TouchableOpacity
               style={[styles.availRow, { backgroundColor: available ? '#E1F5EE' : '#fafafa', borderColor: available ? '#AADEC8' : '#eee', opacity: updatingAvailability ? 0.6 : 1 }]}
               onPress={handleToggleAvailability}
               disabled={loadingAvailability || updatingAvailability}
               activeOpacity={0.8}
            >
               <View style={[styles.dot, { backgroundColor: available ? GREEN : '#aaa' }]} />
               <View style={{ flex: 1 }}>
                  <Text style={[styles.availTxt, { color: available ? '#085041' : '#888' }]}>
                     {available ? 'You are available for consultations' : 'You are currently unavailable'}
                  </Text>
                  <Text style={[styles.availSub, { color: available ? '#3DAB82' : '#bbb' }]}>
                     {available ? 'Tap to go offline' : 'Tap to go online'}
                  </Text>
               </View>
               {updatingAvailability ? (
                  <ActivityIndicator size="small" color={available ? GREEN : '#aaa'} />
               ) : (
                  <Ionicons name={available ? 'toggle' : 'toggle-outline'} size={32} color={available ? GREEN : '#ccc'} />
               )}
            </TouchableOpacity>

            {/* Stats */}
            <View style={styles.statsRow}>
               {[
                  { label: "Today's patients", value: '8', icon: 'person', color: TEAL, bg: '#E8F5F7' },
                  { label: 'This month', value: '143', icon: 'calendar', color: '#378ADD', bg: '#E6F1FB' },
                  { label: 'Today earnings', value: '₹3,200', icon: 'cash', color: GREEN, bg: '#E1F5EE' },
                  { label: 'My rating', value: avgRating ? `${avgRating.toFixed(1)}★` : '—', icon: 'star', color: '#F5A623', bg: '#FEF5E7' },
               ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                     <View style={[styles.statIconBg, { backgroundColor: s.bg }]}>
                        <Ionicons name={s.icon} size={18} color={s.color} />
                     </View>
                     <Text style={styles.statValue}>{s.value}</Text>
                     <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
               ))}
            </View>

            {/* Today's Appointments */}
            <View style={styles.sectionHeaderRow}>
               <Text style={styles.sectionTitle}>Today's appointments</Text>
               <TouchableOpacity onPress={() => router.push('/doctor/appointments')}>
                  <Text style={styles.seeAll}>See all</Text>
               </TouchableOpacity>
            </View>
            {apptsLoading ? (
               <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={TEAL} />
               </View>
            ) : apptsError ? (
               <Text style={[styles.apptMeta, { textAlign: 'center', marginVertical: 16 }]}>{apptsError}</Text>
            ) : todayAppointments.length === 0 ? (
               <Text style={[styles.apptMeta, { textAlign: 'center', marginVertical: 16 }]}>No appointments scheduled for today.</Text>
            ) : todayAppointments.map(a => (
               <TouchableOpacity
                  key={a.id}
                  style={styles.apptCard}
                  onPress={() => {
                     if (a.status === 'upcoming') {
                        const params = { patientName: a.name, diagnosis: a.issue };
                        if (a.type === 'Video') router.push({ pathname: '/doctor/consultation-call', params });
                        else if (a.type === 'Chat') router.push({ pathname: '/doctor/consultation-chat', params });
                     }
                  }}
                  activeOpacity={0.85}
               >
                  <View style={styles.apptAvatar}>
                     <Text style={styles.apptAvatarTxt}>
                        {a.name.split(' ').map(w => w[0]).join('')}
                     </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.apptName}>{a.name}</Text>
                     <View style={styles.apptMetaRow}>
                        <Ionicons name="time-outline" size={12} color="#888" style={{ marginRight: 4 }} />
                        <Text style={styles.apptMeta}>{a.time}</Text>
                        <View style={styles.typePill}>
                           <Ionicons
                              name={a.type === 'Video' ? 'videocam' : a.type === 'Audio' ? 'call' : 'chatbubbles'}
                              size={10} color={TEAL}
                           />
                           <Text style={styles.typePillTxt}>{a.type}</Text>
                        </View>
                     </View>
                  </View>
                  <View style={[styles.badge, a.status === 'completed' ? styles.badgeDone : styles.badgeUp]}>
                     <Text style={[styles.badgeTxt, a.status === 'completed' ? styles.badgeDoneTxt : styles.badgeUpTxt]}>
                        {a.status === 'completed' ? 'Done' : 'Start'}
                     </Text>
                  </View>
               </TouchableOpacity>
            ))}

            {/* Quick Actions */}
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Quick actions</Text>
            <View style={styles.quickGrid}>
               {quickActions.map(q => (
                  <TouchableOpacity
                     key={q.label}
                     style={styles.quickCard}
                     onPress={() => router.push(q.route)}
                     activeOpacity={0.85}
                  >
                     <View style={styles.quickIconBg}>
                        <Ionicons name={q.icon} size={24} color={TEAL} />
                     </View>
                     <Text style={styles.quickLabel}>{q.label}</Text>
                  </TouchableOpacity>
               ))}
            </View>

            {/* Recent Reviews */}
            <View style={styles.sectionHeaderRow}>
               <Text style={styles.sectionTitle}>Recent patient feedback</Text>
               <TouchableOpacity onPress={() => router.push('/doctor/profile')}>
                  <Text style={styles.seeAll}>See all</Text>
               </TouchableOpacity>
            </View>
            {reviewsLoading ? (
               <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={TEAL} />
               </View>
            ) : recentReviews.length === 0 ? (
               <Text style={[styles.apptMeta, { textAlign: 'center', marginVertical: 16 }]}>
                  No patient feedback yet.
               </Text>
            ) : (
               recentReviews.map(r => (
                  <ReviewAccordionItem
                     key={r._id}
                     review={r}
                     defaultOpen={true}
                     collapsible={false}
                     showDate={false}
                  />
               ))
            )}

         </ScrollView>

         <DoctorBottomNav activeTab="home" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   scroll: { padding: 16, paddingBottom: 100 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
   greeting: { fontSize: 13, color: '#666', fontWeight: '500' },
   name: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginTop: 2 },
   spec: { fontSize: 13, color: TEAL, marginTop: 2, fontWeight: '500' },
   avatarWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: TEAL, shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
   avatarImg: { width: 50, height: 50, borderRadius: 25 },
   availRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 18, borderWidth: 1 },
   dot: { width: 10, height: 10, borderRadius: 5 },
   availTxt: { fontSize: 14, fontWeight: '600' },
   availSub: { fontSize: 11, marginTop: 2 },
   statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
   statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   statIconBg: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
   statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
   statValue: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
   sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
   sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
   seeAll: { fontSize: 13, fontWeight: '600', color: TEAL },
   apptCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   apptAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   apptAvatarTxt: { fontSize: 14, fontWeight: 'bold', color: TEAL },
   apptName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   apptMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
   apptMeta: { fontSize: 12, color: '#666' },
   typePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, gap: 3 },
   typePillTxt: { fontSize: 10, fontWeight: '700', color: TEAL },
   badge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
   badgeDone: { backgroundColor: '#E1F5EE' },
   badgeUp: { backgroundColor: TEAL },
   badgeTxt: { fontSize: 12, fontWeight: '700' },
   badgeDoneTxt: { color: '#085041' },
   badgeUpTxt: { color: '#fff' },
   quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 },
   quickCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   quickIconBg: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
   quickLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
   reviewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
   reviewAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   reviewAvatarTxt: { fontSize: 13, fontWeight: 'bold', color: TEAL },
   reviewName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   starsRow: { flexDirection: 'row', gap: 2, marginTop: 3 },
   reviewComment: { fontSize: 13, color: '#555', lineHeight: 19 },
});
