import { useState } from 'react';
import { supabase } from './lib/supabase';

interface Props {
  onHomeReady: () => void;
}

export function HomeOnboarding({ onHomeReady }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [homeName, setHomeName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createHome() {
    if (!homeName.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('homes').insert({ name: homeName.trim() });
      if (err) throw err;
      onHomeReady();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function joinByToken() {
    if (!token.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const raw = token.trim();
      let tokenValue = raw;
      try {
        const url = new URL(raw);
        tokenValue = url.searchParams.get('token') ?? raw;
      } catch {
        // not a URL, use as-is
      }
      const { data, error: err } = await supabase.functions.invoke('accept-invite', {
        body: { token: tokenValue },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      onHomeReady();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const tabStyle = (t: 'create' | 'join') => ({
    flex: 1,
    padding: '10px',
    borderRadius: 'calc(var(--rounded-lg) - 2px)',
    border: 'none',
    cursor: 'pointer' as const,
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'inherit',
    background: tab === t ? 'var(--color-canvas)' : 'transparent',
    color: tab === t ? 'var(--color-text)' : 'var(--color-muted)',
    boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-lg)',
      background: 'var(--color-canvas)',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <h1 className="text-display-lg" style={{ marginBottom: '6px' }}>Welcome</h1>
        <p className="text-body-md text-muted" style={{ marginBottom: 'var(--spacing-xl)' }}>
          Create a new home or join one via invite link.
        </p>

        <div style={{
          display: 'flex',
          background: 'var(--color-surface)',
          borderRadius: 'var(--rounded-lg)',
          padding: '4px',
          marginBottom: 'var(--spacing-xl)',
          gap: '4px',
        }}>
          <button style={tabStyle('create')} onClick={() => { setTab('create'); setError(null); }}>
            Create Home
          </button>
          <button style={tabStyle('join')} onClick={() => { setTab('join'); setError(null); }}>
            Join Home
          </button>
        </div>

        {tab === 'create' ? (
          <>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label className="form-label">Home name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Our Apartment"
                value={homeName}
                onChange={e => setHomeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createHome()}
                autoFocus
              />
            </div>
            <div style={{
              background: 'rgba(20,216,219,0.08)', borderRadius: '10px',
              padding: '12px 14px', marginBottom: 'var(--spacing-lg)', fontSize: '13px',
              color: 'var(--color-muted)', lineHeight: 1.5,
            }}>
              👑 <strong>You will be the admin</strong> of this home. As admin you can invite members, configure settings (navigation, modules, budget setup) and manage all home-wide options. Members have access to all tools but cannot change home-wide settings.
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={createHome}
              disabled={loading || !homeName.trim()}
            >
              {loading ? 'Creating…' : 'Create Home'}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label className="form-label">Invite link or token</label>
              <input
                type="text"
                className="form-input"
                placeholder="Paste link or token here"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinByToken()}
                autoFocus
              />
            </div>
            <div style={{
              background: 'rgba(99,102,241,0.08)', borderRadius: '10px',
              padding: '12px 14px', marginBottom: 'var(--spacing-lg)', fontSize: '13px',
              color: 'var(--color-muted)', lineHeight: 1.5,
            }}>
              👤 You are joining as a <strong>member</strong>. The home admin manages settings (navigation, modules, budget setup). You have full access to all tools — some configuration options are admin-only.
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={joinByToken}
              disabled={loading || !token.trim()}
            >
              {loading ? 'Joining…' : 'Join Home'}
            </button>
          </>
        )}

        {error && (
          <p style={{ color: '#c13515', fontSize: '14px', marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
