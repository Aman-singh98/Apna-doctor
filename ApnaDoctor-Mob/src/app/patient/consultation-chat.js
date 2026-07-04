import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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

const TEAL = '#1A7E8A';

export default function ConsultationChatScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const insets = useSafeAreaInsets();
   
   const docName = params.docName || 'Dr. Rajesh Kumar';
   const spec = params.spec || 'Cardiologist';

   const [messages, setMessages] = useState([
      { id: '1', sender: 'system', text: 'This consultation is secure and end-to-end encrypted. Your medical summaries will be shared with the doctor only.', time: '02:58 PM' },
      { id: '2', sender: 'doctor', text: `Hello Rahul, welcome. I have reviewed your profile and Vital Info summary. How can I help you today?`, time: '03:00 PM' },
      { id: '3', sender: 'patient', text: 'Hello Doctor, I have been feeling a mild chest tightness and slight shortness of breath since yesterday morning after my run.', time: '03:01 PM' },
      { id: '4', sender: 'doctor', text: 'Got it. Is the chest tightness continuous, or does it come and go? Also, do you feel any pain radiating to your left arm, shoulder, or jaw?', time: '03:02 PM' },
      { id: '5', sender: 'patient', text: 'It comes and goes, mostly during deep breathing. No radiating pain to the arms or jaw.', time: '03:03 PM' },
   ]);
   const [inputText, setInputText] = useState('');
   const scrollViewRef = useRef();

   // Auto scroll to bottom when new messages arrive
   useEffect(() => {
      setTimeout(() => {
         if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
         }
      }, 100);
   }, [messages]);

   const handleSend = () => {
      if (!inputText.trim()) return;

      const newMsg = {
         id: String(messages.length + 1),
         sender: 'patient',
         text: inputText.trim(),
         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, newMsg]);
      setInputText('');

      // Simulate a mock doctor auto-reply after 2 seconds
      setTimeout(() => {
         const doctorReply = {
            id: String(messages.length + 2),
            sender: 'doctor',
            text: 'I understand. I recommend avoiding heavy exercises today. I will write a prescription for a mild anti-anginal medicine and request an ECG just to be safe.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
         };
         setMessages(prev => [...prev, doctorReply]);
      }, 2000);
   };

   const handleAttach = () => {
      Alert.alert(
         'Share Document',
         'Choose a document type to share with your doctor',
         [
            { 
               text: 'Medical Report', 
               onPress: () => {
                  const attachMsg = {
                     id: String(messages.length + 1),
                     sender: 'patient',
                     text: '📎 Shared Document: Latest_Blood_Report.pdf (1.2 MB)',
                     time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  };
                  setMessages(prev => [...prev, attachMsg]);
               } 
            },
            { 
               text: 'Prescription Photo', 
               onPress: () => {
                  const attachMsg = {
                     id: String(messages.length + 1),
                     sender: 'patient',
                     text: '📸 Shared Image: Previous_Prescription.jpg (540 KB)',
                     time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  };
                  setMessages(prev => [...prev, attachMsg]);
               } 
            },
            { text: 'Cancel', style: 'cancel' }
         ]
      );
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         
         {/* Custom Chat Header */}
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
                  <Text style={styles.docSpec}>{spec} · Online</Text>
               </View>
            </View>

            {/* Quick Consultation Actions */}
            <View style={styles.actionRow}>
               <TouchableOpacity 
                  style={styles.iconBtn}
                  onPress={() => router.push('/patient/consultation-call')}
               >
                  <Ionicons name="videocam" size={22} color={TEAL} />
               </TouchableOpacity>
               <TouchableOpacity 
                  style={styles.iconBtn}
                  onPress={() => router.push('/patient/consultation-call')}
               >
                  <Ionicons name="call" size={20} color={TEAL} />
               </TouchableOpacity>
            </View>
         </View>

         {/* Chat Message List */}
         <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
         >
            <ScrollView 
               ref={scrollViewRef}
               contentContainerStyle={styles.scroll} 
               showsVerticalScrollIndicator={false}
            >
               {messages.map((m) => {
                  if (m.sender === 'system') {
                     return (
                        <View key={m.id} style={styles.systemMsg}>
                           <Ionicons name="lock-closed" size={12} color="#888" style={{ marginRight: 6 }} />
                           <Text style={styles.systemMsgTxt}>{m.text}</Text>
                        </View>
                     );
                  }

                  const isPatient = m.sender === 'patient';
                  return (
                     <View 
                        key={m.id} 
                        style={[
                           styles.msgRow, 
                           isPatient ? styles.msgRowRight : styles.msgRowLeft
                        ]}
                     >
                        <View 
                           style={[
                              styles.bubble, 
                              isPatient ? styles.bubbleRight : styles.bubbleLeft
                           ]}
                        >
                           <Text style={[
                              styles.msgTxt, 
                              isPatient ? styles.msgTxtRight : styles.msgTxtLeft
                           ]}>
                              {m.text}
                           </Text>
                           <Text style={[
                              styles.msgTime, 
                              isPatient ? styles.msgTimeRight : styles.msgTimeLeft
                           ]}>
                              {m.time}
                           </Text>
                        </View>
                     </View>
                  );
               })}
            </ScrollView>

            {/* Chat Input Bar */}
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
