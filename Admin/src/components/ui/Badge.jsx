// ─── Badge ────────────────────────────────────────────────────────────────────
// Status badge pill used in tables across all management pages.

const BADGE_STYLES = {
   active: { bg: '#DCFCE7', color: '#15803D' },
   inactive: { bg: '#F1F5F9', color: '#64748B' },
   pending: { bg: '#FEF9C3', color: '#A16207' },
   verified: { bg: '#DBEAFE', color: '#1D4ED8' },
   suspended: { bg: '#FEE2E2', color: '#B91C1C' },
   rejected: { bg: '#FEE2E2', color: '#B91C1C' },
   resolved: { bg: '#DCFCE7', color: '#15803D' },
   open: { bg: '#FEF9C3', color: '#A16207' },
   completed: { bg: '#DBEAFE', color: '#1D4ED8' },
   cancelled: { bg: '#F1F5F9', color: '#64748B' },
   paid: { bg: '#DCFCE7', color: '#15803D' },
   refunded: { bg: '#FEE2E2', color: '#B91C1C' },
   // Self-service account deletion lifecycle (accountStatus field) — distinct
   // from active/suspended above, which track a different dimension.
   pending_deletion: { bg: '#FFEDD5', color: '#C2410C' },
   deleted: { bg: '#E2E8F0', color: '#334155' },
};

/**
 * @param {string} status  — Must match a key in BADGE_STYLES
 * @param {string} label   — Optional override text; defaults to capitalised status
 */
const Badge = ({ status, label }) => {
   const style = BADGE_STYLES[status?.toLowerCase()] ?? { bg: '#F1F5F9', color: '#64748B' };
   return (
      <span style={{
         display: 'inline-block',
         padding: '3px 10px', borderRadius: 20,
         fontSize: 11.5, fontWeight: 600,
         background: style.bg, color: style.color,
         whiteSpace: 'nowrap',
      }}>
         {label ?? (status.charAt(0).toUpperCase() + status.slice(1))}
      </span>
   );
};

export default Badge;
