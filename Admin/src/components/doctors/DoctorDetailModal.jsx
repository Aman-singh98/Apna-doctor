// ─── components/doctors/DoctorDetailModal.jsx ──────────────────────────────
// Doctor-specific "eye button" detail view. Built entirely from the shared
// ModalShell + DetailDisplay primitives in components/common.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Loader2, Phone, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalShell from '../common/ModalShell';
import Badge from '../ui/Badge';
import { DetailRow, DetailSection, DocLink } from '../common/DetailDisplay';
import { reasonBannerStyle } from '../common/modalStyles';
import { apiGetDoctorById } from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

const DoctorDetailModal = ({ doctorId, onClose }) => {
	const [doctor, setDoctor] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);

		apiGetDoctorById(doctorId)
			.then((data) => { if (!cancelled) setDoctor(data.doctor); })
			.catch((err) => toast.error(err.message || 'Failed to load doctor details.'))
			.finally(() => { if (!cancelled) setLoading(false); });

		return () => { cancelled = true; };
	}, [doctorId]);

	return (
		<ModalShell onClose={onClose} width={560} maxHeight="85vh">
			{loading ? (
				<div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
					<Loader2 size={26} color="var(--blue-primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
				</div>
			) : !doctor ? (
				<p style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Doctor not found.</p>
			) : (
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
					{/* Header */}
					<div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
						<div style={{
							width: 52, height: 52, borderRadius: '50%', background: 'var(--blue-tint)',
							display: 'flex', alignItems: 'center', justifyContent: 'center',
							fontSize: 18, fontWeight: 700, color: 'var(--blue-primary)', overflow: 'hidden', flexShrink: 0,
						}}>
							{doctor.photoUrl
								? <img src={doctor.photoUrl} alt={doctor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
								: (doctor.name || '?').charAt(0).toUpperCase()}
						</div>
						<div style={{ flex: 1 }}>
							<h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy-heading)' }}>
								{doctor.name || `+91 ${doctor.phone}`}
							</h3>
							<p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
								{doctor.specialization || 'No specialization set'}
							</p>
						</div>
						<Badge status={doctor.approvalStatus} />
					</div>

					{/* Reason banner (rejected/suspended) */}
					{doctor.approvalStatus === 'rejected' && doctor.rejectionReason && (
						<div style={reasonBannerStyle('var(--red-danger)')}>
							<strong>Rejection reason:</strong> {doctor.rejectionReason}
						</div>
					)}
					{doctor.approvalStatus === 'suspended' && doctor.suspensionReason && (
						<div style={reasonBannerStyle('var(--amber-warn)')}>
							<strong>Suspension reason:</strong> {doctor.suspensionReason}
						</div>
					)}

					{/* Profile grid */}
					<DetailSection label="Profile">
						<DetailRow icon={<Phone size={13} />} label="Phone" value={`+91 ${doctor.phone}`} />
						<DetailRow label="Qualification" value={doctor.qualification || '—'} />
						<DetailRow label="Reg. Number" value={doctor.regNumber || '—'} />
						<DetailRow label="Hospital" value={doctor.hospital || '—'} />
						<DetailRow label="Experience" value={doctor.experience != null ? `${doctor.experience} yrs` : '—'} />
						<DetailRow icon={<Star size={13} />} label="Rating" value={doctor.rating || 0} />
						<DetailRow label="Bio" value={doctor.bio || '—'} />
					</DetailSection>

					{/* Fees & availability */}
					<DetailSection label="Consultation">
						<DetailRow label="Video Fee" value={`₹${doctor.videoFee ?? 0}`} />
						<DetailRow label="Chat Fee" value={`₹${doctor.chatFee ?? 0}`} />
						<DetailRow label="Currently Online" value={doctor.available ? 'Yes' : 'No'} />
					</DetailSection>

					{/* Schedule */}
					<DetailSection label="Schedule">
						<DetailRow
							icon={<Calendar size={13} />}
							label="Active Days"
							value={doctor.schedule?.activeDays?.length ? doctor.schedule.activeDays.join(', ') : 'Not set'}
						/>
						<DetailRow
							icon={<Clock size={13} />}
							label="Active Slots"
							value={doctor.schedule?.activeSlots?.length ? doctor.schedule.activeSlots.join(', ') : 'Not set'}
						/>
						<DetailRow
							label="Modes"
							value={
								[doctor.schedule?.videoEnabled && 'Video', doctor.schedule?.audioEnabled && 'Audio', doctor.schedule?.chatEnabled && 'Chat']
									.filter(Boolean).join(', ') || 'None enabled'
							}
						/>
						<DetailRow label="Max Patients" value={doctor.schedule?.maxPatients ?? '—'} />
					</DetailSection>

					{/* Documents */}
					<DetailSection label="Verification Documents">
						<DocLink label="Medical License" doc={doctor.documents?.medicalLicense} />
						<DocLink label="ID Proof" doc={doctor.documents?.idProof} />
					</DetailSection>

					{/* Review trail */}
					<DetailSection label="Review History">
						<DetailRow label="Signup Completed" value={formatDateTime(doctor.signupCompletedAt)} />
						<DetailRow label="Approved At" value={formatDateTime(doctor.approvedAt)} />
						<DetailRow
							label="Reviewed By"
							value={doctor.reviewedBy?.name ? `${doctor.reviewedBy.name} (${doctor.reviewedBy.email})` : '—'}
						/>
						<DetailRow label="Reviewed At" value={formatDateTime(doctor.reviewedAt)} />
					</DetailSection>
				</motion.div>
			)}
		</ModalShell>
	);
};

export default DoctorDetailModal;