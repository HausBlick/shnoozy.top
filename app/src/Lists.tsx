import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

interface ShoppingItem {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  is_checked: boolean;
  created_at: string;
}

const CategoryIcon = ({ cat }: { cat: string }) => {
  const style = { flexShrink: 0 as const };
  switch (cat) {
    case 'Fruits & Veggies': return (
      <svg {...style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7cb342" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
      </svg>
    );
    case 'Luna': return (
      <svg {...style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 13c-2.5 0-4.5 2-4.5 4.5S9.5 22 12 22s4.5-2 4.5-4.5S14.5 13 12 13z"/>
        <circle cx="7" cy="10" r="2.5"/><circle cx="10.5" cy="7" r="2.5"/>
        <circle cx="14.5" cy="7" r="2.5"/><circle cx="18" cy="10" r="2.5"/>
      </svg>
    );
    case 'Drogerie': return (
      <svg {...style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8e24aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
        <circle cx="18" cy="18" r="4"/><path d="M18 16v4"/><path d="M16 18h4"/>
      </svg>
    );
    case 'Cleaning': return (
      <svg {...style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#039be5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 22l4-4"/><path d="M6.5 17.5 3 21"/><path d="m14 3-4 4 7 7 4-4z"/>
        <path d="m14 3 3 3"/><path d="m10 7-3 3"/>
      </svg>
    );
    case 'Groceries': return (
      <svg {...style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    );
    default: return (
      <svg {...style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#757575" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    );
  }
};

const CATEGORY_ORDER = ['Fruits & Veggies', 'Luna', 'Drogerie', 'Cleaning', 'Groceries', 'Misc'] as const;
const SUBCATEGORY_ORDER = ['Spices', 'Meat', 'Frozen', 'Coffee & Tea', 'Dairy', 'Cans & Boxes', 'Dry Food', 'Drinks', 'Snacks'] as const;

export function Lists() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<{ title: string; category: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [doneExpanded, setDoneExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
    fetchHistory();

    const channel = supabase
      .channel('shopping_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, fetchItems)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchItems() {
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('shopping_items')
      .select('title, category')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    const seen = new Set<string>();
    const result: { title: string; category: string }[] = [];
    for (const item of (data || [])) {
      const key = item.title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ title: item.title, category: item.category });
      }
    }
    setHistory(result);
  }

  function handleInputChange(value: string) {
    setInputValue(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = value.toLowerCase();
    const activeTitles = new Set(items.map(i => i.title.toLowerCase()));
    const matches = history
      .filter(h => h.title.toLowerCase().includes(lower) && !activeTitles.has(h.title.toLowerCase()))
      .map(h => h.title)
      .slice(0, 5);
    setSuggestions(matches);
  }

  async function addItem(titleOverride?: string) {
    const title = (titleOverride ?? inputValue).trim();
    if (!title || adding) return;
    setAdding(true);
    setInputValue('');
    setSuggestions([]);
    try {
      await supabase.functions.invoke('add-shopping-item', { body: { item: title } });
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
        <span style={{ flex: 1, fontSize: '16px', ...(checked ? { textDecoration: 'line-through' } : {}) }}>{item.title}</span>
        <button
          onClick={() => deleteItem(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}
        >×</button>
      </div>
    );
  }

  function renderGroceries(catItems: ShoppingItem[]) {
    const subGrouped: Record<string, ShoppingItem[]> = {};
    (SUBCATEGORY_ORDER as readonly string[]).forEach(s => { subGrouped[s] = []; });
    subGrouped[''] = [];
    catItems.forEach(item => {
      const sub = item.subcategory && (SUBCATEGORY_ORDER as readonly string[]).includes(item.subcategory)
        ? item.subcategory : '';
      subGrouped[sub].push(item);
    });
    return ([...SUBCATEGORY_ORDER, ''] as string[]).map(sub => {
      const subItems = subGrouped[sub];
      if (subItems.length === 0) return null;
      return (
        <div key={sub || 'other'}>
          {sub && (
            <div style={{
              fontSize: '11px',
              color: 'var(--color-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              padding: '8px 0 2px 0',
              marginTop: '2px',
            }}>
              {sub}
            </div>
          )}
          {subItems.map(item => renderItem(item))}
        </div>
      );
    });
  }

  const activeItems = items.filter(i => !i.is_checked);
  const checkedItems = items.filter(i => i.is_checked);

  const grouped: Record<string, ShoppingItem[]> = {};
  (CATEGORY_ORDER as readonly string[]).forEach(cat => { grouped[cat] = []; });
  activeItems.forEach(item => {
    const cat = (CATEGORY_ORDER as readonly string[]).includes(item.category) ? item.category : 'Misc';
    grouped[cat].push(item);
  });

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <h1 className="text-display-lg">Shopping</h1>
        {activeItems.length > 0 && (
          <p className="text-body-sm text-muted">{activeItems.length} item{activeItems.length !== 1 ? 's' : ''} left</p>
        )}
      </div>

      <div style={{ position: 'relative', marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            placeholder="Add item..."
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
        <p className="text-body-sm text-muted">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-body-sm text-muted">No items yet — add something or ask Google Home.</p>
      ) : (
        <>
          {CATEGORY_ORDER.map(cat => {
            const catItems = grouped[cat];
            if (catItems.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="schedule-month-divider" style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CategoryIcon cat={cat} /> {cat}
                </div>
                {cat === 'Groceries' ? renderGroceries(catItems) : catItems.map(item => renderItem(item))}
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
                  Erledigt ({checkedItems.length})
                </span>
                <button
                  onClick={e => { e.stopPropagation(); clearChecked(); }}
                  style={{ background: 'none', border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-full)', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-muted)' }}
                >
                  Löschen
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
