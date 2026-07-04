// ─── Remaining Admin Pages ────────────────────────────────────────────────────
// AppointmentsPage, PaymentsPage, ContentPage
// All follow the same pattern: toolbar + table with mock data.
// Replace mock arrays with react-query + axios calls in production.
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
// AppointmentsPage, PaymentsPage, ContentPage are still mock data.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Ban, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
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
// PAYMENTS PAGE
// ─────────────────────────────────────────────────────────────────────────────
const INIT_PAYMENTS = [
   { id: 1, txnId: 'TXN001234', patient: 'Rahul Sharma', doctor: 'Dr. Priya Mehta', amount: '₹500', method: 'UPI', date: '29 Jun 2025', status: 'paid' },
   { id: 2, txnId: 'TXN001235', patient: 'Sunita Yadav', doctor: 'Dr. Amit Sinha', amount: '₹350', method: 'Credit Card', date: '29 Jun 2025', status: 'paid' },
   { id: 3, txnId: 'TXN001236', patient: 'Vikram Patel', doctor: 'Dr. Neha Joshi', amount: '₹300', method: 'Net Banking', date: '28 Jun 2025', status: 'refunded' },
   { id: 4, txnId: 'TXN001237', patient: 'Anjali Gupta', doctor: 'Dr. Rajan Pillai', amount: '₹700', method: 'UPI', date: '27 Jun 2025', status: 'paid' },
   { id: 5, txnId: 'TXN001238', patient: 'Mohd. Farrukh', doctor: 'Dr. Kavita Arora', amount: '₹450', method: 'Debit Card', date: '26 Jun 2025', status: 'refunded' },
];

export const PaymentsPage = () => {
   const [payments, setPayments] = useState(INIT_PAYMENTS);
   const [search, setSearch] = useState('');

   const refund = (id) => setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'refunded' } : p));

   const visible = payments.filter(p =>
      p.txnId.toLowerCase().includes(search.toLowerCase()) ||
      p.patient.toLowerCase().includes(search.toLowerCase()));

   const COLS = [
      { key: 'txnId', label: 'Txn ID', render: v => <code style={{ fontSize: 11.5, color: 'var(--blue-primary)', background: 'var(--blue-tint)', borderRadius: 4, padding: '2px 6px' }}>{v}</code> },
      { key: 'patient', label: 'Patient' },
      { key: 'doctor', label: 'Doctor' },
      { key: 'amount', label: 'Amount', render: v => <span style={{ fontWeight: 700, color: 'var(--navy-heading)' }}>{v}</span> },
      { key: 'method', label: 'Method' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status', render: v => <Badge status={v} /> },
      {
         key: 'actions', label: 'Actions',
         render: (_, row) => row.status === 'paid'
            ? <Btn Icon={RefreshCw} color="var(--purple-accent)" label="Refund" onClick={() => refund(row.id)} />
            : <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>—</span>
      },
   ];

   return (
      <div>
         <PageToolbar search={search} setSearch={setSearch} placeholder="Search by txn ID or patient…" />
         <Table columns={COLS} rows={visible} emptyMsg="No transactions found." />
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
