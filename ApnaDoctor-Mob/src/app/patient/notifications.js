// app/patient/notifications.js
//
// ASSUMPTIONS — adjust if wrong:
//   - Service import path: this file assumes src/services/patientNotificationService.js
//     is reachable via the relative path below (same folder recordService.js lives in
//     — that's the pattern this mirrors). Adjust the '../../' depth if wrong.
//   - Response shape: assumes each service call resolves to the raw data already
//     (a bare array for list, a bare object for the others) — i.e. the backend does
//     res.json(notifs) directly, NOT wrapped in { success, data }. recordService.js's
//     own comment says your API usually wraps responses as { success, data, message } —
//     if that's true here too, change `setNotifications(res)` below to `setNotifications(res.data)`.
//   - Notification doc shape from the backend: { _id, type, title, desc, read, createdAt, meta }
//     — note `_id` not `id`, and `createdAt` (a real Date) instead of a static `time` string.

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   RefreshControl,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
   getMyNotifications,
   markNotificationRead,
   markAllNotificationsRead,
   clearAllNotifications,
} from '../../services/patientNotificationService'; // adjust path if needed

const TEAL = '#1A7E8A';

// Lightweight relative-time formatter so we don't need to add a date library
// just for this one screen. Falls back to a short date once it's over a week old.
function timeAgo(dateString) {
   const diffMs = Date.now() - new Date(dateString).getTime();
   const mins = Math.floor(diffMs / 60000);
   if (mins < 1) return 'Just now';
   if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
   const hrs = Math.floor(mins / 60);
   if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
   const days = Math.floor(hrs / 24);
   if (days === 1) return 'Yesterday';
   if (days < 7) return `${days} days ago`;
   return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
   const router = useRouter();

   const [notifications, setNotifications] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);

   const loadNotifications = useCallback(async () => {
      try {
         const res = await getMyNotifications();
         setNotifications(res); // change to res.data if your backend wraps responses
      } catch (err) {
         Alert.alert('Error', 'Could not load notifications. Pull down to try again.');
      }
   }, []);

   useEffect(() => {
      (async () => {
         setLoading(true);
         await loadNotifications();
         setLoading(false);
      })();
   }, [loadNotifications]);

   const onRefresh = async () => {
      setRefreshing(true);
      await loadNotifications();
      setRefreshing(false);
   };

   const markAllRead = async () => {
      // Optimistic update — flip local state immediately, then sync to server.
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      try {
         await markAllNotificationsRead();
         Alert.alert('Success', 'All notifications marked as read.');
      } catch (err) {
         Alert.alert('Error', 'Failed to mark all as read. Please try again.');
         loadNotifications(); // re-sync in case the optimistic update was wrong
      }
   };

   const clearAll = () => {
      Alert.alert(
         'Clear Notifications',
         'Are you sure you want to clear your notifications log?',
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Clear All',
               style: 'destructive',
               onPress: async () => {
                  const prev = notifications;
                  setNotifications([]); // optimistic
                  try {
                     await clearAllNotifications();
                  } catch (err) {
                     Alert.alert('Error', 'Failed to clear notifications. Please try again.');
                     setNotifications(prev); // roll back
                  }
               }
            }
         ]
      );
   };

   const handleNotificationPress = async (item) => {
      // Mark as read locally + on the server (fire-and-forget — don't block navigation on it)
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, read: true } : n));
      markNotificationRead(item._id).catch(() => {});

      // Navigate depending on notification type
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

         {loading ? (
            <View style={styles.emptyView}>
               <ActivityIndicator size="large" color={TEAL} />
            </View>
         ) : (
            <ScrollView
               contentContainerStyle={styles.scroll}
               showsVerticalScrollIndicator={false}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[TEAL]} />}
            >
               {notifications.length === 0 ? (
                  <View style={styles.emptyView}>
                     <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>Your notification log is empty</Text>
                  </View>
               ) : (
                  notifications.map(n => (
                     <TouchableOpacity
                        key={n._id}
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
                                 <Text style={styles.timeTxt}>{timeAgo(n.createdAt)}</Text>
                              </View>
                              <Text style={styles.descTxt} numberOfLines={2}>{n.desc}</Text>
                           </View>
                        </View>

                        {!n.read && <View style={styles.unreadDot} />}
                     </TouchableOpacity>
                  ))
               )}
            </ScrollView>
         )}
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
