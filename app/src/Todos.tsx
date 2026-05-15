import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';
import { logActivity } from './lib/activityLog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodoList {
  id: string;
  home_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_by: string;
  created_at: string;
}

interface TodoItem {
  id: string;
  list_id: string;
  home_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'open' | 'done';
  assigned_to: string | null;
  created_by: string;
  sort_order: number;
  created_at: string;
}

interface Member {
  user_id: string;
  display_name: string;
  color: string;
  avatar_url?: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const CheckIcon = ({ checked, color }: { checked: boolean; color?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" stroke={checked ? (color || '#6366f1') : 'var(--color-hairline)'} strokeWidth="1.5" fill={checked ? (color || '#6366f1') : 'transparent'} />
    {checked && <polyline points="7,12 10.5,15.5 17,9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMOJI_OPTIONS = ['✅','📋','🏠','🛒','🎯','💡','🔧','📦','🌿','🐾','🎉','💪','📚','🍽️','🚗','💰'];
const COLOR_OPTIONS = ['#6366f1','#14d8db','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899','#84cc16'];

function formatDueDate(due: string, lang: Lang): { label: string; overdue: boolean } {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(due + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const overdue = diff < 0;
  const monthNames = lang === 'de'
    ? ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (diff === 0) return { label: lang === 'de' ? 'Heute' : 'Today', overdue: false };
  if (diff === 1) return { label: lang === 'de' ? 'Morgen' : 'Tomorrow', overdue: false };
  if (diff === -1) return { label: lang === 'de' ? 'Gestern' : 'Yesterday', overdue: true };
  if (overdue) return { label: `${Math.abs(diff)}d ${lang === 'de' ? 'überfällig' : 'overdue'}`, overdue: true };
  if (diff <= 7) return { label: `${diff}d`, overdue: false };
  return { label: `${d.getDate()} ${monthNames[d.getMonth()]}`, overdue: false };
}

function memberColor(member: Member | undefined): string {
  return member?.color || 'var(--color-muted)';
}

function memberInitial(member: Member | undefined): string {
  return (member?.display_name || '?').charAt(0).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ member, size = 22 }: { member: Member | undefined; size?: number }) {
  if (member?.avatar_url) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <img src={member.avatar_url} alt={member.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: memberColor(member),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {memberInitial(member)}
    </div>
  );
}

function DueBadge({ due, lang }: { due: string; lang: Lang }) {
  const { label, overdue } = formatDueDate(due, lang);
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 6px',
      borderRadius: 'var(--rounded-full)',
      background: overdue ? '#fee2e2' : 'var(--color-surface-strong)',
      color: overdue ? '#dc2626' : 'var(--color-muted)',
    }}>
      {label}
    </span>
  );
}

// ─── Task Sheet ───────────────────────────────────────────────────────────────

interface TaskSheetProps {
  item?: TodoItem | null;
  listId: string;
  listColor: string;
  homeId: string;
  userId: string;
  members: Member[];
  lang: Lang;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  onPushAssignment: (itemId: string, assignedTo: string, title: string) => void;
}

function TaskSheet({ item, listId, listColor, homeId, userId, members, lang, onClose, onSaved, onDeleted, onPushAssignment }: TaskSheetProps) {
  const t = getT(lang);
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [dueDate, setDueDate] = useState(item?.due_date || '');
  const [assignedTo, setAssignedTo] = useState(item?.assigned_to || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        list_id: listId,
        home_id: homeId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        assigned_to: assignedTo || null,
        created_by: userId,
      };
      if (item) {
        const prevAssigned = item.assigned_to;
        await supabase.from('todo_items').update(payload).eq('id', item.id);
        logActivity(homeId, userId, 'edited', 'todo', title.trim());
        if (assignedTo && assignedTo !== userId && assignedTo !== prevAssigned) {
          onPushAssignment(item.id, assignedTo, title.trim());
        }
      } else {
        const { data } = await supabase.from('todo_items').insert(payload).select().single();
        logActivity(homeId, userId, 'added', 'todo', title.trim());
        if (data && assignedTo && assignedTo !== userId) {
          onPushAssignment(data.id, assignedTo, title.trim());
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item || !confirm(t.todoConfirmDeleteTask)) return;
    setDeleting(true);
    await supabase.from('todo_items').delete().eq('id', item.id);
    logActivity(homeId, userId, 'deleted', 'todo', item.title);
    onDeleted?.();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ paddingBottom: '24px' }}>
        <div className="modal-header">
          <h2 className="text-title-md">{item ? t.todoUpdateTask : t.todoAddTask}</h2>
          <button className="icon-button-circle" onClick={onClose}><CloseIcon /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.todoTaskTitle}</label>
            <input
              ref={inputRef}
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.todoTaskTitlePlaceholder}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          <div>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.todoTaskDesc}</label>
            <textarea
              className="form-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.todoTaskTitlePlaceholder}
              rows={2}
              style={{ resize: 'none', minHeight: '60px' }}
            />
          </div>

          <div>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.todoTaskDueDate}</label>
            <input
              className="form-input"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.todoTaskAssign}</label>
            <select
              className="form-input"
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              style={{ background: 'var(--color-canvas)' }}
            >
              <option value="">{t.todoTaskAssignNone}</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
            {item && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  width: 44, height: 44, borderRadius: 'var(--rounded-sm)',
                  border: '1px solid var(--color-hairline)',
                  background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ef4444', flexShrink: 0,
                }}
              >
                <TrashIcon />
              </button>
            )}
            <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>{t.cancel}</button>
            <button
              className="btn-primary"
              style={{ flex: 2, background: listColor }}
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? '…' : (item ? t.todoUpdateTask : t.todoAddTask)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── List Sheet (create / edit a todo_list) ───────────────────────────────────

