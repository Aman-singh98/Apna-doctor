import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
   Alert,
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
import * as DocumentPicker from 'expo-document-picker';
import { submitDoctorSignup, submitPayoutKyc } from '../utils/doctorAuth';
import {
   DOCTOR_CATEGORIES,
   SPECIALIZATIONS_BY_CATEGORY,
   getFeesForCategory,
} from '../constants/doctorFees';
import { BUSINESS_TYPES, validatePayoutKyc } from '../utils/payoutValidators';
import SignaturePadModal from '../components/SignaturePadModal';
import { dataUrlToFileUri } from '../utils/imageUtils';

// ── Design tokens ───────────────────────────────────────────────────────
// Deep-ink teal header + soft mint surfaces, with a warm gold accent
// reserved for "verified / trust" cues (matches the clinical-credibility
// feel this form needs — a doctor submitting license & payout KYC).
const TEAL = '#1A7E8A';
const TEAL_DARK = '#0E4C54';
const TEAL_TINT = '#E8F5F7';
const GOLD = '#B8873A';
const GOLD_TINT = '#FBF3E4';
const INK = '#173238';
const MUTED = '#7C8E90';
const BG = '#F3F8F8';

const DOCUMENT_SLOTS = [
   { key: 'medicalLicense', label: 'Medical License / Registration Certificate (PDF only)', icon: 'card-account-details-outline' },
   { key: 'idProof', label: 'Government ID Proof (Aadhaar / Passport / PAN) (PDF only)', icon: 'card-text-outline' },
];

// Purely visual — a lightweight sense of progress through the four stages
// of this form. Derived from existing state, never gates submission (the
// real validation still happens in handleSubmit).
const PROGRESS_STAGES = [
   { key: 'profile', label: 'Profile', icon: 'person-outline' },
   { key: 'category', label: 'Category', icon: 'medical-outline' },
   { key: 'documents', label: 'Documents', icon: 'document-text-outline' },
   { key: 'payout', label: 'Payout', icon: 'card-outline' },
];

// Signature is kept separate from the required verification docs above —
// it's collected here for convenience but isn't a blocker for submission.
const SIGNATURE_SLOT = {
   key: 'signature',
   label: 'Signature (shown on prescriptions) (PDF only)',
   icon: 'draw-pen',
};

