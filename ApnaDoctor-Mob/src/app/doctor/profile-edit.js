import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Image,
   KeyboardAvoidingView,
   Linking,
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
import { getMyProfile, updateMyProfile, uploadMyPhoto, uploadMySignature, getMyPayoutInfo } from '../../services/profileService';
import { submitPayoutKyc } from '../../utils/doctorAuth';
import { BUSINESS_TYPES, validatePayoutKyc } from '../../utils/payoutValidators';
import { dataUrlToFileUri } from '../../utils/imageUtils';
import SignaturePadModal from '../../components/SignaturePadModal';
import {
   DOCTOR_CATEGORIES,
   SPECIALIZATIONS_BY_CATEGORY,
   getFeesForCategory,
} from '../../constants/doctorFees';

const TEAL = '#1A7E8A';

export default function DoctorProfileEditScreen() {
   const router = useRouter();

   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [uploadingPhoto, setUploadingPhoto] = useState(false);
   const [uploadingSignature, setUploadingSignature] = useState(false);

   const [name, setName] = useState('');
   const [qualification, setQualification] = useState('');
   const [regNumber, setRegNumber] = useState('');
   const [experience, setExperience] = useState('');
   const [hospital, setHospital] = useState('');
   const [bio, setBio] = useState('');
   const [selectedCategory, setSelectedCategory] = useState('');
   const [selectedSpec, setSelectedSpec] = useState('');
   const [photoUrl, setPhotoUrl] = useState(null);
   const [signatureUrl, setSignatureUrl] = useState(null);
   const [signaturePadVisible, setSignaturePadVisible] = useState(false);

   // ── Account & Payout Details ────────────────────────────────────────────
   // Loaded separately from the main profile (getMyPayoutInfo only ever
   // returns masked values — see profileService.js) and saved through the
   // same /doctor/me/payout-kyc endpoint doctor-signup.js posts to; posting
   // again just overwrites what's on file (Doctor.setPayoutKyc()).
   const [payoutLoading, setPayoutLoading] = useState(true);
   const [payoutSaving, setPayoutSaving] = useState(false);
   const [payoutStatus, setPayoutStatus] = useState(null);
   const [payoutOnFile, setPayoutOnFile] = useState(null); // masked snapshot from the server
   const [legalBusinessName, setLegalBusinessName] = useState('');
   const [businessType, setBusinessType] = useState('individual');
   const [contactEmail, setContactEmail] = useState('');
   const [payoutMethod, setPayoutMethod] = useState('bank');
   const [pan, setPan] = useState('');
   const [bankAccountNumber, setBankAccountNumber] = useState('');
   const [confirmBankAccountNumber, setConfirmBankAccountNumber] = useState('');
   const [ifscCode, setIfscCode] = useState('');
   const [upiId, setUpiId] = useState('');
   const [payoutErrors, setPayoutErrors] = useState({});

   const clearPayoutError = (field) => {
      setPayoutErrors(prev => {
         if (!prev[field]) return prev;
         const next = { ...prev };
         delete next[field];
         return next;
      });
   };

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
            setRegNumber(doctor.regNumber || '');
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

   // Pre-fills the payout form with whatever's already on file (business
   // name/type/email are shown in full — they aren't sensitive; PAN/bank/UPI
   // are only ever shown as a masked hint via the placeholder, never
   // pre-filled into an editable value, since the real values never leave
   // the server).
   useEffect(() => {
      let isMounted = true;
      (async () => {
         try {
            const info = await getMyPayoutInfo();
            if (!isMounted) return;
            setPayoutStatus(info.payoutStatus);
            setPayoutOnFile(info.hasSubmittedPayoutKyc ? info : null);
            setLegalBusinessName(info.legalBusinessName || '');
            setBusinessType(info.businessType || 'individual');
            setContactEmail(info.contactEmail || '');
            if (info.upiIdMasked && !info.bankAccountLast4) setPayoutMethod('upi');
         } catch (err) {
            console.warn('Failed to load payout info:', err?.message);
         } finally {
            if (isMounted) setPayoutLoading(false);
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

   const handleChangeSignature = async () => {
      try {
         const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf'],
            copyToCacheDirectory: true,
         });

         // Expo SDK 49+: result.canceled instead of result.type === 'cancel'
         if (result.canceled) return;

         const file = result.assets[0];
         await saveSignatureFile({ uri: file.uri, name: file.name, type: 'application/pdf' });
      } catch (err) {
         Alert.alert('Error', 'Could not pick document. Please try again.');
      }
   };

   const handleDrawnSignatureSave = async (dataUrl) => {
      setSignaturePadVisible(false);
      try {
         const fileUri = await dataUrlToFileUri(dataUrl);
         await saveSignatureFile({ uri: fileUri, name: 'signature.png', type: 'image/png' });
      } catch (err) {
         Alert.alert('Error', 'Could not save your drawn signature. Please try again.');
      }
   };

   // Shared upload step for both signature paths above — a signature can be
   // either a PDF (uploaded from files) or a PNG (drawn on the pad), same as
   // the signature slot in doctor-signup.js, so both funnel through the same
   // uploadMySignature call rather than assuming one fixed file type.
   const saveSignatureFile = async (file) => {
      setUploadingSignature(true);
      try {
         const updated = await uploadMySignature(file);
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

   // A signature URL can be a PDF (file upload) or PNG (drawn) — decide how
   // to render/open it based on the extension rather than assuming an image.
   const signatureIsPdf = !!signatureUrl && signatureUrl.toLowerCase().split('?')[0].endsWith('.pdf');

   const handleViewSignature = () => {
      if (!signatureUrl) return;
      Linking.openURL(signatureUrl).catch(() => {
         Alert.alert('Error', 'Could not open the signature file.');
      });
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
            regNumber: regNumber.trim(),
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

   // Separate save path from handleSave — payout KYC is its own endpoint
   // (POST /doctor/me/payout-kyc) distinct from the profile PATCH, exactly
   // as doctor-signup.js treats them. The endpoint always requires a full,
   // valid payload (PAN + bank-or-UPI included) even to change just the
   // business name or contact email — it overwrites the whole encrypted
   // record and the real PAN/bank/UPI values are never sent back to the
   // client to pre-fill, so there's no partial-update path here. The UI
   // below makes that explicit rather than pretending a lighter edit is
   // possible.
   const handleSavePayout = async () => {
      if (payoutSaving) return;

      const errors = validatePayoutKyc({
         pan, legalBusinessName, businessType, contactEmail,
         payoutMethod, bankAccountNumber, confirmBankAccountNumber, ifscCode, upiId,
      });

      if (Object.keys(errors).length > 0) {
         setPayoutErrors(errors);
         return Alert.alert('Validation', 'Please fix the highlighted payout fields.');
      }

      setPayoutSaving(true);
      try {
         await submitPayoutKyc({
            pan, legalBusinessName, businessType, contactEmail,
            bankAccountNumber: payoutMethod === 'bank' ? bankAccountNumber : undefined,
            confirmBankAccountNumber: payoutMethod === 'bank' ? confirmBankAccountNumber : undefined,
            ifscCode: payoutMethod === 'bank' ? ifscCode : undefined,
            upiId: payoutMethod === 'upi' ? upiId : undefined,
         });
         const refreshed = await getMyPayoutInfo();
         setPayoutStatus(refreshed.payoutStatus);
         setPayoutOnFile(refreshed.hasSubmittedPayoutKyc ? refreshed : null);
         setPan('');
         setBankAccountNumber('');
         setConfirmBankAccountNumber('');
         setIfscCode('');
         setUpiId('');
         setPayoutErrors({});
         Alert.alert('Payout Details Saved', 'Your payout details have been updated.');
      } catch (err) {
         Alert.alert(
            'Error',
            err?.response?.data?.message || 'Could not save your payout details. Please try again.'
         );
      } finally {
         setPayoutSaving(false);
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

                  <Text style={styles.label}>Medical Registration Number</Text>
                  <TextInput
                     style={styles.input}
                     value={regNumber}
                     onChangeText={setRegNumber}
                     placeholder="Your medical council registration number"
                     autoCapitalize="characters"
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

                  {uploadingSignature ? (
                     <View style={styles.signatureBox}>
                        <ActivityIndicator size="small" color={TEAL} />
                     </View>
                  ) : signatureUrl ? (
                     signatureIsPdf ? (
                        <TouchableOpacity style={styles.docCard} onPress={handleViewSignature} activeOpacity={0.85}>
                           <View style={styles.docIconBg}>
                              <MaterialCommunityIcons name="file-pdf-box" size={20} color={TEAL} />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.docLabel}>Signature.pdf</Text>
                              <Text style={styles.docStatus}>Tap to view</Text>
                           </View>
                           <Ionicons name="open-outline" size={18} color="#aaa" />
                        </TouchableOpacity>
                     ) : (
                        <View style={styles.signatureBox}>
                           <Image source={{ uri: signatureUrl }} style={styles.signatureImg} resizeMode="contain" />
                        </View>
                     )
                  ) : (
                     <View style={styles.signatureBox}>
                        <View style={styles.signaturePlaceholder}>
                           <MaterialCommunityIcons name="draw-pen" size={22} color="#bbb" />
                           <Text style={styles.signaturePlaceholderTxt}>No signature added</Text>
                        </View>
                     </View>
                  )}

                  <TouchableOpacity
                     style={styles.changePhotoBtn}
                     onPress={handleChangeSignature}
                     disabled={uploadingSignature}
                  >
                     <Ionicons name="create-outline" size={14} color={TEAL} />
                     <Text style={styles.changePhotoTxt}>
                        {uploadingSignature ? 'Uploading...' : signatureUrl ? 'Upload New PDF' : 'Upload Signature (PDF)'}
                     </Text>
                  </TouchableOpacity>

                  {!uploadingSignature && (
                     <TouchableOpacity
                        style={styles.drawSignatureLink}
                        onPress={() => setSignaturePadVisible(true)}
                        activeOpacity={0.7}
                     >
                        <Ionicons name="create-outline" size={15} color={TEAL} />
                        <Text style={styles.drawSignatureLinkTxt}>or draw your signature instead</Text>
                     </TouchableOpacity>
                  )}
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

               {/* Account & Payout Details — collected at signup (Phase 3
                   payout KYC) but previously had no view/edit surface here.
                   panLast4/bankAccountLast4/upiIdMasked are display-only
                   hints of what's on file; the actual PAN/bank/UPI must be
                   re-entered in full to change anything, since the real
                   values are never sent back to the client (see
                   getMyPayoutInfo on the backend). */}
               <Text style={[styles.groupLabel, { marginTop: 28 }]}>Account & Payout Details</Text>
               <View style={styles.groupBg}>
                  {payoutLoading ? (
                     <ActivityIndicator size="small" color={TEAL} />
                  ) : (
                     <>
                        <View style={styles.payoutStatusRow}>
                           <Text style={styles.helperTxt}>
                              {payoutOnFile
                                 ? `Payout details on file · status: ${payoutStatus || 'not started'}`
                                 : 'No payout details submitted yet — required before payouts can begin.'}
                           </Text>
                        </View>

                        {payoutOnFile && (
                           <View style={styles.payoutOnFileBox}>
                              {!!payoutOnFile.panLast4 && (
                                 <Text style={styles.payoutOnFileTxt}>PAN on file: •••••{payoutOnFile.panLast4}</Text>
                              )}
                              {!!payoutOnFile.bankAccountLast4 && (
                                 <Text style={styles.payoutOnFileTxt}>Bank account on file: •••••{payoutOnFile.bankAccountLast4} ({payoutOnFile.ifscCode})</Text>
                              )}
                              {!!payoutOnFile.upiIdMasked && (
                                 <Text style={styles.payoutOnFileTxt}>UPI on file: {payoutOnFile.upiIdMasked}</Text>
                              )}
                           </View>
                        )}

                        <Text style={styles.label}>Legal / Business Name</Text>
                        <TextInput
                           style={[styles.input, payoutErrors.legalBusinessName && styles.inputError]}
                           value={legalBusinessName}
                           onChangeText={(v) => { setLegalBusinessName(v); clearPayoutError('legalBusinessName'); }}
                           placeholder="Name payouts should be made to"
                        />
                        {!!payoutErrors.legalBusinessName && <Text style={styles.fieldError}>{payoutErrors.legalBusinessName}</Text>}

                        <Text style={styles.label}>Business Type</Text>
                        <View style={styles.specGrid}>
                           {BUSINESS_TYPES.map(bt => (
                              <TouchableOpacity
                                 key={bt.key}
                                 style={[styles.specChip, businessType === bt.key && styles.specChipActive]}
                                 onPress={() => { setBusinessType(bt.key); clearPayoutError('businessType'); }}
                              >
                                 <Text style={[styles.specChipTxt, businessType === bt.key && styles.specChipTxtActive]}>{bt.label}</Text>
                              </TouchableOpacity>
                           ))}
                        </View>
                        {!!payoutErrors.businessType && <Text style={styles.fieldError}>{payoutErrors.businessType}</Text>}

                        <Text style={styles.label}>Contact Email (for payout communication)</Text>
                        <TextInput
                           style={[styles.input, payoutErrors.contactEmail && styles.inputError]}
                           value={contactEmail}
                           onChangeText={(v) => { setContactEmail(v); clearPayoutError('contactEmail'); }}
                           placeholder="you@example.com"
                           keyboardType="email-address"
                           autoCapitalize="none"
                        />
                        {!!payoutErrors.contactEmail && <Text style={styles.fieldError}>{payoutErrors.contactEmail}</Text>}

                        <Text style={styles.label}>PAN</Text>
                        <TextInput
                           style={[styles.input, payoutErrors.pan && styles.inputError]}
                           value={pan}
                           onChangeText={(v) => { setPan(v.toUpperCase()); clearPayoutError('pan'); }}
                           placeholder={payoutOnFile?.panLast4 ? `Re-enter PAN to change (on file: •••••${payoutOnFile.panLast4})` : 'ABCDE1234F'}
                           autoCapitalize="characters"
                           maxLength={10}
                        />
                        {!!payoutErrors.pan && <Text style={styles.fieldError}>{payoutErrors.pan}</Text>}

                        <Text style={styles.label}>Payout Method</Text>
                        <View style={styles.specGrid}>
                           <TouchableOpacity
                              style={[styles.specChip, payoutMethod === 'bank' && styles.specChipActive]}
                              onPress={() => setPayoutMethod('bank')}
                           >
                              <Text style={[styles.specChipTxt, payoutMethod === 'bank' && styles.specChipTxtActive]}>Bank Account</Text>
                           </TouchableOpacity>
                           <TouchableOpacity
                              style={[styles.specChip, payoutMethod === 'upi' && styles.specChipActive]}
                              onPress={() => setPayoutMethod('upi')}
                           >
                              <Text style={[styles.specChipTxt, payoutMethod === 'upi' && styles.specChipTxtActive]}>UPI</Text>
                           </TouchableOpacity>
                        </View>

                        {payoutMethod === 'bank' ? (
                           <>
                              <Text style={styles.label}>Bank Account Number</Text>
                              <TextInput
                                 style={[styles.input, payoutErrors.bankAccountNumber && styles.inputError]}
                                 value={bankAccountNumber}
                                 onChangeText={(v) => { setBankAccountNumber(v); clearPayoutError('bankAccountNumber'); }}
                                 placeholder={payoutOnFile?.bankAccountLast4 ? `Re-enter to change (on file: •••••${payoutOnFile.bankAccountLast4})` : 'Account number'}
                                 keyboardType="number-pad"
                              />
                              {!!payoutErrors.bankAccountNumber && <Text style={styles.fieldError}>{payoutErrors.bankAccountNumber}</Text>}

                              <Text style={styles.label}>Confirm Bank Account Number</Text>
                              <TextInput
                                 style={[styles.input, payoutErrors.confirmBankAccountNumber && styles.inputError]}
                                 value={confirmBankAccountNumber}
                                 onChangeText={(v) => { setConfirmBankAccountNumber(v); clearPayoutError('confirmBankAccountNumber'); }}
                                 placeholder="Re-type account number"
                                 keyboardType="number-pad"
                              />
                              {!!payoutErrors.confirmBankAccountNumber && <Text style={styles.fieldError}>{payoutErrors.confirmBankAccountNumber}</Text>}

                              <Text style={styles.label}>IFSC Code</Text>
                              <TextInput
                                 style={[styles.input, { borderBottomWidth: 0 }, payoutErrors.ifscCode && styles.inputError]}
                                 value={ifscCode}
                                 onChangeText={(v) => { setIfscCode(v.toUpperCase()); clearPayoutError('ifscCode'); }}
                                 placeholder="HDFC0001234"
                                 autoCapitalize="characters"
                              />
                              {!!payoutErrors.ifscCode && <Text style={styles.fieldError}>{payoutErrors.ifscCode}</Text>}
                           </>
                        ) : (
                           <>
                              <Text style={styles.label}>UPI ID</Text>
                              <TextInput
                                 style={[styles.input, { borderBottomWidth: 0 }, payoutErrors.upiId && styles.inputError]}
                                 value={upiId}
                                 onChangeText={(v) => { setUpiId(v); clearPayoutError('upiId'); }}
                                 placeholder={payoutOnFile?.upiIdMasked ? `Re-enter to change (on file: ${payoutOnFile.upiIdMasked})` : 'name@bank'}
                                 autoCapitalize="none"
                              />
                              {!!payoutErrors.upiId && <Text style={styles.fieldError}>{payoutErrors.upiId}</Text>}
                           </>
                        )}
                     </>
                  )}
               </View>

               <TouchableOpacity style={[styles.saveFullBtn, { marginTop: 14 }]} onPress={handleSavePayout} disabled={payoutSaving || payoutLoading}>
                  {payoutSaving ? (
                     <ActivityIndicator size="small" color="#fff" />
                  ) : (
                     <Text style={styles.saveFullBtnTxt}>Save Payout Details</Text>
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
   docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#eee', borderRadius: 12, padding: 12, backgroundColor: '#fafafa' },
   docIconBg: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E8F5F7', alignItems: 'center', justifyContent: 'center' },
   docLabel: { fontSize: 13.5, fontWeight: '700', color: '#1a1a1a' },
   docStatus: { fontSize: 11.5, color: '#888', marginTop: 2 },
   drawSignatureLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
   drawSignatureLinkTxt: { fontSize: 12.5, color: TEAL, fontWeight: '700' },
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
   // Payout section
   payoutStatusRow: { marginBottom: 4 },
   payoutOnFileBox: { backgroundColor: '#FAFCFC', borderRadius: 10, borderWidth: 1, borderColor: '#eee', padding: 10, marginTop: 6, marginBottom: 4 },
   payoutOnFileTxt: { fontSize: 12, color: '#555', marginBottom: 2 },
   inputError: { borderBottomColor: '#E24B4A' },
   fieldError: { fontSize: 11.5, color: '#E24B4A', marginTop: 4, fontWeight: '600' },
});
