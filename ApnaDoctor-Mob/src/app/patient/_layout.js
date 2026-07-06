import { Stack } from 'expo-router';
import { useRegisterPushToken } from '../../hooks/useRegisterPushToken';

export default function PatientLayout() {
   // Runs once when the patient section mounts (i.e. right after patient login),
   // not on every screen navigation within this stack.
   useRegisterPushToken('patient');

   return (
      <Stack
         screenOptions={{
            headerShown: false,
         }}
      />
   );
}
