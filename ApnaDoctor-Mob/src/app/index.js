import React, { useState } from 'react';
import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   StyleSheet,
   SafeAreaView,
   KeyboardAvoidingView,
   Platform,
   StatusBar,
   Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const TEAL = '#1A7E8A';

export default function LoginScreen() {
   const [role, setRole] = useState('doctor');
   const [phone, setPhone] = useState('');
   const router = useRouter();

   const handleNext = () => {
      if (phone.length < 10) return;
      router.push({ pathname: '/otp', params: { phone, role } });
   };

   return (
      <SafeAreaView style={styles.container}>
         <StatusBar barStyle="dark-content" backgroundColor="#f8fbfc" />
         <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inner}
         >
            {/* Top Brand Header */}
            <View style={styles.brandContainer}>
               <Image
                  source={require('../../assets/playstore-icon-512.png')}
                  style={styles.logoImg}
                  resizeMode="contain"
               />
               <Text style={styles.brandName}>ApnaDoctor</Text>
               <Text style={styles.brandTagline}>Your Trusted Health Companion</Text>
            </View>

            <View style={styles.card}>
               <Text style={styles.hello}>Welcome back</Text>
               <Text style={styles.roleLabel}>Choose your profile to sign in / sign up</Text>

               {/* Premium Role Switcher */}
               <View style={styles.roleContainer}>
                  <TouchableOpacity
                     style={[styles.roleTab, role === 'doctor' && styles.roleTabActive]}
                     onPress={() => setRole('doctor')}
                     activeOpacity={0.9}
                  >
                     <MaterialCommunityIcons
                        name="doctor"
                        size={20}
                        color={role === 'doctor' ? '#fff' : '#666'}
                     />
                     <Text style={[styles.roleTabText, role === 'doctor' && styles.roleTabTextActive]}>
                        Doctor
                     </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={[styles.roleTab, role === 'patient' && styles.roleTabActive]}
                     onPress={() => setRole('patient')}
                     activeOpacity={0.9}
                  >
                     <MaterialCommunityIcons
                        name="account"
                        size={20}
                        color={role === 'patient' ? '#fff' : '#666'}
                     />
                     <Text style={[styles.roleTabText, role === 'patient' && styles.roleTabTextActive]}>
                        Patient
                     </Text>
                  </TouchableOpacity>
               </View>

               <Text style={styles.subtitle}>Enter Mobile Number</Text>
               <Text style={styles.subtitleSub}>We will send a 4-digit verification code</Text>

               {/* Modern Rounded Phone Input */}
               <View style={styles.inputContainer}>
                  <View style={styles.phoneIconBg}>
                     <Ionicons name="phone-portrait-outline" size={18} color={TEAL} />
                  </View>
                  <Text style={styles.countryCode}>+91</Text>
                  <View style={styles.dividerLine} />
                  <TextInput
                     style={styles.input}
                     placeholder="Enter Mobile Number"
                     keyboardType="phone-pad"
                     maxLength={10}
                     value={phone}
                     onChangeText={setPhone}
                  />
               </View>

               {/* Premium Continue Button */}
               <TouchableOpacity
                  style={[styles.btn, phone.length < 10 && styles.btnDisabled]}
                  onPress={handleNext}
                  disabled={phone.length < 10}
                  activeOpacity={0.85}
               >
                  <Text style={styles.btnText}>Send OTP</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
               </TouchableOpacity>

               {/* Terms and Conditions */}
               <Text style={styles.terms}>
                  By signing up, I agree to the{' '}
                  <Text
                     style={styles.termsBold}
                     onPress={() => router.push({ pathname: '/app-terms', params: { phone, role } })}
                  >
                     Terms & Conditions
                  </Text>
                  {' '}of ApnaDoctor
               </Text>
            </View>
         </KeyboardAvoidingView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fbfc' },
   inner: { flex: 1, justifyContent: 'center', padding: 20 },
   brandContainer: { alignItems: 'center', marginBottom: 32 },
   logoImg: {
      width: 64,
      height: 64,
      borderRadius: 20,
      marginBottom: 12,
   },
   brandName: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.5 },
   brandTagline: { fontSize: 13, color: '#666', marginTop: 4, fontWeight: '500' },
   card: {
      backgroundColor: '#fff',
      borderRadius: 24,
      padding: 24,
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
   },
   hello: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
   roleLabel: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 16 },
   roleContainer: {
      flexDirection: 'row',
      backgroundColor: '#f1f5f9',
      borderRadius: 12,
      padding: 4,
      marginBottom: 24,
   },
   roleTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
   },
   roleTabActive: {
      backgroundColor: TEAL,
      elevation: 2,
      shadowColor: TEAL,
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
   },
   roleTabText: { fontSize: 14, fontWeight: '600', color: '#666' },
   roleTabTextActive: { color: '#fff' },
   subtitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
   subtitleSub: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 12 },
   inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#e2e8f0',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 6,
      marginBottom: 20,
      backgroundColor: '#f8fafc',
   },
   phoneIconBg: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#E8F5F7',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
   },
   countryCode: { fontSize: 16, fontWeight: '700', color: '#333' },
   dividerLine: { width: 1, height: 18, backgroundColor: '#cbd5e1', marginHorizontal: 12 },
   input: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333', padding: 0 },
   btn: {
      flexDirection: 'row',
      backgroundColor: TEAL,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 3,
      shadowColor: TEAL,
      shadowOpacity: 0.2,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 3 },
      marginBottom: 20,
   },
   btnDisabled: { backgroundColor: '#cbd5e1', elevation: 0, shadowOpacity: 0 },
   btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
   terms: { fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
   termsBold: { fontWeight: '700', color: '#475569' },
});
