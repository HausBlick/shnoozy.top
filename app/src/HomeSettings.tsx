import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';

export type ModuleId = 'calendar' | 'lists' | 'notes' | 'todos' | 'luna' | 'home-info' | 'car';

interface ModuleMeta {
  id: ModuleId;
  emoji: string;
  color: string;
  hasSettings: boolean;
}

export const MODULE_META: ModuleMeta[] = [
  { id: 'calendar', emoji: '📅', color: 'var(--color-primary)', hasSettings: false },
  { id: 'lists',    emoji: '🛒', color: 'var(--color-primary)', hasSettings: true  },
  { id: 'notes',    emoji: '📝', color: '#ff9500',              hasSettings: false },
  { id: 'todos',    emoji: '✅', color: '#6366f1',              hasSettings: false },
  { id: 'luna',     emoji: '🐾', color: 'var(--color-luxe)',    hasSettings: false },
  { id: 'home-info',emoji: '🏠', color: '#f57c00',              hasSettings: false },
  { id: 'car',      emoji: '🚗', color: '#1e88e5',              hasSettings: false },
];

export const ALL_MODULE_IDS: ModuleId[] = MODULE_META.map(m => m.id);
export const DEFAULT_ACTIVE: ModuleId[] = ['calendar', 'lists', 'notes'];
export const DEFAULT_NAV_SLOTS: ModuleId[] = ['calendar', 'lists', 'notes'];

interface Props {
  homeId: string;
  language: Lang;
  isAdmin: boolean;
  onBack: () => void;
  onModuleSettings: (id: ModuleId) => void;
}

