// ─── hooks/useDashboard.js ──────────────────────────────────────────────────
// Fetches the live admin overview (stat cards, revenue trend, quick stats,
// recent appointments) in one round trip. DashboardPage.jsx stays purely
// about layout/composition.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiGetDashboard } from '../services/api';

const EMPTY_STATS = { totalDoctors: 0, totalPatients: 0, appointmentsToday: 0, revenueThisMonth: 0 };
const EMPTY_QUICK_STATS = {
	pendingVerifications: 0,
	activeConsultations: 0,
	openSupportTickets: 0,
	refundRequests: 0,
	newPatientsToday: 0,
};

const useDashboard = () => {
	const [stats, setStats] = useState(EMPTY_STATS);
	const [revenueTrend, setRevenueTrend] = useState([]);
	const [quickStats, setQuickStats] = useState(EMPTY_QUICK_STATS);
	const [recentAppointments, setRecentAppointments] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchDashboard = useCallback(async () => {
		setLoading(true);
		try {
			const data = await apiGetDashboard();
			setStats(data.stats);
			setRevenueTrend(data.revenueTrend);
			setQuickStats(data.quickStats);
			setRecentAppointments(data.recentAppointments);
		} catch (err) {
			toast.error(err.message || 'Failed to load dashboard.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchDashboard();
	}, [fetchDashboard]);

	return { stats, revenueTrend, quickStats, recentAppointments, loading, refetch: fetchDashboard };
};

export default useDashboard;
