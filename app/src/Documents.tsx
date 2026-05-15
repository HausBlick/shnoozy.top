import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';
import type { ModuleId } from './HomeSettings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Folder {
  id: string;
  home_id: string;
  name: string | null;
  module_id: string | null;
  folder_key: string | null;
  parent_id: string | null;
  icon: string | null;
  color: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface DocFile {
  id: string;
  home_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

type MenuTarget = { kind: 'doc'; item: DocFile } | { kind: 'folder'; item: Folder };

// ─── Config ───────────────────────────────────────────────────────────────────

const MODULE_FOLDERS: {
  module_id: string;
  icon: string;
  color: string;
  sort_order: number;
  subFolders: { folder_key: string; icon: string; sort_order: number }[];
}[] = [
  {
    module_id: 'home-info',
    icon: '🏠',
    color: '#f57c00',
    sort_order: 0,
    subFolders: [
      { folder_key: 'docSubLease',     icon: '📋', sort_order: 0 },
      { folder_key: 'docSubUtilities', icon: '⚡', sort_order: 1 },
      { folder_key: 'docSubInsurance', icon: '🛡️', sort_order: 2 },
      { folder_key: 'docSubMisc',      icon: '📂', sort_order: 3 },
    ],
  },
  {
    module_id: 'car',
    icon: '🚗',
    color: '#1e88e5',
    sort_order: 1,
    subFolders: [
      { folder_key: 'docSubTuev',          icon: '🔍', sort_order: 0 },
      { folder_key: 'docSubCarInsurance',  icon: '🛡️', sort_order: 1 },
      { folder_key: 'docSubRegistration',  icon: '📜', sort_order: 2 },
      { folder_key: 'docSubService',       icon: '🔧', sort_order: 3 },
    ],
  },
  {
    module_id: 'luna',
    icon: '🐾',
    color: '#7a041f',
    sort_order: 2,
    subFolders: [],
  },
];

const FOLDER_COLORS = [
  '#6366f1', '#14d8db', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#f97316', '#ec4899', '#06b6d4', '#84cc16', '#6a6a6a', '#b45309',
];
const FOLDER_ICONS = [
  '📁', '📂', '🗂️', '📋', '📜', '🗃️', '🗄️', '📄', '📃', '📑', '📝', '📊',
  '🏠', '🔑', '💡', '🛋️', '🛁', '🏗️',
  '💰', '💳', '🏦', '📈', '🧾',
  '🚗', '🔧', '🛻', '✈️', '🚲',
  '🏥', '💊', '🩺',
  '💼', '🎓', '📚', '🏢', '💻',
  '👤', '🎵', '📷', '🧸', '🎒', '🌿',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFolderDisplayName(folder: Folder, t: ReturnType<typeof getT>): string {
  if (folder.module_id && !folder.parent_id) {
    switch (folder.module_id) {
      case 'home-info': return t.moduleHomeInfo;
      case 'car':       return t.moduleCar;
      case 'luna':      return t.moduleLuna;
    }
  }
  if (folder.folder_key) {
    switch (folder.folder_key) {
      case 'docSubLease':        return t.docSubLease;
      case 'docSubUtilities':    return t.docSubUtilities;
      case 'docSubInsurance':    return t.docSubInsurance;
      case 'docSubMisc':         return t.docSubMisc;
      case 'docSubTuev':         return t.docSubTuev;
      case 'docSubCarInsurance': return t.docSubCarInsurance;
      case 'docSubRegistration': return t.docSubRegistration;
      case 'docSubService':      return t.docSubService;
    }
  }
  return folder.name ?? '';
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileTypeBadge(fileType: string | null): { label: string; bg: string; color: string } {
  if (fileType === 'pdf')   return { label: 'PDF', bg: '#fee2e2', color: '#dc2626' };
  if (fileType === 'image') return { label: 'IMG', bg: '#dcfce7', color: '#16a34a' };
  return { label: 'FILE', bg: 'var(--color-surface-strong)', color: 'var(--color-muted)' };
}

function detectFileType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return 'file';
}

function daysUntilPurge(deletedAt: string): number {
  const purgeAt = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

function getDescendantFolderIds(folderId: string, allFolders: Folder[]): string[] {
  const direct = allFolders.filter(f => f.parent_id === folderId);
  return direct.flatMap(f => [f.id, ...getDescendantFolderIds(f.id, allFolders)]);
}

function docIcon(fileType: string | null) {
  return fileType === 'pdf' ? '📄' : fileType === 'image' ? '🖼️' : '📎';
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const TrashIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

const RestoreIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);

const ThreeDotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.8"/>
    <circle cx="12" cy="12" r="1.8"/>
    <circle cx="12" cy="19" r="1.8"/>
  </svg>
);

// ─── FolderCard ───────────────────────────────────────────────────────────────

function FolderCard({
  folder, t, isSubFolder, docCount, onOpen, onMenu,
}: {
  folder: Folder;
  t: ReturnType<typeof getT>;
  isSubFolder: boolean;
  docCount: number;
  onOpen: () => void;
  onMenu?: () => void;
}) {
  const name = getFolderDisplayName(folder, t);
  const icon = folder.icon ?? '📁';
  return (
    <button
      onClick={onOpen}
      style={{
        background: 'var(--color-canvas)',
        borderRadius: 'var(--rounded-md)',
        boxShadow: 'var(--shadow-hover)',
        padding: 'var(--spacing-base)',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center',
        gap: 'var(--spacing-md)',
      }}
    >
      <span style={{
        width: isSubFolder ? 36 : 44,
        height: isSubFolder ? 36 : 44,
        borderRadius: 'var(--rounded-sm)',
        background: folder.color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isSubFolder ? '20px' : '24px', flexShrink: 0,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div className="text-body-md" style={{ fontWeight: 600, wordBreak: 'break-word' }}>{name}</div>
        {docCount > 0 && (
          <div className="text-body-sm text-muted" style={{ marginTop: '1px' }}>
            {docCount} {t.docShortFiles}
          </div>
        )}
      </div>
      {onMenu ? (
        <button
          onClick={e => { e.stopPropagation(); onMenu(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '6px', flexShrink: 0 }}
        >
          <ThreeDotsIcon />
        </button>
      ) : (
        <span style={{ color: 'var(--color-muted)', flexShrink: 0 }}><ChevronIcon /></span>
      )}
    </button>
  );
}

// ─── DocRow ───────────────────────────────────────────────────────────────────

function DocRow({
  doc, t, isLast, onOpen, onMenu, showFolder, folders,
}: {
  doc: DocFile;
  t: ReturnType<typeof getT>;
  isLast: boolean;
  onOpen: () => void;
  onMenu: () => void;
  showFolder?: boolean;
  folders?: Folder[];
}) {
  const badge = getFileTypeBadge(doc.file_type);
  const date = new Date(doc.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' });
  const parentFolder = showFolder && folders ? folders.find(f => f.id === doc.folder_id) : null;
  const folderLabel = parentFolder ? (parentFolder.icon ?? '📁') + ' ' + getFolderDisplayName(parentFolder, t) : null;

  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md) var(--spacing-base)',
        borderBottom: isLast ? 'none' : '1px solid var(--color-hairline-soft)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '24px', flexShrink: 0 }}>{docIcon(doc.file_type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-body-md" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
          <span style={{
            padding: '1px 6px', borderRadius: 'var(--rounded-xs)',
            background: badge.bg, color: badge.color,
            fontSize: '11px', fontWeight: 700,
          }}>{badge.label}</span>
          <span className="text-body-sm text-muted">{date}</span>
          {doc.file_size ? <span className="text-body-sm text-muted">· {formatFileSize(doc.file_size)}</span> : null}
          {folderLabel ? <span className="text-body-sm text-muted">· {folderLabel}</span> : null}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onMenu(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '6px', flexShrink: 0 }}
      >
        <ThreeDotsIcon />
      </button>
    </div>
  );
}

// ─── UploadModal ──────────────────────────────────────────────────────────────

function UploadModal({
  homeId, userId, folders, defaultFolderId, language, initialFile, onClose, onUploaded,
}: {
  homeId: string; userId: string; folders: Folder[];
  defaultFolderId: string | null; language: Lang;
  initialFile?: File | null;
  onClose: () => void; onUploaded: () => void;
}) {
  const t = getT(language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [name, setName] = useState(initialFile ? initialFile.name.replace(/\.[^.]+$/, '') : '');
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? folders[0]?.id ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ''));
    e.target.value = '';
  }

  async function handleUpload() {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() ?? '';
      const uuid = crypto.randomUUID();
      const storagePath = `${homeId}/${uuid}${ext ? `.${ext}` : ''}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      await supabase.from('documents').insert({
        home_id: homeId,
        folder_id: folderId || null,
        name: name.trim(),
        storage_path: storagePath,
        file_type: detectFileType(file.type),
        file_size: file.size,
        uploaded_by: userId,
      });
      onUploaded();
      onClose();
    } catch {
      setError(t.docUploadError);
    } finally {
      setUploading(false);
    }
  }

  const folderOptions = folders.map(f => ({
    id: f.id,
    icon: f.icon ?? '📁',
    label: getFolderDisplayName(f, t),
    isSubFolder: !!f.parent_id,
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-title-md">{t.docUpload}</h2>
          <button className="icon-button-circle" onClick={onClose}><CloseIcon /></button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%', padding: '20px', marginBottom: 'var(--spacing-md)',
            border: `2px dashed ${file ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
            borderRadius: 'var(--rounded-md)',
            background: file ? 'var(--color-primary)11' : 'var(--color-surface-soft)',
            cursor: 'pointer', textAlign: 'center',
          }}
        >
          {file ? (
            <div>
              <div style={{ fontSize: '28px', marginBottom: '4px' }}>{file.type === 'application/pdf' ? '📄' : '🖼️'}</div>
              <div className="text-body-sm" style={{ fontWeight: 600, wordBreak: 'break-all' }}>{file.name}</div>
              <div className="text-body-sm text-muted">{formatFileSize(file.size)}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '28px', marginBottom: '4px' }}>📎</div>
              <div className="text-body-sm" style={{ fontWeight: 500 }}>{t.docPickFile}</div>
              <div className="text-body-sm text-muted">PDF · JPG · PNG</div>
            </div>
          )}
        </button>
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.docFileName}</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t.docFileNamePlaceholder} style={{ marginBottom: 'var(--spacing-md)' }} />
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '6px' }}>{t.docFolder}</label>
        <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', overflow: 'hidden', maxHeight: '180px', overflowY: 'auto', marginBottom: 'var(--spacing-md)' }}>
          {folderOptions.map((fo, i) => (
            <button
              key={fo.id}
              onClick={() => setFolderId(fo.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 14px',
                paddingLeft: fo.isSubFolder ? '28px' : '14px',
                background: folderId === fo.id ? 'var(--color-primary)11' : 'none',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                borderBottom: i === folderOptions.length - 1 ? 'none' : '1px solid var(--color-hairline-soft)',
                fontWeight: folderId === fo.id ? 600 : 400,
                fontSize: '15px', color: 'var(--color-ink)',
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{fo.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{fo.label}</span>
              {folderId === fo.id && <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>
        {error && <p className="text-body-sm" style={{ color: '#ef4444', marginBottom: 'var(--spacing-md)' }}>{error}</p>}
        <button className="btn-primary" onClick={handleUpload} disabled={!file || !name.trim() || uploading} style={{ opacity: !file || !name.trim() || uploading ? 0.5 : 1 }}>
          {uploading ? t.docUploading : t.docUpload}
        </button>
      </div>
    </div>
  );
}

// ─── FolderModal ──────────────────────────────────────────────────────────────

function FolderModal({
  homeId, userId, language, parentId, onClose, onSaved,
}: {
  homeId: string; userId: string; language: Lang;
  parentId: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const t = getT(language);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('📁');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('document_folders').insert({
      home_id: homeId, parent_id: parentId,
      name: name.trim(), icon, color, sort_order: 99, created_by: userId,
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-title-md">{t.docNewFolder}</h2>
          <button className="icon-button-circle" onClick={onClose}><CloseIcon /></button>
        </div>
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.docFolderName}</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t.docFolderNamePlaceholder} style={{ marginBottom: 'var(--spacing-md)' }} autoFocus />
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '6px' }}>{t.docFolderIcon}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', marginBottom: 'var(--spacing-md)' }}>
          {FOLDER_ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} style={{
              width: '100%', aspectRatio: '1', borderRadius: 'var(--rounded-sm)',
              background: icon === ic ? 'var(--color-primary)22' : 'var(--color-surface-strong)',
              border: `2px solid ${icon === ic ? 'var(--color-primary)' : 'transparent'}`,
              cursor: 'pointer', fontSize: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{ic}</button>
          ))}
        </div>
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '6px' }}>{t.docFolderColor}</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }}>
          {FOLDER_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
              cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px',
            }} />
          ))}
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={!name.trim() || saving} style={{ opacity: !name.trim() || saving ? 0.5 : 1 }}>
          {saving ? t.loading : t.docCreateFolder}
        </button>
      </div>
    </div>
  );
}

