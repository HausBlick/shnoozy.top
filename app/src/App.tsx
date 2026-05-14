import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';
import { Auth } from './Auth';
import { SetNewPassword } from './SetNewPassword';
import { HomeOnboarding } from './HomeOnboarding';
import { Calendar } from './Calendar';
import { Lists } from './Lists';
import { StickyNotes } from './StickyNotes';
import { Todos, TodosDashboardWidget } from './Todos';
import {
  HomeSettings,
  type ModuleId,
  MODULE_META,
  DEFAULT_ACTIVE,
  DEFAULT_NAV_SLOTS,
  getModuleLabel,
  getModuleDesc,
} from './HomeSettings';
import './index.css';

// ─── Icons ────────────────────────────────────────────────────────────────────

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

const TodosIcon = ({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const NoteIcon = ({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

const HouseInfoIcon = ({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const CarIcon = ({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="2"/>
    <path d="M16 8h4l3 5v3h-3"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const CakeIcon = ({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2 1 2 1"/>
    <path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/>
    <path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>
  </svg>
);

const BellIcon = ({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
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

const SettingsIcon = ({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const UserIcon = ({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// ─── Nav icon mapper ──────────────────────────────────────────────────────────

function NavModuleIcon({ id, active }: { id: ModuleId; active: boolean }) {
  const c = active ? 'var(--color-primary)' : 'currentColor';
  switch (id) {
    case 'calendar':  return <CalendarIcon active={active} />;
    case 'lists':     return <ListsIcon active={active} />;
    case 'notes':     return <NoteIcon color={c} size={24} />;
    case 'todos':     return <TodosIcon color={c} size={24} />;
    case 'luna':      return <PawIcon active={active} />;
    case 'home-info': return <HouseInfoIcon color={c} size={24} />;
    case 'car':       return <CarIcon color={c} size={24} />;
  }
}

// Nav label for each module (short, fits 10px label)
function getNavLabel(id: ModuleId, t: ReturnType<typeof getT>): string {
  switch (id) {
    case 'calendar':  return t.navCalendar;
    case 'lists':     return t.navLists;
    case 'notes':     return t.moduleNotes;
    case 'todos':     return t.navTodos;
    case 'luna':      return t.navLuna;
    case 'home-info': return t.moduleHomeInfo;
    case 'car':       return t.moduleCar;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#14d8db','#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#ec4899'];

// ─── User Settings page ───────────────────────────────────────────────────────

function NotifToggle({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--spacing-sm)', paddingBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--color-hairline-soft)' }}>
      <div style={{ flex: 1, paddingRight: 'var(--spacing-md)' }}>
        <div className="text-body-md" style={{ fontWeight: 500 }}>{label}</div>
        <div className="text-body-sm text-muted">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: value ? 'var(--color-primary)' : 'var(--color-surface-strong)',
          border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%', background: 'white',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

function UserSettingsPage({
  language, onLanguageChange, onBack, onLogout, notifStatus, onReRegister,
  notifPrefs, onNotifPrefChange, myDisplayName, myAvatarColor, onDisplayNameSave, onAvatarColorChange,
  myAvatarUrl, theme, onThemeChange, onAvatarUpload, onAvatarRemove,
}: {
  language: Lang;
  onLanguageChange: (lang: Lang) => void;
  onBack: () => void;
  onLogout: () => void;
  notifStatus: 'unsupported' | 'default' | 'granted' | 'denied';
  onReRegister: () => void;
  notifPrefs: Record<string, boolean>;
  onNotifPrefChange: (key: string, value: boolean) => void;
  myDisplayName: string;
  myAvatarColor: string;
  onDisplayNameSave: (name: string) => void;
  onAvatarColorChange: (color: string) => void;
  myAvatarUrl: string;
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
  onAvatarUpload: (f: File) => void;
  onAvatarRemove: () => void;
}) {
  const t = getT(language);
  const [localName, setLocalName] = useState(myDisplayName);
  const [nameSaved, setNameSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocalName(myDisplayName); }, [myDisplayName]);

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}>←</button>
        <h1 className="text-display-lg">{t.userSettings}</h1>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{t.profileSection}</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          {/* Avatar circle with upload */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onAvatarUpload(f); e.target.value = ''; }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: myAvatarUrl ? 'transparent' : myAvatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: 'white', cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {myAvatarUrl
                ? <img src={myAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (localName || myDisplayName || '?').charAt(0).toUpperCase()
              }
            </div>
            {/* Camera badge */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--color-surface-strong)',
                border: '1.5px solid var(--color-canvas)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '11px',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {/* Upload/Remove links */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '13px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                {t.avatarUpload}
              </button>
              {myAvatarUrl && (
                <button
                  onClick={onAvatarRemove}
                  style={{ fontSize: '13px', color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {t.avatarRemove}
                </button>
              )}
            </div>
            {/* Color picker */}
            <div style={{ marginBottom: '6px' }}>
              <span className="text-body-sm" style={{ fontWeight: 600 }}>{t.avatarColor}</span>
              <span className="text-body-sm text-muted" style={{ marginLeft: '6px' }}>{t.avatarColorHint}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => onAvatarColorChange(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', padding: 0,
                    outline: myAvatarColor === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.displayName}</label>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <input
              className="form-input"
              style={{ flex: 1, width: 'auto' }}
              value={localName}
              onChange={e => { setLocalName(e.target.value); setNameSaved(false); }}
              placeholder={t.displayNamePlaceholder}
              onKeyDown={e => { if (e.key === 'Enter') { onDisplayNameSave(localName); setNameSaved(true); } }}
            />
            <button
              className="btn-secondary"
              onClick={() => { onDisplayNameSave(localName); setNameSaved(true); }}
              disabled={!localName.trim() || nameSaved}
              style={{ flexShrink: 0, width: 'auto', padding: '13px 20px', background: nameSaved ? 'var(--color-surface-strong)' : 'var(--color-primary)', color: nameSaved ? 'var(--color-muted)' : 'white', border: 'none', transition: 'background 0.2s, color 0.2s' }}
            >
              {nameSaved ? t.saved : t.save}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{t.language}</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {(['en', 'de'] as Lang[]).map(lang => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 'var(--rounded-lg)',
                border: `2px solid ${language === lang ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                background: language === lang ? 'var(--color-primary)' : 'transparent',
                color: language === lang ? 'white' : 'var(--color-text)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '15px',
              }}
            >
              {lang === 'en' ? t.languageEn : t.languageDe}
            </button>
          ))}
        </div>
      </div>

      {/* Theme Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{t.themeSection}</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {(['light', 'dark'] as const).map(th => (
            <button
              key={th}
              onClick={() => onThemeChange(th)}
              style={{
                flex: 1, padding: '10px',
                borderRadius: 'var(--rounded-lg)',
                border: `2px solid ${theme === th ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                background: theme === th ? 'var(--color-primary)' : 'transparent',
                color: theme === th ? 'white' : 'var(--color-ink)',
                fontWeight: 600, cursor: 'pointer', fontSize: '15px',
              }}
            >
              {th === 'light' ? t.themeLight : t.themeDark}
            </button>
          ))}
        </div>
      </div>

      {notifStatus === 'granted' && (
        <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BellIcon color="var(--color-primary)" size={18} /> {t.notifPrefsTitle}
          </h2>
          <NotifToggle
            label={t.notifCalendarDaily} description={t.notifCalendarDailyDesc}
            value={notifPrefs.calendar_daily !== false}
            onChange={v => onNotifPrefChange('calendar_daily', v)}
          />
          <NotifToggle
            label={t.notifTodoAssigned} description={t.notifTodoAssignedDesc}
            value={notifPrefs.todo_assigned !== false}
            onChange={v => onNotifPrefChange('todo_assigned', v)}
          />
          <NotifToggle
            label={t.notifTodoDueToday} description={t.notifTodoDueTodayDesc}
            value={notifPrefs.todo_due_today !== false}
            onChange={v => onNotifPrefChange('todo_due_today', v)}
          />
          <NotifToggle
            label={t.notifShoppingAdded} description={t.notifShoppingAddedDesc}
            value={notifPrefs.shopping_item_added === true}
            onChange={v => onNotifPrefChange('shopping_item_added', v)}
          />
          <NotifToggle
            label={t.notifNotesNew} description={t.notifNotesNewDesc}
            value={notifPrefs.notes_new === true}
            onChange={v => onNotifPrefChange('notes_new', v)}
          />
          <p className="text-body-sm text-muted" style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
            {t.notifReRegisterHint}
          </p>
          <button
            className="btn-secondary"
            onClick={onReRegister}
            style={{ background: 'var(--color-primary)', color: 'white', border: 'none' }}
          >
            {t.reRegister}
          </button>
        </div>
      )}

      <button
        onClick={onLogout}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 'var(--rounded-lg)',
          border: '1px solid var(--color-hairline)',
          background: 'transparent',
          color: 'var(--color-muted)',
          fontWeight: 500,
          cursor: 'pointer',
          fontSize: '15px',
          marginTop: 'var(--spacing-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        <LogoutIcon /> {t.logout}
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0))).buffer;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [session, setSession] = useState<any>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [language, setLanguage] = useState<Lang>('en');
  const [userRole, setUserRole] = useState<'admin' | 'member'>('member');

  const [activeTab, setActiveTab] = useState('home');
  const [navSlots, setNavSlots] = useState<ModuleId[]>(DEFAULT_NAV_SLOTS);
  const [activeModuleIds, setActiveModuleIds] = useState<ModuleId[]>(DEFAULT_ACTIVE);

  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [notifStatus, setNotifStatus] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('unsupported');
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    calendar_daily: true,
    todo_assigned: true,
    todo_due_today: true,
    shopping_item_added: false,
    notes_new: false,
  });
  const [memberColors, setMemberColors] = useState<Record<string, string>>({});
  const [myDisplayName, setMyDisplayName] = useState('');
  const [myAvatarColor, setMyAvatarColor] = useState('#14d8db');
  const [myAvatarUrl, setMyAvatarUrl] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toast, setToast] = useState<string | null>(null);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSecurity, setWifiSecurity] = useState('WPA');
  const [wifiEditing, setWifiEditing] = useState(false);
  const [wifiEditSsid, setWifiEditSsid] = useState('');
  const [wifiEditPassword, setWifiEditPassword] = useState('');
  const [wifiSaving, setWifiSaving] = useState(false);
  const swReg = useRef<ServiceWorkerRegistration | null>(null);
  const toastTimer = useRef<number | null>(null);

  const t = getT(language);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setHomeLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      setSession(session);
      if (!session) {
        setHomeId(null);
        setHomeLoading(false);
      }
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
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (session) {
      fetchUserHome(session.user.id);
      fetchUserProfile(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    if (!homeId) return;
    if (window.location.hash === '#todos') {
      setActiveTab('todos');
      history.replaceState(null, '', window.location.pathname);
    }
  }, [homeId]);

  async function fetchUserProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('language, notification_preferences, display_name, avatar_color, avatar_url, theme')
      .eq('id', userId)
      .maybeSingle();
    if (data?.language) setLanguage(data.language as Lang);
    if (data?.notification_preferences) {
      setNotifPrefs(prev => ({ ...prev, ...(data.notification_preferences as Record<string, boolean>) }));
    }
    if (data?.display_name) setMyDisplayName(data.display_name);
    const color = data?.avatar_color || '#14d8db';
    setMyAvatarColor(color);
    setMemberColors(prev => ({ ...prev, [userId]: color }));
    if (data?.avatar_url) {
      setMyAvatarUrl(data.avatar_url);
    }
    if (data?.theme === 'dark') setTheme('dark');
  }

  async function fetchMemberColors(hId: string) {
    const { data: members } = await supabase
      .from('home_members')
      .select('user_id')
      .eq('home_id', hId);
    if (!members || members.length === 0) return;
    const userIds = members.map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_color')
      .in('id', userIds);
    const colors: Record<string, string> = {};
    for (const p of profiles ?? []) {
      colors[p.id] = p.avatar_color || '#14d8db';
    }
    setMemberColors(colors);
  }

  async function fetchUserHome(userId: string) {
    setHomeLoading(true);
    try {
      const { data } = await supabase
        .from('home_members')
        .select('home_id, role, homes(name)')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (data) {
        const hId = data.home_id;
        setHomeId(hId);
        setUserRole(data.role === 'admin' ? 'admin' : 'member');
        fetchUpcomingEvents(hId);
        fetchWifiSettings(hId);
        fetchHomeConfig(hId);
        fetchMemberColors(hId);
      } else {
        setHomeId(null);
      }
    } catch {
      setHomeId(null);
    } finally {
      setHomeLoading(false);
    }
  }

  async function fetchHomeConfig(hId: string) {
    const { data } = await supabase
      .from('home_settings')
      .select('key, value')
      .eq('home_id', hId)
      .in('key', ['nav_slots', 'modules_active']);
    if (data) {
      const nav = data.find(r => r.key === 'nav_slots');
      const mods = data.find(r => r.key === 'modules_active');
      if (nav?.value) try { setNavSlots(JSON.parse(nav.value)); } catch {}
      if (mods?.value) try { setActiveModuleIds(JSON.parse(mods.value)); } catch {}
    }
  }

  async function fetchWifiSettings(hId: string) {
    const { data } = await supabase
      .from('home_settings')
      .select('key, value')
      .eq('home_id', hId)
      .in('key', ['wifi_ssid', 'wifi_password', 'wifi_security']);
    if (data) {
      data.forEach(row => {
        if (row.key === 'wifi_ssid') setWifiSsid(row.value ?? '');
        if (row.key === 'wifi_password') setWifiPassword(row.value ?? '');
        if (row.key === 'wifi_security') setWifiSecurity(row.value ?? 'WPA');
      });
    }
  }

  async function saveWifiSettings() {
    if (!homeId) return;
    setWifiSaving(true);
    try {
      await supabase.from('home_settings').upsert([
        { home_id: homeId, key: 'wifi_ssid', value: wifiEditSsid },
        { home_id: homeId, key: 'wifi_password', value: wifiEditPassword },
      ], { onConflict: 'home_id,key' });
      setWifiSsid(wifiEditSsid);
      setWifiPassword(wifiEditPassword);
      setWifiEditing(false);
    } finally {
      setWifiSaving(false);
    }
  }

  async function fetchUpcomingEvents(hId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(today.getDate() + 14);

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('home_id', hId);

    if (!error && data) {
      const processed: any[] = [];
      const currentYear = today.getFullYear();

      data.forEach(e => {
        const d = new Date(e.start_time);
        if (e.recurrence_type === 'yearly') {
          let dProj = new Date(d);
          dProj.setFullYear(currentYear);
          if (dProj < today) dProj.setFullYear(currentYear + 1);
          if (dProj >= today && dProj <= rangeEnd) processed.push({ ...e, display_time: dProj });
        } else {
          if (d >= today && d <= rangeEnd) processed.push({ ...e, display_time: d });
        }
      });
      processed.sort((a, b) => a.display_time.getTime() - b.display_time.getTime());
      setUpcomingEvents(processed);
    }
  }

  async function enableNotifications() {
    if (!swReg.current || !import.meta.env.VITE_VAPID_PUBLIC_KEY || !homeId) return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission as 'default' | 'granted' | 'denied');
    if (permission !== 'granted') return;
    try {
      const existing = await swReg.current.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const sub = await swReg.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      });
      const { endpoint, keys } = sub.toJSON();
      await supabase.from('push_subscriptions').delete().eq('user_id', session.user.id);
      await supabase.from('push_subscriptions').insert(
        { user_id: session.user.id, home_id: homeId, endpoint, p256dh: keys!.p256dh, auth_key: keys!.auth }
      );
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }

  async function handleAvatarColorChange(color: string) {
    setMyAvatarColor(color);
    setMemberColors(prev => ({ ...prev, [session.user.id]: color }));
    await supabase.from('profiles').update({ avatar_color: color }).eq('id', session.user.id);
  }

  async function handleAvatarUpload(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${session.user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { showToast('Upload fehlgeschlagen'); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?v=${Date.now()}`;
    setMyAvatarUrl(url);
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
  }

  async function handleAvatarRemove() {
    setMyAvatarUrl('');
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', session.user.id);
  }

  async function handleThemeChange(newTheme: 'light' | 'dark') {
    setTheme(newTheme);
    await supabase.from('profiles').update({ theme: newTheme }).eq('id', session.user.id);
  }

  async function handleDisplayNameSave(name: string) {
    if (!name.trim()) return;
    setMyDisplayName(name.trim());
    await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id);
  }

  async function handleNotifPrefChange(key: string, value: boolean) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    await supabase.from('profiles').update({ notification_preferences: updated }).eq('id', session.user.id);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (passwordRecovery) return <SetNewPassword onDone={() => setPasswordRecovery(false)} />;
  if (!session) return <Auth onSession={() => {}} />;

  if (homeLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-body-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!homeId) {
    return <HomeOnboarding onHomeReady={() => fetchUserHome(session.user.id)} />;
  }

  // Modules shown in the More tab = active but not in nav slots
  const moreModules = activeModuleIds.filter(id => !navSlots.includes(id));

  // ─── Tab content ───────────────────────────────────────────────────────────
  const renderTab = () => {
    // Module tabs
    if (activeTab === 'calendar') return <Calendar homeId={homeId} language={language} />;
    if (activeTab === 'lists') return <Lists homeId={homeId} language={language} />;
    if (activeTab === 'todos') return <Todos homeId={homeId} userId={session.user.id} language={language} />;
    if (activeTab === 'luna') return (
      <div>
        <h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)' }}>Luna Portal</h1>
        <p className="text-body-md text-muted">{t.comingSoonLuna}</p>
      </div>
    );
    if (activeTab === 'home-info') return (
      <div style={{ paddingBottom: '120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <button onClick={() => setActiveTab('more')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}>←</button>
          <HouseInfoIcon color="#f57c00" size={28} />
          <h1 className="text-display-lg">Home</h1>
        </div>
        <p className="text-body-md text-muted">{t.comingSoonHome}</p>
      </div>
    );
    if (activeTab === 'car') return (
      <div style={{ paddingBottom: '120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <button onClick={() => setActiveTab('more')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}>←</button>
          <CarIcon color="#1e88e5" size={28} />
          <h1 className="text-display-lg">Car</h1>
        </div>
        <p className="text-body-md text-muted">{t.comingSoonCar}</p>
      </div>
    );

    // Notes full view
    if (activeTab === 'notes') return (
      <div style={{ paddingBottom: '120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <button
            onClick={() => setActiveTab('home')}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}
          >←</button>
          <h1 className="text-display-lg">{t.notes}</h1>
        </div>
        <StickyNotes
          session={session}
          homeId={homeId}
          language={language}
          onNewNote={(note) => showToast(`New note from ${note.user_id.slice(0, 6)}`)}
          memberColors={memberColors}
        />
      </div>
    );

    // More tab
    if (activeTab === 'more') return (
      <div style={{ paddingBottom: '120px' }}>
        <h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>{t.more}</h1>

        {/* Active modules not in nav */}
        {moreModules.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            {moreModules.map(id => {
              const meta = MODULE_META.find(m => m.id === id)!;
              return (
                <button
                  key={id}
                  className="menu-card"
                  style={{ width: '100%' }}
                  onClick={() => setActiveTab(id)}
                >
                  <span style={{ marginBottom: 'var(--spacing-xs)', fontSize: '28px' }}>{meta.emoji}</span>
                  <span className="text-title-md">{getModuleLabel(id, t)}</span>
                  <span className="text-body-sm text-muted" style={{ marginTop: '2px' }}>{getModuleDesc(id, t)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Settings rows — always visible, separated */}
        <div style={{
          borderTop: moreModules.length > 0 ? '1px solid var(--color-hairline)' : 'none',
          paddingTop: moreModules.length > 0 ? 'var(--spacing-lg)' : 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <button
            onClick={() => setActiveTab('user-settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              padding: '14px var(--spacing-base)',
              background: 'var(--color-canvas)',
              border: 'none',
              borderRadius: 'var(--rounded-md)',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 'var(--rounded-sm)', background: 'var(--color-surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserIcon color="var(--color-muted)" size={20} />
            </div>
            <div>
              <div className="text-title-md">{t.userSettings}</div>
              <div className="text-body-sm text-muted">{t.userSettingsDesc}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--color-muted)', fontSize: '18px' }}>›</span>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('home-settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: '14px var(--spacing-base)',
                background: 'var(--color-canvas)',
                border: 'none',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 'var(--rounded-sm)', background: 'var(--color-surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SettingsIcon color="var(--color-muted)" size={20} />
              </div>
              <div>
                <div className="text-title-md">{t.homeSettingsMenu}</div>
                <div className="text-body-sm text-muted">{t.homeSettingsMenuDesc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--color-muted)', fontSize: '18px' }}>›</span>
            </button>
          )}
        </div>
      </div>
    );

    // User Settings
    if (activeTab === 'user-settings') return (
      <UserSettingsPage
        language={language}
        onLanguageChange={async (lang) => {
          setLanguage(lang);
          await supabase.from('profiles').update({ language: lang }).eq('id', session.user.id);
        }}
        onBack={() => setActiveTab('more')}
        onLogout={handleLogout}
        notifStatus={notifStatus}
        onReRegister={enableNotifications}
        notifPrefs={notifPrefs}
        onNotifPrefChange={handleNotifPrefChange}
        myDisplayName={myDisplayName}
        myAvatarColor={myAvatarColor}
        onDisplayNameSave={handleDisplayNameSave}
        onAvatarColorChange={handleAvatarColorChange}
        myAvatarUrl={myAvatarUrl}
        theme={theme}
        onThemeChange={handleThemeChange}
        onAvatarUpload={handleAvatarUpload}
        onAvatarRemove={handleAvatarRemove}
      />
    );

    // Home Settings (admin only)
    if (activeTab === 'home-settings') return (
      <HomeSettings
        homeId={homeId}
        language={language}
        isAdmin={userRole === 'admin'}
        onBack={() => {
          // Reload nav config after changes
          fetchHomeConfig(homeId);
          setActiveTab('more');
        }}
        onModuleSettings={(moduleId) => {
          if (moduleId === 'lists') setActiveTab('lists');
        }}
      />
    );

    // Home dashboard
    return (
      <div>
        <div style={{ marginBottom: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
          <h1 className="text-display-lg">{t.dashboard}</h1>
        </div>

        <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <NoteIcon color="var(--color-primary)" size={18} /> {t.notes}
          </h2>
          <StickyNotes
            session={session}
            homeId={homeId}
            compact
            language={language}
            onSeeAll={() => setActiveTab('notes')}
            onNewNote={(note) => showToast(`New note from ${note.user_id.slice(0, 6)}`)}
            memberColors={memberColors}
          />
        </div>

        {activeModuleIds.includes('todos') && (
          <TodosDashboardWidget
            homeId={homeId}
            language={language}
            onNavigate={() => setActiveTab('todos')}
          />
        )}

        <div className="card">
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.upcoming14Days}</h2>
          {upcomingEvents.length === 0 ? (
            <p className="text-body-sm text-muted">{t.noUpcomingEvents}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {upcomingEvents.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid var(--color-hairline-soft)', paddingBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {e.category === 'birthday' && <CakeIcon color="var(--color-luxe)" size={13} />}
                    {e.title}
                  </span>
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
            {t.goToCalendar}
          </button>
        </div>

        {notifStatus === 'default' && import.meta.env.VITE_VAPID_PUBLIC_KEY && (
          <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
              <BellIcon color="var(--color-primary)" size={20} />
              <h3 className="text-title-md">{t.enableNotifications}</h3>
            </div>
            <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>
              {t.enableNotificationsDesc}
            </p>
            <button className="btn-primary" onClick={enableNotifications}>{t.enable}</button>
          </div>
        )}
        <button className="btn-primary" style={{ marginTop: 'var(--spacing-lg)' }} onClick={() => setIsWifiModalOpen(true)}>
          {t.shareWifi}
        </button>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <main className="main-content">
        {renderTab()}
      </main>

      {/* Dynamic Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="bottom-nav-group">
          {[navSlots[0], navSlots[1]].map((slotId, i) =>
            slotId ? (
              <button
                key={slotId}
                className={`bottom-nav-item ${activeTab === slotId ? 'active' : ''}`}
                onClick={() => setActiveTab(slotId)}
              >
                <div className="bottom-nav-icon">
                  <NavModuleIcon id={slotId} active={activeTab === slotId} />
                </div>
                <span className="bottom-nav-label">{getNavLabel(slotId, t)}</span>
              </button>
            ) : (
              <div key={i} style={{ flex: 1 }} />
            )
          )}
        </div>

        <button
          className={`bottom-nav-item-home ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <div className="bottom-nav-icon-home">
            <HomeIcon active={activeTab === 'home'} />
          </div>
        </button>

        <div className="bottom-nav-group">
          {navSlots[2] ? (
            <button
              className={`bottom-nav-item ${activeTab === navSlots[2] ? 'active' : ''}`}
              onClick={() => setActiveTab(navSlots[2])}
            >
              <div className="bottom-nav-icon">
                <NavModuleIcon id={navSlots[2]} active={activeTab === navSlots[2]} />
              </div>
              <span className="bottom-nav-label">{getNavLabel(navSlots[2], t)}</span>
            </button>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          <button
            className={`bottom-nav-item ${activeTab === 'more' ? 'active' : ''}`}
            onClick={() => setActiveTab('more')}
          >
            <div className="bottom-nav-icon"><MoreIcon active={activeTab === 'more'} /></div>
            <span className="bottom-nav-label">{t.navMore}</span>
          </button>
        </div>
      </nav>

      {/* WiFi Modal */}
      {isWifiModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsWifiModalOpen(false); setWifiEditing(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{t.guestWifi}</h2>
              <button className="icon-button-circle" onClick={() => { setIsWifiModalOpen(false); setWifiEditing(false); }}><CloseIcon /></button>
            </div>

            {wifiEditing ? (
              <>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.networkName}</label>
                  <input className="form-input" value={wifiEditSsid} onChange={e => setWifiEditSsid(e.target.value)} placeholder="Network name" />
                </div>
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.password}</label>
                  <input className="form-input" value={wifiEditPassword} onChange={e => setWifiEditPassword(e.target.value)} placeholder="Password" />
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setWifiEditing(false)}>{t.cancel}</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveWifiSettings} disabled={wifiSaving}>
                    {wifiSaving ? '…' : t.save}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-lg)', marginTop: 'var(--spacing-sm)' }}>
                  <QRCodeSVG
                    value={`WIFI:T:${wifiSecurity};S:${wifiSsid};P:${wifiPassword};;`}
                    size={180}
                    level="M"
                  />
                </div>
                <div style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
                  <p className="text-body-md" style={{ fontWeight: 600 }}>{wifiSsid || '—'}</p>
                  <p className="text-body-sm text-muted">{wifiPassword || '—'}</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsWifiModalOpen(false)}>{t.done}</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setWifiEditSsid(wifiSsid); setWifiEditPassword(wifiPassword); setWifiEditing(true); }}>{t.edit}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
