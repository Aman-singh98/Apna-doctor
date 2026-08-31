import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Modal,
   ScrollView,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
   getEmergencyContacts,
   addEmergencyContact,
   updateEmergencyContact,
   deleteEmergencyContact,
} from '../../services/emergencyContactService';
const TEAL = '#1A7E8A';

export default function EmergencyContactsScreen() {
   const router = useRouter();

   const [contacts, setContacts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);

   const RELATION_OPTIONS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'];

   const [modalVisible, setModalVisible] = useState(false);
   const [name, setName] = useState('');
   const [relation, setRelation] = useState('Spouse');
   const [customRelation, setCustomRelation] = useState('');
   const [phone, setPhone] = useState('');
   const [isEditing, setIsEditing] = useState(false);
   const [editingId, setEditingId] = useState(null);

   useEffect(() => {
      loadContacts();
   }, []);

   const loadContacts = async () => {
      try {
         setLoading(true);
         const { data } = await getEmergencyContacts();
         setContacts(data);
      } catch (err) {
         Alert.alert('Error', 'Could not load emergency contacts. Please try again.');
      } finally {
         setLoading(false);
      }
   };

   const resetForm = () => {
      setName('');
      setRelation('Spouse');
      setCustomRelation('');
      setPhone('');
      setIsEditing(false);
      setEditingId(null);
   };

   const handleDelete = (id) => {
      Alert.alert(
         'Delete Contact',
         'Are you sure you want to remove this contact?',
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete',
               style: 'destructive',
               onPress: async () => {
                  const previous = contacts;
                  // Optimistic update, rolled back on failure.
                  setContacts(contacts.filter(c => c._id !== id));
                  try {
                     await deleteEmergencyContact(id);
                  } catch (err) {
                     setContacts(previous);
                     Alert.alert('Error', 'Could not remove contact. Please try again.');
                  }
               }
            }
         ]
      );
   };

   const handleCall = (contact) => {
      Alert.alert('Calling Emergency Contact', `Dialing ${contact.name} (${contact.phone})...`);
   };

   const handleEdit = (contact) => {
      setIsEditing(true);
      setEditingId(contact._id);

      setName(contact.name);
      if (RELATION_OPTIONS.includes(contact.relation)) {
         setRelation(contact.relation);
         setCustomRelation('');
      } else {
         // Contact was saved with a relation outside the preset list —
         // select "Other" and preload the custom field with it.
         setRelation('Other');
         setCustomRelation(contact.relation);
      }
      setPhone(contact.phone);

      setModalVisible(true);
   };

   const handleSave = async () => {
      const finalRelation = relation === 'Other' ? customRelation.trim() : relation;

      if (!name.trim() || !finalRelation || !phone.trim()) {
         Alert.alert('Validation Error', 'All fields are mandatory.');
         return;
      }

      try {
         setSaving(true);

         if (isEditing) {
            const { data: updated } = await updateEmergencyContact(editingId, {
               name: name.trim(),
               relation: finalRelation,
               phone: phone.trim(),
            });

            setContacts(prev => prev.map(c => (c._id === editingId ? updated : c)));
            Alert.alert('Success', 'Emergency contact updated.');
         } else {
            const { data: newContact } = await addEmergencyContact({
               name: name.trim(),
               relation: finalRelation,
               phone: phone.trim(),
            });

            setContacts(prev => [...prev, newContact]);
            Alert.alert('Success', 'Emergency contact added.');
         }

         setModalVisible(false);
         resetForm();
      } catch (err) {
         const message = err.response?.data?.message || 'Could not save contact. Please try again.';
         Alert.alert('Error', message);
      } finally {
         setSaving(false);
      }
   };

   return (
      <SafeAreaView style={styles.safe}>
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Emergency Contacts</Text>
            <TouchableOpacity onPress={() => { resetForm(); setModalVisible(true); }}>
               <Ionicons name="add" size={26} color={TEAL} style={{ paddingHorizontal: 10 }} />
            </TouchableOpacity>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>These contacts will be notified in case of emergencies, and can be contacted instantly.</Text>

            {loading ? (
               <View style={styles.emptyView}>
                  <ActivityIndicator size="large" color={TEAL} />
               </View>
            ) : contacts.length === 0 ? (
               <View style={styles.emptyView}>
                  <Ionicons name="call-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>No emergency contacts added yet.</Text>
               </View>
            ) : (
               contacts.map(c => (
                  <View key={c._id} style={styles.card}>
                     <View style={styles.cardInfo}>
                        <View style={styles.iconBg}>
                           <Ionicons name="heart-half-outline" size={24} color="#E24B4A" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                           <View style={styles.row}>
                              <Text style={styles.name}>{c.name}</Text>
                              <View style={styles.badge}>
                                 <Text style={styles.badgeTxt}>{c.relation}</Text>
                              </View>
                           </View>
                           <Text style={styles.phoneTxt}>{c.phone}</Text>
                        </View>
                     </View>

                     <View style={styles.divider} />

                     <View style={styles.actions}>
                        <TouchableOpacity
                           style={styles.actionBtn}
                           onPress={() => handleEdit(c)}
                        >
                           <Ionicons name="create-outline" size={16} color={TEAL} />
                           <Text style={styles.editTxt}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(c._id)}>
                           <Ionicons name="trash-outline" size={16} color="#aaa" />
                           <Text style={styles.actionBtnTxtDelete}>Remove</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={() => handleCall(c)}>
                           <Ionicons name="call" size={14} color="#fff" />
                           <Text style={styles.callBtnTxt}>Call Now</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               ))
            )}
         </ScrollView>

         {/* Add / Edit Modal */}
         <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
                <SafeAreaView
                     edges={['bottom']}
                     style={styles.modalContent}
                  >
                  <Text style={styles.modalTitle}>{isEditing ? 'Edit Emergency Contact' : 'Add Emergency Contact'}</Text>
                  <Text style={styles.modalSubtitle}> {isEditing
                        ? 'Update contact details'
                        : 'Provide contact details of close family or friends'}
                  </Text>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Amit Sharma"
                     value={name}
                     onChangeText={setName}
                  />

                  <Text style={styles.label}>Relationship</Text>
                  <View style={styles.pickerRow}>
                     {RELATION_OPTIONS.map(r => (
                        <TouchableOpacity
                           key={r}
                           style={[styles.opt, relation === r && styles.optActive]}
                           onPress={() => setRelation(r)}
                        >
                           <Text style={[styles.optTxt, relation === r && styles.optTxtActive]}>{r}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  {relation === 'Other' && (
                     <TextInput
                        style={styles.input}
                        placeholder="e.g. Neighbour, Colleague"
                        value={customRelation}
                        onChangeText={setCustomRelation}
                     />
                  )}

                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. +91 98765 43210"
                     keyboardType="phone-pad"
                     value={phone}
                     onChangeText={setPhone}
                  />

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnCancel]}
                        onPress={() => {
                           setModalVisible(false);
                           resetForm();
                        }}
                        disabled={saving}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Cancel</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnConfirm]}
                        onPress={handleSave}
                        disabled={saving}
                     >
                        {saving ? (
                           <ActivityIndicator size="small" color="#fff" />
                        ) : (
                           <Text style={styles.modalBtnConfirmTxt}>{isEditing ? 'Update Contact' : 'Save Contact'}</Text>
                        )}
                     </TouchableOpacity>
                  </View>
               </SafeAreaView>
            </View>
         </Modal>

      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   scroll: { padding: 20 },
   subtitle: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 20 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardInfo: { flexDirection: 'row', alignItems: 'center' },
   iconBg: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FCEBEB', alignItems: 'center', justifyContent: 'center' },
   row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
   name: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   badge: { backgroundColor: '#f0f2f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
   badgeTxt: { fontSize: 11, fontWeight: '600', color: '#555' },
   phoneTxt: { fontSize: 13, color: '#666', marginTop: 4 },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 12 },
   actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 , paddingVertical: 6},
   actionBtnTxtDelete: { fontSize: 12, color: '#888', fontWeight: '500' },
   callBtn: { backgroundColor: '#E24B4A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
   callBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 2 },

   // Modal styling
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
   modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 12, marginBottom: 6 },
   input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa', marginBottom: 6 },
   pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
   opt: { minWidth: '30%', flexGrow: 1, borderWidth: 1.5, borderColor: '#eee', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fafafa' },
   optActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   optTxt: { fontSize: 12, fontWeight: '600', color: '#666' },
   optTxtActive: { color: TEAL },
   modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 },
   modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },
   editTxt: {fontSize: 12,  color: TEAL, fontWeight: '600', marginLeft: 4},
});
