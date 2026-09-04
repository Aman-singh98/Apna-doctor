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
import { LEGAL_ENTITY, LEGAL_VERSION, PATIENT_TERMS_SECTIONS } from '../constants/legalContent';

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
            <View style={styles.docHeader}>
               <Text style={styles.docTitle}>{LEGAL_ENTITY}</Text>
               <Text style={styles.docSubtitle}>PATIENT TERMS & CONDITIONS</Text>
               <Text style={styles.docMeta}>{LEGAL_VERSION}</Text>
            </View>

            {PATIENT_TERMS_SECTIONS.map((section) => (
               <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionBody}>{section.body}</Text>
               </View>
            ))}

            <View style={styles.declarationBox}>
               <Text style={styles.declarationTitle}>Mandatory Patient Declaration & Consent</Text>
               <Text style={styles.declarationBody}>
                  I confirm that I have read, understood and agree to these Patient Terms &
                  Conditions and all applicable Platform Policies, including the Privacy Policy,
                  Telemedicine Consent Policy and Refund & Cancellation Policy; I voluntarily
                  consent to receive telemedicine services where clinically appropriate; I
                  understand the benefits and limitations of telemedicine and that emergency
                  medical conditions require immediate in-person care; I consent to the
                  collection, processing and storage of my personal and health information in
                  accordance with applicable law and the Privacy Policy; I acknowledge that
                  diagnosis, treatment and prescriptions are the sole professional responsibility
                  of the consulting Registered Medical Practitioner (RMP); I understand that no
                  GST is currently charged on consultation fees and that fees are non-refundable
                  once a consultation has been completed, except as provided under the Refund &
                  Cancellation Policy; I acknowledge and accept that Apna Doctor Healthcare LLP
                  shall have the final decision-making authority on all platform-related,
                  operational and administrative matters, and I agree to accept and abide by such
                  decisions; and I agree to be legally bound by these Terms by selecting 'I AGREE
                  & CONTINUE'.
               </Text>
            </View>
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
                  I confirm I have read, understood and agree to the Patient Terms & Conditions
                  and the Mandatory Declaration & Consent above
               </Text>
            </TouchableOpacity>

            <TouchableOpacity
               style={[styles.continueBtn, !checked && styles.continueBtnDisabled]}
               onPress={handleContinue}
               disabled={!checked || saving}
               activeOpacity={0.85}
            >
               <Text style={styles.continueBtnTxt}>
                  {saving ? 'Please wait...' : 'I AGREE & CONTINUE'}
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
   docHeader: { alignItems: 'center', marginBottom: 16 },
   docTitle: { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 0.5 },
   docSubtitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginTop: 4, textAlign: 'center' },
   docMeta: { fontSize: 11.5, color: '#999', marginTop: 4 },
   section: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
   sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
   sectionBody: { fontSize: 13, color: '#666', lineHeight: 19 },
   declarationBox: { backgroundColor: '#eef7f8', borderRadius: 14, padding: 14, marginTop: 6, borderWidth: 1, borderColor: '#cfe9ec' },
   declarationTitle: { fontSize: 13.5, fontWeight: '700', color: TEAL, marginBottom: 6 },
   declarationBody: { fontSize: 12.5, color: '#3a4b4d', lineHeight: 19 },
   footer: { padding: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
   checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
   checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
   checkboxChecked: { backgroundColor: TEAL, borderColor: TEAL },
   checkLabel: { flex: 1, fontSize: 13, color: '#333', lineHeight: 19 },
   continueBtn: { flexDirection: 'row', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   continueBtnDisabled: { backgroundColor: '#cbd5e1', elevation: 0, shadowOpacity: 0 },
   continueBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
