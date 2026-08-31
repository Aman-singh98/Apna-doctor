import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { apiGetAppointmentById } from '../../services/api';
import Badge from '../ui/Badge';

const Row = ({ label, value }) => (
	<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
		<span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 12.5 }}>{label}</span>
		<span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-body)' }}>{value ?? '—'}</span>
	</div>
);

const AppointmentDetailModal = ({ appointmentId, onClose }) => {
	const [appointment, setAppointment] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;
		setLoading(true);
		apiGetAppointmentById(appointmentId)
			.then((res) => { if (active) setAppointment(res.appointment); })
			.catch((err) => console.error('Failed to load appointment:', err.message))
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [appointmentId]);

	return (
		<motion.div
			initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
			style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
				style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 420, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}
				onClick={(e) => e.stopPropagation()}
			>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
					<h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-heading)' }}>Appointment Detail</h3>
					<button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
						<X size={18} color="var(--text-muted)" />
					</button>
				</div>

				{loading ? (
					<div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
						<Loader2 size={24} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
						<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
					</div>
				) : !appointment ? (
					<p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Appointment not found.</p>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<Row label="Patient" value={appointment.patientName} />
						<Row label="Phone" value={appointment.patientPhone} />
						<Row label="Doctor" value={appointment.doctor?.name} />
						<Row label="Type" value={appointment.type} />
						<Row
							label="Date & Time"
							value={new Date(appointment.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
						/>
						<Row label="Fee" value={`\u20b9${appointment.fee ?? 0}`} />
						<Row label="Status" value={<Badge status={appointment.status} />} />
						{appointment.diagnosis && <Row label="Diagnosis" value={appointment.diagnosis} />}
						{appointment.cancelReason && <Row label="Cancel Reason" value={appointment.cancelReason} />}
					</div>
				)}
			</motion.div>
		</motion.div>
	);
};

export default AppointmentDetailModal;
