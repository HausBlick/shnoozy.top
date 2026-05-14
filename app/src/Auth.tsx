import { useState } from 'react';
import { supabase } from './lib/supabase';

interface AuthProps {
  onSession: () => void;
}

export function Auth({ onSession }: AuthProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onSession();
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSignupDone(true);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://shnoozy.top',
      });
      if (error) setError(error.message);
      else setForgotDone(true);
    }
    setLoading(false);
  };

  const tabStyle = (t: 'signin' | 'signup') => ({
    flex: 1,
    padding: '10px',
    borderRadius: 'calc(var(--rounded-lg) - 2px)',
    border: 'none',
    cursor: 'pointer' as const,
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'inherit',
    background: mode === t ? 'var(--color-canvas)' : 'transparent',
    color: mode === t ? 'var(--color-text)' : 'var(--color-muted)',
    boxShadow: mode === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.15s',
  });

  const switchLink = (label: string, onClick: () => void) => (
    <button
      type="button"
      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
      onClick={onClick}
    >
      {label}
    </button>
  );

  if (signupDone) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">📬</div>
          <h1 className="text-display-lg" style={{ marginBottom: '8px' }}>Check your inbox</h1>
          <p className="text-body-md text-muted" style={{ marginBottom: 'var(--spacing-xl)' }}>
            We sent a confirmation link to<br />
            <strong style={{ color: 'var(--color-text)' }}>{email}</strong>
          </p>
          <p className="text-body-sm text-muted">After confirming, come back here and sign in.</p>
          {switchLink('Back to Sign In', () => { setSignupDone(false); setMode('signin'); })}
        </div>
      </div>
    );
  }

  if (forgotDone) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">🔑</div>
          <h1 className="text-display-lg" style={{ marginBottom: '8px' }}>E-Mail gesendet</h1>
          <p className="text-body-md text-muted" style={{ marginBottom: 'var(--spacing-xl)' }}>
            Wir haben einen Link zum Zurücksetzen an<br />
            <strong style={{ color: 'var(--color-text)' }}>{email}</strong><br />
            gesendet.
          </p>
          {switchLink('Zurück zum Login', () => { setForgotDone(false); setMode('signin'); })}
        </div>
      </div>
    );
  }

  if (mode === 'forgot') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <div className="auth-logo">🔑</div>
            <h1 className="text-display-lg">Passwort zurücksetzen</h1>
            <p className="text-body-sm text-muted">Wir senden dir einen Link per E-Mail.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label className="text-caption" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>E-Mail-Adresse</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
                autoFocus
              />
            </div>

            {error && <div className="auth-error text-body-sm">{error}</div>}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '…' : 'Link senden'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
            {switchLink('← Zurück zum Login', () => { setMode('signin'); setError(null); })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <div className="auth-logo">🏠</div>
          <h1 className="text-display-lg">Welcome Home</h1>
          <p className="text-body-sm text-muted">Dein smarter Haushaltsbegleiter</p>
        </div>

        <div style={{
          display: 'flex',
          background: 'var(--color-surface)',
          borderRadius: 'var(--rounded-lg)',
          padding: '4px',
          marginBottom: 'var(--spacing-xl)',
          gap: '4px',
        }}>
          <button style={tabStyle('signin')} onClick={() => { setMode('signin'); setError(null); }}>
            Anmelden
          </button>
          <button style={tabStyle('signup')} onClick={() => { setMode('signup'); setError(null); }}>
            Registrieren
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--spacing-base)' }}>
            <label className="text-caption" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>E-Mail-Adresse</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div style={{ marginBottom: mode === 'signin' ? 'var(--spacing-sm)' : 'var(--spacing-lg)' }}>
            <label className="text-caption" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>Passwort</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
              minLength={6}
            />
          </div>

          {mode === 'signin' && (
            <div style={{ textAlign: 'right', marginBottom: 'var(--spacing-lg)' }}>
              {switchLink('Passwort vergessen?', () => { setMode('forgot'); setError(null); })}
            </div>
          )}

          {error && <div className="auth-error text-body-sm">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '…' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>
      </div>
    </div>
  );
}
