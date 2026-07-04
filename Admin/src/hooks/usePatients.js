// Data + actions for PatientsPage. Mirrors hooks/useDoctors.js: fetch/search/
// paginate patients, plus suspend/unsuspend actions with per-row loading state.

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { apiGetPatients, apiSuspendPatient, apiUnsuspendPatient } from '../services/api';

const TAB_TO_STATUS = {
   All: '',
   Active: 'active',
   Suspended: 'suspended',
};

export default function usePatients({ tab, search, page, limit = 10 }) {
   const [patients, setPatients] = useState([]);
   const [total, setTotal] = useState(0);
   const [pages, setPages] = useState(1);
   const [fetchLoading, setFetchLoading] = useState(true);
   // Holds the _id of the patient currently being acted on (suspend/unsuspend),
   // so the row's action button and any open modal can show a spinner.
   const [actionLoading, setActionLoading] = useState(null);

   const fetchPatients = useCallback(async () => {
      setFetchLoading(true);
      try {
         const data = await apiGetPatients({
            status: TAB_TO_STATUS[tab] ?? '',
            search,
            page,
            limit,
         });
         setPatients(data.patients ?? []);
         setTotal(data.total ?? 0);
         setPages(data.pages ?? 1);
      } catch (err) {
         toast.error(err.message || 'Failed to load patients');
      } finally {
         setFetchLoading(false);
      }
   }, [tab, search, page, limit]);

   // Debounce only when there's an active search term typed; filter/page
   // changes refetch immediately.
   useEffect(() => {
      const t = setTimeout(fetchPatients, search ? 350 : 0);
      return () => clearTimeout(t);
   }, [fetchPatients, search]);

   const suspendPatient = async (patientId, patientName) => {
      setActionLoading(patientId);
      try {
         await apiSuspendPatient(patientId);
         toast.success(`${patientName} has been suspended`);
         await fetchPatients();
         return true;
      } catch (err) {
         toast.error(err.message || 'Failed to suspend patient');
         return false;
      } finally {
         setActionLoading(null);
      }
   };

   const unsuspendPatient = async (patientId, patientName) => {
      setActionLoading(patientId);
      try {
         await apiUnsuspendPatient(patientId);
         toast.success(`${patientName} has been reactivated`);
         await fetchPatients();
         return true;
      } catch (err) {
         toast.error(err.message || 'Failed to reactivate patient');
         return false;
      } finally {
         setActionLoading(null);
      }
   };

   return {
      patients,
      total,
      pages,
      fetchLoading,
      actionLoading,
      suspendPatient,
      unsuspendPatient,
   };
}
