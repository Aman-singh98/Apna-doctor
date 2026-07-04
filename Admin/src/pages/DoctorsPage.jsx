// ─── pages/DoctorsPage.jsx ─────────────────────────────────────────────────
// Admin: list doctors, approve / reject / suspend / unsuspend.
// All data comes from the real backend via services/api.js.
//
// This page is intentionally "dumb": data lives in useDoctors, modals and
// table chrome live in components/common (shared across the app), and
// doctor-specific bits live in components/doctors. The page just wires it
// all together.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Table from '../components/ui/Table';
import FilterTabs from '../components/common/FilterTabs';
import SearchInput from '../components/common/SearchInput';
import Pagination from '../components/common/Pagination';
import ReasonModal from '../components/common/ReasonModal';
import ConfirmModal from '../components/common/ConfirmModal';
import DoctorDetailModal from '../components/doctors/DoctorDetailModal';
import { getDoctorColumns } from '../components/doctors/doctorColumns';
import useDoctors from '../hooks/useDoctors';

const FILTER_TABS = ['All', 'Approved', 'Pending', 'Suspended', 'Rejected', 'Incomplete'];

const DoctorsPage = () => {
	const [tab, setTab] = useState('All');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);

	// { doctorId, doctorName, type: 'reject' | 'suspend' }
	const [reasonModal, setReasonModal] = useState(null);
	// { doctorId, doctorName, type: 'verify' | 'unsuspend' }
	const [confirmModal, setConfirmModal] = useState(null);
	const [detailId, setDetailId] = useState(null);

	const {
		doctors, total, pages, fetchLoading, actionLoading,
		verifyDoctor, unsuspendDoctor, rejectDoctor, suspendDoctor,
	} = useDoctors({ tab, search, page });

	// Reset to page 1 whenever the filter or search term changes.
	useEffect(() => { setPage(1); }, [tab, search]);

	const handleConfirmAction = async () => {
		const { doctorId, doctorName, type } = confirmModal;
		const succeeded = type === 'verify'
			? await verifyDoctor(doctorId, doctorName)
			: await unsuspendDoctor(doctorId, doctorName);
		if (succeeded) setConfirmModal(null);
	};

	const handleReasonConfirm = async (reason) => {
		const { doctorId, doctorName, type } = reasonModal;
		const succeeded = type === 'reject'
			? await rejectDoctor(doctorId, doctorName, reason)
			: await suspendDoctor(doctorId, doctorName, reason);
		if (succeeded) setReasonModal(null);
	};

	const columns = useMemo(() => getDoctorColumns({
		actionLoadingId: actionLoading,
		onView: (row) => setDetailId(row._id),
		onApprove: (row) => setConfirmModal({ doctorId: row._id, doctorName: row.name, type: 'verify' }),
		onReject: (row) => setReasonModal({ doctorId: row._id, doctorName: row.name, type: 'reject' }),
		onSuspend: (row) => setReasonModal({ doctorId: row._id, doctorName: row.name, type: 'suspend' }),
		onReactivate: (row) => setConfirmModal({ doctorId: row._id, doctorName: row.name, type: 'unsuspend' }),
	}), [actionLoading]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

			{/* ── Toolbar ─────────────────────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
				style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
			>
				<FilterTabs tabs={FILTER_TABS} activeTab={tab} onChange={setTab} />
				<SearchInput value={search} onChange={setSearch} placeholder="Search name or specialization…" />
			</motion.div>

			{/* ── Table ───────────────────────────────────────────────────────── */}
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
				{fetchLoading ? (
					<div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
						<Loader2 size={28} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
						<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
					</div>
				) : (
					<Table columns={columns} rows={doctors} emptyMsg="No doctors match the current filter." />
				)}
			</motion.div>

			{/* ── Footer: count + pagination ─────────────────────────────────── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
				<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
					Showing {doctors.length} of {total} doctors
				</p>
				<Pagination page={page} pages={pages} onPageChange={setPage} />
			</div>

			{/* ── Modals ──────────────────────────────────────────────────────── */}
			<AnimatePresence>
				{reasonModal && (
					<ReasonModal
						key="reason-modal"
						title={reasonModal.type === 'reject' ? `Reject Dr. ${reasonModal.doctorName}` : `Suspend Dr. ${reasonModal.doctorName}`}
						placeholder={
							reasonModal.type === 'reject'
								? 'e.g. Documents are incomplete or could not be verified…'
								: 'e.g. Multiple patient complaints received…'
						}
						loading={actionLoading === reasonModal.doctorId}
						onClose={() => setReasonModal(null)}
						onConfirm={handleReasonConfirm}
					/>
				)}

				{confirmModal && (
					<ConfirmModal
						key="confirm-modal"
						title={confirmModal.type === 'verify' ? `Approve Dr. ${confirmModal.doctorName}?` : `Reactivate Dr. ${confirmModal.doctorName}?`}
						message={
							confirmModal.type === 'verify'
								? 'This doctor will be able to go live and accept consultations immediately.'
								: 'This lifts the suspension and restores their account to approved status.'
						}
						confirmLabel={confirmModal.type === 'verify' ? 'Approve' : 'Reactivate'}
						danger={false}
						loading={actionLoading === confirmModal.doctorId}
						onClose={() => setConfirmModal(null)}
						onConfirm={handleConfirmAction}
					/>
				)}

				{detailId && (
					<DoctorDetailModal key="detail-modal" doctorId={detailId} onClose={() => setDetailId(null)} />
				)}
			</AnimatePresence>
		</div>
	);
};

export default DoctorsPage;
