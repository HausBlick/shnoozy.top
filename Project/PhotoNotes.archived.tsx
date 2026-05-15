// ARCHIVED — Snap! / PhotoNotes widget (removed from app due to Android PWA camera issues)
// DB: photo_notes table + photo-notes storage bucket remain in Supabase.
// To restore: re-add to App.tsx (import, dashboardWidgets, orderedMiddleWidgets render),
//             re-add i18n keys (photoNotes*, snapWidget), re-add 'snap' to UserSettings widget list.
//
// Root issue: Android Chrome PWA kills the app process while the camera intent is open.
// When the PWA resumes, the file input's change event never fires regardless of approach:
//   - display:none + programmatic .click() — blocked
//   - <label> wrapping — blocked
//   - opacity:0 overlay — blocked
//   - capture="environment" — blocked
//   - native addEventListener + visibilitychange fallback — still blocked
// Gallery upload (file picker without camera intent) works fine.
// Fix would require getUserMedia (in-app camera) or a native app wrapper (Capacitor).

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';

interface MemberPhoto {
  id: string;
  sender_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  _url?: string;
}

async function getSignedUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from('photo-notes').createSignedUrl(path, 3600);
  return data?.signedUrl ?? '';
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface WidgetProps {
  homeId: string;
  userId: string;
  language: Lang;
  memberColors: Record<string, string>;
  onNewPhoto?: () => void;
}

