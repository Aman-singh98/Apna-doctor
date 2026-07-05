import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
   Alert,
   Image,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PatientBottomNav from '../../components/PatientBottomNav';
import { getMyPatientProfile } from '../../services/patientProfileService';

const TEAL = '#1A7E8A';

function getInitials(name) {
   if (!name?.trim()) return '?';
   return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
}

export default function ProfileScreen() {
   const router = useRouter();
   const [profile, setProfile] = useState(null);
   const [loading, setLoading] = useState(true);

   const loadProfile = useCallback(async () => {
      try {
         const data = await getMyPatientProfile();
         setProfile(data);
      } catch (err) {
         // Non-fatal — screen still works with whatever we already have,
         // just falls back to the initials avatar / blank fields.
         console.warn('Failed to load patient profile:', err?.message);
      } finally {
         setLoading(false);
      }
   }, []);

   // Refetch every time this tab comes into focus, so a photo/name change
   // made on profile-edit.js shows up immediately when navigating back.
   useFocusEffect(
      useCallback(() => {
         loadProfile();
      }, [loadProfile])
   );

   const menuItems = [
      { 
         section: 'Profile & Info',
         items: [
            { label: 'Edit Profile', icon: 'person-outline', route: '/patient/profile-edit' },
            { label: 'My Prescriptions', icon: 'document-text-outline', route: '/patient/prescriptions' },
            { label: 'Medical History', icon: 'medical-outline', route: '/patient/medical-history' },
            { label: 'Emergency Contacts', icon: 'call-outline', route: '/patient/emergency-contacts' },
            { label: 'Family Members', icon: 'people-outline', route: '/patient/family-members' },
         ]
      },
      {
         section: 'Payments & Support',
         items: [
            { label: 'Payments & History', icon: 'card-outline', route: '/patient/payment' },
            { label: 'Help & Support', icon: 'chatbubbles-outline', route: '/patient/support' },
            { label: 'Notifications Log', icon: 'notifications-outline', route: '/patient/notifications' },
         ]
      },
      {
         section: 'Preferences',
         items: [
            { label: 'App Settings', icon: 'settings-outline', route: '/patient/settings' },
         ]
      }
   ];

   const handleLogout = () => {
      Alert.alert(
         'Confirm Logout',
         'Are you sure you want to log out of ApnaDoctor?',
         [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => router.replace('/') }
         ]
      );
   };

   const photoUrl = profile?.photo?.url;
   const displayName = profile?.name || 'Complete your profile';
   const displayEmail = profile?.email || '';
   const displayPhone = profile?.phone || '';

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={"#fff"} />
         <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
               {/* Profile Header */}
               <View style={styles.profileHeader}>
                  <View style={styles.avatarWrap}>
                     {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
                     ) : (
                        <Text style={styles.avatarTxt}>{loading ? '' : getInitials(displayName)}</Text>
                     )}
                  </View>
                  <Text style={styles.name}>{displayName}</Text>
                  {!!displayEmail && <Text style={styles.email}>{displayEmail}</Text>}
                  {!!displayPhone && <Text style={styles.phone}>{displayPhone}</Text>}
               </View>

               {/* Health Quick Grid */}
               <View style={styles.healthCard}>
                  <View style={styles.healthHeader}>
                     <Text style={styles.healthTitle}>Vital Info Summary</Text>
                     <Ionicons name="shield-checkmark" size={16} color={TEAL} />
                  </View>
                  <View style={styles.healthRow}>
                     {[
                        { label: 'Blood Group', value: profile?.bloodGroup || '—' },
                        { label: 'Gender', value: profile?.gender || '—' },
                        { label: 'Weight', value: profile?.weight ? `${profile.weight} Kg` : '—' },
                     ].map(item => (
                        <View key={item.label} style={styles.healthItem}>
                           <Text style={styles.healthVal}>{item.value}</Text>
                           <Text style={styles.healthLabel}>{item.label}</Text>
                        </View>
                     ))}
                  </View>
               </View>

               {/* Menus */}
               {menuItems.map(sec => (
                  <View key={sec.section} style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>{sec.section}</Text>
                     <View style={styles.menuGroup}>
                        {sec.items.map((item, idx) => (
                           <TouchableOpacity 
                              key={item.label} 
                              style={[
                                 styles.menuItem,
                                 idx === sec.items.length - 1 && styles.lastMenuItem
                              ]}
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

               {/* Logout Button */}
               <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={20} color="#E24B4A" style={{ marginRight: 8 }} />
                  <Text style={styles.logoutTxt}>Log Out</Text>
               </TouchableOpacity>

               <Text style={styles.versionTxt}>ApnaDoctor Patient App · v1.0.0</Text>
            </ScrollView>
         </View>

         {/* Bottom Navigation */}
         <PatientBottomNav activeTab="profile" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   container: { flex: 1, paddingBottom: 65 },
   scroll: { padding: 16, paddingBottom: 30 },
   profileHeader: { alignItems: 'center', marginVertical: 12 },
   avatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#378ADD', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 3, shadowColor: '#378ADD', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   avatarImg: { width: 80, height: 80, borderRadius: 40 },
   avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 28 },
   name: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginTop: 12 },
   email: { fontSize: 13, color: '#666', marginTop: 2 },
   phone: { fontSize: 13, color: '#666', marginTop: 2 },
   healthCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginTop: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   healthTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   healthRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4 },
   healthItem: { alignItems: 'center' },
   healthVal: { fontSize: 16, fontWeight: '700', color: TEAL },
   healthLabel: { fontSize: 11, color: '#777', marginTop: 2 },
   sectionContainer: { marginTop: 16 },
   sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
   menuGroup: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
   lastMenuItem: { borderBottomWidth: 0 },
   menuLeft: { flexDirection: 'row', alignItems: 'center' },
   menuIconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
   menuTxt: { fontSize: 14, fontWeight: '600', color: '#333' },
   logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#FCEBEB', borderRadius: 16, paddingVertical: 14, marginTop: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   logoutTxt: { fontSize: 14, fontWeight: 'bold', color: '#E24B4A' },
   versionTxt: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 32, marginBottom: 16 },
});
