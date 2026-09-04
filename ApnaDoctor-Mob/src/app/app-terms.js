import {
   Image,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function AppTermsScreen() {
   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         <View style={styles.topBar}>
            <Image
               source={require('../../assets/playstore-icon-512.png')}
               style={styles.logoImg}
               resizeMode="contain"
            />
            <View>
               <Text style={styles.barTitle}>Terms & Conditions</Text>
               <Text style={styles.barSub}>Please review before continuing</Text>
            </View>
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.groupBg}>
               <Text style={styles.docTitle}>APNA DOCTOR HEALTHCARE LLP</Text>
               <Text style={styles.docSubtitle}>APP TERMS & CONDITIONS</Text>
               <Text style={styles.docMeta}>Version 1.0 · Effective 01/07/2026</Text>

               <Text style={styles.sectionTitle}>1. Acceptance</Text>
               <Text style={styles.body}>
                  By registering, booking an appointment, requesting or attending a consultation,
                  uploading records, or using the Platform, you agree to these Terms and all
                  linked policies.
               </Text>

               <Text style={styles.sectionTitle}>2. Legal Framework</Text>
               <Text style={styles.body}>
                  These Terms are governed by applicable laws of India, including the Digital
                  Personal Data Protection Act, 2023, the Information Technology Act, 2000,
                  Telemedicine Practice Guidelines (as amended), applicable National Medical
                  Commission (NMC) regulations, State Medical Council requirements, the Consumer
                  Protection Act, 2019 and other applicable laws.
               </Text>

               <Text style={styles.sectionTitle}>3. Eligibility</Text>
               <Text style={styles.body}>
                  Users must provide accurate information, be legally competent, and minors may
                  use the Platform only through a parent or legal guardian.
               </Text>

               <Text style={styles.sectionTitle}>4. Platform Role</Text>
               <Text style={styles.body}>
                  Apna Doctor Healthcare LLP provides a technology platform to facilitate
                  telemedicine. Medical advice, diagnosis, prescriptions and treatment remain the
                  sole responsibility of the consulting Registered Medical Practitioner (RMP).
               </Text>

               <Text style={styles.sectionTitle}>5. Telemedicine Services</Text>
               <Text style={styles.body}>
                  The Platform may facilitate video, audio and chat consultations, appointments,
                  electronic prescriptions, health records, laboratory booking, medicine
                  fulfilment (where available) and related digital health services.
               </Text>

               <Text style={styles.sectionTitle}>6. Telemedicine Limitations</Text>
               <Text style={styles.body}>
                  Telemedicine has inherent limitations. Physical examination may be necessary.
                  Doctors may refuse teleconsultation or advise in-person consultation, emergency
                  care or hospitalization whenever clinically appropriate.
               </Text>

               <Text style={styles.sectionTitle}>7. Medical Emergencies</Text>
               <Text style={styles.body}>
                  The Platform is not intended for life-threatening emergencies. Call local
                  emergency services or visit the nearest emergency department immediately.
               </Text>

               <Text style={styles.sectionTitle}>8. User Responsibilities</Text>
               <Text style={styles.body}>
                  Provide complete and truthful medical information, disclose allergies,
                  pregnancy, chronic illnesses and medicines, follow medical advice responsibly,
                  and do not misuse prescriptions.
               </Text>

               <Text style={styles.sectionTitle}>9. Electronic Prescriptions</Text>
               <Text style={styles.body}>
                  Prescriptions are issued only by RMPs in accordance with applicable law.
                  Certain medicines may not be prescribed through teleconsultation or may require
                  video/in-person assessment.
               </Text>

               <Text style={styles.sectionTitle}>10. AI-Assisted Features</Text>
               <Text style={styles.body}>
                  AI tools are informational or clinical decision-support tools only and do not
                  replace professional medical judgment.
               </Text>

               <Text style={styles.sectionTitle}>11. Privacy</Text>
               <Text style={styles.body}>
                  Personal and health information will be processed in accordance with the
                  Privacy Policy and applicable law.
               </Text>

               <Text style={styles.sectionTitle}>12. Prohibited Conduct</Text>
               <Text style={styles.body}>
                  Users shall not impersonate others, upload false information, abuse healthcare
                  professionals, misuse prescriptions, interfere with platform security or use
                  the Platform for unlawful purposes.
               </Text>

               <Text style={styles.sectionTitle}>13. Payments</Text>
               <Text style={styles.body}>
                  Fees, refunds and cancellations are governed by the applicable Payment, Refund
                  and Cancellation Policies. No Goods and Services Tax (GST) is currently levied
                  on consultation charges paid by the patient/User; this is subject to change if
                  required by applicable law. Once a consultation or appointment has been
                  completed, the fee paid for that consultation is non-refundable, except as may
                  be expressly provided under the Refund & Cancellation Policy.
               </Text>

               <Text style={styles.sectionTitle}>14. Suspension</Text>
               <Text style={styles.body}>
                  Accounts may be suspended or terminated for fraud, false information, policy
                  violations, abuse, security risks or legal requirements.
               </Text>

               <Text style={styles.sectionTitle}>15. Limitation of Liability</Text>
               <Text style={styles.body}>
                  Apna Doctor Healthcare LLP is not liable for independent clinical decisions of
                  healthcare professionals, user-supplied inaccurate information, third-party
                  service failures or circumstances beyond reasonable control.
               </Text>

               <Text style={styles.sectionTitle}>16. Indemnity</Text>
               <Text style={styles.body}>
                  Users agree to indemnify the Platform against losses arising from breach of
                  these Terms, misuse of the Platform or unlawful conduct.
               </Text>

               <Text style={styles.sectionTitle}>17. Force Majeure</Text>
               <Text style={styles.body}>
                  The Platform shall not be liable for delays or failures caused by events beyond
                  reasonable control.
               </Text>

               <Text style={styles.sectionTitle}>18. Governing Law</Text>
               <Text style={styles.body}>
                  These Terms are governed by the laws of India. Jurisdiction shall lie with
                  competent courts where the registered office of Apna Doctor Healthcare LLP is
                  situated unless otherwise required by law.
               </Text>

               <Text style={styles.sectionTitle}>19. Final Decision-Making Authority</Text>
               <Text style={styles.body}>
                  In respect of all matters relating to the Platform, including but not limited
                  to doctor allocation, service availability, clinical or administrative
                  disputes, account actions, refunds, and interpretation or application of these
                  Terms and Policies, the decision of Apna Doctor Healthcare LLP shall be final
                  and binding on the User. By using the Platform, the User agrees to accept such
                  decisions without objection.
               </Text>

               <Text style={styles.sectionTitle}>20. Electronic Consent</Text>
               <Text style={styles.body}>
                  Electronic acceptance shall have the same legal effect as a handwritten
                  signature, to the extent permitted by applicable law.
               </Text>
            </View>
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   logoImg: { width: 36, height: 36, borderRadius: 10 },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   barSub: { fontSize: 11, color: '#888', marginTop: 1 },
   scroll: { padding: 16, paddingBottom: 40 },
   groupBg: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   docTitle: { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 0.5, textAlign: 'center' },
   docSubtitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginTop: 4, textAlign: 'center' },
   docMeta: { fontSize: 11.5, color: '#999', marginTop: 4, textAlign: 'center', marginBottom: 4 },
   sectionTitle: { fontSize: 13.5, fontWeight: '700', color: '#1a1a1a', marginTop: 14, marginBottom: 4 },
   body: { fontSize: 13, color: '#555', lineHeight: 19 },
   acceptBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   acceptBtnDisabled: { opacity: 0.7 },
   acceptBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});