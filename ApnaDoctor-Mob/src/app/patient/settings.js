import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
   Alert,
   ScrollView,
   StatusBar,
   StyleSheet,
   Switch,
   Text,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function SettingsScreen() {
   const router = useRouter();

   // Switches states
   const [pushEnabled, setPushEnabled] = useState(true);
   const [soundEnabled, setSoundEnabled] = useState(true);
   const [biometricsEnabled, setBiometricsEnabled] = useState(false);
   const [darkModeEnabled, setDarkModeEnabled] = useState(false);

   const handleDeleteAccount = () => {
      Alert.alert(
         'Delete Account Permanently',
         'WARNING: Deleting your account will erase all consultation history, prescription records, and health data. This action is irreversible.\n\nAre you sure you want to proceed?',
         [
            { text: 'Cancel', style: 'cancel' },
            { 
               text: 'Delete Account', 
               style: 'destructive', 
               onPress: () => {
                  Alert.alert('Request Submitted', 'Your account deletion request has been registered and will be processed within 15 days.', [
                     { text: 'OK', onPress: () => router.replace('/') }
                  ]);
               }
            }
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
            {/* Account Settings group */}
            <Text style={styles.groupHeader}>Account Settings</Text>
            <View style={styles.groupBg}>
               <TouchableOpacity 
                  style={styles.row}
                  onPress={() => Alert.alert('Verification Required', 'A verification OTP will be sent to +91 98139 25952 to change your login PIN.')}
               >
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="key-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Change Login PIN</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
               </TouchableOpacity>

               <TouchableOpacity 
                  style={[styles.row, styles.lastRow]}
                  onPress={() => Alert.alert('Linked Devices', 'Current Device: Android Phone (Active)\nNo other devices linked.')}
               >
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="desktop-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Linked Devices</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
               </TouchableOpacity>
            </View>

            {/* Notification and Preference toggles */}
            <Text style={styles.groupHeader}>Preferences</Text>
            <View style={styles.groupBg}>
               <View style={styles.row}>
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="notifications-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Push Notifications</Text>
                  </View>
                  <Switch 
                     value={pushEnabled} 
                     onValueChange={setPushEnabled}
                     trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                     thumbColor={pushEnabled ? TEAL : '#fafafa'}
                  />
               </View>

               <View style={styles.row}>
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="volume-high-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Sound & Vibrate</Text>
                  </View>
                  <Switch 
                     value={soundEnabled} 
                     onValueChange={setSoundEnabled}
                     trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                     thumbColor={soundEnabled ? TEAL : '#fafafa'}
                  />
               </View>

               <View style={styles.row}>
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="finger-print-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Biometric Login</Text>
                  </View>
                  <Switch 
                     value={biometricsEnabled} 
                     onValueChange={setBiometricsEnabled}
                     trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                     thumbColor={biometricsEnabled ? TEAL : '#fafafa'}
                  />
               </View>

               <View style={[styles.row, styles.lastRow]}>
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="moon-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Dark Mode (Beta)</Text>
                  </View>
                  <Switch 
                     value={darkModeEnabled} 
                     onValueChange={setDarkModeEnabled}
                     trackColor={{ false: '#ddd', true: '#CBEBE3' }}
                     thumbColor={darkModeEnabled ? TEAL : '#fafafa'}
                  />
               </View>
            </View>

            {/* Legal and information */}
            <Text style={styles.groupHeader}>Legal & Info</Text>
            <View style={styles.groupBg}>
               <TouchableOpacity 
                  style={styles.row}
                  onPress={() => Alert.alert('Privacy Policy', 'Displaying privacy policies & user data policies.')}
               >
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="document-text-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Privacy Policy</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
               </TouchableOpacity>

               <TouchableOpacity 
                  style={[styles.row, styles.lastRow]}
                  onPress={() => Alert.alert('Terms of Service', 'Displaying Terms of Service details.')}
               >
                  <View style={styles.left}>
                     <View style={styles.iconBg}>
                        <Ionicons name="information-circle-outline" size={18} color={TEAL} />
                     </View>
                     <Text style={styles.rowLabel}>Terms of Service</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
               </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <Text style={styles.groupHeaderDanger}>Danger Zone</Text>
            <View style={[styles.groupBg, styles.dangerBg]}>
               <TouchableOpacity 
                  style={[styles.row, styles.lastRow]}
                  onPress={handleDeleteAccount}
               >
                  <View style={styles.left}>
                     <View style={[styles.iconBg, { backgroundColor: '#FCEBEB' }]}>
                        <Ionicons name="trash-outline" size={18} color="#E24B4A" />
                     </View>
                     <Text style={styles.rowLabelDanger}>Delete Account permanently</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#E24B4A" />
               </TouchableOpacity>
            </View>

            <Text style={styles.footerTxt}>ApnaDoctor version 1.0.0 (Build 20260622)</Text>
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
   groupHeader: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8, marginLeft: 4 },
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
