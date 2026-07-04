// ─── components/common/SearchInput.jsx ─────────────────────────────────────
// Generic search box with a leading icon. Purely controlled — pairs well
// with a debounced fetch effect in the parent (see hooks/useDoctors.js).

import { Search } from 'lucide-react';

const SearchInput = ({ value, onChange, placeholder = 'Search…', width = 220 }) => (
	<div style={{ position: 'relative' }}>
		<Search size={14} style={{
			position: 'absolute', left: 10, top: '50%',
			transform: 'translateY(-50%)', color: 'var(--text-muted)',
		}} />
		<input
			type="search"
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			style={{
				paddingLeft: 30, paddingRight: 12, height: 34, width,
				border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
				fontSize: 13, fontFamily: 'var(--font-base)', outline: 'none',
				background: 'var(--bg-card)', color: 'var(--text-body)',
			}}
		/>
	</div>
);

export default SearchInput;
