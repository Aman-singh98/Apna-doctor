// Admin: list patients, view details, suspend / reactivate, and manage the
// self-service account-deletion lifecycle (cancel a scheduled deletion, or
// force-finalize one early).
// All data comes from the real backend via services/api.js.
//
// Structured the same way as DoctorsPage.jsx: data lives in usePatients,
// modals and table chrome live in components/common (shared across the
// app), and patient-specific bits live in components/patients. The page
// just wires it all together.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Table from '../components/ui/Table';
import FilterTabs from '../components/common/FilterTabs';
import SearchInput from '../components/common/SearchInput';
import Pagination from '../components/common/Pagination';
import ConfirmModal from '../components/common/ConfirmModal';
import PatientDetailModal from '../components/patients/PatientDetailModal';
import { getPatientColumns } from '../components/patients/patientColumns';
import usePatients from '../hooks/usePatients';

const FILTER_TABS = ['All', 'Active', 'Suspended', 'Pending Deletion', 'Deleted'];

const PatientsPage = () => {
	const [tab, setTab] = useState('All');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);

	// { patientId, patientName, type: 'suspend' | 'unsuspend' | 'cancel-deletion' | 'finalize-deletion' }
	const [confirmModal, setConfirmModal] = useState(null);
	const [detailId, setDetailId] = useState(null);

	const {
		patients, total, pages, fetchLoading, actionLoading,
		suspendPatient, unsuspendPatient, cancelPatientDeletion, finalizePatientDeletion,
	} = usePatients({ tab, search, page });

	// Reset to page 1 whenever the filter or search term changes.
	useEffect(() => { setPage(1); }, [tab, search]);

	const handleConfirmAction = async () => {
		const { patientId, patientName, type } = confirmModal;
		const action = {
			suspend: suspendPatient,
			unsuspend: unsuspendPatient,
			'cancel-deletion': cancelPatientDeletion,
			'finalize-deletion': finalizePatientDeletion,
		}[type];
		const succeeded = await action(patientId, patientName);
		if (succeeded) setConfirmModal(null);
	};

	const columns = useMemo(() => getPatientColumns({
		actionLoadingId: actionLoading,
		onView: (row) => setDetailId(row._id),
		onSuspend: (row) => setConfirmModal({ patientId: row._id, patientName: row.name || row.phone, type: 'suspend' }),
		onReactivate: (row) => setConfirmModal({ patientId: row._id, patientName: row.name || row.phone, type: 'unsuspend' }),
		onCancelDeletion: (row) => setConfirmModal({ patientId: row._id, patientName: row.name || row.phone, type: 'cancel-deletion' }),
		onFinalizeDeletion: (row) => setConfirmModal({ patientId: row._id, patientName: row.name || row.phone, type: 'finalize-deletion' }),
	}), [actionLoading]);

	const CONFIRM_COPY = {
		suspend: {
			title: (name) => `Suspend ${name}?`,
			message: 'This will prevent the patient from booking or accessing consultations until reactivated.',
			confirmLabel: 'Suspend',
			danger: true,
		},
		unsuspend: {
			title: (name) => `Reactivate ${name}?`,
			message: "This lifts the suspension and restores the patient's account.",
			confirmLabel: 'Reactivate',
			danger: false,
		},
		'cancel-deletion': {
			title: (name) => `Cancel scheduled deletion for ${name}?`,
			message: "This restores the patient's account to active and cancels the pending deletion. The patient will be able to use their account normally again.",
			confirmLabel: 'Cancel Deletion',
			danger: false,
		},
		'finalize-deletion': {
			title: (name) => `Permanently delete ${name} now?`,
			message: 'This skips the remaining grace period and anonymizes the account immediately. This cannot be undone.',
			confirmLabel: 'Delete Now',
			danger: true,
		},
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

			{/* ── Toolbar ─────────────────────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
				style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
			>
				<FilterTabs tabs={FILTER_TABS} activeTab={tab} onChange={setTab} />
				<SearchInput value={search} onChange={setSearch} placeholder="Search name or phone…" />
			</motion.div>

			{/* ── Table ───────────────────────────────────────────────────────── */}
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
				{fetchLoading ? (
					<div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
						<Loader2 size={28} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
						<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
					</div>
				) : (
					<Table columns={columns} rows={patients} emptyMsg="No patients match the current filter." />
				)}
			</motion.div>

			{/* ── Footer: count + pagination ─────────────────────────────────── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
				<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
					Showing {patients.length} of {total} patients
				</p>
				<Pagination page={page} pages={pages} onPageChange={setPage} />
			</div>

			{/* ── Modals ──────────────────────────────────────────────────────── */}
			<AnimatePresence>
				{confirmModal && (
					<ConfirmModal
						key="confirm-modal"
						title={CONFIRM_COPY[confirmModal.type].title(confirmModal.patientName)}
						message={CONFIRM_COPY[confirmModal.type].message}
						confirmLabel={CONFIRM_COPY[confirmModal.type].confirmLabel}
						danger={CONFIRM_COPY[confirmModal.type].danger}
						loading={actionLoading === confirmModal.patientId}
						onClose={() => setConfirmModal(null)}
						onConfirm={handleConfirmAction}
					/>
				)}

				{detailId && (
					<PatientDetailModal key="detail-modal" patientId={detailId} onClose={() => setDetailId(null)} />
				)}
			</AnimatePresence>
		</div>
	);
};

export default PatientsPage;
