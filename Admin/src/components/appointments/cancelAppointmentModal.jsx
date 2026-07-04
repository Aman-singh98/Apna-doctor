import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

// Cancellation needs a reason (the backend controller expects one in the
// PATCH /api/admin/appointments/:id/cancel body), so this is a dedicated
// modal rather than the generic ConfirmModal used for suspend/reactivate.
const CancelAppointmentModal = ({ patientName, loading, onClose, onConfirm }) => {
	const [reason, setReason] = useState('');

	const handleConfirm = () => {
		if (!reason.trim() || loading) return;
		onConfirm(reason.trim());
	};

	return (
		<motion.div
			initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
			style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
				style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 420, maxWidth: '100%' }}
				onClick={(e) => e.stopPropagation()}
			>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
					<h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-heading)' }}>
						Cancel appointment for {patientName}?
					</h3>
					<button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
						<X size={18} color="var(--text-muted)" />
					</button>
				</div>

				<p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
					This cancels the appointment. Please give a reason — it's shown to the patient and doctor.
				</p>

				<textarea
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="Reason for cancellation…"
					rows={3}
					autoFocus
					style={{
						width: '100%', resize: 'vertical', padding: 10, boxSizing: 'border-box',
						border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
						fontSize: 13, fontFamily: 'var(--font-base)', outline: 'none',
						background: 'var(--bg-card)', color: 'var(--text-body)', marginBottom: 18,
					}}
				/>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
					<button
						onClick={onClose}
						disabled={loading}
						style={{
							padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--border-default)',
							background: 'none', color: 'var(--text-body)', fontSize: 13, fontWeight: 600,
							cursor: loading ? 'not-allowed' : 'pointer',
						}}
					>
						Back
					</button>
					<button
						onClick={handleConfirm}
						disabled={loading || !reason.trim()}
						style={{
							padding: '8px 16px', borderRadius: 8, border: 'none',
							background: 'var(--red-danger)', color: '#fff', fontSize: 13, fontWeight: 600,
							cursor: loading || !reason.trim() ? 'not-allowed' : 'pointer',
							opacity: loading || !reason.trim() ? 0.6 : 1,
							display: 'flex', alignItems: 'center', gap: 6,
						}}
					>
						{loading && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
						Confirm Cancel
					</button>
				</div>
				<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
			</motion.div>
		</motion.div>
	);
};

export default CancelAppointmentModal;
