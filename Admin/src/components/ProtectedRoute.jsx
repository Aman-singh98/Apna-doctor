// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Wraps admin routes. Redirects to /login if no authenticated session.

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = () => {
   const { admin } = useAuth();
   return admin ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
