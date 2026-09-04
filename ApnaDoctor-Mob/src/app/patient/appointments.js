import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   KeyboardAvoidingView,
   Modal,
   Platform,
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
import { getAvailability } from '../../services/patientDoctorService';
import {
   addReview as apiAddReview,
   updateReview as apiUpdateReview,
   deleteReview as apiDeleteReview,
   getMyReviews as apiGetMyReviews,
} from '../../services/reviewService';

const TEAL = '#1A7E8A';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
   return String(n).padStart(2, '0');
}

// Builds the next `n` days starting today, in the shape the reschedule
// date strip needs — same approach as book-appointment.js's date strip,
// so rescheduling picks from the doctor's REAL upcoming availability
// instead of 3 hardcoded dates.
function buildNextDates(n = 7) {
   const today = new Date();
   const days = [];
   for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
         label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : '',
         date: DAY_NAMES[d.getDay()],
         num: d.getDate(),
         iso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      });
   }
   return days;
}

// Buckets a time-string slot ("09:00 AM") into Morning/Afternoon/Evening,
// same grouping book-appointment.js uses for its slot grid.
function periodOf(slot) {
   const match = slot.match(/^(\d+):\d+\s*(AM|PM)$/i);
   if (!match) return 'Morning';
   let hour = parseInt(match[1], 10);
   if (match[2].toUpperCase() === 'PM' && hour !== 12) hour += 12;
   if (match[2].toUpperCase() === 'AM' && hour === 12) hour = 0;
   if (hour < 12) return 'Morning';
   if (hour < 16) return 'Afternoon';
   return 'Evening';
}

function groupSlotsByPeriod(slots) {
   const grouped = { Morning: [], Afternoon: [], Evening: [] };
   slots.forEach(s => grouped[periodOf(s)].push(s));
   return grouped;
}

