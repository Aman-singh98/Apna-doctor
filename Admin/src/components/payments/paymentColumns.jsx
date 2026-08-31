import { RefreshCw } from 'lucide-react';
import Badge from '../ui/Badge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const actionBtnStyle = (color) => ({
	background: 'none',
	border: `1px solid ${color}22`,
	borderRadius: 6,
	padding: '4px 8px',
	cursor: 'pointer',
	color,
	fontSize: 11.5,
	fontWeight: 600,
	display: 'flex',
	alignItems: 'center',
	gap: 4,
});

// A payment record IS an Appointment here (see backend
// controllers/adminPaymentController.js) — razorpayPaymentId is the closest
// thing this codebase has to a "transaction ID", so that's what's shown
// (falling back to the order ID for payments that never reached capture).
export const getPaymentColumns = ({ actionLoadingId, onRefund }) => [
	{
		key: 'razorpayPaymentId',
		label: 'Txn ID',
		render: (v, row) => (
			<code style={{ fontSize: 11.5, color: 'var(--blue-primary)', background: 'var(--blue-tint)', borderRadius: 4, padding: '2px 6px' }}>
				{v || row.razorpayOrderId || '—'}
			</code>
		),
	},
	{ key: 'patientName', label: 'Patient', render: (v) => v || '—' },
	{ key: 'doctorName', label: 'Doctor', render: (v) => v || '—' },
	{
		key: 'amount',
		label: 'Amount',
		render: (v) => <span style={{ fontWeight: 700, color: 'var(--navy-heading)' }}>{formatCurrency(v)}</span>,
	},
	{
		key: 'type',
		label: 'Consult Type',
		render: (v) => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-primary)' }}>{v}</span>,
	},
	{ key: 'date', label: 'Appointment Date', render: (v) => formatDateTime(v) },
	{ key: 'status', label: 'Status', render: (v) => <Badge status={v} /> },
	{
		key: 'actions',
		label: 'Actions',
		render: (_, row) =>
			row.status === 'paid' ? (
				<button
					onClick={() => onRefund(row)}
					disabled={actionLoadingId === row._id}
					title="Refund"
					style={actionBtnStyle('var(--purple-accent)')}
				>
					<RefreshCw size={13} /> Refund
				</button>
			) : (
				<span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>—</span>
			),
	},
];
