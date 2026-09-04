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
import medicinesData from '../../data/medicines.json';

const TEAL = '#1A7E8A';

// Medicine catalog, bundled on-device (no backend call needed). Each entry:
// { i: id, g: generic name, b: brand name(s), s: strength, sch: schedule,
//   t: telemedicine eligibility, sym: symptoms, d: disease/indication }
// Precompute a lowercase search blob once at module load, not per keystroke.
const MEDICINES = medicinesData.map((m) => ({
   ...m,
   q: `${m.g} ${m.b}`.toLowerCase(),
}));

// Color coding for the telemedicine-eligibility badge shown in suggestions.
const TELEMED_COLORS = {
   'Yes': '#1FA95C',
   'Follow-up Only': '#4472C4',
   'Specialist Only': '#9B59B6',
   'Hospital Only': '#6B5B95',
   'Caution': '#E8A33D',
   'Restricted': '#E8730D',
   'Not Recommended': '#E24B4A',
   'No': '#E24B4A',
};

// Simple ranked substring search: exact-start matches first, then
// contains-matches, capped so the dropdown stays short and readable.
function searchMedicines(query, limit = 8) {
   const q = query.trim().toLowerCase();
   if (!q) return [];
   const starts = [];
   const contains = [];
   for (const m of MEDICINES) {
      if (m.q.startsWith(q)) {
         starts.push(m);
      } else if (m.q.includes(q)) {
         contains.push(m);
      }
      if (starts.length >= limit && contains.length >= limit) break;
   }
   return [...starts, ...contains].slice(0, limit);
}

