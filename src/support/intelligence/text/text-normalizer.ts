const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bcan't\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bi'm\b/g, 'i am'],
  [/\bdon't\b/g, 'do not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bit's\b/g, 'it is'],
  [/\bthat's\b/g, 'that is'],
  [/\bwhat's\b/g, 'what is'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'],
  [/\bweren't\b/g, 'were not'],
  [/\bi've\b/g, 'i have'],
  [/\bi'll\b/g, 'i will'],
  [/\blet's\b/g, 'let us'],
  [/\bcannot\b/g, 'cannot'],
];

/** Common misspellings seen in support messages. Applied after tokenization. */
export const SPELLING_CORRECTIONS: Record<string, string> = {
  cant: 'cannot',
  loggin: 'login',
  logn: 'login',
  pasword: 'password',
  passwrod: 'password',
  acount: 'account',
  accout: 'account',
  eligable: 'eligible',
  eligiblity: 'eligibility',
  notifcation: 'notification',
  notifactions: 'notifications',
  verifcation: 'verification',
  hospitol: 'hospital',
  hospitl: 'hospital',
  walet: 'wallet',
  walllet: 'wallet',
  doner: 'donor',
  donar: 'donor',
  reciept: 'receipt',
  transction: 'transaction',
  trasaction: 'transaction',
  unauthorised: 'unauthorized',
  compatability: 'compatibility',
  compatable: 'compatible',
  registation: 'registration',
  registraton: 'registration',
  blud: 'blood',
  blod: 'blood',
  emergancy: 'emergency',
  secruity: 'security',
  privcy: 'privacy',
  signin: 'signin',
};

const REWRITES: Array<[RegExp, string]> = [
  [/\blogging in\b/g, 'login'],
  [/\blog in\b/g, 'login'],
  [/\bsigning in\b/g, 'signin'],
  [/\bsigned in\b/g, 'signin'],
  [/\bsign in\b/g, 'signin'],
];

export function normalizeText(input: string): string {
  let text = input.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  text = text.replace(/[’]/g, "'");
  for (const [pattern, replacement] of CONTRACTIONS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/[^a-z0-9+\s]/g, ' ');
  text = text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => SPELLING_CORRECTIONS[token] ?? token)
    .join(' ');
  for (const [pattern, replacement] of REWRITES) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s+/g, ' ').trim();
}

export function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(' ') : [];
}