async function generateInviteLink(homeId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-invite', {
    body: { home_id: homeId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.link as string;
}

export function getModuleLabel(id: ModuleId, t: ReturnType<typeof getT>): string {
  switch (id) {
    case 'calendar':  return t.moduleCalendar;
    case 'lists':     return t.moduleLists;
    case 'notes':     return t.moduleNotes;
    case 'todos':     return t.moduleTodos;
    case 'luna':      return t.moduleLuna;
    case 'home-info': return t.moduleHomeInfo;
    case 'car':       return t.moduleCar;
  }
}

export function getModuleDesc(id: ModuleId, t: ReturnType<typeof getT>): string {
  switch (id) {
    case 'calendar':  return t.moduleCalendarDesc;
    case 'lists':     return t.moduleListsDesc;
    case 'notes':     return t.moduleNotesDesc;
    case 'todos':     return t.moduleTodosDesc;
    case 'luna':      return t.moduleLunaDesc;
    case 'home-info': return t.moduleHomeInfoDesc;
    case 'car':       return t.moduleCarDesc;
  }
}

const DragHandleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="4" y1="7" x2="20" y2="7"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
    <line x1="4" y1="17" x2="20" y2="17"/>
  </svg>
);

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export function HomeSettings({ homeId, language, isAdmin, onBack, onModuleSettings }: Props) {
  const t = getT(language);
  const [navSlots, setNavSlots] = useState<ModuleId[]>(DEFAULT_NAV_SLOTS);
  const [activeIds, setActiveIds] = useState<ModuleId[]>(DEFAULT_ACTIVE);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);


  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<ModuleId | null>(null);
  const [ghostY, setGhostY] = useState(0);
  const [insertBeforeId, setInsertBeforeId] = useState<ModuleId | null>(null);
  const [moveToInactive, setMoveToInactive] = useState(false);

  // Refs to avoid stale closures in pointer event handlers
  const activeIdsRef = useRef<ModuleId[]>(activeIds);
  const insertBeforeIdRef = useRef<ModuleId | null>(null);
  const moveToInactiveRef = useRef(false);
  const dividerRef = useRef<HTMLDivElement>(null);
  const itemRefsMap = useRef<Map<ModuleId, HTMLElement>>(new Map());

  useEffect(() => { activeIdsRef.current = activeIds; }, [activeIds]);

  useEffect(() => {
    loadSettings();
  }, [homeId]);

  // Global pointer listeners during drag
  useEffect(() => {
    if (!draggingId) return;

    function onMove(e: PointerEvent) {
      e.preventDefault();
      setGhostY(e.clientY);

      const current = activeIdsRef.current;
      let foundBefore: ModuleId | null = null;
      let isInInactive = false;

      // Check if past the divider
      const divider = dividerRef.current;
      if (divider && e.clientY > divider.getBoundingClientRect().top) {
        isInInactive = true;
      } else {
        for (const id of current) {
          if (id === draggingId) continue;
          const el = itemRefsMap.current.get(id);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            foundBefore = id;
            break;
          }
        }
      }

      insertBeforeIdRef.current = foundBefore;
      moveToInactiveRef.current = isInInactive;
      setInsertBeforeId(foundBefore);
      setMoveToInactive(isInInactive);
    }

    function onUp() {
      const id = draggingId as ModuleId;
      if (moveToInactiveRef.current) {
        setActiveIds(prev => prev.filter(x => x !== id));
      } else {
        setActiveIds(prev => {
          const newActive = prev.filter(x => x !== id);
          const before = insertBeforeIdRef.current;
          if (before !== null && newActive.includes(before)) {
            newActive.splice(newActive.indexOf(before), 0, id);
          } else {
            newActive.push(id);
          }
          return newActive;
        });
      }
      setDraggingId(null);
      setInsertBeforeId(null);
      setMoveToInactive(false);
      insertBeforeIdRef.current = null;
      moveToInactiveRef.current = false;
    }

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [draggingId]);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('home_settings')
        .select('key, value')
        .eq('home_id', homeId)
        .in('key', ['nav_slots', 'modules_active']);
      if (data) {
        const nav = data.find(r => r.key === 'nav_slots');
        const mods = data.find(r => r.key === 'modules_active');
        if (nav?.value) { try { setNavSlots(JSON.parse(nav.value)); } catch {} }
        if (mods?.value) { try { setActiveIds(JSON.parse(mods.value)); } catch {} }
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    const validNavSlots = navSlots.filter(id => activeIds.includes(id));
    await supabase.from('home_settings').upsert([
      { home_id: homeId, key: 'nav_slots', value: JSON.stringify(validNavSlots) },
      { home_id: homeId, key: 'modules_active', value: JSON.stringify(activeIds) },
    ], { onConflict: 'home_id,key' });
    setNavSlots(validNavSlots);
    setSaving(false);
    setEditMode(false);
  }

  function startDrag(e: React.PointerEvent, id: ModuleId) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGhostY(e.clientY);
    setDraggingId(id);
  }

  function toggleActive(id: ModuleId) {
    setActiveIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const inactiveIds = ALL_MODULE_IDS.filter(id => !activeIds.includes(id));

  if (loading) {
    return <p className="text-body-sm text-muted" style={{ marginTop: 'var(--spacing-lg)' }}>{t.loading}</p>;
  }

  const draggingMeta = draggingId ? MODULE_META.find(m => m.id === draggingId) : null;

  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}
        >←</button>
        <h1 className="text-display-lg">{t.homeSettingsMenu}</h1>
      </div>

      {/* Navigation slots */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{t.navigationSection}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {([0, 1, 2] as const).map(slotIdx => (
            <div key={slotIdx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span className="text-body-sm text-muted" style={{ minWidth: 52, fontSize: '13px' }}>
                {t.navSlotN(slotIdx + 1)}
              </span>
              <select
                value={navSlots[slotIdx] ?? ''}
                onChange={e => {
                  const next = [...navSlots];
                  next[slotIdx] = e.target.value as ModuleId;
                  setNavSlots(next);
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 'var(--rounded-sm)',
                  border: '1px solid var(--color-hairline)',
                  background: 'var(--color-canvas)',
                  fontSize: '15px',
                  color: 'var(--color-ink)',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">{t.noModuleSelected}</option>
                {activeIds.map(id => {
                  const meta = MODULE_META.find(m => m.id === id)!;
                  return (
                    <option key={id} value={id}>
                      {meta.emoji} {getModuleLabel(id, t)}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary"
          style={{ marginTop: 'var(--spacing-md)' }}
        >
          {saving ? '…' : t.save}
        </button>
      </div>

      {/* Module manager */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h2 className="text-title-md">{t.modulesSection}</h2>
          <button
            onClick={() => editMode ? saveSettings() : setEditMode(true)}
            style={{
              background: editMode ? 'var(--color-primary)' : 'var(--color-surface-strong)',
              border: 'none',
              borderRadius: 'var(--rounded-sm)',
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: '14px',
              color: editMode ? 'white' : 'var(--color-ink)',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {editMode ? (saving ? '…' : t.doneBtnLabel) : t.editModulesBtn}
          </button>
        </div>

        {/* Active section label */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
          {t.activeModules}
        </div>

        {/* Active modules list */}
        {activeIds.map(id => {
          const meta = MODULE_META.find(m => m.id === id)!;
          const isDragging = draggingId === id;
          const showInsertBefore = insertBeforeId === id && !moveToInactive;

          return (
            <div key={id}>
              {showInsertBefore && (
                <div style={{ height: 2, background: 'var(--color-primary)', borderRadius: 1, margin: '3px 0' }} />
              )}
              <div
                ref={el => { if (el) itemRefsMap.current.set(id, el); else itemRefsMap.current.delete(id); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: '11px 0',
                  opacity: isDragging ? 0.25 : 1,
                  borderBottom: '1px solid var(--color-hairline-soft)',
                  transition: 'opacity 0.1s',
                }}
              >
                {editMode && (
                  <div
                    onPointerDown={e => startDrag(e, id)}
                    style={{
                      cursor: 'grab',
                      color: 'var(--color-muted-soft)',
                      padding: '4px 6px',
                      touchAction: 'none',
                      userSelect: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <DragHandleIcon />
                  </div>
                )}
                <span style={{ fontSize: '20px', lineHeight: 1, width: 28, textAlign: 'center', flexShrink: 0 }}>
                  {meta.emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-body-md" style={{ fontWeight: 500 }}>{getModuleLabel(id, t)}</div>
                  <div className="text-body-sm text-muted">{getModuleDesc(id, t)}</div>
                </div>
                {editMode && meta.hasSettings && (
                  <button
                    onClick={() => onModuleSettings(id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '6px', flexShrink: 0 }}
                    title="Module settings"
                  >
                    <GearIcon />
                  </button>
                )}
                {editMode && (
                  <button
                    onClick={() => toggleActive(id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-muted)',
                      fontSize: '20px',
                      lineHeight: 1,
                      padding: '4px 6px',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Drop indicator at end of active list */}
        {draggingId && !insertBeforeId && !moveToInactive && (
          <div style={{ height: 2, background: 'var(--color-primary)', borderRadius: 1, margin: '3px 0' }} />
        )}

        {/* Divider */}
        <div
          ref={dividerRef}
          style={{
            margin: 'var(--spacing-md) 0 var(--spacing-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--color-hairline)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {t.inactiveModules}
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-hairline)' }} />
        </div>

        {/* Inactive modules */}
        {inactiveIds.length === 0 && (
          <p className="text-body-sm text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-sm) 0' }}>—</p>
        )}
        {inactiveIds.map(id => {
          const meta = MODULE_META.find(m => m.id === id)!;
          return (
            <div
              key={id}
              ref={el => { if (el) itemRefsMap.current.set(id, el); else itemRefsMap.current.delete(id); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                padding: '11px 0',
                opacity: 0.45,
                borderBottom: '1px solid var(--color-hairline-soft)',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1, width: 28, textAlign: 'center', flexShrink: 0 }}>
                {meta.emoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-body-md" style={{ fontWeight: 500 }}>{getModuleLabel(id, t)}</div>
                <div className="text-body-sm text-muted">{getModuleDesc(id, t)}</div>
              </div>
              {editMode && (
                <button
                  onClick={() => toggleActive(id)}
                  style={{
                    background: 'var(--color-surface-strong)',
                    border: 'none',
                    borderRadius: 'var(--rounded-sm)',
                    padding: '5px 12px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--color-ink)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    opacity: 1,
                  }}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite section — admin only */}
      {isAdmin && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)' }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.inviteSection}</h2>
          <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>{t.inviteExpiry}</p>

          {!inviteLink ? (
            <button
              className="btn-primary"
              disabled={inviteLoading}
              onClick={async () => {
                setInviteLoading(true);
                setInviteError(null);
                try {
                  const link = await generateInviteLink(homeId);
                  setInviteLink(link);
                } catch (e: any) {
                  setInviteError(e.message ?? t.inviteError);
                } finally {
                  setInviteLoading(false);
                }
              }}
            >
              {inviteLoading ? t.inviteGenerating : t.generateInvite}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--rounded-sm)',
                padding: '10px 12px',
                fontSize: '13px',
                color: 'var(--color-muted)',
                wordBreak: 'break-all',
              }}>
                {inviteLink}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                {typeof navigator !== 'undefined' && 'share' in navigator ? (
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => navigator.share({ url: inviteLink })}
                  >
                    {t.inviteShare}
                  </button>
                ) : null}
                <button
                  className="btn-primary"
                  style={{ flex: 1, background: inviteCopied ? 'var(--color-surface-strong)' : undefined, color: inviteCopied ? 'var(--color-ink)' : undefined }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteLink);
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 2000);
                  }}
                >
                  {inviteCopied ? t.inviteCopied : t.inviteCopy}
                </button>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: '13px', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
                onClick={() => { setInviteLink(null); setInviteCopied(false); }}
              >
                ↺ {t.generateInvite}
              </button>
            </div>
          )}

          {inviteError && (
            <p style={{ color: '#c13515', fontSize: '13px', marginTop: 'var(--spacing-sm)' }}>{inviteError}</p>
          )}
        </div>
      )}

      {/* Dragging ghost */}
      {draggingMeta && (
        <div
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            top: ghostY - 26,
            background: 'var(--color-canvas)',
            borderRadius: 'var(--rounded-sm)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
            padding: '12px var(--spacing-base)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '20px' }}>{draggingMeta.emoji}</span>
          <span className="text-body-md" style={{ fontWeight: 500 }}>{getModuleLabel(draggingId!, t)}</span>
          {moveToInactive && (
            <span className="text-body-sm text-muted" style={{ marginLeft: 'auto' }}>→ {t.inactiveModules}</span>
          )}
        </div>
      )}
    </div>
  );
}
