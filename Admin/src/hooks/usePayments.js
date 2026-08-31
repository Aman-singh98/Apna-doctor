import { useCallback, useEffect, useState } from 'react';
import { apiGetPayments, apiGetPaymentStats, apiRefundPayment } from '../services/api';

// tab: 'All' | 'Paid' | 'Pending' | 'Refunded' | 'Failed'
export default function usePayments({ tab, search, page, limit = 10 }) {
	const [payments, setPayments] = useState([]);
	const [total, setTotal] = useState(0);
	const [pages, setPages] = useState(1);
	const [stats, setStats] = useState(null);
	const [fetchLoading, setFetchLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(null); // holds payment _id mid-action

	const statusParam = tab && tab !== 'All' ? tab.toLowerCase() : undefined;

	const fetchPayments = useCallback(async () => {
		setFetchLoading(true);
		try {
			const res = await apiGetPayments({ status: statusParam, search, page, limit });
			setPayments(res.payments || []);
			setTotal(res.total || 0);
			setPages(res.pages || 1);
		} catch (err) {
			console.error('Failed to load payments:', err.message);
		} finally {
			setFetchLoading(false);
		}
	}, [statusParam, search, page, limit]);

	const fetchStats = useCallback(async () => {
		try {
			const res = await apiGetPaymentStats();
			setStats(res.stats || null);
		} catch (err) {
			console.error('Failed to load payment stats:', err.message);
		}
	}, []);

	useEffect(() => { fetchPayments(); }, [fetchPayments]);
	useEffect(() => { fetchStats(); }, [fetchStats]);

	const refundPayment = async (id, reason) => {
		setActionLoading(id);
		try {
			await apiRefundPayment(id, reason);
			await Promise.all([fetchPayments(), fetchStats()]);
			return true;
		} catch (err) {
			console.error('Failed to refund payment:', err.message);
			throw err;
		} finally {
			setActionLoading(null);
		}
	};

	return { payments, total, pages, stats, fetchLoading, actionLoading, refundPayment };
}
