import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';

interface PhotoNote {
  id: string;
  home_id: string;
  sender_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  _url?: string;
}

interface Props {
  homeId: string;
  userId: string;
  language: Lang;
  memberColors: Record<string, string>;
  onNewPhoto?: (photo: PhotoNote) => void;
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

async function getSignedUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from('photo-notes').createSignedUrl(path, 3600);
  return data?.signedUrl ?? '';
}

export function PhotoNotes({ homeId, userId, language, memberColors, onNewPhoto }: Props) {
  const t = getT(language);
  const [photos, setPhotos] = useState<PhotoNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<PhotoNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhotoNote | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const prevPhotoIds = useRef<Set<string>>(new Set());

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('photo_notes')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const withUrls = await Promise.all(
      data.map(async (p) => ({ ...p, _url: await getSignedUrl(p.storage_path) }))
    );

    // detect new photos for realtime
    if (prevPhotoIds.current.size > 0) {
      const newOnes = withUrls.filter(p => !prevPhotoIds.current.has(p.id));
      newOnes.forEach(p => onNewPhoto?.(p));
    }
    prevPhotoIds.current = new Set(withUrls.map(p => p.id));

    setPhotos(withUrls);
    setLoading(false);
  }, [homeId, onNewPhoto]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  useEffect(() => {
    const channel = supabase
      .channel(`photo_notes_${homeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photo_notes', filter: `home_id=eq.${homeId}` }, () => {
        fetchPhotos();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'photo_notes', filter: `home_id=eq.${homeId}` }, (payload) => {
        setPhotos(prev => prev.filter(p => p.id !== (payload.old as any).id));
        prevPhotoIds.current.delete((payload.old as any).id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [homeId, fetchPhotos]);

  function handleFileSelected(file: File) {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowUpload(true);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${homeId}/${userId}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('photo-notes')
        .upload(path, selectedFile, { contentType: selectedFile.type });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from('photo_notes').insert({
        home_id: homeId,
        sender_id: userId,
        storage_path: path,
        caption: caption.trim() || null,
      });
      if (insertErr) throw insertErr;

      closeUpload();
    } finally {
      setUploading(false);
    }
  }

  function closeUpload() {
    setShowUpload(false);
    setSelectedFile(null);
    setCaption('');
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  }

  async function handleDelete(photo: PhotoNote) {
    await supabase.storage.from('photo-notes').remove([photo.storage_path]);
    await supabase.from('photo_notes').delete().eq('id', photo.id);
    setDeleteTarget(null);
    setFullscreen(null);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return language === 'de' ? 'Gestern' : 'Yesterday';
    return d.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' });
  }

  const accentColor = '#e91e8c';

  return (
    <div style={{ paddingBottom: 120, paddingTop: 'var(--spacing-md)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h1 className="text-display-lg">{t.photoNotesTitle}</h1>
      </div>

      {/* Feed */}
      {loading ? (
        <p className="text-body text-muted" style={{ textAlign: 'center', marginTop: 60 }}>…</p>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, padding: '0 var(--spacing-xl)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📸</div>
          <p className="text-body text-muted">{t.photoNotesEmpty}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {photos.map(photo => (
            <div
              key={photo.id}
              className="card"
              style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => setFullscreen(photo)}
            >
              {photo._url && (
                <img
                  src={photo._url}
                  alt={photo.caption ?? ''}
                  style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }}
                />
              )}
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: memberColors[photo.sender_id] ?? 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 12,
                  }}>
                    {photo.sender_id === userId ? 'Me' : '?'}
                  </div>
                  {photo.caption && (
                    <span className="text-body-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.caption}</span>
                  )}
                </div>
                <span className="text-body-sm text-muted" style={{ flexShrink: 0 }}>{formatTime(photo.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowUpload(true)}
        style={{
          position: 'fixed', bottom: 84, right: 16, zIndex: 300,
          width: 52, height: 52, borderRadius: '50%',
          background: accentColor, color: '#fff', border: 'none',
          fontSize: 26, fontWeight: 300, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(233,30,140,0.4)', cursor: 'pointer',
        }}
        aria-label={t.photoNotesNew}
      >+</button>

      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])} />

      {/* Upload Sheet — choose source if no file yet */}
      {showUpload && !selectedFile && (
        <div className="modal-overlay" onClick={closeUpload}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{t.photoNotesNew}</h2>
              <button className="icon-btn" onClick={closeUpload}><XIcon /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
              <button
                onClick={() => cameraRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--color-surface-soft)', border: 'none', borderRadius: 'var(--rounded-sm)', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}
              >
                <span style={{ fontSize: 22 }}>📷</span> {t.photoNotesCamera}
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--color-surface-soft)', border: 'none', borderRadius: 'var(--rounded-sm)', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}
              >
                <span style={{ fontSize: 22 }}>🖼️</span> {t.photoNotesGallery}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Sheet — preview + caption */}
      {showUpload && selectedFile && (
        <div className="modal-overlay" onClick={closeUpload}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{t.photoNotesSend}</h2>
              <button className="icon-btn" onClick={closeUpload}><XIcon /></button>
            </div>
            {previewUrl && (
              <img src={previewUrl} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 'var(--rounded-sm)', marginBottom: 'var(--spacing-md)' }} />
            )}
            <input
              className="input"
              placeholder={t.photoNotesCaption}
              value={caption}
              onChange={e => setCaption(e.target.value)}
              style={{ marginBottom: 'var(--spacing-md)' }}
              autoFocus
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{ width: '100%', background: accentColor, color: '#fff', border: 'none', borderRadius: 'var(--rounded-sm)', padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
            >
              {uploading ? '…' : t.photoNotesSend}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen viewer */}
      {fullscreen && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}
          onClick={() => setFullscreen(null)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 16px 8px', position: 'relative', zIndex: 1 }} onClick={e => e.stopPropagation()}>
            <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setFullscreen(null)}><XIcon /></button>
            {fullscreen.sender_id === userId && (
              <button
                className="icon-btn"
                style={{ color: '#ff453a' }}
                onClick={() => setDeleteTarget(fullscreen)}
              ><TrashIcon /></button>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {fullscreen._url && (
              <img
                src={fullscreen._url}
                alt={fullscreen.caption ?? ''}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                onClick={e => e.stopPropagation()}
              />
            )}
          </div>
          {fullscreen.caption && (
            <div style={{ padding: '12px 20px 32px', color: '#fff', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <span className="text-body">{fullscreen.caption}</span>
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{t.photoNotesDeleteConfirm}</h2>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, background: 'var(--color-surface-strong)', border: 'none', borderRadius: 'var(--rounded-sm)', padding: '10px 0', fontWeight: 600, cursor: 'pointer' }}
              >
                {language === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                style={{ flex: 1, background: '#ff453a', color: '#fff', border: 'none', borderRadius: 'var(--rounded-sm)', padding: '10px 0', fontWeight: 700, cursor: 'pointer' }}
              >
                {t.photoNotesDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Widget ─────────────────────────────────────────────────────────

interface WidgetProps {
  homeId: string;
  userId: string;
  language: Lang;
  memberColors: Record<string, string>;
  onNavigate: () => void;
}

export function PhotoNotesDashboardWidget({ homeId, userId, language, memberColors, onNavigate }: WidgetProps) {
  const t = getT(language);
  const [latest, setLatest] = useState<PhotoNote | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLatest = useCallback(async () => {
    const { data } = await supabase
      .from('photo_notes')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const url = await getSignedUrl(data.storage_path);
      setLatest({ ...data, _url: url });
    } else {
      setLatest(null);
    }
    setLoading(false);
  }, [homeId]);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  useEffect(() => {
    const channel = supabase
      .channel(`photo_notes_widget_${homeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_notes', filter: `home_id=eq.${homeId}` }, () => {
        fetchLatest();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [homeId, fetchLatest]);

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return language === 'de' ? 'Gestern' : 'Yesterday';
    return d.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' });
  }

  const accentColor = '#e91e8c';
  const isFromMe = latest?.sender_id === userId;

  return (
    <div className="card" style={{ marginBottom: 'var(--spacing-lg)', padding: 0, overflow: 'hidden' }}>
      {/* Widget header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
        <h2 className="text-title-md" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PhotoNotesWidgetIcon color={accentColor} size={18} /> {t.photoNotesTitle}
        </h2>
        <button
          onClick={onNavigate}
          style={{ background: 'none', border: 'none', color: accentColor, fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}
        >
          {language === 'de' ? 'Zu Fotos >' : 'To Photos >'}
        </button>
      </div>

      {loading ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="text-body-sm text-muted">…</span>
        </div>
      ) : !latest ? (
        <div style={{ padding: '8px 14px 14px', textAlign: 'center' }}>
          <p className="text-body-sm text-muted">{t.photoNotesEmpty}</p>
        </div>
      ) : (
        <div style={{ cursor: 'pointer' }} onClick={onNavigate}>
          {latest._url && (
            <img
              src={latest._url}
              alt={latest.caption ?? ''}
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
            />
          )}
          <div style={{ padding: '10px 14px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: memberColors[latest.sender_id] ?? accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 12,
            }}>
              {isFromMe ? (language === 'de' ? 'Ich' : 'Me') : '♥'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {latest.caption && (
                <p className="text-body-sm" style={{ margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {latest.caption}
                </p>
              )}
              <span className="text-body-sm text-muted">{formatTime(latest.created_at)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PhotoNotesWidgetIcon = ({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
