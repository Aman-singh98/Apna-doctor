// ─── Sidebar ─────────────────────────────────────────────────────────────────
// Fixed left sidebar with nav links, active blue pill indicator,
// and bottom logout button. Signature design element of this admin panel.

import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
   LayoutDashboard, Stethoscope, Users, CalendarCheck,
   CreditCard, HeadphonesIcon, BookImage, LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// ── Navigation items mapped to admin modules from PDF scope ──────────────────
const NAV_ITEMS = [
   { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
   { to: '/doctors', label: 'Doctors', Icon: Stethoscope },
   { to: '/patients', label: 'Patients', Icon: Users },
   { to: '/appointments', label: 'Appointments', Icon: CalendarCheck },
   { to: '/payments', label: 'Payments', Icon: CreditCard },
   { to: '/support', label: 'Support', Icon: HeadphonesIcon },
   { to: '/content', label: 'Content', Icon: BookImage },
];

const Sidebar = () => {
   const { admin, logout } = useAuth();
   const navigate = useNavigate();

   const handleLogout = () => {
      logout();
      navigate('/login');
   };

   return (
      <aside style={{
         width: 'var(--sidebar-width)',
         height: '100vh',
         background: 'var(--bg-sidebar)',
         borderRight: '1px solid var(--border-default)',
         display: 'flex', flexDirection: 'column',
         position: 'fixed', top: 0, left: 0, zIndex: 100,
         padding: '0 0 16px',
      }}>

         {/* ── Brand ──────────────────────────────────────────────────────────── */}
         <div style={{
            height: 'var(--header-height)',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 20px',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
         }}>
            <div style={{
               borderRadius: 9,
               padding: 4, display: 'flex',
            }}>
               <img
                  src="/images/playstore-icon-512.png"
                  alt="Apna Doctor logo"
                  style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover' }}
               />
            </div>
            <div>
               <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy-heading)', lineHeight: 1 }}>
                  Apna Doctor
               </p>
               <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Admin Console
               </p>
            </div>
         </div>

         {/* ── Nav Links ──────────────────────────────────────────────────────── */}
         <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
            <p style={{
               fontSize: 10, fontWeight: 600, color: 'var(--text-placeholder)',
               textTransform: 'uppercase', letterSpacing: 1.2,
               padding: '8px 8px 6px',
            }}>
               Main Menu
            </p>

            {NAV_ITEMS.map(({ to, label, Icon }) => (
               <NavLink
                  key={to}
                  to={to}
                  style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
               >
                  {({ isActive }) => (
                     <motion.div
                        initial={false}
                        animate={{
                           background: isActive ? 'var(--blue-tint)' : 'transparent',
                           color: isActive ? 'var(--blue-primary)' : 'var(--text-body)',
                        }}
                        whileHover={{ background: isActive ? 'var(--blue-tint)' : 'var(--bg-page)' }}
                        transition={{ duration: 0.15 }}
                        style={{
                           display: 'flex', alignItems: 'center', gap: 10,
                           padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                           fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                           position: 'relative', cursor: 'pointer',
                        }}
                     >
                        {/* Active left border pill — the signature element */}
                        {isActive && (
                           <motion.div
                              layoutId="active-pill"
                              style={{
                                 position: 'absolute', left: 0, top: '50%',
                                 transform: 'translateY(-50%)',
                                 width: 3, height: 20,
                                 background: 'var(--blue-primary)',
                                 borderRadius: '0 3px 3px 0',
                              }}
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                           />
                        )}
                        <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                        {label}
                     </motion.div>
                  )}
               </NavLink>
            ))}
         </nav>

         {/* ── Admin Profile + Logout ──────────────────────────────────────────── */}
         <div style={{ padding: '0 12px' }}>
            <div style={{
               borderTop: '1px solid var(--border-default)',
               paddingTop: 12, display: 'flex',
               alignItems: 'center', justifyContent: 'space-between',
               gap: 8,
            }}>
               {/* Avatar + info */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                     width: 32, height: 32, borderRadius: '50%',
                     background: 'var(--blue-primary)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                     {admin?.name?.charAt(0) ?? 'A'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                     <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {admin?.name ?? 'Admin'}
                     </p>
                     <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {admin?.email ?? ''}
                     </p>
                  </div>
               </div>

               {/* Logout button */}
               <motion.button
                  whileHover={{ scale: 1.1, color: 'var(--red-danger)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleLogout}
                  aria-label="Sign out"
                  style={{
                     background: 'none', border: 'none', cursor: 'pointer',
                     color: 'var(--text-muted)', display: 'flex',
                     padding: 6, borderRadius: 6,
                     transition: 'color 0.15s',
                     flexShrink: 0,
                  }}
               >
                  <LogOut size={16} />
               </motion.button>
            </div>
         </div>
      </aside>
   );
};

export default Sidebar;
