const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s()-]{7,}\d/g;
const MEDICAL =
  /\b(hiv|aids|hepatitis|pregnant|pregnancy|cancer|diabetes|malaria|syphilis|diagnosis|symptom|blood pressure)\b/i;
const LABELED_SECRET =
  /\b(password|otp|one[- ]time code|nin|bvn|access token)\s*[:=]\s*\S+/gi;
const BARE_OTP = /\b(?:otp|code)\b.{0,12}\b([A-Za-z0-9]{6})\b/gi;

export function redactForAnalytics(
  text: string,
  options: { forceRedact?: boolean } = {},
): string | null {
  if (options.forceRedact || MEDICAL.test(text)) return null;
  const cleaned = text
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[phone]')
    .replace(LABELED_SECRET, '$1: [redacted]')
    .replace(BARE_OTP, 'otp: [redacted]')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 180);
}
