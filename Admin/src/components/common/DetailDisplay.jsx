// ─── components/common/DetailDisplay.jsx ───────────────────────────────────
// Presentational building blocks for "detail" modals (doctor detail, patient
// detail, appointment detail, …): a labeled section, a label/value row, and
// a document link row.

import { FileText } from 'lucide-react';

export const DetailSection = ({ label, children }) => (
	<div style={{ marginBottom: 18 }}>
		<p style={{
			fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
			textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
		}}>
			{label}
		</p>
		<div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
	</div>
);

export const DetailRow = ({ icon, label, value }) => (
	<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
		<span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
			{icon}{label}
		</span>
		<span style={{ color: 'var(--text-body)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
	</div>
);

export const DocLink = ({ label, doc }) => (
	<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
		<span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
			<FileText size={13} />{label}
		</span>
		{doc?.url
			? <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-primary)', fontWeight: 600 }}>View</a>
			: <span style={{ color: 'var(--text-muted)' }}>Not uploaded</span>}
	</div>
);