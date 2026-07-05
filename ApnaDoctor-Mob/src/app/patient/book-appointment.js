import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFamilyMembers } from '../../services/familyMemberService';
import { bookAppointment } from '../../services/patientAppointmentService';
import { getAvailability, getDoctors } from '../../services/patientDoctorService';
import { getMyProfile } from '../../services/patientService';

const TEAL = '#1A7E8A';
const ACCENT = '#F5C27A';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Consultation modes — the fee for each is pulled from the doctor's own
// videoFee/chatFee. ASSUMPTION: Doctor has no separate audioFee field, so
// Audio calls are priced the same as Video. Adjust getModeFee() if your
// schema adds one.
const CONSULT_MODES = [
   { id: 'video', type: 'Video', label: 'Video Call', icon: 'videocam', desc: 'Face-to-face consult', scheduleKey: 'videoEnabled' },
   { id: 'audio', type: 'Audio', label: 'Audio Call', icon: 'call', desc: 'Voice consultation', scheduleKey: 'audioEnabled' },
   { id: 'chat', type: 'Chat', label: 'Chat', icon: 'chatbubbles', desc: 'Text & image sharing', scheduleKey: 'chatEnabled' },
];

function getModeFee(doctor, mode) {
   if (!doctor) return 0;
   if (mode.type === 'Chat') return doctor.chatFee || 0;
   return doctor.videoFee || 0; // Video and Audio share the same fee (see note above)
}

function initialsOf(name = '') {
   return name.replace(/^Dr\.?\s*/i, '').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'Dr';
}

function pad2(n) {
   return String(n).padStart(2, '0');
}

