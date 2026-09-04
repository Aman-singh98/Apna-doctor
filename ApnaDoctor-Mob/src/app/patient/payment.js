import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert, KeyboardAvoidingView, Modal,
   Platform,
   RefreshControl,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { cancelAppointment } from '../../services/patientAppointmentService';
import { downloadInvoicePdf, getPaymentSummary, getPayments, getRefunds } from '../../services/paymentService';

const TEAL = '#1A7E8A';

const formatDate = (isoDate) =>
   new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Backend gives back paymentStatus 'pending' | 'paid' | 'refunded' | 'failed'
// (see controllers/patientPaymentController.js listPayments).
const statusBadge = (status) => {
   if (status === 'refunded') return { label: 'Refunded', style: 'refunded' };
   if (status === 'pending') return { label: 'Pending', style: 'progress' };
   if (status === 'failed') return { label: 'Failed', style: 'refunded' };
   return null; // 'paid' shows action buttons instead of a badge
};

export default function PaymentScreen() {
   const router = useRouter();
   const [activeTab, setActiveTab] = useState('history'); // 'history' or 'refunds'
   const [modalVisible, setModalVisible] = useState(false);
   const [refundReason, setRefundReason] = useState('');
   const [selectedTxn, setSelectedTxn] = useState(null);
   const [submittingRefund, setSubmittingRefund] = useState(false);
   const [invoiceBusyId, setInvoiceBusyId] = useState(null);

   const [summary, setSummary] = useState(null);
   const [transactions, setTransactions] = useState([]);
   const [refunds, setRefunds] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState('');

   const load = useCallback(async ({ silent } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
         const [summaryData, payments, refundList] = await Promise.all([
            getPaymentSummary(),
            getPayments(),
            getRefunds(),
         ]);
         setSummary(summaryData);
         setTransactions(Array.isArray(payments) ? payments : []);
         setRefunds(Array.isArray(refundList) ? refundList : []);
      } catch (err) {
         setError(err.response?.data?.message || 'Could not load your payments.');
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

   const handleRequestRefund = (txn) => {
      setSelectedTxn(txn);
      setModalVisible(true);
   };

   // A "refund" in this app only ever happens by cancelling the still-upcoming
   // appointment — see services/refundService.js. There's no separate
   // refund-request system to submit into, so this calls the real cancel
   // endpoint and the backend handles the Razorpay refund automatically.
   const submitRefund = async () => {
      if (!refundReason.trim()) {
         Alert.alert('Validation Error', 'Please tell us why you need a refund.');
         return;
      }
      setSubmittingRefund(true);
      try {
         await cancelAppointment(selectedTxn.id, refundReason.trim());
         setModalVisible(false);
         setRefundReason('');
         Alert.alert('Refund Requested', 'Your consultation has been cancelled and the refund is on its way — usually within 5-7 business days.');
         load({ silent: true });
      } catch (err) {
         Alert.alert('Error', err.response?.data?.message || 'Could not process your refund. Please try again.');
      } finally {
         setSubmittingRefund(false);
      }
   };

   const handleInvoice = async (txn) => {
      setInvoiceBusyId(txn.id);
      try {
         const localUri = await downloadInvoicePdf(txn.id);
         const canShare = await Sharing.isAvailableAsync();
         if (canShare) {
            await Sharing.shareAsync(localUri, {
               mimeType: 'application/pdf',
               dialogTitle: 'Share or save invoice',
               UTI: 'com.adobe.pdf',
            });
         } else {
            Alert.alert('Not available', 'Sharing is not available on this device.');
         }
      } catch (err) {
         Alert.alert('Error', 'Could not generate the invoice PDF. Please try again.');
      } finally {
         setInvoiceBusyId(null);
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
            <Text style={styles.barTitle}>Payments & Billings</Text>
            <View style={{ width: 40 }} />
         </View>

         {loading ? (
            <View style={styles.emptyView}>
               <ActivityIndicator size="large" color={TEAL} />
               <Text style={styles.emptyTxt}>Loading your payments…</Text>
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
         <>
         {/* Hero Wallet Card */}
         <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total Consultation Spent</Text>
            <Text style={styles.heroAmt}>₹{(summary?.totalSpent || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.heroSub}>Across {summary?.activeCount || 0} paid consultation{summary?.activeCount === 1 ? '' : 's'}</Text>
         </View>

         {/* Navigation Tabs */}
         <View style={styles.tabRow}>
            <TouchableOpacity
               style={[styles.tab, activeTab === 'history' && styles.tabActive]}
               onPress={() => setActiveTab('history')}
            >
               <Text style={[styles.tabTxt, activeTab === 'history' && styles.tabTxtActive]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
               style={[styles.tab, activeTab === 'refunds' && styles.tabActive]}
               onPress={() => setActiveTab('refunds')}
            >
               <Text style={[styles.tabTxt, activeTab === 'refunds' && styles.tabTxtActive]}>Refund Status</Text>
            </TouchableOpacity>
         </View>

         <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[TEAL]} tintColor={TEAL} />}
         >
            {activeTab === 'history' ? (
               transactions.length === 0 ? (
                  <View style={styles.emptyView}>
                     <Ionicons name="cash-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>No payments yet</Text>
                  </View>
               ) : transactions.map(t => {
                  const badge = statusBadge(t.status);
                  return (
                     <View key={t.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                           <View style={styles.iconBg}>
                              <Ionicons
                                 name={t.status === 'refunded' ? 'refresh-circle-outline' : 'cash-outline'}
                                 size={22}
                                 color={t.status === 'refunded' ? '#E24B4A' : TEAL}
                              />
                           </View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.cardTitle}>{t.type} Consultation</Text>
                              <Text style={styles.cardSub}>{t.doctorName}</Text>
                           </View>
                           <Text style={[styles.cardAmt, t.status === 'refunded' && { textDecorationLine: 'line-through', color: '#888' }]}>
                              ₹{t.amount}
                           </Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.cardFooter}>
                           <View>
                              <Text style={styles.metaTxt}>ID: {String(t.id).slice(-8).toUpperCase()} · {formatDate(t.date)}</Text>
                           </View>

                           {badge ? (
                              <View style={[styles.statusBadge, badge.style === 'refunded' ? styles.statusRefunded : styles.statusProgress]}>
                                 <Text style={[styles.statusBadgeTxt, badge.style === 'refunded' ? styles.statusRefundedTxt : styles.statusProgressTxt]}>
                                    {badge.label}
                                 </Text>
                              </View>
                           ) : (
                              <View style={{ flexDirection: 'row', gap: 10 }}>
                                 {t.refundable && (
                                    <TouchableOpacity
                                       style={styles.actionBtnOutline}
                                       onPress={() => handleRequestRefund(t)}
                                    >
                                       <Text style={styles.actionBtnTxt}>Refund</Text>
                                    </TouchableOpacity>
                                 )}
                                 <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => handleInvoice(t)}
                                    disabled={invoiceBusyId === t.id}
                                 >
                                    {invoiceBusyId === t.id
                                       ? <ActivityIndicator size="small" color="#fff" />
                                       : <Text style={styles.actionBtnTxtActive}>Invoice</Text>}
                                 </TouchableOpacity>
                              </View>
                           )}
                        </View>
                     </View>
                  );
               })
            ) : (
               refunds.length === 0 ? (
                  <View style={styles.emptyView}>
                     <Ionicons name="refresh-circle-outline" size={60} color="#ccc" />
                     <Text style={styles.emptyTxt}>No refunds initiated yet.</Text>
                  </View>
               ) : (
                  refunds.map(r => (
                     <View key={r.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                           <View style={[styles.iconBg, { backgroundColor: '#FCEBEB' }]}>
                              <Ionicons name="swap-horizontal-outline" size={20} color="#E24B4A" />
                           </View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.cardTitle}>{r.doctorName}</Text>
                              {!!r.reason && <Text style={styles.cardSub} numberOfLines={2}>{r.reason}</Text>}
                           </View>
                           <Text style={styles.refundAmt}>₹{r.amount}</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.cardFooter}>
                           <View>
                              <Text style={styles.metaTxt}>Initiated: {formatDate(r.date)}</Text>
                              <Text style={styles.metaTxt}>Destination: {r.method}</Text>
                           </View>
                           <View style={[styles.statusBadge, styles.statusRefunded]}>
                              <Text style={[styles.statusBadgeTxt, styles.statusRefundedTxt]}>Refunded</Text>
                           </View>
                        </View>
                     </View>
                  ))
               )
            )}
         </ScrollView>
         </>
         )}

         {/* Refund Request Modal */}
         <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
         >
            <KeyboardAvoidingView
               style={styles.modalOverlay}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
               <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Cancel & Request Refund</Text>
                  <Text style={styles.modalSubtitle}>This cancels your upcoming appointment and refunds the full amount to your original payment method.</Text>

                  <Text style={styles.label}>Reason</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Can't make it anymore, booked by mistake..."
                     value={refundReason}
                     onChangeText={setRefundReason}
                     multiline={true}
                     numberOfLines={4}
                  />

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnCancel]}
                        onPress={() => setModalVisible(false)}
                        disabled={submittingRefund}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Discard</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnConfirm]}
                        onPress={submitRefund}
                        disabled={submittingRefund}
                     >
                        {submittingRefund
                           ? <ActivityIndicator size="small" color="#fff" />
                           : <Text style={styles.modalBtnConfirmTxt}>Submit Request</Text>}
                     </TouchableOpacity>
                  </View>
               </View>
            </KeyboardAvoidingView>
         </Modal>

      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   heroCard: { backgroundColor: TEAL, borderRadius: 16, padding: 20, margin: 16, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   heroLabel: { color: '#CBEBE3', fontSize: 13, fontWeight: '600' },
   heroAmt: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
   heroSub: { color: '#CBEBE3', fontSize: 11, marginTop: 4 },
   tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#eee', borderRadius: 10, padding: 3, marginBottom: 12 },
   tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
   tabActive: { backgroundColor: '#fff', elevation: 1 },
   tabTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   tabTxtActive: { color: TEAL },
   scroll: { paddingHorizontal: 16, paddingBottom: 30 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardHeader: { flexDirection: 'row', alignItems: 'center' },
   iconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
   cardSub: { fontSize: 12, color: '#666', marginTop: 1 },
   cardAmt: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   refundAmt: { fontSize: 15, fontWeight: 'bold', color: '#E24B4A' },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 12 },
   cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   metaTxt: { fontSize: 11, color: '#999', lineHeight: 15 },
   actionBtn: { backgroundColor: TEAL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
   actionBtnOutline: { borderWidth: 1, borderColor: TEAL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
   actionBtnTxt: { fontSize: 11, fontWeight: 'bold', color: TEAL },
   actionBtnTxtActive: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
   statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
   statusRefunded: { backgroundColor: '#FCEBEB' },
   statusRefundedTxt: { color: '#B3261E', fontSize: 11, fontWeight: 'bold' },
   statusProgress: { backgroundColor: '#FEF6E9' },
   statusProgressTxt: { color: '#B67512', fontSize: 11, fontWeight: 'bold' },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
   retryBtn: { marginTop: 16, backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
   retryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
   modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 12, marginBottom: 8 },
   input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa', marginBottom: 16, textAlignVertical: 'top' },
   modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 10 },
   modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },
});
