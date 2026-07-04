import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
   Alert,
   FlatList,
   KeyboardAvoidingView,
   Platform,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

const initialMessages = [
   { id: '1', from: 'patient', text: 'Hello Doctor, I have been experiencing chest tightness since yesterday.', time: '10:02 AM' },
   { id: '2', from: 'doctor', text: 'Hello Rahul, I\'m sorry to hear that. Can you describe the pain? Is it sharp, dull, or pressure-like?', time: '10:03 AM' },
   { id: '3', from: 'patient', text: 'It feels like pressure, especially when I climb stairs. No pain at rest.', time: '10:04 AM' },
   { id: '4', from: 'doctor', text: 'Okay. Any shortness of breath, sweating, or nausea along with it?', time: '10:05 AM' },
   { id: '5', from: 'patient', text: 'Mild shortness of breath but no sweating.', time: '10:06 AM' },
];

const quickReplies = [
   'Can you describe your symptoms?',
   'How long have you had this issue?',
   'Any prior medical history?',
   'Are you on any medication?',
   'I\'ll write you a prescription now.',
];

export default function DoctorConsultationChatScreen() {
   const router = useRouter();
   const params = useLocalSearchParams();
   const patientName = params.patientName || 'Rahul Sharma';
   const diagnosis = params.diagnosis || 'Hypertension follow-up';
   const patientInitials = patientName.split(' ').map(w => w[0]).join('').toUpperCase();

   const insets = useSafeAreaInsets();
   const [messages, setMessages] = useState(initialMessages);
   const [inputText, setInputText] = useState('');
   const flatListRef = useRef(null);

   const sendMessage = (text) => {
      const msg = text || inputText.trim();
      if (!msg) return;
      setMessages(prev => [
         ...prev,
         { id: Date.now().toString(), from: 'doctor', text: msg, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
      ]);
      setInputText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
   };

   const handleEndChat = () => {
      Alert.alert(
         'End Consultation',
         'End this chat consultation?',
         [
            { text: 'Continue', style: 'cancel' },
            {
               text: 'End Chat',
               style: 'destructive',
               onPress: () => Alert.alert(
                  'Consultation Ended',
                  'Write a prescription for this patient?',
                  [
                      { text: 'Skip', onPress: () => router.replace('/doctor/dashboard') },
                      {
                         text: 'Write Rx',
                         onPress: () => router.replace({
                            pathname: '/doctor/prescription-write',
                            params: { patientName, diagnosis }
                         })
                      },
                  ]
               ),
            },
         ]
      );
   };

   const renderMessage = ({ item }) => {
      const isDoctor = item.from === 'doctor';
      return (
         <View style={[styles.msgRow, isDoctor ? styles.msgRowDoctor : styles.msgRowPatient]}>
            {!isDoctor && (
               <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarTxt}>{patientInitials}</Text>
               </View>
            )}
            <View style={[styles.bubble, isDoctor ? styles.bubbleDoctor : styles.bubblePatient]}>
               <Text style={[styles.bubbleTxt, isDoctor && styles.bubbleTxtDoctor]}>{item.text}</Text>
               <Text style={[styles.bubbleTime, isDoctor && styles.bubbleTimeDoctor]}>{item.time}</Text>
            </View>
         </View>
      );
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor={TEAL} />

         {/* Header */}
         <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
               <View style={styles.headerAvatar}>
                  <Text style={styles.headerAvatarTxt}>{patientInitials}</Text>
               </View>
               <View>
                  <Text style={styles.headerName}>{patientName}</Text>
                  <View style={styles.onlineDotRow}>
                     <View style={styles.onlineDot} />
                     <Text style={styles.onlineText}>Online · Chat Consultation</Text>
                  </View>
               </View>
            </View>
            <TouchableOpacity onPress={handleEndChat} style={styles.endBtn}>
               <Text style={styles.endBtnTxt}>End</Text>
            </TouchableOpacity>
         </View>

         <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.chatContainer}
            keyboardVerticalOffset={0}
         >
            {/* Patient Info Card */}
            <View style={styles.patientInfoCard}>
               <Ionicons name="medical-outline" size={14} color="#888" style={{ marginRight: 6 }} />
               <Text style={styles.patientInfoTxt}>{diagnosis} · Age 28</Text>
               <TouchableOpacity
                  style={styles.rxMiniBtn}
                  onPress={() => router.push({
                     pathname: '/doctor/prescription-write',
                     params: { patientName, diagnosis }
                  })}
               >
                  <MaterialCommunityIcons name="prescription" size={13} color={TEAL} />
                  <Text style={styles.rxMiniTxt}>Rx</Text>
               </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
               ref={flatListRef}
               data={messages}
               keyExtractor={item => item.id}
               renderItem={renderMessage}
               contentContainerStyle={styles.messagesList}
               showsVerticalScrollIndicator={false}
               onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            {/* Quick Replies */}
            <FlatList
               data={quickReplies}
               keyExtractor={item => item}
               horizontal
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={styles.quickRepliesList}
               renderItem={({ item }) => (
                  <TouchableOpacity
                     style={styles.quickReplyChip}
                     onPress={() => sendMessage(item)}
                  >
                     <Text style={styles.quickReplyTxt}>{item}</Text>
                  </TouchableOpacity>
               )}
            />

            {/* Input Bar */}
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
               <TouchableOpacity style={styles.attachBtn} onPress={() => Alert.alert('Attach', 'Attach lab reports or images to share with patient.')}>
                  <Ionicons name="attach" size={22} color="#888" />
               </TouchableOpacity>
               <TextInput
                  style={styles.inputField}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type your message..."
                  placeholderTextColor="#bbb"
                  multiline
               />
               <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                  onPress={() => sendMessage()}
                  disabled={!inputText.trim()}
               >
                  <Ionicons name="send" size={20} color="#fff" />
               </TouchableOpacity>
            </View>
         </KeyboardAvoidingView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   header: { flexDirection: 'row', alignItems: 'center', backgroundColor: TEAL, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
   backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
   headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
   headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
   headerAvatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
   headerName: { fontSize: 15, fontWeight: '700', color: '#fff' },
   onlineDotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
   onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B8F5D8', marginRight: 5 },
   onlineText: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
   endBtn: { backgroundColor: '#E24B4A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
   endBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
   chatContainer: { flex: 1 },
   patientInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
   patientInfoTxt: { flex: 1, fontSize: 12, color: '#666' },
   rxMiniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5F7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
   rxMiniTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
   messagesList: { padding: 16, paddingBottom: 8 },
   msgRow: { flexDirection: 'row', marginBottom: 12 },
   msgRowDoctor: { justifyContent: 'flex-end' },
   msgRowPatient: { justifyContent: 'flex-start' },
   patientAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 8, alignSelf: 'flex-end' },
   patientAvatarTxt: { fontSize: 10, fontWeight: 'bold', color: TEAL },
   bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
   bubbleDoctor: { backgroundColor: TEAL, borderBottomRightRadius: 4 },
   bubblePatient: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#eee' },
   bubbleTxt: { fontSize: 14, color: '#333', lineHeight: 20 },
   bubbleTxtDoctor: { color: '#fff' },
   bubbleTime: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
   bubbleTimeDoctor: { color: 'rgba(255,255,255,0.65)' },
   quickRepliesList: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
   quickReplyChip: { backgroundColor: '#E8F5F7', paddingHorizontal: 12, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#CBEBE3' },
   quickReplyTxt: { fontSize: 12, color: TEAL, fontWeight: '600' },
   inputBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 8 },
   attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
   inputField: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#333', maxHeight: 100 },
   sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
   sendBtnDisabled: { backgroundColor: '#ccc' },
});
