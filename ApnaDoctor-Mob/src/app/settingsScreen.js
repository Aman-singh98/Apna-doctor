// ─── SettingsScreen (shared: doctor + patient) ────────────────────────────────
// Single settings screen used by both roles. Pass `role="doctor"` or
// `role="patient"` as a prop — wire this from wherever you currently know
// the logged-in user's role (e.g. an auth context/hook). Defaults to
// 'patient' if not provided.
//
// PHASE 1 — kept intentionally simple:
//   - No "Change Login PIN" row — login is OTP-only, there is no PIN.
//   - Toggles are local state only (not persisted to a backend yet).
//   - Role only changes WHICH rows render, not how the screen behaves.
//
// To use:
//   <SettingsScreen role="doctor" />
//   <SettingsScreen role="patient" />

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { requestAccountDeletion } from '../services/accountDeletion';
// NOTE: swap these for your patient-side equivalents if the function/module
// names differ — this mirrors clearAuthData() in utils/doctorAuth.js.
import { clearAuthData as clearDoctorAuthData } from '../utils/doctorAuth';

const TEAL = '#1A7E8A';

// ── Role-specific config ──────────────────────────────────────────────────────
// Everything that differs between doctor and patient lives here. The JSX
// below never branches on `role` directly — it just reads this object.
const ROLE_CONFIG = {
   doctor: {
      notificationItems: [
         { key: 'appointment', label: 'Appointment Alerts', icon: 'calendar-outline' },
         { key: 'payment', label: 'Payment Notifications', icon: 'cash-outline' },
         { key: 'review', label: 'Patient Reviews', icon: 'star-outline' },
         { key: 'sound', label: 'Sound & Vibrate', icon: 'volume-high-outline' },
      ],
      showAutoAccept: true,
      showBankAccount: true,
      deleteWarning:
         'This will permanently delete your profile, consultation history, earnings records, and prescriptions. This action cannot be undone.',
      footerLabel: 'ApnaDoctor Doctor App',
   },
   patient: {
      notificationItems: [
         { key: 'appointment', label: 'Appointment Alerts', icon: 'calendar-outline' },
         { key: 'prescription', label: 'Prescription & Report Updates', icon: 'document-text-outline' },
         { key: 'sound', label: 'Sound & Vibrate', icon: 'volume-high-outline' },
      ],
      showAutoAccept: false,
      showBankAccount: false,
      deleteWarning:
         'This will permanently delete your profile, consultation history, prescriptions, and health data. This action cannot be undone.',
      footerLabel: 'ApnaDoctor',
   },
};

