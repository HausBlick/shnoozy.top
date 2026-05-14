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

const ExportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
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

export function Calendar({ homeId, language }: { homeId: string; language: Lang }) {
  const t = getT(language);
  const [events, setEvents] = useState<Event[]>([]);
  const [rawEvents, setRawEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  // View state
  const [view, setView] = useState<CalView>('agenda');
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

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchEvents();
  }, [homeId]);


  async function fetchEvents() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('events').select('*').eq('home_id', homeId);
      if (error) throw error;

      setRawEvents(data || []);
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

  function exportICS() {
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Shnoozy//Home Calendar//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:Shnoozy', 'X-WR-TIMEZONE:Europe/Berlin',
    ];
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    rawEvents.forEach(event => {
      const start = new Date(event.start_time);
      const pad = (n: number) => String(n).padStart(2, '0');
      let dtstart: string, dtend: string;
      if (event.is_all_day) {
        const ds = `${start.getUTCFullYear()}${pad(start.getUTCMonth() + 1)}${pad(start.getUTCDate())}`;
        dtstart = `DTSTART;VALUE=DATE:${ds}`;
        dtend = `DTEND;VALUE=DATE:${ds}`;
      } else {
        const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
        dtstart = `DTSTART:${fmt(start)}`;
        const end = event.end_time ? new Date(event.end_time) : new Date(start.getTime() + 3600000);
        dtend = `DTEND:${fmt(end)}`;
      }
      lines.push('BEGIN:VEVENT', `UID:${event.id}@shnoozy.top`, `DTSTAMP:${stamp}`, dtstart, dtend, `SUMMARY:${escapeICS(event.title)}`);
      if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
      if (event.recurrence_type === 'yearly') lines.push('RRULE:FREQ=YEARLY');
      if (event.recurrence_type === 'weekly') lines.push('RRULE:FREQ=WEEKLY');
      lines.push(`CATEGORIES:${event.category.toUpperCase()}`, 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'shnoozy-calendar.ics'; a.click();
    URL.revokeObjectURL(url);
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
    return (
      <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-hairline)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 'var(--spacing-sm)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {d}. {t.monthNames[m - 1]} {y}
        </div>
        {dayEvts.length === 0 ? (
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
          </div>
        )}
      </div>
    );
  };

  // ── Agenda view ───────────────────────────────────────────────────────────

  const renderAgenda = () => {
    const groupedEvents: Record<string, Event[]> = {};
    events.forEach(event => {
      const d = new Date(event.start_time);
      if (d < today) return; // only today + future
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!groupedEvents[key]) groupedEvents[key] = [];
      groupedEvents[key].push(event);
    });

    const sortedKeys = Object.keys(groupedEvents).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
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
                  {groupedEvents[key].map(event => {
                    const age = event.original_birth_year
                      ? new Date(event.start_time).getFullYear() - event.original_birth_year
                      : 0;
                    return (
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
                            {event.is_all_day ? t.allDay : new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {event.description && <div style={{ fontSize: '12px', marginTop: '2px', fontStyle: 'italic' }}>{event.description}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  {dayEvts.slice(0, 2).map(e => (
                    <div key={e.id} style={{
                      fontSize: 11, lineHeight: '15px',
                      borderRadius: 4,
                      padding: '1px 4px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: 500,
                      ...getCatChipStyle(e.category),
                    }}>
                      {e.title}
                    </div>
                  ))}
                  {dayEvts.length > 2 && (
                    <div style={{ fontSize: 10, color: 'var(--color-muted)', textAlign: 'center', lineHeight: '14px' }}>
                      +{dayEvts.length - 2}
                    </div>
                  )}
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
                  {(eventsByDay[k] || []).slice(0, 2).map(e => (
                    <div key={e.id} style={{
                      fontSize: 10, lineHeight: '14px',
                      borderRadius: 3,
                      padding: '1px 3px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      width: '100%', minWidth: 0, fontWeight: 500,
                      ...getCatChipStyle(e.category),
                    }}>
                      {e.title}
                    </div>
                  ))}
                  {(eventsByDay[k] || []).length > 2 && (
                    <div style={{ fontSize: 9, color: 'var(--color-muted)', textAlign: 'center', lineHeight: '13px' }}>
                      +{(eventsByDay[k] || []).length - 2}
                    </div>
                  )}
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
          <button className="icon-button-circle" onClick={exportICS} title="Export as .ics"><ExportIcon /></button>
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
    </div>
  );
}
