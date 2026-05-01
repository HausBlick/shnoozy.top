import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './Auth';
import { Calendar } from './Calendar';
import { Lists } from './Lists';
import './index.css';

// SVG Icons
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke="currentColor" strokeWidth={active ? '1' : '2'} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    {!active && <polyline points="9 22 9 12 15 12 15 22"></polyline>}
  </svg>
);

const CalendarIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'var(--color-primary)' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill={active ? 'var(--color-primary)' : 'none'}></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const ListsIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" stroke={active ? 'var(--color-primary)' : 'currentColor'}></line>
    <line x1="8" y1="12" x2="21" y2="12" stroke={active ? 'var(--color-primary)' : 'currentColor'}></line>
    <line x1="8" y1="18" x2="21" y2="18" stroke={active ? 'var(--color-primary)' : 'currentColor'}></line>
    <circle cx="3" cy="6" r="1.5" fill={active ? 'var(--color-primary)' : 'currentColor'} stroke="none"></circle>
    <circle cx="3" cy="12" r="1.5" fill={active ? 'var(--color-primary)' : 'currentColor'} stroke="none"></circle>
    <circle cx="3" cy="18" r="1.5" fill={active ? 'var(--color-primary)' : 'currentColor'} stroke="none"></circle>
  </svg>
);

const MoreIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2" fill={active ? 'var(--color-primary)' : 'none'} stroke={active ? 'var(--color-primary)' : 'currentColor'}></circle>
    <circle cx="19" cy="12" r="2" fill={active ? 'var(--color-primary)' : 'none'} stroke={active ? 'var(--color-primary)' : 'currentColor'}></circle>
    <circle cx="5" cy="12" r="2" fill={active ? 'var(--color-primary)' : 'none'} stroke={active ? 'var(--color-primary)' : 'currentColor'}></circle>
  </svg>
);

const PawIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'var(--color-primary)' : 'none'} stroke={active ? 'var(--color-primary)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 13c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5 4.5-2 4.5-4.5-2-4.5-4.5-4.5z" fill={active ? 'var(--color-primary)' : 'none'} />
    <circle cx="7" cy="10" r="2.5" fill={active ? 'var(--color-primary)' : 'none'} />
    <circle cx="10.5" cy="7" r="2.5" fill={active ? 'var(--color-primary)' : 'none'} />
    <circle cx="14.5" cy="7" r="2.5" fill={active ? 'var(--color-primary)' : 'none'} />
    <circle cx="18" cy="10" r="2.5" fill={active ? 'var(--color-primary)' : 'none'} />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);


