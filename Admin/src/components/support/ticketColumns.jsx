// ─── components/support/ticketColumns.js ───────────────────────────────────
// Column config for SupportPage's <Table>. Mirrors doctorColumns.js.

import { CheckCircle, MessageSquare } from 'lucide-react';
import Badge from '../ui/Badge';
import ActionButton from '../common/ActionButton';

const PRIORITY_COLORS = { High: '#EA4335', Medium: '#FBBC04', Low: '#34A853' };

// Small colored pill distinguishing who raised the ticket. Falls back to
// checking which field is populated for older tickets created before
// raisedByRole existed on the schema.
const ROLE_STYLES = {
	doctor: { bg: 'var(--blue-tint)', fg: 'var(--blue-primary)', label: 'Doctor' },
	patient: { bg: '#E1F5EE', fg: '#0F7A5C', label: 'Patient' },
};

const getRaisedByRole = (row) => row.raisedByRole || (row.doctor ? 'doctor' : 'patient');

const RoleBadge = ({ role }) => {
	const s = ROLE_STYLES[role] ?? ROLE_STYLES.patient;
	return (
		<span
			style={{
				fontSize: 10.5, fontWeight: 700, color: s.fg, background: s.bg,
				borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap',
			}}
		>
			{s.label}
		</span>
	);
};

// Ticket.status from the backend is 'Open' | 'In Progress' | 'Resolved'.
// Mapped to whatever keys Badge's color map expects, same as before.
const statusBadgeKey = (status) => ({
	Open: 'pending',
	'In Progress': 'active',
	Resolved: 'resolved',
}[status] ?? status);

export const getTicketColumns = ({ actionLoadingId, onView, onResolve }) => [
	{
		key: 'ticketId', label: 'Ticket',
		render: (v) => (
			<code style={{ fontSize: 11.5, color: 'var(--blue-primary)', background: 'var(--blue-tint)', borderRadius: 4, padding: '2px 6px' }}>
				{v}
			</code>
		),
	},
	{
		key: 'patient', label: 'Raised by',
		render: (v, row) => (
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<span>{v?.name || row.doctor?.name || '—'}</span>
				<RoleBadge role={getRaisedByRole(row)} />
			</div>
		),
	},
	{ key: 'subject', label: 'Issue' },
	{
		key: 'priority', label: 'Priority',
		render: (v) => (
			<span style={{ fontSize: 11.5, fontWeight: 700, color: PRIORITY_COLORS[v] ?? 'var(--text-muted)' }}>
				{v}
			</span>
		),
	},
	{
		key: 'assignedTo', label: 'Assignee',
		render: (v) => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v || 'Unassigned'}</span>,
	},
	{ key: 'status', label: 'Status', render: (v) => <Badge status={statusBadgeKey(v)} label={v} /> },
	{
		key: 'actions', label: 'Actions',
		render: (_, row) => (
			<div style={{ display: 'flex', gap: 6 }}>
				<ActionButton
					icon={MessageSquare}
					color="var(--blue-primary)"
					label="View & Reply"
					onClick={() => onView(row)}
					disabled={actionLoadingId === row._id}
				/>
				{row.status !== 'Resolved' && (
					<ActionButton
						icon={CheckCircle}
						color="var(--green-success)"
						label="Resolve"
						onClick={() => onResolve(row)}
						disabled={actionLoadingId === row._id}
						spinning={actionLoadingId === row._id}
					/>
				)}
			</div>
		),
	},
];