// Combines a date-strip entry's ISO date with a "4:00 PM"-style slot string
// into a real ISO datetime for the API.
function combineDateAndSlot(iso, slot) {
   if (!slot) return null;
   const [year, month, day] = iso.split('-').map(Number);
   const match = slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
   if (!match) return null;
   let hour = parseInt(match[1], 10);
   const minute = parseInt(match[2], 10);
   if (match[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
   if (match[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
   const d = new Date(year, month - 1, day, hour, minute);
   return isNaN(d.getTime()) ? null : d.toISOString();
}

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

// Maps a raw API appointment (doctor populated, real status enum) into the
// shape this screen renders.
function mapAppointment(a) {
   return {
      id: a._id,
      doctorId: a.doctor?._id || null,
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
   const [actionLoading, setActionLoading] = useState(false);

   // Reschedule — real date strip + slots pulled from the doctor's own
   // schedule/availability, same as book-appointment.js, instead of a
   // hardcoded 3-date / 4-slot picker.
   const rescheduleDates = React.useMemo(() => buildNextDates(7), []);
   const [selectedRDate, setSelectedRDate] = useState(rescheduleDates[0]);
   const [selectedRSlot, setSelectedRSlot] = useState(null);
   const [rActiveSlots, setRActiveSlots] = useState([]);
   const [rBookedSlots, setRBookedSlots] = useState([]);
   const [rSlotsLoading, setRSlotsLoading] = useState(false);

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
      setSelectedRDate(rescheduleDates[0]);
      setSelectedRSlot(null);
      setRescheduleModalVisible(true);
   };

   // Fetch the doctor's real availability whenever the reschedule modal is
   // open and the picked date changes — mirrors the effect in
   // book-appointment.js so the picker only ever offers slots the doctor
   // actually works, with already-booked ones shown but disabled.
   useEffect(() => {
      if (!rescheduleModalVisible || !selectedAppt?.doctorId || !selectedRDate) return;
      (async () => {
         try {
            setRSlotsLoading(true);
            const result = await getAvailability(selectedAppt.doctorId, selectedRDate.iso);
            setRActiveSlots(result.activeSlots || []);
            setRBookedSlots(result.bookedSlots || []);
         } catch (err) {
            Alert.alert('Error', 'Could not load available time slots.');
            setRActiveSlots([]);
            setRBookedSlots([]);
         } finally {
            setRSlotsLoading(false);
         }
      })();
   }, [rescheduleModalVisible, selectedAppt, selectedRDate]);

   const confirmReschedule = async () => {
      if (!selectedRSlot) {
         Alert.alert('Select Time', 'Please select a time slot to continue.');
         return;
      }
      const isoDate = combineDateAndSlot(selectedRDate.iso, selectedRSlot);
      if (!isoDate) {
         Alert.alert('Error', 'Please choose a valid date and time.');
         return;
      }
      try {
         setActionLoading(true);
         await apiRescheduleAppointment(selectedAppt.id, isoDate);
         await loadAppointments();
         setRescheduleModalVisible(false);
         Alert.alert('Rescheduled Successfully', `Your appointment is rescheduled to ${selectedRDate.date} ${selectedRDate.num}, ${selectedRSlot}.`);
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
                                    const dest = (a.type === 'Video' || a.type === 'Audio')
                                       ? '/patient/consultation-call'
                                       : '/patient/consultation-chat';
                                    router.push({
                                       pathname: dest,
                                       params: {
                                          appointmentId: a.id,
                                          docName: a.doctor,
                                          spec: a.spec,
                                          callType: a.type,
                                       },
                                    });
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

         {/* Reschedule Modal — date strip + grouped time slots pulled from
             the doctor's real schedule/availability, same UX pattern as
             the "Date & Time" step in book-appointment.js. */}
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

                  {/* Everything between the header and the action buttons scrolls —
                      a doctor with a full day of slots (Morning/Afternoon/Evening)
                      easily runs past the sheet's maxHeight, and without this the
                      content just got clipped with no way to reach the rest of the
                      slots or the Reschedule button itself. */}
                  <ScrollView
                     style={styles.modalScrollArea}
                     contentContainerStyle={styles.modalScrollContent}
                     showsVerticalScrollIndicator={true}
                     nestedScrollEnabled={true}
                  >
                     <Text style={styles.label}>Select Date</Text>
                     <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dateStripRow}
                     >
                        {rescheduleDates.map(d => {
                           const isSel = selectedRDate.iso === d.iso;
                           return (
                              <TouchableOpacity
                                 key={d.iso}
                                 style={[styles.dateOpt, isSel && styles.dateOptActive]}
                                 onPress={() => { setSelectedRDate(d); setSelectedRSlot(null); }}
                              >
                                 {d.label ? (
                                    <Text style={[styles.dateOptLabel, isSel && styles.dateOptLabelActive]}>{d.label}</Text>
                                 ) : (
                                    <Text style={[styles.dateOptLabel, isSel && styles.dateOptLabelActive]}>{d.date}</Text>
                                 )}
                                 <Text style={[styles.dateOptTxt, isSel && styles.dateOptTxtActive]}>{d.num}</Text>
                              </TouchableOpacity>
                           );
                        })}
                     </ScrollView>

                     <Text style={styles.label}>Select Time Slot</Text>

                     {rSlotsLoading ? (
                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                           <ActivityIndicator size="small" color={TEAL} />
                        </View>
                     ) : rActiveSlots.length === 0 ? (
                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                           <Ionicons name="calendar-outline" size={30} color="#ccc" />
                           <Text style={{ marginTop: 8, color: '#999', fontSize: 13 }}>Doctor isn't available on this day.</Text>
                        </View>
                     ) : (
                        Object.entries(groupSlotsByPeriod(rActiveSlots)).map(([period, slots]) => (
                           slots.length === 0 ? null : (
                              <View key={period} style={{ marginBottom: 14 }}>
                                 <Text style={styles.slotPeriodTxt}>{period}</Text>
                                 <View style={styles.pickerRow}>
                                    {slots.map(t => {
                                       const isSlotBooked = rBookedSlots.includes(t);
                                       const isSel = selectedRSlot === t;
                                       return (
                                          <TouchableOpacity
                                             key={t}
                                             style={[
                                                styles.timeOpt,
                                                isSlotBooked && styles.timeOptBooked,
                                                isSel && styles.timeOptActive,
                                             ]}
                                             disabled={isSlotBooked}
                                             onPress={() => setSelectedRSlot(t)}
                                          >
                                             <Text
                                                style={[
                                                   styles.timeOptTxt,
                                                   isSlotBooked && styles.timeOptTxtBooked,
                                                   isSel && styles.timeOptTxtActive,
                                                ]}
                                             >
                                                {t}
                                             </Text>
                                          </TouchableOpacity>
                                       );
                                    })}
                                 </View>
                              </View>
                           )
                        ))
                     )}
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
                        disabled={actionLoading || !selectedRSlot}
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
            <KeyboardAvoidingView
               style={styles.modalOverlay}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
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
            </KeyboardAvoidingView>
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
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
   // `flexShrink: 1` (not `flex: 1`) — lets this area shrink down to fit
   // short content (e.g. the "no slots today" empty state) without leaving
   // a big gap above the buttons, but still caps itself at whatever room is
   // left inside modalContent's maxHeight so long slot lists scroll instead
   // of pushing the Discard/Reschedule buttons off-screen.
   modalScrollArea: { flexShrink: 1 },
   modalScrollContent: { paddingBottom: 4 },
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
   pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
   dateStripRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
   dateOpt: { minWidth: 56, borderWidth: 1.5, borderColor: '#eee', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', backgroundColor: '#fafafa' },
   dateOptActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   dateOptLabel: { fontSize: 11, color: '#777', fontWeight: '600' },
   dateOptLabelActive: { color: TEAL },
   dateOptTxt: { fontSize: 15, fontWeight: '700', color: '#333', marginTop: 2 },
   dateOptTxtActive: { color: TEAL },
   dateOptSub: { fontSize: 11, color: '#777', marginTop: 2 },
   dateOptSubActive: { color: TEAL, fontWeight: '500' },
   slotPeriodTxt: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
   timeOpt: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: '#eee', borderRadius: 8, backgroundColor: '#fafafa' },
   timeOptActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   timeOptBooked: { backgroundColor: '#f5f5f5', borderColor: '#eee' },
   timeOptTxt: { fontSize: 13, color: '#333', fontWeight: '500' },
   timeOptTxtActive: { color: TEAL, fontWeight: 'bold' },
   timeOptTxtBooked: { color: '#bbb' }
});
