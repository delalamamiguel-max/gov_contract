import type { AgencyProfile } from '@/lib/profile';

// ---------------------------------------------------------------------------
// Opportunity-specific Proposal Readiness Checklist.
//
// Deterministic: derives item status from the agency profile (proposalReadiness,
// certifications, insurance) and the opportunity (set-aside, digital scope,
// media buying, multilingual). Conditional items are added only when the scope
// requires them. Grouped by Eligibility, Proposal documents, Compliance,
// Portfolio/past performance, Pricing/readiness, and Submission steps.
// ---------------------------------------------------------------------------

export type ItemStatus = 'have' | 'missing' | 'verify' | 'required';

export interface ChecklistItem {
  label: string;
  status: ItemStatus;
  detail?: string;
}

export interface ChecklistGroup {
  name: string;
  items: ChecklistItem[];
}

export interface ProposalChecklist {
  groups: ChecklistGroup[];
  requiredDocuments: string[];
  recommendedSteps: string[];
  summary: { have: number; missing: number; verify: number; required: number; percentReady: number };
}

export interface ChecklistOpportunity {
  title: string;
  description?: string | null;
  setAsideType?: string | null;
  estimatedValue?: number | null;
  responseDeadline?: string | null;
}

const has = (list: string[] | undefined, re: RegExp) => (list || []).some((x) => re.test(x));

