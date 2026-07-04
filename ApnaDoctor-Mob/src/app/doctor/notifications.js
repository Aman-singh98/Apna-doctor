import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

const initialNotifications = [
   { id: '1', type: 'appointment', title: 'New Appointment Booked', desc: 'Rahul Sharma has booked a Video consultation for Today, 10:00 AM.', time: '9:45 AM', unread: true },
   { id: '2', type: 'payment', title: 'Payment Received', desc: 'You received ₹500 for consultation with Priya Mehta.', time: '8:30 AM', unread: true },
   { id: '3', type: 'rating', title: 'New Patient Review', desc: 'Kavya Nair rated you ⭐ 5/5 — "Great doctor, very thorough!"', time: 'Yesterday', unread: false },
   { id: '4', type: 'appointment', title: 'Appointment Cancelled', desc: 'Rohit Jain cancelled his Chat consultation for Tomorrow, 2:00 PM.', time: 'Yesterday', unread: false },
   { id: '5', type: 'system', title: 'Profile Verified', desc: 'Your medical registration has been verified. You can now accept consultations.', time: '22 Jun', unread: false },
   { id: '6', type: 'payment', title: 'Payout Processed', desc: '₹3,200 has been transferred to your bank account (HDFC ****4521).', time: '20 Jun', unread: false },
];

const getIcon = (type) => {
   switch (type) {
      case 'appointment': return <Ionicons name="calendar" size={20} color={TEAL} />;
      case 'payment': return <Ionicons name="cash" size={20} color="#1D9E75" />;
      case 'rating': return <Ionicons name="star" size={20} color="#F5A623" />;
      case 'system': return <Ionicons name="shield-checkmark" size={20} color="#378ADD" />;
      default: return <Ionicons name="notifications" size={20} color="#888" />;
   }
};

const getBg = (type) => {
   switch (type) {
      case 'appointment': return '#E8F5F7';
      case 'payment': return '#E1F5EE';
      case 'rating': return '#FEF5E7';
      case 'system': return '#E6F1FB';
      default: return '#f0f0f0';
   }
};

export default function DoctorNotificationsScreen() {
   const router = useRouter();
   const [notifs, setNotifs] = useState(initialNotifications);

   const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
   const unreadCount = notifs.filter(n => n.unread).length;

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <View style={styles.titleRow}>
               <Text style={styles.barTitle}>Notifications</Text>
               {unreadCount > 0 && (
                  <View style={styles.unreadBubble}>
                     <Text style={styles.unreadBubbleTxt}>{unreadCount}</Text>
                  </View>
               )}
            </View>
            {unreadCount > 0 && (
               <TouchableOpacity onPress={markAllRead}>
                  <Text style={styles.markAllTxt}>Mark all read</Text>
               </TouchableOpacity>
            )}
            {unreadCount === 0 && <View style={{ width: 60 }} />}
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {notifs.length === 0 ? (
               <View style={styles.emptyView}>
                  <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>No notifications</Text>
               </View>
            ) : notifs.map(n => (
               <TouchableOpacity
                  key={n.id}
                  style={[styles.card, n.unread && styles.cardUnread]}
                  onPress={() => setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, unread: false } : x))}
                  activeOpacity={0.85}
               >
                  <View style={[styles.iconWrap, { backgroundColor: getBg(n.type) }]}>
                     {getIcon(n.type)}
                  </View>
                  <View style={styles.cardBody}>
                     <Text style={[styles.cardTitle, n.unread && styles.cardTitleUnread]}>{n.title}</Text>
                     <Text style={styles.cardDesc}>{n.desc}</Text>
                     <Text style={styles.cardTime}>{n.time}</Text>
                  </View>
                  {n.unread && <View style={styles.unreadDot} />}
               </TouchableOpacity>
            ))}
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   unreadBubble: { backgroundColor: TEAL, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
   unreadBubbleTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
   markAllTxt: { fontSize: 13, fontWeight: '600', color: TEAL },
   scroll: { padding: 16, paddingBottom: 40 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   card: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardUnread: { borderColor: '#CBEBE3', backgroundColor: '#FAFFFE' },
   iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
   cardBody: { flex: 1 },
   cardTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
   cardTitleUnread: { color: TEAL, fontWeight: '700' },
   cardDesc: { fontSize: 13, color: '#555', marginTop: 3, lineHeight: 18 },
   cardTime: { fontSize: 11, color: '#aaa', marginTop: 6 },
   unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL, marginTop: 6, flexShrink: 0 },
});