export default function PrescriptionWriteScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const isEditMode = !!params.editMode && !!params.id;

   const [patientName, setPatientName] = useState(params.patientName || '');
   const [patientPhone, setPatientPhone] = useState(params.patientPhone || '');
   const [selectedPatientId, setSelectedPatientId] = useState(params.patientId || null);
   const [diagnosis, setDiagnosis] = useState(params.diagnosis || '');
   const [chiefComplaints, setChiefComplaints] = useState('');
   const [allergies, setAllergies] = useState('');
   const [medicalHistory, setMedicalHistory] = useState('');
   const [dietRestrictions, setDietRestrictions] = useState('');
   const [vitals, setVitals] = useState({ bp: '', pulse: '', spo2: '', temp: '', rr: '', weight: '' });
   const [notes, setNotes] = useState('');
   const [followUp, setFollowUp] = useState('');
   const [loadingExisting, setLoadingExisting] = useState(isEditMode);
   const [sending, setSending] = useState(false);

   const updateVital = (field, value) => setVitals(prev => ({ ...prev, [field]: value }));

   // Field-level validation errors. `medicines` is keyed by medicine id so
   // each medicine card can show its own errors independently.
   const [errors, setErrors] = useState({ patientName: '', diagnosis: '', medicines: {} });

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
      { id: '1', name: '', composition: '', morning: '', afternoon: '', evening: '', night: '', unit: 'Tablet', duration: '', instructions: '' },
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
            setChiefComplaints(rx.chiefComplaints || '');
            setAllergies(rx.allergies || '');
            setMedicalHistory(rx.medicalHistory || '');
            setDietRestrictions(rx.dietRestrictions || '');
            setVitals({
               bp: rx.vitals?.bp || '', pulse: rx.vitals?.pulse || '', spo2: rx.vitals?.spo2 || '',
               temp: rx.vitals?.temp || '', rr: rx.vitals?.rr || '', weight: rx.vitals?.weight || '',
            });
            setNotes(rx.notes || '');
            setFollowUp(rx.followUp || '');
            if (Array.isArray(rx.medicines) && rx.medicines.length > 0) {
               setMedicines(rx.medicines.map((m, idx) => ({
                  id: m.id || String(idx + 1),
                  name: m.name || '',
                  composition: m.composition || '',
                  morning: m.morning || '',
                  afternoon: m.afternoon || '',
                  evening: m.evening || '',
                  night: m.night || '',
                  unit: m.unit || 'Tablet',
                  duration: m.duration || '',
                  instructions: m.instructions || '',
                  // Kept so a prescription written before the M-A-E-N grid
                  // existed still shows its original dosage/frequency as a
                  // read-only hint under the medicine name (see medCard UI).
                  legacyDosage: [m.dosage, m.frequency].filter(Boolean).join(' · '),
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

   const doseUnits = ['Tablet', 'Capsule', 'ml', 'Drops', 'Puff'];

   const addMedicine = () => {
      setMedicines(prev => [
         ...prev,
         { id: Date.now().toString(), name: '', composition: '', morning: '', afternoon: '', evening: '', night: '', unit: 'Tablet', duration: '', instructions: '' }
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

   const validate = () => {
      const nextErrors = { patientName: '', diagnosis: '', medicines: {} };
      let isValid = true;

      if (!patientName.trim()) {
         nextErrors.patientName = 'Please select a patient.';
         isValid = false;
      }
      if (!diagnosis.trim()) {
         nextErrors.diagnosis = 'Diagnosis is required.';
         isValid = false;
      }

      medicines.forEach((m) => {
         const medErr = {};
         if (!m.name.trim()) {
            medErr.name = 'Medicine name is required.';
            isValid = false;
         }
         if (!(m.morning || m.afternoon || m.evening || m.night)) {
            medErr.dose = 'Enter at least one dose (M/A/E/N).';
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
         chiefComplaints,
         allergies,
         medicalHistory,
         dietRestrictions,
         vitals,
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

                     <Text style={styles.label}>Diagnosis / Provisional Diagnosis</Text>
                     <TextInput
                        style={[styles.input, { borderBottomWidth: 0 }, !!errors.diagnosis && styles.fieldError]}
                        value={diagnosis}
                        onChangeText={(v) => { setDiagnosis(v); clearError('diagnosis'); }}
                        placeholder="e.g. Hypertension, Flu"
                     />
                     {!!errors.diagnosis && <Text style={styles.errorTxt}>{errors.diagnosis}</Text>}
                  </View>

                  {/* Chief Complaints */}
                  <Text style={styles.groupLabel}>Chief Complaints</Text>
                  <View style={styles.groupBg}>
                     <Text style={styles.label}>Patient's Complaints (one per line)</Text>
                     <TextInput
                        style={[styles.textArea, { borderBottomWidth: 0 }]}
                        value={chiefComplaints}
                        onChangeText={setChiefComplaints}
                        multiline
                        numberOfLines={3}
                        placeholder={'e.g. Sore throat, since 2 days\nCold, since 2 days, with sneezing'}
                     />
                  </View>

                  {/* Allergy & Medical History */}
                  <Text style={styles.groupLabel}>Allergy & Medical History</Text>
                  <View style={styles.groupBg}>
                     <Text style={styles.label}>Drug Allergies</Text>
                     <TextInput
                        style={styles.input}
                        value={allergies}
                        onChangeText={setAllergies}
                        placeholder="e.g. No / Penicillin"
                     />
                     <Text style={[styles.label, { marginTop: 8 }]}>Diet Restrictions</Text>
                     <TextInput
                        style={styles.input}
                        value={dietRestrictions}
                        onChangeText={setDietRestrictions}
                        placeholder="e.g. No / Low salt, Diabetic diet"
                     />
                     <Text style={[styles.label, { marginTop: 8 }]}>Relevant Medical History</Text>
                     <TextInput
                        style={[styles.input, { borderBottomWidth: 0 }]}
                        value={medicalHistory}
                        onChangeText={setMedicalHistory}
                        placeholder="e.g. Diabetes, Hypertension / None"
                     />
                  </View>

                  {/* Vitals */}
                  <Text style={styles.groupLabel}>Vitals (as declared by patient)</Text>
                  <View style={styles.groupBg}>
                     <View style={styles.vitalsGrid}>
                        {[
                           ['bp', 'BP'], ['pulse', 'Pulse'], ['spo2', 'SpO2'],
                           ['temp', 'Temp'], ['rr', 'RR'], ['weight', 'Weight'],
                        ].map(([key, label]) => (
                           <View key={key} style={styles.vitalField}>
                              <Text style={styles.vitalLabel}>{label}</Text>
                              <TextInput
                                 style={styles.vitalInput}
                                 value={vitals[key]}
                                 onChangeText={(v) => updateVital(key, v)}
                                 placeholder="—"
                                 placeholderTextColor="#ccc"
                              />
                           </View>
                        ))}
                     </View>
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
                        <Text style={[styles.label, { marginTop: 6 }]}>Composition / Salt (optional)</Text>
                        <TextInput
                           style={styles.input}
                           value={med.composition}
                           onChangeText={(v) => updateMed(med.id, 'composition', v)}
                           placeholder="e.g. Levocetirizine 5mg + Montelukast 10mg"
                        />
                        {!!errors.medicines[med.id]?.name && (
                           <Text style={styles.errorTxt}>{errors.medicines[med.id].name}</Text>
                        )}
                        {showSuggestions && activeMedIdx === idx && (() => {
                           const results = searchMedicines(med.name);
                           return (
                              <View style={styles.suggestionsBox}>
                                 {results.length === 0 ? (
                                    <View style={styles.suggestionEmpty}>
                                       <Text style={styles.suggestionEmptyTxt}>No matching medicine found</Text>
                                    </View>
                                 ) : results.map((m) => {
                                    const telemedColor = TELEMED_COLORS[m.t] || '#888';
                                    return (
                                       <TouchableOpacity
                                          key={m.i}
                                          style={styles.suggestionItem}
                                          onPress={() => {
                                             // Prefer the brand name up top (matches how the
                                             // printed slip renders it), composition below —
                                             // fall back to the generic name if no brand is
                                             // listed for this entry.
                                             const brandName = (m.b || '').split(',')[0].trim();
                                             const compositionText = `${m.g}${m.s ? ' ' + m.s : ''}`;
                                             updateMed(med.id, 'name', brandName || compositionText);
                                             updateMed(med.id, 'composition', brandName ? compositionText : '');
                                             setShowSuggestions(false);
                                          }}
                                       >
                                          <Ionicons name="medical-outline" size={13} color={TEAL} style={{ marginRight: 6, marginTop: 2 }} />
                                          <View style={{ flex: 1 }}>
                                             <View style={styles.suggestionTopRow}>
                                                <Text style={styles.suggestionName} numberOfLines={1}>
                                                   {m.g}{m.s ? `  ·  ${m.s}` : ''}
                                                </Text>
                                             </View>
                                             {!!m.b && (
                                                <Text style={styles.suggestionBrand} numberOfLines={1}>{m.b}</Text>
                                             )}
                                             <View style={styles.suggestionBadgeRow}>
                                                {!!m.t && (
                                                   <View style={[styles.telemedBadge, { backgroundColor: telemedColor + '1A' }]}>
                                                      <Ionicons name="videocam-outline" size={10} color={telemedColor} style={{ marginRight: 3 }} />
                                                      <Text style={[styles.telemedBadgeTxt, { color: telemedColor }]}>{m.t}</Text>
                                                   </View>
                                                )}
                                                {!!m.sch && (
                                                   <View style={styles.scheduleBadge}>
                                                      <Text style={styles.scheduleBadgeTxt}>{m.sch}</Text>
                                                   </View>
                                                )}
                                             </View>
                                             {!!m.sym && (
                                                <Text style={styles.suggestionSymptoms} numberOfLines={1}>
                                                   For: {m.sym}
                                                </Text>
                                             )}
                                          </View>
                                       </TouchableOpacity>
                                    );
                                 })}
                              </View>
                           );
                        })()}

                        {!!med.legacyDosage && (
                           <Text style={styles.legacyDoseHint}>Previously saved as: {med.legacyDosage}</Text>
                        )}

                        <Text style={styles.label}>Dose — Morning · Afternoon · Evening · Night</Text>
                        <View style={styles.maneRow}>
                           {[
                              ['morning', 'M'], ['afternoon', 'A'], ['evening', 'E'], ['night', 'N'],
                           ].map(([field, label]) => (
                              <View key={field} style={styles.maneField}>
                                 <Text style={styles.maneLabel}>{label}</Text>
                                 <TextInput
                                    style={[styles.maneInput, !!errors.medicines[med.id]?.dose && styles.fieldError]}
                                    value={med[field]}
                                    onChangeText={(v) => updateMed(med.id, field, v.replace(/[^0-9./]/g, ''))}
                                    placeholder="0"
                                    placeholderTextColor="#ccc"
                                    keyboardType="numeric"
                                    textAlign="center"
                                 />
                              </View>
                           ))}
                        </View>
                        {!!errors.medicines[med.id]?.dose && (
                           <Text style={styles.errorTxt}>{errors.medicines[med.id].dose}</Text>
                        )}

                        <Text style={[styles.label, { marginTop: 8 }]}>Unit</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                           <View style={styles.freqRow}>
                              {doseUnits.map(u => (
                                 <TouchableOpacity
                                    key={u}
                                    style={[styles.freqChip, med.unit === u && styles.freqChipActive]}
                                    onPress={() => updateMed(med.id, 'unit', u)}
                                 >
                                    <Text style={[styles.freqTxt, med.unit === u && styles.freqTxtActive]}>{u}</Text>
                                 </TouchableOpacity>
                              ))}
                           </View>
                        </ScrollView>

                        <Text style={styles.label}>Duration</Text>
                        <TextInput
                           style={[styles.input, !!errors.medicines[med.id]?.duration && styles.fieldError]}
                           value={med.duration}
                           onChangeText={(v) => updateMed(med.id, 'duration', v)}
                           placeholder="e.g. 5 days"
                        />
                        {!!errors.medicines[med.id]?.duration && (
                           <Text style={styles.errorTxt}>{errors.medicines[med.id].duration}</Text>
                        )}

                        <Text style={styles.label}>Special Instructions</Text>
                        <TextInput
                           style={[styles.input, { borderBottomWidth: 0 }]}
                           value={med.instructions}
                           onChangeText={(v) => updateMed(med.id, 'instructions', v)}
                           placeholder="e.g. After food"
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
                        style={[styles.input, { borderBottomWidth: 0 }]}
                        value={followUp}
                        onChangeText={setFollowUp}
                        placeholder="e.g. After 2 weeks / 10 Jul 2026"
                     />
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
                     {chiefComplaints ? (
                        <>
                           <Text style={styles.previewLabel}>Chief Complaints</Text>
                           <Text style={styles.previewValue}>{chiefComplaints}</Text>
                        </>
                     ) : null}
                     {(allergies || medicalHistory || dietRestrictions) ? (
                        <>
                           <Text style={styles.previewLabel}>Allergy & History</Text>
                           <Text style={styles.previewValue}>
                              {[allergies && `Allergies: ${allergies}`, dietRestrictions && `Diet: ${dietRestrictions}`, medicalHistory && `History: ${medicalHistory}`].filter(Boolean).join('  ·  ') || '—'}
                           </Text>
                        </>
                     ) : null}
                     {Object.values(vitals).some(Boolean) ? (
                        <>
                           <Text style={styles.previewLabel}>Vitals</Text>
                           <Text style={styles.previewValue}>
                              {[
                                 vitals.bp && `BP ${vitals.bp}`, vitals.pulse && `Pulse ${vitals.pulse}`,
                                 vitals.spo2 && `SpO2 ${vitals.spo2}`, vitals.temp && `Temp ${vitals.temp}`,
                                 vitals.rr && `RR ${vitals.rr}`, vitals.weight && `Weight ${vitals.weight}`,
                              ].filter(Boolean).join('  ·  ')}
                           </Text>
                        </>
                     ) : null}
                     <View style={styles.previewDivider} />
                     <Text style={styles.previewLabel}>Medicines</Text>
                     {medicines.map((m, i) => {
                        const mane = [
                           m.morning && `M-${m.morning}`, m.afternoon && `A-${m.afternoon}`,
                           m.evening && `E-${m.evening}`, m.night && `N-${m.night}`,
                        ].filter(Boolean).join(' · ');
                        return (
                           <View key={m.id} style={styles.previewMedRow}>
                              <Text style={styles.previewMedName}>{i + 1}. {m.name || '—'}</Text>
                              {!!m.composition && (
                                 <Text style={styles.previewMedComposition}>{m.composition}</Text>
                              )}
                              <Text style={styles.previewMedDetail}>
                                 {[mane || m.legacyDosage, m.duration].filter(Boolean).join(' · ') || '—'}
                              </Text>
                              {m.instructions ? <Text style={styles.previewMedInstr}>Note: {m.instructions}</Text> : null}
                           </View>
                        );
                     })}
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
            <KeyboardAvoidingView
               style={styles.previewOverlay}
               behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
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
   suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
   suggestionTxt: { fontSize: 13, color: '#333' },
   suggestionEmpty: { paddingHorizontal: 12, paddingVertical: 16, alignItems: 'center' },
   suggestionEmptyTxt: { fontSize: 12, color: '#999' },
   suggestionTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
   suggestionName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
   suggestionBrand: { fontSize: 11, color: '#777', marginTop: 1 },
   suggestionBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
   telemedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
   telemedBadgeTxt: { fontSize: 10, fontWeight: '700' },
   scheduleBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
   scheduleBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#777' },
   suggestionSymptoms: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 3 },
   freqRow: { flexDirection: 'row', gap: 8 },
   vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
   vitalField: { width: '33.33%', paddingRight: 10, marginBottom: 10 },
   vitalLabel: { fontSize: 10.5, color: '#888', marginBottom: 4, fontWeight: '600' },
   vitalInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#1a1a1a' },
   maneRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
   maneField: { flex: 1, alignItems: 'center' },
   maneLabel: { fontSize: 11, color: '#888', fontWeight: '700', marginBottom: 4 },
   maneInput: { width: '100%', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingVertical: 8, fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
   legacyDoseHint: { fontSize: 10.5, color: '#999', fontStyle: 'italic', marginBottom: 8 },
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
   previewMedComposition: { fontSize: 11.5, color: '#666', marginTop: 1, marginBottom: 2 },
   previewMedDetail: { fontSize: 12, color: '#555', marginTop: 2 },
   previewMedInstr: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 2 },
   closePrevBtn: { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
   closePrevTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
