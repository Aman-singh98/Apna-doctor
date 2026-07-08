import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   KeyboardAvoidingView, Platform,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureFirebaseSignedIn, ensureChatDoc, subscribeToMessages, sendMessage } from '../../services/chatService';
import { getMyPatientProfile } from '../../services/patientProfileService'; // GET /patient/me → { _id, name, ... }

const TEAL = '#1A7E8A';

const formatTime = (ts) => {
   if (!ts) return '';
   const d = ts.toDate ? ts.toDate() : new Date(ts);
   return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ConsultationChatScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const insets = useSafeAreaInsets();

   // Whatever screen navigates a patient into this chat (appointment detail,
   // "message my doctor", etc.) needs to pass appointmentId + doctorId along
   // with docName/spec — the same way doctor/appointments.js already passes
   // appointmentId on the doctor side.
   const { appointmentId, doctorId } = params;
   const docName = params.docName || 'Dr. Rajesh Kumar';
   const spec = params.spec || 'Cardiologist';

   const [messages, setMessages] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState('');
   const [inputText, setInputText] = useState('');
   const [currentUser, setCurrentUser] = useState(null);
   const scrollViewRef = useRef();
   const unsubRef = useRef(null);

   useEffect(() => {
      if (!appointmentId) {
         setError('Missing appointmentId — cannot open chat.');
         setLoading(false);
         return;
      }

      let isMounted = true;
      (async () => {
         try {
            const profile = await getMyPatientProfile(); // { _id, name, ... }
            const fbUser = await ensureFirebaseSignedIn('patient');
            if (!isMounted) return;
            // fbUser.uid IS profile._id — the backend mints the Firebase
            // token using that same Mongo _id as the uid, so they always match.
            setCurrentUser({ uid: fbUser.uid, name: profile.name });

            await ensureChatDoc({
               appointmentId,
               patientId: fbUser.uid,
               doctorId: doctorId || null,
               patientName: profile.name,
               doctorName: docName,
            });

            unsubRef.current = subscribeToMessages(appointmentId, (msgs) => {
               if (!isMounted) return;
               setMessages(msgs);
               setLoading(false);
               setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 50);
            });
         } catch (err) {
            console.warn('Chat init failed:', err.message);
            if (isMounted) {
               setError('Could not connect to chat. Please check your connection.');
               setLoading(false);
            }
         }
      })();

      return () => {
         isMounted = false;
         if (unsubRef.current) unsubRef.current();
      };
   }, [appointmentId]);

   const handleSend = async () => {
      const text = inputText.trim();
      if (!text || !currentUser) return;
      setInputText('');
      try {
         await sendMessage({ appointmentId, senderId: currentUser.uid, senderRole: 'patient', text });
      } catch (err) {
         Alert.alert('Error', 'Message could not be sent. Please try again.');
      }
   };

   const handleAttach = () => {
      Alert.alert('Attach', 'File/image sharing can be added as a follow-up — needs Firebase Storage rather than Firestore.');
   };

   if (error) {
      return (
         <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
            <Ionicons name="cloud-offline-outline" size={40} color="#ccc" />
            <Text style={{ marginTop: 12, color: '#888', textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
               <Text style={{ color: TEAL, fontWeight: '700' }}>Go back</Text>
            </TouchableOpacity>
         </SafeAreaView>
      );
   }

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />

         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <View style={styles.docInfo}>
               <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>Dr</Text>
                  <View style={styles.onlineBadge} />
               </View>
               <View style={{ marginLeft: 10 }}>
                  <Text style={styles.docName}>{docName}</Text>
                  <Text style={styles.docSpec}>{spec}</Text>
               </View>
            </View>
            <View style={styles.actionRow}>
               <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/patient/consultation-call')}>
                  <Ionicons name="videocam" size={22} color={TEAL} />
               </TouchableOpacity>
               <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/patient/consultation-call')}>
                  <Ionicons name="call" size={20} color={TEAL} />
               </TouchableOpacity>
            </View>
         </View>

         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
            {loading ? (
               <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={TEAL} />
               </View>
            ) : (
               <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.systemMsg}>
                     <Ionicons name="lock-closed" size={12} color="#888" style={{ marginRight: 6 }} />
                     <Text style={styles.systemMsgTxt}>This consultation is secure and end-to-end encrypted. Your medical summaries will be shared with the doctor only.</Text>
                  </View>

                  {messages.map((m) => {
                     const isPatient = m.senderRole === 'patient';
                     return (
                        <View key={m.id} style={[styles.msgRow, isPatient ? styles.msgRowRight : styles.msgRowLeft]}>
                           <View style={[styles.bubble, isPatient ? styles.bubbleRight : styles.bubbleLeft]}>
                              <Text style={[styles.msgTxt, isPatient ? styles.msgTxtRight : styles.msgTxtLeft]}>{m.text}</Text>
                              <Text style={[styles.msgTime, isPatient ? styles.msgTimeRight : styles.msgTimeLeft]}>{formatTime(m.createdAt)}</Text>
                           </View>
                        </View>
                     );
                  })}
               </ScrollView>
            )}

            <View style={styles.inputBar}>
               <TouchableOpacity style={styles.attachBtn} onPress={handleAttach}>
                  <Ionicons name="add-circle" size={26} color={TEAL} />
               </TouchableOpacity>
               <TextInput
                  style={styles.input}
                  placeholder="Type a message..."
                  value={inputText}
                  onChangeText={setInputText}
                  placeholderTextColor="#999"
                  onSubmitEditing={handleSend}
               />
               <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!inputText.trim()}
               >
                  <Ionicons name="send" size={18} color="#fff" />
               </TouchableOpacity>
            </View>
         </KeyboardAvoidingView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
   docInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
   avatar: { position: 'relative', width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   avatarTxt: { fontSize: 13, fontWeight: 'bold', color: TEAL },
   onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D9E75', borderWidth: 2, borderColor: '#fff' },
   docName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
   docSpec: { fontSize: 11, color: '#666', marginTop: 1 },
   actionRow: { flexDirection: 'row', gap: 10 },
   iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0fbfc', alignItems: 'center', justifyContent: 'center' },
   scroll: { padding: 16, paddingBottom: 20 },
   systemMsg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f2f5', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 12, alignSelf: 'center', width: '90%' },
   systemMsgTxt: { fontSize: 11, color: '#666', textAlign: 'center', flex: 1, lineHeight: 15 },
   msgRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
   msgRowLeft: { justifyContent: 'flex-start' },
   msgRowRight: { justifyContent: 'flex-end' },
   bubble: { maxWidth: '78%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, elevation: 1 },
   bubbleLeft: { backgroundColor: '#fff', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#f0f0f0' },
   bubbleRight: { backgroundColor: TEAL, borderTopRightRadius: 4 },
   msgTxt: { fontSize: 13.5, lineHeight: 19 },
   msgTxtLeft: { color: '#333' },
   msgTxtRight: { color: '#fff' },
   msgTime: { fontSize: 9, marginTop: 4, alignSelf: 'flex-end' },
   msgTimeLeft: { color: '#aaa' },
   msgTimeRight: { color: 'rgba(255,255,255,0.7)' },
   inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
   attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   input: { flex: 1, height: 40, backgroundColor: '#fafafa', borderRadius: 20, paddingHorizontal: 16, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#eee', marginHorizontal: 8 },
   sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', elevation: 1 },
   sendBtnDisabled: { backgroundColor: '#ccc', elevation: 0 }
});