// ─── ActionSheet ──────────────────────────────────────────────────────────────

function ActionSheet({
  target, language, onRename, onMove, onDelete, onClose,
}: {
  target: MenuTarget;
  language: Lang;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = getT(language);
  const isDoc = target.kind === 'doc';
  const name = isDoc ? target.item.name : getFolderDisplayName(target.item as Folder, t);
  const icon = isDoc ? docIcon((target.item as DocFile).file_type) : ((target.item as Folder).icon ?? '📁');

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px var(--spacing-base)',
    background: 'none', border: 'none', cursor: 'pointer',
    width: '100%', textAlign: 'left',
    fontSize: '16px', fontWeight: 500, color: 'var(--color-ink)',
    borderBottom: '1px solid var(--color-hairline-soft)',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-canvas)',
          borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
          paddingBottom: 'env(safe-area-inset-bottom)',
          width: '100%',
        }}
      >
        {/* Item name */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px var(--spacing-base)',
          borderBottom: '1px solid var(--color-hairline)',
        }}>
          <span style={{ fontSize: '26px', flexShrink: 0 }}>{icon}</span>
          <span className="text-body-md" style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </div>
        {/* Actions */}
        <button style={rowStyle} onClick={onRename}>
          <span style={{ fontSize: '20px' }}>✏️</span> {t.docRename}
        </button>
        <button style={rowStyle} onClick={onMove}>
          <span style={{ fontSize: '20px' }}>📁</span> {t.docMove}
        </button>
        <button style={{ ...rowStyle, color: '#ef4444', borderBottom: 'none' }} onClick={onDelete}>
          <span style={{ fontSize: '20px' }}>🗑️</span> {t.docMoveToTrash}
        </button>
        {/* Cancel */}
        <div style={{ padding: 'var(--spacing-sm) var(--spacing-base)', paddingTop: 'var(--spacing-md)' }}>
          <button className="btn-secondary" style={{ width: '100%' }} onClick={onClose}>{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── RenameModal ──────────────────────────────────────────────────────────────

function RenameModal({
  currentName, language, onClose, onSave,
}: {
  currentName: string;
  language: Lang;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const t = getT(language);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-title-md">{t.docRename}</h2>
          <button className="icon-button-circle" onClick={onClose}><CloseIcon /></button>
        </div>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
          style={{ marginBottom: 'var(--spacing-lg)' }}
        />
        <button className="btn-primary" onClick={handleSave} disabled={!name.trim() || saving} style={{ opacity: !name.trim() || saving ? 0.5 : 1 }}>
          {saving ? t.loading : t.save}
        </button>
      </div>
    </div>
  );
}

// ─── MoveModal ────────────────────────────────────────────────────────────────

function MoveModal({
  folders, excludeIds = [], currentTargetId, language, onClose, onMove,
}: {
  folders: Folder[];
  excludeIds?: string[];
  currentTargetId: string | null;
  language: Lang;
  onClose: () => void;
  onMove: (targetId: string | null) => Promise<void>;
}) {
  const t = getT(language);
  const [selected, setSelected] = useState<string | null>(currentTargetId);
  const [saving, setSaving] = useState(false);

  const validFolders = folders.filter(f => !excludeIds.includes(f.id));

  async function handleMove() {
    if (selected === currentTargetId) { onClose(); return; }
    setSaving(true);
    await onMove(selected);
    setSaving(false);
  }

  const optionStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px var(--spacing-base)',
    background: active ? 'var(--color-primary)11' : 'none',
    border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
    borderBottom: '1px solid var(--color-hairline-soft)',
    fontWeight: active ? 600 : 400, fontSize: '15px', color: 'var(--color-ink)',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-canvas)',
          borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
          maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom)',
          width: '100%',
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2 className="text-title-md">{t.docMoveTo}</h2>
          <button className="icon-button-circle" onClick={onClose}><CloseIcon /></button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Root option */}
          <button style={optionStyle(selected === null)} onClick={() => setSelected(null)}>
            <span style={{ fontSize: '20px' }}>📂</span>
            <span>{t.docRootFolder}</span>
            {selected === null && <span style={{ marginLeft: 'auto', color: 'var(--color-primary)', fontWeight: 700 }}>✓</span>}
          </button>
          {validFolders.map(f => (
            <button key={f.id} style={{ ...optionStyle(selected === f.id), paddingLeft: f.parent_id ? '36px' : undefined }} onClick={() => setSelected(f.id)}>
              <span style={{ fontSize: '20px' }}>{f.icon ?? '📁'}</span>
              <span style={{ flex: 1 }}>{getFolderDisplayName(f, t)}</span>
              {selected === f.id && <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>✓</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: 'var(--spacing-md) var(--spacing-base)', flexShrink: 0, borderTop: '1px solid var(--color-hairline-soft)' }}>
          <button className="btn-primary" style={{ width: '100%', opacity: saving ? 0.5 : 1 }} onClick={handleMove} disabled={saving}>
            {saving ? t.loading : t.docMove}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function Documents({
  homeId, userId, language, activeModuleIds, sharedFile, onSharedFileHandled,
}: {
  homeId: string;
  userId: string;
  language: Lang;
  activeModuleIds: ModuleId[];
  sharedFile?: File | null;
  onSharedFileHandled?: () => void;
}) {
  const t = getT(language);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [recentDocs, setRecentDocs] = useState<DocFile[]>([]);
  const [folderRecentDocs, setFolderRecentDocs] = useState<DocFile[]>([]);
  const [docCounts, setDocCounts] = useState<Map<string, number>>(new Map());
  const [folderStack, setFolderStack] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashedDocs, setTrashedDocs] = useState<DocFile[]>([]);
  const [trashedFolders, setTrashedFolders] = useState<Folder[]>([]);
  const [activeMenu, setActiveMenu] = useState<MenuTarget | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<DocFile | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [movingDoc, setMovingDoc] = useState<DocFile | null>(null);
  const [movingFolder, setMovingFolder] = useState<Folder | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<DocFile | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<Folder | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  useEffect(() => { fetchFolders(); }, [homeId]);

  useEffect(() => {
    if (loading) return;
    if (currentFolder) {
      fetchDocs(currentFolder.id);
      fetchFolderRecentDocs(currentFolder.id);
    } else {
      fetchRecentDocs();
      setFolderRecentDocs([]);
    }
  }, [currentFolder?.id, loading]);

  // Open upload modal pre-filled when a file is shared from another app
  useEffect(() => {
    if (sharedFile && !loading) setShowUploadModal(true);
  }, [sharedFile, loading]);

  async function fetchFolders() {
    setLoading(true);
    const { data } = await supabase.from('document_folders').select('*').eq('home_id', homeId).is('deleted_at', null).order('sort_order');
    await ensureModuleFolders(data ?? []);
    const { data: refreshed } = await supabase.from('document_folders').select('*').eq('home_id', homeId).is('deleted_at', null).order('sort_order');
    setFolders(refreshed ?? []);
    await fetchDocCounts(refreshed ?? []);
    setLoading(false);
  }

  async function fetchDocCounts(allFolders: Folder[]) {
    const { data } = await supabase.from('documents').select('folder_id').eq('home_id', homeId).is('deleted_at', null).not('folder_id', 'is', null);
    const direct = new Map<string, number>();
    for (const row of data ?? []) {
      if (row.folder_id) direct.set(row.folder_id, (direct.get(row.folder_id) ?? 0) + 1);
    }
    function total(folderId: string): number {
      return (direct.get(folderId) ?? 0) + allFolders.filter(f => f.parent_id === folderId).reduce((s, c) => s + total(c.id), 0);
    }
    const totals = new Map<string, number>();
    for (const f of allFolders) totals.set(f.id, total(f.id));
    setDocCounts(totals);
  }

  async function ensureModuleFolders(existing: Folder[]) {
    for (const config of MODULE_FOLDERS) {
      if (!activeModuleIds.includes(config.module_id as ModuleId)) continue;
      const moduleFolder = existing.find(f => f.module_id === config.module_id && !f.parent_id);
      if (!moduleFolder) {
        await supabase.from('document_folders').insert({
          home_id: homeId, module_id: config.module_id,
          icon: config.icon, color: config.color, sort_order: config.sort_order, created_by: userId,
        }, { count: 'exact' });
        continue;
      }
      for (const sub of config.subFolders) {
        const exists = existing.find(f => f.parent_id === moduleFolder.id && f.folder_key === sub.folder_key);
        if (!exists) {
          await supabase.from('document_folders').insert({
            home_id: homeId, module_id: config.module_id, folder_key: sub.folder_key,
            parent_id: moduleFolder.id, icon: sub.icon, color: config.color,
            sort_order: sub.sort_order, created_by: userId,
          });
        }
      }
    }
  }

  async function fetchDocs(folderId: string) {
    const { data } = await supabase.from('documents').select('*').eq('home_id', homeId).eq('folder_id', folderId).is('deleted_at', null).order('created_at', { ascending: false });
    setDocs(data ?? []);
  }

  async function fetchRecentDocs() {
    const { data } = await supabase.from('documents').select('*').eq('home_id', homeId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5);
    setRecentDocs(data ?? []);
  }

  async function fetchFolderRecentDocs(folderId: string) {
    const descendantIds = getDescendantFolderIds(folderId, folders);
    const allFolderIds = [folderId, ...descendantIds];
    const { data } = await supabase.from('documents').select('*').eq('home_id', homeId).in('folder_id', allFolderIds).is('deleted_at', null).order('created_at', { ascending: false }).limit(10);
    setFolderRecentDocs(data ?? []);
  }

  async function fetchTrash() {
    const [{ data: dDocs }, { data: dFolders }] = await Promise.all([
      supabase.from('documents').select('*').eq('home_id', homeId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('document_folders').select('*').eq('home_id', homeId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ]);
    setTrashedDocs(dDocs ?? []);
    setTrashedFolders(dFolders ?? []);
  }

  async function openDocument(doc: DocFile) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  function refreshCurrent() {
    if (currentFolder) { fetchDocs(currentFolder.id); fetchFolderRecentDocs(currentFolder.id); }
    else fetchRecentDocs();
    fetchDocCounts(folders);
  }

  async function deleteDocument(doc: DocFile) {
    await supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc.id);
    setPendingDeleteDoc(null);
    refreshCurrent();
  }

  async function deleteFolder(folder: Folder) {
    const now = new Date().toISOString();
    const descendantIds = getDescendantFolderIds(folder.id, folders);
    const allFolderIds = [folder.id, ...descendantIds];
    await supabase.from('document_folders').update({ deleted_at: now }).in('id', allFolderIds);
    await supabase.from('documents').update({ deleted_at: now }).in('folder_id', allFolderIds);
    setPendingDeleteFolder(null);
    if (currentFolder?.id === folder.id) setFolderStack([]);
    fetchFolders();
    refreshCurrent();
  }

  async function renameDocument(doc: DocFile, newName: string) {
    await supabase.from('documents').update({ name: newName }).eq('id', doc.id);
    setRenamingDoc(null);
    refreshCurrent();
  }

  async function renameFolder(folder: Folder, newName: string) {
    await supabase.from('document_folders').update({ name: newName }).eq('id', folder.id);
    setRenamingFolder(null);
    fetchFolders();
  }

  async function moveDocument(doc: DocFile, targetFolderId: string | null) {
    await supabase.from('documents').update({ folder_id: targetFolderId }).eq('id', doc.id);
    setMovingDoc(null);
    refreshCurrent();
  }

  async function moveFolder(folder: Folder, targetParentId: string | null) {
    await supabase.from('document_folders').update({ parent_id: targetParentId }).eq('id', folder.id);
    setMovingFolder(null);
    fetchFolders();
  }

  async function restoreDocument(doc: DocFile) {
    await supabase.from('documents').update({ deleted_at: null }).eq('id', doc.id);
    fetchTrash();
  }

  async function restoreFolder(folder: Folder) {
    const descendantIds = getDescendantFolderIds(folder.id, trashedFolders);
    const allFolderIds = [folder.id, ...descendantIds];
    await supabase.from('document_folders').update({ deleted_at: null }).in('id', allFolderIds);
    await supabase.from('documents').update({ deleted_at: null }).in('folder_id', allFolderIds);
    fetchTrash();
    fetchFolders();
  }

  async function permanentDeleteDocument(doc: DocFile) {
    await supabase.storage.from('documents').remove([doc.storage_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchTrash();
  }

  async function permanentDeleteFolder(folder: Folder) {
    const descendantIds = getDescendantFolderIds(folder.id, trashedFolders);
    const allFolderIds = [folder.id, ...descendantIds];
    const { data: docsToDelete } = await supabase.from('documents').select('storage_path').in('folder_id', allFolderIds);
    if (docsToDelete?.length) await supabase.storage.from('documents').remove(docsToDelete.map(d => d.storage_path));
    await supabase.from('documents').delete().in('folder_id', allFolderIds);
    await supabase.from('document_folders').delete().in('id', allFolderIds);
    fetchTrash();
  }

  async function emptyTrash() {
    const allFolderIds = trashedFolders.map(f => f.id);
    const storagePaths = trashedDocs.map(d => d.storage_path);
    if (storagePaths.length) await supabase.storage.from('documents').remove(storagePaths);
    if (trashedDocs.length) await supabase.from('documents').delete().in('id', trashedDocs.map(d => d.id));
    if (allFolderIds.length) await supabase.from('document_folders').delete().in('id', allFolderIds);
    setConfirmEmptyTrash(false);
    fetchTrash();
  }

  const visibleFolders = folders.filter(f =>
    currentFolder ? f.parent_id === currentFolder.id : !f.parent_id
  );
  const isSystemFolder = (f: Folder) => !!f.module_id || !!f.folder_key;
  const trashCount = trashedDocs.length + trashedFolders.length;

  if (loading) return (
    <div style={{ paddingTop: 'var(--spacing-xl)', textAlign: 'center' }}>
      <p className="text-body-sm text-muted">{t.loading}</p>
    </div>
  );

  // ── Trash view ───────────────────────────────────────────────────────────────
  if (showTrash) {
    return (
      <div style={{ paddingBottom: '80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <button onClick={() => setShowTrash(false)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <ChevronLeftIcon />
          </button>
          <h1 className="text-display-lg" style={{ flex: 1 }}>{t.docTrash}</h1>
          {trashCount > 0 && (
            <button onClick={() => setConfirmEmptyTrash(true)} style={{ borderRadius: 'var(--rounded-sm)', border: '1px solid #ef4444', background: 'none', color: '#ef4444', padding: '6px 12px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              {t.docEmptyTrash}
            </button>
          )}
        </div>
        {trashCount === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>🗑️</p>
            <p className="text-body-sm text-muted">{t.docTrashEmpty}</p>
          </div>
        ) : (
          <>
            <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>{t.docTrashInfo}</p>
            {trashedFolders.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--spacing-md)' }}>
                {trashedFolders.map((folder, i) => (
                  <div key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-base)', borderBottom: i === trashedFolders.length - 1 ? 'none' : '1px solid var(--color-hairline-soft)' }}>
                    <span style={{ fontSize: '28px', flexShrink: 0 }}>{folder.icon ?? '📁'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-body-md" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getFolderDisplayName(folder, t)}</div>
                      <div className="text-body-sm text-muted">{daysUntilPurge(folder.deleted_at!)} {t.docDaysLeft}</div>
                    </div>
                    <button onClick={() => restoreFolder(folder)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: '6px', flexShrink: 0 }} title={t.docRestore}><RestoreIcon /></button>
                    <button onClick={() => permanentDeleteFolder(folder)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px', flexShrink: 0 }} title={t.docDeleteForever}><TrashIcon /></button>
                  </div>
                ))}
              </div>
            )}
            {trashedDocs.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {trashedDocs.map((doc, i) => {
                  const badge = getFileTypeBadge(doc.file_type);
                  return (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-base)', borderBottom: i === trashedDocs.length - 1 ? 'none' : '1px solid var(--color-hairline-soft)' }}>
                      <span style={{ fontSize: '24px', flexShrink: 0 }}>{docIcon(doc.file_type)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-body-md" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ padding: '1px 6px', borderRadius: 'var(--rounded-xs)', background: badge.bg, color: badge.color, fontSize: '11px', fontWeight: 700 }}>{badge.label}</span>
                          <span className="text-body-sm text-muted">{daysUntilPurge(doc.deleted_at!)} {t.docDaysLeft}</span>
                        </div>
                      </div>
                      <button onClick={() => restoreDocument(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: '6px', flexShrink: 0 }} title={t.docRestore}><RestoreIcon /></button>
                      <button onClick={() => permanentDeleteDocument(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px', flexShrink: 0 }} title={t.docDeleteForever}><TrashIcon /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {confirmEmptyTrash && (
          <div className="modal-overlay" onClick={() => setConfirmEmptyTrash(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="text-title-md">{t.docEmptyTrash}</h2>
                <button className="icon-button-circle" onClick={() => setConfirmEmptyTrash(false)}><CloseIcon /></button>
              </div>
              <p className="text-body-md" style={{ marginBottom: 'var(--spacing-lg)' }}>{t.docConfirmEmptyTrash}</p>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmEmptyTrash(false)}>{t.cancel}</button>
                <button className="btn-primary" style={{ flex: 1, background: '#ef4444', border: 'none' }} onClick={emptyTrash}>{t.docDeleteForever}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        {currentFolder && (
          <button onClick={() => setFolderStack(prev => prev.slice(0, -1))} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <ChevronLeftIcon />
          </button>
        )}
        <h1 className="text-display-lg" style={{ flex: 1 }}>
          {currentFolder ? getFolderDisplayName(currentFolder, t) : t.moduleDocs}
        </h1>
        {!currentFolder && (
          <button
            onClick={() => { setShowTrash(true); fetchTrash(); }}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface-strong)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, position: 'relative' }}
          >
            <TrashIcon size={17} />
            {trashCount > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', color: 'white', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {trashCount > 9 ? '9+' : trashCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Folder grid */}
      {visibleFolders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: currentFolder ? 'repeat(2, 1fr)' : '1fr', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
          {visibleFolders.map(folder => (
            <FolderCard
              key={folder.id}
              folder={folder}
              t={t}
              isSubFolder={!!currentFolder}
              docCount={docCounts.get(folder.id) ?? 0}
              onOpen={() => setFolderStack(prev => [...prev, folder])}
              onMenu={!isSystemFolder(folder) ? () => setActiveMenu({ kind: 'folder', item: folder }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Documents in current folder */}
      {currentFolder && docs.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {docs.map((doc, i) => (
            <DocRow key={doc.id} doc={doc} t={t} isLast={i === docs.length - 1} onOpen={() => openDocument(doc)} onMenu={() => setActiveMenu({ kind: 'doc', item: doc })} />
          ))}
        </div>
      )}

      {/* Empty state in folder view */}
      {currentFolder && visibleFolders.length === 0 && docs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <p style={{ fontSize: '36px', marginBottom: '8px' }}>📭</p>
          <p className="text-body-sm text-muted">{t.docEmpty}</p>
        </div>
      )}

      {/* Recent files from all sub-folders */}
      {currentFolder && visibleFolders.length > 0 && folderRecentDocs.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.docRecent}</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {folderRecentDocs.map((doc, i) => (
              <DocRow key={doc.id} doc={doc} t={t} isLast={i === folderRecentDocs.length - 1} onOpen={() => openDocument(doc)} onMenu={() => setActiveMenu({ kind: 'doc', item: doc })} showFolder folders={folders} />
            ))}
          </div>
        </div>
      )}

      {/* Root: recent uploads */}
      {!currentFolder && recentDocs.length > 0 && (
        <>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.docRecent}</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {recentDocs.map((doc, i) => (
              <DocRow key={doc.id} doc={doc} t={t} isLast={i === recentDocs.length - 1} onOpen={() => openDocument(doc)} onMenu={() => setActiveMenu({ kind: 'doc', item: doc })} showFolder folders={folders} />
            ))}
          </div>
        </>
      )}

      {/* Root empty state */}
      {!currentFolder && visibleFolders.length === 0 && recentDocs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <p style={{ fontSize: '40px', marginBottom: '8px' }}>📁</p>
          <p className="text-body-sm text-muted">{t.docNoFolders}</p>
        </div>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <UploadModal
          homeId={homeId} userId={userId}
          folders={folders.filter(f => !f.parent_id || !!f.folder_key || !!f.module_id)}
          defaultFolderId={currentFolder?.id ?? folders.find(f => !f.parent_id)?.id ?? null}
          language={language}
          initialFile={sharedFile}
          onClose={() => { setShowUploadModal(false); onSharedFileHandled?.(); }}
          onUploaded={() => {
            if (currentFolder) { fetchDocs(currentFolder.id); fetchFolderRecentDocs(currentFolder.id); }
            else fetchRecentDocs();
            fetchDocCounts(folders);
          }}
        />
      )}

      {/* Folder create modal */}
      {showFolderModal && (
        <FolderModal homeId={homeId} userId={userId} language={language} parentId={currentFolder?.id ?? null} onClose={() => setShowFolderModal(false)} onSaved={fetchFolders} />
      )}

      {/* Action sheet */}
      {activeMenu && (
        <ActionSheet
          target={activeMenu}
          language={language}
          onRename={() => {
            if (activeMenu.kind === 'doc') setRenamingDoc(activeMenu.item as DocFile);
            else setRenamingFolder(activeMenu.item as Folder);
            setActiveMenu(null);
          }}
          onMove={() => {
            if (activeMenu.kind === 'doc') setMovingDoc(activeMenu.item as DocFile);
            else setMovingFolder(activeMenu.item as Folder);
            setActiveMenu(null);
          }}
          onDelete={() => {
            if (activeMenu.kind === 'doc') setPendingDeleteDoc(activeMenu.item as DocFile);
            else setPendingDeleteFolder(activeMenu.item as Folder);
            setActiveMenu(null);
          }}
          onClose={() => setActiveMenu(null)}
        />
      )}

      {/* Rename doc */}
      {renamingDoc && (
        <RenameModal
          currentName={renamingDoc.name}
          language={language}
          onClose={() => setRenamingDoc(null)}
          onSave={name => renameDocument(renamingDoc, name)}
        />
      )}

      {/* Rename folder */}
      {renamingFolder && (
        <RenameModal
          currentName={renamingFolder.name ?? getFolderDisplayName(renamingFolder, t)}
          language={language}
          onClose={() => setRenamingFolder(null)}
          onSave={name => renameFolder(renamingFolder, name)}
        />
      )}

      {/* Move doc */}
      {movingDoc && (
        <MoveModal
          folders={folders}
          currentTargetId={movingDoc.folder_id}
          language={language}
          onClose={() => setMovingDoc(null)}
          onMove={targetId => moveDocument(movingDoc, targetId)}
        />
      )}

      {/* Move folder */}
      {movingFolder && (
        <MoveModal
          folders={folders}
          excludeIds={[movingFolder.id, ...getDescendantFolderIds(movingFolder.id, folders)]}
          currentTargetId={movingFolder.parent_id}
          language={language}
          onClose={() => setMovingFolder(null)}
          onMove={targetId => moveFolder(movingFolder, targetId)}
        />
      )}

      {/* Delete doc confirm */}
      {pendingDeleteDoc && (
        <div className="modal-overlay" onClick={() => setPendingDeleteDoc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{t.docConfirmDelete}</h2>
              <button className="icon-button-circle" onClick={() => setPendingDeleteDoc(null)}><CloseIcon /></button>
            </div>
            <p className="text-body-md" style={{ marginBottom: 'var(--spacing-lg)' }}>„{pendingDeleteDoc.name}"</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setPendingDeleteDoc(null)}>{t.cancel}</button>
              <button className="btn-primary" style={{ flex: 1, background: '#ef4444', border: 'none' }} onClick={() => deleteDocument(pendingDeleteDoc)}>{t.docMoveToTrash}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete folder confirm */}
      {pendingDeleteFolder && (
        <div className="modal-overlay" onClick={() => setPendingDeleteFolder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-title-md">{t.docConfirmDeleteFolder}</h2>
              <button className="icon-button-circle" onClick={() => setPendingDeleteFolder(null)}><CloseIcon /></button>
            </div>
            <p className="text-body-md" style={{ marginBottom: 'var(--spacing-lg)' }}>„{getFolderDisplayName(pendingDeleteFolder, t)}"</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setPendingDeleteFolder(null)}>{t.cancel}</button>
              <button className="btn-primary" style={{ flex: 1, background: '#ef4444', border: 'none' }} onClick={() => deleteFolder(pendingDeleteFolder)}>{t.docMoveToTrash}</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB speed-dial */}
      {showFabMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowFabMenu(false)} />}
      {showFabMenu && (
        <div style={{ position: 'fixed', bottom: '148px', right: '20px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <button onClick={() => { setShowFabMenu(false); setShowFolderModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: 'var(--rounded-full)', background: 'var(--color-canvas)', color: 'var(--color-ink)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
            <span>📁</span> {t.docNewFolder}
          </button>
          <button onClick={() => { setShowFabMenu(false); setShowUploadModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: 'var(--rounded-full)', background: 'var(--color-canvas)', color: 'var(--color-ink)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
            <span>📎</span> {t.docUpload}
          </button>
        </div>
      )}
      <button
        onClick={() => setShowFabMenu(v => !v)}
        style={{ position: 'fixed', bottom: '80px', right: '20px', width: 52, height: 52, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', zIndex: 100, fontSize: '26px', fontWeight: 300, lineHeight: 1, transition: 'transform 0.2s', transform: showFabMenu ? 'rotate(45deg)' : 'none' }}
        aria-label="Actions"
      >+</button>
    </div>
  );
}
