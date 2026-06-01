import { NextResponse } from 'next/server';
import { updatePipelineApplicationStatus } from '@/lib/dataconnect';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Call Firebase Data Connect generated SDK
    await updatePipelineApplicationStatus({
      id,
      status
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update pipeline status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
