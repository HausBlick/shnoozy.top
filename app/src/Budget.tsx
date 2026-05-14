import { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';
import { logActivity } from './lib/activityLog';

interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface BudgetEntry {
  id: string;
  amount: number;
  category_id: string | null;
  description: string | null;
  date: string;
  is_shared: boolean;
  user_id: string;
  budget_categories: { name: string; icon: string; color: string } | null;
}

interface Member {
  user_id: string;
  display_name: string | null;
  avatar_color: string;
}

function formatAmount(amount: number, lang: Lang): string {
  return amount.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Budget({ homeId, language, userId }: { homeId: string; language: Lang; userId: string }) {
  const t = getT(language);

  const now = new Date();
  const [tab, setTab] = useState<'overview' | 'entries'>('overview');
  const [currentMonth, setCurrentMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [formAmount, setFormAmount] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(todayStr());
  const [formShared, setFormShared] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [homeId, currentMonth]);

  async function fetchData() {
    setLoading(true);
    const { year, month } = currentMonth;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endYear = month === 11 ? year + 1 : year;
    const endMonth = month === 11 ? 1 : month + 2;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const [catsRes, entriesRes, membersRes] = await Promise.all([
      supabase.from('budget_categories').select('*').eq('home_id', homeId).order('name'),
      supabase
        .from('budget_entries')
        .select('*, budget_categories(name,icon,color)')
        .eq('home_id', homeId)
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: false }),
      supabase.from('home_members').select('user_id, profiles(display_name, avatar_color)').eq('home_id', homeId),
    ]);

    setCategories(catsRes.data ?? []);
    setEntries(entriesRes.data ?? []);
    setMembers(
      (membersRes.data ?? []).map((m: any) => ({
        user_id: m.user_id,
        display_name: m.profiles?.display_name ?? null,
        avatar_color: m.profiles?.avatar_color ?? '#14d8db',
      }))
    );
    setLoading(false);
  }

  function openAdd() {
    setEditingEntry(null);
    setFormAmount('');
    setFormCategoryId(categories[0]?.id ?? null);
    setFormDescription('');
    setFormDate(todayStr());
    setFormShared(true);
    setModalOpen(true);
  }

  function openEdit(entry: BudgetEntry) {
    setEditingEntry(entry);
    setFormAmount(String(entry.amount));
    setFormCategoryId(entry.category_id);
    setFormDescription(entry.description ?? '');
    setFormDate(entry.date);
    setFormShared(entry.is_shared);
    setModalOpen(true);
  }

  async function handleSave() {
    const amount = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;
    setFormSaving(true);
    try {
      const payload = {
        home_id: homeId,
        user_id: userId,
        amount,
        category_id: formCategoryId || null,
        description: formDescription.trim() || null,
        date: formDate,
        is_shared: formShared,
      };
      const label = `${amount.toFixed(2)} € ${formDescription.trim() ? '· ' + formDescription.trim().slice(0, 40) : ''}`.trim();
      if (editingEntry) {
        await supabase.from('budget_entries').update(payload).eq('id', editingEntry.id);
        logActivity(homeId, userId, 'edited', 'budget_entry', label);
      } else {
        await supabase.from('budget_entries').insert(payload);
        logActivity(homeId, userId, 'added', 'budget_entry', label);
      }
      setModalOpen(false);
      fetchData();
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const entry = entries.find(e => e.id === id);
    await supabase.from('budget_entries').delete().eq('id', id);
    if (entry) logActivity(homeId, userId, 'deleted', 'budget_entry', `${Number(entry.amount).toFixed(2)} €`);
    setConfirmDeleteId(null);
    setModalOpen(false);
    fetchData();
  }

  const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      const key = e.category_id ?? '__none__';
      map[key] = (map[key] ?? 0) + Number(e.amount);
    }
    return map;
  }, [entries]);

  const memberTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.user_id] = (map[e.user_id] ?? 0) + Number(e.amount);
    }
    return map;
  }, [entries]);

  const monthLabel = t.monthNames[currentMonth.month] + ' ' + currentMonth.year;

  function prevMonth() {
    setCurrentMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  }

  function nextMonth() {
    setCurrentMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  }

  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
        <h1 className="text-display-lg">{t.budgetTitle}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '22px', padding: '4px 8px', lineHeight: 1 }}>‹</button>
          <span className="text-body-md" style={{ fontWeight: 600, minWidth: 110, textAlign: 'center' }}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '22px', padding: '4px 8px', lineHeight: 1 }}>›</button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)', background: 'var(--color-surface)', borderRadius: 'var(--rounded-md)', padding: 4 }}>
        {(['overview', 'entries'] as const).map(v => (
          <button
            key={v}
            onClick={() => setTab(v)}
            style={{
              flex: 1, padding: '8px',
              borderRadius: 'calc(var(--rounded-md) - 2px)',
              background: tab === v ? 'var(--color-primary)' : 'transparent',
              color: tab === v ? 'white' : 'var(--color-muted)',
              border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              transition: 'background 0.15s',
            }}
          >
            {v === 'overview' ? t.budgetOverview : t.budgetEntries}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body-sm text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>{t.loading}</p>
      ) : tab === 'overview' ? (
        <div>
          {/* Total card */}
          <div className="card" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>
            <div className="text-body-sm text-muted" style={{ marginBottom: 4 }}>{t.budgetTotal}</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {formatAmount(total, language)} €
            </div>
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && total > 0 && (
            <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
              {categories.filter(c => categoryTotals[c.id]).map(cat => {
                const amount = categoryTotals[cat.id] ?? 0;
                const pct = total > 0 ? (amount / total) * 100 : 0;
                return (
                  <div key={cat.id} style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span className="text-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{cat.icon}</span> {cat.name}
                      </span>
                      <span className="text-body-sm" style={{ fontWeight: 600 }}>{formatAmount(amount, language)} €</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface-strong)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: cat.color, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
              {categoryTotals['__none__'] ? (
                <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="text-body-sm text-muted">— {t.budgetNoCategory}</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{formatAmount(categoryTotals['__none__'], language)} €</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface-strong)', overflow: 'hidden' }}>
                    <div style={{ width: `${(categoryTotals['__none__'] / total) * 100}%`, height: '100%', background: 'var(--color-muted)', borderRadius: 3 }} />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Member spend */}
          {members.length > 1 && total > 0 && (
            <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
              <h3 className="text-title-sm" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.budgetBalance}</h3>
              {members.map(m => {
                const amount = memberTotals[m.user_id] ?? 0;
                return (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: m.avatar_color, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: 'white',
                    }}>
                      {(m.display_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-body-sm" style={{ flex: 1 }}>{m.display_name ?? m.user_id.slice(0, 8)}</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{formatAmount(amount, language)} €</span>
                  </div>
                );
              })}
            </div>
          )}

          {entries.length === 0 && (
            <p className="text-body-sm text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>{t.budgetNoEntries}</p>
          )}
        </div>
      ) : (
        /* Entries tab */
        <div>
          {entries.length === 0 ? (
            <p className="text-body-sm text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>{t.budgetNoEntries}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {entries.map(entry => {
                const cat = entry.budget_categories;
                const member = members.find(m => m.user_id === entry.user_id);
                const d = new Date(entry.date + 'T12:00:00');
                const dateStr = `${d.getDate()}. ${t.monthNames[d.getMonth()].slice(0, 3)}`;
                return (
                  <button
                    key={entry.id}
                    onClick={() => openEdit(entry)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                      padding: '12px var(--spacing-base)',
                      background: 'var(--color-canvas)',
                      border: 'none', borderRadius: 'var(--rounded-md)', cursor: 'pointer',
                      width: '100%', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--rounded-sm)',
                      background: cat ? cat.color + '33' : 'var(--color-surface-strong)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {cat?.icon ?? '💰'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-body-md" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.description || (cat?.name ?? t.budgetNoCategory)}
                      </div>
                      <div className="text-body-sm text-muted">{dateStr} · {entry.is_shared ? t.budgetShared : t.budgetPersonal}</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: member?.avatar_color ?? '#14d8db', flexShrink: 0 }} />
                    <div className="text-body-md" style={{ fontWeight: 700, minWidth: 60, textAlign: 'right', flexShrink: 0 }}>
                      {formatAmount(Number(entry.amount), language)} €
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={openAdd}
        style={{
          position: 'fixed', bottom: 90, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--color-primary)', color: 'white',
          border: 'none', cursor: 'pointer', fontSize: 28, fontWeight: 300,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}
      >
        +
      </button>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-canvas)',
              borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
              padding: 'var(--spacing-lg)',
              width: '100%', maxWidth: 560,
              maxHeight: '90dvh', overflowY: 'auto',
            }}
          >
            <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>
              {editingEntry ? t.budgetEdit : t.budgetNew}
            </h2>

            {/* Amount */}
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetAmount}</label>
              <input
                type="number"
                inputMode="decimal"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px var(--spacing-base)',
                  fontSize: '28px', fontWeight: 700,
                  borderRadius: 'var(--rounded-md)',
                  border: '2px solid var(--color-primary)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-fg)',
                }}
              />
            </div>

            {/* Category */}
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetCategory}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFormCategoryId(cat.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--rounded-full)',
                      border: formCategoryId === cat.id ? `2px solid ${cat.color}` : '2px solid var(--color-hairline)',
                      background: formCategoryId === cat.id ? cat.color + '22' : 'transparent',
                      cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                      color: 'var(--color-fg)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
                <button
                  onClick={() => setFormCategoryId(null)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--rounded-full)',
                    border: formCategoryId === null ? '2px solid var(--color-primary)' : '2px solid var(--color-hairline)',
                    background: formCategoryId === null ? 'rgba(20,216,219,0.12)' : 'transparent',
                    cursor: 'pointer', fontSize: '13px', color: 'var(--color-muted)',
                  }}
                >
                  {t.budgetNoCategory}
                </button>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetDescription}</label>
              <input
                type="text"
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder={t.budgetDescPlaceholder}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px var(--spacing-base)',
                  borderRadius: 'var(--rounded-md)',
                  border: '1px solid var(--color-hairline)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-fg)', fontSize: '15px',
                }}
              />
            </div>

            {/* Date */}
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetDate}</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px var(--spacing-base)',
                  borderRadius: 'var(--rounded-md)',
                  border: '1px solid var(--color-hairline)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-fg)', fontSize: '15px',
                }}
              />
            </div>

            {/* Shared toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 'var(--spacing-lg)',
              padding: '10px var(--spacing-base)',
              background: 'var(--color-surface)', borderRadius: 'var(--rounded-md)',
            }}>
              <span className="text-body-md">{formShared ? t.budgetShared : t.budgetPersonal}</span>
              <button
                role="switch"
                aria-checked={formShared}
                onClick={() => setFormShared(v => !v)}
                style={{
                  width: 44, height: 26, borderRadius: 13,
                  background: formShared ? 'var(--color-primary)' : 'var(--color-surface-strong)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: formShared ? 21 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              {editingEntry && (
                <button
                  onClick={() => setConfirmDeleteId(editingEntry.id)}
                  style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                >
                  {t.delete}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={formSaving || !formAmount || parseFloat(formAmount.replace(',', '.')) <= 0}
                style={{
                  flex: 1, padding: '12px 20px',
                  borderRadius: 'var(--rounded-md)',
                  background: 'var(--color-primary)', color: 'white',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px',
                  opacity: (formSaving || !formAmount || parseFloat(formAmount.replace(',', '.')) <= 0) ? 0.5 : 1,
                }}
              >
                {formSaving ? '…' : t.budgetSave}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, padding: 'var(--spacing-md)',
        }}>
          <div style={{ background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg)', padding: 'var(--spacing-lg)', maxWidth: 320, width: '100%' }}>
            <p className="text-body-md" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>{t.budgetConfirmDelete}</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600 }}
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
