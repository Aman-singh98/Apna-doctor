// ─── components/common/ModalShell.jsx ──────────────────────────────────────
// Common overlay + animated card + close button used by every modal in the
// app. Individual modals only need to supply their inner content.

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { MODAL_STYLES } from './modalStyles';

const ModalShell = ({ children, onClose, width = 420, maxHeight, style = {} }) => (
	<div style={MODAL_STYLES.overlay}>
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			style={{
				...MODAL_STYLES.card,
				width,
				...(maxHeight && { maxHeight, overflowY: 'auto' }),
				...style,
			}}
		>
			<button onClick={onClose} style={MODAL_STYLES.closeBtn} aria-label="Close">
				<X size={18} />
			</button>
			{children}
		</motion.div>
	</div>
);

export default ModalShell;
