export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.client_reference_id;
      const subscriptionId = session.subscription as string;
      
      if (tenantId) {
        console.log(`[Stripe] Provisioning subscription ${subscriptionId} for Tenant: ${tenantId}`);
        // TODO: Import the admin SDK and update the Tenant's subscriptionStatus to "PAID"
        // and reset their tokensRemaining.
      }
      break;
    
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[Stripe] Subscription status changed: ${subscription.id} - ${subscription.status}`);
      // TODO: Handle cancellation, suspension, etc.
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
