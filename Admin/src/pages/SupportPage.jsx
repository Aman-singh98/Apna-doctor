// ─── pages/SupportPage.jsx ──────────────────────────────────────────────────
// Admin: list support tickets, view/reply, resolve (with a required reason).
// Same shape as DoctorsPage — data lives in useSupportTickets, modal/table
// chrome comes from components/common, ticket-specific bits live in
// components/support. The page just wires it all together.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Table from '../components/ui/Table';
import FilterTabs from '../components/common/FilterTabs';
import SearchInput from '../components/common/SearchInput';
import Pagination from '../components/common/Pagination';
import ReasonModal from '../components/common/ReasonModal';
import TicketDetailModal from '../components/support/TicketDetailModal';
import { getTicketColumns } from '../components/support/ticketColumns';
import useSupportTickets from '../hooks/useSupportTickets';

const FILTER_TABS = ['All', 'Open', 'In Progress', 'Resolved'];

const SupportPage = () => {
	const [tab, setTab] = useState('All');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);

	// { ticketId, ticketSubject }
	const [reasonModal, setReasonModal] = useState(null);
	const [detailId, setDetailId] = useState(null);

	const {
		tickets, total, pages, fetchLoading, actionLoading,
		resolveTicket, patchTicket,
	} = useSupportTickets({ tab, search, page });

	// Reset to page 1 whenever the filter or search term changes.
	useEffect(() => { setPage(1); }, [tab, search]);

	const handleReasonConfirm = async (reason) => {
		const { ticketId } = reasonModal;
		const succeeded = await resolveTicket(ticketId, reason);
		if (succeeded) setReasonModal(null);
	};

	const columns = useMemo(() => getTicketColumns({
		actionLoadingId: actionLoading,
		onView: (row) => setDetailId(row._id),
		onResolve: (row) => setReasonModal({ ticketId: row._id, ticketSubject: row.subject }),
	}), [actionLoading]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

			{/* ── Toolbar ─────────────────────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
				style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
			>
				<FilterTabs tabs={FILTER_TABS} activeTab={tab} onChange={setTab} />
				<SearchInput value={search} onChange={setSearch} placeholder="Search ticket, subject or patient…" />
			</motion.div>

			{/* ── Table ───────────────────────────────────────────────────────── */}
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
				{fetchLoading ? (
					<div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
						<Loader2 size={28} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
						<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
					</div>
				) : (
					<Table columns={columns} rows={tickets} emptyMsg="No support tickets match the current filter." />
				)}
			</motion.div>

			{/* ── Footer: count + pagination ─────────────────────────────────── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
				<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
					Showing {tickets.length} of {total} tickets
				</p>
				<Pagination page={page} pages={pages} onPageChange={setPage} />
			</div>

			{/* ── Modals ──────────────────────────────────────────────────────── */}
			<AnimatePresence>
				{reasonModal && (
					<ReasonModal
						key="reason-modal"
						title={`Resolve ticket: ${reasonModal.ticketSubject}`}
						placeholder="e.g. Issue confirmed fixed, refund processed…"
						loading={actionLoading === reasonModal.ticketId}
						onClose={() => setReasonModal(null)}
						onConfirm={handleReasonConfirm}
					/>
				)}

				{detailId && (
					<TicketDetailModal
						key="detail-modal"
						ticketId={detailId}
						onClose={() => setDetailId(null)}
						onChanged={patchTicket}
					/>
				)}
			</AnimatePresence>
		</div>
	);
};

export default SupportPage;
