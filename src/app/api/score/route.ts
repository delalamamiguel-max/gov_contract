export const dynamic = 'force-dynamic';
import '@/lib/firebase';
import { NextResponse } from 'next/server';
import { generateFitScore } from '@/lib/ai';
import { getTenant, updateTenantTokens } from '@/lib/dataconnect';
export async function POST(req: Request) {
  try {
    const { contractTitle, contractDescription, businessNaics, businessCapacities } = await req.json();

    if (!contractTitle || !businessNaics) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify User Tokens using DEMO_TENANT_ID
    const DEMO_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';
    const tenantRes = await getTenant({ id: DEMO_TENANT_ID });
    const tenant = tenantRes.data.tenant;
    
    if (tenant) {
      if (tenant.tokensRemaining <= 0 && !tenant.isPro) {
        return NextResponse.json({ error: 'Out of AI credits. Please upgrade to Pro.' }, { status: 403 });
      }
    }

    // 2. Generate Score
    const result = await generateFitScore(
      contractTitle, 
      contractDescription || 'No description provided.',
      businessNaics,
      businessCapacities || 'General capacity'
    );

    // 3. Deduct Token if not Pro
    if (tenant && !tenant.isPro && tenant.tokensRemaining > 0) {
      await updateTenantTokens({ 
        id: DEMO_TENANT_ID, 
        tokensRemaining: tenant.tokensRemaining - 1 
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Fit Score API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
