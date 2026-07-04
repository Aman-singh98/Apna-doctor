import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   KeyboardAvoidingView,
   Modal,
   Platform,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
   createPrescription,
   getPrescriptionById,
   updatePrescription,
} from '../../../src/services/prescriptionService';
import { getPatients } from '../../../src/services/patientService';

const TEAL = '#1A7E8A';

const MEDICINE_SUGGESTIONS = [
   'Metoprolol 25mg', 'Aspirin 75mg', 'Atorvastatin 10mg',
   'Amlodipine 5mg', 'Ramipril 5mg', 'Digoxin 0.25mg',
];

export default function PrescriptionWriteScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const isEditMode = !!params.editMode && !!params.id;

   const [patientName, setPatientName] = useState(params.patientName || '');
   const [patientPhone, setPatientPhone] = useState(params.patientPhone || '');
   const [selectedPatientId, setSelectedPatientId] = useState(params.patientId || null);
   const [diagnosis, setDiagnosis] = useState(params.diagnosis || '');
   const [notes, setNotes] = useState('');
   const [followUp, setFollowUp] = useState('');
   const [loadingExisting, setLoadingExisting] = useState(isEditMode);
   const [sending, setSending] = useState(false);

   // Field-level validation errors. `medicines` is keyed by medicine id so
   // each medicine card can show its own errors independently.
   const [errors, setErrors] = useState({ patientName: '', diagnosis: '', followUp: '', medicines: {} });

   const clearError = (field) => {
      setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev));
   };

   const clearMedError = (id, field) => {
      setErrors(prev => {
         const medErrs = prev.medicines[id];
         if (!medErrs || !medErrs[field]) return prev;
         return { ...prev, medicines: { ...prev.medicines, [id]: { ...medErrs, [field]: '' } } };
      });
   };

   // Patient picker — searchable list so two patients with the same name
   // (but different phone numbers) can't be confused for one another.
   const [patientPickerVisible, setPatientPickerVisible] = useState(false);
   const [patientQuery, setPatientQuery] = useState('');
   const [patientResults, setPatientResults] = useState([]);
   const [patientsLoading, setPatientsLoading] = useState(false);
   const [patientsError, setPatientsError] = useState('');

   useEffect(() => {
      if (params.patientName) {
         setPatientName(params.patientName);
      }
      if (params.patientPhone) {
         setPatientPhone(params.patientPhone);
      }
      if (params.patientId) {
         setSelectedPatientId(params.patientId);
      }
      if (params.diagnosis) {
         setDiagnosis(params.diagnosis);
      }
   }, [params.patientName, params.patientPhone, params.patientId, params.diagnosis]);

   // Debounced search — only fires while the picker modal is open.
   useEffect(() => {
      if (!patientPickerVisible) return;
      let cancelled = false;
      setPatientsLoading(true);
      setPatientsError('');
      const t = setTimeout(async () => {
         try {
            const data = await getPatients({ search: patientQuery });
            if (!cancelled) setPatientResults(Array.isArray(data) ? data : []);
         } catch (err) {
            if (!cancelled) setPatientsError('Could not load patients.');
         } finally {
            if (!cancelled) setPatientsLoading(false);
         }
      }, 300);
      return () => { cancelled = true; clearTimeout(t); };
   }, [patientPickerVisible, patientQuery]);

   const handleSelectPatient = (p) => {
      setPatientName(p.name || '');
      setPatientPhone(p.phone || '');
      setSelectedPatientId(p._id);
      // Convenience prefill — doctor can still edit/clear it.
      if (!diagnosis && p.condition && p.condition !== 'No diagnosis yet') {
         setDiagnosis(p.condition);
      }
      setPatientPickerVisible(false);
      setPatientQuery('');
   };

   const [medicines, setMedicines] = useState([
      { id: '1', name: '', dosage: '', duration: '', frequency: 'Once daily', instructions: '' },
   ]);

   // When editing an existing prescription, load its full details (medicines,
   // notes, follow-up) rather than relying on the summary passed via params.
   useEffect(() => {
      if (!isEditMode) return;
      let cancelled = false;
      (async () => {
         try {
            const rx = await getPrescriptionById(params.id);
            if (cancelled || !rx) return;
            setPatientName(rx.patientName || '');
            setPatientPhone(rx.patientPhone || '');
            setSelectedPatientId(rx.patient || null);
            setDiagnosis(rx.diagnosis || '');
            setNotes(rx.notes || '');
            setFollowUp(rx.followUp || '');
            if (Array.isArray(rx.medicines) && rx.medicines.length > 0) {
               setMedicines(rx.medicines.map((m, idx) => ({
                  id: m.id || String(idx + 1),
                  name: m.name || '',
                  dosage: m.dosage || '',
                  duration: m.duration || '',
                  frequency: m.frequency || 'Once daily',
                  instructions: m.instructions || '',
               })));
            }
         } catch (err) {
            Alert.alert('Error', 'Could not load prescription details.');
         } finally {
            if (!cancelled) setLoadingExisting(false);
         }
      })();
      return () => { cancelled = true; };
   }, [isEditMode, params.id]);

   const [showSuggestions, setShowSuggestions] = useState(false);
   const [activeMedIdx, setActiveMedIdx] = useState(null);
   const [previewModal, setPreviewModal] = useState(false);

   const frequencies = ['Once daily', 'Twice daily', 'Thrice daily', 'Every 6 hours', 'As needed'];

   const addMedicine = () => {
      setMedicines(prev => [
         ...prev,
         { id: Date.now().toString(), name: '', dosage: '', duration: '', frequency: 'Once daily', instructions: '' }
      ]);
   };

   const removeMedicine = (id) => {
      if (medicines.length === 1) return;
      setMedicines(prev => prev.filter(m => m.id !== id));
      setErrors(prev => {
         if (!prev.medicines[id]) return prev;
         const { [id]: _removed, ...rest } = prev.medicines;
         return { ...prev, medicines: rest };
      });
   };

   const updateMed = (id, field, value) => {
      setMedicines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
      clearMedError(id, field);
   };

   // Accepts an actual date ("10 Jul 2026", "2026-07-10") or a relative
   // phrase ("After 2 weeks", "After 10 days"). Anything else is flagged.
   const isValidFollowUp = (value) => {
      const v = value.trim();
      if (!v) return true; // optional field
      if (/^after\s+\d+\s+(day|days|week|weeks|month|months)$/i.test(v)) return true;
      const parsed = Date.parse(v);
      return !Number.isNaN(parsed);
   };

   const validate = () => {
      const nextErrors = { patientName: '', diagnosis: '', followUp: '', medicines: {} };
      let isValid = true;

      if (!patientName.trim()) {
         nextErrors.patientName = 'Please select a patient.';
         isValid = false;
      }
      if (!diagnosis.trim()) {
         nextErrors.diagnosis = 'Diagnosis is required.';
         isValid = false;
      }
      if (!isValidFollowUp(followUp)) {
         nextErrors.followUp = 'Enter a real date (e.g. 10 Jul 2026) or a phrase like "After 2 weeks".';
         isValid = false;
      }

      medicines.forEach((m) => {
         const medErr = {};
         if (!m.name.trim()) {
            medErr.name = 'Medicine name is required.';
            isValid = false;
         }
         if (!m.dosage.trim()) {
            medErr.dosage = 'Dosage is required.';
            isValid = false;
         }
         if (!m.duration.trim()) {
            medErr.duration = 'Duration is required.';
            isValid = false;
         }
         if (Object.keys(medErr).length > 0) {
            nextErrors.medicines[m.id] = medErr;
         }
      });

      setErrors(nextErrors);
      return isValid;
   };

   const handleSend = async () => {
      if (!validate()) {
         return;
      }

      const payload = {
         patientId: selectedPatientId,
         patientName,
         patientPhone,
         diagnosis,
         medicines,
         notes,
         followUp,
      };

      setSending(true);
      try {
         if (isEditMode) {
            await updatePrescription(params.id, payload);
            Alert.alert(
               'Prescription Updated',
               `Prescription for ${patientName} has been updated.`,
               [{ text: 'OK', onPress: () => router.back() }]
            );
         } else {
            await createPrescription(payload);
            Alert.alert(
               'Prescription Sent',
               `Prescription for ${patientName} has been sent and saved to their records.`,
               [{ text: 'OK', onPress: () => router.back() }]
            );
         }
      } catch (err) {
         Alert.alert('Error', isEditMode ? 'Could not update prescription.' : 'Could not send prescription.');
      } finally {
         setSending(false);
      }
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            {/* Top Bar */}
            <View style={styles.topBar}>
               <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
               </TouchableOpacity>
               <Text style={styles.barTitle}>{isEditMode ? 'Edit Prescription' : 'Write Prescription'}</Text>
               <TouchableOpacity style={styles.previewBtn} onPress={() => setPreviewModal(true)}>
                  <Ionicons name="eye-outline" size={20} color={TEAL} />
               </TouchableOpacity>
            </View>

            {loadingExisting ? (
               <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.loadingTxt}>Loading prescription...</Text>
               </View>
            ) : (
               <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Doctor Card */}
                  <View style={styles.doctorCard}>
                     <MaterialCommunityIcons name="prescription" size={20} color={TEAL} />
                     <View style={{ marginLeft: 10 }}>
                        <Text style={styles.doctorCardName}>Dr. Rajesh Kumar</Text>
                        <Text style={styles.doctorCardSpec}>Cardiologist · MBBS, MD · Reg# DL-2014-4587</Text>
                     </View>
                  </View>

                  {/* Patient & Diagnosis */}
                  <Text style={styles.groupLabel}>Patient Information</Text>
                  <View style={styles.groupBg}>
                     <Text style={styles.label}>Patient</Text>
                     <TouchableOpacity
                        style={[styles.selectField, !!errors.patientName && styles.fieldError]}
                        onPress={() => {
                           setPatientPickerVisible(true);
                           clearError('patientName');
                        }}
                        activeOpacity={0.7}
                     >
                        <View style={{ flex: 1 }}>
                           {patientName ? (
                              <>
                                 <Text style={styles.selectFieldName}>{patientName}</Text>
                                 {!!patientPhone && <Text style={styles.selectFieldPhone}>{patientPhone}</Text>}
                              </>
                           ) : (
                              <Text style={styles.selectFieldPlaceholder}>Select a Patient</Text>
                           )}
                        </View>
                        <Ionicons name="chevron-down" size={18} color="#888" />
                     </TouchableOpacity>
                     {!!errors.patientName && <Text style={styles.errorTxt}>{errors.patientName}</Text>}

                     <Text style={styles.label}>Diagnosis / Chief Complaint</Text>
                     <TextInput
                        style={[styles.input, { borderBottomWidth: 0 }, !!errors.diagnosis && styles.fieldError]}
                        value={diagnosis}
                        onChangeText={(v) => { setDiagnosis(v); clearError('diagnosis'); }}
                        placeholder="e.g. Hypertension, chest pain follow-up"
                     />
                     {!!errors.diagnosis && <Text style={styles.errorTxt}>{errors.diagnosis}</Text>}
                  </View>

                  {/* Medicines */}
                  <View style={styles.sectionHeaderRow}>
                     <Text style={styles.groupLabel}>Medicines</Text>
                     <TouchableOpacity style={styles.addMedBtn} onPress={addMedicine}>
                        <Ionicons name="add" size={16} color={TEAL} />
                        <Text style={styles.addMedTxt}>Add</Text>
                     </TouchableOpacity>
                  </View>

                  {medicines.map((med, idx) => (
                     <View key={med.id} style={styles.medCard}>
                        <View style={styles.medCardHeader}>
                           <View style={styles.medNum}>
                              <Text style={styles.medNumTxt}>{idx + 1}</Text>
                           </View>
                           <Text style={styles.medCardTitle}>Medicine {idx + 1}</Text>
                           {medicines.length > 1 && (
                              <TouchableOpacity onPress={() => removeMedicine(med.id)} style={styles.removeBtn}>
                                 <Ionicons name="trash-outline" size={17} color="#E24B4A" />
                              </TouchableOpacity>
                           )}
                        </View>

                        <Text style={styles.label}>Medicine Name</Text>
                        <TextInput
                           style={[styles.input, !!errors.medicines[med.id]?.name && styles.fieldError]}
                           value={med.name}
                           onChangeText={(v) => {
                              updateMed(med.id, 'name', v);
                              setActiveMedIdx(idx);
                              setShowSuggestions(v.length > 0);
                           }}
                           placeholder="e.g. Metoprolol 25mg"
                        />
                        {!!errors.medicines[med.id]?.name && (
                           <Text style={styles.errorTxt}>{errors.medicines[med.id].name}</Text>
                        )}
                        {showSuggestions && activeMedIdx === idx && (
                           <View style={styles.suggestionsBox}>
                              {MEDICINE_SUGGESTIONS.filter(s =>
                                 s.toLowerCase().includes(med.name.toLowerCase())
                              ).map(s => (
                                 <TouchableOpacity
                                    key={s}
                                    style={styles.suggestionItem}
                                    onPress={() => {
                                       updateMed(med.id, 'name', s);
                                       setShowSuggestions(false);
                                    }}
                                 >
                                    <Ionicons name="medical-outline" size={13} color={TEAL} style={{ marginRight: 6 }} />
                                    <Text style={styles.suggestionTxt}>{s}</Text>
                                 </TouchableOpacity>
                              ))}
                           </View>
                        )}

                        <View style={styles.twoCol}>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Dosage</Text>
                              <TextInput
                                 style={[styles.input, !!errors.medicines[med.id]?.dosage && styles.fieldError]}
                                 value={med.dosage}
                                 onChangeText={(v) => updateMed(med.id, 'dosage', v)}
                                 placeholder="e.g. 1 tablet"
                              />
                              {!!errors.medicines[med.id]?.dosage && (
                                 <Text style={styles.errorTxt}>{errors.medicines[med.id].dosage}</Text>
                              )}
                           </View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.label}>Duration</Text>
                              <TextInput
                                 style={[styles.input, !!errors.medicines[med.id]?.duration && styles.fieldError]}
                                 value={med.duration}
                                 onChangeText={(v) => updateMed(med.id, 'duration', v)}
                                 placeholder="e.g. 30 days"
                              />
                              {!!errors.medicines[med.id]?.duration && (
                                 <Text style={styles.errorTxt}>{errors.medicines[med.id].duration}</Text>
                              )}
                           </View>
                        </View>

                        <Text style={styles.label}>Frequency</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                           <View style={styles.freqRow}>
                              {frequencies.map(f => (
                                 <TouchableOpacity
                                    key={f}
                                    style={[styles.freqChip, med.frequency === f && styles.freqChipActive]}
                                    onPress={() => updateMed(med.id, 'frequency', f)}
                                 >
                                    <Text style={[styles.freqTxt, med.frequency === f && styles.freqTxtActive]}>{f}</Text>
                                 </TouchableOpacity>
                              ))}
                           </View>
                        </ScrollView>

                        <Text style={styles.label}>Special Instructions</Text>
                        <TextInput
                           style={[styles.input, { borderBottomWidth: 0 }]}
                           value={med.instructions}
                           onChangeText={(v) => updateMed(med.id, 'instructions', v)}
                           placeholder="e.g. Take after meals"
                        />
                     </View>
                  ))}

                  {/* Notes & Follow-Up */}
                  <Text style={styles.groupLabel}>Additional Notes</Text>
                  <View style={styles.groupBg}>
                     <Text style={styles.label}>Doctor's Notes</Text>
                     <TextInput
                        style={styles.textArea}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                        placeholder="Clinical observations, advice, lifestyle changes..."
                     />
                     <Text style={[styles.label, { marginTop: 8 }]}>Follow-Up Date</Text>
                     <TextInput
                        style={[styles.input, { borderBottomWidth: 0 }, !!errors.followUp && styles.fieldError]}
                        value={followUp}
                        onChangeText={(v) => { setFollowUp(v); clearError('followUp'); }}
                        placeholder="e.g. After 2 weeks / 10 Jul 2026"
                     />
                     {!!errors.followUp && <Text style={styles.errorTxt}>{errors.followUp}</Text>}
                  </View>

                  <TouchableOpacity
                     style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                     onPress={handleSend}
                     disabled={sending}
                  >
                     <Ionicons
                        name={isEditMode ? 'checkmark-outline' : 'send-outline'}
                        size={18}
                        color="#fff"
                        style={{ marginRight: 8 }}
                     />
                     <Text style={styles.sendBtnTxt}>
                        {sending
                           ? (isEditMode ? 'Saving...' : 'Sending...')
                           : (isEditMode ? 'Save Changes' : 'Send Prescription')}
                     </Text>
                  </TouchableOpacity>
               </ScrollView>
            )}
         </KeyboardAvoidingView>

         {/* Preview Modal */}
         <Modal visible={previewModal} transparent animationType="slide" onRequestClose={() => setPreviewModal(false)}>
            <View style={styles.previewOverlay}>
               <SafeAreaView edges={['bottom']} style={styles.previewSheet}>
                  <View style={styles.modalHandle} />
                  <Text style={styles.previewTitle}>Prescription Preview</Text>
                  <ScrollView showsVerticalScrollIndicator={false}>
                     <View style={styles.previewHeader}>
                        <Text style={styles.previewDoc}>Dr. Rajesh Kumar</Text>
                        <Text style={styles.previewSpec}>Cardiologist · MBBS, MD</Text>
                        <Text style={styles.previewDate}>Date: {new Date().toLocaleDateString('en-IN')}</Text>
                     </View>
                     <View style={styles.previewDivider} />
                     <Text style={styles.previewLabel}>Patient</Text>
                     <Text style={styles.previewValue}>{patientName || '—'}</Text>
                     <Text style={styles.previewLabel}>Diagnosis</Text>
                     <Text style={styles.previewValue}>{diagnosis || '—'}</Text>
                     <View style={styles.previewDivider} />
                     <Text style={styles.previewLabel}>Medicines</Text>
                     {medicines.map((m, i) => (
                        <View key={m.id} style={styles.previewMedRow}>
                           <Text style={styles.previewMedName}>{i + 1}. {m.name || '—'}</Text>
                           <Text style={styles.previewMedDetail}>
                              {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ') || '—'}
                           </Text>
                           {m.instructions ? <Text style={styles.previewMedInstr}>Note: {m.instructions}</Text> : null}
                        </View>
                     ))}
                     {notes ? (
                        <>
                           <View style={styles.previewDivider} />
                           <Text style={styles.previewLabel}>Doctor's Notes</Text>
                           <Text style={styles.previewValue}>{notes}</Text>
                        </>
                     ) : null}
                     {followUp ? (
                        <>
                           <Text style={styles.previewLabel}>Follow-Up</Text>
                           <Text style={styles.previewValue}>{followUp}</Text>
                        </>
                     ) : null}
                  </ScrollView>
                  <TouchableOpacity style={styles.closePrevBtn} onPress={() => setPreviewModal(false)}>
                     <Text style={styles.closePrevTxt}>Close Preview</Text>
                  </TouchableOpacity>
               </SafeAreaView>
            </View>
         </Modal>

         {/* Patient Picker Modal */}
         <Modal
            visible={patientPickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setPatientPickerVisible(false)}
         >
            <View style={styles.previewOverlay}>
               <SafeAreaView edges={['bottom']} style={[styles.previewSheet, { maxHeight: '80%' }]}>
                  <View style={styles.modalHandle} />
                  <Text style={styles.previewTitle}>Select Patient</Text>

                  <View style={styles.pickerSearchRow}>
                     <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
                     <TextInput
                        style={styles.pickerSearchInput}
                        placeholder="Search by name or phone..."
                        value={patientQuery}
                        onChangeText={setPatientQuery}
                        placeholderTextColor="#aaa"
                     />
                     {patientQuery ? (
                        <TouchableOpacity onPress={() => setPatientQuery('')}>
                           <Ionicons name="close-circle" size={18} color="#888" />
                        </TouchableOpacity>
                     ) : null}
                  </View>

                  {patientsLoading ? (
                     <View style={styles.pickerStateView}>
                        <ActivityIndicator size="small" color={TEAL} />
                        <Text style={styles.pickerStateTxt}>Loading patients...</Text>
                     </View>
                  ) : patientsError ? (
                     <View style={styles.pickerStateView}>
                        <Text style={styles.pickerStateTxt}>{patientsError}</Text>
                     </View>
                  ) : (
                     <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 4 }}>
                        {patientResults.length === 0 ? (
                           <View style={styles.pickerStateView}>
                              <MaterialCommunityIcons name="account-search-outline" size={40} color="#ccc" />
                              <Text style={styles.pickerStateTxt}>No patients found</Text>
                           </View>
                        ) : patientResults.map(p => (
                           <TouchableOpacity
                              key={p._id}
                              style={[
                                 styles.pickerRow,
                                 selectedPatientId === p._id && styles.pickerRowActive,
                              ]}
                              onPress={() => handleSelectPatient(p)}
                           >
                              <View style={styles.pickerAvatar}>
                                 <Text style={styles.pickerAvatarTxt}>
                                    {(p.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2)}
                                 </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                 <Text style={styles.pickerRowName}>{p.name}</Text>
                                 {/* Phone shown alongside name so two patients sharing a
                                     name are never mistaken for each other. */}
                                 <Text style={styles.pickerRowPhone}>{p.phone || 'No phone on file'}</Text>
                              </View>
                              {selectedPatientId === p._id && (
                                 <Ionicons name="checkmark-circle" size={20} color={TEAL} />
                              )}
                           </TouchableOpacity>
                        ))}
                     </ScrollView>
                  )}

                  <TouchableOpacity style={styles.closePrevBtn} onPress={() => setPatientPickerVisible(false)}>
                     <Text style={styles.closePrevTxt}>Close</Text>
                  </TouchableOpacity>
               </SafeAreaView>
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
   previewBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   scroll: { padding: 16, paddingBottom: 40 },
   doctorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F7', borderRadius: 14, padding: 14, marginBottom: 4 },
   doctorCardName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   doctorCardSpec: { fontSize: 11, color: '#555', marginTop: 2 },
   groupLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
   sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
   addMedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
   addMedTxt: { fontSize: 13, fontWeight: '700', color: TEAL },
   groupBg: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   label: { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 10, marginBottom: 4 },
   input: { fontSize: 14, color: '#1a1a1a', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
   fieldError: { borderBottomWidth: 1.5, borderBottomColor: '#E24B4A' },
   errorTxt: { fontSize: 11, color: '#E24B4A', marginTop: 2 },
   selectField: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
   selectFieldName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   selectFieldPhone: { fontSize: 12, color: '#888', marginTop: 2 },
   selectFieldPlaceholder: { fontSize: 14, color: '#aaa' },
   pickerSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fbfc', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
   pickerSearchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
   pickerStateView: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
   pickerStateTxt: { fontSize: 13, color: '#999', marginTop: 8, textAlign: 'center' },
   pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10 },
   pickerRowActive: { backgroundColor: '#E8F5F7' },
   pickerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   pickerAvatarTxt: { fontSize: 13, fontWeight: 'bold', color: TEAL },
   pickerRowName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   pickerRowPhone: { fontSize: 12, color: '#888', marginTop: 1 },
   textArea: { fontSize: 14, color: '#1a1a1a', minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
   twoCol: { flexDirection: 'row' },
   medCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: '#E8F5F7', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   medCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
   medNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
   medNumTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
   medCardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   removeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
   suggestionsBox: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', marginVertical: 4, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
   suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
   suggestionTxt: { fontSize: 13, color: '#333' },
   freqRow: { flexDirection: 'row', gap: 8 },
   freqChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#eee', backgroundColor: '#fafafa' },
   freqChipActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   freqTxt: { fontSize: 12, fontWeight: '600', color: '#888' },
   freqTxtActive: { color: TEAL },
   sendBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, marginTop: 20, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   sendBtnDisabled: { opacity: 0.6 },
   sendBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
   loadingTxt: { fontSize: 13, color: '#888', marginTop: 10 },
   previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
   previewSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
   modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16 },
   previewTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
   previewHeader: { backgroundColor: '#f8fbfc', borderRadius: 12, padding: 14, marginBottom: 12 },
   previewDoc: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   previewSpec: { fontSize: 12, color: TEAL, marginTop: 2 },
   previewDate: { fontSize: 12, color: '#888', marginTop: 4 },
   previewDivider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
   previewLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
   previewValue: { fontSize: 14, color: '#1a1a1a', marginBottom: 8 },
   previewMedRow: { backgroundColor: '#f8fbfc', borderRadius: 10, padding: 10, marginBottom: 8 },
   previewMedName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   previewMedDetail: { fontSize: 12, color: '#555', marginTop: 2 },
   previewMedInstr: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 2 },
   closePrevBtn: { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
   closePrevTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
