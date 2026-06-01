import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook Error:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // The user's tenant ID was passed in client_reference_id
    const tenantId = session.client_reference_id;
    const customerId = session.customer as string;

    if (tenantId) {
      try {
        // We will call the Data Connect REST endpoint directly since we are on the server
        // and we want to avoid issues with Firebase client initialization in Edge/Node environments.
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const location = 'us-central1';
        const service = 'govcontract-app';
        
        const url = `https://firebasedataconnect.googleapis.com/v1beta/projects/${projectId}/locations/${location}/services/${service}/connectors/default:executeMutation`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Note: Since this mutation is @auth(level: PUBLIC), it doesn't require an Auth header.
            // If it required auth, we would pass a Service Account token here.
          },
          body: JSON.stringify({
            operationName: 'UpdateTenantProStatus',
            variables: {
              id: tenantId,
              isPro: true,
              stripeCustomerId: customerId
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Data Connect Error: ${errText}`);
        }
        
        console.log(`Successfully upgraded user ${tenantId} to Pro!`);
      } catch (error) {
        console.error('Failed to update tenant status in database:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
