import { Eye, XCircle } from 'lucide-react';
import Badge from '../ui/Badge';

const actionBtnStyle = (color) => ({
	background: 'none',
	border: `1px solid ${color}22`,
	borderRadius: 6,
	padding: '4px 8px',
	cursor: 'pointer',
	color,
	display: 'flex',
	alignItems: 'center',
});

export const getAppointmentColumns = ({ actionLoadingId, onView, onCancel }) => [
	{ key: 'patientName', label: 'Patient' },
	{ key: 'doctorName', label: 'Doctor', render: (v) => v || '—' },
	{
		key: 'type',
		label: 'Type',
		render: (v) => (
			<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-primary)' }}>{v}</span>
		),
	},
	{
		key: 'date',
		label: 'Date & Time',
		render: (v) => new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
	},
	{ key: 'fee', label: 'Fee', render: (v) => `\u20b9${v ?? 0}` },
	{ key: 'status', label: 'Status', render: (v) => <Badge status={v} /> },
	{
		key: 'actions',
		label: 'Actions',
		render: (_, row) => (
			<div style={{ display: 'flex', gap: 6 }}>
				<button onClick={() => onView(row)} title="View details" style={actionBtnStyle('var(--blue-primary)')}>
					<Eye size={13} />
				</button>
				{row.status === 'upcoming' && (
					<button
						onClick={() => onCancel(row)}
						disabled={actionLoadingId === row._id}
						title="Cancel appointment"
						style={actionBtnStyle('var(--red-danger)')}
					>
						<XCircle size={13} />
					</button>
				)}
			</div>
		),
	},
];
