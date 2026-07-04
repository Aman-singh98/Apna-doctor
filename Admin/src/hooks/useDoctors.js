// ─── hooks/useDoctors.js ────────────────────────────────────────────────────
// Encapsulates all data concerns for the doctors list: fetching (with tab
// filter + debounced search), and the verify/reject/suspend/unsuspend
// actions. DoctorsPage.jsx stays purely about composition + local UI state.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
	apiGetDoctors,
	apiRejectDoctor,
	apiSuspendDoctor,
	apiUnsuspendDoctor,
	apiVerifyDoctor,
} from '../services/api';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

export const STATUS_VALUE = {
	All: '', Approved: 'approved', Pending: 'pending',
	Suspended: 'suspended', Rejected: 'rejected', Incomplete: 'not_started',
};

const useDoctors = ({ tab, search, page }) => {
	const [doctors, setDoctors] = useState([]);
	const [total, setTotal] = useState(0);
	const [pages, setPages] = useState(1);
	const [fetchLoading, setFetchLoading] = useState(false);
	const [actionLoading, setActionLoading] = useState(null);

	const fetchDoctors = useCallback(async () => {
		setFetchLoading(true);
		try {
			const params = { page, limit: PAGE_SIZE };
			if (tab !== 'All') params.status = STATUS_VALUE[tab];
			if (search.trim()) params.search = search.trim();

			const data = await apiGetDoctors(params);
			setDoctors(data.doctors);
			setTotal(data.total);
			setPages(data.pages);
		} catch (err) {
			toast.error(err.message || 'Failed to load doctors.');
		} finally {
			setFetchLoading(false);
		}
	}, [tab, search, page]);

	useEffect(() => {
		if (search) {
			const timer = setTimeout(fetchDoctors, SEARCH_DEBOUNCE_MS);
			return () => clearTimeout(timer);
		}
		fetchDoctors();
	}, [fetchDoctors, search]);

	/**
	 * Runs a status-change API call with shared loading/toast/refetch handling.
	 * @returns {Promise<boolean>} whether the action succeeded
	 */
	const runAction = useCallback(async (apiCall, doctorId, successMessage) => {
		setActionLoading(doctorId);
		try {
			await apiCall();
			toast.success(successMessage);
			fetchDoctors();
			return true;
		} catch (err) {
			toast.error(err.message || 'Action failed.');
			return false;
		} finally {
			setActionLoading(null);
		}
	}, [fetchDoctors]);

	const verifyDoctor = useCallback(
		(doctorId, doctorName) =>
			runAction(() => apiVerifyDoctor(doctorId), doctorId, `Dr. ${doctorName} has been verified.`),
		[runAction],
	);

	const unsuspendDoctor = useCallback(
		(doctorId, doctorName) =>
			runAction(() => apiUnsuspendDoctor(doctorId), doctorId, `Dr. ${doctorName}'s account has been reactivated.`),
		[runAction],
	);

	const rejectDoctor = useCallback(
		(doctorId, doctorName, reason) =>
			runAction(() => apiRejectDoctor(doctorId, reason), doctorId, `Dr. ${doctorName} has been rejected.`),
		[runAction],
	);

	const suspendDoctor = useCallback(
		(doctorId, doctorName, reason) =>
			runAction(() => apiSuspendDoctor(doctorId, reason), doctorId, `Dr. ${doctorName} has been suspended.`),
		[runAction],
	);

	return {
		doctors,
		total,
		pages,
		fetchLoading,
		actionLoading,
		verifyDoctor,
		unsuspendDoctor,
		rejectDoctor,
		suspendDoctor,
	};
};

export default useDoctors;
