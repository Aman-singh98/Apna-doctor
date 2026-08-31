import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
   Image,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markTermsAccepted } from '../utils/doctorAuth';

const TEAL = '#1A7E8A';

export default function DoctorTermsScreen() {
   const router = useRouter();
   const { phone } = useLocalSearchParams();
   const [checked, setChecked] = useState(false);
   const [saving, setSaving] = useState(false);

   const handleContinue = async () => {
      if (!checked || saving) return;
      setSaving(true);
      await markTermsAccepted();
      setSaving(false);
      // First-time doctor always goes to signup after accepting terms.
      router.replace({ pathname: '/doctor-signup', params: { phone } });
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         {/* Top Bar */}
         <View style={styles.topBar}>
            <Image
               source={require('../../assets/playstore-icon-512.png')}
               style={styles.logoImg}
               resizeMode="contain"
            />
            <Text style={styles.barTitle}>Terms & Conditions</Text>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
               Before you can join ApnaDoctor as a verified doctor, please read and accept the
               following terms. You will only need to do this once.
            </Text>

            {[
               {
                  title: '1. Professional Verification',
                  body: 'You confirm that all medical qualifications, registration numbers, and documents submitted during signup are genuine and accurately represent your credentials. ApnaDoctor reserves the right to verify these with the relevant medical council before approving your account.',
               },
               {
                  title: '2. Admin Approval Required',
                  body: 'Your account will remain in "Pending Review" status until an ApnaDoctor administrator manually verifies and approves your profile. You will not be able to accept consultations until approval is granted.',
               },
               {
                  title: '3. Patient Care Standards',
                  body: 'You agree to provide consultations, prescriptions, and medical advice in accordance with applicable medical ethics, laws, and professional standards in your jurisdiction.',
               },
               {
                  title: '4. Data & Privacy',
                  body: 'Patient health information accessed through this app is confidential. You agree not to share, store, or use patient data outside the scope of providing care through ApnaDoctor.',
               },
               {
                  title: '5. Fees & Payouts',
                  body: 'Consultation fees you set will be charged to patients through the app, and your earnings will be paid out as described in the Earnings section, subject to applicable platform fees.',
               },
               {
                  title: '6. Account Suspension',
                  body: 'ApnaDoctor may suspend or terminate your account in case of policy violations, patient complaints, or misuse of the platform, after due review.',
               },
            ].map((section) => (
               <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionBody}>{section.body}</Text>
               </View>
            ))}
         </ScrollView>

         {/* Checkbox + CTA */}
         <View style={styles.footer}>
            <TouchableOpacity
               style={styles.checkRow}
               onPress={() => setChecked(!checked)}
               activeOpacity={0.8}
            >
               <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
               </View>
               <Text style={styles.checkLabel}>
                  I have read and agree to the Terms & Conditions above
               </Text>
            </TouchableOpacity>

            <TouchableOpacity
               style={[styles.continueBtn, !checked && styles.continueBtnDisabled]}
               onPress={handleContinue}
               disabled={!checked || saving}
               activeOpacity={0.85}
            >
               <Text style={styles.continueBtnTxt}>
                  {saving ? 'Please wait...' : 'Accept & Continue'}
               </Text>
               <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
         </View>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   logoImg: { width: 34, height: 34, borderRadius: 10 },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   scroll: { padding: 16, paddingBottom: 24 },
   intro: { fontSize: 13, color: '#555', lineHeight: 20, marginBottom: 16 },
   section: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
   sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
   sectionBody: { fontSize: 13, color: '#666', lineHeight: 19 },
   footer: { padding: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
   checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
   checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
   checkboxChecked: { backgroundColor: TEAL, borderColor: TEAL },
   checkLabel: { flex: 1, fontSize: 13, color: '#333', lineHeight: 19 },
   continueBtn: { flexDirection: 'row', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   continueBtnDisabled: { backgroundColor: '#cbd5e1', elevation: 0, shadowOpacity: 0 },
   continueBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
