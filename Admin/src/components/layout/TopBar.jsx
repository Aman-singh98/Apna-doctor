// ─── TopBar ──────────────────────────────────────────────────────────────────
// Fixed top header: dynamic page title, global search input,
// and notification icon. Sits to the right of the sidebar.

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Menu } from 'lucide-react';
import NotificationBell from './NotificationBell';

// ── Map route paths to human-readable page titles ────────────────────────────
const PAGE_TITLES = {
   '/dashboard': 'Dashboard',
   '/doctors': 'Doctor Management',
   '/patients': 'Patient Management',
   '/appointments': 'Appointment Management',
   '/payments': 'Payment Management',
   '/support': 'Support Management',
   '/content': 'Content Management',
};

const TopBar = ({ onMenuClick }) => {
   const { pathname } = useLocation();
   const [query, setQ] = useState('');

   const title = PAGE_TITLES[pathname] ?? 'Admin Panel';

   return (
      <header
         className="admin-topbar"
         style={{
            position: 'fixed',
            top: 0, left: 'var(--sidebar-width)',
            right: 0, height: 'var(--header-height)',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px', zIndex: 90,
            gap: 16,
         }}
      >

         {/* Left section: hamburger (mobile only) + page title */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
               className="sidebar-hamburger"
               onClick={onMenuClick}
               aria-label="Toggle navigation menu"
               style={{
                  display: 'none', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)', width: 34, height: 34,
                  color: 'var(--navy-heading)', cursor: 'pointer', flexShrink: 0,
               }}
            >
               <Menu size={18} />
            </button>

            <h1 style={{
               fontSize: 16, fontWeight: 700,
               color: 'var(--navy-heading)', whiteSpace: 'nowrap',
               overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
               {title}
            </h1>
         </div>

         {/* Right section: search + bell */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>

            {/* Search input */}
            <div className="topbar-search-box" style={{ position: 'relative' }}>
               <Search
                  size={15}
                  style={{
                     position: 'absolute', left: 11, top: '50%',
                     transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  }}
               />
               <input
                  type="search"
                  placeholder="Search…"
                  value={query}
                  onChange={e => setQ(e.target.value)}
                  style={{
                     paddingLeft: 32, paddingRight: 12,
                     height: 34, width: 'clamp(120px, 30vw, 220px)',
                     boxSizing: 'border-box',
                     border: '1.5px solid var(--border-default)',
                     borderRadius: 'var(--radius-sm)',
                     fontSize: 13, fontFamily: 'var(--font-base)',
                     color: 'var(--text-body)', background: 'var(--bg-page)',
                     outline: 'none',
                  }}
               />
            </div>

            {/* Notification bell */}
            <NotificationBell />
         </div>
      </header>
   );
};

export default TopBar;
