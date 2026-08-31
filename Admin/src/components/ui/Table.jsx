// ─── Table ────────────────────────────────────────────────────────────────────
// Generic table wrapper used across all management pages.
// Accepts columns config and rows data for clean, consistent rendering.

import { motion } from 'framer-motion';

/**
 * @param {Array<{ key: string, label: string, render?: fn }>} columns
 * @param {Array<object>} rows       — Data rows; each should have a unique `id`
 * @param {boolean}       loading    — Shows skeleton rows when true
 * @param {string}        emptyMsg   — Text shown when no rows
 */
const Table = ({ columns = [], rows = [], loading = false, emptyMsg = 'No records found.' }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-card)',
    overflow: 'hidden',
  }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        {/* ── Header ── */}
        <thead>
          <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-default)' }}>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left', padding: '11px 16px',
                  fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.7,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {loading
            ? /* Skeleton rows */
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '14px 16px' }}>
                      <div style={{
                        height: 12, borderRadius: 6,
                        background: 'linear-gradient(90deg, #E4E9F0 25%, #EEF2F6 50%, #E4E9F0 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.4s infinite',
                        width: `${60 + Math.random() * 30}%`,
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.length === 0
            ? /* Empty state */
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}
                >
                  {emptyMsg}
                </td>
              </tr>
            : /* Data rows */
              rows.map((row, idx) => (
                <motion.tr
                  key={row.id ?? idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{
                    borderBottom: idx < rows.length - 1 ? '1px solid var(--border-default)' : 'none',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-page)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '13px 16px', color: 'var(--text-body)', verticalAlign: 'middle' }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))
          }
        </tbody>
      </table>
    </div>
    {/* Shimmer keyframe */}
    <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
  </div>
);

export default Table;
