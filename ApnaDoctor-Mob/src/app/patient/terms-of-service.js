import LegalDocScreen from '../../components/LegalDocScreen';
import { LEGAL_ENTITY, LEGAL_VERSION, PATIENT_TERMS_SECTIONS } from '../../constants/legalContent';

export default function PatientTermsOfServiceScreen() {
   return (
      <LegalDocScreen
         barTitle="Terms of Service"
         docTitle={LEGAL_ENTITY}
         docSubtitle="PATIENT TERMS & CONDITIONS"
         docMeta={LEGAL_VERSION}
         sections={PATIENT_TERMS_SECTIONS}
      />
   );
}
