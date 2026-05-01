import { useState } from 'react';
import './index.css';

// SVG Icons (Placeholders for now, using simple geometries)
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    {active ? null : <polyline points="9 22 9 12 15 12 15 22"></polyline>}
  </svg>
);

const CalendarIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const ListsIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const MenuIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="5" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const FolderIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const StickyNoteIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"></path>
    <polyline points="15 3 15 9 21 9"></polyline>
  </svg>
);

const HeartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const FilmIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
    <line x1="7" y1="2" x2="7" y2="22"></line>
    <line x1="17" y1="2" x2="17" y2="22"></line>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <line x1="2" y1="7" x2="7" y2="7"></line>
    <line x1="2" y1="17" x2="7" y2="17"></line>
    <line x1="17" y1="17" x2="22" y2="17"></line>
    <line x1="17" y1="7" x2="22" y2="7"></line>
  </svg>
);

const MapPinIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const PawIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5c-1.38-1.5-4-1.5-5 0-1.5 2.25-.5 5 2 6 .5-1 2.5-1 3 0 2.5-1 3.5-3.75 2-6-1-1.5-3.62-1.5-5 0z"/>
    <path d="M6.5 12c-2 0-3 1.5-2 3 .5 1.5 2.5 1.5 3 0 0-1 0-2-1-3z"/>
    <path d="M17.5 12c-1 0-1 1-1 3 .5 1.5 2.5 1.5 3 0 1-1.5 0-3-2-3z"/>
    <path d="M12 14c-3 0-5 2-5 4.5 0 2 2.5 3.5 5 3.5s5-1.5 5-3.5c0-2.5-2-4.5-5-4.5z"/>
  </svg>
);

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);

  const handleCopyPassword = () => {
    navigator.clipboard.writeText("SecretPassword123!");
    alert("Password copied!"); // Quick placeholder feedback
  };

  return (
    <div className="app-container">
      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'home' && (
          <div>
            <h1 className="text-display-lg" style={{ marginBottom: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              Dashboard
            </h1>
            
            <div className="card">
              <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>Upcoming Events</h2>
              <p className="text-body-sm text-muted">No upcoming events this week.</p>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-ink)', fontWeight: 500, marginTop: 'var(--spacing-sm)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                See all
              </button>
            </div>

            <div className="card">
              <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>Recent Activity</h2>
              <p className="text-body-sm text-muted">Nothing new added yet.</p>
            </div>

            <button className="btn-primary" style={{ marginTop: 'var(--spacing-lg)' }} onClick={() => setIsWifiModalOpen(true)}>
              Share WiFi
            </button>
          </div>
        )}

        {activeTab === 'calendar' && <div><h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)' }}>Calendar</h1><p className="text-body-md text-muted">Coming soon...</p></div>}
        {activeTab === 'lists' && <div><h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)' }}>Lists</h1><p className="text-body-md text-muted">Coming soon...</p></div>}
        {activeTab === 'menu' && (
          <div>
            <h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)' }}>Menu</h1>
            <div className="menu-grid">
              <button className="menu-card">
                <div className="menu-card-icon"><CalendarIcon active={false} /></div>
                <span className="text-title-md">Calendar & Reminders</span>
              </button>
              <button className="menu-card">
                <div className="menu-card-icon"><ListsIcon active={false} /></div>
                <span className="text-title-md">Smart Shopping</span>
              </button>
              <button className="menu-card">
                <div className="menu-card-icon"><PawIcon /></div>
                <span className="text-title-md">Luna Portal</span>
              </button>
              <button className="menu-card">
                <div className="menu-card-icon"><FolderIcon /></div>
                <span className="text-title-md">Documents</span>
              </button>
              <button className="menu-card">
                <div className="menu-card-icon"><StickyNoteIcon /></div>
                <span className="text-title-md">Post-it Board</span>
              </button>
              <button className="menu-card">
                <div className="menu-card-icon"><HeartIcon /></div>
                <span className="text-title-md">Moodboard</span>
              </button>
              <button className="menu-card">
                <div className="menu-card-icon"><FilmIcon /></div>
                <span className="text-title-md">Entertainment</span>
              </button>
              <button className="menu-card">
                <div className="menu-card-icon"><MapPinIcon /></div>
                <span className="text-title-md">Custom Map</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <div className="bottom-nav-icon"><HomeIcon active={activeTab === 'home'} /></div>
          <span className="bottom-nav-label">Home</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <div className="bottom-nav-icon"><CalendarIcon active={activeTab === 'calendar'} /></div>
          <span className="bottom-nav-label">Calendar</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'lists' ? 'active' : ''}`}
          onClick={() => setActiveTab('lists')}
        >
          <div className="bottom-nav-icon"><ListsIcon active={activeTab === 'lists'} /></div>
          <span className="bottom-nav-label">Lists</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          <div className="bottom-nav-icon"><MenuIcon active={activeTab === 'menu'} /></div>
          <span className="bottom-nav-label">Menu</span>
        </button>
      </nav>

      {/* WiFi Modal */}
      {isWifiModalOpen && (
        <div className="modal-overlay" onClick={() => setIsWifiModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">Guest WiFi</h2>
              <button className="icon-button-circle" onClick={() => setIsWifiModalOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            
            <div className="qr-placeholder">
              <span className="text-body-sm">[ QR Code generated here ]</span>
            </div>

            <div style={{ marginBottom: 'var(--spacing-base)' }}>
              <p className="text-caption text-muted" style={{ marginBottom: 'var(--spacing-xs)' }}>Network Name</p>
              <p className="text-body-md">Guest-Network-5G</p>
            </div>

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <p className="text-caption text-muted" style={{ marginBottom: 'var(--spacing-xs)' }}>Password</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="text-body-md">SecretPassword123!</p>
                <button 
                  style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={handleCopyPassword}
                >
                  <CopyIcon />
                  <span className="text-body-sm" style={{ fontWeight: 500 }}>Copy</span>
                </button>
              </div>
            </div>

            <button className="btn-secondary" onClick={() => setIsWifiModalOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
