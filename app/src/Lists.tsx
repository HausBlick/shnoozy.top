import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';
import { logActivity } from './lib/activityLog';

interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  is_checked: boolean;
  created_at: string;
}

interface ShoppingCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  sort_order: number;
}

interface ShoppingSubcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
}

const SWATCHES = [
  '#14d8db', '#7a041f', '#f57c00', '#1e88e5',
  '#43a047', '#8e24aa', '#e53935', '#546e7a',
  '#ff9500', '#00897b', '#d81b60', '#6d4c41',
];

const CategoryLabel = ({ cat }: { cat: ShoppingCategory }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
    <span style={{ fontSize: '15px', lineHeight: 1 }}>{cat.icon}</span>
    <span style={{ color: cat.color }}>{cat.name}</span>
  </span>
);

// ─── Category Edit Form ───────────────────────────────────────────────────────

interface EditFormProps {
  initial: Partial<ShoppingCategory> | null;
  onSave: (data: { name: string; icon: string; color: string; description: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
  language: Lang;
  isNew: boolean;
}

function CategoryEditForm({ initial, onSave, onDelete, onCancel, language, isNew }: EditFormProps) {
  const t = getT(language);
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '📦');
  const [color, setColor] = useState(initial?.color ?? '#14d8db');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), icon, color, description: desc });
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await onDelete?.();
    setDeleting(false);
  }

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}>←</button>
        <h1 className="text-display-lg">{isNew ? t.addCategory : t.categories}</h1>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* Name + Icon row */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.categoryName}</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.categoryName}
              autoFocus
            />
          </div>
          <div style={{ width: 72 }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.categoryIcon}</label>
            <input
              className="form-input"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              style={{ textAlign: 'center', fontSize: '22px', padding: '8px' }}
              maxLength={4}
            />
          </div>
        </div>

        {/* Color swatches */}
        <div>
          <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 8 }}>{t.categoryColor}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SWATCHES.map(hex => (
              <button
                key={hex}
                onClick={() => setColor(hex)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--rounded-full)',
                  background: hex,
                  border: color === hex ? '3px solid var(--color-ink)' : '3px solid transparent',
                  cursor: 'pointer',
                  boxShadow: color === hex ? '0 0 0 1px white inset' : 'none',
                  transition: 'border-color 0.1s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.categoryDesc}</label>
          <textarea
            className="form-input"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder={t.categoryDescPlaceholder}
            rows={3}
            style={{ resize: 'none', lineHeight: 1.5 }}
          />
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)' }}>
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <span style={{ fontWeight: 600, color }}>{name || '…'}</span>
        </div>

        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          style={{ marginTop: 4 }}
        >
          {saving ? '…' : t.save}
        </button>

        {!isNew && onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: 'none',
              border: `1px solid ${confirmDelete ? '#e53935' : 'var(--color-hairline)'}`,
              borderRadius: 'var(--rounded-sm)',
              padding: '12px',
              color: confirmDelete ? '#e53935' : 'var(--color-muted)',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            {deleting ? '…' : confirmDelete ? t.confirmDeleteCat : t.delete}
          </button>
        )}

        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '15px', padding: '4px' }}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ─── Category List View ───────────────────────────────────────────────────────

interface CategoryListViewProps {
  categories: ShoppingCategory[];
  onEdit: (cat: ShoppingCategory) => void;
  onAdd: () => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onBack: () => void;
  language: Lang;
}

function CategoryListView({ categories, onEdit, onAdd, onReorder, onBack, language }: CategoryListViewProps) {
  const t = getT(language);

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}>←</button>
          <h1 className="text-display-lg">{t.categories}</h1>
        </div>
        <button
          onClick={onAdd}
          style={{ background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--rounded-full)', color: 'white', width: 36, height: 36, fontSize: '22px', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >+</button>
      </div>

      {categories.length === 0 && (
        <p className="text-body-sm text-muted">{t.noCategories}</p>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: '13px var(--spacing-base)',
              borderBottom: idx < categories.length - 1 ? '1px solid var(--color-hairline-soft)' : 'none',
            }}
          >
            {/* Up/down */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
              <button
                onClick={() => idx > 0 && onReorder(idx, idx - 1)}
                disabled={idx === 0}
                style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--color-hairline)' : 'var(--color-muted)', padding: '1px 4px', fontSize: '11px', lineHeight: 1 }}
              >▲</button>
              <button
                onClick={() => idx < categories.length - 1 && onReorder(idx, idx + 1)}
                disabled={idx === categories.length - 1}
                style={{ background: 'none', border: 'none', cursor: idx === categories.length - 1 ? 'default' : 'pointer', color: idx === categories.length - 1 ? 'var(--color-hairline)' : 'var(--color-muted)', padding: '1px 4px', fontSize: '11px', lineHeight: 1 }}
              >▼</button>
            </div>

            <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{cat.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: cat.color, fontSize: '15px' }}>{cat.name}</div>
              {cat.description && (
                <div className="text-body-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.description}</div>
              )}
            </div>
            <button
              onClick={() => onEdit(cat)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '6px', flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        style={{
          width: '100%',
          marginTop: 'var(--spacing-md)',
          padding: '14px',
          borderRadius: 'var(--rounded-lg)',
          border: '1px dashed var(--color-hairline)',
          background: 'transparent',
          color: 'var(--color-primary)',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '15px',
        }}
      >
        + {t.addCategory}
      </button>
    </div>
  );
}

