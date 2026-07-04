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
               <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
               <Text style={styles.body}>
                  By creating an account on Apna Doctor, you agree to be bound by these Terms &
                  Conditions and our Privacy Policy. If you do not agree, please do not use the app.
               </Text>

               <Text style={styles.sectionTitle}>2. Nature of Service</Text>
               <Text style={styles.body}>
                  Apna Doctor is a telemedicine platform connecting patients with registered
                  doctors for online consultations. It does not replace emergency medical care —
                  in an emergency, contact your nearest hospital immediately.
               </Text>

               <Text style={styles.sectionTitle}>3. Account Responsibility</Text>
               <Text style={styles.body}>
                  You are responsible for the accuracy of the information you provide, including
                  medical history, and for keeping your login credentials secure.
               </Text>

               <Text style={styles.sectionTitle}>4. Doctor Verification</Text>
               <Text style={styles.body}>
                  Doctors on the platform submit registration and identity documents for review.
                  Apna Doctor verifies these before approving a doctor account, but is not liable
                  for the outcome of any individual consultation.
               </Text>

               <Text style={styles.sectionTitle}>5. Data & Privacy</Text>
               <Text style={styles.body}>
                  Your personal and health information is stored securely and used only to provide
                  and improve the service. We do not sell your data to third parties.
               </Text>

               <Text style={styles.sectionTitle}>6. Changes to Terms</Text>
               <Text style={styles.body}>
                  We may update these terms from time to time. Continued use of the app after
                  changes means you accept the updated terms.
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
   sectionTitle: { fontSize: 13.5, fontWeight: '700', color: '#1a1a1a', marginTop: 14, marginBottom: 4 },
   body: { fontSize: 13, color: '#555', lineHeight: 19 },
   acceptBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   acceptBtnDisabled: { opacity: 0.7 },
   acceptBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});