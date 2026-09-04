// ─── Legal document content (shared) ──────────────────────────────────────
// Single source of truth for Terms & Conditions / Privacy Policy copy so the
// signup-time "accept" screens (patient-terms.js, doctor-terms.js) and the
// read-only "view anytime" screens (patient/terms-of-service.js,
// doctor/privacy-policy.js, etc.) never drift out of sync with each other.

export const LEGAL_ENTITY = 'APNA DOCTOR HEALTHCARE LLP';
export const LEGAL_VERSION = 'Version 1.0 · Effective 01/07/2026';

// ── Terms & Conditions ─────────────────────────────────────────────────────

export const PATIENT_TERMS_SECTIONS = [
   {
      title: '1. Acceptance',
      body: 'By registering, booking an appointment, requesting or attending a consultation, uploading records, or using the Platform, you agree to these Terms and all linked policies.',
   },
   {
      title: '2. Legal Framework',
      body: 'These Terms are governed by applicable laws of India, including the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, Telemedicine Practice Guidelines (as amended), applicable National Medical Commission (NMC) regulations, State Medical Council requirements, the Consumer Protection Act, 2019 and other applicable laws.',
   },
   {
      title: '3. Eligibility',
      body: 'Users must provide accurate information, be legally competent, and minors may use the Platform only through a parent or legal guardian.',
   },
   {
      title: '4. Platform Role',
      body: 'Apna Doctor Healthcare LLP provides a technology platform to facilitate telemedicine. Medical advice, diagnosis, prescriptions and treatment remain the sole responsibility of the consulting Registered Medical Practitioner (RMP).',
   },
   {
      title: '5. Telemedicine Services',
      body: 'The Platform may facilitate video, audio and chat consultations, appointments, electronic prescriptions, health records, laboratory booking, medicine fulfilment (where available) and related digital health services.',
   },
   {
      title: '6. Telemedicine Limitations',
      body: 'Telemedicine has inherent limitations. Physical examination may be necessary. Doctors may refuse teleconsultation or advise in-person consultation, emergency care or hospitalization whenever clinically appropriate.',
   },
   {
      title: '7. Medical Emergencies',
      body: 'The Platform is not intended for life-threatening emergencies. Call local emergency services or visit the nearest emergency department immediately.',
   },
   {
      title: '8. Patient Responsibilities',
      body: 'Provide complete and truthful medical information, disclose allergies, pregnancy, chronic illnesses and medicines, follow medical advice responsibly, and do not misuse prescriptions.',
   },
   {
      title: '9. Electronic Prescriptions',
      body: 'Prescriptions are issued only by RMPs in accordance with applicable law. Certain medicines may not be prescribed through teleconsultation or may require video/in-person assessment.',
   },
   {
      title: '10. AI-Assisted Features',
      body: 'AI tools are informational or clinical decision-support tools only and do not replace professional medical judgment.',
   },
   {
      title: '11. Privacy',
      body: 'Personal and health information will be processed in accordance with the Privacy Policy and applicable law.',
   },
   {
      title: '12. Prohibited Conduct',
      body: 'Users shall not impersonate others, upload false information, abuse healthcare professionals, misuse prescriptions, interfere with platform security or use the Platform for unlawful purposes.',
   },
   {
      title: '13. Payments',
      body: 'Fees, refunds and cancellations are governed by the applicable Payment, Refund and Cancellation Policies. No Goods and Services Tax (GST) is currently levied on consultation charges paid by the patient/User; this is subject to change if required by applicable law. Once a consultation or appointment has been completed, the fee paid for that consultation is non-refundable, except as may be expressly provided under the Refund & Cancellation Policy.',
   },
   {
      title: '14. Suspension',
      body: 'Accounts may be suspended or terminated for fraud, false information, policy violations, abuse, security risks or legal requirements.',
   },
   {
      title: '15. Limitation of Liability',
      body: 'Apna Doctor Healthcare LLP is not liable for independent clinical decisions of healthcare professionals, patient-supplied inaccurate information, third-party service failures or circumstances beyond reasonable control.',
   },
   {
      title: '16. Indemnity',
      body: 'Users agree to indemnify the Platform against losses arising from breach of these Terms, misuse of the Platform or unlawful conduct.',
   },
   {
      title: '17. Force Majeure',
      body: 'The Platform shall not be liable for delays or failures caused by events beyond reasonable control.',
   },
   {
      title: '18. Governing Law',
      body: 'These Terms are governed by the laws of India. Jurisdiction shall lie with competent courts where the registered office of Apna Doctor Healthcare LLP is situated unless otherwise required by law.',
   },
   {
      title: '19. Final Decision-Making Authority',
      body: 'In respect of all matters relating to the Platform, including but not limited to doctor allocation, service availability, clinical or administrative disputes, account actions, refunds, and interpretation or application of these Terms and Policies, the decision of Apna Doctor Healthcare LLP shall be final and binding on the patient/User. By using the Platform, the patient/User agrees to accept such decisions without objection.',
   },
   {
      title: '20. Electronic Consent',
      body: 'Electronic acceptance shall have the same legal effect as a handwritten signature, to the extent permitted by applicable law.',
   },
];

