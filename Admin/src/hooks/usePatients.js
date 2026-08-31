// Data + actions for PatientsPage. Mirrors hooks/useDoctors.js: fetch/search/
// paginate patients, plus suspend/unsuspend and deletion-override actions
// with per-row loading state.

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
   apiGetPatients,
   apiSuspendPatient,
   apiUnsuspendPatient,
   apiCancelPatientDeletion,
   apiFinalizePatientDeletion,
} from '../services/api';

// Two separate dimensions on a patient:
//  - `status`        : active | suspended            (suspend/reactivate)
//  - `accountStatus` : active | pending_deletion | deleted (self-service deletion)
// Tabs map to whichever query param is relevant for that filter.
const TAB_TO_PARAMS = {
   All: {},
   Active: { status: 'active' },
   Suspended: { status: 'suspended' },
   'Pending Deletion': { accountStatus: 'pending_deletion' },
   Deleted: { accountStatus: 'deleted' },
};

export default function usePatients({ tab, search, page, limit = 10 }) {
   const [patients, setPatients] = useState([]);
   const [total, setTotal] = useState(0);
   const [pages, setPages] = useState(1);
   const [fetchLoading, setFetchLoading] = useState(true);
   // Holds the _id of the patient currently being acted on, so the row's
   // action button and any open modal can show a spinner.
   const [actionLoading, setActionLoading] = useState(null);

   const fetchPatients = useCallback(async () => {
      setFetchLoading(true);
      try {
         const data = await apiGetPatients({
            ...(TAB_TO_PARAMS[tab] ?? {}),
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

   const cancelPatientDeletion = async (patientId, patientName) => {
      setActionLoading(patientId);
      try {
         await apiCancelPatientDeletion(patientId);
         toast.success(`${patientName}'s scheduled deletion has been cancelled`);
         await fetchPatients();
         return true;
      } catch (err) {
         toast.error(err.message || 'Failed to cancel deletion');
         return false;
      } finally {
         setActionLoading(null);
      }
   };

   const finalizePatientDeletion = async (patientId, patientName) => {
      setActionLoading(patientId);
      try {
         await apiFinalizePatientDeletion(patientId);
         toast.success(`${patientName}'s account has been permanently deleted`);
         await fetchPatients();
         return true;
      } catch (err) {
         toast.error(err.message || 'Failed to finalize deletion');
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
      cancelPatientDeletion,
      finalizePatientDeletion,
   };
}
