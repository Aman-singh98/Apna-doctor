import React, { useEffect, useState } from 'react';
import {
   View, Text, StyleSheet, SafeAreaView, ScrollView,
   TouchableOpacity, Image, StatusBar, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDoctorReviews } from '../../services/reviewService';

const TEAL = '#1A7E8A';

export default function DoctorDetailScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();

   // Handle parameter fallbacks if navigated directly or mock testing
   const docId = params.docId || '1';
   const docName = params.docName || 'Dr. Rajesh Kumar';
   const spec = params.spec || 'Cardiologist';
   const rating = params.rating || '4.9';
   const fee = params.fee ? Number(params.fee) : 600;

   const [bookmarked, setBookmarked] = useState(false);
   const [showAllBio, setShowAllBio] = useState(false);

   const [reviews, setReviews] = useState([]);
   const [avgRating, setAvgRating] = useState(null);
   const [reviewCount, setReviewCount] = useState(0);
   const [reviewsLoading, setReviewsLoading] = useState(true);

   useEffect(() => {
      (async () => {
         try {
            const res = await getDoctorReviews(docId);
            setReviews(res.reviews);
            setAvgRating(res.avgRating);
            setReviewCount(res.count);
         } catch (err) {
            console.warn('Failed to load doctor reviews:', err?.message);
         } finally {
            setReviewsLoading(false);
         }
      })();
   }, [docId]);

   // Falls back to the rating passed in via route params (from doctor-list.js)
   // until the real aggregate has loaded, so the stats grid never shows "0 ★".
   const displayRating = avgRating != null ? avgRating : rating;

   const bioText = `${docName} is a highly accomplished ${spec} with over 15 years of clinical experience. Specializing in advanced diagnostics, heart failure management, preventative cardiology, and patient-centered counseling. Having worked in top-tier healthcare institutes across the country, ${docName} focuses on combining state-of-the-art diagnostics with empathy-driven patient care.`;

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         {/* Top Navigation */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Doctor Profile</Text>
            <TouchableOpacity onPress={() => setBookmarked(!bookmarked)} style={styles.iconBtn}>
               <Ionicons
                  name={bookmarked ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color={bookmarked ? TEAL : '#1a1a1a'}
               />
            </TouchableOpacity>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Doctor Header Card */}
            <View style={styles.headerCard}>
               <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                     <Text style={styles.avatarTxt}>Dr</Text>
                  </View>
                  <View style={styles.activeIndicator} />
               </View>

               <Text style={styles.docName}>{docName}</Text>
               <Text style={styles.docSpec}>{spec} · MD, FACC</Text>
               <Text style={styles.hospitalName}>Apna Heart & General Hospital, Delhi</Text>

               {/* Tags/badges */}
               <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                     <Ionicons name="shield-checkmark" size={12} color={TEAL} style={{ marginRight: 4 }} />
                     <Text style={styles.badgeTxt}>Verified Practitioner</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#E1F5EE' }]}>
                     <Ionicons name="sparkles" size={12} color="#085041" style={{ marginRight: 4 }} />
                     <Text style={[styles.badgeTxt, { color: '#085041' }]}>Top Rated</Text>
                  </View>
               </View>
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
               {[
                  { label: 'Experience', val: '15+ Yrs', icon: 'ribbon-outline' },
                  { label: 'Rating', val: `${displayRating || '—'} ★`, icon: 'star-outline' },
                  { label: 'Patients', val: '10K+', icon: 'people-outline' },
                  { label: 'Review', val: `${reviewCount}`, icon: 'chatbox-ellipses-outline' },
               ].map((st, idx) => (
                  <View key={idx} style={styles.statBox}>
                     <View style={styles.statIconBg}>
                        <Ionicons name={st.icon} size={20} color={TEAL} />
                     </View>
                     <Text style={styles.statVal}>{st.val}</Text>
                     <Text style={styles.statLabel}>{st.label}</Text>
                  </View>
               ))}
            </View>

            {/* Fees Card */}
            <View style={styles.sectionCard}>
               <Text style={styles.sectionTitle}>Consultation Fees</Text>
               <View style={styles.feeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <View style={styles.feeIconBg}>
                        <Ionicons name="cash-outline" size={20} color="#085041" />
                     </View>
                     <View style={{ marginLeft: 12 }}>
                        <Text style={styles.feeLabel}>Video / Chat Consult</Text>
                        <Text style={styles.feeSub}>Includes prescription & 3 days follow-up</Text>
                     </View>
                  </View>
                  <Text style={styles.feeAmt}>₹{fee}</Text>
               </View>
            </View>

            {/* About Doctor Section */}
            <View style={styles.sectionCard}>
               <Text style={styles.sectionTitle}>About Doctor</Text>
               <Text style={styles.bioTxt} numberOfLines={showAllBio ? undefined : 3}>
                  {bioText}
               </Text>
               <TouchableOpacity onPress={() => setShowAllBio(!showAllBio)} style={styles.readMoreBtn}>
                  <Text style={styles.readMoreTxt}>{showAllBio ? 'Read Less' : 'Read More'}</Text>
                  <Ionicons name={showAllBio ? "chevron-up" : "chevron-down"} size={14} color={TEAL} />
               </TouchableOpacity>
            </View>

            {/* Location & Clinic Address */}
            <View style={styles.sectionCard}>
               <Text style={styles.sectionTitle}>Clinic Address</Text>
               <View style={styles.clinicRow}>
                  <Ionicons name="location-outline" size={20} color={TEAL} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                     <Text style={styles.clinicName}>Apna General Health Center</Text>
                     <Text style={styles.clinicAddress}>Block-C, Ground Floor, Sector 15, Rohini, New Delhi - 110085</Text>
                     <Text style={styles.clinicTiming}>Timings: Mon - Sat (09:00 AM - 01:00 PM)</Text>
                  </View>
               </View>
            </View>

            {/* Reviews Section */}
            <View style={styles.sectionCard}>
               <View style={[styles.feeRow, { marginBottom: 12 }]}>
                  <Text style={styles.sectionTitle}>Patient Reviews</Text>
                  {reviewCount > 0 && <Text style={styles.seeAllTxt}>{reviewCount} review{reviewCount === 1 ? '' : 's'}</Text>}
               </View>

               {reviewsLoading ? (
                  <Text style={styles.emptyReviewsTxt}>Loading reviews…</Text>
               ) : reviews.length === 0 ? (
                  <Text style={styles.emptyReviewsTxt}>
                     No reviews yet. Reviews appear here once patients rate a completed consultation.
                  </Text>
               ) : (
                  reviews.map(rev => (
                     <View key={rev._id} style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                           <View style={styles.reviewUserBg}>
                              <Text style={styles.reviewUserTxt}>{(rev.patient?.name || '?')[0]}</Text>
                           </View>
                           <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.reviewerName}>{rev.patient?.name || 'Patient'}</Text>
                              <Text style={styles.reviewDate}>
                                 {new Date(rev.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </Text>
                           </View>
                           <View style={styles.starRow}>
                              {[...Array(rev.rating)].map((_, i) => (
                                 <Ionicons key={i} name="star" size={12} color="#F5C27A" />
                              ))}
                           </View>
                        </View>
                        {!!rev.comment && <Text style={styles.reviewComment}>{rev.comment}</Text>}
                     </View>
                  ))
               )}
            </View>

         </ScrollView>

         {/* Bottom Action Bar */}
         <View style={styles.bottomBar}>
            <TouchableOpacity
               style={styles.chatBtn}
               onPress={() => router.push({ pathname: '/patient/consultation-chat', params: { docId, docName, spec } })}
            >
               <Ionicons name="chatbubble-ellipses-outline" size={20} color={TEAL} style={{ marginRight: 6 }} />
               <Text style={styles.chatBtnTxt}>Chat Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
               style={styles.bookBtnSubmit}
               onPress={() => router.push({ pathname: '/patient/book-appointment', params: { docId, docName, spec } })}
            >
               <Ionicons name="calendar-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
               <Text style={styles.bookBtnTxt}>Book Appointment</Text>
            </TouchableOpacity>
         </View>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   scroll: { padding: 16, paddingBottom: 100 },
   headerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   avatarContainer: { position: 'relative', marginBottom: 12 },
   avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   avatarTxt: { fontSize: 24, fontWeight: 'bold', color: TEAL },
   activeIndicator: { position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#1D9E75', borderWidth: 2, borderColor: '#fff' },
   docName: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
   docSpec: { fontSize: 13, fontWeight: '600', color: TEAL, marginTop: 4 },
   hospitalName: { fontSize: 12, color: '#666', marginTop: 4 },
   badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
   badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
   badgeTxt: { fontSize: 11, fontWeight: '600', color: TEAL },
   statsGrid: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 16 },
   statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   statIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0FAFA', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
   statVal: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   statLabel: { fontSize: 10, color: '#888', marginTop: 2 },
   sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
   feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   feeIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' },
   feeLabel: { fontSize: 13, fontWeight: 'bold', color: '#1a1a1a' },
   feeSub: { fontSize: 11, color: '#777', marginTop: 2 },
   feeAmt: { fontSize: 18, fontWeight: 'bold', color: TEAL },
   bioTxt: { fontSize: 13, color: '#555', lineHeight: 18 },
   readMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
   readMoreTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   clinicRow: { flexDirection: 'row', alignItems: 'flex-start' },
   clinicName: { fontSize: 13, fontWeight: 'bold', color: '#1a1a1a' },
   clinicAddress: { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 16 },
   clinicTiming: { fontSize: 11, fontWeight: '600', color: '#888', marginTop: 6 },
   seeAllTxt: { fontSize: 12, fontWeight: '600', color: TEAL },
   emptyReviewsTxt: { fontSize: 12.5, color: '#999', lineHeight: 18, paddingVertical: 4 },
   reviewItem: { borderBottomWidth: 1, borderBottomColor: '#f9f9f9', paddingVertical: 12 },
   reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
   reviewUserBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
   reviewUserTxt: { fontSize: 12, fontWeight: 'bold', color: '#555' },
   reviewerName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   reviewDate: { fontSize: 10, color: '#999', marginTop: 1 },
   starRow: { flexDirection: 'row', gap: 2 },
   reviewComment: { fontSize: 12, color: '#555', lineHeight: 17 },
   bottomBar: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', position: 'absolute', bottom: 0, left: 0, right: 0 },
   chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: TEAL, borderRadius: 12, paddingVertical: 14 },
   chatBtnTxt: { color: TEAL, fontSize: 14, fontWeight: 'bold' },
   bookBtnSubmit: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14 },
   bookBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
