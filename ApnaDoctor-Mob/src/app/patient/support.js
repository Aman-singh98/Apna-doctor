import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   KeyboardAvoidingView,
   Linking,
   Modal,
   Platform,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
   addTicketReply,
   createTicket,
   getMyTickets,
   getTicketById,
} from '../../services/patientTicketService';

const TEAL = '#1A7E8A';

const SUPPORT_PHONE = '8278288099';
const SUPPORT_EMAIL = 'apdcare77@gmail.com';

const CATEGORIES = ['Billing', 'Doctor Consult', 'Records', 'Technical'];

const STATUS_STYLES = {
   Open: { bg: '#f0f2f5', fg: '#666' },
   'In Progress': { bg: '#FEF6E9', fg: '#B67512' },
   Resolved: { bg: '#E1F5EE', fg: '#085041' },
};

const faqs = [
   { q: 'How do I cancel my appointment?', a: 'You can cancel any appointment up to 2 hours before the scheduled time. Go to My Appointments, tap the cancel button, and select your reason. The refund will be processed automatically.' },
   { q: 'When will I get my refund?', a: 'Once cancelled, the refund is initiated immediately. It typically takes 3-5 business days to reflect in your source payment account (bank account or card).' },
   { q: 'Can I choose my consultation medium?', a: 'Yes. When booking an appointment, you can choose between Video Call, Audio Call, or secure Chat consults depending on your convenience.' },
   { q: 'How do I upload past medical records?', a: 'Go to the Records screen from the bottom menu, tap "Add Record" on the top right, fill in details, attach your PDF or photo from storage, and save it securely.' },
];