export function PhotoNotesDashboardWidget({ homeId, userId, language, memberColors, onNewPhoto }: WidgetProps) {
  const t = getT(language);
  const de = language === 'de';
  const [photos, setPhotos] = useState<MemberPhoto[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const prevPhotoIds = useRef<Set<string>>(new Set());
  const onNewPhotoRef = useRef(onNewPhoto);
  useEffect(() => { onNewPhotoRef.current = onNewPhoto; }, [onNewPhoto]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const cam = cameraInputRef.current;
    if (!cam) return;
    const apply = (f: File) => { setPendingFile(f); setPendingUrl(URL.createObjectURL(f)); cam.value = ''; };
    const onChange = () => { const f = cam.files?.[0]; if (f) apply(f); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => { const f = cam.files?.[0]; if (f) apply(f); }, 200);
      }
    };
    cam.addEventListener('change', onChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => { cam.removeEventListener('change', onChange); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('photo_notes')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const seen = new Set<string>();
    const latest: MemberPhoto[] = [];
    for (const row of data) {
      if (!seen.has(row.sender_id)) { seen.add(row.sender_id); latest.push(row); }
    }

    if (prevPhotoIds.current.size > 0) {
      for (const p of latest) {
        if (p.sender_id !== userId && !prevPhotoIds.current.has(p.id)) { onNewPhotoRef.current?.(); }
      }
    }
    prevPhotoIds.current = new Set(latest.map(p => p.id));

    const withUrls = await Promise.all(
      latest.map(async p => ({ ...p, _url: await getSignedUrl(p.storage_path) }))
    );
    setPhotos(withUrls);
    setLoading(false);
  }, [homeId, userId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  useEffect(() => {
    const ch = supabase
      .channel(`photo_notes_widget_${homeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_notes', filter: `home_id=eq.${homeId}` }, () => { fetchPhotos(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [homeId, fetchPhotos]);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name').then(({ data }) => {
      if (!data) return;
      const names: Record<string, string> = {};
      data.forEach((p: any) => { names[p.id] = p.display_name || '?'; });
      setMemberNames(names);
    });
  }, []);

  const myPhoto = photos.find(p => p.sender_id === userId);
  const otherPhotos = photos.filter(p => p.sender_id !== userId);
  const slots: Array<{ isMine: boolean; photo?: MemberPhoto }> = [
    { isMine: true, photo: myPhoto },
    ...otherPhotos.map(p => ({ isMine: false, photo: p })),
  ];
  const idx = Math.min(currentIndex, slots.length - 1);

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && idx < slots.length - 1) setCurrentIndex(idx + 1);
      if (dx > 0 && idx > 0) setCurrentIndex(idx - 1);
    }
  }

  function handleFileSelected(file: File) {
    setPendingFile(file);
    setPendingUrl(URL.createObjectURL(file));
  }

  function closePending() {
    setPendingFile(null);
    if (pendingUrl) { URL.revokeObjectURL(pendingUrl); setPendingUrl(null); }
    setCaption('');
    setUploadError(null);
  }

  async function handleSend() {
    if (!pendingFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const old = photos.find(p => p.sender_id === userId);
      if (old) {
        await supabase.storage.from('photo-notes').remove([old.storage_path]);
        await supabase.from('photo_notes').delete().eq('id', old.id);
      }
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
        'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif',
      };
      const extFromName = pendingFile.name.split('.').pop()?.toLowerCase();
      const ext = (extFromName && extFromName.length <= 5 && extFromName !== 'blob')
        ? extFromName : (mimeToExt[pendingFile.type] ?? 'jpg');
      const path = `${homeId}/${userId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('photo-notes')
        .upload(path, pendingFile, { contentType: pendingFile.type || 'image/jpeg' });
      if (upErr) throw new Error(`Upload: ${upErr.message}`);
      const { error: dbErr } = await supabase.from('photo_notes').insert({
        home_id: homeId, sender_id: userId,
        storage_path: path, caption: caption.trim() || null,
      });
      if (dbErr) throw new Error(`DB: ${dbErr.message}`);
      closePending();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString(de ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return de ? 'Gestern' : 'Yesterday';
    return d.toLocaleDateString(de ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--spacing-lg)', padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <h2 className="text-title-md">📸 {t.photoNotesTitle}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', width: 34, height: 34, borderRadius: 'var(--rounded-full)', background: 'var(--color-surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
            <span style={{ pointerEvents: 'none' }}>📷</span>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', borderRadius: 'inherit' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <button style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 'var(--rounded-sm)', padding: '6px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', pointerEvents: 'none' }}>+ Snap!</button>
            <input type="file" accept="image/*"
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              onChange={e => { if (e.target.files?.[0]) { handleFileSelected(e.target.files[0]); e.target.value = ''; } }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="text-body-sm text-muted">…</span>
        </div>
      ) : (
        <div style={{ overflow: 'hidden' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div style={{ display: 'flex', transform: `translateX(-${idx * 100}%)`, transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
            {slots.map((slot) => {
              const memberId = slot.photo?.sender_id ?? userId;
              const name = slot.isMine ? (de ? 'Ich' : 'Me') : (memberNames[memberId] ?? '?');
              const color = memberColors[memberId] ?? 'var(--color-primary)';
              const initials = name.slice(0, 2).toUpperCase();
              return (
                <div key={slot.isMine ? 'me' : memberId} style={{ flex: '0 0 100%', minWidth: 0 }}>
                  {slot.photo?._url ? (
                    <img src={slot.photo._url} alt={slot.photo.caption ?? ''} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ aspectRatio: '1 / 1', background: 'var(--color-surface-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <div style={{ fontSize: 44 }}>📷</div>
                      <p className="text-body-sm text-muted">{slot.isMine ? (de ? 'Teile einen Moment' : 'Share a moment') : (de ? 'Noch kein Foto' : 'No photo yet')}</p>
                    </div>
                  )}
                  <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: color, color: '#fff', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
                      <div style={{ minWidth: 0 }}>
                        <p className="text-body-sm" style={{ fontWeight: 600, margin: 0 }}>{name}</p>
                        {slot.photo?.caption && <p className="text-body-sm text-muted" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.photo.caption}</p>}
                      </div>
                    </div>
                    {slot.photo && <span className="text-body-sm text-muted" style={{ flexShrink: 0 }}>{formatTime(slot.photo.created_at)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {slots.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '8px 0 12px' }}>
              {slots.map((_slot, i) => (
                <div key={i} onClick={() => setCurrentIndex(i)}
                  style={{ width: 6, height: 6, borderRadius: '50%', cursor: 'pointer', background: i === idx ? 'var(--color-primary)' : 'var(--color-hairline)', transition: 'background 0.2s' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {pendingFile && (
        <div className="modal-overlay" onClick={closePending}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{t.photoNotesSend}</h2>
              <button className="icon-btn" onClick={closePending}><XIcon /></button>
            </div>
            {pendingUrl && <img src={pendingUrl} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 'var(--rounded-sm)', marginBottom: 'var(--spacing-md)' }} />}
            <input className="input" placeholder={t.photoNotesCaption} value={caption} onChange={e => setCaption(e.target.value)}
              style={{ marginBottom: uploadError ? 'var(--spacing-xs)' : 'var(--spacing-md)' }} />
            {uploadError && <p style={{ color: '#ff453a', fontSize: 13, marginBottom: 'var(--spacing-sm)', wordBreak: 'break-all' }}>⚠ {uploadError}</p>}
            <button onClick={handleSend} disabled={uploading}
              style={{ width: '100%', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--rounded-sm)', padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
              {uploading ? '…' : t.photoNotesSend}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
