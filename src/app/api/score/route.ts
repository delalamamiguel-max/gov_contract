export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateFitScore } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { contractTitle, contractDescription, businessNaics, businessCapacities } = await req.json();

    if (!contractTitle || !businessNaics) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await generateFitScore(
      contractTitle, 
      contractDescription || 'No description provided.',
      businessNaics,
      businessCapacities || 'General capacity'
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Fit Score API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
