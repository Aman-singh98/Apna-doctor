// Admin: list payments (an Appointment IS the payment record — see
// Backend/controllers/adminPaymentController.js), view stats, issue refunds.
// Wired to the real backend via services/api.js (/api/admin/payments).
//
// Structured the same way as AppointmentsPage.jsx: data lives in
// usePayments, modal + table chrome live in components/common, payment-
// specific bits live in components/payments. The page just wires it all
// together.
//
// This REPLACES the mock `PaymentsPage` previously exported from
// pages/OtherPages.jsx.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Wallet, CheckCircle2, RefreshCcw, Clock } from 'lucide-react';
import Table from '../components/ui/Table';
import StatCard from '../components/ui/StatCard';
import FilterTabs from '../components/common/FilterTabs';
import SearchInput from '../components/common/SearchInput';
import Pagination from '../components/common/Pagination';
import RefundPaymentModal from '../components/payments/RefundPaymentModal';
import InvoiceModal from '../components/payments/InvoiceModal';
import { getPaymentColumns } from '../components/payments/paymentColumns';
import usePayments from '../hooks/usePayments';
import { formatCurrency } from '../utils/formatters';

const FILTER_TABS = ['All', 'Paid', 'Pending', 'Refunded', 'Failed'];

const PaymentsPage = () => {
	const [tab, setTab] = useState('All');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);

	// { _id, patientName, amount }
	const [refundTarget, setRefundTarget] = useState(null);
	// payment _id currently shown in the invoice modal
	const [invoiceId, setInvoiceId] = useState(null);

	const {
		payments, total, pages, stats, fetchLoading, actionLoading, refundPayment,
	} = usePayments({ tab, search, page });

	// Reset to page 1 whenever the filter or search term changes.
	useEffect(() => { setPage(1); }, [tab, search]);

	const handleConfirmRefund = async (reason) => {
		try {
			await refundPayment(refundTarget._id, reason);
			toast.success('Refund issued successfully.');
			setRefundTarget(null);
		} catch (err) {
			toast.error(err.message || 'Failed to issue refund.');
		}
	};

	const columns = useMemo(() => getPaymentColumns({
		actionLoadingId: actionLoading,
		onRefund: (row) => setRefundTarget({ _id: row._id, patientName: row.patientName || 'this patient', amount: formatCurrency(row.amount) }),
		onViewInvoice: (row) => setInvoiceId(row._id),
	}), [actionLoading]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

			{/* ── Stat cards ──────────────────────────────────────────────────── */}
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
				<StatCard
					label="Total Collected"
					value={stats ? formatCurrency(stats.totalCollected) : '—'}
					Icon={Wallet}
					accentColor="var(--blue-primary)"
					delay={0}
				/>
				<StatCard
					label="Paid"
					value={stats ? stats.paid : '—'}
					Icon={CheckCircle2}
					accentColor="var(--green-success)"
					delay={0.05}
				/>
				<StatCard
					label="Pending"
					value={stats ? stats.pending : '—'}
					Icon={Clock}
					accentColor="#A16207"
					delay={0.1}
				/>
				<StatCard
					label="Refunded"
					value={stats ? stats.refunded : '—'}
					Icon={RefreshCcw}
					accentColor="var(--purple-accent)"
					delay={0.15}
				/>
			</div>

			{/* ── Toolbar ─────────────────────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
				style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
			>
				<FilterTabs tabs={FILTER_TABS} activeTab={tab} onChange={setTab} />
				<SearchInput value={search} onChange={setSearch} placeholder="Search by txn ID, patient or doctor…" />
			</motion.div>

			{/* ── Table ───────────────────────────────────────────────────────── */}
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
				{fetchLoading ? (
					<div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
						<Loader2 size={28} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
						<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
					</div>
				) : (
					<Table columns={columns} rows={payments} emptyMsg="No transactions found." />
				)}
			</motion.div>

			{/* ── Footer: count + pagination ─────────────────────────────────── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
				<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
					Showing {payments.length} of {total} transactions
				</p>
				<Pagination page={page} pages={pages} onPageChange={setPage} />
			</div>

			{/* ── Modals ──────────────────────────────────────────────────────── */}
			<AnimatePresence>
				{refundTarget && (
					<RefundPaymentModal
						key="refund-modal"
						patientName={refundTarget.patientName}
						amount={refundTarget.amount}
						loading={actionLoading === refundTarget._id}
						onClose={() => setRefundTarget(null)}
						onConfirm={handleConfirmRefund}
					/>
				)}
				{invoiceId && (
					<InvoiceModal
						key="invoice-modal"
						paymentId={invoiceId}
						onClose={() => setInvoiceId(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
};

export default PaymentsPage;