interface ListSheetProps {
  list?: TodoList | null;
  homeId: string;
  userId: string;
  lang: Lang;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

function ListSheet({ list, homeId, userId, lang, onClose, onSaved, onDeleted }: ListSheetProps) {
  const t = getT(lang);
  const [name, setName] = useState(list?.name || '');
  const [icon, setIcon] = useState(list?.icon || '✅');
  const [color, setColor] = useState(list?.color || '#6366f1');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (list) {
        await supabase.from('todo_lists').update({ name: name.trim(), icon, color }).eq('id', list.id);
      } else {
        await supabase.from('todo_lists').insert({ home_id: homeId, name: name.trim(), icon, color, created_by: userId });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!list || !confirm(t.todoConfirmDeleteList)) return;
    setDeleting(true);
    await supabase.from('todo_lists').delete().eq('id', list.id);
    onDeleted?.();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-title-md">{list ? t.todoEditList : t.todoCreateList}</h2>
          <button className="icon-button-circle" onClick={onClose}><CloseIcon /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '4px' }}>{t.todoListName}</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Neue Liste…"
              autoFocus
            />
          </div>

          <div>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '6px' }}>{t.todoListIcon}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  style={{
                    width: 40, height: 40, fontSize: '20px', borderRadius: 'var(--rounded-sm)',
                    border: `2px solid ${icon === e ? color : 'var(--color-hairline)'}`,
                    background: icon === e ? color + '22' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: '6px' }}>{t.todoListColor}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: c,
                    border: `3px solid ${color === c ? 'var(--color-ink)' : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
            {list && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  width: 44, height: 44, borderRadius: 'var(--rounded-sm)',
                  border: '1px solid var(--color-hairline)',
                  background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ef4444', flexShrink: 0,
                }}
              >
                <TrashIcon />
              </button>
            )}
            <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>{t.cancel}</button>
            <button
              className="btn-primary"
              style={{ flex: 2, background: color }}
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? '…' : t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── List Detail Screen ───────────────────────────────────────────────────────

interface ListDetailProps {
  list: TodoList;
  homeId: string;
  userId: string;
  members: Member[];
  lang: Lang;
  onBack: () => void;
  onListUpdated: (l: TodoList) => void;
  onListDeleted: () => void;
  onPushAssignment: (itemId: string, assignedTo: string, title: string) => void;
}

function ListDetail({ list, homeId, userId, members, lang, onBack, onListUpdated, onListDeleted, onPushAssignment }: ListDetailProps) {
  const t = getT(lang);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<TodoItem | null | 'new'>('new' as any);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [showListSheet, setShowListSheet] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const inlineRef = useRef<HTMLInputElement>(null);
  const prevItemIds = useRef<Set<string>>(new Set());

  // Reset editingItem to null (not auto-open sheet)
  useEffect(() => { setEditingItem(null); }, []);

  useEffect(() => {
    loadItems();
    const channel = supabase
      .channel(`todo_items_list_${list.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items', filter: `list_id=eq.${list.id}` }, loadItems)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [list.id]);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from('todo_items')
      .select('*')
      .eq('list_id', list.id)
      .order('sort_order')
      .order('created_at');
    const fetched = (data || []) as TodoItem[];
    const newIds = prevItemIds.current.size > 0
      ? fetched.filter(i => !prevItemIds.current.has(i.id)).map(i => i.id)
      : [];
    prevItemIds.current = new Set(fetched.map(i => i.id));
    setItems(fetched);
    setLoading(false);
    if (newIds.length > 0) {
      setRecentlyAdded(prev => { const s = new Set(prev); newIds.forEach(id => s.add(id)); return s; });
      setTimeout(() => {
        setRecentlyAdded(prev => { const s = new Set(prev); newIds.forEach(id => s.delete(id)); return s; });
      }, 600);
    }
  }

  async function toggleItem(item: TodoItem) {
    const newStatus = item.status === 'done' ? 'open' : 'done';
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    await supabase.from('todo_items').update({ status: newStatus }).eq('id', item.id);
    if (newStatus === 'done') logActivity(homeId, userId, 'completed', 'todo', item.title);
  }

  async function handleInlineAdd() {
    if (!inlineTitle.trim()) return;
    const payload = {
      list_id: list.id, home_id: homeId, title: inlineTitle.trim(),
      created_by: userId, status: 'open' as const,
    };
    const titleForLog = inlineTitle.trim();
    setInlineTitle('');
    await supabase.from('todo_items').insert(payload);
    logActivity(homeId, userId, 'added', 'todo', titleForLog);
    loadItems();
  }

  const openItems = items.filter(i => i.status === 'open');
  const doneItems = items.filter(i => i.status === 'done');

  function ItemRow({ item }: { item: TodoItem }) {
    const assignee = members.find(m => m.user_id === item.assigned_to);
    return (
      <div
        className={recentlyAdded.has(item.id) ? 'slide-in-up' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
          padding: '10px 0',
          borderBottom: '1px solid var(--color-hairline-soft)',
          opacity: item.status === 'done' ? 0.5 : 1,
        }}
      >
        <button onClick={() => toggleItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          <CheckIcon checked={item.status === 'done'} color={list.color} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-body-md" style={{ textDecoration: item.status === 'done' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
            {item.due_date && <DueBadge due={item.due_date} lang={lang} />}
          </div>
        </div>
        {assignee && <Avatar member={assignee} size={22} />}
        <button onClick={() => { setEditingItem(item); setShowTaskSheet(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-muted)' }}>
          <EditIcon />
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}>←</button>
        <span style={{ fontSize: '24px' }}>{list.icon}</span>
        <h1 className="text-display-lg" style={{ flex: 1 }}>{list.name}</h1>
        <button onClick={() => setShowListSheet(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '4px' }}>
          <EditIcon />
        </button>
      </div>

      {/* Fixed bottom input bar */}
      <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, background: 'var(--color-canvas)', borderTop: '1px solid var(--color-hairline)', padding: '8px 16px', zIndex: 150, paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <input
            ref={inlineRef}
            className="form-input"
            style={{ flex: 1 }}
            value={inlineTitle}
            onChange={e => setInlineTitle(e.target.value)}
            placeholder={t.todoTaskTitlePlaceholder}
            onKeyDown={e => { if (e.key === 'Enter') handleInlineAdd(); }}
          />
          <button
            onClick={handleInlineAdd}
            disabled={!inlineTitle.trim()}
            style={{
              padding: '0 16px', borderRadius: 'var(--rounded-sm)',
              background: list.color, color: 'white', border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: '20px', lineHeight: 1,
              flexShrink: 0, opacity: inlineTitle.trim() ? 1 : 0.4,
            }}
          >+</button>
        </div>
      </div>

      {loading ? (
        <p className="text-body-sm text-muted">{t.loading}</p>
      ) : (
        <>
          {openItems.length === 0 && doneItems.length === 0 && (
            <p className="text-body-sm text-muted">{t.todoNoItems}</p>
          )}

          {openItems.map(item => <ItemRow key={item.id} item={item} />)}

          {doneItems.length > 0 && (
            <>
              <div style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span className="text-body-sm text-muted" style={{ fontWeight: 600 }}>{t.todoDoneSection}</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-hairline)' }} />
                <span className="text-body-sm text-muted">{doneItems.length}</span>
              </div>
              {doneItems.map(item => <ItemRow key={item.id} item={item} />)}
            </>
          )}
        </>
      )}

      {showTaskSheet && (
        <TaskSheet
          item={editingItem as TodoItem | null}
          listId={list.id}
          listColor={list.color}
          homeId={homeId}
          userId={userId}
          members={members}
          lang={lang}
          onClose={() => setShowTaskSheet(false)}
          onSaved={() => { setShowTaskSheet(false); loadItems(); }}
          onDeleted={() => { setShowTaskSheet(false); loadItems(); }}
          onPushAssignment={onPushAssignment}
        />
      )}

      {showListSheet && (
        <ListSheet
          list={list}
          homeId={homeId}
          userId={userId}
          lang={lang}
          onClose={() => setShowListSheet(false)}
          onSaved={() => { setShowListSheet(false); onListUpdated({ ...list }); }}
          onDeleted={() => { setShowListSheet(false); onListDeleted(); }}
        />
      )}
    </div>
  );
}

