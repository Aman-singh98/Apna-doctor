// ─── components/common/FilterTabs.jsx ──────────────────────────────────────
// Generic pill-style filter tab bar. Reusable across any list page
// (doctors, patients, appointments, …) — just pass the tab labels.

const FilterTabs = ({ tabs, activeTab, onChange }) => (
	<div style={{
		display: 'flex', gap: 6,
		background: 'var(--bg-card)', border: '1px solid var(--border-default)',
		borderRadius: 'var(--radius-sm)', padding: 4,
	}}>
		{tabs.map((tab) => (
			<button
				key={tab}
				onClick={() => onChange(tab)}
				style={{
					padding: '6px 14px', border: 'none', borderRadius: 6,
					fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
					background: activeTab === tab ? 'var(--blue-primary)' : 'transparent',
					color: activeTab === tab ? '#fff' : 'var(--text-muted)',
					transition: 'all 0.15s',
				}}
			>
				{tab}
			</button>
		))}
	</div>
);

export default FilterTabs;