export const DOCTOR_TERMS_SECTIONS = [
   {
      title: '1. Acceptance',
      body: 'By registering as a Registered Medical Practitioner (RMP), submitting documents, accepting consultations or using the Platform, you agree to these Terms and all applicable Platform Policies.',
   },
   {
      title: '2. Legal Framework',
      body: 'These Terms are subject to applicable laws of India including the Digital Personal Data Protection Act, 2023, Information Technology Act, 2000, Telemedicine Practice Guidelines (as amended), National Medical Commission (NMC) regulations, applicable State Medical Council regulations, Consumer Protection Act, 2019 and other applicable laws.',
   },
   {
      title: '3. Eligibility',
      body: 'Only duly registered RMPs holding valid registration and legally permitted qualifications may provide consultations through the Platform.',
   },
   {
      title: '4. Verification',
      body: 'Apna Doctor may verify identity, qualifications, registration, experience and supporting documents before approval and may suspend or reject any application.',
   },
   {
      title: '5. Independent Medical Judgment',
      body: 'Doctors remain fully independent in clinical decision-making. Apna Doctor does not influence diagnosis, treatment or prescriptions.',
   },
   {
      title: '6. Telemedicine Compliance',
      body: 'Doctors shall comply with Telemedicine Practice Guidelines, maintain valid registration, prescribe only medicines permitted through teleconsultation and recommend physical examination whenever clinically required.',
   },
   {
      title: '7. Professional Responsibilities',
      body: 'Provide evidence-based care, maintain patient confidentiality, keep profile information updated, protect login credentials and comply with ethical and legal standards.',
   },
   {
      title: '8. Prescriptions',
      body: 'All prescriptions shall be issued solely by the consulting RMP. Restricted medicines may require video consultation or physical examination as required by applicable law.',
   },
   {
      title: '9. AI Decision Support',
      body: 'AI tools are optional decision-support systems only. Doctors remain solely responsible for every diagnosis, investigation, prescription and clinical decision.',
   },
   {
      title: '10. Fees & Settlement',
      body: 'Consultation fees, payment settlement, deductions and taxes shall be governed by the Platform Payment Policy and applicable law. The amount payable to the Doctor is created/calculated after deduction of the Platform Service Fee, applicable Goods and Services Tax (GST) at 18% on such Platform Service Fee, payment gateway charges and applicable Tax Deducted at Source (TDS), as further detailed in the Doctor Partnering Agreement and Payment Policy.',
   },
   {
      title: '11. Privacy & Confidentiality',
      body: 'Doctors shall access patient information only on a need-to-know basis and shall not copy, disclose or misuse patient data except where legally permitted.',
   },
   {
      title: '12. Audit Rights',
      body: 'The Platform may audit consultation records, prescriptions, verification documents and platform activity for quality assurance, fraud prevention and regulatory compliance.',
   },
   {
      title: '13. Suspension & Termination',
      body: 'Accounts may be suspended or terminated for expired registration, misconduct, fraudulent activity, policy violations, patient safety concerns or legal requirements.',
   },
   {
      title: '14. Indemnity',
      body: 'Doctors agree to indemnify the Platform against claims arising from professional negligence, inaccurate information, unlawful conduct or breach of these Terms.',
   },
   {
      title: '15. Limitation of Liability',
      body: 'Apna Doctor Healthcare LLP acts solely as a technology platform and shall not be liable for independent professional acts, omissions or clinical decisions of doctors.',
   },
   {
      title: '16. Force Majeure',
      body: 'The Platform shall not be liable for interruption caused by events beyond reasonable control.',
   },
   {
      title: '17. Governing Law',
      body: 'These Terms are governed by the laws of India. Jurisdiction shall lie with competent courts where the registered office of Apna Doctor Healthcare LLP is situated unless otherwise required by law.',
   },
   {
      title: '18. Final Decision-Making Authority',
      body: 'In respect of all matters relating to the Platform, including but not limited to doctor verification, fee settlement, disputes with patients or the Platform, account actions and interpretation or application of these Terms and Policies, the decision of Apna Doctor Healthcare LLP shall be final and binding on the Doctor. By using the Platform, the Doctor agrees to accept such decisions without objection.',
   },
   {
      title: '19. Electronic Consent',
      body: 'Electronic acceptance shall have the same legal effect as a handwritten signature to the extent permitted by applicable law.',
   },
];

