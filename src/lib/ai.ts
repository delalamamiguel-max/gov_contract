import OpenAI from 'openai';

// Initialize the OpenAI client pointing to the Ollama OpenAI-compatible API
const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY || 'ollama', // Ollama doesn't strictly require an API key by default
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
});

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
    const response = await openai.chat.completions.create({
      model: 'kimi-k2.6:cloud', 
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    return {
      fitScore: parsed.fitScore || 0,
      matchSummary: parsed.matchSummary || "Analysis failed.",
    };
  } catch (error: any) {
    console.error('Cloud AI API error:', error);
    return {
      fitScore: 0,
      matchSummary: `AI Error: ${error.message || 'Unknown error occurred'}`,
    };
  }
}
