// ─── NotificationBell ────────────────────────────────────────────────────────
// Bell icon + dropdown panel, meant to sit inside TopBar's right section in
// place of the old static bell markup. Owns its own fetching/polling with
// plain useState/useEffect (no react-query) so TopBar doesn't need to know
// anything about notifications.
//
// Backend contract (routes/adminNotificationRoutes.js):
//   GET    /admin/notifications             → Notification[]
//   GET    /admin/notifications/unread-count → { count }
//   PATCH  /admin/notifications/:id/read     → Notification
//   PATCH  /admin/notifications/read-all     → { message }
//   DELETE /admin/notifications/clear        → { message }
//
// Adjust the import path below to wherever api.js actually lives relative
// to this file (assumed here to be src/components/ next to src/services/api.js).

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, Ticket as TicketIcon, CalendarClock, Star, Megaphone } from 'lucide-react';
import {
   apiGetNotifications,
   apiGetUnreadCount,
   apiMarkNotificationRead,
   apiMarkAllNotificationsRead,
   apiClearNotifications,
} from '../../services/api';

// How often to re-poll while the panel is closed vs open. No websocket in
// this system yet, so polling is the mechanism — 30s keeps the badge fresh
// without hammering the API.
const CLOSED_POLL_MS = 30000;
const OPEN_POLL_MS = 15000;

const TYPE_ICON = {
   system: Megaphone,
   appointment: CalendarClock,
   rating: Star,
   ticket: TicketIcon,
};

function timeAgo(dateStr) {
   const diffMs = Date.now() - new Date(dateStr).getTime();
   const mins = Math.floor(diffMs / 60000);
   if (mins < 1) return 'Just now';
   if (mins < 60) return `${mins}m ago`;
   const hrs = Math.floor(mins / 60);
   if (hrs < 24) return `${hrs}h ago`;
   const days = Math.floor(hrs / 24);
   if (days < 7) return `${days}d ago`;
   return new Date(dateStr).toLocaleDateString();
}

