import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyMedicalHistory, updateMyMedicalHistory } from '../../services/medicalHistoryService';
const TEAL = '#1A7E8A';

export default function MedicalHistoryScreen() {
   const router = useRouter();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);

   // Chronic Conditions state
   const [conditions, setConditions] = useState([]);
   const [newCondition, setNewCondition] = useState('');

   // Allergies state
   const [allergies, setAllergies] = useState([]);
   const [newAllergy, setNewAllergy] = useState('');

   // Medications state
   const [medications, setMedications] = useState([]);
   const [newMed, setNewMed] = useState('');

   useEffect(() => {
      (async () => {
         try {
            const res = await getMyMedicalHistory();
            setConditions(res.data.conditions);
            setAllergies(res.data.allergies);
            setMedications(res.data.medications);
         } catch (err) {
            Alert.alert('Error', err.response?.data?.message || err.message || 'Could not load medical history');
         } finally {
            setLoading(false);
         }
      })();
   }, []);

   const addCondition = () => {
      if (!newCondition.trim()) return;
      if (conditions.includes(newCondition.trim())) {
         Alert.alert('Duplicate', 'This condition is already listed.');
         return;
      }
      setConditions([...conditions, newCondition.trim()]);
      setNewCondition('');
   };

   const removeCondition = (idx) => {
      setConditions(conditions.filter((_, i) => i !== idx));
   };

   const addAllergy = () => {
      if (!newAllergy.trim()) return;
      if (allergies.includes(newAllergy.trim())) {
         Alert.alert('Duplicate', 'This allergy is already listed.');
         return;
      }
      setAllergies([...allergies, newAllergy.trim()]);
      setNewAllergy('');
   };

   const removeAllergy = (idx) => {
      setAllergies(allergies.filter((_, i) => i !== idx));
   };

   const addMedication = () => {
      if (!newMed.trim()) return;
      if (medications.includes(newMed.trim())) {
         Alert.alert('Duplicate', 'This medication is already listed.');
         return;
      }
      setMedications([...medications, newMed.trim()]);
      setNewMed('');
   };

   const removeMedication = (idx) => {
      setMedications(medications.filter((_, i) => i !== idx));
   };

   const handleSave = async () => {
      setSaving(true);
      try {
         await updateMyMedicalHistory({ conditions, allergies, medications });
         Alert.alert('Saved', 'Medical history updated successfully.', [
            { text: 'OK', onPress: () => router.back() }
         ]);
      } catch (err) {
         Alert.alert('Error', err.response?.data?.message || err.message || 'Could not save medical history');
      } finally {
         setSaving(false);
      }
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={"#fff"} />
         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Medical History</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || loading}>
               <Text style={styles.saveHeaderTxt}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
         </View>

         {loading ? (
            <View style={styles.loadingView}>
               <ActivityIndicator size="large" color={TEAL} />
            </View>
         ) : (
         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>Provide your health profile to help doctors suggest better diagnoses.</Text>

            {/* Chronic Conditions */}
            <View style={styles.sectionCard}>
               <Text style={styles.sectionTitle}>Chronic Conditions</Text>
               <View style={styles.inputRow}>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Asthma, Thyroid"
                     value={newCondition}
                     onChangeText={setNewCondition}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addCondition}>
                     <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
               </View>

               <View style={styles.tagsContainer}>
                  {conditions.length === 0 ? (
                     <Text style={styles.emptyTxt}>No chronic conditions added.</Text>
                  ) : (
                     conditions.map((item, idx) => (
                        <View key={item} style={styles.tag}>
                           <Text style={styles.tagTxt}>{item}</Text>
                           <TouchableOpacity onPress={() => removeCondition(idx)}>
                              <Ionicons name="close" size={14} color={TEAL} style={{ marginLeft: 6 }} />
                           </TouchableOpacity>
                        </View>
                     ))
                  )}
               </View>
            </View>

            {/* Allergies */}
            <View style={styles.sectionCard}>
               <Text style={styles.sectionTitle}>Allergies</Text>
               <View style={styles.inputRow}>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Pollen, Sulfa Drugs"
                     value={newAllergy}
                     onChangeText={setNewAllergy}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addAllergy}>
                     <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
               </View>

               <View style={styles.tagsContainer}>
                  {allergies.length === 0 ? (
                     <Text style={styles.emptyTxt}>No allergies listed.</Text>
                  ) : (
                     allergies.map((item, idx) => (
                        <View key={item} style={[styles.tag, styles.allergyTag]}>
                           <Text style={[styles.tagTxt, styles.allergyTagTxt]}>{item}</Text>
                           <TouchableOpacity onPress={() => removeAllergy(idx)}>
                              <Ionicons name="close" size={14} color="#E24B4A" style={{ marginLeft: 6 }} />
                           </TouchableOpacity>
                        </View>
                     ))
                  )}
               </View>
            </View>

            {/* Current Medications */}
            <View style={styles.sectionCard}>
               <Text style={styles.sectionTitle}>Current Medications</Text>
               <View style={styles.inputRow}>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Paracetamol 500mg"
                     value={newMed}
                     onChangeText={setNewMed}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addMedication}>
                     <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
               </View>

               <View style={styles.medsList}>
                  {medications.length === 0 ? (
                     <Text style={styles.emptyTxt}>No medications listed.</Text>
                  ) : (
                     medications.map((item, idx) => (
                        <View key={item} style={styles.medRow}>
                           <Ionicons name="medical" size={16} color={TEAL} style={{ marginRight: 10 }} />
                           <Text style={styles.medTxt}>{item}</Text>
                           <TouchableOpacity onPress={() => removeMedication(idx)} style={styles.medDelete}>
                              <Ionicons name="trash-outline" size={16} color="#aaa" />
                           </TouchableOpacity>
                        </View>
                     ))
                  )}
               </View>
            </View>

            {/* Bottom Save Action */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
               {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
               ) : (
                  <Text style={styles.saveBtnTxt}>Save History</Text>
               )}
            </TouchableOpacity>

         </ScrollView>
         )}
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   loadingView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   saveHeaderTxt: { color: TEAL, fontSize: 15, fontWeight: 'bold', paddingHorizontal: 10 },
   scroll: { padding: 20 },
   subtitle: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 20 },
   sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
   inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
   input: { flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#333', backgroundColor: '#fafafa' },
   addBtn: { backgroundColor: TEAL, width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
   tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: '#CBEBE3' },
   tagTxt: { fontSize: 12, fontWeight: '600', color: TEAL },
   allergyTag: { backgroundColor: '#FCEBEB', borderColor: '#F5C9C9' },
   allergyTagTxt: { color: '#E24B4A' },
   emptyTxt: { fontSize: 12, color: '#999', fontStyle: 'italic', paddingVertical: 4 },
   medsList: { gap: 8 },
   medRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', padding: 10, borderRadius: 8, borderWidth: 0.5, borderColor: '#eee' },
   medTxt: { fontSize: 13, color: '#333', fontWeight: '500', flex: 1 },
   medDelete: { padding: 4 },
   saveBtn: { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 24 },
   saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
