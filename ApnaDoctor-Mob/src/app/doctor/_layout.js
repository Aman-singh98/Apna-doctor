import { Stack } from 'expo-router';
import { useRegisterPushToken } from '../../hooks/useRegisterPushToken';

export default function DoctorLayout() {
   // Runs once when the doctor section mounts (i.e. right after doctor login),
   // not on every screen navigation within this stack — that's the whole
   // reason this belongs in the layout instead of dashboard.js.
   useRegisterPushToken('doctor');

   return (
      <Stack
         screenOptions={{
            headerShown: false,
         }}
      />
   );
}