// Builds the next `n` days starting today, in the shape the date strip needs.
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
         full: `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
         iso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      });
   }
   return days;
}

// Buckets a time-string slot ("09:00 AM") into Morning/Afternoon/Evening for display.
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

function calcAge(dob) {
   if (!dob) return '';
   const d = new Date(dob);
   if (isNaN(d.getTime())) return typeof dob === 'string' ? dob : '';
   const diff = Date.now() - d.getTime();
   const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
   return `${years} Yrs`;
}

const STEPS = ['Doctor', 'Date & Time', 'Patient & Mode', 'Summary'];

export default function BookAppointmentScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const insets = useSafeAreaInsets();

   // Wizard step
   const [step, setStep] = useState(0);

   // Data loaded from the API
   const [doctors, setDoctors] = useState([]);
   const [familyMembers, setFamilyMembers] = useState([]);
   const [myProfile, setMyProfile] = useState(null);
   const [initialLoading, setInitialLoading] = useState(true);

   const dates = React.useMemo(() => buildNextDates(7), []);

   // Selections
   const [selectedDoc, setSelectedDoc] = useState(null);
   const [selectedDate, setSelectedDate] = useState(dates[0]);
   const [selectedSlot, setSelectedSlot] = useState(null);
   const [selectedMode, setSelectedMode] = useState(CONSULT_MODES[0]);
   const [selectedPatientId, setSelectedPatientId] = useState(null);
   const [isBooked, setIsBooked] = useState(false);
   const [bookingLoading, setBookingLoading] = useState(false);

   // Availability for the selected doctor + date
   const [activeSlots, setActiveSlots] = useState([]);
   const [bookedSlots, setBookedSlots] = useState([]);
   const [slotsLoading, setSlotsLoading] = useState(false);

   // NOTE: `name` here must stay the REAL profile/family name (or null if not
   // loaded yet) — it's what gets sent to the API as `patientName`. Never put
   // a placeholder like "Myself" in this field; use the `displayName` helper
   // below for anything rendered in the UI instead.
   const patients = [
      { id: 'self', kind: 'self', name: myProfile?.name || null, relation: 'Self', age: calcAge(myProfile?.dob) },
      ...familyMembers?.map(f => ({ id: f._id, kind: 'family', name: f.name, relation: f.relation, age: f.age })),
   ];

   // Display-only fallback so the UI still shows something sensible while
   // the profile is loading — this must NEVER be sent to the API.
   const displayName = (p) => p?.name || 'Myself';

   // Always derived fresh from the current `patients` array (by id), so it
   // automatically picks up the real name once myProfile/familyMembers load
   // — instead of being frozen to whatever was true the moment it was picked.
   const selectedPatient = patients.find(p => p.id === selectedPatientId) || null;

   // ── Initial load: doctors, family members, own profile ──────────────
   useEffect(() => {
      (async () => {
         try {
            setInitialLoading(true);
            const [doctorList, familyList, profile] = await Promise.all([
               getDoctors(),
               getFamilyMembers(),
               getMyProfile(),
            ]);
            setDoctors(doctorList);
            setFamilyMembers(familyList?.data ?? []);
            console.log(profile, "profile");
            setMyProfile(profile);

            const preselected = params.docId ? doctorList.find(d => d._id === params.docId) : null;
            setSelectedDoc(preselected || doctorList[0] || null);
         } catch (err) {
            Alert.alert('Error', 'Could not load booking details. Please try again.');
         } finally {
            setInitialLoading(false);
         }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Default the patient selector once profile/family data is in
   useEffect(() => {
      if (!selectedPatientId && patients.length > 0) {
         setSelectedPatientId(patients[0].id);
      }
   }, [patients, selectedPatientId]);

   // Reset the consult mode to one the selected doctor actually offers
   useEffect(() => {
      if (!selectedDoc) return;
      const stillValid = selectedDoc.schedule?.[selectedMode.scheduleKey];
      if (!stillValid) {
         const firstAvailable = CONSULT_MODES.find(m => selectedDoc.schedule?.[m.scheduleKey]);
         if (firstAvailable) setSelectedMode(firstAvailable);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedDoc]);

   // ── Fetch availability whenever doctor or date changes ───────────────
   useEffect(() => {
      if (!selectedDoc || !selectedDate) return;
      (async () => {
         try {
            setSlotsLoading(true);
            setSelectedSlot(null);
            const result = await getAvailability(selectedDoc._id, selectedDate.iso);
            setActiveSlots(result.activeSlots || []);
            setBookedSlots(result.bookedSlots || []);
         } catch (err) {
            Alert.alert('Error', 'Could not load available time slots.');
            setActiveSlots([]);
            setBookedSlots([]);
         } finally {
            setSlotsLoading(false);
         }
      })();
   }, [selectedDoc, selectedDate]);

   const totalFee = selectedDoc ? getModeFee(selectedDoc, selectedMode) : 0;

   const goNext = () => {
      if (step === 1 && !selectedSlot) {
         Alert.alert('Select Time', 'Please select a time slot to continue.');
         return;
      }
      if (step < STEPS.length - 1) setStep(step + 1);
   };

   const goBack = () => {
      if (step > 0) setStep(step - 1);
      else router.back();
   };

   const [bookedApptInfo, setBookedApptInfo] = useState(null);

   const confirmBooking = async () => {
      if (!selectedSlot) {
         Alert.alert('Select Time', 'Please select a time slot before confirming.');
         setStep(1);
         return;
      }
      const isoDateTime = combineDateAndSlot(selectedDate.iso, selectedSlot);
      if (!isoDateTime) {
         Alert.alert('Error', 'Please choose a valid date and time.');
         return;
      }
      if (!selectedPatient?.name) {
         Alert.alert(
            'Profile Incomplete',
            'We could not find a name for the selected patient. Please update your profile (or the family member) before booking.'
         );
         return;
      }
      try {
         setBookingLoading(true);
         const payload = {
            doctorId: selectedDoc._id,
            date: isoDateTime,
            type: selectedMode.type,
            fee: totalFee,
            patientName: selectedPatient?.name,
         };
         if (selectedPatient?.kind === 'family') {
            payload.familyMemberId = selectedPatient.id;
         }
         const created = await bookAppointment(payload);
         setBookedApptInfo(created);
         setIsBooked(true);
      } catch (err) {
         Alert.alert('Error', err?.response?.data?.message || 'Could not book the appointment. Please try again.');
      } finally {
         setBookingLoading(false);
      }
   };

   // ─── Step Progress ──────────────────────────────────────────
   const renderProgress = () => (
      <View style={styles.progressBar}>
         {STEPS.map((s, i) => (
            <React.Fragment key={s}>
               <View style={styles.progressStep}>
                  <View style={[
                     styles.progressDot,
                     i <= step && styles.progressDotActive,
                     i < step && styles.progressDotDone,
                  ]}>
                     {i < step
                        ? <Ionicons name="checkmark" size={12} color="#fff" />
                        : <Text style={[styles.progressNum, i <= step && styles.progressNumActive]}>{i + 1}</Text>
                     }
                  </View>
                  <Text style={[styles.progressLabel, i === step && styles.progressLabelActive]}>{s}</Text>
               </View>
               {i < STEPS.length - 1 && (
                  <View style={[styles.progressLine, i < step && styles.progressLineDone]} />
               )}
            </React.Fragment>
         ))}
      </View>
   );

   // ─── Initial Loading / Empty States ────────────────────────────
   if (initialLoading) {
      return (
         <SafeAreaView style={styles.safe}>
            <View style={styles.successContainer}>
               <ActivityIndicator size="large" color={TEAL} />
            </View>
         </SafeAreaView>
      );
   }

   if (!selectedDoc) {
      return (
         <SafeAreaView style={styles.safe}>
            <View style={styles.topBar}>
               <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
               </TouchableOpacity>
               <Text style={styles.barTitle}>Book Appointment</Text>
               <View style={{ width: 40 }} />
            </View>
            <View style={styles.successContainer}>
               <Ionicons name="medical-outline" size={60} color="#ccc" />
               <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>No doctors are currently available for booking.</Text>
            </View>
         </SafeAreaView>
      );
   }

   // ─── Success Screen ──────────────────────────────────────────
   if (isBooked) {
      return (
         <SafeAreaView style={styles.safe}>
            <View style={styles.successContainer}>
               <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={80} color="#1D9E75" />
               </View>
               <Text style={styles.successTitle}>Appointment Booked!</Text>
               <Text style={styles.successSub}>Your appointment has been confirmed</Text>

               <View style={styles.successCard}>
                  <View style={styles.successRow}>
                     <Ionicons name="person-outline" size={16} color="#666" style={{ marginRight: 8 }} />
                     <Text style={styles.successLabel}>Doctor</Text>
                     <Text style={styles.successVal}>{selectedDoc.name}</Text>
                  </View>
                  <View style={styles.successRow}>
                     <Ionicons name="calendar-outline" size={16} color="#666" style={{ marginRight: 8 }} />
                     <Text style={styles.successLabel}>Date</Text>
                     <Text style={styles.successVal}>{selectedDate.full}</Text>
                  </View>
                  <View style={styles.successRow}>
                     <Ionicons name="time-outline" size={16} color="#666" style={{ marginRight: 8 }} />
                     <Text style={styles.successLabel}>Time</Text>
                     <Text style={styles.successVal}>{selectedSlot}</Text>
                  </View>
                  <View style={styles.successRow}>
                     <Ionicons name={selectedMode.icon} size={16} color="#666" style={{ marginRight: 8 }} />
                     <Text style={styles.successLabel}>Mode</Text>
                     <Text style={styles.successVal}>{selectedMode.label}</Text>
                  </View>
                  <View style={[styles.successRow, { borderBottomWidth: 0 }]}>
                     <Ionicons name="card-outline" size={16} color="#666" style={{ marginRight: 8 }} />
                     <Text style={styles.successLabel}>Amount Paid</Text>
                     <Text style={[styles.successVal, { color: TEAL, fontWeight: 'bold' }]}>₹{totalFee}</Text>
                  </View>
               </View>

               <TouchableOpacity
                  style={styles.successBtn}
                  onPress={() => router.replace('/patient/dashboard')}
               >
                  <Text style={styles.successBtnTxt}>Back to Home</Text>
               </TouchableOpacity>
               <TouchableOpacity
                  style={styles.successBtnOutline}
                  onPress={() => router.replace('/patient/appointments')}
               >
                  <Text style={styles.successBtnOutlineTxt}>View My Appointments</Text>
               </TouchableOpacity>
            </View>
         </SafeAreaView>
      );
   }

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         {/* Top bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={goBack} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Book Appointment</Text>
            <View style={{ width: 40 }} />
         </View>

         {/* Step Progress */}
         {renderProgress()}

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* ── STEP 0: Choose Doctor ── */}
            {step === 0 && (
               <View>
                  <Text style={styles.stepHeading}>Select Doctor</Text>
                  <Text style={styles.stepSub}>Choose a doctor for your consultation</Text>

                  {doctors.map(doc => {
                     const isSel = selectedDoc._id === doc._id;
                     return (
                        <TouchableOpacity
                           key={doc._id}
                           style={[styles.docCard, isSel && styles.docCardActive]}
                           onPress={() => setSelectedDoc(doc)}
                        >
                           <View style={[styles.docInitialBg, isSel && styles.docInitialBgActive]}>
                              <Text style={[styles.docInitialTxt, isSel && styles.docInitialTxtActive]}>
                                 {initialsOf(doc.name)}
                              </Text>
                           </View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={[styles.docName, isSel && styles.docNameActive]}>Dr. {doc.name}</Text>
                              <Text style={styles.docSpec}>{doc.specialization}</Text>
                              <View style={styles.docMeta}>
                                 <Ionicons name="star" size={12} color="#F5C27A" />
                                 <Text style={styles.docMetaTxt}>{doc.rating || '—'}  ·  ₹{doc.videoFee} fee</Text>
                              </View>
                           </View>
                           <View style={[styles.radioOuter, isSel && styles.radioOuterActive]}>
                              {isSel && <View style={styles.radioInner} />}
                           </View>
                        </TouchableOpacity>
                     );
                  })}
               </View>
            )}

            {/* ── STEP 1: Date & Time ── */}
            {step === 1 && (
               <View>
                  <Text style={styles.stepHeading}>Choose Date & Time</Text>
                  <Text style={styles.stepSub}>Select a convenient slot for your consultation</Text>

                  {/* Date strip */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
                     {dates.map(d => {
                        const isSel = selectedDate.iso === d.iso;
                        return (
                           <TouchableOpacity
                              key={d.iso}
                              style={[styles.dateCard, isSel && styles.dateCardActive]}
                              onPress={() => setSelectedDate(d)}
                           >
                              {d.label ? (
                                 <Text style={[styles.dateLabelTxt, isSel && styles.dateLabelTxtActive]}>{d.label}</Text>
                              ) : <View style={{ height: 16 }} />}
                              <Text style={[styles.dateDay, isSel && styles.dateDayActive]}>{d.date}</Text>
                              <Text style={[styles.dateNum, isSel && styles.dateNumActive]}>{d.num}</Text>
                           </TouchableOpacity>
                        );
                     })}
                  </ScrollView>

                  {/* Time slots */}
                  {slotsLoading ? (
                     <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={TEAL} />
                     </View>
                  ) : activeSlots.length === 0 ? (
                     <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                        <Ionicons name="calendar-outline" size={36} color="#ccc" />
                        <Text style={{ marginTop: 8, color: '#999', fontSize: 13 }}>Doctor isn't available on this day.</Text>
                     </View>
                  ) : (
                     Object.entries(groupSlotsByPeriod(activeSlots)).map(([period, slots]) => (
                        slots.length === 0 ? null : (
                           <View key={period} style={styles.slotSection}>
                              <View style={styles.slotPeriodHeader}>
                                 <Ionicons
                                    name={period === 'Morning' ? 'sunny-outline' : period === 'Afternoon' ? 'partly-sunny-outline' : 'moon-outline'}
                                    size={16}
                                    color="#666"
                                    style={{ marginRight: 6 }}
                                 />
                                 <Text style={styles.slotPeriodTxt}>{period}</Text>
                              </View>
                              <View style={styles.slotGrid}>
                                 {slots.map(slot => {
                                    const isSlotBooked = bookedSlots.includes(slot);
                                    const isSel = selectedSlot === slot;
                                    return (
                                       <TouchableOpacity
                                          key={slot}
                                          style={[
                                             styles.slotChip,
                                             isSlotBooked && styles.slotChipBooked,
                                             isSel && styles.slotChipActive,
                                          ]}
                                          disabled={isSlotBooked}
                                          onPress={() => setSelectedSlot(slot)}
                                       >
                                          <Text style={[
                                             styles.slotChipTxt,
                                             isSlotBooked && styles.slotChipTxtBooked,
                                             isSel && styles.slotChipTxtActive,
                                          ]}>
                                             {slot}
                                          </Text>
                                       </TouchableOpacity>
                                    );
                                 })}
                              </View>
                           </View>
                        )
                     ))
                  )}

                  {/* Legend */}
                  <View style={styles.legend}>
                     <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1 }]} />
                        <Text style={styles.legendTxt}>Available</Text>
                     </View>
                     <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
                        <Text style={styles.legendTxt}>Selected</Text>
                     </View>
                     <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#f0f0f0', borderColor: '#eee', borderWidth: 1 }]} />
                        <Text style={styles.legendTxt}>Booked</Text>
                     </View>
                  </View>
               </View>
            )}

            {/* ── STEP 2: Patient & Mode ── */}
            {step === 2 && (
               <View>
                  <Text style={styles.stepHeading}>Patient & Consultation Mode</Text>
                  <Text style={styles.stepSub}>Who is this appointment for?</Text>

                  {/* Patient Selector */}
                  <View style={styles.cardGroup}>
                     {patients.map(p => {
                        const isSel = selectedPatient?.id === p.id;
                        return (
                           <TouchableOpacity
                              key={p.id}
                              style={[styles.patientRow, isSel && styles.patientRowActive]}
                              onPress={() => setSelectedPatientId(p.id)}
                           >
                              <View style={styles.patientAvatar}>
                                 <Text style={styles.patientAvatarTxt}>{displayName(p)[0]}</Text>
                              </View>
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                 <Text style={[styles.patientName, isSel && styles.patientNameActive]}>{displayName(p)}</Text>
                                 <Text style={styles.patientMeta}>{p.relation}{p.age ? ` · ${p.age}` : ''}</Text>
                              </View>
                              <View style={[styles.radioOuter, isSel && styles.radioOuterActive]}>
                                 {isSel && <View style={styles.radioInner} />}
                              </View>
                           </TouchableOpacity>
                        );
                     })}
                  </View>

                  <Text style={[styles.stepSub, { marginTop: 20, marginBottom: 10 }]}>Consultation Mode</Text>
                  {CONSULT_MODES.filter(m => selectedDoc.schedule?.[m.scheduleKey]).map(m => {
                     const isSel = selectedMode.id === m.id;
                     const modeFee = getModeFee(selectedDoc, m);
                     return (
                        <TouchableOpacity
                           key={m.id}
                           style={[styles.modeCard, isSel && styles.modeCardActive]}
                           onPress={() => setSelectedMode(m)}
                        >
                           <View style={[styles.modeIcon, isSel && styles.modeIconActive]}>
                              <Ionicons name={m.icon} size={22} color={isSel ? '#fff' : TEAL} />
                           </View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={[styles.modeLabel, isSel && styles.modeLabelActive]}>{m.label}</Text>
                              <Text style={styles.modeDesc}>{m.desc}</Text>
                           </View>
                           <View style={styles.modeFeeBadge}>
                              <Text style={[styles.modeFeeTxt, isSel && styles.modeFeeTxtActive]}>₹{modeFee}</Text>
                           </View>
                           <View style={[styles.radioOuter, isSel && styles.radioOuterActive, { marginLeft: 10 }]}>
                              {isSel && <View style={styles.radioInner} />}
                           </View>
                        </TouchableOpacity>
                     );
                  })}
               </View>
            )}

            {/* ── STEP 3: Summary ── */}
            {step === 3 && (
               <View>
                  <Text style={styles.stepHeading}>Booking Summary</Text>
                  <Text style={styles.stepSub}>Review before confirming your appointment</Text>

                  {/* Summary Card */}
                  <View style={styles.summaryCard}>
                     <View style={styles.summaryDocHeader}>
                        <View style={styles.summaryDocAvatar}>
                           <Text style={styles.summaryDocAvatarTxt}>{initialsOf(selectedDoc.name)}</Text>
                        </View>
                        <View>
                           <Text style={styles.summaryDocName}>Dr. {selectedDoc.name}</Text>
                           <Text style={styles.summaryDocSpec}>{selectedDoc.specialization}</Text>
                        </View>
                     </View>

                     <View style={styles.summaryDivider} />

                     {[
                        { label: 'For Patient', val: selectedPatient?.name, sub: selectedPatient?.relation },
                        { label: 'Date', val: selectedDate.full },
                        { label: 'Time', val: selectedSlot },
                        { label: 'Mode', val: selectedMode.label },
                     ].map(r => (
                        <View key={r.label} style={styles.summaryRow}>
                           <Text style={styles.summaryLabel}>{r.label}</Text>
                           <View style={styles.summaryValWrap}>
                              <Text style={styles.summaryVal}>{r.val}</Text>
                              {r.sub && <Text style={styles.summaryValSub}> ({r.sub})</Text>}
                           </View>
                        </View>
                     ))}
                  </View>

                  {/* Fee breakdown */}
                  <View style={styles.feeCard}>
                     <Text style={styles.feeTitle}>Fee Breakdown</Text>
                     <View style={styles.feeRow}>
                        <Text style={styles.feeLbl}>{selectedMode.label} Consultation Fee</Text>
                        <Text style={styles.feeAmt}>₹{totalFee}</Text>
                     </View>
                     <View style={styles.feeRow}>
                        <Text style={styles.feeLbl}>Platform Fee</Text>
                        <Text style={styles.feeAmt}>₹0</Text>
                     </View>
                     <View style={[styles.feeRow, styles.feeTotalRow]}>
                        <Text style={styles.feeTotalLbl}>Total Payable</Text>
                        <Text style={styles.feeTotalAmt}>₹{totalFee}</Text>
                     </View>
                  </View>

                  {/* Payment Methods */}
                  <Text style={styles.stepSub}>Pay via</Text>
                  <View style={styles.payMethods}>
                     {[
                        { icon: 'qr-code-outline', label: 'UPI / QR Code' },
                        { icon: 'card-outline', label: 'Card' },
                        { icon: 'wallet-outline', label: 'Net Banking' },
                     ].map((pm, i) => (
                        <View key={i} style={styles.payChip}>
                           <Ionicons name={pm.icon} size={16} color={TEAL} style={{ marginRight: 5 }} />
                           <Text style={styles.payChipTxt}>{pm.label}</Text>
                        </View>
                     ))}
                  </View>

                  <TouchableOpacity
                     style={[styles.confirmBtn, bookingLoading && { opacity: 0.7 }]}
                     onPress={confirmBooking}
                     disabled={bookingLoading}
                  >
                     {bookingLoading ? (
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                     ) : (
                        <Ionicons name="lock-closed" size={16} color="#fff" style={{ marginRight: 8 }} />
                     )}
                     <Text style={styles.confirmBtnTxt}>{bookingLoading ? 'Booking...' : `Pay ₹${totalFee} & Confirm`}</Text>
                  </TouchableOpacity>

                  <Text style={styles.refundHint}>
                     Free cancellation up to 2 hours before appointment. Refund in 3–5 business days.
                  </Text>
               </View>
            )}
         </ScrollView>

         {/* Bottom Action Bar */}
         {step < 3 && (
            <View
               style={[
                  styles.bottomBar,
                  {
                     paddingBottom: Math.max(insets.bottom, 16),
                  },
               ]}
            >
               {step > 0 && (
                  <TouchableOpacity style={styles.prevBtn} onPress={goBack}>
                     <Ionicons name="arrow-back" size={18} color={TEAL} style={{ marginRight: 6 }} />
                     <Text style={styles.prevBtnTxt}>Back</Text>
                  </TouchableOpacity>
               )}
               <TouchableOpacity style={[styles.nextBtn, step === 0 && { flex: 1 }]} onPress={goNext}>
                  <Text style={styles.nextBtnTxt}>
                     {step === 2 ? 'Review Summary' : 'Continue'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
               </TouchableOpacity>
            </View>
         )}
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },

   // Progress
   progressBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
   progressStep: { alignItems: 'center', flex: 1 },
   progressDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
   progressDotActive: { backgroundColor: '#E8F5F7', borderWidth: 2, borderColor: TEAL },
   progressDotDone: { backgroundColor: TEAL, borderColor: TEAL },
   progressNum: { fontSize: 11, fontWeight: '700', color: '#aaa' },
   progressNumActive: { color: TEAL },
   progressLabel: { fontSize: 10, color: '#aaa', fontWeight: '600' },
   progressLabelActive: { color: TEAL },
   progressLine: { flex: 1, height: 2, backgroundColor: '#eee', marginBottom: 18, marginHorizontal: 2 },
   progressLineDone: { backgroundColor: TEAL },

   scroll: { padding: 16, paddingBottom: 100 },
   stepHeading: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
   stepSub: { fontSize: 13, color: '#666', marginBottom: 18, lineHeight: 19 },

   // Doctor Step
   docCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: '#f0f0f0', elevation: 1 },
   docCardActive: { borderColor: TEAL, backgroundColor: '#F0FAFA' },
   docInitialBg: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   docInitialBgActive: { backgroundColor: TEAL },
   docInitialTxt: { fontSize: 16, fontWeight: 'bold', color: TEAL },
   docInitialTxtActive: { color: '#fff' },
   docName: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   docNameActive: { color: TEAL },
   docSpec: { fontSize: 12, color: '#666', marginTop: 2 },
   docMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
   docMetaTxt: { fontSize: 12, color: '#888', fontWeight: '500', marginLeft: 4 },
   radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
   radioOuterActive: { borderColor: TEAL },
   radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: TEAL },

   // Date Strip
   dateStrip: { paddingVertical: 4, paddingHorizontal: 2, gap: 8, marginBottom: 20 },
   dateCard: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#f0f0f0', minWidth: 60 },
   dateCardActive: { backgroundColor: TEAL, borderColor: TEAL },
   dateLabelTxt: { fontSize: 10, color: '#1D9E75', fontWeight: '700', marginBottom: 4 },
   dateLabelTxtActive: { color: '#CBEBE3' },
   dateDay: { fontSize: 12, color: '#888', fontWeight: '600' },
   dateDayActive: { color: '#CBEBE3' },
   dateNum: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginTop: 2 },
   dateNumActive: { color: '#fff' },

   // Time Slots
   slotSection: { marginBottom: 18 },
   slotPeriodHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
   slotPeriodTxt: { fontSize: 13, fontWeight: '700', color: '#555' },
   slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   slotChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eee' },
   slotChipActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   slotChipBooked: { backgroundColor: '#f5f5f5', borderColor: '#eee' },
   slotChipTxt: { fontSize: 13, fontWeight: '600', color: '#333' },
   slotChipTxtActive: { color: TEAL },
   slotChipTxtBooked: { color: '#bbb' },

   legend: { flexDirection: 'row', gap: 16, marginTop: 8, justifyContent: 'center' },
   legendItem: { flexDirection: 'row', alignItems: 'center' },
   legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 5 },
   legendTxt: { fontSize: 11, color: '#888' },

   // Patient & Mode Step
   cardGroup: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0', backgroundColor: '#fff', marginBottom: 16, elevation: 1 },
   patientRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   patientRowActive: { backgroundColor: '#F0FAFA' },
   patientAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   patientAvatarTxt: { fontSize: 14, fontWeight: 'bold', color: TEAL },
   patientName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
   patientNameActive: { color: TEAL },
   patientMeta: { fontSize: 12, color: '#888', marginTop: 2 },
   modeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: '#f0f0f0', elevation: 1 },
   modeCardActive: { borderColor: TEAL, backgroundColor: '#F0FAFA' },
   modeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   modeIconActive: { backgroundColor: TEAL },
   modeLabel: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
   modeLabelActive: { color: TEAL },
   modeDesc: { fontSize: 12, color: '#888', marginTop: 2 },
   modeFeeBadge: { backgroundColor: '#f0f2f5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
   modeFeeTxt: { fontSize: 11, fontWeight: '700', color: '#555' },
   modeFeeTxtActive: { color: TEAL },

   // Summary Step
   summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   summaryDocHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
   summaryDocAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
   summaryDocAvatarTxt: { fontSize: 16, fontWeight: 'bold', color: TEAL },
   summaryDocName: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   summaryDocSpec: { fontSize: 12, color: '#666', marginTop: 2 },
   summaryDivider: { height: 1, backgroundColor: '#f5f5f5', marginBottom: 14 },
   summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   summaryLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
   summaryValWrap: { flexDirection: 'row', alignItems: 'center' },
   summaryVal: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   summaryValSub: { fontSize: 11, color: '#888' },

   feeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 },
   feeTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
   feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   feeLbl: { fontSize: 13, color: '#666' },
   feeAmt: { fontSize: 13, fontWeight: '600', color: '#333' },
   feeTotalRow: { borderBottomWidth: 0, paddingTop: 12, marginTop: 4 },
   feeTotalLbl: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   feeTotalAmt: { fontSize: 18, fontWeight: 'bold', color: TEAL },

   payMethods: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20, marginTop: 8 },
   payChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
   payChipTxt: { fontSize: 12, color: '#555', fontWeight: '600' },

   confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, elevation: 2, marginBottom: 12 },
   confirmBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   refundHint: { textAlign: 'center', fontSize: 11, color: '#999', lineHeight: 16 },

   // Bottom bar
   bottomBar: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', position: 'absolute', bottom: 0, left: 0, right: 0 },
   prevBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: TEAL, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
   prevBtnTxt: { fontSize: 14, fontWeight: 'bold', color: TEAL },
   nextBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14 },
   nextBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

   // Success
   successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fbfc' },
   successIcon: { marginBottom: 20 },
   successTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
   successSub: { fontSize: 14, color: '#666', marginBottom: 28 },
   successCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 28, elevation: 2 },
   successRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   successLabel: { fontSize: 13, color: '#888', flex: 1 },
   successVal: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   successBtn: { width: '100%', backgroundColor: TEAL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
   successBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   successBtnOutline: { width: '100%', borderWidth: 1.5, borderColor: TEAL, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
   successBtnOutlineTxt: { color: TEAL, fontSize: 14, fontWeight: 'bold' },
});