export function computeChecklist(opp: ChecklistOpportunity, profile: AgencyProfile): ProposalChecklist {
  const hay = `${opp.title} ${opp.description || ''}`.toLowerCase();
  const readiness = profile.proposalReadiness || [];
  const certs = profile.certifications || [];
  const insurance = profile.insurance || [];

  // Scope detection for conditional items
  const isDigital = ['website', 'web ', 'web design', 'web development', 'seo', 'digital', 'data', 'analytics', 'ux', 'ui'].some((d) => hay.includes(d));
  const isMediaBuying = ['media buy', 'media planning', 'paid media', 'paid search', 'paid social', 'advertising buy', 'ad placement'].some((d) => hay.includes(d));
  const isMultilingual = ['translation', 'localization', 'multilingual', 'bilingual', 'multicultural', 'spanish'].some((d) => hay.includes(d));
  const setAside = (opp.setAsideType || '').toLowerCase();
  const isSetAside = setAside && setAside !== 'no set aside used' && setAside !== 'none';

  // Helper to build a have/missing item from the readiness list
  const fromReadiness = (label: string, re: RegExp, missingDetail?: string): ChecklistItem =>
    has(readiness, re) ? { label, status: 'have' } : { label, status: 'missing', detail: missingDetail };

  // 1) ELIGIBILITY
  const eligibility: ChecklistItem[] = [];
  if (isSetAside) {
    const required =
      /wosb|women/.test(setAside) ? 'women-owned' :
      /sdvosb|vosb|veteran/.test(setAside) ? 'veteran-owned' :
      /hubzone/.test(setAside) ? 'HUBZone' :
      /8\(a\)|minority/.test(setAside) ? 'minority/8(a)' :
      /\bdbe\b/.test(setAside) ? 'DBE' :
      /small business|sba/.test(setAside) ? 'small business' : 'required';
    const holds =
      (required === 'women-owned' && has(certs, /women/i)) ||
      (required === 'veteran-owned' && has(certs, /veteran/i)) ||
      (required === 'HUBZone' && has(certs, /hubzone/i)) ||
      (required === 'minority/8(a)' && has(certs, /minority|8\(a\)|mbe/i)) ||
      (required === 'DBE' && has(certs, /dbe/i)) ||
      (required === 'small business' && has(certs, /small business/i));
    eligibility.push(
      holds
        ? { label: `${required} certification`, status: 'have', detail: `Matches the ${opp.setAsideType} set-aside` }
        : { label: `${required} certification`, status: 'required', detail: `This set-aside (${opp.setAsideType}) requires it` }
    );
  } else {
    eligibility.push({ label: 'Open competition (no set-aside)', status: 'have' });
  }
  eligibility.push({ label: 'Prime / subcontractor eligibility', status: profile.role ? 'have' : 'verify', detail: profile.role ? `You pursue as: ${profile.role}` : 'Confirm whether you can bid as prime or must team' });
  eligibility.push({ label: 'Active SAM.gov registration', status: 'verify', detail: 'Required to receive federal awards — confirm it is current' });
  eligibility.push({ label: 'Within service area / remote-eligible', status: profile.location ? 'verify' : 'missing', detail: 'Confirm you can perform where required' });

  // 2) PROPOSAL DOCUMENTS
  const proposalDocs: ChecklistItem[] = [
    fromReadiness('Capability statement', /capability/i, 'Create a 1–2 page capability statement'),
    fromReadiness('Proposal template', /proposal template/i, 'Prepare a reusable proposal template'),
    { label: 'Project timeline', status: 'missing', detail: 'Draft a delivery timeline for this scope' },
    { label: 'Staffing plan', status: profile.teamSize ? 'verify' : 'missing', detail: profile.teamSize ? `Confirm staffing for a ${profile.teamSize} team` : 'Outline the team and roles' },
  ];
  if (isDigital) proposalDocs.push({ label: 'Technical approach', status: 'required', detail: 'Web/digital scope — describe your technical methodology' });

  // 3) COMPLIANCE
  const compliance: ChecklistItem[] = [
    fromReadiness('W-9', /w-?9/i, 'Have a current W-9 ready'),
    { label: 'Insurance certificate (general liability)', status: has(insurance, /general/i) ? 'have' : 'missing', detail: has(insurance, /general/i) ? undefined : 'General liability is typically required' },
  ];
  if (isDigital) compliance.push({ label: 'Professional liability / E&O / cyber', status: has(insurance, /e&o|professional|cyber/i) ? 'have' : 'required', detail: 'Often required for web/data work' });
  compliance.push({ label: 'Reps & certifications / required forms', status: 'verify', detail: 'Confirm the solicitation’s required certifications and forms' });

  // 4) PORTFOLIO / PAST PERFORMANCE
  const portfolio: ChecklistItem[] = [
    fromReadiness('Relevant case studies', /case stud/i, 'Gather case studies relevant to this buyer/scope'),
    fromReadiness('Portfolio samples', /portfolio/i, 'Assemble portfolio samples'),
    fromReadiness('Creative samples', /sample creative|creative work/i, 'Pull creative samples for this scope'),
    fromReadiness('References', /reference/i, 'Line up 2–3 references'),
    { label: 'Past performance narratives', status: profile.priorGovExperience === 'yes' ? 'verify' : 'missing', detail: profile.priorGovExperience === 'yes' ? 'Write up relevant public-sector engagements' : 'No prior gov experience on file' },
  ];
  if (isDigital) portfolio.push({ label: 'Website examples', status: 'required', detail: 'Show live sites you have built' });
  if (hay.includes('campaign')) portfolio.push({ label: 'Campaign examples', status: 'required', detail: 'Provide comparable campaign results' });

  // 5) PRICING / READINESS
  const pricing: ChecklistItem[] = [
    fromReadiness('Rate card or pricing model', /rate card|pricing/i, 'Prepare a rate card or pricing model'),
    { label: 'Reporting / analytics approach', status: has(profile.differentiators, /analytics|reporting/i) ? 'have' : 'missing', detail: 'Describe how you measure and report results' },
  ];
  if (isMediaBuying) pricing.push({ label: 'Media plan', status: 'required', detail: 'Media buying scope — include a media plan and spend approach' });
  if (isMultilingual) pricing.push({ label: 'Translation / localization proof', status: has(profile.services, /translation|localization/i) ? 'verify' : 'required', detail: 'Multilingual scope — show localization capability' });

  // 6) SUBMISSION STEPS
  const submission: ChecklistItem[] = [
    { label: 'Confirm submission method & format', status: 'verify', detail: 'Portal upload, email, or physical — and file format/page limits' },
    { label: 'Note the response deadline', status: opp.responseDeadline ? 'verify' : 'missing', detail: opp.responseDeadline ? `Due ${new Date(opp.responseDeadline).toLocaleDateString()}` : 'No deadline captured — verify on SAM.gov' },
    { label: 'Register on buyer portal (if required)', status: 'verify' },
    { label: 'Final compliance review & submit', status: 'missing', detail: 'Check every required item is included before submitting' },
  ];

  const groups: ChecklistGroup[] = [
    { name: 'Eligibility', items: eligibility },
    { name: 'Proposal documents', items: proposalDocs },
    { name: 'Compliance', items: compliance },
    { name: 'Portfolio / past performance', items: portfolio },
    { name: 'Pricing / readiness', items: pricing },
    { name: 'Submission steps', items: submission },
  ];

  // Tallies + required documents + recommended steps
  const all = groups.flatMap((g) => g.items);
  const tally = (s: ItemStatus) => all.filter((i) => i.status === s).length;
  const haveCount = tally('have');
  const summary = {
    have: haveCount,
    missing: tally('missing'),
    verify: tally('verify'),
    required: tally('required'),
    percentReady: Math.round((haveCount / all.length) * 100),
  };

  const requiredDocuments = all.filter((i) => i.status === 'required').map((i) => i.label);

  const recommendedSteps: string[] = [];
  const firstMissing = all.filter((i) => i.status === 'missing' || i.status === 'required').slice(0, 5);
  for (const i of firstMissing) recommendedSteps.push(i.detail ? `${i.label}: ${i.detail}` : `Prepare: ${i.label}`);
  if (opp.responseDeadline) {
    const days = Math.ceil((new Date(opp.responseDeadline).getTime() - Date.now()) / 86_400_000);
    if (days > 0) recommendedSteps.unshift(`You have ${days} day${days === 1 ? '' : 's'} until the deadline — plan backward from it.`);
  }

  return { groups, requiredDocuments, recommendedSteps, summary };
}
