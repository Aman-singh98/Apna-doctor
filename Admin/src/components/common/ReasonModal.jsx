// ─── components/common/ReasonModal.jsx ─────────────────────────────────────
// Generic "enter a reason before confirming" dialog. Used anywhere an admin
// action requires justification (reject / suspend doctor, reject / ban a
// patient, etc). Validation lives here once, so every caller gets the same
// minimum-length rule for free instead of re-implementing it.

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalShell from './ModalShell';
import { MODAL_STYLES } from './modalStyles';
import { REASON_MIN_LENGTH, validateReason } from '../../utils/validators';

const ReasonModal = ({
	title,
	placeholder,
	onConfirm,
	onClose,
	loading,
	minLength = REASON_MIN_LENGTH,
}) => {
	const [reason, setReason] = useState('');
	const [touched, setTouched] = useState(false);

	const trimmedLength = reason.trim().length;
	const errorMessage = useMemo(() => validateReason(reason, minLength), [reason, minLength]);
	const isValid = errorMessage === null;

	const handleSubmit = () => {
		setTouched(true);
		if (!isValid) {
			toast.error(errorMessage);
			return;
		}
		onConfirm(reason.trim());
	};

	const showError = touched && !isValid;

	return (
		<ModalShell onClose={onClose}>
			<h3 style={MODAL_STYLES.title}>{title}</h3>
			<p style={MODAL_STYLES.subtitle}>This reason will be sent to the doctor via push notification.</p>

			<textarea
				value={reason}
				onChange={(e) => setReason(e.target.value)}
				onBlur={() => setTouched(true)}
				placeholder={placeholder}
				rows={3}
				style={{
					...MODAL_STYLES.textarea,
					borderColor: showError ? 'var(--red-danger)' : 'var(--border-default)',
				}}
			/>

			<div style={MODAL_STYLES.helperRow}>
				<span style={{ color: showError ? 'var(--red-danger)' : 'var(--text-muted)' }}>
					{showError ? errorMessage : `Minimum ${minLength} characters required.`}
				</span>
				<span style={{ color: trimmedLength >= minLength ? 'var(--green-success)' : 'var(--text-muted)' }}>
					{trimmedLength}/{minLength}
				</span>
			</div>

			<div style={MODAL_STYLES.footerRow}>
				<button onClick={onClose} style={MODAL_STYLES.cancelBtn}>Cancel</button>
				<button
					onClick={handleSubmit}
					disabled={loading || (touched && !isValid)}
					style={{
						...MODAL_STYLES.confirmBtn,
						background: 'var(--red-danger)',
						opacity: loading ? 0.7 : 1,
					}}
				>
					{loading && <Loader2 size={13} style={MODAL_STYLES.spin} />}
					Confirm
				</button>
			</div>
		</ModalShell>
	);
};

export default ReasonModal;
