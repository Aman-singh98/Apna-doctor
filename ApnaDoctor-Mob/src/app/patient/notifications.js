import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
   Alert,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function NotificationsScreen() {
   const router = useRouter();

   const [notifications, setNotifications] = useState([
      { id: '1', type: 'appointment', title: 'Upcoming Consultation', desc: 'Your video consultation with Dr. Rajesh Kumar is scheduled for today at 3:00 PM.', time: '10 mins ago', read: false },
      { id: '2', type: 'prescription', title: 'New Prescription Issued', desc: 'Dr. Sunita Rao uploaded a new prescription for Diabetes Control.', time: '3 hours ago', read: false },
      { id: '3', type: 'records', title: 'Blood Report Uploaded', desc: 'Your lab report - Blood Panel has been processed and is ready to view.', time: 'Yesterday', read: true },
      { id: '4', type: 'billing', title: 'Refund Processed', desc: 'Refund of ₹400 for cancelled session TXN10210 completed successfully.', time: '2 days ago', read: true },
      { id: '5', type: 'system', title: 'App Update Available', desc: 'Upgrade to ApnaDoctor v1.1.0 for enhanced consultation stability.', time: '5 days ago', read: true },
   ]);

   const markAllRead = () => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      Alert.alert('Success', 'All notifications marked as read.');
   };

   const clearAll = () => {
      Alert.alert(
         'Clear Notifications',
         'Are you sure you want to clear your notifications log?',
         [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear All', style: 'destructive', onPress: () => setNotifications([]) }
         ]
      );
   };

   const handleNotificationPress = (item) => {
      // Mark as read when clicked
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      
      // Navigate or Alert depending on notification type
      if (item.type === 'appointment') {
         router.push('/patient/appointments');
      } else if (item.type === 'prescription' || item.type === 'records') {
         router.push('/patient/records');
      } else if (item.type === 'billing') {
         router.push('/patient/payment');
      } else {
         Alert.alert(item.title, item.desc);
      }
   };

   const getIcon = (type) => {
      switch (type) {
         case 'appointment':
            return <Ionicons name="calendar-outline" size={20} color="#378ADD" />;
         case 'prescription':
            return <MaterialCommunityIcons name="file-document-edit-outline" size={20} color="#1D9E75" />;
         case 'records':
            return <Ionicons name="document-outline" size={20} color={TEAL} />;
         case 'billing':
            return <Ionicons name="card-outline" size={20} color="#B67512" />;
         default:
            return <Ionicons name="notifications-outline" size={20} color="#888" />;
      }
   };

   const getIconBg = (type) => {
      switch (type) {
         case 'appointment': return '#EBF3FB';
         case 'prescription': return '#E1F5EE';
         case 'records': return '#E8F5F7';
         case 'billing': return '#FEF6E9';
         default: return '#f0f2f5';
      }
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Notifications Log</Text>
            <TouchableOpacity onPress={clearAll} disabled={notifications.length === 0}>
               <Text style={[styles.clearTxt, notifications.length === 0 && { color: '#ccc' }]}>Clear All</Text>
            </TouchableOpacity>
         </View>

         {notifications.length > 0 && (
            <TouchableOpacity style={styles.readAllRow} onPress={markAllRead}>
               <Ionicons name="checkmark-done" size={16} color={TEAL} />
               <Text style={styles.readAllTxt}>Mark all as read</Text>
            </TouchableOpacity>
         )}

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
               <View style={styles.emptyView}>
                  <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>Your notification log is empty</Text>
               </View>
            ) : (
               notifications.map(n => (
                  <TouchableOpacity 
                     key={n.id} 
                     style={[styles.card, !n.read && styles.cardUnread]}
                     onPress={() => handleNotificationPress(n)}
                     activeOpacity={0.8}
                  >
                     <View style={styles.cardHeader}>
                        <View style={[styles.iconBg, { backgroundColor: getIconBg(n.type) }]}>
                           {getIcon(n.type)}
                        </View>
                        
                        <View style={{ flex: 1, marginLeft: 12 }}>
                           <View style={styles.row}>
                              <Text style={[styles.titleTxt, !n.read && styles.titleTxtUnread]}>{n.title}</Text>
                              <Text style={styles.timeTxt}>{n.time}</Text>
                           </View>
                           <Text style={styles.descTxt} numberOfLines={2}>{n.desc}</Text>
                        </View>
                     </View>
                     
                     {!n.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
               ))
            )}
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   clearTxt: { fontSize: 13, fontWeight: '600', color: '#E24B4A', paddingHorizontal: 4 },
   readAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 12, gap: 4 },
   readAllTxt: { fontSize: 12, fontWeight: '600', color: TEAL },
   scroll: { padding: 16, paddingBottom: 30 },
   card: { position: 'relative', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 10, elevation: 1 },
   cardUnread: { borderColor: '#d7eef2', backgroundColor: '#F3FAFA' },
   cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
   iconBg: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
   row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   titleTxt: { fontSize: 13.5, fontWeight: '600', color: '#333', flex: 1, paddingRight: 8 },
   titleTxtUnread: { color: TEAL, fontWeight: 'bold' },
   timeTxt: { fontSize: 10, color: '#999' },
   descTxt: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 16 },
   unreadDot: { position: 'absolute', top: 10, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
});
