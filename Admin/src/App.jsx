// ─── App.jsx ──────────────────────────────────────────────────────────────────
// Root component: sets up React Router, Auth provider, toast notifications,
// and wires all admin page routes.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DoctorsPage from './pages/DoctorsPage';
import PatientsPage from './pages/PatientsPage';
import SupportPage from './pages/SupportPage';
import AppointmentsPage from './pages/AppointmentsPage';
import {
	PaymentsPage,
	ContentPage,
} from './pages/OtherPages';

const App = () => (
	<AuthProvider>
		<BrowserRouter>
			<Routes>
				{/* Public route */}
				<Route path="/login" element={<LoginPage />} />

				{/* Protected admin routes — all rendered inside AdminLayout */}
				<Route element={<ProtectedRoute />}>
					<Route element={<AdminLayout />}>
						<Route path="/dashboard" element={<DashboardPage />} />
						<Route path="/doctors" element={<DoctorsPage />} />
						<Route path="/patients" element={<PatientsPage />} />
						<Route path="/appointments" element={<AppointmentsPage />} />
						<Route path="/payments" element={<PaymentsPage />} />
						<Route path="/support" element={<SupportPage />} />
						<Route path="/content" element={<ContentPage />} />
					</Route>
				</Route>

				{/* Default redirect */}
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</BrowserRouter>

		{/* Global toast notifications */}
		<Toaster
			position="top-right"
			toastOptions={{
				style: {
					fontFamily: 'var(--font-base)',
					fontSize: 13,
					borderRadius: 8,
					boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
				},
				success: { iconTheme: { primary: '#34A853', secondary: '#fff' } },
				error: { iconTheme: { primary: '#EA4335', secondary: '#fff' } },
			}}
		/>
	</AuthProvider>
);

export default App;
