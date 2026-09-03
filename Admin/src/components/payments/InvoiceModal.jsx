// ─── components/payments/InvoiceModal.jsx ──────────────────────────────────
// Full invoice viewer for a single payment. Backed by
// GET /api/admin/payments/:id/invoice (controllers/adminPaymentController.js
// → getPaymentInvoice), which stitches the Appointment (patient-facing
// payment) together with its linked Transaction (doctor's share +
// platform's/admin's share — see Backend/models/Transaction.js).
//
// Three tabs, each its own downloadable invoice:
//   - Patient Receipt — what the patient paid, for their records
//   - Doctor Invoice  — the doctor's settlement/earning for this consult
//   - Admin Invoice   — the platform's commission for this consult
//
// PDF generation is done client-side with jsPDF so "Download" produces a
// real .pdf file without needing a backend PDF service.

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Download, Receipt } from 'lucide-react';
import jsPDF from 'jspdf';
import ModalShell from '../common/ModalShell';
import Badge from '../ui/Badge';
import FilterTabs from '../common/FilterTabs';
import { DetailRow, DetailSection } from '../common/DetailDisplay';
import { apiGetPaymentInvoice } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const TABS = ['Patient Receipt', 'Doctor Invoice', 'Admin Invoice'];

// ── PDF builder ──────────────────────────────────────────────────────────────
// One shared layout function, parameterised by which "side" of the invoice
// is being rendered — keeps the three PDFs visually consistent.
function buildInvoicePdf(invoice, kind) {
	const doc = new jsPDF({ unit: 'pt', format: 'a4' });
	const marginX = 48;
	let y = 56;

	const heading = { patient: 'Patient Receipt', doctor: 'Doctor Invoice', admin: 'Admin / Platform Invoice' }[kind];

	// ── Brand header ───────────────────────────────────────────────────────
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(18);
	doc.setTextColor(28, 43, 74); // navy-heading
	doc.text('Apna Doctor', marginX, y);
	doc.setFontSize(11);
	doc.setTextColor(95, 107, 124); // text-muted
	doc.text(heading, marginX, y + 18);

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.text(`Invoice No: ${invoice.invoiceNumber}`, 400, y, { align: 'left' });
	doc.text(`Date: ${formatDateTime(invoice.generatedAt)}`, 400, y + 14, { align: 'left' });
	doc.text(`Status: ${invoice.status?.toUpperCase() || '—'}`, 400, y + 28, { align: 'left' });

	y += 56;
	doc.setDrawColor(228, 233, 240);
	doc.line(marginX, y, 548, y);
	y += 28;

	const row = (label, value) => {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(10.5);
		doc.setTextColor(95, 107, 124);
		doc.text(label, marginX, y);
		doc.setTextColor(28, 43, 74);
		doc.setFont('helvetica', 'bold');
		doc.text(String(value ?? '—'), 548, y, { align: 'right' });
		y += 20;
	};

	const sectionTitle = (title) => {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11.5);
		doc.setTextColor(26, 115, 232); // blue-primary
		doc.text(title, marginX, y);
		y += 18;
	};

	// ── Consultation details (common to all three) ───────────────────────────
	sectionTitle('Consultation');
	row('Consult Type', invoice.consultType);
	row('Appointment Date', formatDateTime(invoice.appointmentDate));
	row('Doctor', invoice.doctor?.name || '—');
	row('Patient', invoice.patient?.name || '—');
	if (invoice.razorpayPaymentId) row('Razorpay Payment ID', invoice.razorpayPaymentId);
	y += 8;

	if (kind === 'patient') {
		sectionTitle('Amount Paid');
		row('Consultation Fee', formatCurrency(invoice.amounts.total));
		doc.setDrawColor(228, 233, 240);
		doc.line(marginX, y, 548, y);
		y += 20;
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(13);
		doc.setTextColor(28, 43, 74);
		doc.text('Total Paid', marginX, y);
		doc.text(formatCurrency(invoice.amounts.total), 548, y, { align: 'right' });
	}

	if (kind === 'doctor') {
		sectionTitle('Earning Breakdown');
		row('Total Consultation Fee', formatCurrency(invoice.amounts.total));
		row(
			`Doctor Share${invoice.amounts.doctorSplitPct != null ? ` (${invoice.amounts.doctorSplitPct}%)` : ''}`,
			formatCurrency(invoice.amounts.doctorShare)
		);
		row('Payout Status', invoice.transaction?.status || 'pending');
		doc.setDrawColor(228, 233, 240);
		doc.line(marginX, y, 548, y);
		y += 20;
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(13);
		doc.setTextColor(28, 43, 74);
		doc.text('Doctor Settlement', marginX, y);
		doc.text(formatCurrency(invoice.amounts.doctorShare), 548, y, { align: 'right' });
	}

	if (kind === 'admin') {
		sectionTitle('Commission Breakdown');
		row('Total Consultation Fee', formatCurrency(invoice.amounts.total));
		row(
			`Platform Share${invoice.amounts.platformSplitPct != null ? ` (${invoice.amounts.platformSplitPct}%)` : ''}`,
			formatCurrency(invoice.amounts.platformShare)
		);
		row('Doctor Category', invoice.doctor?.categoryLabel || '—');
		doc.setDrawColor(228, 233, 240);
		doc.line(marginX, y, 548, y);
		y += 20;
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(13);
		doc.setTextColor(28, 43, 74);
		doc.text('Platform Commission', marginX, y);
		doc.text(formatCurrency(invoice.amounts.platformShare), 548, y, { align: 'right' });
	}

	y += 48;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(154, 165, 180);
	doc.text('This is a system-generated invoice from Apna Doctor Admin Console.', marginX, y);

	return doc;
}

