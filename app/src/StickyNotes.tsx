import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';

interface StickyNote {
  id: string;
  content: string;
  home_id: string;
  user_id: string;
  visibility: 'private' | 'all' | 'others' | 'both' | 'partner';
  created_at: string;
  updated_at: string;
}

function hexToLight(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * 0.82)},${Math.round(g + (255 - g) * 0.82)},${Math.round(b + (255 - b) * 0.82)})`;
}

type Visibility = 'private' | 'all' | 'others';

function normalizeVisibility(v: string): Visibility {
  if (v === 'private') return 'private';
  if (v === 'others') return 'others';
  return 'all'; // 'all', 'both', 'partner' (legacy) → all visible
}

const STACK_ROT  = [-2.5,  2.0, -1.5];
const STACK_OX   = [  0,   8,   -5 ];
const STACK_OY   = [  0,   6,   10 ];

function getTextConfig(content: string): { fontSize: number; lineClamp: number; overflow: boolean } {
  const len = content.length;
  if (len <= 40) return { fontSize: 21, lineClamp: 6, overflow: false };
  if (len <= 100) return { fontSize: 17, lineClamp: 7, overflow: false };
  if (len <= 210) return { fontSize: 14, lineClamp: 9, overflow: false };
  return { fontSize: 13, lineClamp: 8, overflow: true };
}

interface DeckProps {
  notes: StickyNote[];
  myId: string;
  topIndex: number;
  onSwipe: () => void;
  onSeeAll?: () => void;
  onAdd: () => void;
  labels: { noNotesYet: string; addNote: string; seeAll: string; showAll: string; notesCount: (n: number) => string };
  memberColors: Record<string, string>;
}

function NoteDeck({ notes, myId, topIndex, onSwipe, onSeeAll, onAdd, labels, memberColors }: DeckProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);

  const orderedDeck = useMemo(() =>
    notes.length === 0 ? [] :
    Array.from({ length: notes.length }, (_, i) => notes[(topIndex + i) % notes.length]),
  [notes, topIndex]);

  function onPointerDown(e: React.PointerEvent) {
    if (leaving || notes.length < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dragX) > 60) {
      setLeaving(dragX > 0 ? 'right' : 'left');
      setTimeout(() => {
        onSwipe();
        setLeaving(null);
        setDragX(0);
      }, 230);
    } else {
      setDragX(0);
    }
  }

  if (notes.length === 0) {
    return (
      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-sm)' }}>
          {labels.noNotesYet}
        </p>
        <button onClick={onAdd} style={{ background: 'none', border: '1px dashed var(--color-hairline)', borderRadius: 'var(--rounded-full)', padding: '5px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-muted)' }}>
          {labels.addNote}
        </button>
      </div>
    );
  }

  const CARD = 240;
  const visibleCount = Math.min(3, orderedDeck.length);
  const topDragRot = dragging ? dragX * 0.04 : 0;
  const topTX = leaving === 'right' ? 340 : leaving === 'left' ? -340 : dragX;

  return (
    <div style={{ marginBottom: 'var(--spacing-sm)' }}>
      <div style={{ position: 'relative', height: `${CARD + 18}px`, marginBottom: 'var(--spacing-sm)' }}>
        {Array.from({ length: visibleCount }, (_, renderOrder) => {
          const stackPos = visibleCount - 1 - renderOrder;
          const note = orderedDeck[stackPos];
          const isTop = stackPos === 0;
          const authorColor = memberColors[note.user_id] || '#14d8db';
          const textConfig = getTextConfig(note.content);

          const baseRot = STACK_ROT[stackPos];
          const ox = STACK_OX[stackPos];
          const oy = STACK_OY[stackPos];

          const tx = isTop ? topTX + ox : ox;
          const ty = oy;
          const rot = isTop ? baseRot + topDragRot : baseRot;
          const opacity = isTop && leaving ? 0 : 1;
          const transition = isTop
            ? (dragging ? 'none' : leaving ? 'transform 0.23s ease-out, opacity 0.23s' : 'transform 0.18s ease-out')
            : 'none';

          return (
            <div
              key={note.id}
              className="sticky-note"
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                width: `${CARD}px`,
                height: `${CARD}px`,
                zIndex: visibleCount - stackPos,
                transform: `translate(calc(-50% + ${tx}px), ${ty}px) rotate(${rot}deg)`,
                transition,
                opacity,
                cursor: isTop ? (notes.length > 1 ? (dragging ? 'grabbing' : 'grab') : 'default') : 'default',
                touchAction: 'none',
                userSelect: 'none',
                boxSizing: 'border-box',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: hexToLight(authorColor),
              }}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
            >
              <div className="sticky-note-strip" style={{ background: authorColor }} />
              <p
                className="sticky-note-content"
                style={{
                  fontSize: `${textConfig.fontSize}px`,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: textConfig.lineClamp,
                  WebkitBoxOrient: 'vertical',
                  flex: 1,
                } as React.CSSProperties}
              >
                {note.content}
              </p>
              {textConfig.overflow && isTop && onSeeAll && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onSeeAll(); }}
                  style={{
                    background: 'none', border: 'none', padding: '0 14px 10px',
                    color: 'var(--color-primary)', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', textAlign: 'right', width: '100%',
                  }}
                >
                  {labels.showAll}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onAdd}
          style={{ background: 'none', border: '1px dashed var(--color-hairline)', borderRadius: 'var(--rounded-full)', padding: '5px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-muted)' }}
        >
          {labels.addNote}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {notes.length > 1 && (
            <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {labels.notesCount(notes.length)}
            </span>
          )}
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px', padding: 0 }}
            >
              {labels.seeAll}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  session: any;
  homeId: string;
  compact?: boolean;
  onSeeAll?: () => void;
  onNewNote?: (note: StickyNote) => void;
  language: Lang;
  memberColors?: Record<string, string>;
}

export function StickyNotes({ session, homeId, compact, onSeeAll, onNewNote, language, memberColors = {} }: Props) {
  const t = getT(language);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<StickyNote | null>(null);
  const [content, setContent] = useState('');
  const [visibleTo, setVisibleTo] = useState<Visibility>('all');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deckTopIndex, setDeckTopIndex] = useState(0);

  const myId = session?.user?.id ?? '';

  const visibleNotes = useMemo(() => notes.filter(note => {
    if (note.visibility === 'private') return note.user_id === myId;
    if (note.visibility === 'others') return note.user_id !== myId;
    return true; // 'all', 'both', 'partner' (legacy)
  }), [notes, myId]);

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel(`sticky_notes_${homeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sticky_notes',
        filter: `home_id=eq.${homeId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const note = payload.new as StickyNote;
          const isOwn = note.user_id === myId;
          const isVisibleToMe = note.visibility !== 'private' || isOwn;
          if (!isOwn && isVisibleToMe) onNewNote?.(note);
          setNotes(prev => [note, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as StickyNote : n));
        } else if (payload.eventType === 'DELETE') {
          setNotes(prev => prev.filter(n => n.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [homeId, myId]);

  useEffect(() => {
    if (visibleNotes.length > 0) setDeckTopIndex(prev => prev % visibleNotes.length);
    else setDeckTopIndex(0);
  }, [visibleNotes.length]);

  async function fetchNotes() {
    const { data } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });
    setNotes(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditNote(null);
    setContent('');
    setVisibleTo('all');
    setShowModal(true);
  }

  function openEdit(note: StickyNote) {
    setEditNote(note);
    setContent(note.content);
    setVisibleTo(normalizeVisibility(note.visibility));
    setShowModal(true);
  }

  async function save() {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      if (editNote) {
        await supabase.from('sticky_notes').update({
          content: content.trim(),
          visibility: visibleTo,
          updated_at: new Date().toISOString(),
        }).eq('id', editNote.id);
        setNotes(prev => prev.map(n => n.id === editNote.id
          ? { ...n, content: content.trim(), visibility: visibleTo }
          : n
        ));
      } else {
        const { data } = await supabase.from('sticky_notes').insert({
          content: content.trim(),
          home_id: homeId,
          user_id: myId,
          visibility: visibleTo,
        }).select().single();
        if (data) {
          setNotes(prev => [data, ...prev]);
          if (visibleTo !== 'private') {
            supabase.functions.invoke('send-note-push', {
              body: { home_id: homeId, author_id: myId },
            }).catch(console.error);
          }
        }
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from('sticky_notes').delete().eq('id', id);
    setConfirmDelete(null);
  }

  if (loading) return <p className="text-body-sm text-muted">{t.loading}</p>;

  return (
    <>
      {compact ? (
        <NoteDeck
          notes={visibleNotes}
          myId={myId}
          topIndex={deckTopIndex}
          onSwipe={() => setDeckTopIndex(prev => visibleNotes.length > 0 ? (prev + 1) % visibleNotes.length : 0)}
          onSeeAll={onSeeAll}
          onAdd={openAdd}
          labels={{ noNotesYet: t.noNotesYet, addNote: t.addNote, seeAll: t.seeAll, showAll: t.showAll, notesCount: t.notesCount }}
          memberColors={memberColors}
        />
      ) : (
        <>
          {notes.length === 0 && (
            <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>{t.noNotesYet}</p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
            {visibleNotes.map(note => {
              const authorColor = memberColors[note.user_id] || '#14d8db';
              const isOwn = note.user_id === myId;
              const vis = normalizeVisibility(note.visibility);
              const canEdit = vis === 'all' || (vis === 'private' && isOwn);
              const canDelete = vis === 'all' || (vis === 'private' && isOwn) || (vis === 'others' && !isOwn);
              const visLabel = vis === 'private' ? t.visibilityMe : vis === 'others' ? t.visibilityOthers : t.visibilityAll;
              return (
                <div key={note.id} className="sticky-note" style={{ background: hexToLight(authorColor) }}>
                  <div className="sticky-note-strip" style={{ background: authorColor }} />
                  <p className="sticky-note-content">{note.content}</p>
                  <div className="sticky-note-footer">
                    <span className="sticky-note-meta">{visLabel}</span>
                    {(canEdit || canDelete) && (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {confirmDelete === note.id ? (
                          <>
                            <button onClick={() => deleteNote(note.id)} className="sticky-note-btn" style={{ color: '#e53935' }}>✓</button>
                            <button onClick={() => setConfirmDelete(null)} className="sticky-note-btn">✕</button>
                          </>
                        ) : (
                          <>
                            {canEdit && (
                              <button onClick={() => openEdit(note)} className="sticky-note-btn" aria-label="Edit">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => setConfirmDelete(note.id)} className="sticky-note-btn" aria-label="Delete">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={openAdd} style={{ background: 'none', border: '1px dashed var(--color-hairline)', borderRadius: 'var(--rounded-full)', padding: '5px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-muted)' }}>
              {t.addNote}
            </button>
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{editNote ? t.editNote : t.newNote}</h2>
              <button className="icon-button-circle" onClick={() => setShowModal(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <textarea
              className="form-input"
              placeholder={t.writePlaceholder}
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              style={{ width: '100%', resize: 'vertical', marginBottom: 'var(--spacing-md)', fontFamily: 'inherit' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
              <button
                onClick={() => setVisibleTo('private')}
                className={visibleTo === 'private' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: '13px', width: 'auto' }}
              >
                {t.forMe}
              </button>
              <button
                onClick={() => setVisibleTo('all')}
                className={visibleTo === 'all' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: '13px', width: 'auto' }}
              >
                {t.forAll}
              </button>
              <button
                onClick={() => setVisibleTo('others')}
                className={visibleTo === 'others' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: '13px', width: 'auto' }}
              >
                {t.forOthers}
              </button>
            </div>
            <button
              onClick={save}
              className="btn-primary"
              disabled={saving || !content.trim()}
              style={{ width: '100%' }}
            >
              {saving ? '…' : editNote ? t.saveChanges : t.addNoteAction}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
