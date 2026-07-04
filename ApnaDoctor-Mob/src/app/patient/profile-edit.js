import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
   ActivityIndicator,
   Alert,
   Image,
   ScrollView,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyPatientProfile, uploadMyPatientPhoto } from '../../services/patientProfileService';
const TEAL = '#1A7E8A';

function getInitials(name) {
   if (!name?.trim()) return '?';
   return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
}

export default function EditProfileScreen() {
   const router = useRouter();
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [gender, setGender] = useState('Male');
   const [dob, setDob] = useState('');
   const [phone, setPhone] = useState('');
   const [photoUrl, setPhotoUrl] = useState(null);
   const [saving, setSaving] = useState(false);
   const [uploadingPhoto, setUploadingPhoto] = useState(false);

   useEffect(() => {
      (async () => {
         try {
            const data = await getMyPatientProfile();
            setName(data.name || '');
            setEmail(data.email || '');
            setGender(data.gender || 'Male');
            setDob(data.dob || '');
            setPhone(data.phone || '');
            setPhotoUrl(data.photo?.url || null);
         } catch (err) {
            console.warn('Failed to load profile for editing:', err?.message);
         }
      })();
   }, []);

   const handleChangePhoto = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
         Alert.alert('Permission Needed', 'Please allow photo library access to change your profile picture.');
         return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         allowsEditing: true,
         aspect: [1, 1],
         quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const localUri = result.assets[0].uri;

      // Optimistic preview while the upload is in flight.
      setPhotoUrl(localUri);
      setUploadingPhoto(true);
      try {
         const { photo } = await uploadMyPatientPhoto(localUri);
         setPhotoUrl(photo.url);
      } catch (err) {
         Alert.alert('Upload Failed', 'Could not upload your photo. Please try again.');
         console.warn('Photo upload failed:', err?.message);
      } finally {
         setUploadingPhoto(false);
      }
   };

   const handleSave = () => {
      if (!name.trim()) {
         Alert.alert('Validation Error', 'Name cannot be empty.');
         return;
      }
      if (!email.trim() || !email.includes('@')) {
         Alert.alert('Validation Error', 'Please enter a valid email address.');
         return;
      }
      if (!dob.trim()) {
         Alert.alert('Validation Error', 'Please enter your date of birth.');
         return;
      }

      // NOTE: text-field saving is still mocked — there's no PATCH /api/patient/me
      // endpoint yet, only POST /api/patient/me/signup (which also requires
      // bloodGroup/weight context from the signup flow). Wire this up to that
      // endpoint once a proper "edit profile" endpoint exists. Photo saving
      // above is already fully wired to the real API.
      setSaving(true);
      setTimeout(() => {
         setSaving(false);
         Alert.alert('Success', 'Profile updated successfully!', [
            { text: 'OK', onPress: () => router.back() }
         ]);
      }, 1000);
   };

   return (
      <SafeAreaView style={styles.safe}>
         <StatusBar barStyle={'dark-content'} backgroundColor={"#fff"} />
         {/* Top bar */}
         <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.barTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
         </View>

         <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Photo */}
            <View style={styles.avatarContainer}>
               <View style={styles.avatar}>
                  {photoUrl ? (
                     <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
                  ) : (
                     <Text style={styles.avatarTxt}>{getInitials(name)}</Text>
                  )}
                  {uploadingPhoto && (
                     <View style={styles.avatarOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                     </View>
                  )}
               </View>
               <TouchableOpacity
                  style={styles.changePicBtn}
                  onPress={handleChangePhoto}
                  disabled={uploadingPhoto}
               >
                  <Ionicons name="camera" size={16} color="#fff" />
               </TouchableOpacity>
            </View>

            {/* Form */}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
               style={styles.input}
               value={name}
               onChangeText={setName}
               placeholder="Enter full name"
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
               style={styles.input}
               value={email}
               onChangeText={setEmail}
               placeholder="Enter email address"
               keyboardType="email-address"
               autoCapitalize="none"
            />

            <Text style={styles.label}>Phone Number (Registered)</Text>
            <View style={[styles.input, styles.inputDisabled]}>
               <Text style={styles.disabledTxt}>{phone || '—'}</Text>
               <Ionicons name="lock-closed" size={16} color="#aaa" />
            </View>

            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
               {['Male', 'Female', 'Other'].map(g => {
                  const isSel = gender === g;
                  return (
                     <TouchableOpacity
                        key={g}
                        style={[styles.genderBox, isSel && styles.genderBoxActive]}
                        onPress={() => setGender(g)}
                     >
                        <Text style={[styles.genderTxt, isSel && styles.genderTxtActive]}>{g}</Text>
                     </TouchableOpacity>
                  );
               })}
            </View>

            <Text style={styles.label}>Date of Birth (DD-MM-YYYY)</Text>
            <TextInput
               style={styles.input}
               value={dob}
               onChangeText={setDob}
               placeholder="DD-MM-YYYY"
            />

            <TouchableOpacity 
               style={styles.saveBtn} 
               onPress={handleSave}
               disabled={saving}
            >
               {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
               ) : (
                  <Text style={styles.saveTxt}>Save Changes</Text>
               )}
            </TouchableOpacity>

         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   safe: { flex: 1, backgroundColor: '#f8fbfc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
   backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
   barTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
   scroll: { padding: 20 },
   avatarContainer: { alignItems: 'center', marginVertical: 16 },
   avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#378ADD', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
   avatarImg: { width: 90, height: 90, borderRadius: 45 },
   avatarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', borderRadius: 45 },
   avatarTxt: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
   changePicBtn: { position: 'absolute', bottom: 0, right: '36%', backgroundColor: TEAL, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
   label: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 16, marginBottom: 8 },
   input: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#333', backgroundColor: '#fff' },
   inputDisabled: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f2f5', borderColor: '#e4e6eb' },
   disabledTxt: { color: '#777', fontSize: 14 },
   genderRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
   genderBox: { flex: 1, paddingVertical: 12, borderWidth: 1.5, borderColor: '#eee', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
   genderBoxActive: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   genderTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
   genderTxtActive: { color: TEAL },
   saveBtn: { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
   saveTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
