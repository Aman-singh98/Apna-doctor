// Intentionally using the "legacy" expo-file-system entrypoint rather than
// the SDK 54 File/Directory API — same reasoning as
// patientPrescriptionService.js: downloadAsync() with a custom `headers`
// object (needed to attach the patient's JWT) is only on the legacy API.
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';
import { getPatientToken } from './authStorage';

// GET /patient/payments/summary → { totalSpent, activeCount, refundedCount, refundedTotal }
export async function getPaymentSummary() {
   const { data } = await api.get('/patient/payments/summary');
   return data;
}

// GET /patient/payments → payment history (paid/refunded/pending), most recent first
export async function getPayments() {
   const { data } = await api.get('/patient/payments');
   return data;
}

// GET /patient/payments/refunds → refund history
export async function getRefunds() {
   const { data } = await api.get('/patient/payments/refunds');
   return data;
}

// GET /patient/payments/:id/invoice/pdf
//
// Downloads the receipt PDF to a local cache file and returns its file://
// URI, same pattern as downloadMyPrescriptionPdf in
// patientPrescriptionService.js — a binary PDF download needs
// FileSystem.downloadAsync writing straight to disk, not axios buffering it
// through JS. The auth header is attached manually since downloadAsync
// doesn't go through api.js's interceptor.
export async function downloadInvoicePdf(paymentId) {
   const token = await getPatientToken();
   const baseUrl = api.defaults.baseURL;
   const fileUri = `${FileSystem.cacheDirectory}invoice-${paymentId}.pdf`;

   const result = await FileSystem.downloadAsync(`${baseUrl}/patient/payments/${paymentId}/invoice/pdf`, fileUri, {
      headers: {
         ...(token ? { Authorization: `Bearer ${token}` } : {}),
         'ngrok-skip-browser-warning': 'true',
      },
   });

   if (result.status !== 200) {
      throw new Error(`Failed to download invoice PDF (status ${result.status})`);
   }

   return result.uri;
}
