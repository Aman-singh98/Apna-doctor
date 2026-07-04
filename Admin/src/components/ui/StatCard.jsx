// ─── StatCard ─────────────────────────────────────────────────────────────────
// Reusable metric card with a colored top accent border,
// icon, label, value, and optional trend indicator.

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * @param {string}  label        — Metric label
 * @param {string}  value        — Primary metric value
 * @param {object}  Icon         — Lucide icon component
 * @param {string}  accentColor  — Top border + icon bg color (hex)
 * @param {number}  trend        — % change (positive = up, negative = down)
 * @param {string}  trendLabel   — e.g. "vs last month"
 * @param {number}  delay        — Framer motion stagger delay
 */
const StatCard = ({ label, value, Icon, accentColor = 'var(--blue-primary)', trend, trendLabel = 'vs last month', delay = 0 }) => {
  const isPositive = trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        borderTop: `3px solid ${accentColor}`,
        padding: '20px 22px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Icon + label row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </p>
        <div style={{
          background: accentColor + '18',  /* 10% opacity tint */
          borderRadius: 8, padding: 8, display: 'flex',
        }}>
          <Icon size={17} color={accentColor} strokeWidth={2.2} />
        </div>
      </div>

      {/* Value */}
      <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy-heading)', lineHeight: 1 }}>
        {value}
      </p>

      {/* Trend */}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {isPositive
            ? <TrendingUp  size={14} color="var(--green-success)" />
            : <TrendingDown size={14} color="var(--red-danger)" />
          }
          <span style={{ fontSize: 12, fontWeight: 600, color: isPositive ? 'var(--green-success)' : 'var(--red-danger)' }}>
            {isPositive ? '+' : ''}{trend}%
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{trendLabel}</span>
        </div>
      )}
    </motion.div>
  );
};

export default StatCard;
