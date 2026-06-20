const fs = require('fs');

let code = fs.readFileSync('src/lib/rfp.ts', 'utf8');

const newInterface = `export interface RfpAssessment {
  what_this_is: string;
  why_it_fits: string[];
  why_it_may_not_fit: string[];
  what_is_required_to_respond: string[];
  checklist_before_you_apply: string[];
  deadline: string;
  amount_or_value: string;
  important_watchouts: string[];
  recommended_supporting_materials: string[];
  source_documents_used: string[];
  recommendation: RfpRecommendation;
  recommendationRationale: string;
  matchScore: number;
  source: 'ai' | 'fallback';
}`;

code = code.replace(/export interface RfpAssessment \{[\s\S]*?source: 'ai' \| 'fallback';\n\}/, newInterface);

const newFallback = `  const fallback = {
    what_this_is: \`\${opp.agency || 'The buyer'} is seeking \${opp.title}. Based on the available details, this is a \${assessment.label.toLowerCase()} for your agency (\${score}%).\`,
    why_it_fits: assessment.whyFits.length ? assessment.whyFits : ['Strong alignment with your core capabilities.'],
    why_it_may_not_fit: assessment.whyMayNotFit.length ? assessment.whyMayNotFit : ['Limited details available.'],
    what_is_required_to_respond: [
      opp.title,
      ...(hay.includes('website') || hay.includes('web') ? ['Website design/development'] : []),
      ...(hay.includes('seo') ? ['Search engine optimization'] : []),
      ...(hay.includes('social') ? ['Social media management'] : []),
      ...(hay.includes('brand') ? ['Branding/creative'] : []),
      ...(hay.includes('media') ? ['Media planning/buying'] : []),
    ].slice(0, 6),
    checklist_before_you_apply: requiredDocuments,
    deadline: urgency,
    amount_or_value: opp.estimatedValue ? \`$\${opp.estimatedValue.toLocaleString()}\` : 'Not specified',
    important_watchouts: ['Verify all requirements on the official solicitation portal before committing resources.'],
    recommended_supporting_materials: ['Capability statement', 'Relevant case studies'],
    source_documents_used: ['Original solicitation listing'],
  };`;

code = code.replace(/const fallback = \{[\s\S]*?  \};\n/, newFallback + '\n');

const newPrompt = `  const prompt = \`You are BidFlare’s Opportunity Intelligence Engine. You are advising a MARKETING AGENCY on a public-sector RFP. Write specific, highly actionable, plain-English content. Avoid generic contractor jargon unless the opportunity explicitly requires it.

OPPORTUNITY:
- Title: \${opp.title}
- Buyer: \${opp.agency || 'unknown'}
- Set-aside: \${opp.setAsideType || 'none'}
- Estimated value: \${opp.estimatedValue ?? 'unknown'}
- Description: \${opp.description || '(limited — infer from title)'}

AGENCY PROFILE:
- Services: \${(profile.services || []).join(', ') || 'n/a'}
- Industries: \${(profile.industries || []).join(', ') || 'n/a'}
- Certifications: \${(profile.certifications || []).join(', ') || 'none'}

Return STRICT JSON exactly matching this schema:
{
  "what_this_is": "<2-3 sentence plain-English overview of the project and scope>",
  "why_it_fits": ["<reason it matches agency>", ...],
  "why_it_may_not_fit": ["<potential gap or risk>", ...],
  "what_is_required_to_respond": ["<specific requirement>", ...],
  "checklist_before_you_apply": ["<action item>", ...],
  "deadline": "<deadline urgency assessment>",
  "amount_or_value": "<estimated value or 'Unknown'>",
  "important_watchouts": ["<critical warning or watchout>", ...],
  "recommended_supporting_materials": ["<material to include in proposal>", ...],
  "source_documents_used": ["<document name if mentioned in description>", ...]
}\`;`;

code = code.replace(/const prompt = \`You are advising a MARKETING AGENCY[\s\S]*?\}\`;\n/, newPrompt + '\n');

const newReturn = `  return {
    what_this_is: data.what_this_is || fallback.what_this_is,
    why_it_fits: data.why_it_fits?.length ? data.why_it_fits : fallback.why_it_fits,
    why_it_may_not_fit: data.why_it_may_not_fit?.length ? data.why_it_may_not_fit : fallback.why_it_may_not_fit,
    what_is_required_to_respond: data.what_is_required_to_respond?.length ? data.what_is_required_to_respond : fallback.what_is_required_to_respond,
    checklist_before_you_apply: data.checklist_before_you_apply?.length ? data.checklist_before_you_apply : fallback.checklist_before_you_apply,
    deadline: data.deadline || fallback.deadline,
    amount_or_value: data.amount_or_value || fallback.amount_or_value,
    important_watchouts: data.important_watchouts?.length ? data.important_watchouts : fallback.important_watchouts,
    recommended_supporting_materials: data.recommended_supporting_materials?.length ? data.recommended_supporting_materials : fallback.recommended_supporting_materials,
    source_documents_used: data.source_documents_used?.length ? data.source_documents_used : fallback.source_documents_used,
    recommendation,
    recommendationRationale,
    matchScore: score,
    source,
  };`;

code = code.replace(/return \{[\s\S]*?source,\n  \};/, newReturn);

fs.writeFileSync('src/lib/rfp.ts', code);
