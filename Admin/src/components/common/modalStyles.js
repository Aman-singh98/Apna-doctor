// ─── components/common/modalStyles.js ──────────────────────────────────────
// Single source of truth for modal look & feel. Any modal in the app
// (ReasonModal, ConfirmModal, detail modals, future ones) pulls from here
// instead of redefining its own inline styles.

export const MODAL_STYLES = {
	overlay: {
		position: 'fixed', inset: 0, zIndex: 1000,
		background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
		display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
	},
	card: {
		background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
		boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '28px 28px 24px',
		width: 420, position: 'relative',
	},
	closeBtn: {
		position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
		cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
	},
	title: { fontSize: 16, fontWeight: 700, color: 'var(--navy-heading)', marginBottom: 6 },
	subtitle: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 },
	textarea: {
		width: '100%', padding: '10px 12px', border: '1.5px solid var(--border-default)',
		borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-base)', fontSize: 13,
		color: 'var(--text-body)', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
		transition: 'border-color 0.15s',
	},
	helperRow: {
		display: 'flex', justifyContent: 'space-between', alignItems: 'center',
		marginTop: 6, fontSize: 11.5,
	},
	footerRow: { display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' },
	cancelBtn: {
		padding: '9px 18px', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
		background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-body)',
	},
	confirmBtn: {
		padding: '9px 18px', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff',
		fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
	},
	iconBadge: {
		width: 40, height: 40, borderRadius: 10, flexShrink: 0,
		display: 'flex', alignItems: 'center', justifyContent: 'center',
	},
	spin: { animation: 'spin 0.8s linear infinite' },
};

export const reasonBannerStyle = (color) => ({
	fontSize: 12.5, color: 'var(--text-body)', background: `${color}11`,
	border: `1px solid ${color}33`, borderRadius: 10, padding: '10px 12px',
	marginBottom: 16, lineHeight: 1.5,
});
