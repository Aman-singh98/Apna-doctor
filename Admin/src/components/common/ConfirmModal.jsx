// ─── components/common/ConfirmModal.jsx ────────────────────────────────────
// Generic yes/no confirmation gate (approve, reactivate, delete, etc).
// Fully presentational — all wording and behavior come from props, so it's
// safe to reuse across any page in the app.

import { AlertTriangle, Loader2 } from 'lucide-react';
import ModalShell from './ModalShell';
import { MODAL_STYLES } from './modalStyles';

const ConfirmModal = ({ title, message, confirmLabel, danger, onConfirm, onClose, loading }) => {
	const accentColor = danger ? 'var(--red-danger)' : 'var(--green-success)';

	return (
		<ModalShell onClose={onClose} width={380}>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
				<div style={{ ...MODAL_STYLES.iconBadge, background: `${accentColor}11` }}>
					<AlertTriangle size={20} color={accentColor} />
				</div>
				<div>
					<h3 style={{ ...MODAL_STYLES.title, marginBottom: 4 }}>{title}</h3>
					<p style={{ ...MODAL_STYLES.subtitle, marginBottom: 0 }}>{message}</p>
				</div>
			</div>

			<div style={MODAL_STYLES.footerRow}>
				<button onClick={onClose} style={MODAL_STYLES.cancelBtn}>Cancel</button>
				<button
					onClick={onConfirm}
					disabled={loading}
					style={{ ...MODAL_STYLES.confirmBtn, background: accentColor, opacity: loading ? 0.7 : 1 }}
				>
					{loading && <Loader2 size={13} style={MODAL_STYLES.spin} />}
					{confirmLabel}
				</button>
			</div>
		</ModalShell>
	);
};

export default ConfirmModal;
