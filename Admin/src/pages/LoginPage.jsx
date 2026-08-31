// ─── LoginPage ───────────────────────────────────────────────────────────────
// Enterprise-grade admin login page for Apna Doctor.
// Design: clinical blue on white, split layout — brand left, form right.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, Users, Activity as ActivityStat, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// ── Small animated stat pill shown on the brand panel ────────────────────────
const StatPill = ({ icon: Icon, label, value, delay }) => (
	<motion.div
		initial={{ opacity: 0, x: -16 }}
		animate={{ opacity: 1, x: 0 }}
		transition={{ delay, duration: 0.5 }}
		style={{
			display: 'flex', alignItems: 'center', gap: 10,
			background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
			border: '1px solid rgba(255,255,255,0.20)',
			borderRadius: 10, padding: '10px 16px',
		}}
	>
		<span style={{
			background: 'rgba(255,255,255,0.20)', borderRadius: 8,
			padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
		}}>
			<Icon size={15} color="#fff" />
		</span>
		<div>
			<p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{label}</p>
			<p style={{ fontSize: 15, color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
		</div>
	</motion.div>
);

const LoginPage = () => {
	const { login, loading, error } = useAuth();
	const navigate = useNavigate();

	const [form, setForm] = useState({ email: 'admin@apnadoctor.in', password: 'Admin@123456' });
	const [showPassword, setShowPass] = useState(false);
	const [fieldErrors, setFieldErr] = useState({});

	// ── Field change handler ───────────────────────────────────────────────────
	const handleChange = (e) => {
		const { name, value } = e.target;
		setForm(prev => ({ ...prev, [name]: value }));
		// Clear per-field error on change
		if (fieldErrors[name]) setFieldErr(prev => ({ ...prev, [name]: '' }));
	};

	// ── Client-side validation ─────────────────────────────────────────────────
	const validate = () => {
		const errs = {};
		if (!form.email) errs.email = 'Email is required.';
		else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address.';
		if (!form.password) errs.password = 'Password is required.';
		return errs;
	};

	// ── Submit ─────────────────────────────────────────────────────────────────
	const handleSubmit = async (e) => {
		e.preventDefault();
		const errs = validate();
		if (Object.keys(errs).length) { setFieldErr(errs); return; }
		const result = await login(form.email, form.password);
		if (result.success) navigate('/dashboard');
	};

	return (
		<div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-base)' }}>

			{/* ── Left: Brand Panel ───────────────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.6 }}
				style={{
					flex: '0 0 45%',
					background: 'linear-gradient(145deg, #1557B0 0%, #1A73E8 55%, #4A90E2 100%)',
					display: 'flex', flexDirection: 'column',
					justifyContent: 'space-between', padding: '52px 48px',
					position: 'relative', overflow: 'hidden',
				}}
			>
				{/* Decorative circle accents */}
				<div style={{
					position: 'absolute', top: -80, right: -80,
					width: 280, height: 280, borderRadius: '50%',
					background: 'rgba(255,255,255,0.06)',
				}} />
				<div style={{
					position: 'absolute', bottom: 60, left: -60,
					width: 200, height: 200, borderRadius: '50%',
					background: 'rgba(255,255,255,0.05)',
				}} />

				{/* Logo + brand name */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2, duration: 0.5 }}
					style={{ display: 'flex', alignItems: 'center', gap: 12 }}
				>
					<div style={{
						background: 'rgba(255,255,255,0.20)', borderRadius: 12,
						padding: 8, display: 'flex',
					}}>
						<img
							src="/images/playstore-icon-512.png"
							alt="Apna Doctor logo"
							style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
						/>
					</div>
					<div>
						<p style={{ color: '#fff', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>Apna Doctor</p>
						<p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>Admin Console</p>
					</div>
				</motion.div>

				{/* Headline */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.35, duration: 0.55 }}
				>
					<h1 style={{
						color: '#fff', fontSize: 34, fontWeight: 700, lineHeight: 1.25,
						marginBottom: 14, letterSpacing: '-0.5px',
					}}>
						Managing healthcare,<br />one dashboard at a time.
					</h1>
					<p style={{ color: 'rgba(255,255,255,0.70)', fontSize: 14, lineHeight: 1.7, maxWidth: 340 }}>
						Full control over doctors, patients, appointments, payments, and support — built for speed and clarity.
					</p>
				</motion.div>

				{/* Stat pills */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
					<StatPill icon={Users} label="Active Doctors" value="500+" delay={0.5} />
					<StatPill icon={ActivityStat} label="Patients Served" value="3,000+" delay={0.6} />
					<StatPill icon={FileText} label="Consultations Today" value="124" delay={0.7} />
				</div>
			</motion.div>

			{/* ── Right: Login Form ───────────────────────────────────────────────── */}
			<motion.div
				initial={{ opacity: 0, x: 24 }}
				animate={{ opacity: 1, x: 0 }}
				transition={{ delay: 0.2, duration: 0.5 }}
				style={{
					flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
					background: 'var(--bg-page)', padding: '40px 32px',
				}}
			>
				<div style={{ width: '100%', maxWidth: 400 }}>

					{/* Header */}
					<div style={{ marginBottom: 36 }}>
						<div style={{
							display: 'inline-flex', alignItems: 'center', gap: 6,
							background: 'var(--blue-tint)', color: 'var(--blue-primary)',
							borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
							marginBottom: 16,
						}}>
							<Shield size={13} />
							Secure Admin Access
						</div>
						<h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--navy-heading)', letterSpacing: '-0.3px' }}>
							Sign in to your account
						</h2>
						<p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
							Use your admin credentials to continue.
						</p>
					</div>

					{/* Global API error */}
					<AnimatePresence>
						{error && (
							<motion.div
								key="api-error"
								initial={{ opacity: 0, y: -6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
								style={{
									background: '#FEF2F2', border: '1px solid #FECACA',
									borderRadius: 8, padding: '10px 14px',
									color: '#B91C1C', fontSize: 13, fontWeight: 500,
									marginBottom: 20,
								}}
							>
								{error}
							</motion.div>
						)}
					</AnimatePresence>

					{/* Form */}
					<form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

						{/* Email */}
						<div>
							<label style={labelStyle}>Email address</label>
							<input
								name="email"
								type="email"
								autoComplete="email"
								placeholder="admin@apnadoctor.in"
								value={form.email}
								onChange={handleChange}
								style={{
									...inputStyle,
									borderColor: fieldErrors.email ? '#EF4444' : 'var(--border-default)',
								}}
							/>
							{fieldErrors.email && <p style={errorTextStyle}>{fieldErrors.email}</p>}
						</div>

						{/* Password */}
						<div>
							<label style={labelStyle}>Password</label>
							<div style={{ position: 'relative' }}>
								<input
									name="password"
									type={showPassword ? 'text' : 'password'}
									autoComplete="current-password"
									placeholder="Enter your password"
									value={form.password}
									onChange={handleChange}
									style={{
										...inputStyle,
										paddingRight: 44,
										borderColor: fieldErrors.password ? '#EF4444' : 'var(--border-default)',
									}}
								/>
								{/* Toggle password visibility */}
								<button
									type="button"
									onClick={() => setShowPass(v => !v)}
									aria-label={showPassword ? 'Hide password' : 'Show password'}
									style={{
										position: 'absolute', right: 12, top: '50%',
										transform: 'translateY(-50%)',
										background: 'none', border: 'none', cursor: 'pointer',
										color: 'var(--text-muted)', display: 'flex', padding: 2,
									}}
								>
									{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
								</button>
							</div>
							{fieldErrors.password && <p style={errorTextStyle}>{fieldErrors.password}</p>}
						</div>

						{/* Submit */}
						<motion.button
							type="submit"
							disabled={loading}
							whileTap={{ scale: loading ? 1 : 0.97 }}
							style={{
								width: '100%', padding: '13px 0',
								background: loading
									? 'linear-gradient(90deg, #5A9CF5, #1A73E8)'
									: 'linear-gradient(90deg, #1A73E8, #1557B0)',
								color: '#fff', fontWeight: 600, fontSize: 15,
								border: 'none', borderRadius: 'var(--radius-md)',
								cursor: loading ? 'not-allowed' : 'pointer',
								display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
								boxShadow: '0 4px 14px rgba(26,115,232,0.35)',
								transition: 'box-shadow 0.2s',
								marginTop: 4,
							}}
						>
							{loading
								? <><Spinner /> Signing in…</>
								: 'Sign in'}
						</motion.button>
					</form>

					{/* Hint */}
					<p style={{ textAlign: 'center', color: 'var(--text-placeholder)', fontSize: 12, marginTop: 28 }}>
						Access is restricted to authorised administrators only.
					</p>
				</div>
			</motion.div>
		</div>
	);
};

// ── Inline spinner (no extra dep) ─────────────────────────────────────────────
const Spinner = () => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
		<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
		<circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
		<path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
	</svg>
);

// ── Shared style objects ──────────────────────────────────────────────────────
const labelStyle = {
	display: 'block', fontSize: 13, fontWeight: 600,
	color: 'var(--navy-heading)', marginBottom: 7,
};

const inputStyle = {
	width: '100%', padding: '11px 14px',
	border: '1.5px solid var(--border-default)',
	borderRadius: 'var(--radius-sm)', fontSize: 14,
	color: 'var(--text-body)', background: '#fff',
	outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
	fontFamily: 'var(--font-base)',
};

const errorTextStyle = {
	color: '#EF4444', fontSize: 12, marginTop: 5, fontWeight: 500,
};

export default LoginPage;