export default function SettingsScreen({ role = 'patient' }) {
   const router = useRouter();
   const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.patient;

   // ── Notification toggles — built dynamically from config.notificationItems ──
   const [notifValues, setNotifValues] = useState(
      Object.fromEntries(config.notificationItems.map((item) => [item.key, true]))
   );
   const toggleNotif = (key) => setNotifValues((prev) => ({ ...prev, [key]: !prev[key] }));

   // ── Preference toggles ───────────────────────────────────────────────────────
   const [biometrics, setBiometrics] = useState(false);
   const [darkMode, setDarkMode] = useState(false);
   const [autoAccept, setAutoAccept] = useState(false);
   const [deleting, setDeleting] = useState(false);

   const handleDeleteAccount = () => {
      Alert.alert(
         'Delete Account Permanently',
         config.deleteWarning,
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete Account',
               style: 'destructive',
               onPress: async () => {
                  setDeleting(true);
                  try {
                     const data = await requestAccountDeletion(role);
                     // Grace-period soft-delete: account is now pending_deletion
                     // on the server. Log the device out locally — the account
                     // record itself isn't wiped until deletionScheduledAt passes.
                     await clearDoctorAuthData();
                     Alert.alert(
                        'Deletion Scheduled',
                        data.message || 'Your account will be permanently deleted after the grace period.',
                        [{ text: 'OK', onPress: () => router.replace('/') }]
                     );
                  } catch (err) {
                     const message =
                        err?.response?.data?.message ||
                        'Something went wrong submitting your deletion request. Please try again.';
                     Alert.alert('Could Not Delete Account', message);
                  } finally {
                     setDeleting(false);
                  }
               },
            },
         ]
      );
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>App Settings</Text>
            <View style={{ width: 40 }} />
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Account Settings ────────────────────────────────────────────────── */}
            <Text style={styles.groupHeader}>Account Settings</Text>
            <View style={styles.groupBg}>
               {config.showBankAccount && (
                  <TouchableOpacity
                     style={styles.row}
                     onPress={() => Alert.alert('Bank Account', 'Update your bank account details for payout transfers.')}
                  >
                     <View style={styles.left}>
                        <View style={styles.iconBg}><Ionicons name="card-outline" size={18} color={TEAL} /></View>
                        <Text style={styles.rowLabel}>Bank Account (Payouts)</Text>
                     </View>
                     <Ionicons name="chevron-forward" size={16} color="#ccc" />
                  </TouchableOpacity>
               )}
               <TouchableOpacity
                  style={[styles.row, styles.lastRow]}
                  onPress={() => Alert.alert('Linked Devices', 'Current Device: Active\nNo other devices linked.')}
               >
                  <View style={styles.left}>
                     <View style={styles.iconBg}><Ionicons name="desktop-outline" size={18} color={TEAL} /></View>
                     <Text style={styles.rowLabel}>Linked Devices</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
               </TouchableOpacity>
            </View>

            {/* ── Notification Settings ───────────────────────────────────────────── */}
            <Text style={styles.groupHeader}>Notification Settings</Text>
            <View style={styles.groupBg}>
               {config.notificationItems.map((item, idx) => (
                  <View
                     key={item.key}
                     style={[styles.row, idx === config.notificationItems.length - 1 && styles.lastRow]}
                  >
                     <View style={styles.left}>
                        <View style={styles.iconBg}><Ionicons name={item.icon} size={18} color={TEAL} /></View>
                        <Text style={styles.rowLabel}>{item.label}</Text>
                     </View>
                     <Switch
                        value={notifValues[item.key]}
                        onValueChange={() => toggleNotif(item.key)}
                        trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                        thumbColor={notifValues[item.key] ? TEAL : '#fafafa'}
                     />
                  </View>
               ))}
            </View>

            {/* ── Preferences ──────────────────────────────────────────────────────── */}
            <Text style={styles.groupHeader}>Preferences</Text>
            <View style={styles.groupBg}>
               <View style={styles.row}>
                  <View style={styles.left}>
                     <View style={styles.iconBg}><Ionicons name="finger-print-outline" size={18} color={TEAL} /></View>
                     <Text style={styles.rowLabel}>Biometric Login</Text>
                  </View>
                  <Switch
                     value={biometrics}
                     onValueChange={setBiometrics}
                     trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                     thumbColor={biometrics ? TEAL : '#fafafa'}
                  />
               </View>

               <View style={[styles.row, !config.showAutoAccept && styles.lastRow]}>
                  <View style={styles.left}>
                     <View style={styles.iconBg}><Ionicons name="moon-outline" size={18} color={TEAL} /></View>
                     <Text style={styles.rowLabel}>Dark Mode (Beta)</Text>
                  </View>
                  <Switch
                     value={darkMode}
                     onValueChange={setDarkMode}
                     trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                     thumbColor={darkMode ? TEAL : '#fafafa'}
                  />
               </View>

               {config.showAutoAccept && (
                  <View style={[styles.row, styles.lastRow]}>
                     <View style={styles.left}>
                        <View style={styles.iconBg}><Ionicons name="checkmark-circle-outline" size={18} color={TEAL} /></View>
                        <Text style={styles.rowLabel}>Auto-Accept Appointments</Text>
                     </View>
                     <Switch
                        value={autoAccept}
                        onValueChange={setAutoAccept}
                        trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                        thumbColor={autoAccept ? TEAL : '#fafafa'}
                     />
                  </View>
               )}
            </View>

            {/* ── Legal & Info ─────────────────────────────────────────────────────── */}
            <Text style={styles.groupHeader}>Legal & Info</Text>
            <View style={styles.groupBg}>
               <TouchableOpacity
                  style={styles.row}
                  onPress={() => Alert.alert('Privacy Policy', 'Displaying privacy policy.')}
               >
                  <View style={styles.left}>
                     <View style={styles.iconBg}><Ionicons name="document-text-outline" size={18} color={TEAL} /></View>
                     <Text style={styles.rowLabel}>Privacy Policy</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
               </TouchableOpacity>
               <TouchableOpacity
                  style={[styles.row, styles.lastRow]}
                  onPress={() => Alert.alert('Terms of Service', 'Displaying Terms of Service.')}
               >
                  <View style={styles.left}>
                     <View style={styles.iconBg}><Ionicons name="information-circle-outline" size={18} color={TEAL} /></View>
                     <Text style={styles.rowLabel}>Terms of Service</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
               </TouchableOpacity>
            </View>

            {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
            <Text style={styles.groupHeaderDanger}>Danger Zone</Text>
            <View style={[styles.groupBg, styles.dangerBg]}>
               <TouchableOpacity
                  style={[styles.row, styles.lastRow]}
                  onPress={handleDeleteAccount}
                  disabled={deleting}
               >
                  <View style={styles.left}>
                     <View style={[styles.iconBg, { backgroundColor: '#FCEBEB' }]}>
                        <Ionicons name="trash-outline" size={18} color="#E24B4A" />
                     </View>
                     <Text style={styles.rowLabelDanger}>Delete Account Permanently</Text>
                  </View>
                  {deleting ? (
                     <ActivityIndicator size="small" color="#E24B4A" />
                  ) : (
                     <Ionicons name="chevron-forward" size={16} color="#E24B4A" />
                  )}
               </TouchableOpacity>
            </View>

            <Text style={styles.footerTxt}>{config.footerLabel} · v1.0.0 (Build 20260622)</Text>
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   scroll: { padding: 16, paddingBottom: 40 },
   groupHeader: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
   groupHeaderDanger: { fontSize: 12, fontWeight: '700', color: '#E24B4A', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 8, marginLeft: 4 },
   groupBg: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   dangerBg: { borderColor: '#FCEBEB' },
   row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   lastRow: { borderBottomWidth: 0 },
   left: { flexDirection: 'row', alignItems: 'center' },
   iconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
   rowLabel: { fontSize: 13.5, fontWeight: '600', color: '#333' },
   rowLabelDanger: { fontSize: 13.5, fontWeight: '600', color: '#E24B4A' },
   footerTxt: { textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 32, marginBottom: 16 },
});
