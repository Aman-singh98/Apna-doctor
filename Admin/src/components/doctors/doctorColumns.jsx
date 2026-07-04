// ─── components/doctors/doctorColumns.jsx ──────────────────────────────────
// Column definitions for the doctors Table. Pulled out of DoctorsPage so the
// page component stays focused on composition/state, not render config.

import { Ban, CheckCircle, Eye, Loader2, RefreshCw, XCircle } from 'lucide-react';
import Badge from '../ui/Badge';
import ActionButton from '../common/ActionButton';
import { formatCurrency, formatDate } from '../../utils/formatters';

/**
 * @param {Object} handlers
 * @param {string|null} handlers.actionLoadingId - _id of the row currently mid-action
 * @param {(row) => void} handlers.onView
 * @param {(row) => void} handlers.onApprove
 * @param {(row) => void} handlers.onReject
 * @param {(row) => void} handlers.onSuspend
 * @param {(row) => void} handlers.onReactivate
 */
export const getDoctorColumns = ({
	actionLoadingId,
	onView,
	onApprove,
	onReject,
	onSuspend,
	onReactivate,
}) => [
	{
		key: 'name', label: 'Doctor',
		render: (v, row) => (
			<div>
				<p style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy-heading)' }}>
					{v || `+91 ${row.phone}`}
				</p>
				<p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
					{row.specialization || 'Signup not completed'}
				</p>
			</div>
		),
	},
	{ key: 'experience', label: 'Exp.', render: (v) => `${v ?? 0} yr${v === 1 ? '' : 's'}` },
	{
		key: 'fees', label: 'Fee',
		render: (_, row) => (
			<span style={{ fontSize: 12 }}>
				🎥 {formatCurrency(row.videoFee)} &nbsp;·&nbsp; 💬 {formatCurrency(row.chatFee)}
			</span>
		),
	},
	{ key: 'createdAt', label: 'Joined', render: (v) => formatDate(v) },
	{ key: 'approvalStatus', label: 'Status', render: (v) => <Badge status={v} /> },
	{
		key: 'actions', label: 'Actions',
		render: (_, row) => {
			const busy = actionLoadingId === row._id;
			const status = row.approvalStatus;

			return (
				<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
					<ActionButton icon={Eye} color="var(--text-muted)" label="View" onClick={() => onView(row)} />

					{status === 'not_started' && (
						<span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Awaiting signup</span>
					)}

					{status !== 'not_started' && status !== 'approved' && (
						<ActionButton
							icon={busy ? Loader2 : CheckCircle}
							color="var(--green-success)"
							label="Approve"
							disabled={busy}
							spinning={busy}
							onClick={() => onApprove(row)}
						/>
					)}
					{status !== 'not_started' && status !== 'rejected' && (
						<ActionButton
							icon={XCircle}
							color="var(--red-danger)"
							label="Reject"
							disabled={busy}
							onClick={() => onReject(row)}
						/>
					)}
					{status === 'approved' && (
						<ActionButton
							icon={Ban}
							color="var(--amber-warn)"
							label="Suspend"
							disabled={busy}
							onClick={() => onSuspend(row)}
						/>
					)}
					{status === 'suspended' && (
						<ActionButton
							icon={busy ? Loader2 : RefreshCw}
							color="var(--blue-primary)"
							label="Reactivate"
							disabled={busy}
							spinning={busy}
							onClick={() => onReactivate(row)}
						/>
					)}
				</div>
			);
		},
	},
];
