import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   ScrollView,
   StatusBar,
   StyleSheet,
   Switch,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSchedule, updateSchedule } from '../../services/dashboardService';

const TEAL = '#1A7E8A';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

export default function DoctorScheduleScreen() {
   const router = useRouter();

   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [isDefault, setIsDefault] = useState(false);

   const [activeDays, setActiveDays] = useState([]);
   const [activeSlots, setActiveSlots] = useState([]);
   const [videoEnabled, setVideoEnabled] = useState(true);
   const [audioEnabled, setAudioEnabled] = useState(true);
   const [chatEnabled, setChatEnabled] = useState(true);
   const [maxPatients, setMaxPatients] = useState(12);

   useEffect(() => {
      let isMounted = true;
      (async () => {
         try {
            const { schedule, isDefault: fromDefault } = await getSchedule();
            if (!isMounted) return;
            setActiveDays(schedule.activeDays);
            setActiveSlots(schedule.activeSlots);
            setVideoEnabled(schedule.videoEnabled);
            setAudioEnabled(schedule.audioEnabled);
            setChatEnabled(schedule.chatEnabled);
            setMaxPatients(schedule.maxPatients);
            setIsDefault(fromDefault);
         } catch (err) {
            Alert.alert('Error', 'Could not load your schedule. Please try again.');
         } finally {
            if (isMounted) setLoading(false);
         }
      })();
      return () => { isMounted = false; };
   }, []);

   const toggleDay = (day) => {
      setActiveDays(prev =>
         prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      );
   };

   const toggleSlot = (slot) => {
      setActiveSlots(prev =>
         prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
      );
   };

   const handleSave = async () => {
      if (saving) return;

      if (activeDays.length === 0) {
         return Alert.alert('Select working days', 'Please select at least one working day.');
      }
      if (activeSlots.length === 0) {
         return Alert.alert('Select time slots', 'Please select at least one time slot.');
      }
      if (!videoEnabled && !audioEnabled && !chatEnabled) {
         return Alert.alert('Select consultation type', 'Please enable at least one consultation type.');
      }

      setSaving(true);
      try {
         const { schedule } = await updateSchedule({
            activeDays,
            activeSlots,
            videoEnabled,
            audioEnabled,
            chatEnabled,
            maxPatients,
         });
         setIsDefault(false);
         Alert.alert('Schedule Saved', 'Your availability schedule has been updated.', [
            { text: 'OK', onPress: () => router.back() },
         ]);
      } catch (err) {
         Alert.alert(
            'Error',
            err?.response?.data?.message || 'Could not save your schedule. Please try again.'
         );
      } finally {
         setSaving(false);
      }
   };

   if (loading) {
      return (
         <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={TEAL} />
         </SafeAreaView>
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
            <Text style={styles.barTitle}>Availability Schedule</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
               {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
               ) : (
                  <Text style={styles.saveBtnTxt}>Save</Text>
               )}
            </TouchableOpacity>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {isDefault && (
               <View style={styles.defaultBanner}>
                  <Ionicons name="information-circle-outline" size={16} color="#8a6d3b" style={{ marginRight: 6 }} />
                  <Text style={styles.defaultBannerTxt}>
                     Showing a default schedule. Save to make it active.
                  </Text>
               </View>
            )}

            {/* Working Days */}
            <Text style={styles.groupLabel}>Working Days</Text>
            <View style={styles.groupBg}>
               <View style={styles.daysRow}>
                  {DAYS.map(day => (
                     <TouchableOpacity
                        key={day}
                        style={[styles.dayChip, activeDays.includes(day) && styles.dayChipActive]}
                        onPress={() => toggleDay(day)}
                     >
                        <Text style={[styles.dayChipTxt, activeDays.includes(day) && styles.dayChipTxtActive]}>
                           {day}
                        </Text>
                     </TouchableOpacity>
                  ))}
               </View>
               <Text style={styles.subNote}>
                  {activeDays.length} days selected · Tap to toggle
               </Text>
            </View>

            {/* Time Slots */}
            <Text style={styles.groupLabel}>Available Time Slots</Text>
            <View style={styles.groupBg}>
               <View style={styles.slotsGrid}>
                  {SLOTS.map(slot => (
                     <TouchableOpacity
                        key={slot}
                        style={[styles.slotChip, activeSlots.includes(slot) && styles.slotChipActive]}
                        onPress={() => toggleSlot(slot)}
                     >
                        <Ionicons
                           name="time-outline"
                           size={12}
                           color={activeSlots.includes(slot) ? TEAL : '#aaa'}
                           style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.slotTxt, activeSlots.includes(slot) && styles.slotTxtActive]}>
                           {slot}
                        </Text>
                     </TouchableOpacity>
                  ))}
               </View>
               <Text style={styles.subNote}>
                  {activeSlots.length} slots active per working day
               </Text>
            </View>

            {/* Consultation Types */}
            <Text style={styles.groupLabel}>Consultation Types</Text>
            <View style={styles.groupBg}>
               {[
                  { label: 'Video Consultation', icon: 'videocam-outline', value: videoEnabled, setter: setVideoEnabled },
                  { label: 'Audio Consultation', icon: 'call-outline', value: audioEnabled, setter: setAudioEnabled },
                  { label: 'Chat Consultation', icon: 'chatbubbles-outline', value: chatEnabled, setter: setChatEnabled },
               ].map((row, idx, arr) => (
                  <View key={row.label} style={[styles.toggleRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                     <View style={styles.toggleLeft}>
                        <View style={styles.toggleIconBg}>
                           <Ionicons name={row.icon} size={18} color={TEAL} />
                        </View>
                        <Text style={styles.toggleLabel}>{row.label}</Text>
                     </View>
                     <Switch
                        value={row.value}
                        onValueChange={row.setter}
                        trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                        thumbColor={row.value ? TEAL : '#fafafa'}
                     />
                  </View>
               ))}
            </View>

            {/* Max Patients */}
            <Text style={styles.groupLabel}>Max Patients Per Day</Text>
            <View style={styles.groupBg}>
               <View style={styles.counterRow}>
                  <View style={styles.counterLeft}>
                     <View style={styles.toggleIconBg}>
                        <Ionicons name="people-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.toggleLabel}>Daily Limit</Text>
                  </View>
                  <View style={styles.counterControls}>
                     <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => setMaxPatients(prev => Math.max(1, prev - 1))}
                     >
                        <Ionicons name="remove" size={18} color={TEAL} />
                     </TouchableOpacity>
                     <Text style={styles.counterVal}>{maxPatients}</Text>
                     <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => setMaxPatients(prev => prev + 1)}
                     >
                        <Ionicons name="add" size={18} color={TEAL} />
                     </TouchableOpacity>
                  </View>
               </View>
            </View>

            {/* Summary */}
            <View style={styles.summaryCard}>
               <Ionicons name="information-circle-outline" size={18} color={TEAL} style={{ marginRight: 8 }} />
               <Text style={styles.summaryTxt}>
                  You are available {activeDays.length} days a week with {activeSlots.length} slots/day. Max {maxPatients} patients daily.
               </Text>
            </View>

            <TouchableOpacity style={styles.saveFullBtn} onPress={handleSave} disabled={saving}>
               {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
               ) : (
                  <Text style={styles.saveFullBtnTxt}>Save Schedule</Text>
               )}
            </TouchableOpacity>
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   saveBtn: { backgroundColor: TEAL, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
   saveBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   scroll: { padding: 16, paddingBottom: 40 },
   groupLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
   groupBg: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   daysRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
   dayChip: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: '#eee', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
   dayChipActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   dayChipTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
   dayChipTxtActive: { color: TEAL },
   subNote: { fontSize: 12, color: '#aaa', marginTop: 10 },
   slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   slotChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#eee', backgroundColor: '#fafafa' },
   slotChipActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   slotTxt: { fontSize: 12, fontWeight: '600', color: '#888' },
   slotTxtActive: { color: TEAL },
   toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   toggleLeft: { flexDirection: 'row', alignItems: 'center' },
   toggleIconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
   toggleLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
   counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   counterLeft: { flexDirection: 'row', alignItems: 'center' },
   counterControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
   counterBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: TEAL, alignItems: 'center', justifyContent: 'center' },
   counterVal: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', minWidth: 28, textAlign: 'center' },
   summaryCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#E8F5F7', borderRadius: 12, padding: 14, marginTop: 20 },
   summaryTxt: { flex: 1, fontSize: 13, color: '#085041', lineHeight: 20 },
   saveFullBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   saveFullBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   defaultBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF5E7', borderRadius: 10, padding: 10, marginBottom: 10 },
   defaultBannerTxt: { flex: 1, fontSize: 12, color: '#8a6d3b' }
});
