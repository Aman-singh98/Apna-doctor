import { Ionicons } from '@expo/vector-icons';
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
import { getEarningsSummary, getTransactions, requestPayout } from '../../services/earningsService';

const TEAL = '#1A7E8A';
const GREEN = '#1D9E75';

const typeIcon = (t) => t === 'Video' ? 'videocam-outline' : t === 'Audio' ? 'call-outline' : 'chatbubbles-outline';

const formatDate = (isoDate) =>
   new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const monthLabel = (isoDate) =>
   new Date(isoDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

// Backend gives back { id, patient, type, date, amount, status } — see
// controllers/earningsController.js getTransactions. status is
// 'pending' | 'credited' | 'refunded' ('failed' is filtered out server-side).
const badgeCopy = (status) => {
   if (status === 'pending') return 'Pending';
   if (status === 'refunded') return 'Refunded';
   return 'Credited';
};

export default function DoctorEarningsScreen() {
   const router = useRouter();

   const [summary, setSummary] = useState(null);
   const [transactions, setTransactions] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState('');
   const [requestingPayout, setRequestingPayout] = useState(false);

   const load = useCallback(async ({ silent } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
         const [summaryData, txns] = await Promise.all([
            getEarningsSummary(),
            getTransactions(),
         ]);
         setSummary(summaryData);
         setTransactions(Array.isArray(txns) ? txns : []);
      } catch (err) {
         setError(err.response?.data?.message || 'Could not load your earnings.');
      } finally {
         setLoading(false);
         setRefreshing(false);
      }
   }, []);

   useEffect(() => {
      load();
   }, [load]);

   const onRefresh = () => {
      setRefreshing(true);
      load({ silent: true });
   };

   const onRequestPayout = async () => {
      setRequestingPayout(true);
      try {
         const res = await requestPayout();
         Alert.alert('Payouts', res.message || 'Request received.');
      } catch (err) {
         Alert.alert('Error', err.response?.data?.message || 'Could not check your payout status.');
      } finally {
         setRequestingPayout(false);
      }
   };

   const statCards = summary ? [
      { label: 'Video', count: summary.breakdown?.video?.count || 0, amount: summary.breakdown?.video?.amount || 0, color: '#378ADD', bg: '#E6F1FB', icon: 'videocam' },
      { label: 'Audio', count: summary.breakdown?.audio?.count || 0, amount: summary.breakdown?.audio?.amount || 0, color: '#F5A623', bg: '#FEF5E7', icon: 'call' },
      { label: 'Chat', count: summary.breakdown?.chat?.count || 0, amount: summary.breakdown?.chat?.amount || 0, color: GREEN, bg: '#E1F5EE', icon: 'chatbubbles' },
   ] : [];

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Earnings & Payouts</Text>
            <View style={{ width: 40 }} />
         </View>

         {loading ? (
            <View style={styles.emptyView}>
               <ActivityIndicator size="large" color={TEAL} />
               <Text style={styles.emptyTxt}>Loading your earnings…</Text>
            </View>
         ) : error ? (
            <View style={styles.emptyView}>
               <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
               <Text style={styles.emptyTxt}>{error}</Text>
               <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
                  <Text style={styles.retryBtnTxt}>Retry</Text>
               </TouchableOpacity>
            </View>
         ) : (
         <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[TEAL]} tintColor={TEAL} />}
         >
            {/* Summary Card */}
            <View style={styles.summaryCard}>
               <View style={styles.summaryTop}>
                  <Text style={styles.summaryLabel}>
                     Total Earned {summary?.monthStart ? `(${monthLabel(summary.monthStart)})` : ''}
                  </Text>
                  <Ionicons name="cash-outline" size={20} color="#fff" />
               </View>
               <Text style={styles.summaryAmount}>₹{(summary?.totalEarned || 0).toLocaleString('en-IN')}</Text>
               <View style={styles.summaryRow}>
                  <View style={styles.summarySubItem}>
                     <Text style={styles.summarySubLabel}>This week</Text>
                     <Text style={styles.summarySubValue}>₹{(summary?.thisWeek || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summarySubItem}>
                     <Text style={styles.summarySubLabel}>Pending</Text>
                     <Text style={styles.summarySubValuePending}>₹{(summary?.pending || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summarySubItem}>
                     <Text style={styles.summarySubLabel}>Consultations</Text>
                     <Text style={styles.summarySubValue}>{summary?.consultationCount || 0}</Text>
                  </View>
               </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
               {statCards.map(s => (
                  <View key={s.label} style={styles.statCard}>
                     <View style={[styles.statIconBg, { backgroundColor: s.bg }]}>
                        <Ionicons name={s.icon} size={16} color={s.color} />
                     </View>
                     <Text style={styles.statCount}>{s.count} sessions</Text>
                     <Text style={styles.statAmount}>₹{s.amount.toLocaleString('en-IN')}</Text>
                     <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
               ))}
            </View>

            {/* Payout History */}
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {transactions.length === 0 ? (
               <View style={styles.emptyView}>
                  <Ionicons name="cash-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>No transactions yet</Text>
               </View>
            ) : transactions.map(p => (
               <View key={p.id} style={styles.txCard}>
                  <View style={styles.txIconBg}>
                     <Ionicons name={typeIcon(p.type)} size={18} color={TEAL} />
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.txName}>{p.patient}</Text>
                     <Text style={styles.txMeta}>{p.type} · {formatDate(p.date)}</Text>
                  </View>
                  <View style={styles.txRight}>
                     <Text style={[styles.txAmount, p.status !== 'credited' && styles.txAmountPending]}>
                        {p.status === 'refunded' ? '−' : '+'}₹{p.amount}
                     </Text>
                     <View style={[styles.txBadge, p.status === 'credited' ? styles.txBadgeDone : styles.txBadgePending]}>
                        <Text style={[styles.txBadgeTxt, p.status === 'credited' ? styles.txBadgeTxtDone : styles.txBadgeTxtPending]}>
                           {badgeCopy(p.status)}
                        </Text>
                     </View>
                  </View>
               </View>
            ))}

            {/* Withdraw */}
            <TouchableOpacity style={styles.withdrawBtn} onPress={onRequestPayout} disabled={requestingPayout}>
               {requestingPayout ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
               ) : (
                  <Ionicons name="arrow-up-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
               )}
               <Text style={styles.withdrawBtnTxt}>Check Payout Status</Text>
            </TouchableOpacity>
            <Text style={styles.withdrawNote}>Payouts are processed within 2–3 business days via bank transfer.</Text>
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
   scroll: { padding: 16, paddingBottom: 40 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
   retryBtn: { marginTop: 16, backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
   retryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   summaryCard: { backgroundColor: TEAL, borderRadius: 20, padding: 20, marginBottom: 16, elevation: 4, shadowColor: TEAL, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
   summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
   summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
   summaryAmount: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
   summaryRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 14 },
   summarySubItem: { flex: 1, alignItems: 'center' },
   summarySubLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
   summarySubValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
   summarySubValuePending: { fontSize: 15, fontWeight: '700', color: '#F5C27A' },
   summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
   statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
   statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f0f0f0', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   statIconBg: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
   statCount: { fontSize: 11, color: '#888', marginBottom: 2 },
   statAmount: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
   statLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },
   sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
   txCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   txIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   txName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
   txMeta: { fontSize: 12, color: '#888', marginTop: 2 },
   txRight: { alignItems: 'flex-end' },
   txAmount: { fontSize: 15, fontWeight: '700', color: GREEN },
   txAmountPending: { color: '#F5A623' },
   txBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
   txBadgeDone: { backgroundColor: '#E1F5EE' },
   txBadgePending: { backgroundColor: '#FEF5E7' },
   txBadgeTxt: { fontSize: 10, fontWeight: '700' },
   txBadgeTxtDone: { color: '#085041' },
   txBadgeTxtPending: { color: '#B67512' },
   withdrawBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, marginTop: 20, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   withdrawBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   withdrawNote: { textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 10 },
});
