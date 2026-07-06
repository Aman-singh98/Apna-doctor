// hooks/useRegisterPushToken.js
//
// ASSUMPTIONS — adjust if wrong:
//   - Called once per login, with the logged-in role ('patient' | 'doctor').
//   - Uses registerDeviceToken() from patientNotificationService.js /
//     doctorNotificationService.js — adjust the import path to match your structure.
//   - Uses getDevicePushTokenAsync() (native FCM token), matching the backend's
//     raw firebase-admin setup (NOT getExpoPushTokenAsync — that's for Expo's
//     own push service, a different delivery path entirely).

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerDeviceToken as registerPatientToken } from '../services/patientNotificationService';
import { registerDeviceToken as registerDoctorToken } from '../services/doctorNotificationService';

// Foreground behavior: without this, Android silently swallows notifications
// that arrive while the app is open — this is what makes them actually show
// as a heads-up banner even in foreground.
Notifications.setNotificationHandler({
   handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
   }),
});

export function useRegisterPushToken(role) {
   useEffect(() => {
      if (!role) return; // don't attempt before login

      (async () => {
         // Android requires an explicit notification channel or it drops
         // notifications with zero error/log — the #1 silent-failure cause.
         if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
               name: 'default',
               importance: Notifications.AndroidImportance.HIGH, // HIGH = heads-up popup, not just a silent tray entry
               vibrationPattern: [0, 250, 250, 250],
               lightColor: '#1A7E8A',
            });
         }

         // Push only works on a physical device, never an emulator/simulator
         if (!Device.isDevice) {
            console.warn('[push] Skipping registration — must run on a physical device.');
            return;
         }

         const { status: existingStatus } = await Notifications.getPermissionsAsync();
         let finalStatus = existingStatus;
         if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
         }
         if (finalStatus !== 'granted') {
            console.warn('[push] Permission not granted — push notifications will not work.');
            return;
         }

         try {
            const { data: token } = await Notifications.getDevicePushTokenAsync();

            const register = role === 'doctor' ? registerDoctorToken : registerPatientToken;
            await register({ token, platform: Platform.OS });
            console.log('[push] Device token registered:', token);
         } catch (err) {
            console.error('[push] Failed to register device token:', err.message);
         }
      })();
   }, [role]);
}
