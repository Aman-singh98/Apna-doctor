import LegalDocScreen from '../../components/LegalDocScreen';
import { LEGAL_ENTITY, LEGAL_VERSION, DOCTOR_TERMS_SECTIONS } from '../../constants/legalContent';

export default function DoctorTermsOfServiceScreen() {
   return (
      <LegalDocScreen
         barTitle="Terms of Service"
         docTitle={LEGAL_ENTITY}
         docSubtitle="DOCTOR TERMS & CONDITIONS"
         docMeta={LEGAL_VERSION}
         sections={DOCTOR_TERMS_SECTIONS}
      />
   );
}
