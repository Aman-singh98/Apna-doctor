// Admin: list appointments, view details, cancel.
// Wired to the real backend via services/api.js (/api/admin/appointments).
//
// Structured the same way as PatientsPage.jsx: data lives in useAppointments,
// modals and table chrome live in components/common (shared across the app),
// appointment-specific bits live in components/appointments. The page just
// wires it all together.
//
// This REPLACES the mock `AppointmentsPage` currently exported from
// pages/OtherPages.jsx. Update any
//   import { AppointmentsPage } from './OtherPages'
// to
//   import AppointmentsPage from './AppointmentsPage'
// and remove the mock AppointmentsPage block (+ its now-unused INIT_APPTS)
// from OtherPages.jsx.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Table from '../components/ui/Table';
import FilterTabs from '../components/common/FilterTabs';
import SearchInput from '../components/common/SearchInput';
import Pagination from '../components/common/Pagination';
import AppointmentDetailModal from '../components/appointments/appointmentDetailModal';
import CancelAppointmentModal from '../components/appointments/cancelAppointmentModal';
import { getAppointmentColumns } from '../components/appointments/appointmentColumns';
import useAppointments from '../hooks/useAppointments';

const FILTER_TABS = ['All', 'Upcoming', 'Completed', 'Cancelled'];

const AppointmentsPage = () => {
	const [tab, setTab] = useState('All');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);

	// { _id, patientName }
	const [cancelTarget, setCancelTarget] = useState(null);
	const [detailId, setDetailId] = useState(null);

	const {
		appointments, total, pages, fetchLoading, actionLoading, cancelAppointment,
	} = useAppointments({ tab, search, page });

	// Reset to page 1 whenever the filter or search term changes.
	useEffect(() => { setPage(1); }, [tab, search]);

	const handleConfirmCancel = async (reason) => {
		const succeeded = await cancelAppointment(cancelTarget._id, reason);
		if (succeeded) setCancelTarget(null);
	};

	const columns = useMemo(() => getAppointmentColumns({
		actionLoadingId: actionLoading,
		onView: (row) => setDetailId(row._id),
		onCancel: (row) => setCancelTarget({ _id: row._id, patientName: row.patientName }),
	}), [actionLoading]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

			{/* ── Toolbar ─────────────────────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
				style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
			>
				<FilterTabs tabs={FILTER_TABS} activeTab={tab} onChange={setTab} />
				<SearchInput value={search} onChange={setSearch} placeholder="Search patient or doctor…" />
			</motion.div>

			{/* ── Table ───────────────────────────────────────────────────────── */}
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
				{fetchLoading ? (
					<div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
						<Loader2 size={28} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
						<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
					</div>
				) : (
					<Table columns={columns} rows={appointments} emptyMsg="No appointments match the current filter." />
				)}
			</motion.div>

			{/* ── Footer: count + pagination ─────────────────────────────────── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
				<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
					Showing {appointments.length} of {total} appointments
				</p>
				<Pagination page={page} pages={pages} onPageChange={setPage} />
			</div>

			{/* ── Modals ──────────────────────────────────────────────────────── */}
			<AnimatePresence>
				{cancelTarget && (
					<CancelAppointmentModal
						key="cancel-modal"
						patientName={cancelTarget.patientName}
						loading={actionLoading === cancelTarget._id}
						onClose={() => setCancelTarget(null)}
						onConfirm={handleConfirmCancel}
					/>
				)}

				{detailId && (
					<AppointmentDetailModal key="detail-modal" appointmentId={detailId} onClose={() => setDetailId(null)} />
				)}
			</AnimatePresence>
		</div>
	);
};

export default AppointmentsPage;
