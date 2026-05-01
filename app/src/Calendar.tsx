import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';

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

export function Calendar() {
  const [events, setEvents] = useState<Event[]>([]);
  const [rawEvents, setRawEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const todayRef = useRef<HTMLDivElement>(null);

  // Form State
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

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (!loading && events.length > 0) {
      const timer = setTimeout(() => {
        if (todayRef.current) {
          todayRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
          window.scrollBy(0, -20);
        } else {
          const firstUpcoming = events.find(e => new Date(e.start_time) >= today);
          if (firstUpcoming) {
            const el = document.getElementById(`event-${firstUpcoming.id}`);
            el?.scrollIntoView({ behavior: 'auto', block: 'start' });
            window.scrollBy(0, -80);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, events]);

  async function fetchEvents() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('events').select('*');
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
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Shnoozy//Home Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Shnoozy',
      'X-WR-TIMEZONE:Europe/Berlin',
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
        const fmt = (d: Date) =>
          `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
        dtstart = `DTSTART:${fmt(start)}`;
        const end = event.end_time ? new Date(event.end_time) : new Date(start.getTime() + 3600000);
        dtend = `DTEND:${fmt(end)}`;
      }

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}@shnoozy.top`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(dtstart);
      lines.push(dtend);
      lines.push(`SUMMARY:${escapeICS(event.title)}`);
      if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
      if (event.recurrence_type === 'yearly') lines.push('RRULE:FREQ=YEARLY');
      if (event.recurrence_type === 'weekly') lines.push('RRULE:FREQ=WEEKLY');
      lines.push(`CATEGORIES:${event.category.toUpperCase()}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shnoozy-calendar.ics';
    a.click();
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
      // Local time formatting for input
      const pad = (n: number) => n.toString().padStart(2, '0');
      const startLocal = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
      setNewStart(startLocal);
      
      if (end) {
        const endLocal = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
        setNewEnd(endLocal);
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
    setIsModalOpen(false);
    setEditingEvent(null);
    setFormError(null);
    setConfirmDelete(false);
    setNewTitle('');
    setNewNotes('');
    setNewStart('');
    setNewEnd('');
    setIsAllDay(false);
    setCategory('event');
    setRecurrence('none');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle || !newStart) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const eventData = {
        title: newTitle,
        description: newNotes,
        start_time: new Date(newStart).toISOString(),
        end_time: newEnd ? new Date(newEnd).toISOString() : null,
        is_all_day: isAllDay,
        category: category,
        recurrence_type: recurrence,
        user_id: user.id,
      };

      if (editingEvent) {
        const { error } = await supabase.from('events').update(eventData).eq('id', editingEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert([eventData]);
        if (error) throw error;
      }

      closePortal();
      fetchEvents();
    } catch (error: any) {
      setFormError(error.message);
    }
  }

  async function deleteEvent() {
    if (!editingEvent) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', editingEvent.id);
      if (error) throw error;
      closePortal();
      fetchEvents();
    } catch (error: any) {
      setFormError(error.message);
    }
  }

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const groupedEvents: { [key: string]: Event[] } = {};
  events.forEach(event => {
    const d = new Date(event.start_time);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!groupedEvents[key]) groupedEvents[key] = [];
    groupedEvents[key].push(event);
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const renderSchedule = () => {
    const sortedKeys = Object.keys(groupedEvents).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    let currentMonthYear = "";

    return (
      <div className="schedule-container">
        {sortedKeys.map(key => {
          const dateParts = key.split('-');
          const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
          const m = date.getMonth() + 1;
          const d = date.getDate();
          const y = date.getFullYear();
          const monthYear = `${monthNames[m - 1]} ${y}`;
          const isToday = y === today.getFullYear() && m === (today.getMonth() + 1) && d === today.getDate();
          
          const monthDivider = monthYear !== currentMonthYear ? (
            <div key={`month-${monthYear}`} className="schedule-month-divider">{monthYear}</div>
          ) : null;
          currentMonthYear = monthYear;

          return (
            <div key={key} style={{ display: 'contents' }}>
              {monthDivider}
              <div className="schedule-day-group" ref={isToday ? todayRef : null}>
                <div className="schedule-date-sidebar">
                  <span className="schedule-day-name">{dayNames[date.getDay()]}</span>
                  <span className={`schedule-day-number ${isToday ? 'today' : ''}`}>{d}</span>
                </div>
                <div className="schedule-events">
                  {groupedEvents[key].map(event => {
                    const currentEventDate = new Date(event.start_time);
                    const age = event.original_birth_year ? currentEventDate.getFullYear() - event.original_birth_year : 0;
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
                            {event.is_all_day ? 'All day' : new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <h1 className="text-display-lg">Schedule</h1>
        <button className="icon-button-circle" onClick={exportICS} title="Export as .ics"><ExportIcon /></button>
      </div>
      {loading ? <p className="text-body-sm text-muted">Loading...</p> : renderSchedule()}

      <button className="fab" onClick={() => setIsModalOpen(true)}><PlusIcon /></button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closePortal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 'var(--spacing-lg)' }}>
            <div className="modal-header">
              <h2 className="text-title-md" style={{ fontSize: '20px' }}>{editingEvent ? 'Edit Entry' : 'New Entry'}</h2>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                {editingEvent && !confirmDelete && (
                  <button onClick={() => setConfirmDelete(true)} className="icon-button-circle" style={{ color: '#c13515' }} title="Delete"><TrashIcon /></button>
                )}
                <button className="icon-button-circle" onClick={closePortal}><CloseIcon /></button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input type="text" placeholder="What's happening?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="form-input" required />
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Phone, Address...)</label>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Add details..." />
              </div>
              
              <div className="form-group" style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={category} onChange={(e) => {
                    setCategory(e.target.value);
                    if (e.target.value === 'birthday') setRecurrence('yearly');
                  }}>
                    <option value="event">Event</option>
                    <option value="birthday">Birthday 🎂</option>
                    <option value="reminder">Reminder</option>
                    <option value="trash">Trash 🗑️</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Recurrence</label>
                  <select className="form-input" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                    <option value="none">None</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly (Soon)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 'var(--spacing-base)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
                  All Day Event
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xl)' }}>
                <div className="form-group">
                  <label className="form-label">Start</label>
                  <input type={isAllDay ? "date" : "datetime-local"} value={newStart} onChange={(e) => setNewStart(e.target.value)} className="form-input" required />
                </div>
                {!isAllDay && (
                  <div className="form-group">
                    <label className="form-label">End</label>
                    <input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="form-input" />
                  </div>
                )}
              </div>

              {formError && (
                <div style={{ color: '#c13515', fontSize: '14px', marginBottom: 'var(--spacing-sm)' }}>{formError}</div>
              )}

              {confirmDelete ? (
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                  <span style={{ fontSize: '14px', flex: 1 }}>Really delete this entry?</span>
                  <button type="button" onClick={deleteEvent} className="btn-primary" style={{ background: '#c13515', fontSize: '14px', padding: '8px 16px' }}>Delete</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="icon-button-circle"><CloseIcon /></button>
                </div>
              ) : (
                <button type="submit" className="btn-primary" style={{ fontSize: '18px', fontWeight: 600 }}>
                  {editingEvent ? 'Update Entry' : 'Save to Schedule'}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