const NotificationBell = () => {
   const [open, setOpen] = useState(false);
   const [unreadCount, setUnreadCount] = useState(0);
   const [notifications, setNotifications] = useState([]);
   const [isLoading, setIsLoading] = useState(false);
   const wrapRef = useRef(null);
   const navigate = useNavigate();

   // Unread count polls continuously (badge should stay live even with the
   // panel closed).
   const refetchCount = useCallback(async () => {
      try {
         const data = await apiGetUnreadCount();
         setUnreadCount(data?.count ?? 0);
      } catch {
         // Best-effort — a failed count fetch just leaves the badge stale.
      }
   }, []);

   // The list itself only fetches once the panel is opened — no reason to
   // pay for it on every page load.
   const refetchList = useCallback(async () => {
      setIsLoading(true);
      try {
         const data = await apiGetNotifications({ limit: 20 });
         setNotifications(data ?? []);
      } catch {
         // Best-effort — leave whatever list we already had.
      } finally {
         setIsLoading(false);
      }
   }, []);

   const refetchAll = useCallback(() => {
      refetchCount();
      if (open) refetchList();
   }, [open, refetchCount, refetchList]);

   // Unread count: fetch immediately, then poll on a fixed interval for
   // the lifetime of the component (open or closed).
   useEffect(() => {
      refetchCount();
      const id = setInterval(refetchCount, CLOSED_POLL_MS);
      return () => clearInterval(id);
   }, [refetchCount]);

   // List: fetch when the panel opens, then poll faster while it's open.
   useEffect(() => {
      if (!open) return;
      refetchList();
      const id = setInterval(refetchList, OPEN_POLL_MS);
      return () => clearInterval(id);
   }, [open, refetchList]);

   // Close on outside click.
   useEffect(() => {
      function onClickOutside(e) {
         if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener('mousedown', onClickOutside);
      return () => document.removeEventListener('mousedown', onClickOutside);
   }, []);

   const handleItemClick = async (n) => {
      if (!n.read) {
         try {
            await apiMarkNotificationRead(n._id);
            setNotifications((prev) => prev.map((item) => (item._id === n._id ? { ...item, read: true } : item)));
            refetchCount();
         } catch {
            // Best-effort — a failed mark-as-read shouldn't block navigation.
         }
      }
      // Ticket-related notifications are the only type admins currently
      // receive with a useful place to land — adjust the target route if
      // your support page uses a different path or a ticket-detail param.
      if (n.meta?.ticketId) {
         setOpen(false);
         navigate('/support');
      }
   };

   const handleMarkAllRead = async (e) => {
      e.stopPropagation();
      await apiMarkAllNotificationsRead();
      refetchAll();
   };

   const handleClearAll = async (e) => {
      e.stopPropagation();
      await apiClearNotifications();
      refetchAll();
   };

   return (
      <div ref={wrapRef} style={{ position: 'relative' }}>
         <button
            aria-label="Notifications"
            onClick={() => setOpen((o) => !o)}
            style={{
               background: 'none', border: 'none',
               cursor: 'pointer', color: 'var(--text-muted)',
               display: 'flex', padding: 6, borderRadius: 8,
            }}
         >
            <Bell size={19} />
         </button>

         {unreadCount > 0 && (
            <span style={{
               position: 'absolute', top: 4, right: 4,
               width: 8, height: 8, borderRadius: '50%',
               background: 'var(--red-danger)',
               border: '1.5px solid #fff',
            }} />
         )}

         {open && (
            <div
               role="menu"
               style={{
                  position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                  width: 360, maxHeight: 440, overflowY: 'auto',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
                  zIndex: 100,
               }}
            >
               <div style={{
                  position: 'sticky', top: 0, background: 'var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderBottom: '1px solid var(--border-default)',
               }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-heading)' }}>
                     Notifications
                  </span>
                  {notifications.length > 0 && (
                     <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={handleMarkAllRead} style={linkBtnStyle}>
                           <Check size={12} /> Mark all read
                        </button>
                        <button onClick={handleClearAll} style={linkBtnStyle}>
                           <Trash2 size={12} /> Clear
                        </button>
                     </div>
                  )}
               </div>

               {isLoading && <div style={emptyStyle}>Loading…</div>}

               {!isLoading && notifications.length === 0 && (
                  <div style={emptyStyle}>You're all caught up.</div>
               )}

               {notifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] || Megaphone;
                  return (
                     <button
                        key={n._id}
                        role="menuitem"
                        onClick={() => handleItemClick(n)}
                        style={{
                           display: 'flex', gap: 10, width: '100%',
                           padding: '12px 14px', textAlign: 'left',
                           background: n.read ? 'transparent' : 'var(--bg-page)',
                           border: 'none', borderBottom: '1px solid var(--border-default)',
                           cursor: 'pointer',
                        }}
                     >
                        <div style={{
                           flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           background: 'var(--bg-page)', color: 'var(--navy-heading)',
                        }}>
                           <Icon size={15} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <div style={{
                              fontSize: 13, fontWeight: n.read ? 500 : 700,
                              color: 'var(--navy-heading)',
                           }}>
                              {n.title}
                           </div>
                           <div style={{
                              fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                           }}>
                              {n.desc}
                           </div>
                           <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              {timeAgo(n.createdAt)}
                           </div>
                        </div>
                        {!n.read && (
                           <span style={{
                              flexShrink: 0, width: 7, height: 7, borderRadius: '50%',
                              background: 'var(--red-danger)', marginTop: 5,
                           }} />
                        )}
                     </button>
                  );
               })}
            </div>
         )}
      </div>
   );
};

const linkBtnStyle = {
   display: 'flex', alignItems: 'center', gap: 4,
   background: 'none', border: 'none', cursor: 'pointer',
   fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: 0,
};

const emptyStyle = {
   padding: '30px 14px', textAlign: 'center',
   fontSize: 12.5, color: 'var(--text-muted)',
};

export default NotificationBell;
