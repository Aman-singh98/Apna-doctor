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
import { submitPatientSignup } from '../utils/patientAuth';

const TEAL = '#1A7E8A';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientSignupScreen() {
   const router = useRouter();
   const { phone } = useLocalSearchParams();

   const [name, setName]           = useState('');
   const [email, setEmail]         = useState('');
   const [gender, setGender]       = useState('');
   const [dob, setDob]             = useState('');
   const [bloodGroup, setBloodGroup] = useState('');
   const [weight, setWeight]       = useState('');
   const [submitting, setSubmitting] = useState(false);

   const handleSubmit = async () => {
      if (!name.trim() || !gender || !dob.trim()) {
         Alert.alert('Missing Information', 'Please fill in your name, gender, and date of birth.');
         return;
      }
      if (email.trim() && !email.includes('@')) {
         Alert.alert('Invalid Email', 'Please enter a valid email address, or leave it blank.');
         return;
      }

      setSubmitting(true);
      try {
         await submitPatientSignup({ name, email, gender, dob, bloodGroup, weight });
         // Patients are active immediately — no admin approval step — so we
         // go straight to their dashboard instead of a "pending review" screen.
         router.replace('/patient/dashboard');
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
                  <MaterialCommunityIcons name="account-heart" size={20} color="#fff" />
               </View>
               <View>
                  <Text style={styles.barTitle}>Complete Your Profile</Text>
                  <Text style={styles.barSub}>One-time setup · takes under a minute</Text>
               </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
               <Text style={styles.groupLabel}>Personal Information</Text>
               <View style={styles.groupBg}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor="#bbb" />
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#bbb" keyboardType="email-address" autoCapitalize="none" />
                  <Text style={styles.label}>Date of Birth (DD-MM-YYYY) *</Text>
                  <TextInput style={[styles.input, { borderBottomWidth: 0 }]} value={dob} onChangeText={setDob} placeholder="e.g. 18-08-1998" placeholderTextColor="#bbb" />
               </View>

               <Text style={styles.groupLabel}>Gender *</Text>
               <View style={styles.groupBg}>
                  <View style={styles.chipRow}>
                     {GENDERS.map(g => (
                        <TouchableOpacity key={g} style={[styles.chip, gender === g && styles.chipActive]} onPress={() => setGender(g)}>
                           <Text style={[styles.chipTxt, gender === g && styles.chipTxtActive]}>{g}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>
               </View>

               <Text style={styles.groupLabel}>Health Information (optional)</Text>
               <View style={styles.groupBg}>
                  <Text style={styles.label}>Blood Group</Text>
                  <View style={styles.chipRow}>
                     {BLOOD_GROUPS.map(b => (
                        <TouchableOpacity key={b} style={[styles.chip, bloodGroup === b && styles.chipActive]} onPress={() => setBloodGroup(b)}>
                           <Text style={[styles.chipTxt, bloodGroup === b && styles.chipTxtActive]}>{b}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>
                  <Text style={styles.label}>Weight (kg)</Text>
                  <TextInput style={[styles.input, { borderBottomWidth: 0 }]} value={weight} onChangeText={setWeight} placeholder="e.g. 68" placeholderTextColor="#bbb" keyboardType="numeric" />
               </View>

               <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                  <Text style={styles.submitBtnTxt}>{submitting ? 'Saving...' : 'Finish Setup'}</Text>
                  {!submitting && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />}
               </TouchableOpacity>
               <Text style={styles.footerNote}>You can update this information anytime from your profile.</Text>
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
   chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#eee', backgroundColor: '#fafafa' },
   chipActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   chipTxt: { fontSize: 13, color: '#555', fontWeight: '500' },
   chipTxtActive: { color: TEAL, fontWeight: '700' },
   submitBtn: { flexDirection: 'row', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   submitBtnDisabled: { opacity: 0.7 },
   submitBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   footerNote: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
