import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Linking,
   Modal,
   RefreshControl,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PatientBottomNav from '../../components/PatientBottomNav';
// Same pattern as profileService.js — one function per endpoint.
// Adjust this relative path if your file tree differs.
import { createRecord as createRecordApi, deleteRecord as deleteRecordApi, getMyRecords } from '../../services/recordService';

const TEAL = '#1A7E8A';

function formatDate(isoString) {
   const d = new Date(isoString);
   return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Cloudinary serves files inline by default. Inserting the fl_attachment
// flag right after "/upload/" makes the response Content-Disposition:
// attachment, so the browser downloads the file instead of trying (and
// sometimes failing) to render it inline.
function getDownloadUrl(fileUrl, filename) {
   if (!fileUrl.includes('/upload/')) return fileUrl;
   const flag = filename ? `fl_attachment:${encodeURIComponent(filename)}` : 'fl_attachment';
   return fileUrl.replace('/upload/', `/upload/${flag}/`);
}

export default function RecordsScreen() {
   const router = useRouter();
   const [records, setRecords] = useState([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');
   const [activeCat, setActiveCat] = useState('All');

   // Modal upload states
   const [uploadModalVisible, setUploadModalVisible] = useState(false);
   const [newTitle, setNewTitle] = useState('');
   const [newType, setNewType] = useState('Lab Reports');
   const [newDoc, setNewDoc] = useState('');
   const [attachedFile, setAttachedFile] = useState(null); // { uri, name, size, mimeType }
   const [submitting, setSubmitting] = useState(false);

   const categories = ['All', 'Lab Reports', 'Prescriptions', 'Vaccines'];

   const fetchRecords = useCallback(async () => {
      try {
         const params = {};
         if (activeCat !== 'All') params.category = activeCat;
         if (searchQuery.trim()) params.search = searchQuery.trim();

         const res = await getMyRecords(params);
         setRecords(res.data);
      } catch (err) {
         Alert.alert('Error', err.response?.data?.message || err.message || 'Could not load records');
      }
   }, [activeCat, searchQuery]);

   useEffect(() => {
      setLoading(true);
      fetchRecords().finally(() => setLoading(false));
   }, [fetchRecords]);

   const onRefresh = async () => {
      setRefreshing(true);
      await fetchRecords();
      setRefreshing(false);
   };

   const pickDocument = async () => {
      const result = await DocumentPicker.getDocumentAsync({
         type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
         copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setAttachedFile(file);
   };

   const resetModal = () => {
      setNewTitle('');
      setNewDoc('');
      setNewType('Lab Reports');
      setAttachedFile(null);
   };

   const handleUpload = async () => {
      if (!newTitle.trim() || !newDoc.trim()) {
         Alert.alert('Error', 'Please fill in the record title and provider name.');
         return;
      }
      if (!attachedFile) {
         Alert.alert('Error', 'Please attach a document before saving.');
         return;
      }

      setSubmitting(true);
      try {
         const res = await createRecordApi({
            title: newTitle.trim(),
            category: newType,
            providerName: newDoc.trim(),
            file: attachedFile,
         });

         setRecords(prev => [res.data, ...prev]);
         setUploadModalVisible(false);
         resetModal();
         Alert.alert('Success', 'Record uploaded successfully!');
      } catch (err) {
         Alert.alert('Upload failed', err.response?.data?.message || err.message || 'Something went wrong');
      } finally {
         setSubmitting(false);
      }
   };

   const handleDelete = (record) => {
      Alert.alert('Delete Record', `Remove "${record.title}"? This can't be undone.`, [
         { text: 'Cancel', style: 'cancel' },
         {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
               try {
                  await deleteRecordApi(record.id);
                  setRecords(prev => prev.filter(r => r.id !== record.id));
               } catch (err) {
                  Alert.alert('Error', err.response?.data?.message || err.message || 'Could not delete record');
               }
            },
         },
      ]);
   };

   const filteredRecords = records; // filtering now happens server-side via fetchRecords

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={"#fff"} />
         <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
               <Text style={styles.title}>Medical Records</Text>
               <TouchableOpacity onPress={() => setUploadModalVisible(true)}>
                  <View style={styles.uploadBtn}>
                     <Ionicons name="cloud-upload" size={18} color="#fff" />
                     <Text style={styles.uploadBtnTxt}>Add Record</Text>
                  </View>
               </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
               <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
               <TextInput
                  style={styles.searchInput}
                  placeholder="Search records by name or doctor..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={fetchRecords}
                  returnKeyType="search"
               />
            </View>

            {/* Horizontal Categories */}
            <View style={{ marginBottom: 12 }}>
               <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.catScroll}
               >
                  {categories.map(c => (
                     <TouchableOpacity
                        key={c}
                        style={[styles.catTab, activeCat === c && styles.catTabActive]}
                        onPress={() => setActiveCat(c)}
                     >
                        <Text style={[styles.catTxt, activeCat === c && styles.catTxtActive]}>{c}</Text>
                     </TouchableOpacity>
                  ))}
               </ScrollView>
            </View>

            {/* Record List */}
            {loading ? (
               <View style={styles.emptyView}>
                  <ActivityIndicator size="large" color={TEAL} />
               </View>
            ) : (
               <ScrollView
                  contentContainerStyle={styles.scroll}
                  showsVerticalScrollIndicator={false}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
               >
                  {filteredRecords.length === 0 ? (
                     <View style={styles.emptyView}>
                        <Ionicons name="document-text-outline" size={60} color="#ccc" />
                        <Text style={styles.emptyTxt}>No medical records found</Text>
                     </View>
                  ) : (
                     filteredRecords.map(r => (
                        <View key={r.id} style={styles.card}>
                           <View style={styles.cardInfo}>
                              <MaterialCommunityIcons
                                 name={r.type === 'Prescriptions' ? 'file-document-outline' : r.type === 'Vaccines' ? 'shield-check-outline' : 'clipboard-pulse-outline'}
                                 size={32}
                                 color={TEAL}
                              />
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                 <Text style={styles.recTitle}>{r.title}</Text>
                                 <Text style={styles.recMeta}>Uploaded by: {r.doc}</Text>
                                 <Text style={styles.recSub}>{formatDate(r.date)} · {r.size} · {r.type}</Text>
                              </View>
                           </View>
                           <View style={styles.actionRow}>
                              <TouchableOpacity
                                 style={styles.actionBtn}
                                 onPress={() => {
                                    if (r.type === 'Prescriptions') {
                                       router.push('/patient/prescription-detail');
                                    } else {
                                       // Opens inline — browsers render PDFs and images
                                       // natively in a new tab.
                                       Linking.openURL(r.fileUrl);
                                    }
                                 }}
                              >
                                 <Ionicons name="eye-outline" size={16} color={TEAL} />
                                 <Text style={styles.actionBtnTxt}>View</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                 style={styles.actionBtn}
                                 onPress={() => Linking.openURL(getDownloadUrl(r.fileUrl, r.title))}
                              >
                                 <Ionicons name="download-outline" size={16} color={TEAL} />
                                 <Text style={styles.actionBtnTxt}>Download</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                 style={styles.actionBtn}
                                 onPress={() => handleDelete(r)}
                              >
                                 <Ionicons name="trash-outline" size={16} color="#E24B4A" />
                                 <Text style={[styles.actionBtnTxt, { color: '#E24B4A' }]}>Delete</Text>
                              </TouchableOpacity>
                           </View>
                        </View>
                     ))
                  )}
               </ScrollView>
            )}
         </View>

         {/* Upload Record Modal */}
         <Modal
            visible={uploadModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setUploadModalVisible(false)}
         >
            <View style={styles.modalOverlay}>
               <SafeAreaView style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Add Medical Record</Text>
                  <Text style={styles.modalSubtitle}>Keep your medical history organized in one place</Text>

                  <Text style={styles.label}>Record Title</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Blood Sugar Test, Dental Checkup"
                     value={newTitle}
                     onChangeText={setNewTitle}
                  />

                  <Text style={styles.label}>Record Category</Text>
                  <View style={styles.pickerRow}>
                     {['Lab Reports', 'Prescriptions', 'Vaccines'].map(t => (
                        <TouchableOpacity
                           key={t}
                           style={[styles.opt, newType === t && styles.optActive]}
                           onPress={() => setNewType(t)}
                        >
                           <Text style={[styles.optTxt, newType === t && styles.optTxtActive]}>{t}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <Text style={styles.label}>Doctor / Lab Name</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="e.g. Dr. Rajesh Kumar, Max Labs"
                     value={newDoc}
                     onChangeText={setNewDoc}
                  />

                  <Text style={styles.label}>Attach Document (PDF, PNG, JPG)</Text>
                  {attachedFile ? (
                     <View style={styles.fileCard}>
                        <Ionicons name="document-attach" size={24} color={TEAL} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                           <Text style={styles.fileName}>{attachedFile.name}</Text>
                           <Text style={styles.fileSize}>
                              {attachedFile.size ? `${Math.round(attachedFile.size / 1024)} KB` : ''}
                           </Text>
                        </View>
                        <TouchableOpacity onPress={() => setAttachedFile(null)}>
                           <Ionicons name="trash-outline" size={20} color="#E24B4A" />
                        </TouchableOpacity>
                     </View>
                  ) : (
                     <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}>
                        <Ionicons name="add-circle-outline" size={24} color="#777" />
                        <Text style={styles.attachBtnTxt}>Select file from device</Text>
                     </TouchableOpacity>
                  )}

                  <View style={styles.modalBtnRow}>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnCancel]}
                        onPress={() => {
                           setUploadModalVisible(false);
                           resetModal();
                        }}
                        disabled={submitting}
                     >
                        <Text style={styles.modalBtnCancelTxt}>Cancel</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnConfirm]}
                        onPress={handleUpload}
                        disabled={submitting}
                     >
                        {submitting ? (
                           <ActivityIndicator size="small" color="#fff" />
                        ) : (
                           <Text style={styles.modalBtnConfirmTxt}>Save Record</Text>
                        )}
                     </TouchableOpacity>
                  </View>
               </SafeAreaView>
            </View>
         </Modal>

         {/* Bottom Navigation */}
         <PatientBottomNav activeTab="records" />
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   container: { flex: 1, paddingBottom: 65 },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
   title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
   uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: TEAL, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
   uploadBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 4 },
   searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 14 },
   searchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
   catScroll: { paddingHorizontal: 16, gap: 8 },
   catTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
   catTabActive: { backgroundColor: TEAL, borderColor: TEAL },
   catTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   catTxtActive: { color: '#fff' },
   scroll: { paddingHorizontal: 16, paddingBottom: 24 },
   emptyView: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
   emptyTxt: { fontSize: 14, color: '#999', marginTop: 12 },
   card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   cardInfo: { flexDirection: 'row', alignItems: 'center' },
   recTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
   recMeta: { fontSize: 12, color: '#666', marginTop: 2 },
   recSub: { fontSize: 11, color: '#999', marginTop: 4 },
   actionRow: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#f9f9f9', paddingTop: 10, marginTop: 12, gap: 16 },
   actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   actionBtnTxt: { fontSize: 12, color: TEAL, fontWeight: 'bold' },

   // Modal styling
   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
   modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
   modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 12, marginBottom: 6 },
   input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa', marginBottom: 6 },
   pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
   opt: { flex: 1, borderWidth: 1.5, borderColor: '#eee', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fafafa' },
   optActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   optTxt: { fontSize: 12, fontWeight: '600', color: '#666' },
   optTxtActive: { color: TEAL },
   attachBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#ccc', borderRadius: 10, paddingVertical: 16, gap: 8, backgroundColor: '#fafafa', marginBottom: 16 },
   attachBtnTxt: { fontSize: 13, color: '#666', fontWeight: '500' },
   fileCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: TEAL, backgroundColor: '#E8F5F7', borderRadius: 10, padding: 12, marginBottom: 16 },
   fileName: { fontSize: 13, fontWeight: 'bold', color: TEAL },
   fileSize: { fontSize: 11, color: '#666', marginTop: 2 },
   modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 10 },
   modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
   modalBtnCancel: { borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
   modalBtnCancelTxt: { color: '#666', fontWeight: 'bold' },
   modalBtnConfirm: { backgroundColor: TEAL },
   modalBtnConfirmTxt: { color: '#fff', fontWeight: 'bold' },
});
