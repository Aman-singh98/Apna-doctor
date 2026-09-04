// ─── LegalDocScreen ────────────────────────────────────────────────────────
// Read-only viewer for legal documents (Privacy Policy, Terms of Service)
// opened from the Profile / Settings screens after the user is already
// logged in. Unlike patient-terms.js / doctor-terms.js (the signup-time
// screens with a checkbox + "I AGREE & CONTINUE" flow), this is purely
// informational — just a back button and the document.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function LegalDocScreen({ barTitle, docTitle, docSubtitle, docMeta, sections }) {
   const router = useRouter();

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         {/* Top Bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>{barTitle}</Text>
            <View style={{ width: 40 }} />
         </View>

         <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.docHeader}>
               <Text style={styles.docTitle}>{docTitle}</Text>
               <Text style={styles.docSubtitle}>{docSubtitle}</Text>
               {!!docMeta && <Text style={styles.docMeta}>{docMeta}</Text>}
            </View>

            {sections.map((section) => (
               <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionBody}>{section.body}</Text>
               </View>
            ))}

            <Text style={styles.footNote}>
               Questions about this document? Reach us anytime from Help & Support.
            </Text>
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: '#fff',
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
   },
   backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   scroll: { padding: 16, paddingBottom: 30 },
   docHeader: { alignItems: 'center', marginBottom: 16 },
   docTitle: { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 0.5 },
   docSubtitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginTop: 4, textAlign: 'center' },
   docMeta: { fontSize: 11.5, color: '#999', marginTop: 4 },
   section: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
   sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
   sectionBody: { fontSize: 13, color: '#666', lineHeight: 19 },
   footNote: { fontSize: 11.5, color: '#aaa', textAlign: 'center', marginTop: 8, marginBottom: 8 },
});

export { TEAL };