const InvoiceModal = ({ paymentId, onClose }) => {
	const [invoice, setInvoice] = useState(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState('Patient Receipt');

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		apiGetPaymentInvoice(paymentId)
			.then((data) => { if (!cancelled) setInvoice(data.invoice); })
			.catch((err) => toast.error(err.message || 'Failed to load invoice.'))
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [paymentId]);

	const kind = useMemo(() => (
		tab === 'Doctor Invoice' ? 'doctor' : tab === 'Admin Invoice' ? 'admin' : 'patient'
	), [tab]);

	const handleDownload = () => {
		if (!invoice) return;
		const doc = buildInvoicePdf(invoice, kind);
		const fileTag = { patient: 'patient-receipt', doctor: 'doctor-invoice', admin: 'admin-invoice' }[kind];
		doc.save(`${invoice.invoiceNumber}-${fileTag}.pdf`);
	};

	return (
		<ModalShell onClose={onClose} width={600} maxHeight="88vh">
			<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
				<Receipt size={20} color="var(--blue-primary)" />
				<h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy-heading)' }}>Payment Invoice</h3>
			</div>

			{loading ? (
				<div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
					<Loader2 size={26} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
					<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
				</div>
			) : !invoice ? (
				<p style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Invoice not found.</p>
			) : (
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
					{/* Tabs: three separate invoices sharing one record */}
					<div style={{ marginBottom: 16 }}>
						<FilterTabs tabs={TABS} activeTab={tab} onChange={setTab} />
					</div>

					{/* Header strip */}
					<div style={{
						display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
						background: 'var(--blue-soft)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16,
					}}>
						<div>
							<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Invoice No.</p>
							<p style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-heading)' }}>{invoice.invoiceNumber}</p>
						</div>
						<div style={{ textAlign: 'right' }}>
							<p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</p>
							<Badge status={invoice.status} />
						</div>
					</div>

					{/* Consultation details — common to every tab */}
					<DetailSection label="Consultation">
						<DetailRow label="Consult Type" value={invoice.consultType || '—'} />
						<DetailRow label="Appointment Date" value={formatDateTime(invoice.appointmentDate)} />
						<DetailRow label="Doctor" value={invoice.doctor?.name || '—'} />
						<DetailRow label="Patient" value={`${invoice.patient?.name || '—'}${invoice.patient?.bookedFor === 'Family Member' ? ` (${invoice.patient.relation || 'Family Member'})` : ''}`} />
						{invoice.razorpayPaymentId && <DetailRow label="Razorpay Payment ID" value={invoice.razorpayPaymentId} />}
					</DetailSection>

					{/* Patient Receipt tab */}
					{kind === 'patient' && (
						<DetailSection label="Amount Paid">
							<DetailRow label="Consultation Fee" value={formatCurrency(invoice.amounts.total)} />
							<div style={{ borderTop: '1px dashed var(--border-default)', margin: '6px 0' }} />
							<DetailRow
								label={<strong style={{ color: 'var(--navy-heading)' }}>Total Paid</strong>}
								value={<strong style={{ fontSize: 15, color: 'var(--navy-heading)' }}>{formatCurrency(invoice.amounts.total)}</strong>}
							/>
						</DetailSection>
					)}

					{/* Doctor Invoice tab */}
					{kind === 'doctor' && (
						<DetailSection label="Doctor Earning Breakdown">
							<DetailRow label="Total Consultation Fee" value={formatCurrency(invoice.amounts.total)} />
							<DetailRow
								label={`Doctor Share${invoice.amounts.doctorSplitPct != null ? ` (${invoice.amounts.doctorSplitPct}%)` : ''}`}
								value={formatCurrency(invoice.amounts.doctorShare)}
							/>
							<DetailRow label="Payout Status" value={invoice.transaction?.status ? <Badge status={invoice.transaction.status} /> : '—'} />
							<div style={{ borderTop: '1px dashed var(--border-default)', margin: '6px 0' }} />
							<DetailRow
								label={<strong style={{ color: 'var(--navy-heading)' }}>Doctor Settlement</strong>}
								value={<strong style={{ fontSize: 15, color: 'var(--navy-heading)' }}>{formatCurrency(invoice.amounts.doctorShare)}</strong>}
							/>
						</DetailSection>
					)}

					{/* Admin Invoice tab */}
					{kind === 'admin' && (
						<DetailSection label="Platform Commission Breakdown">
							<DetailRow label="Total Consultation Fee" value={formatCurrency(invoice.amounts.total)} />
							<DetailRow
								label={`Platform Share${invoice.amounts.platformSplitPct != null ? ` (${invoice.amounts.platformSplitPct}%)` : ''}`}
								value={formatCurrency(invoice.amounts.platformShare)}
							/>
							<DetailRow label="Doctor Category" value={invoice.doctor?.categoryLabel || '—'} />
							<div style={{ borderTop: '1px dashed var(--border-default)', margin: '6px 0' }} />
							<DetailRow
								label={<strong style={{ color: 'var(--navy-heading)' }}>Platform Commission</strong>}
								value={<strong style={{ fontSize: 15, color: 'var(--navy-heading)' }}>{formatCurrency(invoice.amounts.platformShare)}</strong>}
							/>
						</DetailSection>
					)}

					{(invoice.amounts.doctorShare == null && kind !== 'patient') && (
						<p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: -6, marginBottom: 12 }}>
							No settlement record exists yet for this payment (e.g. doctor payout account wasn't linked at booking time).
						</p>
					)}

					{/* Download */}
					<button
						onClick={handleDownload}
						style={{
							marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
							padding: '10px 16px', borderRadius: 8, border: 'none',
							background: 'var(--blue-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
						}}
					>
						<Download size={15} /> Download {tab} (PDF)
					</button>
				</motion.div>
			)}
		</ModalShell>
	);
};

export default InvoiceModal;
