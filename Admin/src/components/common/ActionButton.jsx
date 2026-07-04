// ─── components/common/ActionButton.jsx ────────────────────────────────────
// Small icon + label button used inside table action cells across the app
// (doctors, patients, appointments, …).

const ActionButton = ({ icon: Icon, color, label, onClick, disabled, spinning }) => (
	<button
		onClick={onClick}
		disabled={disabled}
		title={label}
		aria-label={label}
		style={{
			background: 'none', border: `1px solid ${color}22`,
			borderRadius: 6, padding: '4px 8px', cursor: disabled ? 'not-allowed' : 'pointer',
			display: 'flex', alignItems: 'center', gap: 4, color,
			fontSize: 11.5, fontWeight: 600,
			opacity: disabled ? 0.6 : 1,
			transition: 'background 0.12s',
		}}
		onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}12`; }}
		onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
	>
		<Icon size={13} style={spinning ? { animation: 'spin 0.8s linear infinite' } : undefined} />
		{label}
	</button>
);

export default ActionButton;
