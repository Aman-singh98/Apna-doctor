// ─── hooks/useSupportTickets.js ─────────────────────────────────────────────
// Data + actions for SupportPage. Mirrors useDoctors: page stays "dumb",
// all fetch/action logic lives here.

import { useCallback, useEffect, useState } from 'react';
import { apiGetTickets, apiUpdateTicket } from '../services/api';

const useSupportTickets = ({ tab, search, page, limit = 10 }) => {
	const [tickets, setTickets] = useState([]);
	const [total, setTotal] = useState(0);
	const [pages, setPages] = useState(1);
	const [fetchLoading, setFetchLoading] = useState(true);
	// ticketId currently being acted on (resolve in flight) — mirrors
	// useDoctors' actionLoading, used to disable/spin the right row's button.
	const [actionLoading, setActionLoading] = useState(null);

	const load = useCallback(async () => {
		setFetchLoading(true);
		try {
			// apiGetTickets → { success, count, total, page, pages, data: [] }
			const res = await apiGetTickets({
				status: tab && tab !== 'All' ? tab : undefined,
				search,
				page,
				limit,
			});
			setTickets(res.data ?? []);
			setTotal(res.total ?? 0);
			setPages(res.pages ?? 1);
		} catch (err) {
			console.error('Failed to load tickets:', err);
			setTickets([]);
		} finally {
			setFetchLoading(false);
		}
	}, [tab, search, page, limit]);

	useEffect(() => { load(); }, [load]);

	// Resolve with a required reason (ReasonModal enforces min length before
	// this is even called). Adjust the `resolutionReason` field name below to
	// match whatever your Ticket schema actually calls it.
	const resolveTicket = async (ticketId, reason) => {
		setActionLoading(ticketId);
		try {
			// apiUpdateTicket → { success, data: ticket }
			const res = await apiUpdateTicket(ticketId, {
				status: 'Resolved',
				resolutionReason: reason,
			});
			setTickets(prev => prev.map(t => (t._id === ticketId ? res.data : t)));
			return true;
		} catch (err) {
			alert(err.message || 'Failed to resolve ticket.'); // eslint-disable-line no-alert
			return false;
		} finally {
			setActionLoading(null);
		}
	};

	// Lets the detail modal push status/priority/assignee/reply updates back
	// into the list without a full refetch.
	const patchTicket = (updated) => {
		setTickets(prev => prev.map(t => (t._id === updated._id ? updated : t)));
	};

	return { tickets, total, pages, fetchLoading, actionLoading, resolveTicket, patchTicket };
};

export default useSupportTickets;
