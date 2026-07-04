import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Modal,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createTicket, getMyTickets } from '../../services/patientTicketService';

const TEAL = '#1A7E8A';

export default function SupportScreen() {
   const router = useRouter();
   const [activeTab, setActiveTab] = useState('faq'); // 'faq' or 'tickets'

   // Accordion expand states
   const [expandedFaq, setExpandedFaq] = useState(null);

   // Support tickets — fetched from the backend (no more mock array).
   const [tickets, setTickets] = useState([]);
   const [ticketsLoading, setTicketsLoading] = useState(true);
   const [ticketsError, setTicketsError] = useState(null);

   // Create Ticket Modal States
   const [modalVisible, setModalVisible] = useState(false);
   const [category, setCategory] = useState('Billing');
   const [subject, setSubject] = useState('');
   const [description, setDescription] = useState('');
   const [submitting, setSubmitting] = useState(false);

   const loadTickets = async () => {
      try {
         setTicketsError(null);
         const data = await getMyTickets();
         setTickets(data ?? []);
      } catch (err) {
         setTicketsError(err.response?.data?.message || err.message || 'Failed to load tickets.');
      } finally {
         setTicketsLoading(false);
      }
   };

   // Fetch once on mount. Tickets tab reuses the same state, so no need to
   // refetch on every tab switch — pull-to-refresh could be added later.
   useEffect(() => { loadTickets(); }, []);

   const faqs = [
      { q: 'How do I cancel my appointment?', a: 'You can cancel any appointment up to 2 hours before the scheduled time. Go to My Appointments, tap the cancel button, and select your reason. The refund will be processed automatically.' },
      { q: 'When will I get my refund?', a: 'Once cancelled, the refund is initiated immediately. It typically takes 3-5 business days to reflect in your source payment account (bank account or card).' },
      { q: 'Can I choose my consultation medium?', a: 'Yes. When booking an appointment, you can choose between Video Call, Audio Call, or secure Chat consults depending on your convenience.' },
      { q: 'How do I upload past medical records?', a: 'Go to the Records screen from the bottom menu, tap "Add Record" on the top right, fill in details, attach your PDF or photo from storage, and save it securely.' },
   ];

   const toggleFaq = (idx) => {
      setExpandedFaq(expandedFaq === idx ? null : idx);
   };

   const handleCreateTicket = async () => {
      if (!subject.trim() || !description.trim()) {
         Alert.alert('Validation Error', 'Please fill in all details.');
         return;
      }

      setSubmitting(true);
      try {
         const newTicket = await createTicket({
            category,
            subject: subject.trim(),
            description: description.trim(),
         });
         setTickets(prev => [newTicket, ...prev]);
         setModalVisible(false);
         setSubject('');
         setDescription('');
         Alert.alert('Ticket Raised', 'Our support team will get in touch with you within 24 hours.');
      } catch (err) {
         Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to raise ticket.');
      } finally {
         setSubmitting(false);
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
            <Text style={styles.barTitle}>Help & Support</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
               <Ionicons name="create-outline" size={24} color={TEAL} style={{ paddingHorizontal: 10 }} />
            </TouchableOpacity>
         </View>

         {/* Navigation Tabs */}
         <View style={styles.tabRow}>
            <TouchableOpacity
               style={[styles.tab, activeTab === 'faq' && styles.tabActive]}
               onPress={() => setActiveTab('faq')}
            >
               <Text style={[styles.tabTxt, activeTab === 'faq' && styles.tabTxtActive]}>FAQs & Help</Text>
            </TouchableOpacity>
            <TouchableOpacity
               style={[styles.tab, activeTab === 'tickets' && styles.tabActive]}
               onPress={() => setActiveTab('tickets')}
            >
               <Text style={[styles.tabTxt, activeTab === 'tickets' && styles.tabTxtActive]}>My Tickets</Text>
            </TouchableOpacity>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {activeTab === 'faq' ? (
               <View>
                  <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>

                  {faqs.map((faq, idx) => {
                     const isExp = expandedFaq === idx;
                     return (
                        <TouchableOpacity
                           key={idx}
                           style={styles.faqCard}
                           onPress={() => toggleFaq(idx)}
                           activeOpacity={0.9}
                        >
                           <View style={styles.faqHeader}>
                              <Text style={styles.faqQuestion}>{faq.q}</Text>
                              <Ionicons
                                 name={isExp ? "chevron-up" : "chevron-down"}
                                 size={18}
                                 color={isExp ? TEAL : "#888"}
                              />
                           </View>
                           {isExp && (
                              <View style={styles.faqAnswerContainer}>
                                 <Text style={styles.faqAnswer}>{faq.a}</Text>
                              </View>
                           )}
                        </TouchableOpacity>
                     );
                  })}

                  {/* Contact support button */}
                  <View style={styles.contactCard}>
                     <Ionicons name="mail-open-outline" size={32} color={TEAL} />
                     <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.contactTitle}>Still need help?</Text>
                        <Text style={styles.contactSub}>Reach out to our customer care executive</Text>
                     </View>
                     <TouchableOpacity
                        style={styles.contactBtn}
                        onPress={() => Alert.alert('Contact Support', 'Email support@apnadoctor.com or Call +91 1800 123 4567')}
                     >
                        <Text style={styles.contactBtnTxt}>Contact</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            ) : ticketsLoading ? (
               <View style={styles.emptyView}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.emptyTxt}>Loading your tickets…</Text>
               </View>
            ) : ticketsError ? (
               <View style={styles.emptyView}>
                  <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>{ticketsError}</Text>
                  <TouchableOpacity onPress={loadTickets} style={styles.contactBtn}>
                     <Text style={styles.contactBtnTxt}>Retry</Text>
                  </TouchableOpacity>
               </View>
            ) : tickets.length === 0 ? (
               <View style={styles.emptyView}>
                  <Ionicons name="chatbox-ellipses-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>You haven't raised any tickets yet.</Text>
               </View>
            ) : (
               tickets.map(t => (
                  <View key={t._id ?? t.ticketId} style={styles.card}>
                     <View style={styles.cardHeader}>
                        <View style={styles.iconBg}>
                           <Text style={styles.catTxt}>{t.category?.[0]}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                           <View style={styles.row}>
                              <Text style={styles.ticketId}>ID: {t.ticketId ?? t._id}</Text>
                              <View style={[styles.statusBadge, t.status === 'Resolved' ? styles.statusResolved : t.status === 'Open' ? styles.statusOpen : styles.statusProgress]}>
                                 <Text style={[styles.statusBadgeTxt, t.status === 'Resolved' ? styles.statusResolvedTxt : t.status === 'Open' ? styles.statusOpenTxt : styles.statusProgressTxt]}>
                                    {t.status}
                                 </Text>
                              </View>
                           </View>
                           <Text style={styles.subjectTxt}>{t.subject}</Text>
                        </View>
                     </View>

                     <View style={styles.divider} />

                     <Text style={styles.descTxt}>{t.description}</Text>
                     <Text style={styles.dateTxt}>
                        Raised on: {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'} · Category: {t.category}
                     </Text>
                  </View>
               ))
            )}
         </ScrollView>

         {/* Create Ticket Modal */}
         <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Raise Support Ticket</Text>
                  <Text style={styles.modalSubtitle}>Help us understand your issue and we will resolve it quickly</Text>

                  <Text style={styles.label}>Select Category</Text>
                  <View style={styles.pickerRow}>
                     {['Billing', 'Doctor Consult', 'Records', 'Technical'].map(cat => (
                        <TouchableOpacity
                           key={cat}
                           style={[styles.opt, category === cat && styles.optActive]}
                           onPress={() => setCategory(cat)}
                        >
                           <Text style={[styles.optTxt, category === cat && styles.optTxtActive]}>{cat}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <Text style={styles.label}>Issue Subject</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Loading error, refund not received"
                     value={subject}
                     onChangeText={setSubject}
                  />

                  <Text style={styles.label}>Detailed Description</Text>
                  <TextInput
                     style={[styles.input, { textAlignVertical: 'top', height: 80 }]}
                     placeholder="Provide all context so we can resolve it easily..."
                     value={description}
                     onChangeText={setDescription}
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
                        style={[styles.modalBtn, styles.modalBtnConfirm, submitting && { opacity: 0.6 }]}
                        onPress={handleCreateTicket}
                        disabled={submitting}
                     >
                        <Text style={styles.modalBtnConfirmTxt}>{submitting ? 'Submitting…' : 'Submit Ticket'}</Text>
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
   tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#eee', borderRadius: 10, padding: 3, marginTop: 14, marginBottom: 14 },
   tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
   tabActive: { backgroundColor: '#fff', elevation: 1 },
   tabTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   tabTxtActive: { color: TEAL },
   scroll: { paddingHorizontal: 16, paddingBottom: 30 },
   sectionHeader: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, marginLeft: 4 },
   faqCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 10, overflow: 'hidden', elevation: 1 },
   faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
   faqQuestion: { fontSize: 13, fontWeight: '600', color: '#333', flex: 1, paddingRight: 10 },
   faqAnswerContainer: { backgroundColor: '#F8FCFC', paddingHorizontal: 14, paddingBottom: 14, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f9f9f9' },
   faqAnswer: { fontSize: 12.5, color: '#666', lineHeight: 18 },
   contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#d3ebeb' },
   contactTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
   contactSub: { fontSize: 11.5, color: '#666', marginTop: 2 },
   contactBtn: { backgroundColor: TEAL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
   contactBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardHeader: { flexDirection: 'row', alignItems: 'center' },
   iconBg: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   catTxt: { color: TEAL, fontWeight: 'bold', fontSize: 15 },
   row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   ticketId: { fontSize: 13, fontWeight: 'bold', color: TEAL },
   subjectTxt: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 10 },
   descTxt: { fontSize: 13, color: '#555', lineHeight: 18 },
   dateTxt: { fontSize: 11, color: '#999', marginTop: 8 },
   statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
   statusResolved: { backgroundColor: '#E1F5EE' },
   statusResolvedTxt: { color: '#085041', fontSize: 11, fontWeight: 'bold' },
   statusProgress: { backgroundColor: '#FEF6E9' },
   statusProgressTxt: { color: '#B67512', fontSize: 11, fontWeight: 'bold' },
   statusOpen: { backgroundColor: '#f0f2f5' },
   statusOpenTxt: { color: '#666', fontSize: 11, fontWeight: 'bold' },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
   modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 12, marginBottom: 6 },
   input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa', marginBottom: 6 },
   pickerRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
   opt: { flex: 1, minWidth: '40%', borderWidth: 1.5, borderColor: '#eee', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fafafa' },
   optActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   optTxt: { fontSize: 12, fontWeight: '600', color: '#666' },
   optTxtActive: { color: TEAL },
   modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 40 },
   modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },
});
