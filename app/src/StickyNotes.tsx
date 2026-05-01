import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface StickyNote {
  id: string;
  content: string;
  created_by: string;
  creator_email: string;
  visible_to: 'me' | 'partner' | 'both';
  created_at: string;
  updated_at: string;
}

const NOTE_COLOR: Record<string, 'primary' | 'luxe'> = {
  'nikolakrnic2@gmail.com': 'primary',
  'heromustafi@gmail.com': 'luxe',
};

function colorFor(email: string): 'primary' | 'luxe' {
  return NOTE_COLOR[email] ?? 'primary';
}

interface Props {
  session: any;
  compact?: boolean;
  onSeeAll?: () => void;
  onNewNote?: (note: StickyNote) => void;
}

export function StickyNotes({ session, compact, onSeeAll, onNewNote }: Props) {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<StickyNote | null>(null);
  const [content, setContent] = useState('');
  const [visibleTo, setVisibleTo] = useState<'both' | 'partner'>('both');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const myEmail = session?.user?.email ?? '';
  const myId = session?.user?.id ?? '';

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel('sticky_notes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sticky_notes' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const note = payload.new as StickyNote;
          const isOwn = note.created_by === myId;
          const shouldSee = isOwn || note.visible_to !== 'me';
          if (shouldSee) {
            if (!isOwn) onNewNote?.(note);
            setNotes(prev => [note, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as StickyNote : n));
        } else if (payload.eventType === 'DELETE') {
          setNotes(prev => prev.filter(n => n.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [myId]);

  async function fetchNotes() {
    const { data } = await supabase
      .from('sticky_notes')
      .select('*')
      .order('created_at', { ascending: false });
    setNotes(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditNote(null);
    setContent('');
    setVisibleTo('both');
    setShowModal(true);
  }

  function openEdit(note: StickyNote) {
    setEditNote(note);
    setContent(note.content);
    setVisibleTo(note.visible_to === 'partner' ? 'partner' : 'both');
    setShowModal(true);
  }

  async function save() {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      if (editNote) {
        await supabase.from('sticky_notes').update({
          content: content.trim(),
          visible_to: visibleTo,
          updated_at: new Date().toISOString(),
        }).eq('id', editNote.id);
        setNotes(prev => prev.map(n => n.id === editNote.id
          ? { ...n, content: content.trim(), visible_to: visibleTo }
          : n
        ));
      } else {
        const { data } = await supabase.from('sticky_notes').insert({
          content: content.trim(),
          created_by: myId,
          creator_email: myEmail,
          visible_to: visibleTo,
        }).select().single();
        if (data) setNotes(prev => [data, ...prev]);
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

  const displayed = compact ? notes.slice(0, 2) : notes;

  if (loading) return <p className="text-body-sm text-muted">Loading...</p>;

  return (
    <>
      {displayed.length === 0 && !compact && (
        <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>No notes yet — add the first one!</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
        {displayed.map(note => {
          const color = colorFor(note.creator_email);
          const isOwn = note.created_by === myId;
          return (
            <div key={note.id} className={`sticky-note sticky-note-${color}`}>
              <div className={`sticky-note-strip sticky-note-strip-${color}`} />
              <p className="sticky-note-content">{note.content}</p>
              <div className="sticky-note-footer">
                <span className="sticky-note-meta">
                  {note.visible_to === 'partner' ? '→ Partner' : '↔ Both'}
                </span>
                {isOwn && (
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {confirmDelete === note.id ? (
                      <>
                        <button onClick={() => deleteNote(note.id)} className="sticky-note-btn" style={{ color: '#e53935' }}>✓</button>
                        <button onClick={() => setConfirmDelete(null)} className="sticky-note-btn">✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openEdit(note)} className="sticky-note-btn" aria-label="Edit">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => setConfirmDelete(note.id)} className="sticky-note-btn" aria-label="Delete">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
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
          + Add note
        </button>
        {compact && notes.length > 2 && (
          <button onClick={onSeeAll} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
            See all ({notes.length}) →
          </button>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{editNote ? 'Edit note' : 'New note'}</h2>
              <button className="icon-button-circle" onClick={() => setShowModal(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <textarea
              className="form-input"
              placeholder="Write something..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              style={{ width: '100%', resize: 'vertical', marginBottom: 'var(--spacing-md)', fontFamily: 'inherit' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
              <button
                onClick={() => setVisibleTo('both')}
                className={visibleTo === 'both' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: '13px' }}
              >
                ↔ For both
              </button>
              <button
                onClick={() => setVisibleTo('partner')}
                className={visibleTo === 'partner' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: '13px' }}
              >
                → For partner
              </button>
            </div>
            <button
              onClick={save}
              className="btn-primary"
              disabled={saving || !content.trim()}
              style={{ width: '100%' }}
            >
              {saving ? '…' : editNote ? 'Save changes' : 'Add note'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
