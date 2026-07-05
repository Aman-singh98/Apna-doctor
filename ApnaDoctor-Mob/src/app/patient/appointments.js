import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
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
import PatientBottomNav from '../../components/PatientBottomNav';
import {
   cancelAppointment as apiCancelAppointment,
   getAppointments as apiGetAppointments,
   rescheduleAppointment as apiRescheduleAppointment,
} from '../../services/patientAppointmentService';
import {
   addReview as apiAddReview,
   updateReview as apiUpdateReview,
   deleteReview as apiDeleteReview,
   getMyReviews as apiGetMyReviews,
} from '../../services/reviewService';

const TEAL = '#1A7E8A';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats an ISO date string into the friendly labels the UI already used,
// e.g. "Today, 3:00 PM" / "Tomorrow, 11:00 AM" / "12 Jun 2026, 6:30 PM"
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

// Combines the reschedule modal's picker strings ("22 Jun 2026", "4:00 PM")
// into a real Date, and returns it as an ISO string for the API.
function buildIsoDateTime(dateStr, timeStr) {
   const [day, monName, year] = dateStr.split(' ');
   const monthIndex = MONTHS.indexOf(monName);

   const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
   if (!match) return null;
   let [, hourStr, minuteStr, meridiem] = match;
   let hour = parseInt(hourStr, 10);
   const minute = parseInt(minuteStr, 10);
   if (meridiem.toUpperCase() === 'PM' && hour !== 12) hour += 12;
   if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;

   const d = new Date(parseInt(year, 10), monthIndex, parseInt(day, 10), hour, minute);
   return isNaN(d.getTime()) ? null : d.toISOString();
}

// Maps a raw API appointment (doctor populated, real status enum) into the
// shape this screen renders.
function mapAppointment(a) {
   return {
      id: a._id,
      doctor: a.doctor?.name ? `Dr. ${a.doctor.name}` : 'Doctor',
      spec: a.doctor?.specialization || '',
      type: a.type,
      date: formatApptDate(a.date),
      rawDate: a.date,
      status: a.status === 'upcoming' ? 'upcoming' : 'past', // bucket for the two tabs
      rawStatus: a.status, // 'upcoming' | 'completed' | 'cancelled'
      cancelReason: a.cancelReason,
   };
}

