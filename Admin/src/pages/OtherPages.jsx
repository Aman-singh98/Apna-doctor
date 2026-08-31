// ─── Remaining Admin Pages ────────────────────────────────────────────────────
// ContentPage
// Still follows the toolbar + table with mock data pattern.
// Replace the mock array with react-query + axios calls in production.
//
// NOTE: PatientsPage moved to its own file — pages/PatientsPage.jsx — and is
// now wired to the real /api/admin/patients backend instead of mock data.
// Update any `import { PatientsPage } from './OtherPages'` to
// `import PatientsPage from './PatientsPage'` (default export).
//
// NOTE: SupportPage also moved to its own file — pages/SupportPage.jsx —
// wired to the real /admin/tickets backend (see services/api.js) with a
// view/reply/resolve detail modal (components/support/TicketDetailModal.jsx).
// Update any `import { SupportPage } from './OtherPages'` to
// `import SupportPage from './SupportPage'` (default export).
//
// NOTE: AppointmentsPage also moved to its own file — pages/AppointmentsPage.jsx
// — wired to the real /api/admin/appointments backend.
//
// NOTE: PaymentsPage also moved to its own file — pages/PaymentsPage.jsx —
// wired to the real /api/admin/payments backend (an Appointment IS the
// payment record once paid — see Backend/controllers/adminPaymentController.js)
// with a refund action (components/payments/RefundPaymentModal.jsx).
// Update any `import { PaymentsPage } from './OtherPages'` to
// `import PaymentsPage from './PaymentsPage'` (default export).
// The mock AppointmentsPage block below is dead code kept only for
// reference — App.jsx no longer imports it. ContentPage is still mock data
// and still wired up.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Ban, CheckCircle, XCircle } from 'lucide-react';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Toolbar with optional search
const PageToolbar = ({ search, setSearch, placeholder = 'Search…', right }) => (
   <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}
   >
      <div style={{ position: 'relative' }}>
         <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
         <input
            type="search" placeholder={placeholder}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
               paddingLeft: 30, paddingRight: 12, height: 34, width: 220,
               border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
               fontSize: 13, fontFamily: 'var(--font-base)', outline: 'none',
               background: 'var(--bg-card)', color: 'var(--text-body)',
            }}
         />
      </div>
      {right}
   </motion.div>
);

// Small icon+text action button (reused pattern)
const Btn = ({ Icon, color = 'var(--blue-primary)', label, onClick }) => (
   <button onClick={onClick} title={label}
      style={{
         background: 'none', border: `1px solid ${color}22`, borderRadius: 6,
         padding: '4px 8px', cursor: 'pointer',
         display: 'flex', alignItems: 'center', gap: 4,
         color, fontSize: 11.5, fontWeight: 600, transition: 'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = color + '12'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
   >
      <Icon size={13} /> {label}
   </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENTS PAGE
// ─────────────────────────────────────────────────────────────────────────────
const INIT_APPTS = [
   { id: 1, patient: 'Rahul Sharma', doctor: 'Dr. Priya Mehta', type: 'Video', date: '29 Jun 2025, 10:30', fee: '₹500', status: 'completed' },
   { id: 2, patient: 'Sunita Yadav', doctor: 'Dr. Amit Sinha', type: 'Audio', date: '29 Jun 2025, 11:00', fee: '₹350', status: 'active' },
   { id: 3, patient: 'Vikram Patel', doctor: 'Dr. Neha Joshi', type: 'Chat', date: '28 Jun 2025, 15:00', fee: '₹300', status: 'pending' },
   { id: 4, patient: 'Anjali Gupta', doctor: 'Dr. Rajan Pillai', type: 'Video', date: '27 Jun 2025, 09:00', fee: '₹700', status: 'completed' },
   { id: 5, patient: 'Mohd. Farrukh', doctor: 'Dr. Kavita Arora', type: 'Video', date: '26 Jun 2025, 14:30', fee: '₹450', status: 'cancelled' },
];

export const AppointmentsPage = () => {
   const [appts, setAppts] = useState(INIT_APPTS);
   const [search, setSearch] = useState('');

   const cancel = (id) => setAppts(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));

   const visible = appts.filter(a =>
      a.patient.toLowerCase().includes(search.toLowerCase()) ||
      a.doctor.toLowerCase().includes(search.toLowerCase()));

   const COLS = [
      { key: 'patient', label: 'Patient' },
      { key: 'doctor', label: 'Doctor' },
      { key: 'type', label: 'Type', render: v => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-primary)' }}>{v}</span> },
      { key: 'date', label: 'Date & Time' },
      { key: 'fee', label: 'Fee' },
      { key: 'status', label: 'Status', render: v => <Badge status={v} /> },
      {
         key: 'actions', label: 'Actions',
         render: (_, row) => row.status !== 'cancelled' && row.status !== 'completed'
            ? <Btn Icon={XCircle} color="var(--red-danger)" label="Cancel" onClick={() => cancel(row.id)} />
            : <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>—</span>
      },
   ];

   return (
      <div>
         <PageToolbar search={search} setSearch={setSearch} placeholder="Search by patient or doctor…" />
         <Table columns={COLS} rows={visible} emptyMsg="No appointments found." />
      </div>
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT PAGE
// ─────────────────────────────────────────────────────────────────────────────
const BANNERS = [
   { id: 1, title: 'Summer Health Camp', type: 'Banner', target: 'All Users', active: true, created: '01 Jun 2025' },
   { id: 2, title: 'Doctor Onboarding Offer', type: 'Banner', target: 'Doctors', active: false, created: '15 May 2025' },
];

const FAQS = [
   { id: 3, title: 'How to book an appointment?', type: 'FAQ', target: 'Patients', active: true, created: '10 Apr 2025' },
   { id: 4, title: 'How to get verified?', type: 'FAQ', target: 'Doctors', active: true, created: '12 Apr 2025' },
];

export const ContentPage = () => {
   const [content, setContent] = useState([...BANNERS, ...FAQS]);
   const [search, setSearch] = useState('');

   const toggle = (id) => setContent(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));

   const visible = content.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

   const COLS = [
      { key: 'title', label: 'Title', render: v => <span style={{ fontWeight: 600, color: 'var(--navy-heading)' }}>{v}</span> },
      { key: 'type', label: 'Type', render: v => <Badge status={v === 'FAQ' ? 'verified' : 'pending'} label={v} /> },
      { key: 'target', label: 'Target Audience' },
      { key: 'created', label: 'Created' },
      { key: 'active', label: 'Status', render: v => <Badge status={v ? 'active' : 'inactive'} /> },
      {
         key: 'actions', label: 'Actions',
         render: (_, row) => (
            <Btn
               Icon={row.active ? Ban : CheckCircle}
               color={row.active ? 'var(--red-danger)' : 'var(--green-success)'}
               label={row.active ? 'Deactivate' : 'Activate'}
               onClick={() => toggle(row.id)}
            />
         )
      },
   ];

   return (
      <div>
         <PageToolbar search={search} setSearch={setSearch} placeholder="Search content…" />
         <Table columns={COLS} rows={visible} emptyMsg="No content items found." />
      </div>
   );
};
