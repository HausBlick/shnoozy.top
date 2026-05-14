import { useState } from 'react';
import { supabase } from './lib/supabase';

interface Props {
  onDone: () => void;
}

export function SetNewPassword({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      onDone();
    }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <div className="auth-logo">🔑</div>
          <h1 className="text-display-lg">Neues Passwort</h1>
          <p className="text-body-sm text-muted">Wähle ein neues Passwort für dein Konto.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label className="text-caption" style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>Neues Passwort</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
              minLength={6}
              autoFocus
            />
          </div>

          {error && <div className="auth-error text-body-sm">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading || password.length < 6}>
            {loading ? '…' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
