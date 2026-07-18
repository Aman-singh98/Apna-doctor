import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Image,
   KeyboardAvoidingView,
   Platform,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyProfile, updateMyProfile, uploadMyPhoto, uploadMySignature } from '../services/profileService';
import {
   DOCTOR_CATEGORIES,
   SPECIALIZATIONS_BY_CATEGORY,
   getFeesForCategory,
} from '../constants/doctorFees';
import SignaturePadModal from '../components/SignaturePadModal';
import { dataUrlToFileUri } from '../utils/imageUtils';

const TEAL = '#1A7E8A';

export default function DoctorProfileEditScreen() {
   const router = useRouter();

   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [uploadingPhoto, setUploadingPhoto] = useState(false);
   const [uploadingSignature, setUploadingSignature] = useState(false);
   const [signaturePadVisible, setSignaturePadVisible] = useState(false);

   const [name, setName] = useState('');
   const [qualification, setQualification] = useState('');
   const [experience, setExperience] = useState('');
   const [hospital, setHospital] = useState('');
   const [bio, setBio] = useState('');
   const [selectedCategory, setSelectedCategory] = useState('');
   const [selectedSpec, setSelectedSpec] = useState('');
   const [photoUrl, setPhotoUrl] = useState(null);
   const [signatureUrl, setSignatureUrl] = useState(null);

   const availableSpecs = selectedCategory ? SPECIALIZATIONS_BY_CATEGORY[selectedCategory] : [];
   const fees = selectedCategory ? getFeesForCategory(selectedCategory) : null;

   useEffect(() => {
      let isMounted = true;
      (async () => {
         try {
            const doctor = await getMyProfile();
            if (!isMounted) return;
            setName(doctor.name || '');
            setQualification(doctor.qualification || '');
            setExperience(doctor.experience != null ? String(doctor.experience) : '');
            setHospital(doctor.hospital || '');
            setBio(doctor.bio || '');
            setSelectedCategory(doctor.category || '');
            setSelectedSpec(doctor.specialization || '');
            setPhotoUrl(doctor.photoUrl || null);
            setSignatureUrl(doctor.signatureUrl || null);
         } catch (err) {
            Alert.alert('Error', 'Could not load your profile. Please try again.');
         } finally {
            if (isMounted) setLoading(false);
         }
      })();
      return () => { isMounted = false; };
   }, []);

   const handleChangePhoto = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
         return Alert.alert(
            'Permission needed',
            'Please allow photo library access to update your profile picture.'
         );
      }

      const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         allowsEditing: true,
         aspect: [1, 1],
         quality: 0.8,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      setUploadingPhoto(true);
      try {
         const updated = await uploadMyPhoto(uri);
         setPhotoUrl(updated.photoUrl);
      } catch (err) {
         Alert.alert(
            'Upload failed',
            err?.response?.data?.message || 'Could not upload your photo. Please try again.'
         );
      } finally {
         setUploadingPhoto(false);
      }
   };

   const handleUploadSignatureFromGallery = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
         return Alert.alert(
            'Permission needed',
            'Please allow photo library access to add your signature.'
         );
      }

      // Wide aspect ratio suits a signature better than a square crop.
      const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         allowsEditing: true,
         aspect: [3, 1],
         quality: 0.8,
      });

      if (result.canceled) return;

      await persistSignature(result.assets[0].uri);
   };

   const handleDrawnSignatureSave = async (dataUrl) => {
      setSignaturePadVisible(false);
      try {
         const fileUri = await dataUrlToFileUri(dataUrl);
         await persistSignature(fileUri);
      } catch (err) {
         Alert.alert('Error', 'Could not process your drawn signature. Please try again.');
      }
   };

   // Shared upload step used by both the gallery-picked and hand-drawn paths.
   const persistSignature = async (uri) => {
      setUploadingSignature(true);
      try {
         const updated = await uploadMySignature(uri);
         setSignatureUrl(updated.signatureUrl);
      } catch (err) {
         Alert.alert(
            'Upload failed',
            err?.response?.data?.message || 'Could not upload your signature. Please try again.'
         );
      } finally {
         setUploadingSignature(false);
      }
   };

   const handleCategorySelect = (catKey) => {
      // Changing category changes the fixed fee schedule and the valid
      // specialization list — reset specialization so it can't stay
      // mismatched with the newly picked category.
      setSelectedCategory(catKey);
      setSelectedSpec('');
   };

   const handleSave = async () => {
      if (saving) return;

      if (!name.trim() || !qualification.trim()) {
         return Alert.alert('Validation', 'Name and qualification are required.');
      }
      if (!selectedCategory) {
         return Alert.alert('Validation', 'Please select your doctor category.');
      }
      if (!selectedSpec) {
         return Alert.alert('Validation', 'Please select your specialization.');
      }
      if (experience && (Number.isNaN(Number(experience)) || Number(experience) < 0)) {
         return Alert.alert('Validation', 'Experience must be a valid number of years.');
      }

      setSaving(true);
      try {
         await updateMyProfile({
            name: name.trim(),
            qualification: qualification.trim(),
            experience: experience ? Number(experience) : undefined,
            hospital: hospital.trim(),
            bio: bio.trim(),
            category: selectedCategory,        // fees are derived server-side from this
            specialization: selectedSpec,
         });
         Alert.alert('Profile Updated', 'Your profile changes have been saved successfully.', [
            { text: 'OK', onPress: () => router.back() },
         ]);
      } catch (err) {
         Alert.alert(
            'Error',
            err?.response?.data?.message || 'Could not save your changes. Please try again.'
         );
      } finally {
         setSaving(false);
      }
   };

   if (loading) {
      return (
         <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={TEAL} />
         </SafeAreaView>
      );
   }

   const initials = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="dark-content" backgroundColor="#fff" />
         <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
         >
            {/* Top Bar */}
            <View style={styles.topBar}>
               <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
               </TouchableOpacity>
               <Text style={styles.barTitle}>Edit Profile</Text>
               <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
                  {saving ? (
                     <ActivityIndicator size="small" color="#fff" />
                  ) : (
                     <Text style={styles.saveBtnTxt}>Save</Text>
                  )}
               </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
               {/* Avatar */}
               <View style={styles.avatarSection}>
                  <View style={styles.avatarWrap}>
                     {uploadingPhoto ? (
                        <ActivityIndicator size="small" color="#fff" />
                     ) : photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
                     ) : (
                        <Text style={styles.avatarTxt}>{initials || 'DR'}</Text>
                     )}
                  </View>
                  <TouchableOpacity
                     style={styles.changePhotoBtn}
                     onPress={handleChangePhoto}
                     disabled={uploadingPhoto}
                  >
                     <Ionicons name="camera-outline" size={14} color={TEAL} />
                     <Text style={styles.changePhotoTxt}>
                        {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                     </Text>
                  </TouchableOpacity>
               </View>

               {/* Personal Info */}
               <Text style={styles.groupLabel}>Personal Information</Text>
               <View style={styles.groupBg}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                     style={styles.input}
                     value={name}
                     onChangeText={setName}
                     placeholder="Dr. Full Name"
                  />

                  <Text style={styles.label}>Qualification</Text>
                  <TextInput
                     style={styles.input}
                     value={qualification}
                     onChangeText={setQualification}
                     placeholder="e.g. MBBS, MD (Cardiology)"
                  />

                  <Text style={styles.label}>Experience (years)</Text>
                  <TextInput
                     style={styles.input}
                     value={experience}
                     onChangeText={setExperience}
                     keyboardType="numeric"
                     placeholder="Years of experience"
                  />

                  <Text style={[styles.label, { marginTop: 0 }]}>Hospital / Clinic</Text>
                  <TextInput
                     style={[styles.input, { borderBottomWidth: 0 }]}
                     value={hospital}
                     onChangeText={setHospital}
                     placeholder="Hospital or clinic name"
                  />
               </View>

               {/* Signature */}
               <Text style={styles.groupLabel}>Signature</Text>
               <View style={styles.groupBg}>
                  <Text style={styles.helperTxt}>Appears on prescriptions you issue to patients.</Text>
                  <View style={styles.signatureBox}>
                     {uploadingSignature ? (
                        <ActivityIndicator size="small" color={TEAL} />
                     ) : signatureUrl ? (
                        <Image source={{ uri: signatureUrl }} style={styles.signatureImg} resizeMode="contain" />
                     ) : (
                        <View style={styles.signaturePlaceholder}>
                           <MaterialCommunityIcons name="draw-pen" size={22} color="#bbb" />
                           <Text style={styles.signaturePlaceholderTxt}>No signature added</Text>
                        </View>
                     )}
                  </View>
                  <View style={styles.signatureActionsRow}>
                     <TouchableOpacity
                        style={styles.signatureActionBtn}
                        onPress={() => setSignaturePadVisible(true)}
                        disabled={uploadingSignature}
                     >
                        <Ionicons name="create-outline" size={14} color={TEAL} />
                        <Text style={styles.changePhotoTxt}>Draw Signature</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={styles.signatureActionBtn}
                        onPress={handleUploadSignatureFromGallery}
                        disabled={uploadingSignature}
                     >
                        <Ionicons name="image-outline" size={14} color={TEAL} />
                        <Text style={styles.changePhotoTxt}>
                           {uploadingSignature ? 'Uploading...' : 'Upload Image'}
                        </Text>
                     </TouchableOpacity>
                  </View>
               </View>

               <SignaturePadModal
                  visible={signaturePadVisible}
                  onClose={() => setSignaturePadVisible(false)}
                  onSave={handleDrawnSignatureSave}
               />

               {/* Doctor Category — drives specialization list + fixed fees */}
               <Text style={styles.groupLabel}>Doctor Category</Text>
               <View style={styles.groupBg}>
                  {DOCTOR_CATEGORIES.map(cat => {
                     const active = selectedCategory === cat.key;
                     return (
                        <TouchableOpacity
                           key={cat.key}
                           style={[styles.categoryCard, active && styles.categoryCardActive]}
                           onPress={() => handleCategorySelect(cat.key)}
                           activeOpacity={0.85}
                        >
                           <View style={{ flex: 1 }}>
                              <Text style={[styles.categoryTitle, active && styles.categoryTitleActive]}>{cat.label}</Text>
                              <Text style={styles.categoryFeesTxt}>
                                 Video ₹{cat.fees.video} · Audio ₹{cat.fees.audio} · Chat ₹{cat.fees.chat}
                              </Text>
                           </View>
                           <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                              {active && <View style={styles.radioInner} />}
                           </View>
                        </TouchableOpacity>
                     );
                  })}
               </View>

               {/* Specialization */}
               <Text style={styles.groupLabel}>Specialization</Text>
               <View style={styles.groupBg}>
                  {!selectedCategory ? (
                     <Text style={styles.helperTxt}>Select a doctor category above first.</Text>
                  ) : (
                     <View style={styles.specGrid}>
                        {availableSpecs.map(s => (
                           <TouchableOpacity
                              key={s}
                              style={[styles.specChip, selectedSpec === s && styles.specChipActive]}
                              onPress={() => setSelectedSpec(s)}
                           >
                              <Text style={[styles.specChipTxt, selectedSpec === s && styles.specChipTxtActive]}>
                                 {s}
                              </Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  )}
               </View>

               {/* Consultation Fees — read-only, fixed by category */}
               <Text style={styles.groupLabel}>Consultation Fees</Text>
               <View style={styles.groupBg}>
                  {!fees ? (
                     <Text style={styles.helperTxt}>Select a category to see your fees.</Text>
                  ) : (
                     <>
                        <Text style={styles.helperTxt}>
                           Set automatically by your category. Contact support if you need this changed.
                        </Text>
                        <View style={styles.feeRow}>
                           <View style={styles.feeIconBg}>
                              <Ionicons name="videocam-outline" size={18} color={TEAL} />
                           </View>
                           <Text style={styles.feeLabel}>Video Consultation</Text>
                           <Text style={styles.feeValue}>₹{fees.video}</Text>
                        </View>
                        <View style={[styles.feeRow, styles.feeRowDivider]}>
                           <View style={styles.feeIconBg}>
                              <Ionicons name="call-outline" size={18} color={TEAL} />
                           </View>
                           <Text style={styles.feeLabel}>Audio Consultation</Text>
                           <Text style={styles.feeValue}>₹{fees.audio}</Text>
                        </View>
                        <View style={[styles.feeRow, styles.feeRowDivider]}>
                           <View style={styles.feeIconBg}>
                              <Ionicons name="chatbubbles-outline" size={18} color={TEAL} />
                           </View>
                           <Text style={styles.feeLabel}>Chat Consultation</Text>
                           <Text style={styles.feeValue}>₹{fees.chat}</Text>
                        </View>
                     </>
                  )}
               </View>

               {/* Bio */}
               <Text style={styles.groupLabel}>Professional Bio</Text>
               <View style={styles.groupBg}>
                  <TextInput
                     style={styles.bioInput}
                     value={bio}
                     onChangeText={setBio}
                     multiline
                     numberOfLines={4}
                     placeholder="Describe your expertise and approach..."
                  />
               </View>

               <TouchableOpacity style={styles.saveFullBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                     <ActivityIndicator size="small" color="#fff" />
                  ) : (
                     <Text style={styles.saveFullBtnTxt}>Save Changes</Text>
                  )}
               </TouchableOpacity>
            </ScrollView>
         </KeyboardAvoidingView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   saveBtn: { backgroundColor: TEAL, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
   saveBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
   scroll: { padding: 16, paddingBottom: 40 },
   avatarSection: { alignItems: 'center', marginVertical: 16 },
   avatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: TEAL, shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, overflow: 'hidden' },
   avatarImg: { width: 80, height: 80, borderRadius: 40 },
   avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 28 },
   changePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, justifyContent: 'center' },
   changePhotoTxt: { fontSize: 13, color: TEAL, fontWeight: '600' },
   signatureActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
   signatureActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
   groupLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
   groupBg: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
   label: { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 10, marginBottom: 4 },
   input: { fontSize: 14, color: '#1a1a1a', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
   helperTxt: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 10 },
   specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
   specChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#eee', backgroundColor: '#fafafa' },
   specChipActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   specChipTxt: { fontSize: 13, color: '#555', fontWeight: '500' },
   specChipTxtActive: { color: TEAL, fontWeight: '700' },
   bioInput: { fontSize: 14, color: '#1a1a1a', minHeight: 100, textAlignVertical: 'top', lineHeight: 22 },
   saveFullBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, elevation: 3, shadowColor: TEAL, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
   saveFullBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
   // Signature
   signatureBox: { height: 90, borderRadius: 12, borderWidth: 1.5, borderColor: '#eee', backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
   signatureImg: { width: '90%', height: '80%' },
   signaturePlaceholder: { alignItems: 'center', gap: 6 },
   signaturePlaceholderTxt: { fontSize: 12, color: '#bbb' },
   // Category
   categoryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#eee', borderRadius: 12, padding: 14, marginBottom: 10, backgroundColor: '#fafafa' },
   categoryCardActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   categoryTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
   categoryTitleActive: { color: TEAL },
   categoryFeesTxt: { fontSize: 12, color: '#888', marginTop: 3 },
   radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
   radioOuterActive: { borderColor: TEAL },
   radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL },
   // Fees (read-only display)
   feeRow: { flexDirection: 'row', alignItems: 'center' },
   feeRowDivider: { borderTopWidth: 1, borderTopColor: '#f5f5f5', marginTop: 8, paddingTop: 8 },
   feeIconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
   feeLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
   feeValue: { fontSize: 15, fontWeight: '700', color: TEAL },
});
