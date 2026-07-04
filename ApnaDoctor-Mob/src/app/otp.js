import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
   Alert,
   Image,
   StatusBar,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
   KeyboardAvoidingView,
   Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendOtp, verifyOtp } from '../utils/doctorAuth';
import { sendOtp as sendPatientOtp, verifyOtp as verifyPatientOtp } from '../services/patientAuthService';

const TEAL = '#1A7E8A';

export default function OTPScreen() {
   const router = useRouter();
   const { phone, role } = useLocalSearchParams();

   const [otp, setOtp] = useState(['', '', '', '']);
   const [error, setError] = useState('');
   const [timer, setTimer] = useState(30);
   const [canResend, setCanResend] = useState(false);
   const [focusedIndex, setFocusedIndex] = useState(0);
   const [loading, setLoading] = useState(false);
   const inputs = useRef([]);

   useEffect(() => {
      if (timer === 0) { setCanResend(true); return; }
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
   }, [timer]);

   const handleChange = (val, idx) => {
      if (!/^\d*$/.test(val)) return;
      const next = [...otp];
      next[idx] = val;
      setOtp(next);
      setError('');
      if (val && idx < 3) {
         inputs.current[idx + 1].focus();
         setFocusedIndex(idx + 1);
      }
   };

   const handleBackspace = (e, idx) => {
      if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
         inputs.current[idx - 1].focus();
         setFocusedIndex(idx - 1);
      }
   };

   const handleVerify = async () => {
      const enteredOtp = otp.join('');
      if (enteredOtp.length < 4) {
         setError('Please enter 4-digit OTP');
         return;
      }

      setLoading(true);
      setError('');

      try {
         if (role === 'patient') {
            // verifyOtp calls POST /patient/auth/verify-otp and saves token locally.
            // Patients skip admin approval entirely: once terms are accepted and
            // the profile form is filled in, they go straight to their dashboard.
            const patient = await verifyPatientOtp(phone, enteredOtp);

            if (!patient.hasAcceptedTerms) {
               router.replace({ pathname: '/patient-terms', params: { phone } });
               return;
            }

            if (!patient.hasCompletedProfile) {
               router.replace({ pathname: '/patient-signup', params: { phone } });
               return;
            }

            router.replace('/patient/dashboard');
            return;
         }

         // verifyOtp calls POST /doctor/auth/verify-otp and saves token locally.
         // Returns { hasAcceptedTerms, approvalStatus } directly from the server
         // so we don't need a second API call to decide which screen to show.
         const doctor = await verifyOtp(phone, enteredOtp);

         if (!doctor.hasAcceptedTerms) {
            router.replace({ pathname: '/doctor-terms', params: { phone } });
            return;
         }

         if (doctor.approvalStatus === 'approved') {
            router.replace('/doctor/dashboard');
         } else if (doctor.approvalStatus === 'not_started') {
            // Terms accepted, but signup form was never completed/submitted.
            router.replace({ pathname: '/doctor-signup', params: { phone } });
         } else {
            // 'pending' or 'rejected' — profile was submitted, show review status
            router.replace('/doctor-pending');
         }

      } catch (err) {
         const msg = err.response?.data?.message || 'Invalid OTP. Please try again.';
         setError(msg);
         setOtp(['', '', '', '']);
         setFocusedIndex(0);
         inputs.current[0]?.focus();
      } finally {
         setLoading(false);
      }
   };

   const handleResend = async () => {
      setTimer(30);
      setCanResend(false);
      setOtp(['', '', '', '']);
      setError('');
      setFocusedIndex(0);
      inputs.current[0]?.focus();

      try {
         if (role === 'patient') {
            await sendPatientOtp(phone);
         } else {
            await sendOtp(phone);
         }
         Alert.alert('OTP Sent', `OTP sent to +91 ${phone}`);
      } catch {
         Alert.alert('Error', 'Could not resend OTP. Please try again.');
      }
   };

   const formattedPhone = phone ? `+91 ${phone.substring(0, 5)}-${phone.substring(5)}` : '';

   return (
      <SafeAreaView style={styles.container}>
         <StatusBar barStyle="dark-content" backgroundColor="#f8fbfc" />
         <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inner}
         >
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
               <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>

            <View style={styles.brandContainer}>
               <Image
                  source={require('../../assets/playstore-icon-512.png')}
                  style={styles.logoImg}
                  resizeMode="contain"
               />
               <Text style={styles.brandName}>OTP Verification</Text>
               <Text style={styles.brandTagline}>We've sent a 4-digit verification code to</Text>
               <Text style={styles.phoneText}>{formattedPhone}</Text>
            </View>

            <View style={styles.card}>
               <View style={styles.otpRow}>
                  {otp.map((digit, idx) => (
                     <TextInput
                        key={idx}
                        ref={r => inputs.current[idx] = r}
                        style={[
                           styles.otpBox,
                           digit ? styles.otpBoxFilled : null,
                           focusedIndex === idx ? styles.otpBoxFocused : null,
                           error ? styles.otpBoxError : null,
                        ]}
                        value={digit}
                        onChangeText={v => handleChange(v, idx)}
                        onKeyPress={e => handleBackspace(e, idx)}
                        onFocus={() => setFocusedIndex(idx)}
                        keyboardType="number-pad"
                        maxLength={1}
                        textAlign="center"
                        autoFocus={idx === 0}
                        editable={!loading}
                     />
                  ))}
               </View>

               {error ? (
                  <View style={styles.errorContainer}>
                     <Ionicons name="alert-circle" size={16} color="#E24B4A" />
                     <Text style={styles.error}>{error}</Text>
                  </View>
               ) : null}

               <View style={styles.resendRow}>
                  {canResend ? (
                     <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
                        <Ionicons name="refresh" size={16} color={TEAL} />
                        <Text style={styles.resendLink}>Resend OTP</Text>
                     </TouchableOpacity>
                  ) : (
                     <Text style={styles.resendTimer}>
                        Resend code in{' '}
                        <Text style={styles.timerNum}>00:{String(timer).padStart(2, '0')}</Text>
                     </Text>
                  )}
               </View>

               <TouchableOpacity
                  style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
                  onPress={handleVerify}
                  activeOpacity={0.85}
                  disabled={loading}
               >
                  <Text style={styles.verifyText}>{loading ? 'Verifying...' : 'Verify & Proceed'}</Text>
                  {!loading && <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginLeft: 6 }} />}
               </TouchableOpacity>

               <TouchableOpacity onPress={() => router.back()} style={styles.changeMobileBtn}>
                  <Text style={styles.changeMobileText}>Change mobile number</Text>
               </TouchableOpacity>
            </View>
         </KeyboardAvoidingView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#f8fbfc' },
   inner: { flex: 1, justifyContent: 'center', padding: 20 },
   backButton: {
      position: 'absolute', top: 16, left: 16, width: 40, height: 40,
      borderRadius: 20, backgroundColor: '#fff', alignItems: 'center',
      justifyContent: 'center', elevation: 2, shadowColor: '#000',
      shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, zIndex: 10,
   },
   brandContainer: { alignItems: 'center', marginBottom: 32 },
   logoImg: {
      width: 60, height: 60, borderRadius: 20, marginBottom: 12,
   },
   brandName: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.5 },
   brandTagline: { fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center' },
   phoneText: { fontSize: 16, fontWeight: '700', color: TEAL, marginTop: 4 },
   card: {
      backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 4,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
   },
   otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
   otpBox: {
      flex: 1, height: 60, borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0',
      fontSize: 22, fontWeight: '700', color: '#1a1a1a', backgroundColor: '#f8fafc',
   },
   otpBoxFilled: { borderColor: TEAL, backgroundColor: '#E8F5F7' },
   otpBoxFocused: { borderColor: TEAL, borderWidth: 2, backgroundColor: '#fff' },
   otpBoxError: { borderColor: '#E24B4A', backgroundColor: '#FCEBEB' },
   errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
   error: { color: '#E24B4A', fontSize: 13, fontWeight: '600' },
   resendRow: { alignItems: 'center', marginBottom: 24 },
   resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
   resendLink: { fontSize: 13, color: TEAL, fontWeight: '700' },
   resendTimer: { fontSize: 13, color: '#666', fontWeight: '500' },
   timerNum: { color: TEAL, fontWeight: '700' },
   verifyBtn: {
      flexDirection: 'row', backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: TEAL,
      shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, marginBottom: 16,
   },
   verifyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
   changeMobileBtn: { alignItems: 'center', paddingVertical: 4 },
   changeMobileText: { color: '#888', fontSize: 13, fontWeight: '600' },
});