// Formats a backend ISO date string into the "24 Jun 2026" style used elsewhere in the app.
function formatDate(isoDate) {
   if (!isoDate) return '—';
   const d = new Date(isoDate);
   if (Number.isNaN(d.getTime())) return '—';
   return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(isoDate) {
   if (!isoDate) return '—';
   const d = new Date(isoDate);
   if (Number.isNaN(d.getTime())) return '—';
   return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SupportScreen() {
   const router = useRouter();
   const [openFaq, setOpenFaq] = useState(null);
   const [activeTab, setActiveTab] = useState('support'); // 'support' | 'ticket'
   const [modalVisible, setModalVisible] = useState(false); // create-ticket modal

   // ── New ticket form ──────────────────────────────────────────────────
   const [category, setCategory] = useState('');
   const [subject, setSubject] = useState('');
   const [description, setDescription] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const [errors, setErrors] = useState({ category: '', subject: '', description: '' });

   const clearError = (field) => {
      setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev));
   };

   const validate = () => {
      const next = { category: '', subject: '', description: '' };
      let isValid = true;
      if (!category) {
         next.category = 'Please choose a category.';
         isValid = false;
      }
      if (!subject.trim()) {
         next.subject = 'Subject is required.';
         isValid = false;
      }
      if (!description.trim()) {
         next.description = 'Please describe your issue.';
         isValid = false;
      }
      setErrors(next);
      return isValid;
   };

   const handleSubmit = async () => {
      if (!validate()) return;
      setSubmitting(true);
      try {
         const ticket = await createTicket({ category, subject: subject.trim(), description: description.trim() });
         setCategory('');
         setSubject('');
         setDescription('');
         setErrors({ category: '', subject: '', description: '' });
         setTickets(prev => [ticket, ...prev]);
         setModalVisible(false);
         Alert.alert(
            'Ticket Submitted',
            `Ticket ${ticket.ticketId || ''} has been raised. Our support team will get back to you within 24 hours.`
         );
      } catch (err) {
         Alert.alert('Error', err.response?.data?.message || err.message || 'Could not submit your ticket. Please try again.');
      } finally {
         setSubmitting(false);
      }
   };

   // ── My tickets list ──────────────────────────────────────────────────
   const [tickets, setTickets] = useState([]);
   const [ticketsLoading, setTicketsLoading] = useState(true);
   const [ticketsRefreshing, setTicketsRefreshing] = useState(false);
   const [ticketsError, setTicketsError] = useState(null);

   const loadTickets = useCallback(async ({ silent = false } = {}) => {
      if (!silent) setTicketsLoading(true);
      setTicketsError(null);
      try {
         const data = await getMyTickets();
         setTickets(Array.isArray(data) ? data : []);
      } catch (err) {
         setTicketsError(err.response?.data?.message || err.message || 'Could not load your tickets. Pull down to try again.');
      } finally {
         setTicketsLoading(false);
         setTicketsRefreshing(false);
      }
   }, []);

   // Refetch every time this screen gains focus, so a newly submitted or
   // replied-to ticket is reflected without a manual refresh — same as
   // the doctor app's support screen.
   useFocusEffect(
      useCallback(() => {
         loadTickets({ silent: true });
      }, [loadTickets])
   );

   function handleRefreshTickets() {
      setTicketsRefreshing(true);
      loadTickets({ silent: true });
   }

   // ── Ticket detail / reply thread modal ──────────────────────────────
   // This is the piece that was missing on the patient side: tapping a
   // ticket now opens its full conversation with the admin/support team,
   // same as app/doctor/support.js.
   const [detailVisible, setDetailVisible] = useState(false);
   const [selectedTicket, setSelectedTicket] = useState(null);
   const [detailLoading, setDetailLoading] = useState(false);
   const [replyMessage, setReplyMessage] = useState('');
   const [sendingReply, setSendingReply] = useState(false);

   const openTicket = async (ticket) => {
      setSelectedTicket(ticket);
      setDetailVisible(true);
      setDetailLoading(true);
      try {
         const fresh = await getTicketById(ticket._id);
         setSelectedTicket(fresh);
      } catch (err) {
         Alert.alert('Error', 'Could not load the latest replies for this ticket.');
      } finally {
         setDetailLoading(false);
      }
   };

   const closeDetail = () => {
      setDetailVisible(false);
      setSelectedTicket(null);
      setReplyMessage('');
   };

   const handleSendReply = async () => {
      if (!replyMessage.trim() || !selectedTicket) return;
      setSendingReply(true);
      try {
         const updated = await addTicketReply(selectedTicket._id, replyMessage.trim());
         setSelectedTicket(updated);
         setTickets(prev => prev.map(t => (t._id === updated._id ? updated : t)));
         setReplyMessage('');
      } catch (err) {
         Alert.alert('Error', 'Could not send your reply. Please try again.');
      } finally {
         setSendingReply(false);
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
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
               <Ionicons name="add-circle-outline" size={26} color={TEAL} />
            </TouchableOpacity>
         </View>

         {/* Tabs */}
         <View style={styles.tabRow}>
            <TouchableOpacity
               style={[styles.tab, activeTab === 'support' && styles.tabActive]}
               onPress={() => setActiveTab('support')}
            >
               <Text style={[styles.tabTxt, activeTab === 'support' && styles.tabTxtActive]}>FAQs & Help</Text>
            </TouchableOpacity>
            <TouchableOpacity
               style={[styles.tab, activeTab === 'ticket' && styles.tabActive]}
               onPress={() => setActiveTab('ticket')}
            >
               <Text style={[styles.tabTxt, activeTab === 'ticket' && styles.tabTxtActive]}>My Tickets</Text>
            </TouchableOpacity>
         </View>

         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
               {activeTab === 'support' ? (
                  <View>
                     {/* Hero */}
                     <View style={styles.heroCard}>
                        <MaterialCommunityIcons name="headset" size={40} color="#fff" />
                        <Text style={styles.heroTitle}>We're here to help</Text>
                        <Text style={styles.heroSub}>Browse FAQs or raise a support ticket below</Text>
                        <View style={styles.availableBadge}>
                           <View style={styles.availableDot} />
                           <Text style={styles.availableBadgeText}>Available 24×7</Text>
                        </View>
                     </View>

                     {/* Quick Contact */}
                     <View style={styles.quickRow}>
                        <TouchableOpacity
                           style={styles.quickBtn}
                           onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
                        >
                           <View style={styles.quickIconBg}>
                              <Ionicons name="mail-outline" size={22} color={TEAL} />
                           </View>
                           <Text style={styles.quickBtnLabel}>Email Us</Text>
                           <Text style={styles.quickBtnSub}>{SUPPORT_EMAIL}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                           style={styles.quickBtn}
                           onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
                        >
                           <View style={styles.quickIconBg}>
                              <Ionicons name="call-outline" size={22} color={TEAL} />
                           </View>
                           <Text style={styles.quickBtnLabel}>Call Us</Text>
                           <Text style={styles.quickBtnSub}>{SUPPORT_PHONE}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickBtn} onPress={() => setActiveTab('ticket')}>
                           <View style={styles.quickIconBg}>
                              <Ionicons name="chatbubbles-outline" size={22} color={TEAL} />
                           </View>
                           <Text style={styles.quickBtnLabel}>My Tickets</Text>
                        </TouchableOpacity>
                     </View>

                     {/* FAQs */}
                     <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
                     {faqs.map((faq, idx) => {
                        const isExp = openFaq === idx;
                        return (
                           <TouchableOpacity
                              key={idx}
                              style={styles.faqCard}
                              onPress={() => setOpenFaq(isExp ? null : idx)}
                              activeOpacity={0.85}
                           >
                              <View style={styles.faqHeader}>
                                 <Text style={[styles.faqQuestion, isExp && styles.faqQActive]}>{faq.q}</Text>
                                 <Ionicons
                                    name={isExp ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color={isExp ? TEAL : '#aaa'}
                                 />
                              </View>
                              {isExp && (
                                 <Text style={styles.faqAnswer}>{faq.a}</Text>
                              )}
                           </TouchableOpacity>
                        );
                     })}

                     <Text style={styles.footerNote}>Support available 24×7 · {SUPPORT_PHONE} · {SUPPORT_EMAIL}</Text>
                  </View>
               ) : (
                  <View>
                     {/* My Tickets */}
                     <Text style={styles.sectionHeader}>My Tickets</Text>
                     {ticketsLoading ? (
                        <View style={styles.emptyView}>
                           <ActivityIndicator size="small" color={TEAL} />
                           <Text style={styles.emptyTxt}>Loading your tickets...</Text>
                        </View>
                     ) : ticketsError ? (
                        <View style={styles.emptyView}>
                           <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
                           <Text style={styles.emptyTxt}>{ticketsError}</Text>
                           <TouchableOpacity style={styles.retryBtn} onPress={() => loadTickets()}>
                              <Text style={styles.retryTxt}>Retry</Text>
                           </TouchableOpacity>
                        </View>
                     ) : tickets.length === 0 ? (
                        <View style={styles.emptyView}>
                           <Ionicons name="chatbox-ellipses-outline" size={48} color="#ccc" />
                           <Text style={styles.emptyTxt}>You haven't raised any tickets yet.</Text>
                        </View>
                     ) : (
                        <>
                           {ticketsRefreshing && (
                              <ActivityIndicator size="small" color={TEAL} style={{ marginBottom: 8 }} />
                           )}
                           {tickets.map(t => {
                              const statusStyle = STATUS_STYLES[t.status] || STATUS_STYLES.Open;
                              return (
                                 <TouchableOpacity key={t._id} style={styles.card} activeOpacity={0.85} onPress={() => openTicket(t)}>
                                    <View style={styles.row}>
                                       <View style={{ flex: 1 }}>
                                          <Text style={styles.ticketId}>{t.ticketId}</Text>
                                          <Text style={styles.subjectTxt}>{t.subject}</Text>
                                       </View>
                                       <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                          <Text style={[styles.statusBadgeTxt, { color: statusStyle.fg }]}>{t.status}</Text>
                                       </View>
                                    </View>
                                    <View style={styles.divider} />
                                    <Text style={styles.descTxt} numberOfLines={2}>{t.description}</Text>
                                    <View style={styles.cardFooter}>
                                       <View style={styles.footerItem}>
                                          <Ionicons name="pricetag-outline" size={12} color="#888" />
                                          <Text style={styles.footerTxt}>{t.category}</Text>
                                       </View>
                                       <View style={styles.footerItem}>
                                          <Ionicons name="calendar-outline" size={12} color="#888" />
                                          <Text style={styles.footerTxt}>{formatDate(t.createdAt)}</Text>
                                       </View>
                                       <View style={styles.footerItem}>
                                          <Ionicons name="chatbubble-ellipses-outline" size={12} color="#888" />
                                          <Text style={styles.footerTxt}>{(t.replies || []).length}</Text>
                                       </View>
                                    </View>
                                 </TouchableOpacity>
                              );
                           })}
                           <TouchableOpacity style={styles.refreshLink} onPress={handleRefreshTickets}>
                              <Ionicons name="refresh" size={13} color={TEAL} />
                              <Text style={styles.refreshLinkTxt}>Refresh</Text>
                           </TouchableOpacity>
                        </>
                     )}
                  </View>
               )}
            </ScrollView>
         </KeyboardAvoidingView>

         {/* Ticket Detail / Reply Thread Modal — this is the conversation
             with admin support that was missing on the patient side. */}
         <Modal visible={detailVisible} transparent animationType="slide" onRequestClose={closeDetail}>
            <View style={styles.detailOverlay}>
               <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
                  <SafeAreaView edges={['bottom']} style={styles.detailSheet}>
                     <View style={styles.modalHandle} />
                     {selectedTicket && (
                        <>
                           <View style={styles.detailHeaderRow}>
                              <View style={{ flex: 1 }}>
                                 <Text style={styles.detailTicketId}>{selectedTicket.ticketId}</Text>
                                 <Text style={styles.detailSubject}>{selectedTicket.subject}</Text>
                              </View>
                              {(() => {
                                 const s = STATUS_STYLES[selectedTicket.status] || STATUS_STYLES.Open;
                                 return (
                                    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                                       <Text style={[styles.statusBadgeTxt, { color: s.fg }]}>{selectedTicket.status}</Text>
                                    </View>
                                 );
                              })()}
                           </View>
                           <Text style={styles.detailMeta}>{selectedTicket.category} · Raised {formatDate(selectedTicket.createdAt)}</Text>

                           {detailLoading ? (
                              <View style={styles.emptyView}>
                                 <ActivityIndicator size="small" color={TEAL} />
                              </View>
                           ) : (
                              <ScrollView style={styles.detailScroll} keyboardShouldPersistTaps="handled">
                                 <View style={styles.threadBubbleWrap}>
                                    <View style={[styles.threadBubble, styles.threadBubbleSelf]}>
                                       <Text style={styles.threadBubbleTxt}>{selectedTicket.description}</Text>
                                    </View>
                                    <Text style={styles.threadTimeSelf}>You · {formatDateTime(selectedTicket.createdAt)}</Text>
                                 </View>

                                 {(selectedTicket.replies || []).map((r) => {
                                    const isMine = r.sender === 'patient';
                                    return (
                                       <View key={r._id} style={styles.threadBubbleWrap}>
                                          <View style={[styles.threadBubble, isMine ? styles.threadBubbleSelf : styles.threadBubbleOther]}>
                                             <Text style={[styles.threadBubbleTxt, !isMine && styles.threadBubbleTxtOther]}>{r.message}</Text>
                                          </View>
                                          <Text style={isMine ? styles.threadTimeSelf : styles.threadTimeOther}>
                                             {isMine ? 'You' : (r.senderName || 'Support Team')} · {formatDateTime(r.createdAt)}
                                          </Text>
                                       </View>
                                    );
                                 })}
                              </ScrollView>
                           )}

                           <View style={styles.replyRow}>
                              <TextInput
                                 style={styles.replyInput}
                                 value={replyMessage}
                                 onChangeText={setReplyMessage}
                                 placeholder="Type a reply..."
                                 placeholderTextColor="#aaa"
                                 multiline
                              />
                              <TouchableOpacity
                                 style={[styles.replySendBtn, (!replyMessage.trim() || sendingReply) && styles.submitBtnDisabled]}
                                 onPress={handleSendReply}
                                 disabled={!replyMessage.trim() || sendingReply}
                              >
                                 {sendingReply ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                 ) : (
                                    <Ionicons name="send" size={16} color="#fff" />
                                 )}
                              </TouchableOpacity>
                           </View>
                        </>
                     )}
                     <TouchableOpacity style={styles.closeDetailBtn} onPress={closeDetail}>
                        <Text style={styles.closeDetailTxt}>Close</Text>
                     </TouchableOpacity>
                  </SafeAreaView>
               </KeyboardAvoidingView>
            </View>
         </Modal>

         {/* Create Ticket Modal */}
         <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
         >
            <View style={styles.detailOverlay}>
               <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
                  <SafeAreaView edges={['bottom']} style={styles.detailSheet}>
                     <View style={styles.modalHandle} />
                     <Text style={styles.detailSubject}>Raise a Support Ticket</Text>
                     <Text style={[styles.detailMeta, { marginTop: 4 }]}>
                        Help us understand your issue and we'll resolve it quickly
                     </Text>

                     <ScrollView keyboardShouldPersistTaps="handled">
                        <Text style={styles.label}>Category</Text>
                        <View style={styles.pickerRow}>
                           {CATEGORIES.map(c => (
                              <TouchableOpacity
                                 key={c}
                                 style={[styles.opt, category === c && styles.optActive]}
                                 onPress={() => { setCategory(c); clearError('category'); }}
                              >
                                 <Text style={[styles.optTxt, category === c && styles.optTxtActive]}>{c}</Text>
                              </TouchableOpacity>
                           ))}
                        </View>
                        {!!errors.category && <Text style={styles.errorTxt}>{errors.category}</Text>}

                        <Text style={[styles.label, { marginTop: 14 }]}>Subject</Text>
                        <TextInput
                           style={[styles.input, !!errors.subject && styles.fieldError]}
                           value={subject}
                           onChangeText={(v) => { setSubject(v); clearError('subject'); }}
                           placeholder="e.g. Loading error, refund not received"
                           placeholderTextColor="#bbb"
                           maxLength={150}
                        />
                        {!!errors.subject && <Text style={styles.errorTxt}>{errors.subject}</Text>}

                        <Text style={[styles.label, { marginTop: 14 }]}>Detailed Description</Text>
                        <TextInput
                           style={[styles.input, { textAlignVertical: 'top', height: 100 }, !!errors.description && styles.fieldError]}
                           value={description}
                           onChangeText={(v) => { setDescription(v); clearError('description'); }}
                           multiline
                           numberOfLines={5}
                           placeholder="Provide all context so we can resolve it easily..."
                           placeholderTextColor="#bbb"
                           maxLength={2000}
                        />
                        {!!errors.description && <Text style={styles.errorTxt}>{errors.description}</Text>}

                        <TouchableOpacity
                           style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                           onPress={handleSubmit}
                           disabled={submitting}
                        >
                           {submitting ? (
                              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                           ) : (
                              <Ionicons name="send-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
                           )}
                           <Text style={styles.submitBtnTxt}>{submitting ? 'Submitting...' : 'Submit Ticket'}</Text>
                        </TouchableOpacity>
                     </ScrollView>

                     <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setModalVisible(false)}>
                        <Text style={styles.closeDetailTxt}>Cancel</Text>
                     </TouchableOpacity>
                  </SafeAreaView>
               </KeyboardAvoidingView>
            </View>
         </Modal>

      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#eee', borderRadius: 10, padding: 3, marginTop: 14, marginBottom: 14 },
   tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
   tabActive: { backgroundColor: '#fff', elevation: 1 },
   tabTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   tabTxtActive: { color: TEAL },
   scroll: { paddingHorizontal: 16, paddingBottom: 30 },

   heroCard: { backgroundColor: TEAL, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
   availableBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12, gap: 6 },
   availableDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CD964' },
   availableBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
   heroTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 10 },
   heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },
   quickRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
   quickBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   quickIconBg: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
   quickBtnLabel: { fontSize: 12, fontWeight: '600', color: '#333' },
   quickBtnSub: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },

   sectionHeader: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, marginLeft: 4 },
   faqCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
   faqQuestion: { flex: 1, fontSize: 13, fontWeight: '600', color: '#333', marginRight: 10, lineHeight: 19 },
   faqQActive: { color: TEAL },
   faqAnswer: { fontSize: 12.5, color: '#666', marginTop: 10, lineHeight: 19 },
   footerNote: { textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 8, marginBottom: 4 },

   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
   ticketId: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 0.5 },
   subjectTxt: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 10 },
   descTxt: { fontSize: 13, color: '#555', lineHeight: 18 },
   cardFooter: { flexDirection: 'row', gap: 14, marginTop: 10 },
   footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   footerTxt: { fontSize: 12, color: '#888' },
   statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
   statusBadgeTxt: { fontSize: 11, fontWeight: '700' },
   refreshLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
   refreshLinkTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   retryBtn: { marginTop: 12, borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 18, paddingVertical: 7, borderRadius: 10 },
   retryTxt: { color: TEAL, fontWeight: '700', fontSize: 12 },

   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center' },

   // Create-ticket form fields (shared by the Create Ticket modal)
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
   input: { fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#eee', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fafafa' },
   pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   opt: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#eee', backgroundColor: '#fafafa' },
   optActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   optTxt: { fontSize: 12, fontWeight: '600', color: '#888' },
   optTxtActive: { color: TEAL },
   fieldError: { borderColor: '#E24B4A' },
   errorTxt: { fontSize: 11, color: '#E24B4A', marginTop: 6 },
   submitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14, marginTop: 16, elevation: 2, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   submitBtnDisabled: { opacity: 0.6 },
   submitBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

   // Detail / reply-thread sheet — shared by both modals
   detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
   detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
   modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16 },
   detailHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
   detailTicketId: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 0.5 },
   detailSubject: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
   detailMeta: { fontSize: 12, color: '#888', marginTop: 8, marginBottom: 12 },
   detailScroll: { maxHeight: 320, marginBottom: 12 },
   threadBubbleWrap: { marginBottom: 14 },
   threadBubble: { borderRadius: 14, padding: 12, maxWidth: '90%' },
   threadBubbleSelf: { backgroundColor: '#E8F5F7', alignSelf: 'flex-end' },
   threadBubbleOther: { backgroundColor: '#f5f5f5', alignSelf: 'flex-start' },
   threadBubbleTxt: { fontSize: 13, color: '#1a1a1a', lineHeight: 19 },
   threadBubbleTxtOther: { color: '#333' },
   threadTimeSelf: { fontSize: 11, color: '#aaa', marginTop: 4, textAlign: 'right' },
   threadTimeOther: { fontSize: 11, color: '#aaa', marginTop: 4, textAlign: 'left' },
   replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
   replyInput: { flex: 1, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#eee', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fafafa', maxHeight: 90 },
   replySendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
   closeDetailBtn: { backgroundColor: '#f0f0f0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
   closeDetailTxt: { color: '#555', fontWeight: 'bold', fontSize: 14 },
});