const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0))).buffer;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [notifStatus, setNotifStatus] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('unsupported');
  const swReg = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        swReg.current = reg;
        setNotifStatus(Notification.permission as 'default' | 'granted' | 'denied');
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchUpcomingEvents();
    }
  }, [session]);

  async function fetchUpcomingEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(today.getDate() + 14);

    const { data, error } = await supabase.from('events').select('*');
    if (!error && data) {
      const processed: any[] = [];
      const currentYear = today.getFullYear();

      data.forEach(e => {
        const d = new Date(e.start_time);
        if (e.recurrence_type === 'yearly') {
          // Project to current or next year to see if it falls in the 14 day window
          let dProj = new Date(d);
          dProj.setFullYear(currentYear);
          
          // If the birthday already happened this year and is not in the next 14 days,
          // check if it falls in the window early next year (e.g. late December case)
          if (dProj < today) {
            dProj.setFullYear(currentYear + 1);
          }

          if (dProj >= today && dProj <= rangeEnd) {
            processed.push({ ...e, display_time: dProj });
          }
        } else {
          if (d >= today && d <= rangeEnd) {
            processed.push({ ...e, display_time: d });
          }
        }
      });
      processed.sort((a, b) => a.display_time.getTime() - b.display_time.getTime());
      setUpcomingEvents(processed);
    }
  }

  async function enableNotifications() {
    if (!swReg.current || !import.meta.env.VITE_VAPID_PUBLIC_KEY) return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission as 'default' | 'granted' | 'denied');
    if (permission !== 'granted') return;
    try {
      const sub = await swReg.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      });
      const { endpoint, keys } = sub.toJSON();
      await supabase.from('push_subscriptions').upsert(
        { user_id: session.user.id, endpoint, p256dh: keys!.p256dh, auth: keys!.auth },
        { onConflict: 'endpoint' }
      );
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Auth onSession={() => {}} />;
  }

  return (
    <div className="app-container">
      <main className="main-content">
        {activeTab === 'home' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <h1 className="text-display-lg">Dashboard</h1>
              <button onClick={handleLogout} className="icon-button-circle" title="Logout">
                <LogoutIcon />
              </button>
            </div>
            
            <div className="card">
              <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>Upcoming 14 Days</h2>
              {upcomingEvents.length === 0 ? (
                <p className="text-body-sm text-muted">No upcoming events.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  {upcomingEvents.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid var(--color-hairline-soft)', paddingBottom: '4px' }}>
                      <span>{e.category === 'birthday' ? '🎂 ' : ''}{e.title}</span>
                      <span className="text-muted">
                        {e.display_time.toLocaleDateString([], { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button 
                onClick={() => setActiveTab('calendar')}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontWeight: 600, marginTop: 'var(--spacing-sm)', cursor: 'pointer', padding: 0 }}
              >
                Go to Calendar →
              </button>
            </div>

            {notifStatus === 'default' && import.meta.env.VITE_VAPID_PUBLIC_KEY && (
              <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <span style={{ fontSize: '20px' }}>🔔</span>
                  <h3 className="text-title-md">Enable Notifications</h3>
                </div>
                <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>
                  Get daily reminders for upcoming events and birthdays.
                </p>
                <button className="btn-primary" onClick={enableNotifications}>Enable</button>
              </div>
            )}
            {notifStatus === 'granted' && (
              <p className="text-body-sm text-muted" style={{ marginTop: 'var(--spacing-md)' }}>🔔 Notifications enabled</p>
            )}

            <button className="btn-primary" style={{ marginTop: 'var(--spacing-lg)' }} onClick={() => setIsWifiModalOpen(true)}>
              Share WiFi
            </button>
          </div>
        )}

        {activeTab === 'calendar' && <Calendar />}
        {activeTab === 'luna' && <div><h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)' }}>Luna Portal</h1><p className="text-body-md text-muted">Coming soon...</p></div>}
        {activeTab === 'lists' && <Lists />}
        {activeTab === 'more' && (
          <div><h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)' }}>Menu</h1><p className="text-body-md text-muted">Coming soon...</p></div>
        )}
      </main>

      <nav className="bottom-nav">
        <div className="bottom-nav-group">
          <button className={`bottom-nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
            <div className="bottom-nav-icon"><CalendarIcon active={activeTab === 'calendar'} /></div>
            <span className="bottom-nav-label">Calendar</span>
          </button>
          <button className={`bottom-nav-item ${activeTab === 'luna' ? 'active' : ''}`} onClick={() => setActiveTab('luna')}>
            <div className="bottom-nav-icon"><PawIcon active={activeTab === 'luna'} /></div>
            <span className="bottom-nav-label">Luna</span>
          </button>
        </div>

        <button className={`bottom-nav-item-home ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <div className="bottom-nav-icon-home"><HomeIcon active={activeTab === 'home'} /></div>
        </button>

        <div className="bottom-nav-group">
          <button className={`bottom-nav-item ${activeTab === 'lists' ? 'active' : ''}`} onClick={() => setActiveTab('lists')}>
            <div className="bottom-nav-icon"><ListsIcon active={activeTab === 'lists'} /></div>
            <span className="bottom-nav-label">Lists</span>
          </button>
          <button className={`bottom-nav-item ${activeTab === 'more' ? 'active' : ''}`} onClick={() => setActiveTab('more')}>
            <div className="bottom-nav-icon"><MoreIcon active={activeTab === 'more'} /></div>
            <span className="bottom-nav-label">More</span>
          </button>
        </div>
      </nav>

      {isWifiModalOpen && (
        <div className="modal-overlay" onClick={() => setIsWifiModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">Guest WiFi</h2>
              <button className="icon-button-circle" onClick={() => setIsWifiModalOpen(false)}><CloseIcon /></button>
            </div>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <p className="text-body-md">Guest-Network-5G</p>
              <p className="text-body-sm text-muted">Password: SecretPassword123!</p>
            </div>
            <button className="btn-secondary" onClick={() => setIsWifiModalOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
