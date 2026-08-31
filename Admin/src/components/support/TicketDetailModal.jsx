// ─── components/support/TicketDetailModal.jsx ──────────────────────────────
// View a single ticket, adjust status/priority/assignee, and reply.
// Same content as the old TicketDrawer, now on the shared ModalShell (same
// chrome as DoctorDetailModal/ReasonModal/ConfirmModal) instead of the
// bespoke <Modal> component from OtherPages.jsx.

import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import ModalShell from '../common/ModalShell';
import { MODAL_STYLES } from '../common/modalStyles';
import { apiGetTicketById, apiReplyToTicket, apiUpdateTicket } from '../../services/api';

const PRIORITY_COLORS = { High: '#EA4335', Medium: '#FBBC04', Low: '#34A853' };

const fieldSelectStyle = {
	fontSize: 12.5, fontWeight: 600, padding: '6px 8px', borderRadius: 6,
	border: '1.5px solid var(--border-default)', background: 'var(--bg-card)',
	color: 'var(--text-body)', fontFamily: 'var(--font-base)', cursor: 'pointer',
};

const TicketDetailModal = ({ ticketId, onClose, onChanged }) => {
	const [ticket, setTicket] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [reply, setReply] = useState('');
	const [sending, setSending] = useState(false);
	const [savingField, setSavingField] = useState(null); // 'status' | 'priority' | 'assignedTo' | null

	const load = useCallback(async () => {
		try {
			setError(null);
			const res = await apiGetTicketById(ticketId); // { success, data: ticket }
			setTicket(res.data);
		} catch (err) {
			setError(err.message || 'Failed to load ticket.');
		}
	}, [ticketId]);

	useEffect(() => {
		setLoading(true);
		load().finally(() => setLoading(false));
	}, [load]);

	const handleFieldUpdate = async (field, value) => {
		setSavingField(field);
		try {
			const res = await apiUpdateTicket(ticketId, { [field]: value }); // { success, data: ticket }
			setTicket(res.data);
			onChanged?.(res.data);
		} catch (err) {
			alert(err.message || `Failed to update ${field}.`); // eslint-disable-line no-alert
		} finally {
			setSavingField(null);
		}
	};

	const handleSendReply = async () => {
		if (!reply.trim()) return;
		setSending(true);
		try {
			const res = await apiReplyToTicket(ticketId, reply.trim(), 'Support Team'); // { success, data: ticket }
			setTicket(res.data);
			setReply('');
			onChanged?.(res.data);
		} catch (err) {
			alert(err.message || 'Failed to send reply.'); // eslint-disable-line no-alert
		} finally {
			setSending(false);
		}
	};

	return (
		<ModalShell onClose={onClose} width={560} maxHeight="80vh">
			{loading ? (
				<div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
					Loading ticket…
				</div>
			) : error || !ticket ? (
				<div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--red-danger)', fontSize: 13 }}>
					{error || 'Ticket not found.'}
				</div>
			) : (
				<div>
					{/* Ticket meta */}
					<div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4, paddingRight: 24 }}>
						<code style={{ fontSize: 12, color: 'var(--blue-primary)', background: 'var(--blue-tint)', borderRadius: 4, padding: '2px 6px' }}>
							{ticket.ticketId}
						</code>
						<span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
							Raised by {ticket.patient?.name || ticket.doctor?.name || 'Unknown'} · {ticket.category}
						</span>
					</div>

					<h3 style={{ ...MODAL_STYLES.title, marginTop: 10 }}>{ticket.subject}</h3>
					<p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.5, marginBottom: 16 }}>
						{ticket.description}
					</p>

					{/* Status / Priority / Assignee controls */}
					<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
						<select
							style={fieldSelectStyle}
							value={ticket.status}
							disabled={savingField === 'status'}
							onChange={(e) => handleFieldUpdate('status', e.target.value)}
						>
							{['Open', 'In Progress', 'Resolved'].map((s) => <option key={s} value={s}>{s}</option>)}
						</select>

						<select
							style={{ ...fieldSelectStyle, color: PRIORITY_COLORS[ticket.priority] }}
							value={ticket.priority}
							disabled={savingField === 'priority'}
							onChange={(e) => handleFieldUpdate('priority', e.target.value)}
						>
							{['Low', 'Medium', 'High'].map((p) => <option key={p} value={p}>{p} priority</option>)}
						</select>

						<input
							style={{ ...fieldSelectStyle, cursor: 'text', minWidth: 140 }}
							placeholder="Assign to…"
							defaultValue={ticket.assignedTo}
							disabled={savingField === 'assignedTo'}
							onBlur={(e) => {
								if (e.target.value.trim() !== (ticket.assignedTo || '')) {
									handleFieldUpdate('assignedTo', e.target.value.trim());
								}
							}}
						/>
					</div>

					{/* Reply thread */}
					<div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
						<div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-heading)', marginBottom: 10 }}>
							Conversation
						</div>

						{ticket.replies?.length ? (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
								{ticket.replies.map((r, i) => (
									<div
										key={i}
										style={{
											alignSelf: r.sender === 'admin' ? 'flex-end' : 'flex-start',
											maxWidth: '85%',
											background: r.sender === 'admin' ? 'var(--blue-tint)' : 'var(--bg-page, #f4f6f8)',
											borderRadius: 10, padding: '8px 12px',
										}}
									>
										<div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
											{r.sender === 'admin'
												? (r.senderName || 'Support Team')
												: r.sender === 'doctor'
													? (ticket.doctor?.name || 'Doctor')
													: (ticket.patient?.name || 'Patient')}
										</div>
										<div style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.4 }}>{r.message}</div>
									</div>
								))}
							</div>
						) : (
							<div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>No replies yet.</div>
						)}

						{/* Reply composer */}
						<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
							<textarea
								value={reply}
								onChange={(e) => setReply(e.target.value)}
								placeholder="Type your answer to the patient…"
								rows={2}
								style={{
									flex: 1, resize: 'none', fontSize: 13, fontFamily: 'var(--font-base)',
									border: '1.5px solid var(--border-default)', borderRadius: 8,
									padding: '8px 10px', outline: 'none', color: 'var(--text-body)',
								}}
							/>
							<button
								onClick={handleSendReply}
								disabled={sending || !reply.trim()}
								style={{
									display: 'flex', alignItems: 'center', gap: 6,
									background: 'var(--blue-primary)', color: '#fff', border: 'none',
									borderRadius: 8, padding: '9px 14px', fontSize: 12.5, fontWeight: 600,
									cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer',
									opacity: sending || !reply.trim() ? 0.6 : 1,
								}}
							>
								<Send size={13} /> {sending ? 'Sending…' : 'Send'}
							</button>
						</div>
					</div>
				</div>
			)}
		</ModalShell>
	);
};

export default TicketDetailModal;
