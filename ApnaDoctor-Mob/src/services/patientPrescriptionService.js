// Intentionally using the "legacy" expo-file-system entrypoint rather than
// the SDK 54 File/Directory API. downloadAsync() with a custom `headers`
// object (needed to attach the patient's JWT) is only on the legacy API —
// see https://docs.expo.dev/versions/v54.0.0/sdk/filesystem-legacy/.
// Expo has confirmed expo-file-system/legacy stays available through at
// least SDK 55, so this is a supported choice, not a stopgap hack.
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';
import { getPatientToken } from './authStorage';

// GET /patient/prescriptions  (optionally filtered by search query)
export async function getMyPrescriptions(params = {}) {
   const { data } = await api.get('/patient/prescriptions', { params });
   return data;
}

// GET /patient/prescriptions/:id
export async function getMyPrescriptionById(id) {
   const { data } = await api.get(`/patient/prescriptions/${id}`);
   return data;
}

// GET /patient/prescriptions/:id/pdf
//
// Downloads the prescription PDF slip to a local cache file and returns its
// file:// URI. Uses FileSystem.downloadAsync (not the `api` axios instance)
// because we need the raw binary written straight to disk rather than
// buffered through JS as a string/JSON — axios isn't a good fit for binary
// file downloads in React Native.
//
// The auth header is attached manually here (mirroring what api.js's
// interceptor does for every other request) since downloadAsync doesn't go
// through axios and therefore skips that interceptor entirely.
export async function downloadMyPrescriptionPdf(id) {
   const token = await getPatientToken();
   const baseUrl = api.defaults.baseURL;
   const fileUri = `${FileSystem.cacheDirectory}prescription-${id}.pdf`;

   const result = await FileSystem.downloadAsync(`${baseUrl}/patient/prescriptions/${id}/pdf`, fileUri, {
      headers: {
         ...(token ? { Authorization: `Bearer ${token}` } : {}),
         // Same reasoning as api.js — harmless against a non-ngrok backend.
         'ngrok-skip-browser-warning': 'true',
      },
   });

   if (result.status !== 200) {
      throw new Error(`Failed to download prescription PDF (status ${result.status})`);
   }

   return result.uri;
}

// Persists an already-downloaded (cache-dir) prescription PDF into a real,
// user-visible location — as opposed to Sharing.shareAsync(), which just
// hands the same cache file to the OS share sheet (send to WhatsApp, email,
// AirDrop, etc.) without saving anything anywhere durable.
//
// Android: uses the Storage Access Framework so the file lands in a real
// folder the user picks (defaults to Downloads the first time most vendors'
// pickers open) — no share sheet involved, this is a genuine "save to my
// device" action. The directory permission is requested every call for
// simplicity; callers may cache the returned tree URI in AsyncStorage if
// they want to avoid re-prompting on every download.
//
// iOS: there is no public, app-writable "Downloads" folder — Apple's
// sandbox only exposes "Save to Files" through the same share-sheet /
// document-picker UI, so on iOS this intentionally throws and callers
// should fall back to Sharing.shareAsync() with "Save to Files" as the
// user's chosen action instead of pretending a silent save happened.
export async function saveMyPrescriptionPdfToDevice(localFileUri, filename) {
   if (FileSystem.StorageAccessFramework === undefined) {
      throw new Error('DEVICE_SAVE_UNSUPPORTED');
   }

   const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
   if (!permissions.granted) {
      throw new Error('DEVICE_SAVE_PERMISSION_DENIED');
   }

   const base64 = await FileSystem.readAsStringAsync(localFileUri, { encoding: FileSystem.EncodingType.Base64 });

   const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      'application/pdf'
   );
   await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });

   return destUri;
}
