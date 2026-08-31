// src/services/earningsService.js
//
// Used by: app/doctor/earnings.js
//
// Example usage:
//   import { getEarningsSummary, getTransactions, requestPayout } from '../../src/services/earningsService';
//
//   useEffect(() => {
//     getEarningsSummary().then(setSummary);
//     getTransactions().then(setPayouts);
//   }, []);

import api from './api';

// GET /earnings/summary  → { totalEarned, thisWeek, pending, consultationCount, breakdown: {video, audio, chat} }
export async function getEarningsSummary() {
   const { data } = await api.get('/earnings/summary');
   return data;
}

// GET /earnings/transactions  → list of individual payouts (matches `payouts` array shape)
export async function getTransactions(params = {}) {
   const { data } = await api.get('/earnings/transactions', { params });
   return data;
}

// POST /earnings/payout-request
export async function requestPayout() {
   const { data } = await api.post('/earnings/payout-request');
   return data;
}
