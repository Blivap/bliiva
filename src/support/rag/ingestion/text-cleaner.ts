const PRIVATE_RECORD =
  /\b(national identification number|nin\s*[:=]\s*\d{6,}|passport number\s*[:=]|medical record|diagnosis\s*:|bank verification number)\b/i;

export function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function containsPrivateRecord(value: string): boolean {
  return PRIVATE_RECORD.test(value);
}
