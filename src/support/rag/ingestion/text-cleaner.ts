const PRIVATE_RECORD =
  /\b(national identification number|nin\s*[:=]\s*\d{6,}|passport number\s*[:=]|medical record|diagnosis\s*:|bank verification number)\b/i;

function stripControlChars(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    // Drop C0 controls except TAB (9), LF (10), and CR (13).
    out += code <= 31 && code !== 9 && code !== 10 && code !== 13 ? ' ' : char;
  }
  return out;
}

export function cleanText(value: string): string {
  return stripControlChars(value.replace(/<[^>]+>/g, ' '))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function containsPrivateRecord(value: string): boolean {
  return PRIVATE_RECORD.test(value);
}
