// ─── AdminLayout ─────────────────────────────────────────────────────────────
// Composes the fixed Sidebar, fixed TopBar, and scrollable main content area.
// All authenticated admin pages render inside this layout.
//
// Mobile (<=900px): the sidebar becomes an off-canvas drawer, toggled by the
// hamburger button in TopBar, with a tap-to-close backdrop behind it.

import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const AdminLayout = () => {
   const [sidebarOpen, setSidebarOpen] = useState(false);
   const { pathname } = useLocation();

   // Close the mobile drawer whenever the route changes
   useEffect(() => {
      setSidebarOpen(false);
   }, [pathname]);

   return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>

         {/* Fixed sidebar (off-canvas drawer on mobile) */}
         <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

         {/* Tap-to-close backdrop, mobile only, shown while drawer is open */}
         <div
            className={`sidebar-backdrop${sidebarOpen ? ' is-visible' : ''}`}
            onClick={() => setSidebarOpen(false)}
         />

         {/* Main column: topbar + page content */}
         <div
            className="admin-main-col"
            style={{
               marginLeft: 'var(--sidebar-width)',
               flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh',
               minWidth: 0,
            }}
         >
            <TopBar onMenuClick={() => setSidebarOpen(open => !open)} />

            {/* Scrollable page content — pushed below the fixed header */}
            <main
               className="admin-main-content"
               style={{
                  marginTop: 'var(--header-height)',
                  padding: '28px 28px',
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
               }}
            >
               <Outlet />
            </main>
         </div>
      </div>
   );
};

export default AdminLayout;
