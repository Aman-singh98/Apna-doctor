import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
const GREEN = '#1D9E75';

const payouts = [
   { id: '1', patient: 'Rahul Sharma', type: 'Video', date: '24 Jun', amount: 500, status: 'credited' },
   { id: '2', patient: 'Priya Mehta', type: 'Audio', date: '22 Jun', amount: 400, status: 'credited' },
   { id: '3', patient: 'Amit Verma', type: 'Chat', date: '22 Jun', amount: 300, status: 'credited' },
   { id: '4', patient: 'Sneha Gupta', type: 'Video', date: '18 Jun', amount: 500, status: 'credited' },
   { id: '5', patient: 'Deepak Yadav', type: 'Video', date: '15 Jun', amount: 500, status: 'pending' },
   { id: '6', patient: 'Kavya Nair', type: 'Chat', date: '10 Jun', amount: 300, status: 'credited' },
];

const typeIcon = (t) => t === 'Video' ? 'videocam-outline' : t === 'Audio' ? 'call-outline' : 'chatbubbles-outline';

export default function DoctorEarningsScreen() {
   const router = useRouter();

   const totalEarned = payouts.reduce((sum, p) => sum + (p.status === 'credited' ? p.amount : 0), 0);
   const pending = payouts.reduce((sum, p) => sum + (p.status === 'pending' ? p.amount : 0), 0);

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

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
               <View style={styles.summaryTop}>
                  <Text style={styles.summaryLabel}>Total Earned (Jun 2026)</Text>
                  <Ionicons name="cash-outline" size={20} color="#fff" />
               </View>
               <Text style={styles.summaryAmount}>₹{totalEarned.toLocaleString('en-IN')}</Text>
               <View style={styles.summaryRow}>
                  <View style={styles.summarySubItem}>
                     <Text style={styles.summarySubLabel}>This week</Text>
                     <Text style={styles.summarySubValue}>₹1,700</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summarySubItem}>
                     <Text style={styles.summarySubLabel}>Pending</Text>
                     <Text style={styles.summarySubValuePending}>₹{pending.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summarySubItem}>
                     <Text style={styles.summarySubLabel}>Consultations</Text>
                     <Text style={styles.summarySubValue}>{payouts.length}</Text>
                  </View>
               </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
               {[
                  { label: 'Video', count: 4, amount: '₹2,000', color: '#378ADD', bg: '#E6F1FB', icon: 'videocam' },
                  { label: 'Audio', count: 1, amount: '₹400', color: '#F5A623', bg: '#FEF5E7', icon: 'call' },
                  { label: 'Chat', count: 2, amount: '₹600', color: GREEN, bg: '#E1F5EE', icon: 'chatbubbles' },
               ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                     <View style={[styles.statIconBg, { backgroundColor: s.bg }]}>
                        <Ionicons name={s.icon} size={16} color={s.color} />
                     </View>
                     <Text style={styles.statCount}>{s.count} sessions</Text>
                     <Text style={styles.statAmount}>{s.amount}</Text>
                     <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
               ))}
            </View>

            {/* Payout History */}
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {payouts.map(p => (
               <View key={p.id} style={styles.txCard}>
                  <View style={styles.txIconBg}>
                     <Ionicons name={typeIcon(p.type)} size={18} color={TEAL} />
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.txName}>{p.patient}</Text>
                     <Text style={styles.txMeta}>{p.type} · {p.date}</Text>
                  </View>
                  <View style={styles.txRight}>
                     <Text style={[styles.txAmount, p.status === 'pending' && styles.txAmountPending]}>
                        +₹{p.amount}
                     </Text>
                     <View style={[styles.txBadge, p.status === 'pending' ? styles.txBadgePending : styles.txBadgeDone]}>
                        <Text style={[styles.txBadgeTxt, p.status === 'pending' ? styles.txBadgeTxtPending : styles.txBadgeTxtDone]}>
                           {p.status === 'pending' ? 'Pending' : 'Credited'}
                        </Text>
                     </View>
                  </View>
               </View>
            ))}

            {/* Withdraw */}
            <TouchableOpacity style={styles.withdrawBtn}>
               <Ionicons name="arrow-up-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
               <Text style={styles.withdrawBtnTxt}>Request Payout</Text>
            </TouchableOpacity>
            <Text style={styles.withdrawNote}>Payouts are processed within 2–3 business days via bank transfer.</Text>
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
