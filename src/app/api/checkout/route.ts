import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key_to_bypass_build');

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing user details' }, { status: 400 });
    }

    // You should dynamically fetch the origin in production
    // For local dev, hardcode localhost:3000 or use headers
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          // TODO: Replace with the actual Price ID from Stripe Dashboard
          price: 'price_dummy_replacement',
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      customer_email: email,
      client_reference_id: userId, // Pass Firebase UID to map it back in the webhook
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