// ─── Main Todos Component ─────────────────────────────────────────────────────

interface Props {
  homeId: string;
  userId: string;
  language: Lang;
}

export function Todos({ homeId, userId, language }: Props) {
  const t = getT(language);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<TodoList | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabNewTask, setFabNewTask] = useState(false);
  const [fabTaskList, setFabTaskList] = useState<TodoList | null>(null);

  useEffect(() => {
    loadAll();
    const listChannel = supabase
      .channel('todo_lists_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_lists', filter: `home_id=eq.${homeId}` }, loadAll)
      .subscribe();
    const itemChannel = supabase
      .channel('todo_items_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items', filter: `home_id=eq.${homeId}` }, () => loadItems())
      .subscribe();
    return () => {
      supabase.removeChannel(listChannel);
      supabase.removeChannel(itemChannel);
    };
  }, [homeId]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadLists(), loadItems(), loadMembers()]);
    setLoading(false);
  }

  async function loadLists() {
    const { data } = await supabase.from('todo_lists').select('*').eq('home_id', homeId).order('sort_order').order('created_at');
    setLists((data || []) as TodoList[]);
  }

  async function loadItems() {
    const { data } = await supabase.from('todo_items').select('*').eq('home_id', homeId).eq('status', 'open').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
    setItems((data || []) as TodoItem[]);
  }

  async function loadMembers() {
    const { data: memberRows } = await supabase
      .from('home_members')
      .select('user_id')
      .eq('home_id', homeId);

    if (!memberRows || memberRows.length === 0) return;

    const userIds = memberRows.map((m: any) => m.user_id);

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_color, avatar_url')
      .in('id', userIds);

    setMembers(userIds.map((uid: string, i: number) => {
      const profile = profileRows?.find((p: any) => p.id === uid);
      const isMe = uid === userId;
      const name = profile?.display_name || (isMe ? 'You' : `Member ${i + 1}`);
      const color = profile?.avatar_color || '#14d8db';
      return { user_id: uid, display_name: name, color, avatar_url: profile?.avatar_url || undefined };
    }));
  }

  async function sendAssignmentPush(itemId: string, assignedTo: string, title: string) {
    const { data, error } = await supabase.functions.invoke('send-todo-push', {
      body: { item_id: itemId, assigned_to: assignedTo, title, home_id: homeId },
    });
    if (error) console.error('[push] error:', error);
    else console.log('[push] result:', data);
  }

  // "Recent" section: tasks with nearest due_date first; tasks without due_date sorted by created_at desc
  // If any tasks have due_date, show those first; then fill up to 5 with no-date ones
  const dueTasks = items.filter(i => i.due_date).slice(0, 5);
  const recentTasks = items.filter(i => !i.due_date).slice(0, 5 - dueTasks.length);
  const recentItems = [...dueTasks, ...recentTasks].slice(0, 5);

  function openItemCount(listId: string) {
    return items.filter(i => i.list_id === listId).length;
  }

  function getListForItem(item: TodoItem): TodoList | undefined {
    return lists.find(l => l.id === item.list_id);
  }

  if (activeList) {
    return (
      <ListDetail
        list={activeList}
        homeId={homeId}
        userId={userId}
        members={members}
        lang={language}
        onBack={() => { setActiveList(null); loadAll(); }}
        onListUpdated={updated => setActiveList(updated)}
        onListDeleted={() => { setActiveList(null); loadAll(); }}
        onPushAssignment={sendAssignmentPush}
      />
    );
  }

  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <h1 className="text-display-lg">{t.moduleTodos}</h1>
      </div>

      {loading ? (
        <p className="text-body-sm text-muted">{t.loading}</p>
      ) : (
        <>
          {/* Recent section */}
          {recentItems.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.todoRecent}</h2>
              {recentItems.map(item => {
                const itemList = getListForItem(item);
                const assignee = members.find(m => m.user_id === item.assigned_to);
                return (
                  <div
                    key={item.id}
                    onClick={() => itemList && setActiveList(itemList)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                      padding: '9px 0',
                      borderBottom: '1px solid var(--color-hairline-soft)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 4, height: 28, borderRadius: 'var(--rounded-full)', background: itemList?.color || '#6366f1', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-body-md" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      <div className="text-body-sm text-muted" style={{ fontSize: '12px' }}>{itemList?.icon} {itemList?.name}</div>
                    </div>
                    {item.due_date && <DueBadge due={item.due_date} lang={language} />}
                    {assignee && <Avatar member={assignee} size={20} />}
                    <ChevronRight />
                  </div>
                );
              })}
            </div>
          )}

          {/* Lists */}
          {lists.length === 0 ? (
            <p className="text-body-sm text-muted">{t.todoNoLists}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {lists.map(list => {
                const count = openItemCount(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => setActiveList(list)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
                      padding: '14px var(--spacing-base)',
                      background: 'var(--color-canvas)',
                      border: `2px solid ${list.color}`,
                      borderRadius: 'var(--rounded-md)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <span style={{ fontSize: '24px', flexShrink: 0 }}>{list.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div className="text-title-md">{list.name}</div>
                      {count > 0 && <div className="text-body-sm text-muted">{t.todoOpenCount(count)}</div>}
                    </div>
                    <ChevronRight />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* FAB */}
      {fabOpen && !fabNewTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setFabOpen(false)} />
      )}
      {fabNewTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => { setFabNewTask(false); setFabOpen(false); }} />
      )}
      {fabOpen && !fabNewTask && (
        <div style={{ position: 'fixed', bottom: 148, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button onClick={() => { setFabOpen(false); setShowNewList(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 24, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{t.todoNewList}</button>
          <button onClick={() => { setFabNewTask(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 24, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{t.todoNewTask}</button>
        </div>
      )}
      {fabNewTask && (
        <div style={{ position: 'fixed', bottom: 148, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 220 }}>
          <p style={{ fontSize: '12px', color: 'var(--color-muted)', textAlign: 'right', margin: '0 4px 4px', whiteSpace: 'nowrap' }}>{t.todoSelectList}</p>
          {lists.map(l => (
            <button key={l.id} onClick={() => { setFabTaskList(l); setFabNewTask(false); setFabOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 24, background: 'var(--color-canvas)', border: `1px solid ${l.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              <span>{l.icon}</span><span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => { setFabOpen(v => !v); setFabNewTask(false); }}
        style={{
          position: 'fixed', bottom: 84, right: 16, zIndex: 300,
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          cursor: 'pointer', fontSize: '28px', fontWeight: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(20,216,219,0.45)',
          transform: fabOpen || fabNewTask ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.2s',
        }}
      >+</button>

      {showNewList && (
        <ListSheet
          homeId={homeId}
          userId={userId}
          lang={language}
          onClose={() => setShowNewList(false)}
          onSaved={() => { setShowNewList(false); loadAll(); }}
        />
      )}

      {fabTaskList && (
        <TaskSheet
          item={null}
          listId={fabTaskList.id}
          listColor={fabTaskList.color}
          homeId={homeId}
          userId={userId}
          members={members}
          lang={language}
          onClose={() => setFabTaskList(null)}
          onSaved={() => { setFabTaskList(null); loadAll(); }}
          onPushAssignment={sendAssignmentPush}
        />
      )}
    </div>
  );
}

// ─── Dashboard Widget ─────────────────────────────────────────────────────────

interface DashboardWidgetProps {
  homeId: string;
  language: Lang;
  onNavigate: () => void;
}

export function TodosDashboardWidget({ homeId, language, onNavigate }: DashboardWidgetProps) {
  const t = getT(language);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [lists, setLists] = useState<TodoList[]>([]);

  useEffect(() => {
    loadData();
  }, [homeId]);

  async function loadData() {
    const [{ data: itemData }, { data: listData }] = await Promise.all([
      supabase.from('todo_items').select('*').eq('home_id', homeId).eq('status', 'open')
        .order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(5),
      supabase.from('todo_lists').select('id, name, icon, color').eq('home_id', homeId),
    ]);
    setItems((itemData || []) as TodoItem[]);
    setLists((listData || []) as TodoList[]);
  }

  if (items.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
      <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>
        ✅ {t.todoAllTasks}
      </h2>
      <div>
        {items.map(item => {
          const list = lists.find(l => l.id === item.list_id);
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
              padding: '7px 0', borderBottom: '1px solid var(--color-hairline-soft)',
              fontSize: '14px',
            }}>
              <div style={{ width: 3, height: 20, borderRadius: 'var(--rounded-full)', background: list?.color || '#6366f1', flexShrink: 0 }} />
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
              {item.due_date && <DueBadge due={item.due_date} lang={language} />}
            </div>
          );
        })}
      </div>
      <button
        onClick={onNavigate}
        style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontWeight: 600, marginTop: 'var(--spacing-sm)', cursor: 'pointer', padding: 0, fontSize: '14px' }}
      >
        {t.todoSeeAll}
      </button>
    </div>
  );
}
