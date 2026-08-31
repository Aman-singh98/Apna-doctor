// app/doctor/notifications.js
//
// ASSUMPTIONS — adjust if wrong:
//   - Service import path: assumes src/services/doctorNotificationService.js
//     is reachable via the relative path below. Adjust the '../../' depth if wrong.
//   - Response shape: assumes each service call resolves to the raw data already
//     (bare array / bare object), NOT wrapped in { success, data }. If your API
//     wraps responses that way, change `setNotifs(res)` below to `setNotifs(res.data)`.
//   - Screen routes below (appointments/earnings/reviews) are GUESSES based on
//     your project scope doc — swap in your actual route paths for each type.
//   - Notification doc shape from backend: { _id, type, title, desc, read, createdAt, meta }

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
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
   getMyNotifications,
   markNotificationRead,
   markAllNotificationsRead,
} from '../../services/doctorNotificationService'; // adjust path if needed

const TEAL = '#1A7E8A';

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
   const [notifs, setNotifs] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);

   const loadNotifications = useCallback(async () => {
      try {
         const res = await getMyNotifications();
         setNotifs(res); // change to res.data if your backend wraps responses
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
      setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
      try {
         await markAllNotificationsRead();
      } catch (err) {
         Alert.alert('Error', 'Failed to mark all as read. Please try again.');
         loadNotifications();
      }
   };

   const handleNotificationPress = async (item) => {
      // Mark as read locally + on the server (fire-and-forget)
      setNotifs(prev => prev.map(x => x._id === item._id ? { ...x, read: true } : x));
      markNotificationRead(item._id).catch(() => {});

      // Navigate depending on notification type — swap these for your real routes
      if (item.type === 'appointment') {
         router.push('/doctor/appointments');
      } else if (item.type === 'payment') {
         router.push('/doctor/earnings');
      } else if (item.type === 'rating') {
         router.push('/doctor/reviews');
      } else {
         Alert.alert(item.title, item.desc);
      }
   };

   const unreadCount = notifs.filter(n => !n.read).length;

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
               {notifs.length === 0 ? (
                  <View style={styles.emptyView}>
                     <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>No notifications</Text>
                  </View>
               ) : notifs.map(n => (
                  <TouchableOpacity
                     key={n._id}
                     style={[styles.card, !n.read && styles.cardUnread]}
                     onPress={() => handleNotificationPress(n)}
                     activeOpacity={0.85}
                  >
                     <View style={[styles.iconWrap, { backgroundColor: getBg(n.type) }]}>
                        {getIcon(n.type)}
                     </View>
                     <View style={styles.cardBody}>
                        <Text style={[styles.cardTitle, !n.read && styles.cardTitleUnread]}>{n.title}</Text>
                        <Text style={styles.cardDesc}>{n.desc}</Text>
                        <Text style={styles.cardTime}>{timeAgo(n.createdAt)}</Text>
                     </View>
                     {!n.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
               ))}
            </ScrollView>
         )}
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