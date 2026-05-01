import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface ShoppingItem {
  id: string;
  title: string;
  category: string;
  is_checked: boolean;
  created_at: string;
}

const CATEGORY_META: Record<string, { icon: string }> = {
  Groceries: { icon: '🛒' },
  Drogerie:  { icon: '💊' },
  Cleaning:  { icon: '🧹' },
  Luna:      { icon: '🐕' },
  Misc:      { icon: '📦' },
};
const CATEGORY_ORDER = ['Groceries', 'Drogerie', 'Cleaning', 'Luna', 'Misc'];

export function Lists() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchItems();

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
      .order('created_at', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  async function addItem() {
    const title = inputValue.trim();
    if (!title || adding) return;
    setAdding(true);
    setInputValue('');
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
    setItems(prev => prev.filter(i => !i.is_checked));
    await supabase.from('shopping_items').delete().eq('is_checked', true);
  }

  const grouped: Record<string, ShoppingItem[]> = {};
  CATEGORY_ORDER.forEach(cat => { grouped[cat] = []; });
  items.forEach(item => {
    const cat = CATEGORY_ORDER.includes(item.category) ? item.category : 'Misc';
    grouped[cat].push(item);
  });

  const uncheckedCount = items.filter(i => !i.is_checked).length;
  const hasChecked = items.some(i => i.is_checked);

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <h1 className="text-display-lg">Shopping</h1>
          {uncheckedCount > 0 && (
            <p className="text-body-sm text-muted">{uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} left</p>
          )}
        </div>
        {hasChecked && (
          <button
            onClick={clearChecked}
            style={{ background: 'none', border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-full)', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-muted)' }}
          >
            Clear done
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xl)' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Add item..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          style={{ flex: 1 }}
        />
        <button
          onClick={addItem}
          className="btn-primary"
          disabled={adding || !inputValue.trim()}
          style={{ padding: '0 var(--spacing-lg)', minWidth: '52px', fontSize: '22px', fontWeight: 400 }}
        >
          {adding ? '…' : '+'}
        </button>
      </div>

      {loading ? (
        <p className="text-body-sm text-muted">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-body-sm text-muted">No items yet — add something or ask Google Home.</p>
      ) : (
        CATEGORY_ORDER.map(cat => {
          const catItems = grouped[cat];
          if (catItems.length === 0) return null;
          const { icon } = CATEGORY_META[cat];
          return (
            <div key={cat} style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div className="schedule-month-divider" style={{ marginBottom: 'var(--spacing-sm)' }}>
                {icon} {cat}
              </div>
              {catItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--color-hairline-soft)',
                    opacity: item.is_checked ? 0.38 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={() => toggleItem(item)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-primary)', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, fontSize: '16px', textDecoration: item.is_checked ? 'line-through' : 'none' }}>
                    {item.title}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
