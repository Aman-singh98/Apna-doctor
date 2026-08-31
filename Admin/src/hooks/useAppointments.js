import { useCallback, useEffect, useState } from 'react';
import { apiGetAppointments, apiCancelAppointment } from '../services/api';

// tab: 'All' | 'Upcoming' | 'Completed' | 'Cancelled'
export default function useAppointments({ tab, search, page, limit = 10 }) {
	const [appointments, setAppointments] = useState([]);
	const [total, setTotal] = useState(0);
	const [pages, setPages] = useState(1);
	const [fetchLoading, setFetchLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(null); // holds appointment _id mid-action

	const statusParam = tab && tab !== 'All' ? tab.toLowerCase() : undefined;

	const fetchAppointments = useCallback(async () => {
		setFetchLoading(true);
		try {
			const res = await apiGetAppointments({ status: statusParam, search, page, limit });
			setAppointments(res.appointments || []);
			setTotal(res.total || 0);
			setPages(res.pages || 1);
		} catch (err) {
			console.error('Failed to load appointments:', err.message);
		} finally {
			setFetchLoading(false);
		}
	}, [statusParam, search, page, limit]);

	useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

	const cancelAppointment = async (id, reason) => {
		setActionLoading(id);
		try {
			await apiCancelAppointment(id, reason);
			await fetchAppointments();
			return true;
		} catch (err) {
			console.error('Failed to cancel appointment:', err.message);
			return false;
		} finally {
			setActionLoading(null);
		}
	};

	return { appointments, total, pages, fetchLoading, actionLoading, cancelAppointment };
}
