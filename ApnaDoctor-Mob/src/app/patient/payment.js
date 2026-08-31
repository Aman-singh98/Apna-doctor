import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
   Alert, Modal,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function PaymentScreen() {
   const router = useRouter();
   const [activeTab, setActiveTab] = useState('history'); // 'history' or 'refunds'
   const [modalVisible, setModalVisible] = useState(false);
   const [refundReason, setRefundReason] = useState('');
   const [selectedTxn, setSelectedTxn] = useState(null);

   const [transactions, setTransactions] = useState([
      { id: 'TXN10982', type: 'Consultation Fee', doctor: 'Dr. Rajesh Kumar', amount: 600, date: '19 Jun 2026', method: 'UPI (GPay)', status: 'Success' },
      { id: 'TXN10871', type: 'Consultation Fee', doctor: 'Dr. Sunita Rao', amount: 500, date: '15 Jun 2026', method: 'Visa Card (*4242)', status: 'Success' },
      { id: 'TXN10210', type: 'Cancelled Session', doctor: 'Dr. Amit Verma', amount: 400, date: '10 Jun 2026', method: 'Netbanking', status: 'Refunded' },
   ]);

   const [refunds, setRefunds] = useState([
      { id: 'REF90812', txnId: 'TXN10210', amount: 400, date: '11 Jun 2026', status: 'Completed', method: 'Bank Account' },
   ]);

   const handleRequestRefund = (txn) => {
      setSelectedTxn(txn);
      setModalVisible(true);
   };

   const submitRefund = () => {
      if (!refundReason.trim()) {
         Alert.alert('Validation Error', 'Please tell us why you need a refund.');
         return;
      }
      
      // Update transaction status
      setTransactions(prev => prev.map(t => 
         t.id === selectedTxn.id ? { ...t, status: 'Refund Initiated' } : t
      ));

      // Append to refunds list
      const newRefund = {
         id: `REF${Math.floor(10000 + Math.random() * 90000)}`,
         txnId: selectedTxn.id,
         amount: selectedTxn.amount,
         date: 'Today',
         status: 'In Progress',
         method: selectedTxn.method
      };

      setRefunds([newRefund, ...refunds]);
      setModalVisible(false);
      setRefundReason('');
      Alert.alert('Refund Requested', 'Your request has been filed. We will process it within 3-5 working days.');
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

         {/* Hero Wallet Card */}
         <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total Consultation Spent</Text>
            <Text style={styles.heroAmt}>₹1,100</Text>
            <Text style={styles.heroSub}>Across 3 active consultations</Text>
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

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {activeTab === 'history' ? (
               transactions.map(t => (
                  <View key={t.id} style={styles.card}>
                     <View style={styles.cardHeader}>
                        <View style={styles.iconBg}>
                           <Ionicons 
                              name={t.status === 'Refunded' ? 'refresh-circle-outline' : 'cash-outline'} 
                              size={22} 
                              color={t.status === 'Refunded' ? '#E24B4A' : TEAL} 
                           />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                           <Text style={styles.cardTitle}>{t.type}</Text>
                           <Text style={styles.cardSub}>{t.doctor}</Text>
                        </View>
                        <Text style={[styles.cardAmt, t.status === 'Refunded' && { textDecorationLine: 'line-through', color: '#888' }]}>
                           ₹{t.amount}
                        </Text>
                     </View>

                     <View style={styles.divider} />

                     <View style={styles.cardFooter}>
                        <View>
                           <Text style={styles.metaTxt}>ID: {t.id} · {t.date}</Text>
                           <Text style={styles.metaTxt}>Paid via {t.method}</Text>
                        </View>
                        
                        {t.status === 'Success' ? (
                           <View style={{ flexDirection: 'row', gap: 10 }}>
                              <TouchableOpacity 
                                 style={styles.actionBtnOutline}
                                 onPress={() => handleRequestRefund(t)}
                              >
                                 <Text style={styles.actionBtnTxt}>Refund</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                 style={styles.actionBtn}
                                 onPress={() => Alert.alert('Invoice Saved', 'Payment invoice downloaded as PDF.')}
                              >
                                 <Text style={styles.actionBtnTxtActive}>Invoice</Text>
                              </TouchableOpacity>
                           </View>
                        ) : (
                           <View style={[styles.statusBadge, t.status === 'Refunded' ? styles.statusRefunded : styles.statusProgress]}>
                              <Text style={[styles.statusBadgeTxt, t.status === 'Refunded' ? styles.statusRefundedTxt : styles.statusProgressTxt]}>
                                 {t.status}
                              </Text>
                           </View>
                        )}
                     </View>
                  </View>
               ))
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
                              <Text style={styles.cardTitle}>Refund ID: {r.id}</Text>
                              <Text style={styles.cardSub}>Ref for Txn: {r.txnId}</Text>
                           </View>
                           <Text style={styles.refundAmt}>₹{r.amount}</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.cardFooter}>
                           <View>
                              <Text style={styles.metaTxt}>Initiated: {r.date}</Text>
                              <Text style={styles.metaTxt}>Destination: {r.method}</Text>
                           </View>
                           <View style={[styles.statusBadge, r.status === 'Completed' ? styles.statusRefunded : styles.statusProgress]}>
                              <Text style={[styles.statusBadgeTxt, r.status === 'Completed' ? styles.statusRefundedTxt : styles.statusProgressTxt]}>
                                 {r.status}
                              </Text>
                           </View>
                        </View>
                     </View>
                  ))
               )
            )}
         </ScrollView>

         {/* Refund Request Modal */}
         <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Request Refund</Text>
                  <Text style={styles.modalSubtitle}>Please explain the reason for your refund request</Text>

                  <Text style={styles.label}>Refund Reason</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Appointment cancelled by doctor, duplicated billing error..."
                     value={refundReason}
                     onChangeText={setRefundReason}
                     multiline={true}
                     numberOfLines={4}
                  />

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnCancel]} 
                        onPress={() => setModalVisible(false)}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Discard</Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                        style={[styles.modalBtn, styles.modalBtnConfirm]} 
                        onPress={submitRefund}
                     >
                        <Text style={styles.modalBtnConfirmTxt}>Submit Request</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
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
   actionBtn: { backgroundColor: TEAL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
   actionBtnOutline: { borderWidth: 1, borderColor: TEAL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
   actionBtnTxt: { fontSize: 11, fontWeight: 'bold', color: TEAL },
   actionBtnTxtActive: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
   statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
   statusRefunded: { backgroundColor: '#E1F5EE' },
   statusRefundedTxt: { color: '#085041', fontSize: 11, fontWeight: 'bold' },
   statusProgress: { backgroundColor: '#FEF6E9' },
   statusProgressTxt: { color: '#B67512', fontSize: 11, fontWeight: 'bold' },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
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