// ─── Main Lists component ─────────────────────────────────────────────────────

type ListView = 'list' | 'categories' | 'edit-category' | 'new-category';

export function Lists({ homeId, language, userId }: { homeId: string; language: Lang; userId: string }) {
  const t = getT(language);
  const [view, setView] = useState<ListView>('list');
  const [editingCat, setEditingCat] = useState<ShoppingCategory | null>(null);

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [categories, setCategories] = useState<ShoppingCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ShoppingSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<{ name: string; category: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [doneExpanded, setDoneExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
    fetchItems();
    fetchHistory();

    const channel = supabase
      .channel(`shopping_items_${homeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shopping_items',
        filter: `home_id=eq.${homeId}`,
      }, fetchItems)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [homeId]);

  async function fetchCategories() {
    const { data: cats } = await supabase
      .from('shopping_categories')
      .select('id, name, icon, color, description, sort_order')
      .eq('home_id', homeId)
      .order('sort_order');

    if (!cats?.length) return;
    setCategories(cats);

    const ids = cats.map((c: ShoppingCategory) => c.id);
    const { data: subs } = await supabase
      .from('shopping_subcategories')
      .select('id, category_id, name, sort_order')
      .in('category_id', ids)
      .order('sort_order');

    setSubcategories(subs ?? []);
  }

  async function fetchItems() {
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('home_id', homeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('shopping_items')
      .select('name, category')
      .eq('home_id', homeId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    const seen = new Set<string>();
    const result: { name: string; category: string }[] = [];
    for (const item of (data || [])) {
      const key = item.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); result.push({ name: item.name, category: item.category }); }
    }
    setHistory(result);
  }

  // ─── Category CRUD ──────────────────────────────────────────────────────────

  async function saveCategory(data: { name: string; icon: string; color: string; description: string }) {
    if (editingCat) {
      await supabase.from('shopping_categories')
        .update({ name: data.name, icon: data.icon, color: data.color, description: data.description })
        .eq('id', editingCat.id);
    } else {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0);
      await supabase.from('shopping_categories').insert({
        home_id: homeId,
        name: data.name,
        icon: data.icon,
        color: data.color,
        description: data.description,
        sort_order: maxOrder + 1,
      });
    }
    await fetchCategories();
    setView('categories');
    setEditingCat(null);
  }

  async function deleteCategory() {
    if (!editingCat) return;
    await supabase.from('shopping_categories').delete().eq('id', editingCat.id);
    await fetchCategories();
    setView('categories');
    setEditingCat(null);
  }

  async function reorderCategories(fromIdx: number, toIdx: number) {
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Optimistic update
    setCategories(reordered);

    // Persist new sort_orders
    await Promise.all(
      reordered.map((cat, idx) =>
        supabase.from('shopping_categories').update({ sort_order: idx }).eq('id', cat.id)
      )
    );
  }

  // ─── Shopping list logic ────────────────────────────────────────────────────

  function handleInputChange(value: string) {
    setInputValue(value);
    if (value.trim().length < 2) { setSuggestions([]); return; }
    const lower = value.toLowerCase();
    const activeNames = new Set(items.map(i => i.name.toLowerCase()));
    const matches = history
      .filter(h => h.name.toLowerCase().includes(lower) && !activeNames.has(h.name.toLowerCase()))
      .map(h => h.name)
      .slice(0, 5);
    setSuggestions(matches);
  }

  async function addItem(nameOverride?: string) {
    const name = (nameOverride ?? inputValue).trim();
    if (!name || adding) return;
    setAdding(true);
    setInputValue('');
    setSuggestions([]);
    try {
      await supabase.functions.invoke('add-shopping-item', { body: { item: name, home_id: homeId } });
      logActivity(homeId, userId, 'added', 'shopping_item', name);
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setAdding(false);
    }
  }

  async function toggleItem(item: ShoppingItem) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
    await supabase.from('shopping_items').update({ is_checked: !item.is_checked }).eq('id', item.id);
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('shopping_items').delete().eq('id', id);
  }

  async function clearChecked() {
    const now = new Date().toISOString();
    setItems(prev => prev.filter(i => !i.is_checked));
    await supabase.from('shopping_items')
      .update({ deleted_at: now })
      .eq('home_id', homeId)
      .eq('is_checked', true)
      .is('deleted_at', null);
    fetchHistory();
  }

  function renderItem(item: ShoppingItem, checked = false) {
    return (
      <div
        key={item.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: '10px 0',
          borderBottom: '1px solid var(--color-hairline-soft)',
          ...(checked ? { opacity: 0.38 } : {}),
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggleItem(item)}
          style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-primary)', flexShrink: 0 }}
        />
        <span style={{ flex: 1, fontSize: '16px', ...(checked ? { textDecoration: 'line-through' } : {}) }}>
          {item.name}
        </span>
        <button
          onClick={() => deleteItem(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}
        >×</button>
      </div>
    );
  }

  function renderCategoryItems(cat: ShoppingCategory, catItems: ShoppingItem[]) {
    const catSubs = subcategories.filter(s => s.category_id === cat.id);
    if (catSubs.length === 0) return catItems.map(item => renderItem(item));

    const subGrouped: Record<string, ShoppingItem[]> = {};
    catSubs.forEach(s => { subGrouped[s.name] = []; });
    subGrouped[''] = [];

    catItems.forEach(item => {
      const sub = item.subcategory && catSubs.some(s => s.name === item.subcategory)
        ? item.subcategory : '';
      subGrouped[sub].push(item);
    });

    return [...catSubs.map(s => s.name), ''].map(subName => {
      const subItems = subGrouped[subName];
      if (!subItems?.length) return null;
      return (
        <div key={subName || 'other'}>
          {subName && (
            <div style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              padding: '8px 0 2px 0',
              marginTop: '2px',
            }}>
              {subName}
            </div>
          )}
          {subItems.map(item => renderItem(item))}
        </div>
      );
    });
  }

  // ─── Sub-views ──────────────────────────────────────────────────────────────

  if (view === 'categories') {
    return (
      <CategoryListView
        categories={categories}
        onEdit={cat => { setEditingCat(cat); setView('edit-category'); }}
        onAdd={() => { setEditingCat(null); setView('new-category'); }}
        onReorder={reorderCategories}
        onBack={() => setView('list')}
        language={language}
      />
    );
  }

  if (view === 'edit-category' || view === 'new-category') {
    return (
      <CategoryEditForm
        initial={editingCat}
        isNew={view === 'new-category'}
        onSave={saveCategory}
        onDelete={view === 'edit-category' ? deleteCategory : undefined}
        onCancel={() => { setView('categories'); setEditingCat(null); }}
        language={language}
      />
    );
  }

  // ─── Shopping List ──────────────────────────────────────────────────────────

  const activeItems = items.filter(i => !i.is_checked);
  const checkedItems = items.filter(i => i.is_checked);
  const categoryNames = categories.map(c => c.name);
  const miscName = categories.find(c => c.name === 'Misc' || c.name === 'Sonstiges')?.name ?? (categories[categories.length - 1]?.name ?? 'Misc');

  const grouped: Record<string, ShoppingItem[]> = {};
  categories.forEach(cat => { grouped[cat.name] = []; });
  activeItems.forEach(item => {
    const cat = categoryNames.includes(item.category) ? item.category : miscName;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-display-lg">{t.shopping}</h1>
          {activeItems.length > 0 && (
            <p className="text-body-sm text-muted">{t.itemsLeft(activeItems.length)}</p>
          )}
        </div>
        <button
          onClick={() => setView('categories')}
          title={t.categories}
          style={{
            background: 'var(--color-surface-strong)',
            border: 'none',
            borderRadius: 'var(--rounded-full)',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-muted)',
            marginTop: 2,
            flexShrink: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            placeholder={t.addItemPlaceholder}
            value={inputValue}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addItem();
              if (e.key === 'Escape') setSuggestions([]);
            }}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => addItem()}
            className="btn-primary"
            disabled={adding || !inputValue.trim()}
            style={{ padding: '0 var(--spacing-lg)', width: '52px', flexShrink: 0, fontSize: '22px', fontWeight: 400 }}
          >
            {adding ? '…' : '+'}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: '60px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            zIndex: 100,
            overflow: 'hidden',
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}>
            {suggestions.map(s => (
              <div
                key={s}
                onMouseDown={() => addItem(s)}
                style={{
                  padding: '10px 14px',
                  fontSize: '15px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-hairline-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--color-text)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.51"/>
                </svg>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-body-sm text-muted">{t.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-body-sm text-muted">{t.noItems}</p>
      ) : (
        <>
          {categories.map(cat => {
            const catItems = grouped[cat.name] ?? [];
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id} style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="schedule-month-divider" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <CategoryLabel cat={cat} />
                </div>
                {renderCategoryItems(cat, catItems)}
              </div>
            );
          })}

          {checkedItems.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-hairline-soft)', paddingTop: 'var(--spacing-sm)' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0' }}
                onClick={() => setDoneExpanded(e => !e)}
              >
                <span style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={doneExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
                  </svg>
                  {t.done} ({checkedItems.length})
                </span>
                <button
                  onClick={e => { e.stopPropagation(); clearChecked(); }}
                  style={{ background: 'none', border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-full)', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-muted)' }}
                >
                  {t.delete}
                </button>
              </div>
              {doneExpanded && checkedItems.map(item => renderItem(item, true))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
