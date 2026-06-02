import OpenAI from 'openai';

// Initialize the OpenAI client pointing to any OpenAI-compatible API (Moonshot/Kimi)
const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY || 'dummy_key',
  baseURL: process.env.AI_BASE_URL || 'https://api.moonshot.cn/v1',
  timeout: 20_000, // 20 second SDK-level timeout
});

const AI_REQUEST_TIMEOUT_MS = 15_000; // 15 second abort timeout (fires before SDK timeout)

export interface FitScoreResult {
  fitScore: number;
  matchSummary: string;
}

export async function generateFitScore(
  contractTitle: string,
  contractDescription: string,
  businessNaics: string[],
  businessCapacities: string
): Promise<FitScoreResult> {
  // Guard: if no API key is configured, return a clear message instead of calling the API
  if (!process.env.KIMI_API_KEY || process.env.KIMI_API_KEY === 'dummy_key') {
    console.warn('[AI] KIMI_API_KEY is not configured. Skipping AI scoring.');
    return {
      fitScore: 0,
      matchSummary: 'AI scoring is not available. Please configure the KIMI_API_KEY environment variable.',
    };
  }

  const prompt = `You are an expert federal contracting AI.
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

Output JSON only. Do not wrap in markdown code fences.`;

  // AbortController for request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await openai.chat.completions.create(
      {
        model: process.env.AI_MODEL || 'moonshot-v1-8k',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        // NOTE: response_format removed — not reliably supported across all
        // OpenAI-compatible providers. The prompt instructs JSON output instead.
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const rawContent = response.choices?.[0]?.message?.content || '';

    // Robust JSON parsing: strip markdown fences if the model wrapped them
    const cleanedContent = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch {
      console.error('[AI] Failed to parse AI response as JSON:', cleanedContent.slice(0, 200));
      return {
        fitScore: 0,
        matchSummary: 'AI returned an unparseable response. Please try again.',
      };
    }

    const fitScore = typeof parsed.fitScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.fitScore)))
      : 0;

    return {
      fitScore,
      matchSummary: typeof parsed.matchSummary === 'string' && parsed.matchSummary.length > 0
        ? parsed.matchSummary
        : 'Analysis completed but no summary was generated.',
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Categorize errors for user-friendly messages
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[AI] Request timed out after', AI_REQUEST_TIMEOUT_MS, 'ms');
        return {
          fitScore: 0,
          matchSummary: 'AI scoring timed out. The service may be temporarily slow. Please try again.',
        };
      }

      // OpenAI SDK wraps HTTP errors — check for common codes
      const statusCode = (error as any).status;
      if (statusCode === 401) {
        console.error('[AI] Authentication failed — check KIMI_API_KEY');
        return {
          fitScore: 0,
          matchSummary: 'AI authentication failed. Please verify the API key configuration.',
        };
      }
      if (statusCode === 429) {
        console.error('[AI] Rate limited by provider');
        return {
          fitScore: 0,
          matchSummary: 'AI service is temporarily rate-limited. Please wait a moment and try again.',
        };
      }

      console.error('[AI] API error:', error.message);
      return {
        fitScore: 0,
        matchSummary: 'AI scoring encountered an error. Please try again later.',
      };
    }

    console.error('[AI] Unknown error:', error);
    return {
      fitScore: 0,
      matchSummary: 'An unexpected error occurred during AI scoring.',
    };
  }
}
