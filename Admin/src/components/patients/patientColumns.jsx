// ─── components/patients/patientColumns.jsx ────────────────────────────────
// Column config for PatientsPage's Table. Mirrors doctorColumns.js: a view
// (eye icon) action plus a suspend/reactivate action, both using the shared
// ActionButton component.

import { Eye, Ban, CheckCircle } from 'lucide-react';
import ActionButton from '../common/ActionButton';
import Badge from '../ui/Badge';

// dob is stored as "DD-MM-YYYY" text (see models/Patient.js) — parse loosely,
// falling back to '—' if missing or unparseable.
function computeAge(dob) {
   if (!dob) return '—';
   const parts = dob.split('-');
   if (parts.length !== 3) return '—';
   const [day, month, year] = parts.map(Number);
   if (!day || !month || !year) return '—';
   const birth = new Date(year, month - 1, day);
   if (Number.isNaN(birth.getTime())) return '—';
   const diff = Date.now() - birth.getTime();
   const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
   return age >= 0 && age < 130 ? age : '—';
}

function formatDate(iso) {
   if (!iso) return '—';
   return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * @param {string}   actionLoadingId — _id of the patient currently mid-action
 * @param {function} onView          — (row) => void — open PatientDetailModal
 * @param {function} onSuspend       — (row) => void — open ConfirmModal (suspend)
 * @param {function} onReactivate    — (row) => void — open ConfirmModal (unsuspend)
 */
export function getPatientColumns({ actionLoadingId, onView, onSuspend, onReactivate }) {
   return [
      {
         key: 'name', label: 'Patient',
         render: (v, row) => (
            <div>
               <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy-heading)' }}>{v || 'Unnamed'}</p>
               <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Age {computeAge(row.dob)} • {row.phone}</p>
            </div>
         ),
      },
      { key: 'createdAt', label: 'Registered', render: v => formatDate(v) },
      {
         key: 'hasCompletedProfile', label: 'Profile',
         render: v => <Badge status={v ? 'verified' : 'pending'} label={v ? 'Complete' : 'Incomplete'} />,
      },
      { key: 'status', label: 'Status', render: v => <Badge status={v} /> },
      {
         key: 'actions', label: 'Actions',
         render: (_, row) => {
            const isLoading = actionLoadingId === row._id;
            return (
               <div style={{ display: 'flex', gap: 6 }}>
                  <ActionButton
                     icon={Eye}
                     color="var(--blue-primary)"
                     label="View"
                     onClick={() => onView(row)}
                  />
                  {row.status === 'suspended' ? (
                     <ActionButton
                        icon={CheckCircle}
                        color="var(--green-success)"
                        label="Reactivate"
                        onClick={() => onReactivate(row)}
                        disabled={isLoading}
                        spinning={isLoading}
                     />
                  ) : (
                     <ActionButton
                        icon={Ban}
                        color="var(--red-danger)"
                        label="Suspend"
                        onClick={() => onSuspend(row)}
                        disabled={isLoading}
                        spinning={isLoading}
                     />
                  )}
               </div>
            );
         },
      },
   ];
}