// ── Privacy Policy ─────────────────────────────────────────────────────────

export const PATIENT_PRIVACY_SECTIONS = [
   {
      title: '1. Scope',
      body: 'This Privacy Policy explains how Apna Doctor Healthcare LLP collects, uses, stores, shares and protects the personal and health information of patients/Users who register on, or use, the Platform.',
   },
   {
      title: '2. Legal Framework',
      body: 'Your information is processed in accordance with the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000 and associated rules, Telemedicine Practice Guidelines (as amended), and other applicable Indian data protection and healthcare laws.',
   },
   {
      title: '3. Information We Collect',
      body: 'Identity and contact details (name, phone number, email, address), demographic details (age, gender, date of birth), health information (symptoms, medical history, allergies, vitals, prescriptions, lab reports, uploaded records), payment and transaction details, device and usage data, and information you voluntarily provide during a consultation, chat or call.',
   },
   {
      title: '4. How We Use Your Information',
      body: 'To create and manage your account, connect you with doctors, facilitate consultations and appointments, generate and store electronic prescriptions and records, process payments and refunds, send appointment and health-related notifications, improve the Platform, provide customer support, comply with legal and regulatory obligations, and prevent fraud or misuse.',
   },
   {
      title: '5. Consent',
      body: 'By registering and using the Platform, you consent to the collection and processing of your personal and health information as described in this Policy. You may withdraw consent at any time, subject to legal and contractual restrictions, by contacting our support team; this may limit or end your ability to use certain features.',
   },
   {
      title: '6. Sharing of Information',
      body: 'Your health information is shared only with the consulting Registered Medical Practitioner (RMP) and, where applicable, diagnostic, pharmacy or logistics partners strictly to the extent necessary to provide the requested service. We do not sell your personal or health data. Information may also be shared with payment processors, cloud/hosting providers acting on our instructions, and government or regulatory authorities where required by law.',
   },
   {
      title: '7. Data Storage & Security',
      body: 'Data is stored on secure servers with access controls, encryption in transit, and role-based access restricted to authorized personnel on a need-to-know basis. While we take reasonable technical and organizational measures to protect your information, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
   },
   {
      title: '8. Data Retention',
      body: 'Personal and health information is retained for as long as your account is active and thereafter for the period required to comply with applicable medical record-keeping, tax, and other legal obligations, after which it is securely deleted or anonymized.',
   },
   {
      title: '9. Your Rights',
      body: 'Subject to applicable law, you may access, correct, or request deletion of your personal information, withdraw consent, and request a copy of your health records through the app or by contacting support. Certain records may need to be retained where required by law even after account deletion.',
   },
   {
      title: '10. Children & Minors',
      body: 'The Platform is not intended for use directly by minors. A minor may be registered and consulted for only through a parent or legal guardian, who is responsible for the accuracy of information provided and for supervising the minor\u2019s use of the Platform.',
   },
   {
      title: '11. Cookies & Tracking',
      body: 'The Platform may use cookies, device identifiers and similar technologies to remember preferences, keep you signed in, and understand how the app is used, so that we can improve performance and reliability.',
   },
   {
      title: '12. Third-Party Services',
      body: 'The Platform may integrate with third-party services (such as payment gateways, SMS/notification providers, video/voice infrastructure and analytics tools) that process limited data strictly to perform their function. These providers are contractually required to protect your data and use it only for the agreed purpose.',
   },
   {
      title: '13. Marketing Communications',
      body: 'We may send you appointment, health, and service-related communications. Promotional communications, where sent, will include an option to opt out at any time.',
   },
   {
      title: '14. Data Breach Notification',
      body: 'In the event of a personal data breach that is likely to affect you, we will notify the Data Protection Board of India and affected Users as required under applicable law.',
   },
   {
      title: '15. Changes to this Policy',
      body: 'This Privacy Policy may be updated from time to time to reflect changes in law or our practices. Material changes will be notified through the Platform, and continued use after such notice constitutes acceptance of the updated Policy.',
   },
   {
      title: '16. Grievance & Contact',
      body: 'For any privacy-related questions, requests, or grievances, you may contact our Grievance Officer/support team through the Help & Support section of the app or the contact details published on our website. We aim to acknowledge and address grievances within the timelines prescribed by applicable law.',
   },
];

