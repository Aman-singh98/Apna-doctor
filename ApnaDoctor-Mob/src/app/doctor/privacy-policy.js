import LegalDocScreen from '../../components/LegalDocScreen';
import { LEGAL_ENTITY, LEGAL_VERSION, DOCTOR_PRIVACY_SECTIONS } from '../../constants/legalContent';

export default function DoctorPrivacyPolicyScreen() {
   return (
      <LegalDocScreen
         barTitle="Privacy Policy"
         docTitle={LEGAL_ENTITY}
         docSubtitle="DOCTOR PRIVACY POLICY"
         docMeta={LEGAL_VERSION}
         sections={DOCTOR_PRIVACY_SECTIONS}
      />
   );
}
