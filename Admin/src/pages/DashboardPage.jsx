// ─── DashboardPage ────────────────────────────────────────────────────────────
// Admin overview: stat cards, revenue area chart, recent appointments table.
// All data is mocked — replace with API calls via react-query + axios.

import { motion } from 'framer-motion';
import { Users, Stethoscope, CalendarCheck, IndianRupee, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';

// ── Mock: revenue trend (last 7 months) ───────────────────────────────────────
const REVENUE_DATA = [
   { month: 'Jan', revenue: 42000 },
   { month: 'Feb', revenue: 55000 },
   { month: 'Mar', revenue: 48000 },
   { month: 'Apr', revenue: 70000 },
   { month: 'May', revenue: 65000 },
   { month: 'Jun', revenue: 82000 },
   { month: 'Jul', revenue: 91000 },
];

// ── Mock: recent appointments ─────────────────────────────────────────────────
const RECENT_APPOINTMENTS = [
   { id: 1, patient: 'Rahul Sharma', doctor: 'Dr. Priya Mehta', type: 'Video', time: 'Today, 10:30 AM', status: 'completed' },
   { id: 2, patient: 'Sunita Yadav', doctor: 'Dr. Amit Sinha', type: 'Audio', time: 'Today, 11:00 AM', status: 'active' },
   { id: 3, patient: 'Vikram Patel', doctor: 'Dr. Neha Joshi', type: 'Chat', time: 'Today, 12:15 PM', status: 'pending' },
   { id: 4, patient: 'Anjali Gupta', doctor: 'Dr. Rajan Pillai', type: 'Video', time: 'Today, 02:00 PM', status: 'completed' },
   { id: 5, patient: 'Mohd. Farrukh', doctor: 'Dr. Kavita Arora', type: 'Video', time: 'Today, 03:45 PM', status: 'cancelled' },
];

// ── Column config for recent appointments table ───────────────────────────────
const APPT_COLUMNS = [
   { key: 'patient', label: 'Patient' },
   { key: 'doctor', label: 'Doctor' },
   { key: 'type', label: 'Type', render: v => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-primary)' }}>{v}</span> },
   { key: 'time', label: 'Time' },
   { key: 'status', label: 'Status', render: v => <Badge status={v} /> },
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

const DashboardPage = () => (
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
         <StatCard label="Total Doctors" value="487" Icon={Stethoscope} accentColor="#1A73E8" trend={+4.2} delay={0.0} />
         <StatCard label="Total Patients" value="2,841" Icon={Users} accentColor="#34A853" trend={+11.5} delay={0.07} />
         <StatCard label="Appointments Today" value="124" Icon={CalendarCheck} accentColor="#FBBC04" trend={-2.1} delay={0.14} />
         <StatCard label="Revenue This Month" value="₹91,400" Icon={IndianRupee} accentColor="#9C27B0" trend={+8.7} delay={0.21} />
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
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monthly earnings overview</p>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--blue-tint)', borderRadius: 20, padding: '4px 10px' }}>
                  <TrendingUp size={13} color="var(--blue-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-primary)' }}>+8.7% MoM</span>
               </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
               <AreaChart data={REVENUE_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
            {[
               { label: 'Pending Verifications', value: '12', color: 'var(--amber-warn)' },
               { label: 'Active Consultations', value: '38', color: 'var(--green-success)' },
               { label: 'Open Support Tickets', value: '7', color: 'var(--red-danger)' },
               { label: 'Refund Requests', value: '3', color: 'var(--purple-accent)' },
               { label: 'New Patients Today', value: '24', color: 'var(--blue-primary)' },
            ].map(({ label, value, color }) => (
               <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 0', borderBottom: '1px solid var(--border-default)',
               }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text-body)' }}>{label}</p>
                  <span style={{ fontWeight: 700, fontSize: 14, color }}>{value}</span>
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
         <Table columns={APPT_COLUMNS} rows={RECENT_APPOINTMENTS} />
      </motion.div>

   </div>
);

export default DashboardPage;
