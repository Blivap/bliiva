export const SUPPORT_CATEGORIES = [
  { slug: 'account_authentication', label: 'Account and authentication' },
  { slug: 'user_profile', label: 'User profile' },
  { slug: 'donor_registration', label: 'Donor registration' },
  { slug: 'donor_eligibility', label: 'Donor eligibility information' },
  { slug: 'blood_donation_process', label: 'Blood donation process' },
  { slug: 'blood_requests', label: 'Blood requests' },
  { slug: 'blood_matching', label: 'Blood matching' },
  { slug: 'hospital_verification', label: 'Hospital verification' },
  { slug: 'wallet_transactions', label: 'Wallet and transactions' },
  { slug: 'notifications', label: 'Notifications' },
  { slug: 'technical_problems', label: 'Technical problems' },
  { slug: 'privacy_security', label: 'Privacy and security' },
  { slug: 'complaints', label: 'Complaints' },
  { slug: 'general_enquiries', label: 'General enquiries' },
  { slug: 'human_support', label: 'Human support' },
] as const;

export const SUPPORT_CATEGORY_SLUGS = SUPPORT_CATEGORIES.map(
  (category) => category.slug,
);

export type SupportCategorySlug = (typeof SUPPORT_CATEGORIES)[number]['slug'];

export const CLINICAL_BOUNDARY_CATEGORIES = new Set<string>([
  'donor_eligibility',
  'blood_matching',
  'hospital_verification',
]);

export function isSupportCategory(value: string): value is SupportCategorySlug {
  return (SUPPORT_CATEGORY_SLUGS as readonly string[]).includes(value);
}
