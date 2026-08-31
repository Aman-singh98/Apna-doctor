// ─── DashboardPage ────────────────────────────────────────────────────────────
// Admin overview: stat cards, revenue area chart, recent appointments table.
// Backed by GET /api/admin/dashboard via useDashboard — see hooks/useDashboard.js.

import { motion } from 'framer-motion';
import { Users, Stethoscope, CalendarCheck, IndianRupee } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import useDashboard from '../hooks/useDashboard';
import { formatDateTime } from '../utils/formatters';

// ── Column config for recent appointments table ───────────────────────────────
const APPT_COLUMNS = [
   { key: 'patient', label: 'Patient' },
   { key: 'doctor', label: 'Doctor' },
   { key: 'type', label: 'Type', render: v => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-primary)' }}>{v}</span> },
   { key: 'time', label: 'Time', render: v => formatDateTime(v) },
   { key: 'status', label: 'Status', render: v => <Badge status={v} /> },
];

// ── Quick-stat row config: label + which quickStats key + accent color ────────
const QUICK_STAT_ROWS = [
   { key: 'pendingVerifications', label: 'Pending Verifications', color: 'var(--amber-warn)' },
   { key: 'activeConsultations', label: 'Active Consultations', color: 'var(--green-success)' },
   { key: 'openSupportTickets', label: 'Open Support Tickets', color: 'var(--red-danger)' },
   { key: 'refundRequests', label: 'Refund Requests', color: 'var(--purple-accent)' },
   { key: 'newPatientsToday', label: 'New Patients Today', color: 'var(--blue-primary)' },
];

// ── Custom tooltip for the recharts area chart ────────────────────────────────
const RevenueTooltip = ({ active, payload, label }) => {
   if (!active || !payload?.length) return null;
   return (
      <div style={{
         background: '#1C2B4A', border: 'none',
         borderRadius: 8, padding: '8px 14px',
         boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
         <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>{label}</p>
         <p style={{ fontSize: 15, color: '#fff', fontWeight: 700 }}>
            ₹{payload[0].value.toLocaleString('en-IN')}
         </p>
      </div>
   );
};

const DashboardPage = () => {
   const { stats, revenueTrend, quickStats, recentAppointments, loading } = useDashboard();

   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

         {/* ── Greeting ──────────────────────────────────────────────────────────── */}
         <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-heading)' }}>Good morning, Admin 👋</h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 3 }}>
               Here's what's happening on Apna Doctor today.
            </p>
         </motion.div>

         {/* ── Stat Cards ────────────────────────────────────────────────────────── */}
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            <StatCard label="Total Doctors" value={loading ? '—' : stats.totalDoctors.toLocaleString('en-IN')} Icon={Stethoscope} accentColor="#1A73E8" delay={0.0} />
            <StatCard label="Total Patients" value={loading ? '—' : stats.totalPatients.toLocaleString('en-IN')} Icon={Users} accentColor="#34A853" delay={0.07} />
            <StatCard label="Appointments Today" value={loading ? '—' : stats.appointmentsToday.toLocaleString('en-IN')} Icon={CalendarCheck} accentColor="#FBBC04" delay={0.14} />
            <StatCard label="Revenue This Month" value={loading ? '—' : `₹${stats.revenueThisMonth.toLocaleString('en-IN')}`} Icon={IndianRupee} accentColor="#9C27B0" delay={0.21} />
         </div>

         {/* ── Revenue Chart + Quick Stats ───────────────────────────────────────── */}
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>

            {/* Area chart */}
            <motion.div
               initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}
               style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', padding: '20px 22px',
               }}
            >
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                     <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy-heading)' }}>Revenue Trend</p>
                     <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monthly earnings overview (last 7 months)</p>
                  </div>
               </div>
               <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                     <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="10%" stopColor="#1A73E8" stopOpacity={0.15} />
                           <stop offset="95%" stopColor="#1A73E8" stopOpacity={0} />
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#E4E9F0" vertical={false} />
                     <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5F6B7C' }} axisLine={false} tickLine={false} />
                     <YAxis tick={{ fontSize: 11, fill: '#9AA5B4' }} axisLine={false} tickLine={false}
                        tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                     <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#1A73E8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                     <Area type="monotone" dataKey="revenue" stroke="#1A73E8" strokeWidth={2.5}
                        fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: '#1A73E8' }} />
                  </AreaChart>
               </ResponsiveContainer>
            </motion.div>

            {/* Quick stat list */}
            <motion.div
               initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.4 }}
               style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', padding: '20px 22px',
                  display: 'flex', flexDirection: 'column', gap: 0,
               }}
            >
               <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy-heading)', marginBottom: 16 }}>Quick Stats</p>
               {QUICK_STAT_ROWS.map(({ key, label, color }) => (
                  <div key={key} style={{
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                     padding: '11px 0', borderBottom: '1px solid var(--border-default)',
                  }}>
                     <p style={{ fontSize: 12.5, color: 'var(--text-body)' }}>{label}</p>
                     <span style={{ fontWeight: 700, fontSize: 14, color }}>{loading ? '—' : quickStats[key]}</span>
                  </div>
               ))}
            </motion.div>
         </div>

         {/* ── Recent Appointments Table ──────────────────────────────────────────── */}
         <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
               <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-heading)' }}>Recent Appointments</p>
               <a href="/appointments" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--blue-primary)', textDecoration: 'none' }}>
                  View all →
               </a>
            </div>
            <Table columns={APPT_COLUMNS} rows={recentAppointments} loading={loading} />
         </motion.div>

      </div>
   );
};

export default DashboardPage;
