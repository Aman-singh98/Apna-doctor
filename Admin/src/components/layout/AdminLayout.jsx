// ─── AdminLayout ─────────────────────────────────────────────────────────────
// Composes the fixed Sidebar, fixed TopBar, and scrollable main content area.
// All authenticated admin pages render inside this layout.

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const AdminLayout = () => (
   <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>

      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main column: topbar + page content */}
      <div style={{
         marginLeft: 'var(--sidebar-width)',
         flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh',
      }}>
         <TopBar />

         {/* Scrollable page content — pushed below the fixed header */}
         <main style={{
            marginTop: 'var(--header-height)',
            padding: '28px 28px',
            flex: 1,
            overflowY: 'auto',
         }}>
            <Outlet />
         </main>
      </div>
   </div>
);

export default AdminLayout;
