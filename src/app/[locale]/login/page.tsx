'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from 'next-intl';
import BidFlareLogo from '@/components/BidFlareLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const locale = useLocale();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(`/${locale}/dashboard/recommendations`);
      router.refresh();
    } catch (err: any) {
      // "Failed to fetch" usually means a network/CORS/extension issue rather
      // than bad credentials. Surface a more helpful hint when we see it.
      const raw = err?.message || '';
      const friendly = /failed to fetch|networkerror|load failed/i.test(raw)
        ? "Couldn't reach the auth service. Disable any ad-blocker / privacy extension for this site or try an incognito window, then retry."
        : raw || 'Failed to sign in. Please check your credentials.';
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/${locale}/dashboard/recommendations`)}`;
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
      // Browser redirects to Google.
    } catch (err: any) {
      setError(err.message || 'Google sign-in is not configured yet.');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
      
      {/* Decorative Gradient Orbs */}
      <div style={{
        position: 'absolute', top: '10%', left: '10%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 60%)',
        opacity: 0.15, filter: 'blur(60px)', zIndex: 0, animation: 'fadeIn 2s ease'
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '10%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 60%)',
        opacity: 0.1, filter: 'blur(80px)', zIndex: 0, animation: 'fadeIn 3s ease'
      }} />

      <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', width: '100%', padding: '3rem', zIndex: 10 }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <BidFlareLogo height={40} />
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center', letterSpacing: '-0.02em' }}>Welcome Back</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.05rem' }}>Securely access your BidFlare dashboard.</p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="form-input" placeholder="you@example.com" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="form-input" placeholder="••••••••" />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.875rem' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ margin: '2rem 0', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)' }} />
          <span style={{ padding: '0 1rem', fontSize: '0.875rem', fontWeight: 500 }}>OR CONTINUE WITH</span>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)' }} />
        </div>

        <button onClick={handleGoogleLogin} className="btn" style={{ 
          width: '100%', background: 'rgba(42, 51, 61,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '0.875rem' 
        }} disabled={loading}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 20, height: 20 }} />
          Google
        </button>

        <p style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          Don't have an account? <Link href={`/${locale}/signup`} style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
