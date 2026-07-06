// Full patient profile view, opened via the eye icon in patientColumns.js.
// Mirrors DoctorDetailModal.jsx: fetches by id on open, uses the shared
// ModalShell + DetailSection/DetailRow building blocks.

import { useEffect, useState } from 'react';
import { Loader2, Phone, Mail, User, Cake, Droplet, Weight, Calendar, ShieldCheck, Trash2 } from 'lucide-react';
import ModalShell from '../common/ModalShell';
import { DetailSection, DetailRow } from '../common/DetailDisplay';
import { MODAL_STYLES } from '../common/modalStyles';
import Badge from '../ui/Badge';
import { apiGetPatientById } from '../../services/api';

function formatDate(iso) {
   if (!iso) return '—';
   return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function deletionLabel(accountStatus) {
   if (accountStatus === 'pending_deletion') return 'Pending Deletion';
   if (accountStatus === 'deleted') return 'Deleted';
   return null;
}

const PatientDetailModal = ({ patientId, onClose }) => {
   const [patient, setPatient] = useState(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState('');

   useEffect(() => {
      let active = true;
      (async () => {
         setLoading(true);
         setError('');
         try {
            const data = await apiGetPatientById(patientId);
            if (active) setPatient(data.patient);
         } catch (err) {
            if (active) setError(err.message || 'Failed to load patient');
         } finally {
            if (active) setLoading(false);
         }
      })();
      return () => { active = false; };
   }, [patientId]);

   return (
      <ModalShell onClose={onClose} width={440} maxHeight="80vh">
         {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
               <Loader2 size={26} color="var(--blue-primary)" style={MODAL_STYLES.spin} />
            </div>
         ) : error ? (
            <p style={{ fontSize: 13, color: 'var(--red-danger)' }}>{error}</p>
         ) : patient ? (
            <>
               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, paddingRight: 24 }}>
                  <div>
                     <h3 style={{ ...MODAL_STYLES.title, marginBottom: 2 }}>{patient.name || 'Unnamed Patient'}</h3>
                     <p style={{ ...MODAL_STYLES.subtitle, marginBottom: 0 }}>{patient.phone}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                     <Badge status={patient.status} />
                     {deletionLabel(patient.accountStatus) && (
                        <Badge status={patient.accountStatus} label={deletionLabel(patient.accountStatus)} />
                     )}
                  </div>
               </div>

               <DetailSection label="Contact">
                  <DetailRow icon={<Phone size={13} />} label="Phone" value={patient.phone} />
                  <DetailRow icon={<Mail size={13} />} label="Email" value={patient.email || '—'} />
               </DetailSection>

               <DetailSection label="Personal">
                  <DetailRow icon={<User size={13} />} label="Gender" value={patient.gender || '—'} />
                  <DetailRow icon={<Cake size={13} />} label="Date of Birth" value={patient.dob || '—'} />
               </DetailSection>

               <DetailSection label="Health">
                  <DetailRow icon={<Droplet size={13} />} label="Blood Group" value={patient.bloodGroup || '—'} />
                  <DetailRow icon={<Weight size={13} />} label="Weight" value={patient.weight ? `${patient.weight} kg` : '—'} />
               </DetailSection>

               <DetailSection label="Account">
                  <DetailRow icon={<Calendar size={13} />} label="Registered" value={formatDate(patient.createdAt)} />
                  <DetailRow icon={<ShieldCheck size={13} />} label="Terms Accepted" value={patient.hasAcceptedTerms ? 'Yes' : 'No'} />
                  <DetailRow label="Profile Complete" value={patient.hasCompletedProfile ? 'Yes' : 'No'} />
               </DetailSection>

               {patient.accountStatus !== 'active' && (
                  <DetailSection label="Account Deletion">
                     <DetailRow
                        icon={<Trash2 size={13} />}
                        label="Status"
                        value={deletionLabel(patient.accountStatus)}
                     />
                     <DetailRow icon={<Calendar size={13} />} label="Requested At" value={formatDate(patient.deletionRequestedAt)} />
                     {patient.accountStatus === 'pending_deletion' && (
                        <DetailRow icon={<Calendar size={13} />} label="Scheduled For" value={formatDate(patient.deletionScheduledAt)} />
                     )}
                     {patient.accountStatus === 'deleted' && (
                        <DetailRow icon={<Calendar size={13} />} label="Deleted At" value={formatDate(patient.deletedAt)} />
                     )}
                  </DetailSection>
               )}
            </>
         ) : null}
      </ModalShell>
   );
};

export default PatientDetailModal;
