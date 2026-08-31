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
import { acceptTerms } from '../services/patientAuthService';

const TEAL = '#1A7E8A';

export default function PatientTermsScreen() {
   const router = useRouter();
   const { phone } = useLocalSearchParams();
   const [checked, setChecked] = useState(false);
   const [saving, setSaving] = useState(false);

   const handleContinue = async () => {
      if (!checked || saving) return;
      setSaving(true);
      await acceptTerms();
      setSaving(false);
      // First-time patient always goes to the profile setup form after accepting terms.
      router.replace({ pathname: '/patient-signup', params: { phone } });
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
               Before you can start using ApnaDoctor to book consultations, please read and
               accept the following terms. You will only need to do this once.
            </Text>

            {[
               {
                  title: '1. Nature of the Service',
                  body: 'ApnaDoctor connects you with independent, verified doctors for online consultations. It does not replace emergency medical care — in a medical emergency, contact your local emergency services immediately.',
               },
               {
                  title: '2. Accuracy of Information',
                  body: 'You agree to provide accurate personal and medical information (age, allergies, medical history, current medication, etc.) so the doctor can give you appropriate advice. Inaccurate information may affect the quality of care you receive.',
               },
               {
                  title: '3. Doctor-Patient Relationship',
                  body: 'Consultations, prescriptions, and advice given through the app are provided by the doctor you consult, at their professional discretion. ApnaDoctor does not itself practice medicine or guarantee outcomes.',
               },
               {
                  title: '4. Data & Privacy',
                  body: 'Your health information is shared only with the doctors you consult, for the purpose of providing you care. We do not sell your personal or medical data to third parties.',
               },
               {
                  title: '5. Fees & Refunds',
                  body: 'Consultation fees are shown before booking and charged at the time of confirmation. Refund and cancellation terms for missed or cancelled appointments are described in the Payments section of the app.',
               },
               {
                  title: '6. Account Responsibility',
                  body: 'You are responsible for keeping your account and OTP-linked phone number secure. ApnaDoctor may suspend accounts used in violation of these terms or for abusive behavior toward doctors or staff.',
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
