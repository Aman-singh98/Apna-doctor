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
// PDF generation happens on the BACKEND now (services/invoicePdfService.js)
// so "Download" produces the real letterhead document — the exact file
// that can later be emailed/sent straight to the patient or doctor,
// instead of a generic client-rendered PDF that looked different from the
// one the business would actually send out.

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Download, Receipt } from 'lucide-react';
import ModalShell from '../common/ModalShell';
import Badge from '../ui/Badge';
import FilterTabs from '../common/FilterTabs';
import { DetailRow, DetailSection } from '../common/DetailDisplay';
import { apiGetPaymentInvoice, apiDownloadPaymentInvoicePdf } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const TABS = ['Patient Receipt', 'Doctor Invoice', 'Admin Invoice'];

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

	const [downloading, setDownloading] = useState(false);

	const handleDownload = async () => {
		if (!invoice) return;
		const fileTag = { patient: 'patient-receipt', doctor: 'doctor-invoice', admin: 'admin-invoice' }[kind];
		setDownloading(true);
		try {
			await apiDownloadPaymentInvoicePdf(paymentId, kind, `${invoice.invoiceNumber}-${fileTag}.pdf`);
		} catch (err) {
			toast.error(err.message || 'Failed to download invoice PDF.');
		} finally {
			setDownloading(false);
		}
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
							<DetailRow
								label={`GST @ ${invoice.amounts.patientGstPct ?? 0}%`}
								value={formatCurrency(invoice.amounts.patientGstAmount ?? 0)}
							/>
							<div style={{ borderTop: '1px dashed var(--border-default)', margin: '6px 0' }} />
							<DetailRow
								label={<strong style={{ color: 'var(--navy-heading)' }}>Total Paid</strong>}
								value={<strong style={{ fontSize: 15, color: 'var(--navy-heading)' }}>{formatCurrency(invoice.amounts.patientGrandTotal ?? invoice.amounts.total)}</strong>}
							/>
							<p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
								Doctor consultations are exempt (0%) healthcare services under GST — see note below.
							</p>
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
							{invoice.amounts.doctorShare != null && (
								<DetailRow
									label={`Less: GST @ ${invoice.amounts.doctorGstPct ?? 18}%`}
									value={<span style={{ color: 'var(--red-error, #b3261e)' }}>{`- ${formatCurrency(invoice.amounts.doctorGstAmount ?? 0)}`}</span>}
								/>
							)}
							<DetailRow label="Payout Status" value={invoice.transaction?.status ? <Badge status={invoice.transaction.status} /> : '—'} />
							<div style={{ borderTop: '1px dashed var(--border-default)', margin: '6px 0' }} />
							<DetailRow
								label={<strong style={{ color: 'var(--navy-heading)' }}>Net Payable to Doctor</strong>}
								value={<strong style={{ fontSize: 15, color: 'var(--navy-heading)' }}>{formatCurrency(invoice.amounts.doctorGrandTotal ?? invoice.amounts.doctorShare)}</strong>}
							/>
							<p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
								18% GST is deducted from the doctor's settlement amount before payout (withheld by the platform, not added on top) — confirm this treatment with your CA before sending real invoices.
							</p>
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

					{kind !== 'admin' && (
						<p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 10 }}>
							GSTIN not yet registered — GST lines are shown for reference only until a valid GSTIN is added (see config/companyConfig.js).
						</p>
					)}

					{/* Download — now fetches the real letterhead PDF from the backend
					    (services/invoicePdfService.js), the same file that can be
					    emailed/sent directly to the patient or doctor. */}
					<button
						onClick={handleDownload}
						disabled={downloading}
						style={{
							marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
							padding: '10px 16px', borderRadius: 8, border: 'none',
							background: 'var(--blue-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700,
							cursor: downloading ? 'default' : 'pointer', opacity: downloading ? 0.7 : 1,
						}}
					>
						{downloading
							? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
							: <Download size={15} />}
						{downloading ? 'Preparing PDF…' : `Download ${tab} (PDF)`}
					</button>
				</motion.div>
			)}
		</ModalShell>
	);
};

export default InvoiceModal;
