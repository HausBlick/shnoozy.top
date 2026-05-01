import { useState } from 'react';
import { supabase } from './lib/supabase';

interface AuthProps {
  onSession: () => void;
}

export function Auth({ onSession }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      onSession();
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <div className="auth-logo">🏠</div>
          <h1 className="text-display-lg">Welcome Home</h1>
          <p className="text-body-sm text-muted">Sign in to manage your Shnoozy</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 'var(--spacing-base)' }}>
            <label className="text-caption" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label className="text-caption" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {error && (
            <div className="auth-error text-body-sm">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