export default function DoctorSignupScreen() {
   const router = useRouter();
   const { phone } = useLocalSearchParams();

   const [name, setName] = useState('');
   const [qualification, setQualification] = useState('');
   const [regNumber, setRegNumber] = useState('');
   const [hospital, setHospital] = useState('');
   const [experience, setExperience] = useState('');
   const [selectedCategory, setSelectedCategory] = useState('');
   const [selectedSpec, setSelectedSpec] = useState('');
   // documents: { medicalLicense: {...}, idProof: {...}, signature: {...} | null }
   const [documents, setDocuments] = useState({});
   const [submitting, setSubmitting] = useState(false);
   const [signaturePadVisible, setSignaturePadVisible] = useState(false);

   // ── Payout details (Phase 3, task 19) ──────────────────────────────────
   // Collected here so the backend can create the doctor's Razorpay Route
   // linked account once an admin approves them (see Phase 3, tasks 17-18).
   // Submitted separately from the rest of signup via submitPayoutKyc() —
   // see handleSubmit below.
   const [legalBusinessName, setLegalBusinessName] = useState('');
   const [businessType, setBusinessType] = useState('individual');
   const [contactEmail, setContactEmail] = useState('');
   const [pan, setPan] = useState('');
   const [payoutMethod, setPayoutMethod] = useState('bank'); // 'bank' | 'upi'
   const [bankAccountNumber, setBankAccountNumber] = useState('');
   const [confirmBankAccountNumber, setConfirmBankAccountNumber] = useState('');
   const [ifscCode, setIfscCode] = useState('');
   const [upiId, setUpiId] = useState('');
   const [payoutErrors, setPayoutErrors] = useState({});
   const [showBankAccount, setShowBankAccount] = useState(false);
   const [showConfirmBankAccount, setShowConfirmBankAccount] = useState(false);

   // Clears a single field's error as soon as the user starts fixing it,
   // rather than making them wait for the next full-form validation pass.
   const clearPayoutError = (field) => {
      setPayoutErrors(prev => {
         if (!prev[field]) return prev;
         const next = { ...prev };
         delete next[field];
         return next;
      });
   };

   const availableSpecs = selectedCategory ? SPECIALIZATIONS_BY_CATEGORY[selectedCategory] : [];
   const previewFees = selectedCategory ? getFeesForCategory(selectedCategory) : null;

   // Visual-only completion flags for the progress bar — see PROGRESS_STAGES.
   const stageComplete = {
      profile: Boolean(name.trim() && qualification.trim() && regNumber.trim()),
      category: Boolean(selectedCategory && selectedSpec),
      documents: Boolean(documents.medicalLicense && documents.idProof),
      payout: Boolean(
         legalBusinessName.trim() && contactEmail.trim() && pan.trim() &&
         (payoutMethod === 'bank' ? bankAccountNumber.trim() && ifscCode.trim() : upiId.trim())
      ),
   };
   const completedCount = Object.values(stageComplete).filter(Boolean).length;

   const handleSelectCategory = (catKey) => {
      setSelectedCategory(catKey);
      // reset specialization since the options depend on the category
      setSelectedSpec('');
   };

   const handlePickDocument = async (slotKey) => {
      try {
         const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf'],
            copyToCacheDirectory: true,
         });

         // Expo SDK 49+: result.canceled instead of result.type === 'cancel'
         if (result.canceled) return;

         const file = result.assets[0];
         setDocuments(prev => ({
            ...prev,
            [slotKey]: { uri: file.uri, name: file.name, type: 'application/pdf' },
         }));
      } catch {
         Alert.alert('Error', 'Could not pick document. Please try again.');
      }
   };

   const handleDrawnSignatureSave = async (dataUrl) => {
      setSignaturePadVisible(false);
      try {
         const fileUri = await dataUrlToFileUri(dataUrl);
         setDocuments(prev => ({
            ...prev,
            [SIGNATURE_SLOT.key]: { uri: fileUri, name: 'signature.png', type: 'image/png' },
         }));
      } catch (err) {
         console.log('Signature save error:', err);
         Alert.alert('Error', 'Could not save your drawn signature. Please try again.');
      }
   };

   const removeDocument = (slotKey) => {
      setDocuments(prev => {
         const next = { ...prev };
         delete next[slotKey];
         return next;
      });
   };

   const handleSubmit = async () => {
      if (!name.trim() || !qualification.trim() || !regNumber.trim()) {
         Alert.alert('Missing Information', 'Please fill in your name, qualification, and registration number.');
         return;
      }
      if (!selectedCategory) {
         Alert.alert('Category Required', 'Please select your doctor category (General Physician / Specialist / Super Specialist).');
         return;
      }
      if (!selectedSpec) {
         Alert.alert('Specialization Required', 'Please select your specialization.');
         return;
      }
      const missingDocs = DOCUMENT_SLOTS.filter(slot => !documents[slot.key]);
      if (missingDocs.length > 0) {
         Alert.alert('Documents Required', 'Please upload both your medical license and ID proof before submitting.');
         return;
      }

      const kycErrors = validatePayoutKyc({
         pan,
         legalBusinessName,
         businessType,
         contactEmail,
         payoutMethod,
         bankAccountNumber,
         confirmBankAccountNumber,
         ifscCode,
         upiId,
      });
      setPayoutErrors(kycErrors);
      if (Object.keys(kycErrors).length > 0) {
         Alert.alert('Payout Details Needed', 'Please fix the highlighted payout fields — these are how we pay out your consultation earnings.');
         return;
      }

      setSubmitting(true);
      console.log({
         name,
         qualification,
         regNumber,
         hospital,
         experience,
         category: selectedCategory,       // 'gp' | 'specialist' | 'super_specialist'
         specialization: selectedSpec,
         documents,                        // includes optional `signature` if provided
      });
      try {
         await submitDoctorSignup({
            name,
            qualification,
            regNumber,
            hospital,
            experience,
            category: selectedCategory,       // 'gp' | 'specialist' | 'super_specialist'
            specialization: selectedSpec,
            documents,                        // includes optional `signature` if provided
         });

         // Payout KYC is submitted as a second, independent call (separate
         // JSON endpoint — see utils/doctorAuth.js). A failure here must
         // NOT block the signup itself from going through: the doctor's
         // profile review can proceed either way, and payout account
         // creation on the backend (Phase 3, tasks 17-18) is already
         // designed to be retried later by an admin. We just warn the
         // doctor so they know to follow up.
         try {
            await submitPayoutKyc({
               pan,
               legalBusinessName,
               businessType,
               contactEmail,
               bankAccountNumber: payoutMethod === 'bank' ? bankAccountNumber : undefined,
               confirmBankAccountNumber: payoutMethod === 'bank' ? confirmBankAccountNumber : undefined,
               ifscCode: payoutMethod === 'bank' ? ifscCode : undefined,
               upiId: payoutMethod === 'upi' ? upiId : undefined,
            });
         } catch (kycErr) {
            const kycMsg = kycErr.response?.data?.message || 'Could not save your payout details.';
            Alert.alert(
               'Profile Submitted',
               `${kycMsg} Your profile is still under review — please contact support to add your payout details before you start accepting paid consultations.`
            );
            router.replace('/doctor-pending');
            return;
         }

         router.replace('/doctor-pending');
      } catch (err) {
         const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
         Alert.alert('Submission Failed', msg);
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle="light-content" backgroundColor={TEAL_DARK} />
         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.topBar}>
               <View style={styles.topBarRow}>
                  <View style={styles.logoIcon}>
                     <MaterialCommunityIcons name="doctor" size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.barTitle}>Doctor Signup</Text>
                     <Text style={styles.barSub}>One-time profile setup for admin verification</Text>
                  </View>
               </View>

               <View style={styles.progressTrack}>
                  {PROGRESS_STAGES.map((stage, i) => {
                     const done = stageComplete[stage.key];
                     return (
                        <View key={stage.key} style={styles.progressStageWrap}>
                           <View style={styles.progressStage}>
                              <View style={[styles.progressDot, done && styles.progressDotDone]}>
                                 <Ionicons name={done ? 'checkmark' : stage.icon} size={done ? 13 : 12} color={done ? TEAL_DARK : 'rgba(255,255,255,0.85)'} />
                              </View>
                              <Text style={[styles.progressLabel, done && styles.progressLabelDone]} numberOfLines={1} allowFontScaling={false}>{stage.label}</Text>
                           </View>
                           {i < PROGRESS_STAGES.length - 1 && (
                              <View style={[styles.progressLine, done && styles.progressLineDone]} />
                           )}
                        </View>
                     );
                  })}
               </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
               <View style={styles.groupLabelRow}>
                  <View style={[styles.groupIconBadge, { backgroundColor: TEAL_TINT }]}>
                     <Ionicons name="person-outline" size={13} color={TEAL} />
                  </View>
                  <Text style={styles.groupLabel}>Personal Information</Text>
               </View>
               <View style={styles.groupBg}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Dr. Full Name" placeholderTextColor="#bbb" />
                  <Text style={styles.label}>Qualification *</Text>
                  <TextInput style={styles.input} value={qualification} onChangeText={setQualification} placeholder="e.g. MBBS, MD (Cardiology)" placeholderTextColor="#bbb" />
                  <Text style={styles.label}>Medical Registration Number *</Text>
                  <TextInput style={styles.input} value={regNumber} onChangeText={setRegNumber} placeholder="e.g. DL-2014-4587" placeholderTextColor="#bbb" />
                  <Text style={styles.label}>Years of Experience</Text>
                  <TextInput style={[styles.input, { borderBottomWidth: 0 }]} value={experience} onChangeText={setExperience} keyboardType="numeric" placeholder="e.g. 12" placeholderTextColor="#bbb" />
               </View>

               {/* Doctor Category — drives specialization list + fixed fees */}
               <View style={styles.groupLabelRow}>
                  <View style={[styles.groupIconBadge, { backgroundColor: TEAL_TINT }]}>
                     <Ionicons name="medical-outline" size={13} color={TEAL} />
                  </View>
                  <Text style={styles.groupLabel}>Doctor Category *</Text>
               </View>
               <View style={styles.groupBg}>
                  <Text style={styles.docNote}>
                     Your category decides your fixed consultation fees. This can't be changed later without admin approval.
                  </Text>
                  {DOCTOR_CATEGORIES.map(cat => {
                     const active = selectedCategory === cat.key;
                     return (
                        <TouchableOpacity
                           key={cat.key}
                           style={[styles.categoryCard, active && styles.categoryCardActive]}
                           onPress={() => handleSelectCategory(cat.key)}
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

               {/* Specialization — filtered by chosen category */}
               <View style={styles.groupLabelRow}>
                  <View style={[styles.groupIconBadge, { backgroundColor: TEAL_TINT }]}>
                     <Ionicons name="apps-outline" size={13} color={TEAL} />
                  </View>
                  <Text style={styles.groupLabel}>Specialization *</Text>
               </View>
               <View style={styles.groupBg}>
                  {!selectedCategory ? (
                     <Text style={styles.docNote}>Select a doctor category above to see specialization options.</Text>
                  ) : (
                     <View style={styles.specGrid}>
                        {availableSpecs.map(s => (
                           <TouchableOpacity key={s} style={[styles.specChip, selectedSpec === s && styles.specChipActive]} onPress={() => setSelectedSpec(s)}>
                              <Text style={[styles.specChipTxt, selectedSpec === s && styles.specChipTxtActive]}>{s}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  )}
               </View>

               {/* Consultation fees preview — read-only, auto-set by category */}
               {previewFees && (
                  <>
                     <View style={styles.groupLabelRow}>
                        <View style={[styles.groupIconBadge, { backgroundColor: GOLD_TINT }]}>
                           <Ionicons name="cash-outline" size={13} color={GOLD} />
                        </View>
                        <Text style={styles.groupLabel}>Your Consultation Fees</Text>
                     </View>
                     <View style={styles.groupBg}>
                        <Text style={styles.docNote}>
                           Fixed automatically based on your category. Contact support if you need this changed.
                        </Text>
                        <View style={styles.feePreviewRow}>
                           <View style={styles.feePreviewItem}>
                              <Ionicons name="videocam-outline" size={16} color={TEAL} />
                              <Text style={styles.feePreviewLabel}>Video</Text>
                              <Text style={styles.feePreviewValue}>₹{previewFees.video}</Text>
                           </View>
                           <View style={styles.feePreviewItem}>
                              <Ionicons name="call-outline" size={16} color={TEAL} />
                              <Text style={styles.feePreviewLabel}>Audio</Text>
                              <Text style={styles.feePreviewValue}>₹{previewFees.audio}</Text>
                           </View>
                           <View style={styles.feePreviewItem}>
                              <Ionicons name="chatbubbles-outline" size={16} color={TEAL} />
                              <Text style={styles.feePreviewLabel}>Chat</Text>
                              <Text style={styles.feePreviewValue}>₹{previewFees.chat}</Text>
                           </View>
                        </View>
                     </View>
                  </>
               )}

               <View style={styles.groupLabelRow}>
                  <View style={[styles.groupIconBadge, { backgroundColor: TEAL_TINT }]}>
                     <Ionicons name="business-outline" size={13} color={TEAL} />
                  </View>
                  <Text style={styles.groupLabel}>Practice Information</Text>
               </View>
               <View style={styles.groupBg}>
                  <Text style={styles.label}>Hospital / Clinic Name</Text>
                  <TextInput style={[styles.input, { borderBottomWidth: 0 }]} value={hospital} onChangeText={setHospital} placeholder="Hospital or clinic name" placeholderTextColor="#bbb" />
               </View>

               {/* Payout details — used to create your Razorpay payout account once approved */}
               <View style={styles.groupLabelRow}>
                  <View style={[styles.groupIconBadge, { backgroundColor: GOLD_TINT }]}>
                     <Ionicons name="card-outline" size={13} color={GOLD} />
                  </View>
                  <Text style={styles.groupLabel}>Payout Details *</Text>
               </View>
               <View style={styles.groupBg}>
                  <Text style={styles.docNote}>
                     We use these details to pay out your share of consultation fees. They're encrypted and never shown to patients.
                  </Text>

                  <Text style={styles.label}>Payee / Business Name *</Text>
                  <TextInput
                     style={[styles.input, payoutErrors.legalBusinessName && styles.inputError]}
                     value={legalBusinessName}
                     onChangeText={t => { setLegalBusinessName(t); clearPayoutError('legalBusinessName'); }}
                     placeholder="e.g. Dr. Jane Doe"
                     placeholderTextColor="#bbb"
                  />
                  {payoutErrors.legalBusinessName && <Text style={styles.fieldError}>{payoutErrors.legalBusinessName}</Text>}

                  <Text style={styles.label}>Business Type *</Text>
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
                  {payoutErrors.businessType && <Text style={styles.fieldError}>{payoutErrors.businessType}</Text>}

                  <Text style={styles.label}>Contact Email (for payout communication) *</Text>
                  <TextInput
                     style={[styles.input, payoutErrors.contactEmail && styles.inputError]}
                     value={contactEmail}
                     onChangeText={t => { setContactEmail(t); clearPayoutError('contactEmail'); }}
                     placeholder="you@example.com"
                     placeholderTextColor="#bbb"
                     keyboardType="email-address"
                     autoCapitalize="none"
                  />
                  {payoutErrors.contactEmail && <Text style={styles.fieldError}>{payoutErrors.contactEmail}</Text>}

                  <Text style={styles.label}>PAN *</Text>
                  <TextInput
                     style={[styles.input, payoutErrors.pan && styles.inputError]}
                     value={pan}
                     onChangeText={t => { setPan(t.toUpperCase().replace(/\s/g, '')); clearPayoutError('pan'); }}
                     placeholder="ABCDE1234F"
                     placeholderTextColor="#bbb"
                     autoCapitalize="characters"
                     maxLength={10}
                  />
                  {payoutErrors.pan && <Text style={styles.fieldError}>{payoutErrors.pan}</Text>}

                  <Text style={[styles.label, { marginTop: 14 }]}>Payout Method *</Text>
                  <View style={styles.specGrid}>
                     <TouchableOpacity
                        style={[styles.specChip, payoutMethod === 'bank' && styles.specChipActive]}
                        onPress={() => { setPayoutMethod('bank'); setPayoutErrors({}); }}
                     >
                        <Text style={[styles.specChipTxt, payoutMethod === 'bank' && styles.specChipTxtActive]}>Bank Account</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.specChip, payoutMethod === 'upi' && styles.specChipActive]}
                        onPress={() => { setPayoutMethod('upi'); setPayoutErrors({}); }}
                     >
                        <Text style={[styles.specChipTxt, payoutMethod === 'upi' && styles.specChipTxtActive]}>UPI ID</Text>
                     </TouchableOpacity>
                  </View>

                  {payoutMethod === 'bank' ? (
                     <>
                        <Text style={styles.label}>Bank Account Number *</Text>
                        <View style={styles.inputWithIconWrap}>
                           <TextInput
                              style={[styles.input, styles.inputWithIcon, payoutErrors.bankAccountNumber && styles.inputError]}
                              value={bankAccountNumber}
                              onChangeText={t => { setBankAccountNumber(t.replace(/\D/g, '')); clearPayoutError('bankAccountNumber'); }}
                              placeholder="9-18 digit account number"
                              placeholderTextColor="#bbb"
                              keyboardType="number-pad"
                              secureTextEntry={!showBankAccount}
                           />
                           <TouchableOpacity
                              style={styles.inputIconBtn}
                              onPress={() => setShowBankAccount(prev => !prev)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                           >
                              <Ionicons name={showBankAccount ? 'eye-off-outline' : 'eye-outline'} size={19} color={MUTED} />
                           </TouchableOpacity>
                        </View>
                        {payoutErrors.bankAccountNumber && <Text style={styles.fieldError}>{payoutErrors.bankAccountNumber}</Text>}

                        <Text style={styles.label}>Confirm Account Number *</Text>
                        <View style={styles.inputWithIconWrap}>
                           <TextInput
                              style={[styles.input, styles.inputWithIcon, payoutErrors.confirmBankAccountNumber && styles.inputError]}
                              value={confirmBankAccountNumber}
                              onChangeText={t => { setConfirmBankAccountNumber(t.replace(/\D/g, '')); clearPayoutError('confirmBankAccountNumber'); }}
                              placeholder="Re-enter account number"
                              placeholderTextColor="#bbb"
                              keyboardType="number-pad"
                              secureTextEntry={!showConfirmBankAccount}
                           />
                           <TouchableOpacity
                              style={styles.inputIconBtn}
                              onPress={() => setShowConfirmBankAccount(prev => !prev)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                           >
                              <Ionicons name={showConfirmBankAccount ? 'eye-off-outline' : 'eye-outline'} size={19} color={MUTED} />
                           </TouchableOpacity>
                        </View>
                        {payoutErrors.confirmBankAccountNumber && <Text style={styles.fieldError}>{payoutErrors.confirmBankAccountNumber}</Text>}

                        <Text style={styles.label}>IFSC Code *</Text>
                        <TextInput
                           style={[styles.input, { borderBottomWidth: 0 }, payoutErrors.ifscCode && styles.inputError]}
                           value={ifscCode}
                           onChangeText={t => { setIfscCode(t.toUpperCase().replace(/\s/g, '')); clearPayoutError('ifscCode'); }}
                           placeholder="e.g. HDFC0001234"
                           placeholderTextColor="#bbb"
                           autoCapitalize="characters"
                           maxLength={11}
                        />
                        {payoutErrors.ifscCode && <Text style={styles.fieldError}>{payoutErrors.ifscCode}</Text>}
                     </>
                  ) : (
                     <>
                        <Text style={styles.label}>UPI ID *</Text>
                        <TextInput
                           style={[styles.input, { borderBottomWidth: 0 }, payoutErrors.upiId && styles.inputError]}
                           value={upiId}
                           onChangeText={t => { setUpiId(t); clearPayoutError('upiId'); }}
                           placeholder="yourname@bank"
                           placeholderTextColor="#bbb"
                           autoCapitalize="none"
                        />
                        {payoutErrors.upiId && <Text style={styles.fieldError}>{payoutErrors.upiId}</Text>}
                     </>
                  )}
               </View>

               <View style={styles.groupLabelRow}>
                  <View style={[styles.groupIconBadge, { backgroundColor: TEAL_TINT }]}>
                     <Ionicons name="document-text-outline" size={13} color={TEAL} />
                  </View>
                  <Text style={styles.groupLabel}>Verification Documents *</Text>
               </View>
               <View style={styles.groupBg}>
                  <Text style={styles.docNote}>Upload clear scans. PDF format only (max 5MB each).</Text>
                  {DOCUMENT_SLOTS.map(slot => {
                     const file = documents[slot.key];
                     return (
                        <TouchableOpacity
                           key={slot.key}
                           style={[styles.docCard, file && styles.docCardUploaded]}
                           onPress={() => !file && handlePickDocument(slot.key)}
                           activeOpacity={0.85}
                        >
                           <View style={[styles.docIconBg, file && styles.docIconBgUploaded]}>
                              <MaterialCommunityIcons name={file ? 'check-circle' : slot.icon} size={20} color={file ? '#1D9E75' : TEAL} />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.docLabel}>{slot.label}</Text>
                              <Text style={styles.docStatus} numberOfLines={1}>
                                 {file ? file.name : 'Tap to upload'}
                              </Text>
                           </View>
                           {file ? (
                              <TouchableOpacity onPress={() => removeDocument(slot.key)} style={styles.docRemoveBtn}>
                                 <Ionicons name="close-circle" size={20} color="#E24B4A" />
                              </TouchableOpacity>
                           ) : (
                              <Ionicons name="cloud-upload-outline" size={20} color="#aaa" />
                           )}
                        </TouchableOpacity>
                     );
                  })}
               </View>

               {/* Signature — optional at signup, can also be added later from profile */}
               <View style={styles.groupLabelRow}>
                  <View style={[styles.groupIconBadge, { backgroundColor: '#F0F0F0' }]}>
                     <Ionicons name="create-outline" size={13} color={MUTED} />
                  </View>
                  <Text style={styles.groupLabel}>Signature (Optional)</Text>
               </View>
               <View style={styles.groupBg}>
                  <Text style={styles.docNote}>
                     Used on prescriptions you issue to patients. You can also add this later from your profile.
                  </Text>
                  {(() => {
                     const file = documents[SIGNATURE_SLOT.key];
                     return (
                        <TouchableOpacity
                           style={[styles.docCard, file && styles.docCardUploaded, { marginBottom: file ? 0 : 10 }]}
                           onPress={() => !file && handlePickDocument(SIGNATURE_SLOT.key)}
                           activeOpacity={0.85}
                        >
                           <View style={[styles.docIconBg, file && styles.docIconBgUploaded]}>
                              <MaterialCommunityIcons name={file ? 'check-circle' : SIGNATURE_SLOT.icon} size={20} color={file ? '#1D9E75' : TEAL} />
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.docLabel}>{SIGNATURE_SLOT.label}</Text>
                              <Text style={styles.docStatus} numberOfLines={1}>
                                 {file ? file.name : 'Upload your signature (PDF only)'}
                              </Text>
                           </View>
                           {file ? (
                              <TouchableOpacity onPress={() => removeDocument(SIGNATURE_SLOT.key)} style={styles.docRemoveBtn}>
                                 <Ionicons name="close-circle" size={20} color="#E24B4A" />
                              </TouchableOpacity>
                           ) : (
                              <Ionicons name="cloud-upload-outline" size={20} color="#aaa" />
                           )}
                        </TouchableOpacity>
                     );
                  })()}
                  {!documents[SIGNATURE_SLOT.key] && (
                     <TouchableOpacity style={styles.drawSignatureLink} onPress={() => setSignaturePadVisible(true)} activeOpacity={0.7}>
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

               <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                  <Text style={styles.submitBtnTxt}>{submitting ? 'Uploading & Submitting...' : 'Submit for Review'}</Text>
                  {!submitting && <Ionicons name="arrow-forward" size={17} color="#fff" style={{ marginLeft: 8 }} />}
               </TouchableOpacity>
               <View style={styles.footerNoteRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={MUTED} />
                  <Text style={styles.footerNote}>Your documents are uploaded securely and reviewed by the ApnaDoctor admin team.</Text>
               </View>
            </ScrollView>
         </KeyboardAvoidingView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: BG },

   // ── Header ──────────────────────────────────────────────────────────
   topBar: { backgroundColor: TEAL_DARK, paddingTop: 18, paddingBottom: 16, paddingHorizontal: 18, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
   topBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
   logoIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
   barTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
   barSub: { fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 2 },

   // Progress track
   progressTrack: { flexDirection: 'row', alignItems: 'flex-start' },
   progressStageWrap: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, last: {} },
   progressStage: { alignItems: 'center', width: 62 },
   progressDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
   progressDotDone: { backgroundColor: GOLD, borderColor: GOLD },
   progressLabel: { fontSize: 8.5, color: 'rgba(255,255,255,0.6)', marginTop: 5, fontWeight: '600', letterSpacing: 0 },
   progressLabelDone: { color: '#fff' },
   progressLine: { flex: 1, height: 1.5, backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 13, marginHorizontal: -2 },
   progressLineDone: { backgroundColor: GOLD },

   // ── Layout ──────────────────────────────────────────────────────────
   scroll: { padding: 16, paddingBottom: 44 },
   groupLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 9, marginLeft: 2 },
   groupIconBadge: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
   groupLabel: { fontSize: 12, fontWeight: '800', color: INK, textTransform: 'uppercase', letterSpacing: 0.6 },
   groupBg: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EAF1F1', elevation: 2, shadowColor: TEAL_DARK, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },

   // ── Inputs ──────────────────────────────────────────────────────────
   label: { fontSize: 11.5, fontWeight: '700', color: MUTED, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
   input: { fontSize: 14.5, color: INK, paddingVertical: 11, paddingHorizontal: 13, backgroundColor: '#FAFCFC', borderRadius: 11, borderWidth: 1.3, borderColor: '#E7EEEE' },
   inputError: { borderColor: '#E24B4A', backgroundColor: '#FEF6F6' },
   fieldError: { fontSize: 11.5, color: '#E24B4A', marginTop: 5, fontWeight: '600' },
   inputWithIconWrap: { position: 'relative', justifyContent: 'center' },
   inputWithIcon: { paddingRight: 42 },
   inputIconBtn: { position: 'absolute', right: 12, height: '100%', alignItems: 'center', justifyContent: 'center' },

   // ── Chips ───────────────────────────────────────────────────────────
   specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
   specChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1.5, borderColor: '#E7EEEE', backgroundColor: '#FAFCFC' },
   specChipActive: { borderColor: TEAL, backgroundColor: TEAL_TINT },
   specChipTxt: { fontSize: 13, color: '#4B6062', fontWeight: '600' },
   specChipTxtActive: { color: TEAL_DARK, fontWeight: '800' },

   // ── Documents ───────────────────────────────────────────────────────
   docNote: { fontSize: 12.5, color: MUTED, lineHeight: 18, marginBottom: 14 },
   docCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1.5, borderColor: '#EAF1F1', borderRadius: 14, padding: 13, marginBottom: 10, backgroundColor: '#FAFCFC' },
   docCardUploaded: { borderColor: '#BFE8DA', backgroundColor: '#F3FBF8' },
   docIconBg: { width: 40, height: 40, borderRadius: 13, backgroundColor: TEAL_TINT, alignItems: 'center', justifyContent: 'center' },
   docIconBgUploaded: { backgroundColor: '#DCF3EA' },
   docLabel: { fontSize: 13.5, fontWeight: '700', color: INK },
   docStatus: { fontSize: 11.5, color: MUTED, marginTop: 2 },
   docRemoveBtn: { padding: 4 },
   drawSignatureLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
   drawSignatureLinkTxt: { fontSize: 12.5, color: TEAL_DARK, fontWeight: '700' },

   // ── Category selection ─────────────────────────────────────────────
   categoryCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1.5, borderColor: '#EAF1F1', borderRadius: 14, padding: 15, marginBottom: 10, backgroundColor: '#FAFCFC' },
   categoryCardActive: { borderColor: TEAL, backgroundColor: TEAL_TINT },
   categoryTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
   categoryTitleActive: { color: TEAL_DARK },
   categoryFeesTxt: { fontSize: 12, color: MUTED, marginTop: 4, fontWeight: '500' },
   radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD8D8', alignItems: 'center', justifyContent: 'center' },
   radioOuterActive: { borderColor: TEAL },
   radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: TEAL },

   // ── Fee preview ─────────────────────────────────────────────────────
   feePreviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 9 },
   feePreviewItem: { flex: 1, alignItems: 'center', backgroundColor: GOLD_TINT, borderRadius: 13, paddingVertical: 14, gap: 5, borderWidth: 1, borderColor: '#F0E1C4' },
   feePreviewLabel: { fontSize: 10.5, color: '#8A6A2C', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
   feePreviewValue: { fontSize: 16, color: GOLD, fontWeight: '800' },

   // ── Submit ──────────────────────────────────────────────────────────
   submitBtn: { flexDirection: 'row', backgroundColor: TEAL, borderRadius: 15, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', marginTop: 26, elevation: 3, shadowColor: TEAL_DARK, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
   submitBtnDisabled: { opacity: 0.65 },
   submitBtnTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
   footerNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 14, paddingHorizontal: 10 },
   footerNote: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 17 },
});
