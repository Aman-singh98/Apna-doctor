// ─── components/common/Pagination.jsx ──────────────────────────────────────
// Generic numbered pagination bar. Renders nothing when there's only one
// page, so callers can drop it in unconditionally.

const Pagination = ({ page, pages, onPageChange }) => {
	if (pages <= 1) return null;

	return (
		<div style={{ display: 'flex', gap: 6 }}>
			{Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
				<button
					key={p}
					onClick={() => onPageChange(p)}
					style={{
						width: 30, height: 30, border: '1.5px solid var(--border-default)',
						borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
						background: page === p ? 'var(--blue-primary)' : 'var(--bg-card)',
						color: page === p ? '#fff' : 'var(--text-body)',
					}}
				>
					{p}
				</button>
			))}
		</div>
	);
};

export default Pagination;