export default function AppointmentsScreen() {
   const router = useRouter();
   const [activeFilter, setActiveFilter] = useState('upcoming'); // 'upcoming' or 'past'
   const [appointments, setAppointments] = useState([]);
   const [loading, setLoading] = useState(true);
   const [searchQuery, setSearchQuery] = useState('');
   
   // Modals state
   const [selectedAppt, setSelectedAppt] = useState(null);
   const [cancelModalVisible, setCancelModalVisible] = useState(false);
   const [cancelReason, setCancelReason] = useState('');
   const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
   const [newDate, setNewDate] = useState('22 Jun 2026');
   const [newTime, setNewTime] = useState('4:00 PM');
   const [actionLoading, setActionLoading] = useState(false);

   // Reviews — keyed by appointment id, so each completed card can show
   // "Rate & Review" or "★ Your Review" without a per-card fetch.
   const [reviewsByAppt, setReviewsByAppt] = useState({});
   const [reviewModalVisible, setReviewModalVisible] = useState(false);
   const [reviewRating, setReviewRating] = useState(0);
   const [reviewComment, setReviewComment] = useState('');
   const [reviewSaving, setReviewSaving] = useState(false);

   const loadReviews = useCallback(async () => {
      try {
         const mine = await apiGetMyReviews();
         const map = {};
         mine.forEach(r => { map[r.appointment] = r; });
         setReviewsByAppt(map);
      } catch (err) {
         // Non-fatal — cards just fall back to showing "Rate & Review" for everything.
         console.warn('Failed to load my reviews:', err?.message);
      }
   }, []);

   const loadAppointments = useCallback(async () => {
      try {
         setLoading(true);
         const data = await apiGetAppointments();
         setAppointments(data.map(mapAppointment));
      } catch (err) {
         Alert.alert('Error', 'Could not load appointments.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      loadAppointments();
      loadReviews();
   }, [loadAppointments, loadReviews]);

   const filteredAppts = appointments.filter(a => {
      const matchesFilter = a.status === activeFilter;
      const matchesSearch = a.doctor.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            a.spec.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
   });

   const handleCancel = (appt) => {
      setSelectedAppt(appt);
      setCancelModalVisible(true);
   };

   const confirmCancel = async () => {
      if (!cancelReason) {
         Alert.alert('Error', 'Please select or enter a cancellation reason');
         return;
      }
      try {
         setActionLoading(true);
         await apiCancelAppointment(selectedAppt.id, cancelReason);
         await loadAppointments();
         setCancelModalVisible(false);
         setCancelReason('');
         Alert.alert('Appointment Cancelled', 'Your refund request has been initiated.');
      } catch (err) {
         Alert.alert('Error', err?.response?.data?.message || 'Could not cancel appointment.');
      } finally {
         setActionLoading(false);
      }
   };

   const handleOpenReview = (appt) => {
      const existing = reviewsByAppt[appt.id];
      setSelectedAppt(appt);
      setReviewRating(existing?.rating || 0);
      setReviewComment(existing?.comment || '');
      setReviewModalVisible(true);
   };

   const submitReview = async () => {
      if (!reviewRating) {
         Alert.alert('Error', 'Please select a star rating.');
         return;
      }
      const existing = reviewsByAppt[selectedAppt.id];
      try {
         setReviewSaving(true);
         if (existing) {
            const updated = await apiUpdateReview(existing._id, { rating: reviewRating, comment: reviewComment });
            setReviewsByAppt(prev => ({ ...prev, [selectedAppt.id]: updated }));
         } else {
            const created = await apiAddReview({
               appointmentId: selectedAppt.id,
               rating: reviewRating,
               comment: reviewComment,
            });
            setReviewsByAppt(prev => ({ ...prev, [selectedAppt.id]: created }));
         }
         setReviewModalVisible(false);
         Alert.alert('Thank you!', 'Your review has been saved.');
      } catch (err) {
         Alert.alert('Error', err?.response?.data?.message || 'Could not save your review.');
      } finally {
         setReviewSaving(false);
      }
   };

   const handleDeleteReview = (appt) => {
      const existing = reviewsByAppt[appt.id];
      if (!existing) return;
      Alert.alert(
         'Delete Review',
         'Are you sure you want to remove your review for this consultation?',
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete',
               style: 'destructive',
               onPress: async () => {
                  const previous = reviewsByAppt;
                  setReviewsByAppt(prev => {
                     const next = { ...prev };
                     delete next[appt.id];
                     return next;
                  });
                  try {
                     await apiDeleteReview(existing._id);
                  } catch (err) {
                     setReviewsByAppt(previous);
                     Alert.alert('Error', 'Could not delete review. Please try again.');
                  }
               },
            },
         ]
      );
   };

   const handleReschedule = (appt) => {
      setSelectedAppt(appt);
      setRescheduleModalVisible(true);
   };

   const confirmReschedule = async () => {
      const isoDate = buildIsoDateTime(newDate, newTime);
      if (!isoDate) {
         Alert.alert('Error', 'Please choose a valid date and time.');
         return;
      }
      try {
         setActionLoading(true);
         await apiRescheduleAppointment(selectedAppt.id, isoDate);
         await loadAppointments();
         setRescheduleModalVisible(false);
         Alert.alert('Rescheduled Successfully', `Your appointment is rescheduled to ${newDate} at ${newTime}.`);
      } catch (err) {
         Alert.alert('Error', err?.response?.data?.message || 'Could not reschedule appointment.');
      } finally {
         setActionLoading(false);
      }
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={"#fff"} />
         <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
               <Text style={styles.title}>My Appointments</Text>
               <TouchableOpacity onPress={() => router.push('/patient/book-appointment')}>
                  <View style={styles.addBtn}>
                     <Ionicons name="add" size={20} color="#fff" />
                     <Text style={styles.addBtnTxt}>Book</Text>
                  </View>
               </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchRow}>
               <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
               <TextInput
                  style={styles.searchInput}
                  placeholder="Search doctor or specialty..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
               />
               {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                     <Ionicons name="close-circle" size={18} color="#888" />
                  </TouchableOpacity>
               ) : null}
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
                  style={[styles.tab, activeFilter === 'past' && styles.tabActive]}
                  onPress={() => setActiveFilter('past')}
               >
                  <Text style={[styles.tabTxt, activeFilter === 'past' && styles.tabTxtActive]}>Past / History</Text>
               </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
               {loading ? (
                  <View style={styles.emptyView}>
                     <ActivityIndicator size="large" color={TEAL} />
                  </View>
               ) : filteredAppts.length === 0 ? (
                  <View style={styles.emptyView}>
                     <Ionicons name="calendar-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>No appointments found</Text>
                  </View>
               ) : (
                  filteredAppts.map(a => (
                     <View key={a.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                           <View style={styles.avatar}>
                              <Text style={styles.avatarTxt}>
                                 {a.doctor.split(' ').slice(1).map(w => w[0]).join('')}
                              </Text>
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.docName}>{a.doctor}</Text>
                              <Text style={styles.docSpec}>{a.spec}</Text>
                              <View style={styles.typeBadge}>
                                 <Ionicons 
                                    name={a.type === 'Video' ? 'videocam' : a.type === 'Chat' ? 'chatbubbles' : 'call'} 
                                    size={12} 
                                    color={TEAL} 
                                    style={{ marginRight: 4 }}
                                 />
                                 <Text style={styles.typeBadgeTxt}>{a.type} Consult</Text>
                              </View>
                           </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.cardBody}>
                           <View style={styles.timeRow}>
                              <Ionicons name="time-outline" size={16} color="#666" style={{ marginRight: 6 }} />
                              <Text style={styles.timeTxt}>{a.date}</Text>
                           </View>
                        </View>

                        {a.status === 'upcoming' ? (
                           <View style={styles.btnRow}>
                              <TouchableOpacity 
                                 style={[styles.btn, styles.btnSecondary]}
                                 onPress={() => handleCancel(a)}
                              >
                                 <Text style={styles.btnSecondaryTxt}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                 style={[styles.btn, styles.btnSecondary]}
                                 onPress={() => handleReschedule(a)}
                              >
                                 <Text style={styles.btnSecondaryTxt}>Reschedule</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                 style={[styles.btn, styles.btnPrimary]}
                                 onPress={() => {
                                    if (a.type === 'Video') {
                                       router.push('/patient/consultation-call');
                                    } else {
                                       router.push('/patient/consultation-chat');
                                    }
                                 }}
                              >
                                 <Text style={styles.btnPrimaryTxt}>Join</Text>
                              </TouchableOpacity>
                           </View>
                        ) : (
                           <View style={styles.btnRow}>
                              {a.rawStatus === 'cancelled' ? (
                                 <View style={styles.cancelledBadge}>
                                    <Text style={styles.cancelledBadgeTxt}>Refund Initiated</Text>
                                 </View>
                              ) : (
                                 <>
                                    <TouchableOpacity 
                                       style={[styles.btn, styles.btnSecondary]}
                                       onPress={() => router.push('/patient/records')}
                                    >
                                       <Text style={styles.btnSecondaryTxt}>View Rx</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                       style={[styles.btn, styles.btnPrimary]}
                                       onPress={() => router.push({ pathname: '/patient/book-appointment', params: { doctor: a.doctor, spec: a.spec } })}
                                    >
                                       <Text style={styles.btnPrimaryTxt}>Rebook</Text>
                                    </TouchableOpacity>
                                 </>
                              )}
                           </View>
                        )}

                        {a.status === 'past' && a.rawStatus !== 'cancelled' && (
                           reviewsByAppt[a.id] ? (
                              <View style={styles.reviewRow}>
                                 <View style={styles.reviewBadge}>
                                    {[1, 2, 3, 4, 5].map(n => (
                                       <Ionicons
                                          key={n}
                                          name={n <= reviewsByAppt[a.id].rating ? 'star' : 'star-outline'}
                                          size={13}
                                          color="#F5C27A"
                                       />
                                    ))}
                                    <Text style={styles.reviewBadgeTxt}>Your review</Text>
                                 </View>
                                 <View style={styles.reviewActions}>
                                    <TouchableOpacity onPress={() => handleOpenReview(a)}>
                                       <Text style={styles.reviewEditTxt}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteReview(a)}>
                                       <Text style={styles.reviewDeleteTxt}>Delete</Text>
                                    </TouchableOpacity>
                                 </View>
                              </View>
                           ) : (
                              <TouchableOpacity style={styles.rateBtn} onPress={() => handleOpenReview(a)}>
                                 <Ionicons name="star-outline" size={14} color={TEAL} style={{ marginRight: 6 }} />
                                 <Text style={styles.rateBtnTxt}>Rate & Review</Text>
                              </TouchableOpacity>
                           )
                        )}
                     </View>
                  ))
               )}
            </ScrollView>
         </View>

         {/* Cancel Modal */}
         <Modal
            visible={cancelModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setCancelModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <SafeAreaView style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Cancel Appointment</Text>
                  <Text style={styles.modalSubtitle}>Please select a reason for cancellation</Text>

                  {['Doctor not available at this time', 'Incorrect slot booked', 'Health issue resolved', 'Want to book another doctor', 'Other reason'].map(r => (
                     <TouchableOpacity 
                        key={r} 
                        style={[styles.reasonRow, cancelReason === r && styles.reasonRowActive]}
                        onPress={() => setCancelReason(r)}
                     >
                        <View style={[styles.radioDot, cancelReason === r && styles.radioDotActive]} />
                        <Text style={[styles.reasonTxt, cancelReason === r && styles.reasonTxtActive]}>{r}</Text>
                     </TouchableOpacity>
                  ))}

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnCancel]} 
                        onPress={() => setCancelModalVisible(false)}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Go Back</Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnConfirm]} 
                        onPress={confirmCancel}
                        disabled={actionLoading}
                     >
                        <Text style={styles.modalBtnConfirmTxt}>{actionLoading ? 'Cancelling...' : 'Cancel Appt'}</Text>
                     </TouchableOpacity>
                  </View>
               </SafeAreaView>
            </View>
         </Modal>

         {/* Reschedule Modal */}
         <Modal
            visible={rescheduleModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setRescheduleModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <SafeAreaView style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Reschedule Appointment</Text>
                  <Text style={styles.modalSubtitle}>Choose a new date and time slot</Text>

                  <Text style={styles.label}>Select Date</Text>
                  <View style={styles.pickerRow}>
                     {['22 Jun 2026', '23 Jun 2026', '24 Jun 2026'].map(d => (
                        <TouchableOpacity 
                           key={d} 
                           style={[styles.dateOpt, newDate === d && styles.dateOptActive]}
                           onPress={() => setNewDate(d)}
                        >
                           <Text style={[styles.dateOptTxt, newDate === d && styles.dateOptTxtActive]}>{d.split(' ')[0]}</Text>
                           <Text style={[styles.dateOptSub, newDate === d && styles.dateOptSubActive]}>{d.split(' ')[1]}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <Text style={styles.label}>Select Time Slot</Text>
                  
                  <ScrollView
                     horizontal
                     showsHorizontalScrollIndicator={false}
                     contentContainerStyle={styles.pickerRow}
                     >
                     {['10:00 AM', '11:30 AM', '3:00 PM', '4:00 PM'].map(t => (
                  <TouchableOpacity
                     key={t}
                     style={[
                     styles.timeOpt,
                     newTime === t && styles.timeOptActive,
                     ]}
                     onPress={() => setNewTime(t)}
                  >
                     <Text
                     style={[
                        styles.timeOptTxt,
                        newTime === t && styles.timeOptTxtActive,
                     ]}
                     >
                     {t}
                     </Text>
                  </TouchableOpacity>
               ))}
               </ScrollView>

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnCancel]} 
                        onPress={() => setRescheduleModalVisible(false)}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Discard</Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnConfirm]} 
                        onPress={confirmReschedule}
                        disabled={actionLoading}
                     >
                        <Text style={styles.modalBtnConfirmTxt}>{actionLoading ? 'Saving...' : 'Reschedule'}</Text>
                     </TouchableOpacity>
                  </View>
               </SafeAreaView>
            </View>
         </Modal>

         {/* Review Modal */}
         <Modal
            visible={reviewModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setReviewModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <SafeAreaView style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                     {reviewsByAppt[selectedAppt?.id] ? 'Edit Your Review' : 'Rate Your Consultation'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                     {selectedAppt ? `How was your consultation with ${selectedAppt.doctor}?` : ''}
                  </Text>

                  <View style={styles.starPickerRow}>
                     {[1, 2, 3, 4, 5].map(n => (
                        <TouchableOpacity key={n} onPress={() => setReviewRating(n)} style={{ padding: 4 }}>
                           <Ionicons
                              name={n <= reviewRating ? 'star' : 'star-outline'}
                              size={32}
                              color="#F5C27A"
                           />
                        </TouchableOpacity>
                     ))}
                  </View>

                  <Text style={styles.label}>Your Comments (Optional)</Text>
                  <TextInput
                     style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
                     placeholder="Share details about your consultation experience..."
                     value={reviewComment}
                     onChangeText={setReviewComment}
                     multiline
                     numberOfLines={4}
                  />

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnCancel]} 
                        onPress={() => setReviewModalVisible(false)}
                        disabled={reviewSaving}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Cancel</Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnConfirm]} 
                        onPress={submitReview}
                        disabled={reviewSaving}
                     >
                        <Text style={styles.modalBtnConfirmTxt}>{reviewSaving ? 'Saving...' : 'Submit Review'}</Text>
                     </TouchableOpacity>
                  </View>
               </SafeAreaView>
            </View>
         </Modal>

         {/* Bottom Navigation */}
         <PatientBottomNav activeTab="appointments" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   container: { flex: 1, paddingBottom: 65 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
   title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
   addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: TEAL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
   addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 2 },
   searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 14 },
   searchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
   tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#eee', borderRadius: 10, padding: 3, marginBottom: 12 },
   tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
   tabActive: { backgroundColor: '#fff', elevation: 1 },
   tabTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   tabTxtActive: { color: TEAL },
   scroll: { paddingHorizontal: 16, paddingBottom: 24 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' },
   avatarTxt: { fontSize: 14, fontWeight: 'bold', color: '#085041' },
   docName: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   docSpec: { fontSize: 12, color: '#666', marginTop: 1 },
   typeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
   typeBadgeTxt: { fontSize: 11, fontWeight: '600', color: TEAL },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 10 },
   cardBody: { marginBottom: 12 },
   timeRow: { flexDirection: 'row', alignItems: 'center' },
   timeTxt: { fontSize: 13, color: '#444', fontWeight: '500' },
   btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
   btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minWidth: 80, alignItems: 'center' },
   btnSecondary: { borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
   btnSecondaryTxt: { fontSize: 12, color: '#666', fontWeight: '600' },
   btnPrimary: { backgroundColor: TEAL },
   btnPrimaryTxt: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
   cancelledBadge: { backgroundColor: '#FCEBEB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
   cancelledBadgeTxt: { color: '#E24B4A', fontSize: 12, fontWeight: 'bold' },
   rateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: TEAL, borderRadius: 8, paddingVertical: 10, marginTop: 10 },
   rateBtnTxt: { fontSize: 12.5, fontWeight: 'bold', color: TEAL },
   reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
   reviewBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
   reviewBadgeTxt: { fontSize: 11, color: '#888', fontWeight: '600', marginLeft: 6 },
   reviewActions: { flexDirection: 'row', gap: 14 },
   reviewEditTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   reviewDeleteTxt: { fontSize: 12, fontWeight: '700', color: '#E24B4A' },
   starPickerRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
   
   // Modal style
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
   modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
   reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
   reasonRowActive: { borderBottomColor: TEAL },
   radioDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#ccc', marginRight: 10 },
   radioDotActive: { borderColor: TEAL, backgroundColor: TEAL },
   reasonTxt: { fontSize: 14, color: '#444' },
   reasonTxtActive: { color: TEAL, fontWeight: '600' },
   modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 },
   modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },

   // Reschedule picker
   label: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 12, marginBottom: 8 },
   pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
   dateOpt: { flex: 1, borderWidth: 1.5, borderColor: '#eee', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fafafa' },
   dateOptActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   dateOptTxt: { fontSize: 15, fontWeight: '700', color: '#333' },
   dateOptTxtActive: { color: TEAL },
   dateOptSub: { fontSize: 11, color: '#777', marginTop: 2 },
   dateOptSubActive: { color: TEAL, fontWeight: '500' },
   timeOpt: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: '#eee', borderRadius: 8, backgroundColor: '#fafafa' },
   timeOptActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   timeOptTxt: { fontSize: 13, color: '#333', fontWeight: '500' },
   timeOptTxtActive: { color: TEAL, fontWeight: 'bold' }
});