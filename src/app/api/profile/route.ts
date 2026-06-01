import { NextResponse } from 'next/server';
import { upsertBusinessProfile } from '@/lib/dataconnect';

// We use a constant UUID for the prototype demo user's tenant
const DEMO_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate inputs
    const { naicsCodes = [], setAsideTypes = [], minCapacity = null, maxCapacity = null } = body;

    // In a real app, you would read the session cookie, look up the Firebase Auth UID, 
    // and query the Tenant ID. For the prototype, we use DEMO_TENANT_ID.
    await upsertBusinessProfile({
      tenantId: DEMO_TENANT_ID,
      naicsCodes,
      setAsideTypes,
      minCapacity: minCapacity ? parseInt(minCapacity, 10) : null,
      maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : null
    });

    return NextResponse.json({ success: true, message: 'Profile saved successfully' });
  } catch (error) {
    console.error('Failed to save profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
