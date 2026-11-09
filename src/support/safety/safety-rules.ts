import { normalizeText } from '../intelligence/text/text-normalizer.js';

export interface SafetyAssessment {
  emergency: boolean;
  securityIncident: boolean;
  unauthorizedTransaction: boolean;
  seriousComplaint: boolean;
  personalClinicalDecision: boolean;
  humanRequested: boolean;
  frustrated: boolean;
  /** Illegal / harmful off-platform requests. Redirect quietly; never lecture the user. */
  disallowedTopic: boolean;
  reasons: string[];
}

const EMERGENCY = [
  /\bmedical emergency\b/,
  /\bthis is an emergency\b/,
  /\bneed an ambulance\b/,
  /\bcall an ambulance\b/,
  /\bchest pain\b/,
  /\bcannot breathe\b/,
  /\bheavy bleeding\b/,
  /\bbleeding heavily\b/,
  /\bunresponsive\b/,
  /\bheart attack\b/,
  /\banaphylaxis\b/,
  /\bsevere reaction\b/,
  /\bfainted\b/,
  /\bpassed out\b/,
  /\bdying\b/,
];

const SECURITY = [
  /\baccount (was )?hacked\b/,
  /\bhacked my account\b/,
  /\bsomeone else (logged|login|signin)\b/,
  /\bsuspicious login\b/,
  /\bunauthorized access\b/,
  /\bstolen account\b/,
  /\bdata breach\b/,
  /\bsecurity incident\b/,
];

const UNAUTHORIZED_TRANSACTION = [
  /\bunauthorized (transaction|charge|withdrawal|payment)\b/,
  /\bdid not (make|authorize)\b/,
  /\bcharged without\b/,
  /\bunknown transaction\b/,
  /\bwallet hacked\b/,
  /\bsomeone took (my )?money\b/,
  /\bmoney (is )?missing\b/,
];

const COMPLAINT = [
  /\bfile a complaint\b/,
  /\bi want to complain\b/,
  /\bserious complaint\b/,
  /\bformal complaint\b/,
  /\bthis is unacceptable\b/,
];

const CLINICAL = [
  /\bam i eligible\b/,
  /\bam i fit\b/,
  /\bcan i donate\b/,
  /\bshould i donate\b/,
  /\bdo i qualify\b/,
  /\bmedically fit\b/,
  /\bapprove my eligibility\b/,
  /\bis my blood compatible\b/,
  /\bcompatible with me\b/,
  /\bwhich blood (type )?can i\b/,
  /\bcan i receive\b/,
  /\bapprove (my |the )?hospital\b/,
  /\bverify my hospital\b/,
  /\bdiagnose\b/,
  /\bam i sick\b/,
];

const HUMAN = [
  /\btalk to (a )?(human|person|agent|representative)\b/,
  /\bspeak to (a )?(human|person|agent|representative)\b/,
  /\breal person\b/,
  /\bhuman (agent|support)\b/,
  /\bcustomer service agent\b/,
];

const FRUSTRATION =
  /\b(useless|ridiculous|frustrated|frustrating|angry|worst|not helping|this is terrible)\b/;

const DISALLOWED = [
  /\bblack market\b/,
  /\bdark ?web\b/,
  /\bbuy (drugs|weapons|guns|stolen)\b/,
  /\bsell (drugs|weapons|guns|stolen)\b/,
  /\billegal (drugs|weapons|guns|activity)\b/,
  /\bhow (can|do|to) (i )?(buy|sell|get) .*(drugs|weapons|guns|cocaine|heroin|fentanyl)\b/,
  /\bcounterfeit (money|currency|id|passport)\b/,
  /\bmoney launder/,
  /\bhack (into|someone|their|an? account)\b/,
  /\bstolen (credit )?cards?\b/,
];

function hit(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function inspectMessage(text: string): SafetyAssessment {
  const normalized = normalizeText(text);
  const reasons: string[] = [];
  const emergency = hit(EMERGENCY, normalized);
  const securityIncident = hit(SECURITY, normalized);
  const unauthorizedTransaction = hit(UNAUTHORIZED_TRANSACTION, normalized);
  const seriousComplaint = hit(COMPLAINT, normalized);
  const personalClinicalDecision = hit(CLINICAL, normalized);
  const humanRequested = hit(HUMAN, normalized);
  const frustrated = FRUSTRATION.test(normalized);
  const disallowedTopic = hit(DISALLOWED, normalized);

  if (emergency) reasons.push('medical_emergency');
  if (securityIncident) reasons.push('security_incident');
  if (unauthorizedTransaction) reasons.push('unauthorized_transaction');
  if (seriousComplaint) reasons.push('serious_complaint');
  if (personalClinicalDecision) reasons.push('personal_clinical_decision');
  if (humanRequested) reasons.push('human_requested');
  if (frustrated) reasons.push('frustrated');
  if (disallowedTopic) reasons.push('disallowed_topic');

  return {
    emergency,
    securityIncident,
    unauthorizedTransaction,
    seriousComplaint,
    personalClinicalDecision,
    humanRequested,
    frustrated,
    disallowedTopic,
    reasons,
  };
}
