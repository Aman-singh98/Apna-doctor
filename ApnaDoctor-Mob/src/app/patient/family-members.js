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
import { getFamilyMembers, addFamilyMember, deleteFamilyMember } from '../../services/familyMemberService';
const TEAL = '#1A7E8A';

export default function FamilyMembersScreen() {
   const router = useRouter();

   const [family, setFamily] = useState([]);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);

   const [modalVisible, setModalVisible] = useState(false);
   const [name, setName] = useState('');
   const [relation, setRelation] = useState('Spouse');
   const [age, setAge] = useState('');
   const [bloodGroup, setBloodGroup] = useState('O+');

   useEffect(() => {
      loadFamily();
   }, []);

   const loadFamily = async () => {
      try {
         setLoading(true);
         const { data } = await getFamilyMembers();
         setFamily(data);
      } catch (err) {
         Alert.alert('Error', 'Could not load family members. Please try again.');
      } finally {
         setLoading(false);
      }
   };

   const handleAdd = async () => {
      if (!name.trim() || !age.trim()) {
         Alert.alert('Validation Error', 'Please enter Name and Age.');
         return;
      }

      try {
         setSaving(true);
         const { data: newMember } = await addFamilyMember({
            name: name.trim(),
            relation,
            age: age.trim(),
            bloodGroup: bloodGroup.trim(),
         });

         setFamily(prev => [...prev, newMember]);
         setModalVisible(false);
         setName('');
         setRelation('Spouse');
         setAge('');
         setBloodGroup('O+');
         Alert.alert('Success', 'Family profile added.');
      } catch (err) {
         const message = err.response?.data?.message || 'Could not add family member. Please try again.';
         Alert.alert('Error', message);
      } finally {
         setSaving(false);
      }
   };

   const handleDelete = (id) => {
      Alert.alert(
         'Remove Profile',
         'Are you sure you want to remove this family member?',
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Remove',
               style: 'destructive',
               onPress: async () => {
                  const previous = family;
                  // Optimistic update, rolled back on failure.
                  setFamily(family.filter(f => f._id !== id));
                  try {
                     await deleteFamilyMember(id);
                  } catch (err) {
                     setFamily(previous);
                     Alert.alert('Error', 'Could not remove family member. Please try again.');
                  }
               }
            }
         ]
      );
   };

   return (
      <SafeAreaView style={styles.safe}>
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Family Members</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
               <Ionicons name="add" size={26} color={TEAL} style={{ paddingHorizontal: 10 }} />
            </TouchableOpacity>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>Add family profiles to book and track doctor consultations for them easily.</Text>

            {loading ? (
               <View style={styles.emptyView}>
                  <ActivityIndicator size="large" color={TEAL} />
               </View>
            ) : family.length === 0 ? (
               <View style={styles.emptyView}>
                  <Ionicons name="people-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyTxt}>No family members added yet.</Text>
               </View>
            ) : (
               family.map(f => (
                  <View key={f._id} style={styles.card}>
                     <View style={styles.cardInfo}>
                        <View style={styles.avatar}>
                           <Text style={styles.avatarTxt}>{f.name.split(' ').map(w => w[0]).join('')}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                           <View style={styles.row}>
                              <Text style={styles.name}>{f.name}</Text>
                              <View style={styles.badge}>
                                 <Text style={styles.badgeTxt}>{f.relation}</Text>
                              </View>
                           </View>
                           <Text style={styles.detailsTxt}>Age: {f.age} Years · Blood Group: {f.bloodGroup || '—'}</Text>
                        </View>
                     </View>

                     <View style={styles.divider} />

                     <View style={styles.actions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(f._id)}>
                           <Ionicons name="trash-outline" size={16} color="#E24B4A" />
                           <Text style={styles.actionBtnTxt}>Remove Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                           style={[styles.actionBtn, styles.bookBtn]}
                           onPress={() => router.push({ pathname: '/patient/doctor-list', params: { patientId: f._id, patientName: f.name } })}
                        >
                           <Ionicons name="calendar-outline" size={14} color={TEAL} />
                           <Text style={styles.bookBtnTxt}>Book Appointment</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               ))
            )}
         </ScrollView>

         {/* Add Modal */}
         <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Add Family Member</Text>
                  <Text style={styles.modalSubtitle}>Create a patient sub-profile for booking</Text>

                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Kiran Sharma"
                     value={name}
                     onChangeText={setName}
                  />

                  <Text style={styles.label}>Relation Type</Text>
                  <View style={styles.pickerRow}>
                     {['Spouse', 'Child', 'Parent', 'Sibling'].map(r => (
                        <TouchableOpacity
                           key={r}
                           style={[styles.opt, relation === r && styles.optActive]}
                           onPress={() => setRelation(r)}
                        >
                           <Text style={[styles.optTxt, relation === r && styles.optTxtActive]}>{r}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <View style={styles.doubleRow}>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Age (in Years)</Text>
                        <TextInput
                           style={styles.input}
                           placeholder="e.g. 27"
                           keyboardType="number-pad"
                           value={age}
                           onChangeText={setAge}
                        />
                     </View>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Blood Group</Text>
                        <TextInput
                           style={styles.input}
                           placeholder="e.g. O+"
                           value={bloodGroup}
                           onChangeText={setBloodGroup}
                        />
                     </View>
                  </View>

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnCancel]}
                        onPress={() => setModalVisible(false)}
                        disabled={saving}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Cancel</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnConfirm]}
                        onPress={handleAdd}
                        disabled={saving}
                     >
                        {saving ? (
                           <ActivityIndicator size="small" color="#fff" />
                        ) : (
                           <Text style={styles.modalBtnConfirmTxt}>Save Profile</Text>
                        )}
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
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   scroll: { padding: 20 },
   subtitle: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 20 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardInfo: { flexDirection: 'row', alignItems: 'center' },
   avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' },
   avatarTxt: { fontSize: 14, fontWeight: 'bold', color: '#085041' },
   row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
   name: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' },
   badge: { backgroundColor: '#E8F5F7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
   badgeTxt: { fontSize: 11, fontWeight: '600', color: TEAL },
   detailsTxt: { fontSize: 13, color: '#666', marginTop: 4 },
   divider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 12 },
   actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
   actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   actionBtnTxt: { fontSize: 12, color: '#E24B4A', fontWeight: '600' },
   bookBtn: { borderWidth: 1.5, borderColor: TEAL, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
   bookBtnTxt: { color: TEAL, fontSize: 12, fontWeight: 'bold', marginLeft: 2 },

   // Modal styling
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
   modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 12, marginBottom: 6 },
   input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa', marginBottom: 6 },
   pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
   opt: { flex: 1, borderWidth: 1.5, borderColor: '#eee', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fafafa' },
   optActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   optTxt: { fontSize: 12, fontWeight: '600', color: '#666' },
   optTxtActive: { color: TEAL },
   doubleRow: { flexDirection: 'row', gap: 10 },
   modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 },
   modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },
});