export const DOCTOR_PRIVACY_SECTIONS = [
   {
      title: '1. Scope',
      body: 'This Privacy Policy explains how Apna Doctor Healthcare LLP collects, uses, stores, shares and protects the personal, professional and financial information of Registered Medical Practitioners (RMPs)/Doctors who register on, or use, the Platform.',
   },
   {
      title: '2. Legal Framework',
      body: 'Your information is processed in accordance with the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000 and associated rules, Telemedicine Practice Guidelines (as amended), applicable NMC/State Medical Council requirements, and other applicable Indian laws.',
   },
   {
      title: '3. Information We Collect',
      body: 'Identity and contact details (name, phone number, email, address), professional credentials (registration number, qualifications, specialization, experience, KYC and verification documents), bank/payout details, availability and schedule information, consultation and prescription records you create, and device and usage data.',
   },
   {
      title: '4. How We Use Your Information',
      body: 'To verify your identity and credentials, list and promote your profile to patients, facilitate consultations, appointments and prescriptions, process fee settlements and payouts, send appointment and platform notifications, provide support, conduct quality and compliance audits, improve the Platform, and comply with legal and regulatory obligations.',
   },
   {
      title: '5. Consent',
      body: 'By registering and using the Platform, you consent to the collection and processing of your personal, professional and financial information as described in this Policy. You may withdraw consent at any time, subject to legal, regulatory and contractual restrictions, by contacting our support team; this may limit or end your ability to use certain features.',
   },
   {
      title: '6. Access to Patient Data',
      body: 'As a Doctor, you will access patient health information strictly on a need-to-know basis for the purpose of providing consultation. You must not copy, download, disclose, or use patient data for any purpose other than the consultation for which it was shared, and must maintain patient confidentiality in accordance with applicable law and professional ethics.',
   },
   {
      title: '7. Sharing of Information',
      body: 'Your professional and verification information may be shared with regulatory bodies (such as the NMC or State Medical Councils) where required, with payment processors and banking partners for payout processing, and with cloud/hosting providers acting on our instructions. We do not sell your personal or professional data.',
   },
   {
      title: '8. Data Storage & Security',
      body: 'Data is stored on secure servers with access controls, encryption in transit, and role-based access restricted to authorized personnel on a need-to-know basis. While we take reasonable technical and organizational measures to protect your information, no method of transmission or storage is completely secure.',
   },
   {
      title: '9. Data Retention',
      body: 'Personal, professional and financial information is retained for as long as your account is active and thereafter for the period required to comply with applicable medical record-keeping, tax, and other legal obligations, after which it is securely deleted or anonymized.',
   },
   {
      title: '10. Your Rights',
      body: 'Subject to applicable law, you may access, correct, or request deletion of your personal information, withdraw consent, and request a copy of records associated with your account through the app or by contacting support. Certain records may need to be retained where required by law even after account deletion.',
   },
   {
      title: '11. Cookies & Tracking',
      body: 'The Platform may use cookies, device identifiers and similar technologies to remember preferences, keep you signed in, and understand how the app is used, so that we can improve performance and reliability.',
   },
   {
      title: '12. Third-Party Services',
      body: 'The Platform may integrate with third-party services (such as payment/payout gateways, SMS/notification providers, video/voice infrastructure and analytics tools) that process limited data strictly to perform their function. These providers are contractually required to protect your data and use it only for the agreed purpose.',
   },
   {
      title: '13. Data Breach Notification',
      body: 'In the event of a personal data breach that is likely to affect you, we will notify the Data Protection Board of India and affected Doctors as required under applicable law.',
   },
   {
      title: '14. Changes to this Policy',
      body: 'This Privacy Policy may be updated from time to time to reflect changes in law or our practices. Material changes will be notified through the Platform, and continued use after such notice constitutes acceptance of the updated Policy.',
   },
   {
      title: '15. Grievance & Contact',
      body: 'For any privacy-related questions, requests, or grievances, you may contact our Grievance Officer/support team through the Help & Support section of the app or the contact details published on our website. We aim to acknowledge and address grievances within the timelines prescribed by applicable law.',
   },
];
