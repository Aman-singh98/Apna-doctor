import LegalDocScreen from '../../components/LegalDocScreen';
import { LEGAL_ENTITY, LEGAL_VERSION, PATIENT_PRIVACY_SECTIONS } from '../../constants/legalContent';

export default function PatientPrivacyPolicyScreen() {
   return (
      <LegalDocScreen
         barTitle="Privacy Policy"
         docTitle={LEGAL_ENTITY}
         docSubtitle="PATIENT PRIVACY POLICY"
         docMeta={LEGAL_VERSION}
         sections={PATIENT_PRIVACY_SECTIONS}
      />
   );
}
