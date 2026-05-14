import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  original_birth_year?: number;
  original_id?: string;
  end_time: string | null;
  category: string;
  is_all_day: boolean;
  recurrence_type: string;
}

interface ExternalEvent {
  id: string;
  subscription_id: string;
  uid: string;
  title: string;
  start_time: string;
  end_time: string | null;
  is_all_day: boolean;
  description: string | null;
  calendar_subscriptions: { color: string; name: string } | null;
}

type CalView = 'agenda' | 'month' | 'week';

const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 3 19 3 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const GearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

interface CalSub {
  id: string;
  name: string;
  ics_url: string;
  color: string;
  last_synced_at: string | null;
}

const SUB_COLORS = ['#6366f1', '#ec4899', '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#14b8a6', '#f59e0b'];

function formatSyncDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function getIcalUrl(token: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ics-feed?token=${token}`;
}

function getExternalChipStyle(color: string): React.CSSProperties {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return { background: `rgba(${r},${g},${b},0.12)`, color, borderLeft: `2px solid rgba(${r},${g},${b},0.4)` };
}

function getCatChipStyle(cat: string): React.CSSProperties {
  switch (cat) {
    case 'birthday': return { background: 'rgba(122,4,31,0.12)', color: '#7a041f', borderLeft: '2px solid rgba(122,4,31,0.4)' };
    case 'reminder': return { background: 'rgba(4,179,132,0.12)', color: '#04b384', borderLeft: '2px solid rgba(4,179,132,0.4)' };
    case 'trash':    return { background: 'rgba(191,115,0,0.12)', color: '#bf7300', borderLeft: '2px solid rgba(191,115,0,0.4)' };
    default:         return { background: 'rgba(20,216,219,0.12)', color: '#0099a3', borderLeft: '2px solid rgba(20,216,219,0.4)' };
  }
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function Calendar({ homeId, language, defaultView = 'agenda' }: { homeId: string; language: Lang; defaultView?: 'agenda' | 'month' | 'week' }) {
  const t = getT(language);
  const [events, setEvents] = useState<Event[]>([]);
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  // Calendar settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [icalToken, setIcalToken] = useState<string | null>(null);
  const [icalCopied, setIcalCopied] = useState(false);
  const [icalLoading, setIcalLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<CalSub[]>([]);
  const [showSubForm, setShowSubForm] = useState(false);
  const [subUrl, setSubUrl] = useState('');
  const [subName, setSubName] = useState('');
  const [subColor, setSubColor] = useState(SUB_COLORS[0]);
  const [subSaving, setSubSaving] = useState(false);
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);
  const [showExportInfo, setShowExportInfo] = useState(false);
  const [showImportInfo, setShowImportInfo] = useState(false);

  // View state
  const [view, setView] = useState<CalView>(defaultView);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [category, setCategory] = useState('event');
  const [recurrence, setRecurrence] = useState('none');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayKey = toDayKey(today);

  const eventsByDay = useMemo(() => {
    const map: Record<string, Event[]> = {};
    events.forEach(e => {
      const k = toDayKey(new Date(e.start_time));
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return map;
  }, [events]);

  const externalEventsByDay = useMemo(() => {
    const map: Record<string, ExternalEvent[]> = {};
    externalEvents.forEach(e => {
      const k = toDayKey(new Date(e.start_time));
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return map;
  }, [externalEvents]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchEvents();
    loadCalSettings();
  }, [homeId]);


  async function fetchEvents() {
    try {
      setLoading(true);
      const [{ data, error }, { data: extData }] = await Promise.all([
        supabase.from('events').select('*').eq('home_id', homeId),
        supabase.from('external_events').select('*, calendar_subscriptions(color, name)').eq('home_id', homeId),
      ]);
      if (error) throw error;
      setExternalEvents(extData || []);
      const processedEvents: Event[] = [];
      const currentYear = today.getFullYear();

      (data || []).forEach(e => {
        const originalDate = new Date(e.start_time);
        const birthYear = originalDate.getFullYear();
        if (e.recurrence_type === 'yearly') {
          for (let y = Math.max(birthYear, currentYear - 2); y <= 2100; y++) {
            const dateProj = new Date(e.start_time);
            dateProj.setFullYear(y);
            processedEvents.push({
              ...e,
              id: y === birthYear ? e.id : `${e.id}-${y}`,
              start_time: dateProj.toISOString(),
              original_birth_year: birthYear,
              original_id: e.id,
            });
          }
        } else {
          processedEvents.push(e);
        }
      });

      processedEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setEvents(processedEvents);
    } catch (error: any) {
      console.error('Error fetching events:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCalSettings() {
    const [{ data: setting }, { data: subs }] = await Promise.all([
      supabase.from('home_settings').select('value').eq('home_id', homeId).eq('key', 'ical_token').maybeSingle(),
      supabase.from('calendar_subscriptions').select('id, name, ics_url, color, last_synced_at').eq('home_id', homeId).order('created_at'),
    ]);
    if (setting?.value) setIcalToken(setting.value);
    if (subs) setSubscriptions(subs);
  }

  async function generateIcalToken() {
    setIcalLoading(true);
    const token = crypto.randomUUID();
    await supabase.from('home_settings').upsert(
      { home_id: homeId, key: 'ical_token', value: token },
      { onConflict: 'home_id,key' },
    );
    setIcalToken(token);
    setIcalCopied(false);
    setIcalLoading(false);
  }

  async function addSubscription() {
    if (!subUrl || !subName) return;
    setSubSaving(true);
    try {
      const { data, error } = await supabase
        .from('calendar_subscriptions')
        .insert({ home_id: homeId, name: subName, ics_url: subUrl, color: subColor })
        .select('id, name, ics_url, color, last_synced_at')
        .maybeSingle();
      if (!error && data) {
        setSubscriptions(prev => [...prev, data]);
        setSubUrl(''); setSubName(''); setSubColor(SUB_COLORS[0]);
        setShowSubForm(false);
        await supabase.functions.invoke('sync-ical-subscriptions', { body: { subscription_id: data.id } });
        const { data: updated } = await supabase
          .from('calendar_subscriptions')
          .select('id, name, ics_url, color, last_synced_at')
          .eq('id', data.id)
          .maybeSingle();
        if (updated) setSubscriptions(prev => prev.map(s => s.id === updated.id ? updated : s));
        // Reload external events
        const { data: extData } = await supabase
          .from('external_events')
          .select('*, calendar_subscriptions(color, name)')
          .eq('home_id', homeId);
        setExternalEvents(extData || []);
      }
    } finally {
      setSubSaving(false);
    }
  }

  async function deleteSubscription(id: string) {
    await supabase.from('calendar_subscriptions').delete().eq('id', id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
    setExternalEvents(prev => prev.filter(e => e.subscription_id !== id));
    setConfirmDeleteSubId(null);
  }

  const openEditModal = (event: Event) => {
    const originalId = event.original_id || event.id;
    const original = events.find(e => e.id === originalId) || event;
    setEditingEvent(original);
    setNewTitle(original.title);
    setNewNotes(original.description || '');
    const start = new Date(original.start_time);
    const end = original.end_time ? new Date(original.end_time) : null;
    if (original.is_all_day) {
      setNewStart(start.toISOString().split('T')[0]);
      setNewEnd('');
    } else {
      const pad = (n: number) => n.toString().padStart(2, '0');
      setNewStart(`${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`);
      if (end) {
        setNewEnd(`${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`);
      } else {
        setNewEnd('');
      }
    }
    setIsAllDay(original.is_all_day);
    setCategory(original.category);
    setRecurrence(original.recurrence_type);
    setIsModalOpen(true);
  };

  const closePortal = () => {
    setIsModalOpen(false); setEditingEvent(null); setFormError(null); setConfirmDelete(false);
    setNewTitle(''); setNewNotes(''); setNewStart(''); setNewEnd('');
    setIsAllDay(false); setCategory('event'); setRecurrence('none');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle || !newStart) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const eventData = {
        title: newTitle, description: newNotes,
        start_time: new Date(newStart).toISOString(),
        end_time: newEnd ? new Date(newEnd).toISOString() : null,
        is_all_day: isAllDay, category, recurrence_type: recurrence,
        user_id: user.id, home_id: homeId,
      };
      if (editingEvent) {
        const dbId = editingEvent.original_id || editingEvent.id;
        const { error } = await supabase.from('events').update(eventData).eq('id', dbId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert([eventData]);
        if (error) throw error;
      }
      closePortal(); fetchEvents();
    } catch (error: any) { setFormError(error.message); }
  }

  async function deleteEvent() {
    if (!editingEvent) return;
    try {
      const dbId = editingEvent.original_id || editingEvent.id;
      const { error } = await supabase.from('events').delete().eq('id', dbId);
      if (error) throw error;
      closePortal(); fetchEvents();
    } catch (error: any) { setFormError(error.message); }
  }

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // ── View toggle ──────────────────────────────────────────────────────────

  function switchView(v: CalView) {
    setView(v);
    setSelectedDayKey(null);
    if (v === 'month') {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      setCurrentDate(d);
    } else if (v === 'week') {
      setCurrentDate(getMondayOfWeek(new Date()));
    }
  }

  const renderViewToggle = () => (
    <div style={{ display: 'flex', background: 'var(--color-surface)', borderRadius: 'var(--rounded-lg)', padding: '3px', gap: '3px' }}>
      {(['agenda', 'month', 'week'] as CalView[]).map(v => (
        <button
          key={v}
          onClick={() => switchView(v)}
          style={{
            flex: 1, padding: '8px 4px',
            borderRadius: 'calc(var(--rounded-lg) - 2px)',
            border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '13px', fontFamily: 'inherit',
            background: view === v ? 'var(--color-canvas)' : 'transparent',
            color: view === v ? 'var(--color-ink)' : 'var(--color-muted)',
            boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {v === 'agenda' ? t.viewAgenda : v === 'month' ? t.viewMonth : t.viewWeek}
        </button>
      ))}
    </div>
  );

  // ── Day detail panel (shared by month + week) ─────────────────────────────

  const renderDayDetail = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    const dayEvts = (eventsByDay[key] || []).sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    const extEvts = (externalEventsByDay[key] || []).sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    return (
      <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-hairline)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 'var(--spacing-sm)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {d}. {t.monthNames[m - 1]} {y}
        </div>
        {dayEvts.length === 0 && extEvts.length === 0 ? (
          <p className="text-body-sm text-muted" style={{ padding: '8px 0' }}>{t.noEventsDay}</p>
        ) : (
          <div className="schedule-container">
            {dayEvts.map(event => {
              const age = event.original_birth_year
                ? new Date(event.start_time).getFullYear() - event.original_birth_year
                : 0;
              return (
                <div
                  key={event.id}
                  className={`schedule-event-item ${event.category || 'event'}`}
                  onClick={() => openEditModal(event)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="text-title-md">
                      {event.category === 'birthday' ? '🎂 ' : ''}{event.title}
                      {event.category === 'birthday' && age > 0 && (
                        <span style={{ color: 'var(--color-luxe)', fontWeight: 600, marginLeft: 8, fontSize: 14 }}>
                          ({getOrdinal(age)})
                        </span>
                      )}
                    </div>
                    <div className="text-body-sm text-muted">
                      {event.is_all_day ? t.allDay : new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {event.description && <div style={{ fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>{event.description}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
            {extEvts.map(event => {
              const color = event.calendar_subscriptions?.color || '#6366f1';
              return (
                <div key={`ext-${event.id}`} className="schedule-event-item" style={{ borderLeft: `3px solid ${color}`, cursor: 'default' }}>
                  <div style={{ flex: 1 }}>
                    <div className="text-title-md">{event.title}</div>
                    <div className="text-body-sm text-muted">
                      {event.is_all_day ? t.allDay : new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {event.calendar_subscriptions?.name && (
                        <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>· {event.calendar_subscriptions.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Agenda view ───────────────────────────────────────────────────────────

  const renderAgenda = () => {
    type AgendaItem = { time: number; node: React.ReactNode; key: string };
    const grouped: Record<string, AgendaItem[]> = {};

    events.forEach(event => {
      const d = new Date(event.start_time);
      if (d < today) return;
      const key = toDayKey(d);
      if (!grouped[key]) grouped[key] = [];
      const age = event.original_birth_year ? d.getFullYear() - event.original_birth_year : 0;
      grouped[key].push({
        time: d.getTime(),
        key: event.id,
        node: (
          <div
            key={event.id}
            id={`event-${event.id}`}
            className={`schedule-event-item ${event.category || 'event'}`}
            onClick={() => openEditModal(event)}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ flex: 1 }}>
              <div className="text-title-md">
                {event.category === 'birthday' ? '🎂 ' : ''}{event.title}
                {event.category === 'birthday' && age > 0 && (
                  <span style={{ color: 'var(--color-luxe)', fontWeight: 600, marginLeft: '8px', fontSize: '14px' }}>
                    ({getOrdinal(age)})
                  </span>
                )}
              </div>
              <div className="text-body-sm text-muted">
                {event.is_all_day ? t.allDay : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {event.description && <div style={{ fontSize: '12px', marginTop: '2px', fontStyle: 'italic' }}>{event.description}</div>}
              </div>
            </div>
          </div>
        ),
      });
    });

    externalEvents.forEach(event => {
      const d = new Date(event.start_time);
      if (d < today) return;
      const key = toDayKey(d);
      if (!grouped[key]) grouped[key] = [];
      const color = event.calendar_subscriptions?.color || '#6366f1';
      grouped[key].push({
        time: d.getTime(),
        key: `ext-${event.id}`,
        node: (
          <div key={`ext-${event.id}`} className="schedule-event-item" style={{ borderLeft: `3px solid ${color}`, cursor: 'default' }}>
            <div style={{ flex: 1 }}>
              <div className="text-title-md">{event.title}</div>
              <div className="text-body-sm text-muted">
                {event.is_all_day ? t.allDay : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {event.calendar_subscriptions?.name && (
                  <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>· {event.calendar_subscriptions.name}</span>
                )}
              </div>
            </div>
          </div>
        ),
      });
    });

    Object.values(grouped).forEach(arr => arr.sort((a, b) => a.time - b.time));
    const sortedKeys = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    let currentMonthYear = '';

    return (
      <div className="schedule-container">
        {sortedKeys.map(key => {
          const [yStr, mStr, dStr] = key.split('-');
          const date = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr));
          const m = date.getMonth() + 1;
          const d = date.getDate();
          const y = date.getFullYear();
          const monthYear = `${t.monthNames[m - 1]} ${y}`;
          const isToday = y === today.getFullYear() && m === (today.getMonth() + 1) && d === today.getDate();

          const monthDivider = monthYear !== currentMonthYear ? (
            <div key={`month-${monthYear}`} className="schedule-month-divider">{monthYear}</div>
          ) : null;
          currentMonthYear = monthYear;

          return (
            <div key={key} style={{ display: 'contents' }}>
              {monthDivider}
              <div className="schedule-day-group">
                <div className="schedule-date-sidebar">
                  <span className="schedule-day-name">{t.dayNames[date.getDay()]}</span>
                  <span className={`schedule-day-number ${isToday ? 'today' : ''}`}>{d}</span>
                </div>
                <div className="schedule-events">
                  {grouped[key].map(item => item.node)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Month view ─────────────────────────────────────────────────────────────

  const renderMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    // Mon–Sun headers using existing dayNames array (0=Sun)
    const weekDayHeaders = [1, 2, 3, 4, 5, 6, 0].map(i => t.dayNames[i]);

    return (
      <div>
        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
          <button
            onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDayKey(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 22, padding: '4px 10px', lineHeight: 1 }}
          >←</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{t.monthNames[month]} {year}</span>
          <button
            onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDayKey(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 22, padding: '4px 10px', lineHeight: 1 }}
          >→</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {weekDayHeaders.map(h => (
            <div key={h} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', padding: '2px 0', letterSpacing: '0.3px' }}>{h}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const cellDate = new Date(year, month, day);
            const isPast = cellDate < today;
            const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
            const k = `${year}-${month + 1}-${day}`;
            const isSelected = selectedDayKey === k;
            const dayEvts = eventsByDay[k] || [];

            return (
              <div
                key={idx}
                onClick={() => setSelectedDayKey(isSelected ? null : k)}
                style={{
                  cursor: 'pointer', padding: '3px 2px 5px',
                  borderRadius: 8, minHeight: 76,
                  background: isSelected ? 'var(--color-surface)' : 'transparent',
                  minWidth: 0,
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 3px',
                  background: isToday ? 'var(--color-primary)' : 'transparent',
                  color: isToday ? 'white' : isPast ? 'var(--color-muted-soft)' : 'var(--color-ink)',
                  fontSize: 13, fontWeight: isToday ? 700 : 400,
                }}>
                  {day}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingInline: 1, minWidth: 0 }}>
                  {(() => {
                    const extEvts = externalEventsByDay[k] || [];
                    const regChips = dayEvts.slice(0, 2);
                    const extChips = regChips.length < 2 ? extEvts.slice(0, 2 - regChips.length) : [];
                    const overflow = dayEvts.length + extEvts.length - regChips.length - extChips.length;
                    return (
                      <>
                        {regChips.map(e => (
                          <div key={e.id} style={{ fontSize: 11, lineHeight: '15px', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, ...getCatChipStyle(e.category) }}>{e.title}</div>
                        ))}
                        {extChips.map(e => (
                          <div key={`ext-${e.id}`} style={{ fontSize: 11, lineHeight: '15px', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, ...getExternalChipStyle(e.calendar_subscriptions?.color || '#6366f1') }}>{e.title}</div>
                        ))}
                        {overflow > 0 && <div style={{ fontSize: 10, color: 'var(--color-muted)', textAlign: 'center', lineHeight: '14px' }}>+{overflow}</div>}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {selectedDayKey && renderDayDetail(selectedDayKey)}
      </div>
    );
  };

  // ── Week view ──────────────────────────────────────────────────────────────

  const renderWeek = () => {
    const monday = getMondayOfWeek(currentDate);
    const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const weekNum = getWeekNumber(monday);
    const endOfWeek = weekDays[6];

    const sameMonth = monday.getMonth() === endOfWeek.getMonth();
    const rangeLabel = sameMonth
      ? `${monday.getDate()}. – ${endOfWeek.getDate()}. ${t.monthNames[monday.getMonth()]} ${monday.getFullYear()}`
      : `${monday.getDate()}. ${t.monthNames[monday.getMonth()]} – ${endOfWeek.getDate()}. ${t.monthNames[endOfWeek.getMonth()]}`;

    // Auto-select today if in this week, else Monday
    const isCurrentWeek = weekDays.some(d => toDayKey(d) === todayKey);
    const effectiveKey = selectedDayKey ?? (isCurrentWeek ? todayKey : toDayKey(monday));

    return (
      <div>
        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
          <button
            onClick={() => {
              const prev = new Date(monday);
              prev.setDate(monday.getDate() - 7);
              setCurrentDate(prev);
              setSelectedDayKey(null);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 22, padding: '4px 10px', lineHeight: 1 }}
          >←</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.weekLabel(weekNum)}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{rangeLabel}</div>
          </div>
          <button
            onClick={() => {
              const next = new Date(monday);
              next.setDate(monday.getDate() + 7);
              setCurrentDate(next);
              setSelectedDayKey(null);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 22, padding: '4px 10px', lineHeight: 1 }}
          >→</button>
        </div>

        {/* 7-day strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 'var(--spacing-md)' }}>
          {weekDays.map(d => {
            const k = toDayKey(d);
            const isToday = k === todayKey;
            const isSelected = k === effectiveKey;
            const dayLabel = t.dayNames[d.getDay()];

            return (
              <div
                key={k}
                onClick={() => setSelectedDayKey(k)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  cursor: 'pointer', padding: '6px 2px 5px', borderRadius: 10,
                  background: isSelected ? 'var(--color-surface)' : 'transparent',
                  transition: 'background 0.15s', minWidth: 0,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-muted)', letterSpacing: '0.3px' }}>{dayLabel}</span>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--color-primary)' : 'transparent',
                  color: isToday ? 'white' : 'var(--color-ink)',
                  fontSize: 15, fontWeight: isToday || isSelected ? 700 : 400,
                }}>
                  {d.getDate()}
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  {(() => {
                    const regEvts = eventsByDay[k] || [];
                    const extEvts = externalEventsByDay[k] || [];
                    const regChips = regEvts.slice(0, 2);
                    const extChips = regChips.length < 2 ? extEvts.slice(0, 2 - regChips.length) : [];
                    const overflow = regEvts.length + extEvts.length - regChips.length - extChips.length;
                    return (
                      <>
                        {regChips.map(e => (
                          <div key={e.id} style={{ fontSize: 10, lineHeight: '14px', borderRadius: 3, padding: '1px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', minWidth: 0, fontWeight: 500, ...getCatChipStyle(e.category) }}>{e.title}</div>
                        ))}
                        {extChips.map(e => (
                          <div key={`ext-${e.id}`} style={{ fontSize: 10, lineHeight: '14px', borderRadius: 3, padding: '1px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', minWidth: 0, fontWeight: 500, ...getExternalChipStyle(e.calendar_subscriptions?.color || '#6366f1') }}>{e.title}</div>
                        ))}
                        {overflow > 0 && <div style={{ fontSize: 9, color: 'var(--color-muted)', textAlign: 'center', lineHeight: '13px' }}>+{overflow}</div>}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {renderDayDetail(effectiveKey)}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--color-canvas)',
        paddingTop: 'var(--spacing-md)',
        paddingBottom: '10px',
        marginBottom: 'var(--spacing-sm)',
      }}
      ref={stickyHeaderRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
          <h1 className="text-display-lg">{t.schedule}</h1>
          <button className="icon-button-circle" onClick={() => setSettingsOpen(true)} title={t.calSettingsTitle}><GearIcon /></button>
        </div>
        {renderViewToggle()}
      </div>

      {loading ? (
        <p className="text-body-sm text-muted">{t.loading}</p>
      ) : view === 'agenda' ? renderAgenda()
        : view === 'month' ? renderMonth()
        : renderWeek()}

      <button className="fab" onClick={() => setIsModalOpen(true)}><PlusIcon /></button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closePortal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 'var(--spacing-lg)' }}>
            <div className="modal-header">
              <h2 className="text-title-md" style={{ fontSize: '20px' }}>{editingEvent ? t.editEntry : t.newEntry}</h2>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                {editingEvent && !confirmDelete && (
                  <button onClick={() => setConfirmDelete(true)} className="icon-button-circle" style={{ color: '#c13515' }} title="Delete"><TrashIcon /></button>
                )}
                <button className="icon-button-circle" onClick={closePortal}><CloseIcon /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t.title}</label>
                <input type="text" placeholder={t.titlePlaceholder} value={newTitle} onChange={e => setNewTitle(e.target.value)} className="form-input" required />
              </div>
              <div className="form-group">
                <label className="form-label">{t.notesLabel}</label>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder={t.notesPlaceholder} />
              </div>
              <div className="form-group" style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t.category}</label>
                  <select className="form-input" value={category} onChange={e => { setCategory(e.target.value); if (e.target.value === 'birthday') setRecurrence('yearly'); }}>
                    <option value="event">{t.catEvent}</option>
                    <option value="birthday">{t.catBirthday}</option>
                    <option value="reminder">{t.catReminder}</option>
                    <option value="trash">{t.catTrash}</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t.recurrence}</label>
                  <select className="form-input" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                    <option value="none">{t.recNone}</option>
                    <option value="yearly">{t.recYearly}</option>
                    <option value="weekly">{t.recWeekly}</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 'var(--spacing-base)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                  {t.allDayEvent}
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xl)' }}>
                <div className="form-group">
                  <label className="form-label">{t.start}</label>
                  <input type={isAllDay ? 'date' : 'datetime-local'} value={newStart} onChange={e => setNewStart(e.target.value)} className="form-input" required />
                </div>
                {!isAllDay && (
                  <div className="form-group">
                    <label className="form-label">{t.end}</label>
                    <input type="datetime-local" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="form-input" />
                  </div>
                )}
              </div>
              {formError && <div style={{ color: '#c13515', fontSize: '14px', marginBottom: 'var(--spacing-sm)' }}>{formError}</div>}
              {confirmDelete ? (
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                  <span style={{ fontSize: '14px', flex: 1 }}>{t.confirmDeleteEntry}</span>
                  <button type="button" onClick={deleteEvent} className="btn-primary" style={{ background: '#c13515', fontSize: '14px', padding: '8px 16px' }}>{t.delete}</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="icon-button-circle"><CloseIcon /></button>
                </div>
              ) : (
                <button type="submit" className="btn-primary" style={{ fontSize: '18px', fontWeight: 600 }}>
                  {editingEvent ? t.updateEntry : t.saveToSchedule}
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Calendar settings modal */}
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 'var(--spacing-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2 className="text-title-md" style={{ fontSize: '20px' }}>{t.calSettingsTitle}</h2>
              <button className="icon-button-circle" onClick={() => setSettingsOpen(false)}><CloseIcon /></button>
            </div>

            {/* Export section */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--spacing-sm)' }}>
                <span className="text-title-md" style={{ fontWeight: 700 }}>{t.icalSection}</span>
                <button
                  onClick={() => setShowExportInfo(v => !v)}
                  style={{ background: 'none', border: '1.5px solid var(--color-muted)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-muted)', padding: 0, flexShrink: 0 }}
                >
                  <InfoIcon />
                </button>
              </div>
              {showExportInfo && (
                <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-sm)', fontSize: 13, lineHeight: 1.5 }}>{t.icalDesc}</p>
              )}
              {!icalToken ? (
                <button className="btn-primary" disabled={icalLoading} onClick={generateIcalToken} style={{ width: '100%' }}>
                  {icalLoading ? '…' : t.icalGenerateLink}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--rounded-sm)', padding: '10px 12px', fontSize: 12, color: 'var(--color-muted)', wordBreak: 'break-all' }}>
                    {getIcalUrl(icalToken)}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => navigator.share({ url: getIcalUrl(icalToken) })}>{t.icalShare}</button>
                    )}
                    <button
                      className="btn-primary"
                      style={{ flex: 1, background: icalCopied ? 'var(--color-surface-strong)' : undefined, color: icalCopied ? 'var(--color-ink)' : undefined }}
                      onClick={async () => { await navigator.clipboard.writeText(getIcalUrl(icalToken)); setIcalCopied(true); setTimeout(() => setIcalCopied(false), 2000); }}
                    >
                      {icalCopied ? t.icalCopied : t.icalCopyUrl}
                    </button>
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 13, cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}
                    onClick={generateIcalToken} disabled={icalLoading}
                  >
                    {t.icalReset}
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--color-hairline)', margin: '0 0 var(--spacing-lg)' }} />

            {/* Import section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--spacing-sm)' }}>
                <span className="text-title-md" style={{ fontWeight: 700 }}>{t.calSubSection}</span>
                <button
                  onClick={() => setShowImportInfo(v => !v)}
                  style={{ background: 'none', border: '1.5px solid var(--color-muted)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-muted)', padding: 0, flexShrink: 0 }}
                >
                  <InfoIcon />
                </button>
              </div>
              {showImportInfo && (
                <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-sm)', fontSize: 13, lineHeight: 1.5 }}>{t.calSubDesc}</p>
              )}

              {subscriptions.map(sub => (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: '10px 0', borderBottom: '1px solid var(--color-hairline-soft)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: sub.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-body-md" style={{ fontWeight: 500 }}>{sub.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                      {sub.last_synced_at ? t.calSubLastSynced(formatSyncDate(sub.last_synced_at, language)) : t.calSubNeverSynced}
                    </div>
                  </div>
                  {confirmDeleteSubId === sub.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => deleteSubscription(sub.id)} style={{ background: '#c13515', border: 'none', borderRadius: 6, color: 'white', padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✓</button>
                      <button onClick={() => setConfirmDeleteSubId(null)} style={{ background: 'var(--color-surface-strong)', border: 'none', borderRadius: 6, color: 'var(--color-ink)', padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteSubId(sub.id)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '4px 6px' }}>×</button>
                  )}
                </div>
              ))}

              {!showSubForm ? (
                <button className="btn-primary" onClick={() => setShowSubForm(true)} style={{ marginTop: subscriptions.length > 0 ? 'var(--spacing-md)' : 4, width: '100%' }}>
                  {t.calSubAdd}
                </button>
              ) : (
                <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <input className="form-input" placeholder={t.calSubUrlPlaceholder} value={subUrl} onChange={e => setSubUrl(e.target.value)} type="url" />
                  <input className="form-input" placeholder={t.calSubNamePlaceholder} value={subName} onChange={e => setSubName(e.target.value)} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '2px 0' }}>
                    {SUB_COLORS.map(c => (
                      <button key={c} onClick={() => setSubColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', border: subColor === c ? '3px solid var(--color-ink)' : '2px solid transparent', background: c, cursor: 'pointer', padding: 0, outline: 'none' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button className="btn-primary" onClick={addSubscription} disabled={!subUrl || !subName || subSaving} style={{ flex: 1 }}>
                      {subSaving ? t.calSubSyncing : t.calSubSave}
                    </button>
                    <button
                      onClick={() => { setShowSubForm(false); setSubUrl(''); setSubName(''); setSubColor(SUB_COLORS[0]); }}
                      style={{ flex: 1, background: 'var(--color-surface-strong)', border: 'none', borderRadius: 'var(--rounded-sm)', padding: '12px', fontWeight: 600, fontSize: '15px', cursor: 'pointer', color: 'var(--color-ink)' }}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
