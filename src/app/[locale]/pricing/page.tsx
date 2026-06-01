'use client';

import { useState } from 'react';
import { Check, Zap } from 'lucide-react';

const DEMO_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: DEMO_TENANT_ID, email: 'migs.kelo.llc@gmail.com' }),
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to initialize checkout');
      }
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center py-20 px-4">
      <div className="max-w-3xl text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Unlock the Full Power of GovContract AI
        </h1>
        <p className="text-lg text-slate-600">
          Your free trial has ended. Upgrade to Pro to continue discovering, evaluating, and managing federal contracts seamlessly.
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white p-8 max-w-md w-full relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-xl font-medium text-sm shadow-md">
          Most Popular
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Pro Subscription</h2>
        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-5xl font-extrabold text-slate-900">$49</span>
          <span className="text-slate-500 font-medium">/ month</span>
        </div>

        <ul className="space-y-4 mb-8 text-slate-700">
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-blue-600" />
            <span>Unlimited AI Contract Fit Scores</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-blue-600" />
            <span>Unlimited Contract Saved Pipelines</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-blue-600" />
            <span>Full access to Contract Search Database</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-blue-600" />
            <span>Premium Kimi AI Intelligence Models</span>
          </li>
        </ul>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 hover:shadow-blue-500/25"
        >
          {loading ? (
            <span className="animate-pulse">Preparing Checkout...</span>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Upgrade to Pro
            </>
          )}
        </button>
      </div>
    </div>
  );
}
