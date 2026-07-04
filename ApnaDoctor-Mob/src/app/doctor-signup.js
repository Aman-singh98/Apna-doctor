import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
   Alert,
   KeyboardAvoidingView,
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
import * as DocumentPicker from 'expo-document-picker';
import { submitDoctorSignup } from '../utils/doctorAuth';

const TEAL = '#1A7E8A';

const specializations = [
   'Cardiologist', 'Dermatologist', 'General Physician', 'Neurologist',
   'Orthopedic', 'Pediatrician', 'Psychiatrist', 'Gynecologist',
];

const DOCUMENT_SLOTS = [
   { key: 'medicalLicense', label: 'Medical License / Registration Certificate', icon: 'card-account-details-outline' },
   { key: 'idProof',        label: 'Government ID Proof (Aadhaar / Passport / PAN)', icon: 'card-text-outline' },
];

export default function DoctorSignupScreen() {
   const router = useRouter();
   const { phone } = useLocalSearchParams();

   const [name, setName]               = useState('');
   const [qualification, setQualification] = useState('');
   const [regNumber, setRegNumber]     = useState('');
   const [hospital, setHospital]       = useState('');
   const [experience, setExperience]   = useState('');
   const [selectedSpec, setSelectedSpec] = useState('');
   // documents: { medicalLicense: { uri, name, type } | null, idProof: { uri, name, type } | null }
   const [documents, setDocuments]     = useState({});
   const [submitting, setSubmitting]   = useState(false);

   const handlePickDocument = async (slotKey) => {
      try {
         const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/jpeg', 'image/png'],
            copyToCacheDirectory: true,
         });

         // Expo SDK 49+: result.canceled instead of result.type === 'cancel'
         if (result.canceled) return;

         const file = result.assets[0];
         setDocuments(prev => ({
            ...prev,
            [slotKey]: { uri: file.uri, name: file.name, type: file.mimeType || 'application/pdf' },
         }));
      } catch {
         Alert.alert('Error', 'Could not pick document. Please try again.');
      }
   };

   const removeDocument = (slotKey) => {
      setDocuments(prev => {
         const next = { ...prev };
         delete next[slotKey];
         return next;
      });
   };

   const handleSubmit = async () => {
      if (!name.trim() || !qualification.trim() || !regNumber.trim() || !selectedSpec) {
         Alert.alert('Missing Information', 'Please fill in your name, qualification, registration number, and specialization.');
         return;
      }
      const missingDocs = DOCUMENT_SLOTS.filter(slot => !documents[slot.key]);
      if (missingDocs.length > 0) {
         Alert.alert('Documents Required', 'Please upload both your medical license and ID proof before submitting.');
         return;
      }

      setSubmitting(true);
      try {
         await submitDoctorSignup({ name, qualification, regNumber, hospital, experience, specialization: selectedSpec, documents });
         router.replace('/doctor-pending');
      } catch (err) {
         const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
         Alert.alert('Submission Failed', msg);
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.topBar}>
               <View style={styles.logoIcon}>
                  <MaterialCommunityIcons name="doctor" size={20} color="#fff" />
               </View>
               <View>
                  <Text style={styles.barTitle}>Doctor Signup</Text>
                  <Text style={styles.barSub}>One-time profile setup</Text>
               </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
               <Text style={styles.groupLabel}>Personal Information</Text>
               <View style={styles.groupBg}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Dr. Full Name" placeholderTextColor="#bbb" />
                  <Text style={styles.label}>Qualification *</Text>
                  <TextInput style={styles.input} value={qualification} onChangeText={setQualification} placeholder="e.g. MBBS, MD (Cardiology)" placeholderTextColor="#bbb" />
                  <Text style={styles.label}>Medical Registration Number *</Text>
                  <TextInput style={styles.input} value={regNumber} onChangeText={setRegNumber} placeholder="e.g. DL-2014-4587" placeholderTextColor="#bbb" />
                  <Text style={styles.label}>Years of Experience</Text>
                  <TextInput style={[styles.input, { borderBottomWidth: 0 }]} value={experience} onChangeText={setExperience} keyboardType="numeric" placeholder="e.g. 12" placeholderTextColor="#bbb" />
               </View>

               <Text style={styles.groupLabel}>Specialization *</Text>
               <View style={styles.groupBg}>
                  <View style={styles.specGrid}>
                     {specializations.map(s => (
                        <TouchableOpacity key={s} style={[styles.specChip, selectedSpec === s && styles.specChipActive]} onPress={() => setSelectedSpec(s)}>
                           <Text style={[styles.specChipTxt, selectedSpec === s && styles.specChipTxtActive]}>{s}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>
               </View>

               <Text style={styles.groupLabel}>Practice Information</Text>
               <View style={styles.groupBg}>
                  <Text style={styles.label}>Hospital / Clinic Name</Text>
                  <TextInput style={[styles.input, { borderBottomWidth: 0 }]} value={hospital} onChangeText={setHospital} placeholder="Hospital or clinic name" placeholderTextColor="#bbb" />
               </View>

               <Text style={styles.groupLabel}>Verification Documents *</Text>
               <View style={styles.groupBg}>
                  <Text style={styles.docNote}>Upload clear photos or scans. PDF, JPG, PNG accepted (max 5MB each).</Text>
                  {DOCUMENT_SLOTS.map(slot => {
                     const file = documents[slot.key];
                     return (
                        <TouchableOpacity
                           key={slot.key}
                           style={[styles.docCard, file && styles.docCardUploaded]}
                           onPress={() => !file && handlePickDocument(slot.key)}
                           activeOpacity={0.85}
                        >
                           <View style={[styles.docIconBg, file && styles.docIconBgUploaded]}>
                              <MaterialCommunityIcons name={file ? 'check-circle' : slot.icon} size={20} color={file ? '#1D9E75' : TEAL} />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.docLabel}>{slot.label}</Text>
                              <Text style={styles.docStatus} numberOfLines={1}>
                                 {file ? file.name : 'Tap to upload'}
                              </Text>
                           </View>
                           {file ? (
                              <TouchableOpacity onPress={() => removeDocument(slot.key)} style={styles.docRemoveBtn}>
                                 <Ionicons name="close-circle" size={20} color="#E24B4A" />
                              </TouchableOpacity>
                           ) : (
                              <Ionicons name="cloud-upload-outline" size={20} color="#aaa" />
                           )}
                        </TouchableOpacity>
                     );
                  })}
               </View>

               <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                  <Text style={styles.submitBtnTxt}>{submitting ? 'Uploading & Submitting...' : 'Submit for Review'}</Text>
               </TouchableOpacity>
               <Text style={styles.footerNote}>Your documents will be uploaded securely and reviewed by the ApnaDoctor admin team.</Text>
            </ScrollView>
         </KeyboardAvoidingView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   barSub: { fontSize: 11, color: '#888', marginTop: 1 },
   scroll: { padding: 16, paddingBottom: 40 },
   groupLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
   groupBg: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   label: { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 10, marginBottom: 4 },
   input: { fontSize: 14, color: '#1a1a1a', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
   specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   specChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#eee', backgroundColor: '#fafafa' },
   specChipActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   specChipTxt: { fontSize: 13, color: '#555', fontWeight: '500' },
   specChipTxtActive: { color: TEAL, fontWeight: '700' },
   docNote: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 12 },
   docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#eee', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: '#fafafa' },
   docCardUploaded: { borderColor: '#CBEBE3', backgroundColor: '#F4FCFA' },
   docIconBg: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   docIconBgUploaded: { backgroundColor: '#E1F5EE' },
   docLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
   docStatus: { fontSize: 11.5, color: '#888', marginTop: 2 },
   docRemoveBtn: { padding: 4 },
   submitBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   submitBtnDisabled: { opacity: 0.7 },
   submitBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   footerNote: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
