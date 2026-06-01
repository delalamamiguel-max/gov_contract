import ollama from 'ollama';

interface FitScoreResult {
  fitScore: number;
  matchSummary: string;
}

export async function generateFitScore(
  contractTitle: string,
  contractDescription: string,
  businessNaics: string[],
  businessCapacities: string
): Promise<FitScoreResult> {
  const prompt = `
    You are an expert federal contracting AI. 
    Evaluate the fit between a small business and a federal contract opportunity.
    
    Business Profile:
    - NAICS Codes: ${businessNaics.join(', ')}
    - Capabilities/Capacity: ${businessCapacities}
    
    Contract Opportunity:
    - Title: ${contractTitle}
    - Description: ${contractDescription}
    
    Return a strict JSON object with EXACTLY two keys:
    1. "fitScore": An integer from 0 to 100 representing how well the business matches the contract.
    2. "matchSummary": A 2-3 sentence explanation of the score.
    
    Output JSON only. Do not wrap in markdown tags like \`\`\`json.
  `;

  try {
    // We assume 'llama3' or 'mistral' is installed locally via Ollama.
    // The user must run `ollama run llama3` on their machine.
    const response = await ollama.generate({
      model: 'llama3', // You can change this to mistral, phi3, etc.
      prompt: prompt,
      format: 'json',
      stream: false,
    });

    const parsed = JSON.parse(response.response);
    return {
      fitScore: parsed.fitScore || 0,
      matchSummary: parsed.matchSummary || "Analysis failed.",
    };
  } catch (error) {
    console.error('Ollama API error:', error);
    return {
      fitScore: 0,
      matchSummary: 'Failed to generate fit score due to local AI error. Is Ollama running?',
    };
  }
}
