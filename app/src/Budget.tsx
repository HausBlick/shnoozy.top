import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { getT, type Lang } from './lib/i18n';
import { logActivity } from './lib/activityLog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget_limit: number | null;
  period: 'weekly' | 'monthly' | 'yearly';
  category_type: 'expense' | 'income';
  sort_order: number;
  description: string | null;
}

interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  billing_day: number;
  category_id: string | null;
  active: boolean;
  auto_book: boolean;
  sort_order: number;
}

interface BudgetEntry {
  id: string;
  amount: number;
  category_id: string | null;
  description: string | null;
  date: string;
  split_mode: 'shared' | 'personal';
  entry_type: 'expense' | 'income';
  paid_by: string | null;
  user_id: string;
  recurring_item_id: string | null;
  budget_categories: { name: string; icon: string; color: string } | null;
}

interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
}

interface Member {
  user_id: string;
  display_name: string | null;
  avatar_color: string;
}

interface HomeSettings {
  budget_setup_done: boolean;
  budget_shared_account: 'yes' | 'no';
  budget_split_mode: 'even' | 'individual' | 'none';
  budget_default_period: 'monthly' | 'weekly' | 'yearly';
  budget_ai_receipts: 'yes' | 'no';
}

interface RecurringChange {
  id: string;
  recurring_item_id: string;
  change_type: 'cancellation' | 'price_change';
  effective_date: string;
  new_amount: number | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmt(n: number, _lang?: Lang) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthlyLimit(cat: BudgetCategory): number | null {
  if (cat.budget_limit == null) return null;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  if (cat.period === 'weekly') return (cat.budget_limit / 7) * daysInMonth;
  if (cat.period === 'yearly') return cat.budget_limit / 12;
  return cat.budget_limit;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function effectiveRecurring(item: RecurringItem, changes: RecurringChange[], monthStart: string): { amount: number; cancelled: boolean } {
  const itemChanges = changes.filter(c => c.recurring_item_id === item.id);
  const cancelled = itemChanges
    .filter(c => c.change_type === 'cancellation' && c.effective_date <= monthStart)
    .length > 0;
  if (cancelled) return { amount: 0, cancelled: true };
  const latestPrice = itemChanges
    .filter(c => c.change_type === 'price_change' && c.effective_date <= monthStart)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
  return { amount: latestPrice ? Number(latestPrice.new_amount) : Number(item.amount), cancelled: false };
}

function pctColor(pct: number) {
  if (pct >= 100) return '#ef4444';
  if (pct >= 80) return '#f59e0b';
  return '#10b981';
}

// ─── Chip button ──────────────────────────────────────────────────────────────

function Chip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 'var(--rounded-full)',
        border: active ? `2px solid ${color ?? 'var(--color-primary)'}` : '2px solid var(--color-hairline)',
        background: active ? (color ? color + '22' : 'rgba(20,216,219,0.12)') : 'transparent',
        cursor: 'pointer', fontSize: '14px', fontWeight: 500,
        color: 'var(--color-fg)', fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >{label}</button>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={value} onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: value ? 'var(--color-primary)' : 'var(--color-surface-strong)',
        border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ─── Avatar dot ───────────────────────────────────────────────────────────────

function AvatarDot({ member, size = 28 }: { member: Member; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: member.avatar_color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.43, fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {(member.display_name ?? '?').charAt(0).toUpperCase()}
    </div>
  );
}

// ─── NavArrowBtn ──────────────────────────────────────────────────────────────

const NavArrowBtn = ({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      width: 34, height: 34, borderRadius: 8,
      background: 'var(--color-primary)', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0,
    }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'prev'
        ? <polyline points="15 18 9 12 15 6" />
        : <polyline points="9 18 15 12 9 6" />}
    </svg>
  </button>
);

// ─── BudgetWizard ─────────────────────────────────────────────────────────────

const WIZARD_TOTAL_STEPS = 9;

interface WizardState {
  step: number;
  sharedAccount: 'yes' | 'no' | null;
  splitMode: 'even' | 'individual' | 'none' | null;
  selectedCats: string[];
  defaultPeriod: 'monthly' | 'weekly' | 'yearly' | null;
  catLimits: Record<string, string>;
  wantGoal: boolean | null;
  goalName: string;
  goalAmount: string;
  aiReceipts: 'yes' | 'no' | null;
}

function BudgetWizard({ homeId, language, onDone }: { homeId: string; language: Lang; onDone: () => void }) {
  const t = getT(language);
  const [saving, setSaving] = useState(false);
  const [w, setW] = useState<WizardState>({
    step: 1,
    sharedAccount: null, splitMode: null,
    selectedCats: [], defaultPeriod: null,
    catLimits: {}, wantGoal: null,
    goalName: '', goalAmount: '', aiReceipts: null,
  });

  const defaultCatNames: string[] = t.budgetDefaultCats as unknown as string[];

  function next() { setW(p => ({ ...p, step: Math.min(p.step + 1, WIZARD_TOTAL_STEPS) })); }
  function back() { setW(p => ({ ...p, step: Math.max(p.step - 1, 1) })); }

  async function finish() {
    setSaving(true);
    try {
      // Save home settings
      const settings = [
        { home_id: homeId, key: 'budget_setup_done', value: 'true' },
        { home_id: homeId, key: 'budget_shared_account', value: w.sharedAccount ?? 'no' },
        { home_id: homeId, key: 'budget_split_mode', value: w.splitMode ?? 'none' },
        { home_id: homeId, key: 'budget_default_period', value: w.defaultPeriod ?? 'monthly' },
        { home_id: homeId, key: 'budget_ai_receipts', value: w.aiReceipts ?? 'no' },
      ];
      await supabase.from('home_settings').upsert(settings, { onConflict: 'home_id,key' });

      // Create expense categories
      const period = w.defaultPeriod ?? 'monthly';
      const catRows = w.selectedCats.map((name, i) => ({
        home_id: homeId,
        name,
        icon: defaultCatIcons[name] ?? '💰',
        color: defaultCatColors[i % defaultCatColors.length],
        budget_limit: w.catLimits[name] ? parseFloat(w.catLimits[name].replace(',', '.')) : null,
        period,
        category_type: 'expense' as const,
        sort_order: i,
      }));
      if (catRows.length > 0) {
        await supabase.from('budget_categories').insert(catRows);
      }

      // Create savings goal
      if (w.wantGoal && w.goalName.trim() && w.goalAmount) {
        await supabase.from('budget_savings_goals').insert({
          home_id: homeId,
          name: w.goalName.trim(),
          target_amount: parseFloat(w.goalAmount.replace(',', '.')),
          current_amount: 0,
        });
      }

      onDone();
    } finally {
      setSaving(false);
    }
  }

  const progressPct = Math.round((w.step / WIZARD_TOTAL_STEPS) * 100);

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <h1 className="text-display-lg">{t.budgetSetupTitle}</h1>
        <p className="text-body-sm text-muted">{t.budgetSetupSubtitle}</p>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--color-surface-strong)', borderRadius: 2, marginBottom: 'var(--spacing-lg)', overflow: 'hidden' }}>
        <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>
        {t.budgetSetupStep(w.step, WIZARD_TOTAL_STEPS)}
      </p>

      {/* Step 1: Shared account? */}
      {w.step === 1 && (
        <WizardCard question={t.budgetSetupQ1}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <WizardOption label={t.budgetSetupA1Yes} selected={w.sharedAccount === 'yes'} onClick={() => { setW(p => ({ ...p, sharedAccount: 'yes' })); setTimeout(next, 200); }} />
            <WizardOption label={t.budgetSetupA1No} selected={w.sharedAccount === 'no'} onClick={() => { setW(p => ({ ...p, sharedAccount: 'no' })); setTimeout(next, 200); }} />
          </div>
        </WizardCard>
      )}

      {/* Step 2: Split mode */}
      {w.step === 2 && (
        <WizardCard question={t.budgetSetupQ2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <WizardOption label={t.budgetSetupA2Even} selected={w.splitMode === 'even'} onClick={() => { setW(p => ({ ...p, splitMode: 'even' })); setTimeout(next, 200); }} />
            <WizardOption label={t.budgetSetupA2Individual} selected={w.splitMode === 'individual'} onClick={() => { setW(p => ({ ...p, splitMode: 'individual' })); setTimeout(next, 200); }} />
            <WizardOption label={t.budgetSetupA2None} selected={w.splitMode === 'none'} onClick={() => { setW(p => ({ ...p, splitMode: 'none' })); setTimeout(next, 200); }} />
          </div>
        </WizardCard>
      )}

      {/* Step 3: Categories */}
      {w.step === 3 && (
        <WizardCard question={t.budgetSetupQ3}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
            {defaultCatNames.map(name => (
              <Chip
                key={name} label={`${defaultCatIcons[name] ?? '💰'} ${name}`}
                active={w.selectedCats.includes(name)}
                onClick={() => setW(p => ({
                  ...p,
                  selectedCats: p.selectedCats.includes(name)
                    ? p.selectedCats.filter(c => c !== name)
                    : [...p.selectedCats, name],
                }))}
              />
            ))}
          </div>
          <button className="btn-primary" onClick={next} disabled={w.selectedCats.length === 0}>
            {t.budgetSetupStep(3, WIZARD_TOTAL_STEPS)} →
          </button>
        </WizardCard>
      )}

      {/* Step 4: Period */}
      {w.step === 4 && (
        <WizardCard question={t.budgetSetupQ4}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <WizardOption label={t.budgetSetupA4Monthly} selected={w.defaultPeriod === 'monthly'} onClick={() => { setW(p => ({ ...p, defaultPeriod: 'monthly' })); setTimeout(next, 200); }} />
            <WizardOption label={t.budgetSetupA4Weekly} selected={w.defaultPeriod === 'weekly'} onClick={() => { setW(p => ({ ...p, defaultPeriod: 'weekly' })); setTimeout(next, 200); }} />
            <WizardOption label={t.budgetSetupA4Yearly} selected={w.defaultPeriod === 'yearly'} onClick={() => { setW(p => ({ ...p, defaultPeriod: 'yearly' })); setTimeout(next, 200); }} />
          </div>
        </WizardCard>
      )}

      {/* Step 5: Budget limits */}
      {w.step === 5 && (
        <WizardCard question={t.budgetSetupQ5}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
            {w.selectedCats.map(name => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span style={{ fontSize: '18px' }}>{defaultCatIcons[name] ?? '💰'}</span>
                <span className="text-body-md" style={{ flex: 1 }}>{name}</span>
                <input
                  type="text" inputMode="decimal" placeholder="0"
                  value={w.catLimits[name] ?? ''}
                  onChange={e => setW(p => ({ ...p, catLimits: { ...p.catLimits, [name]: e.target.value.replace('.', ',') } }))}
                  style={{
                    width: 90, padding: '8px 10px', borderRadius: 'var(--rounded-md)',
                    border: '1px solid var(--color-hairline)', background: 'var(--color-surface)',
                    color: 'var(--color-fg)', fontSize: '15px', textAlign: 'right',
                  }}
                />
                <span className="text-body-sm text-muted">€</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={next}>{t.budgetSetupStep(5, WIZARD_TOTAL_STEPS)} →</button>
        </WizardCard>
      )}

      {/* Step 6: Savings goal? */}
      {w.step === 6 && (
        <WizardCard question={t.budgetSetupQ6}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <WizardOption label={t.budgetSetupA6Yes} selected={w.wantGoal === true} onClick={() => { setW(p => ({ ...p, wantGoal: true })); setTimeout(next, 200); }} />
            <WizardOption label={t.budgetSetupA6No} selected={w.wantGoal === false} onClick={() => { setW(p => ({ ...p, wantGoal: false })); setTimeout(next, 200); }} />
          </div>
        </WizardCard>
      )}

      {/* Step 7: Goal details if yes; AI question if no (skips step 8) */}
      {w.step === 7 && (
        <WizardCard question={w.wantGoal ? t.budgetSetupQ7Goal : t.budgetSetupQ8}>
          {w.wantGoal ? (
            <>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetSetupQ7Goal}</label>
                <input
                  type="text" className="form-input"
                  value={w.goalName} onChange={e => setW(p => ({ ...p, goalName: e.target.value }))}
                  placeholder={language === 'de' ? 'z.B. Urlaub 2026' : 'e.g. Holiday 2026'}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetSetupQ7Amount}</label>
                <input
                  type="text" inputMode="decimal" className="form-input"
                  value={w.goalAmount} onChange={e => setW(p => ({ ...p, goalAmount: e.target.value.replace('.', ',') }))}
                  placeholder="1200"
                />
              </div>
              <button className="btn-primary" onClick={next} disabled={!w.goalName.trim() || !w.goalAmount}>
                {t.budgetSetupStep(7, WIZARD_TOTAL_STEPS)} →
              </button>
            </>
          ) : (
            // No goal — answer AI question and jump straight to summary (step 9)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <WizardOption label={t.budgetSetupA8Yes} selected={w.aiReceipts === 'yes'} onClick={() => { setW(p => ({ ...p, aiReceipts: 'yes', step: 9 })); }} />
              <WizardOption label={t.budgetSetupA8No} selected={w.aiReceipts === 'no'} onClick={() => { setW(p => ({ ...p, aiReceipts: 'no', step: 9 })); }} />
            </div>
          )}
        </WizardCard>
      )}

      {/* Step 8: AI receipts */}
      {w.step === 8 && (
        <WizardCard question={t.budgetSetupQ8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <WizardOption label={t.budgetSetupA8Yes} selected={w.aiReceipts === 'yes'} onClick={() => { setW(p => ({ ...p, aiReceipts: 'yes' })); setTimeout(next, 200); }} />
            <WizardOption label={t.budgetSetupA8No} selected={w.aiReceipts === 'no'} onClick={() => { setW(p => ({ ...p, aiReceipts: 'no' })); setTimeout(next, 200); }} />
          </div>
        </WizardCard>
      )}

      {/* Step 9: Summary */}
      {w.step === 9 && (
        <WizardCard question={t.budgetSetupSummary}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
            <SummaryRow label={t.budgetSetupQ1} value={w.sharedAccount === 'yes' ? t.budgetSetupA1Yes : t.budgetSetupA1No} />
            <SummaryRow label={t.budgetSetupQ2} value={w.splitMode === 'even' ? t.budgetSetupA2Even : w.splitMode === 'individual' ? t.budgetSetupA2Individual : t.budgetSetupA2None} />
            <SummaryRow label={t.budgetSetupQ4} value={w.defaultPeriod === 'monthly' ? t.budgetSetupA4Monthly : w.defaultPeriod === 'weekly' ? t.budgetSetupA4Weekly : t.budgetSetupA4Yearly} />
            <SummaryRow label={t.budgetSetupQ3} value={w.selectedCats.join(', ')} />
            {w.wantGoal && w.goalName && <SummaryRow label={t.budgetSavingsGoals} value={`${w.goalName} — ${w.goalAmount} €`} />}
            <SummaryRow label={t.budgetSetupQ8} value={w.aiReceipts === 'yes' ? t.budgetSetupA8Yes : t.budgetSetupA8No} />
          </div>
          <button className="btn-primary" style={{ width: '100%' }} onClick={finish} disabled={saving}>
            {saving ? '…' : t.budgetSetupConfirm}
          </button>
        </WizardCard>
      )}

      {w.step > 1 && (
        <button onClick={back} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', marginTop: 'var(--spacing-md)', fontSize: '15px' }}>
          ← {t.back}
        </button>
      )}
    </div>
  );
}

function WizardCard({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{question}</h2>
      {children}
    </div>
  );
}

function WizardOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px var(--spacing-base)', borderRadius: 'var(--rounded-md)', textAlign: 'left',
        border: selected ? '2px solid var(--color-primary)' : '2px solid var(--color-hairline)',
        background: selected ? 'rgba(20,216,219,0.08)' : 'transparent',
        cursor: 'pointer', fontSize: '15px', fontWeight: selected ? 600 : 400,
        color: 'var(--color-fg)', fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >{label}</button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--spacing-sm)', padding: '6px 0', borderBottom: '1px solid var(--color-hairline-soft)' }}>
      <span className="text-body-sm text-muted">{label}</span>
      <span className="text-body-sm" style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

// ─── Default category icons/colors ───────────────────────────────────────────

const defaultCatIcons: Record<string, string> = {
  'Haushalt': '🏠', 'Household': '🏠',
  'Lebensmittel': '🛒', 'Groceries': '🛒',
  'Restaurant & Freizeit': '🍕', 'Restaurants & Leisure': '🍕',
  'Auto & Transport': '🚗', 'Car & Transport': '🚗',
  'Drogerie & Gesundheit': '💊', 'Drugstore & Health': '💊',
  'Urlaub': '✈️', 'Holiday': '✈️',
  'Kleidung': '👕', 'Clothing': '👕',
  'Sonstiges': '📦', 'Miscellaneous': '📦',
};

const defaultCatColors = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#ec4899','#14b8a6'];

// ─── BudgetDashboard ──────────────────────────────────────────────────────────

function BudgetDashboard({
  homeId, userId, language, categories, entries, savingsGoals, recurringItems, recurringChanges, homeSettings,
  currentMonth, onPrevMonth, onNextMonth,
  onGoToEntries, onRefresh, onNewRecurring, onEditRecurring,
}: {
  homeId: string; userId: string; language: Lang;
  categories: BudgetCategory[]; entries: BudgetEntry[];
  savingsGoals: SavingsGoal[]; recurringItems: RecurringItem[];
  recurringChanges: RecurringChange[]; homeSettings: HomeSettings;
  currentMonth: { year: number; month: number };
  onPrevMonth: () => void; onNextMonth: () => void;
  onGoToEntries: () => void; onRefresh: () => void;
  onNewRecurring: () => void; onEditRecurring: (item: RecurringItem) => void;
}) {
  const t = getT(language);
  const [goalModal, setGoalModal] = useState<SavingsGoal | null>(null);
  const [goalAddAmount, setGoalAddAmount] = useState('');
  const [goalBudgetCatId, setGoalBudgetCatId] = useState<string | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const paidRecurringIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) {
      if (e.recurring_item_id) ids.add(e.recurring_item_id);
    }
    return ids;
  }, [entries]);

  const monthStart = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`;

  const activeRecurring = recurringItems.filter(r => {
    if (!r.active) return false;
    return !effectiveRecurring(r, recurringChanges, monthStart).cancelled;
  });
  const recurringTotal = activeRecurring.reduce((s, r) => s + effectiveRecurring(r, recurringChanges, monthStart).amount, 0);

  async function markAsPaid(item: RecurringItem) {
    setMarkingPaidId(item.id);
    try {
      const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
      const day = Math.min(item.billing_day, daysInMonth);
      const date = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const eff = effectiveRecurring(item, recurringChanges, monthStart);
      await supabase.from('budget_entries').insert({
        home_id: homeId, user_id: userId,
        amount: eff.amount, category_id: item.category_id,
        description: item.name, date,
        split_mode: homeSettings.budget_split_mode === 'none' ? 'personal' : 'shared',
        entry_type: 'expense', recurring_item_id: item.id,
      });
      onRefresh();
    } finally {
      setMarkingPaidId(null);
    }
  }

  const expenseEntries = entries.filter(e => e.entry_type !== 'income');
  const incomeEntries = entries.filter(e => e.entry_type === 'income');

  const catSpend = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenseEntries) {
      if (e.category_id) map[e.category_id] = (map[e.category_id] ?? 0) + Number(e.amount);
    }
    return map;
  }, [expenseEntries]);

  const totalExpenses = expenseEntries.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = incomeEntries.reduce((s, e) => s + Number(e.amount), 0);

  const monthLabel = t.monthNames[currentMonth.month] + ' ' + currentMonth.year;
  const expenseCats = categories.filter(c => c.category_type === 'expense');

  // Suggestions for savings goals
  const surplus = useMemo(() => {
    const suggestions: { cat: BudgetCategory; left: number }[] = [];
    for (const cat of expenseCats) {
      const limit = monthlyLimit(cat);
      if (limit == null) continue;
      const spent = catSpend[cat.id] ?? 0;
      const left = limit - spent;
      if (left > 5) suggestions.push({ cat, left });
    }
    return suggestions;
  }, [expenseCats, catSpend]);

  async function addToGoal() {
    if (!goalModal || !goalAddAmount) return;
    const amount = parseFloat(goalAddAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;
    setGoalSaving(true);
    try {
      await supabase.from('budget_savings_goals')
        .update({ current_amount: goalModal.current_amount + amount })
        .eq('id', goalModal.id);
      if (goalBudgetCatId) {
        await supabase.from('budget_entries').insert({
          home_id: homeId, user_id: userId,
          amount, category_id: goalBudgetCatId,
          description: t.budgetTransferToGoal(goalModal.name),
          date: todayStr(),
          split_mode: homeSettings.budget_split_mode === 'none' ? 'personal' : 'shared',
          entry_type: 'expense',
        });
      }
      onRefresh();
      setGoalModal(null);
      setGoalAddAmount('');
      setGoalBudgetCatId(null);
    } finally {
      setGoalSaving(false);
    }
  }

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
        <NavArrowBtn dir="prev" onClick={onPrevMonth} />
        <span className="text-body-md" style={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{monthLabel}</span>
        <NavArrowBtn dir="next" onClick={onNextMonth} />
      </div>


      {/* Totals summary */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--spacing-md)' }}>
          <div className="text-body-sm text-muted" style={{ marginBottom: 4 }}>{t.budgetExpense}</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{formatAmt(totalExpenses, language)} €</div>
        </div>
        {homeSettings.budget_shared_account === 'yes' && (
          <>
            <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--spacing-md)' }}>
              <div className="text-body-sm text-muted" style={{ marginBottom: 4 }}>{t.budgetIncome}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>{formatAmt(totalIncome, language)} €</div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: 'center', padding: 'var(--spacing-md)' }}>
              <div className="text-body-sm text-muted" style={{ marginBottom: 4 }}>{t.budgetBalance}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: totalIncome - totalExpenses >= 0 ? '#10b981' : '#ef4444' }}>
                {formatAmt(totalIncome - totalExpenses, language)} €
              </div>
            </div>
          </>
        )}
      </div>

      {/* Category bars */}
      {expenseCats.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
          {expenseCats.map(cat => {
            const spent = catSpend[cat.id] ?? 0;
            const limit = monthlyLimit(cat);
            const pct = limit ? Math.min((spent / limit) * 100, 100) : null;
            const color = pct != null ? pctColor(pct) : cat.color;
            return (
              <div key={cat.id} style={{ marginBottom: 'var(--spacing-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span className="text-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{cat.icon}</span>{cat.name}
                    {cat.budget_limit != null && cat.period !== 'monthly' && (
                      <span className="text-body-sm text-muted" style={{ fontSize: '11px' }}>
                        ({cat.period === 'weekly' ? t.budgetPeriodWeekly : t.budgetPeriodYearly})
                      </span>
                    )}
                  </span>
                  <span className="text-body-sm" style={{ fontWeight: 600 }}>
                    {formatAmt(spent, language)} €
                    {limit != null && <span className="text-muted"> / {formatAmt(limit, language)} €</span>}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--color-surface-strong)', overflow: 'hidden' }}>
                  {pct != null ? (
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
                  ) : (
                    <div style={{ width: spent > 0 ? '100%' : '0%', height: '100%', background: cat.color, borderRadius: 4, transition: 'width 0.4s', opacity: 0.4 }} />
                  )}
                </div>
                {limit != null && (
                  <div className="text-body-sm text-muted" style={{ fontSize: '11px', marginTop: 2, textAlign: 'right' }}>
                    {spent > limit
                      ? `${formatAmt(spent - limit, language)} € ${t.budgetOverspent}`
                      : `${formatAmt(limit - spent, language)} € ${t.budgetRemaining}`}
                  </div>
                )}
              </div>
            );
          })}

          {expenseCats.length === 0 && (
            <p className="text-body-sm text-muted">{t.budgetNoCategories}</p>
          )}
        </div>
      )}

      {/* Savings goals */}
      {savingsGoals.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 className="text-title-sm" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.budgetSavingsGoals}</h3>
          {surplus.length > 0 && (
            <div style={{
              background: 'rgba(20,216,219,0.08)', borderRadius: 'var(--rounded-md)',
              padding: '10px var(--spacing-base)', marginBottom: 'var(--spacing-sm)', fontSize: '13px',
            }}>
              💡 {t.budgetSavingsGoalSuggestion(surplus[0].cat.name, formatAmt(surplus[0].left, language))}
            </div>
          )}
          {savingsGoals.map(goal => {
            const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
            return (
              <div key={goal.id} style={{ marginBottom: 'var(--spacing-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span className="text-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{goal.icon}</span>{goal.name}
                  </span>
                  <span className="text-body-sm" style={{ fontWeight: 600 }}>
                    {formatAmt(goal.current_amount, language)} / {formatAmt(goal.target_amount, language)} €
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--color-surface-strong)', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: goal.color, borderRadius: 4, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    onClick={() => { setGoalModal(goal); setGoalAddAmount(''); setGoalBudgetCatId(null); }}
                    style={{ fontSize: '13px', padding: '6px 14px', borderRadius: 'var(--rounded-sm)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                  >+ {t.budgetSavingsGoalAdd}</button>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-hairline-soft)', paddingTop: 'var(--spacing-sm)' }}>
            ℹ️ {t.budgetSavingsGoalBankingHint}
          </div>
        </div>
      )}

      {/* Recurring expenses */}
      {activeRecurring.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
            <h3 className="text-title-sm">{t.budgetRecurring}</h3>
            <button onClick={onNewRecurring}
              style={{ fontSize: '13px', padding: '6px 14px', borderRadius: 'var(--rounded-sm)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
              + {t.budgetRecurringNew}
            </button>
          </div>
          {activeRecurring.map(item => {
            const paid = paidRecurringIds.has(item.id);
            const busy = markingPaidId === item.id;
            const cat = categories.find(c => c.id === item.category_id);
            const eff = effectiveRecurring(item, recurringChanges, monthStart);
            const itemChanges = recurringChanges.filter(c => c.recurring_item_id === item.id);
            const upcomingCancel = itemChanges.find(c => c.change_type === 'cancellation' && c.effective_date > monthStart);
            const upcomingPrice = itemChanges
              .filter(c => c.change_type === 'price_change' && c.effective_date > monthStart)
              .sort((a, b) => a.effective_date.localeCompare(b.effective_date))[0];
            return (
              <div key={item.id} style={{
                padding: '8px 0', borderBottom: '1px solid var(--color-hairline-soft)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="text-body-md" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      <button onClick={() => onEditRecurring(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--color-muted)', fontSize: '13px', flexShrink: 0, lineHeight: 1 }}>✏️</button>
                    </div>
                    <div className="text-body-sm text-muted">
                      {cat && <span style={{ marginRight: 4 }}>{cat.icon} {cat.name} ·</span>}
                      {formatAmt(eff.amount, language)} €
                    </div>
                  </div>
                  {paid ? (
                    <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600, flexShrink: 0 }}>{t.budgetRecurringPaid}</span>
                  ) : (
                    <button
                      onClick={() => markAsPaid(item)}
                      disabled={busy}
                      style={{
                        fontSize: '12px', padding: '5px 10px', borderRadius: 'var(--rounded-sm)',
                        border: '1px solid var(--color-primary)', background: 'transparent',
                        color: 'var(--color-primary)', cursor: busy ? 'default' : 'pointer',
                        fontWeight: 600, flexShrink: 0, opacity: busy ? 0.5 : 1,
                      }}
                    >{busy ? '…' : t.budgetRecurringMarkPaid}</button>
                  )}
                </div>
                {(upcomingCancel || upcomingPrice) && (
                  <div style={{ marginTop: 3 }}>
                    {upcomingCancel && (
                      <span style={{ fontSize: '11px', color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '2px 6px', marginRight: 4 }}>
                        {t.budgetRecurringUpcomingCancel(formatDate(upcomingCancel.effective_date))}
                      </span>
                    )}
                    {upcomingPrice && (
                      <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderRadius: 4, padding: '2px 6px' }}>
                        {t.budgetRecurringUpcomingPrice(formatDate(upcomingPrice.effective_date), formatAmt(Number(upcomingPrice.new_amount), language))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="text-body-sm text-muted" style={{ marginTop: 'var(--spacing-sm)', textAlign: 'right' }}>
            {t.budgetRecurringTotal(formatAmt(recurringTotal, language))}
          </div>
        </div>
      )}

      {/* Entries link */}
      <button
        onClick={onGoToEntries}
        style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 'var(--spacing-md)' }}
      >{t.budgetEntries} →</button>

      {/* Savings goal modal */}
      {goalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setGoalModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
            padding: 'var(--spacing-lg)', width: '100%', maxWidth: 560,
          }}>
            <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>
              {goalModal.icon} {goalModal.name}
            </h2>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetSavingsGoalAddAmount}</label>
            <input
              type="text" inputMode="decimal" className="form-input" autoFocus
              value={goalAddAmount} onChange={e => setGoalAddAmount(e.target.value.replace('.', ','))}
              placeholder="50"
            />
            <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetDeductFromBudget}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                <Chip label="–" active={goalBudgetCatId === null} onClick={() => setGoalBudgetCatId(null)} />
                {categories.filter(c => c.category_type === 'expense').map(cat => (
                  <Chip key={cat.id} label={`${cat.icon} ${cat.name}`}
                    active={goalBudgetCatId === cat.id}
                    onClick={() => setGoalBudgetCatId(goalBudgetCatId === cat.id ? null : cat.id)}
                    color={cat.color} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: 'var(--spacing-md)' }}>
              ℹ️ {t.budgetSavingsGoalBankingHint}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setGoalModal(null); setGoalBudgetCatId(null); }}>{t.cancel}</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={addToGoal} disabled={goalSaving || !goalAddAmount}>
                {goalSaving ? '…' : t.budgetSavingsGoalAdd}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EntryForm ────────────────────────────────────────────────────────────────

interface EntryFormProps {
  homeId: string; language: Lang; userId: string;
  categories: BudgetCategory[]; members: Member[]; homeSettings: HomeSettings;
  entryType: 'expense' | 'income';
  editingEntry?: BudgetEntry | null;
  prefilled?: Partial<{ amount: string; description: string; categoryId: string | null }>;
  onSave: () => void; onCancel: () => void;
  onDelete?: (id: string) => void;
}

function EntryForm({ homeId, language, userId, categories, members, homeSettings, entryType, editingEntry, prefilled, onSave, onCancel, onDelete }: EntryFormProps) {
  const t = getT(language);
  const [amount, setAmount] = useState((prefilled?.amount ?? (editingEntry ? String(editingEntry.amount) : '')).replace('.', ','));
  const [categoryId, setCategoryId] = useState<string | null>(
    prefilled?.categoryId !== undefined ? prefilled.categoryId :
    editingEntry?.category_id ?? (categories.filter(c => c.category_type === entryType)[0]?.id ?? null)
  );
  const [description, setDescription] = useState(prefilled?.description ?? editingEntry?.description ?? '');
  const [date, setDate] = useState(editingEntry?.date ?? todayStr());
  const [splitMode, setSplitMode] = useState<'shared' | 'personal'>(editingEntry?.split_mode ?? (homeSettings.budget_split_mode === 'none' ? 'personal' : 'shared'));
  const [paidBy, setPaidBy] = useState<string>(editingEntry?.paid_by ?? userId);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filteredCats = categories.filter(c => c.category_type === entryType);
  const isExpense = entryType === 'expense';

  async function handleSave() {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    setSaving(true);
    try {
      const payload = {
        home_id: homeId, user_id: userId,
        amount: parsedAmount, category_id: categoryId,
        description: description.trim() || null, date,
        split_mode: splitMode, entry_type: entryType,
        paid_by: isExpense ? paidBy : null,
      };
      const label = `${formatAmt(parsedAmount)} € ${description.trim() ? '· ' + description.trim().slice(0, 40) : ''}`.trim();
      if (editingEntry) {
        await supabase.from('budget_entries').update(payload).eq('id', editingEntry.id);
        logActivity(homeId, userId, 'edited', 'budget_entry', label);
      } else {
        await supabase.from('budget_entries').insert(payload);
        logActivity(homeId, userId, 'added', 'budget_entry', label);
      }
      onSave();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingEntry || !onDelete) return;
    await supabase.from('budget_entries').delete().eq('id', editingEntry.id);
    logActivity(homeId, userId, 'deleted', 'budget_entry', `${formatAmt(Number(editingEntry.amount))} €`);
    onDelete(editingEntry.id);
  }

  return (
    <div style={{
      background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
      padding: 'var(--spacing-lg)', width: '100%', maxWidth: 560,
      maxHeight: '90dvh', overflowY: 'auto',
    }}>
      <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>
        {editingEntry ? t.budgetEdit : isExpense ? t.budgetNewExpense : t.budgetNewIncome}
      </h2>

      {/* Amount */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetAmount}</label>
        <input
          type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace('.', ','))}
          placeholder="0,00" autoFocus
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px var(--spacing-base)',
            fontSize: '28px', fontWeight: 700, borderRadius: 'var(--rounded-md)',
            border: `2px solid ${isExpense ? '#ef4444' : '#10b981'}`,
            background: 'var(--color-surface)', color: 'var(--color-fg)',
          }}
        />
      </div>

      {/* Category */}
      {filteredCats.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetCategory}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
            {filteredCats.map(cat => (
              <Chip key={cat.id} label={`${cat.icon} ${cat.name}`} active={categoryId === cat.id}
                onClick={() => setCategoryId(cat.id)} color={cat.color} />
            ))}
            <Chip label={t.budgetNoCategory} active={categoryId === null} onClick={() => setCategoryId(null)} />
          </div>
        </div>
      )}

      {/* Description */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetDescription}</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder={t.budgetDescPlaceholder}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px var(--spacing-base)',
            borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '15px',
          }}
        />
      </div>

      {/* Date */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetDate}</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px var(--spacing-base)',
            borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '15px',
          }}
        />
      </div>

      {/* Paid by (expenses only, multi-member homes) */}
      {isExpense && members.length > 1 && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetPaidBy}</label>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
            {members.map(m => (
              <button key={m.user_id} onClick={() => setPaidBy(m.user_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 'var(--rounded-full)',
                  border: paidBy === m.user_id ? `2px solid ${m.avatar_color}` : '2px solid var(--color-hairline)',
                  background: paidBy === m.user_id ? m.avatar_color + '22' : 'transparent',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--color-fg)', fontFamily: 'inherit',
                }}>
                <AvatarDot member={m} size={20} />
                {m.display_name ?? m.user_id.slice(0, 6)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Split toggle (expenses only, split mode not 'none') */}
      {isExpense && homeSettings.budget_split_mode !== 'none' && members.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--spacing-lg)', padding: '10px var(--spacing-base)',
          background: 'var(--color-surface)', borderRadius: 'var(--rounded-md)',
        }}>
          <span className="text-body-md">{splitMode === 'shared' ? t.budgetShared : t.budgetPersonal}</span>
          <Toggle value={splitMode === 'shared'} onChange={v => setSplitMode(v ? 'shared' : 'personal')} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        {editingEntry && onDelete && (
          <button onClick={() => setConfirmDelete(true)}
            style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
            {t.delete}
          </button>
        )}
        <button onClick={onCancel}
          style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontWeight: 600 }}>
          {t.cancel}
        </button>
        <button onClick={handleSave}
          disabled={saving || !amount || parseFloat(amount.replace(',', '.')) <= 0}
          style={{
            flex: 1, padding: '12px 20px', borderRadius: 'var(--rounded-md)',
            background: isExpense ? '#ef4444' : '#10b981', color: 'white',
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px',
            opacity: (saving || !amount || parseFloat(amount.replace(',', '.')) <= 0) ? 0.5 : 1,
          }}>
          {saving ? '…' : t.budgetSave}
        </button>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 'var(--spacing-md)' }}>
          <div style={{ background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg)', padding: 'var(--spacing-lg)', maxWidth: 320, width: '100%' }}>
            <p className="text-body-md" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>{t.budgetConfirmDelete}</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>
                {t.cancel}
              </button>
              <button onClick={handleDelete}
                style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AiScanModal ─────────────────────────────────────────────────────────────

function AiScanModal({
  language, categories,
  onAnalysed, onFallback, onCancel,
}: {
  language: Lang;
  categories: BudgetCategory[];
  onAnalysed: (prefilled: { amount: string; description: string; categoryId: string | null }) => void;
  onFallback: () => void;
  onCancel: () => void;
}) {
  const t = getT(language);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setAnalysing(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const catList = categories
        .filter(c => c.category_type === 'expense')
        .map(c => ({ id: c.id, name: c.name, description: c.description ?? '' }));

      const { data, error: fnErr } = await supabase.functions.invoke('analyze-receipt', {
        body: { imageBase64: base64, mimeType: file.type, categories: catList },
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      onAnalysed({
        amount: data.amount != null ? String(data.amount).replace('.', ',') : '',
        description: data.description ?? '',
        categoryId: data.suggested_category_id ?? null,
      });
    } catch {
      setError(t.budgetAnalysisError);
      setAnalysing(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
      onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
        padding: 'var(--spacing-lg)', width: '100%', maxWidth: 560,
      }}>
        <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>
          🤖 {t.budgetAiScan}
        </h2>

        {analysing ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}>
            <div style={{ fontSize: '32px', marginBottom: 'var(--spacing-md)' }}>⏳</div>
            <p className="text-body-md text-muted">{t.budgetAnalysing}</p>
          </div>
        ) : (
          <>
            <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--spacing-lg)' }}>
              {t.budgetAiScanHint}
            </p>

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <button
                onClick={() => cameraRef.current?.click()}
                style={{
                  flex: 1, padding: '14px', borderRadius: 'var(--rounded-md)',
                  background: 'var(--color-primary)', color: 'white', border: 'none',
                  cursor: 'pointer', fontSize: '15px', fontWeight: 600,
                }}
              >📷 {t.budgetScanCamera}</button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  flex: 1, padding: '14px', borderRadius: 'var(--rounded-md)',
                  background: 'var(--color-surface-strong)', color: 'var(--color-ink)', border: 'none',
                  cursor: 'pointer', fontSize: '15px', fontWeight: 600,
                }}
              >🖼 {t.budgetScanGallery}</button>
            </div>

            {error && (
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: 8 }}>{error}</p>
                <button
                  onClick={onFallback}
                  style={{ fontSize: '14px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >✏️ {t.budgetManualEntry}</button>
              </div>
            )}

            <div style={{
              background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--rounded-md)',
              padding: '10px var(--spacing-base)', fontSize: '12px',
              color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: 'var(--spacing-md)',
            }}>
              ℹ️ {t.budgetAiScanDisclaimer}
            </div>

            <button onClick={onCancel}
              style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
              {t.cancel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RecurringItemModal ───────────────────────────────────────────────────────

function RecurringItemModal({
  homeId, language, categories, recurringItems, item, onClose, onSave,
}: {
  homeId: string; language: Lang; categories: BudgetCategory[];
  recurringItems: RecurringItem[]; item: RecurringItem | 'new';
  onClose: () => void; onSave: () => void;
}) {
  const t = getT(language);
  const [riName, setRiName] = useState(item === 'new' ? '' : item.name);
  const [riAmount, setRiAmount] = useState(item === 'new' ? '' : String(item.amount).replace('.', ','));
  const [riDay, setRiDay] = useState(item === 'new' ? '1' : String(item.billing_day));
  const [riCategoryId, setRiCategoryId] = useState<string | null>(item === 'new' ? null : item.category_id);
  const [riActive, setRiActive] = useState(item === 'new' ? true : item.active);
  const [riAutoBook, setRiAutoBook] = useState(item === 'new' ? false : item.auto_book);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Planned changes (edit mode only)
  const itemId = item === 'new' ? null : item.id;
  const [changes, setChanges] = useState<RecurringChange[]>([]);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [cancelDate, setCancelDate] = useState('');
  const [priceDate, setPriceDate] = useState('');
  const [priceAmountStr, setPriceAmountStr] = useState('');
  const [changeSaving, setChangeSaving] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    supabase.from('budget_recurring_changes').select('*').eq('recurring_item_id', itemId).order('effective_date')
      .then(({ data }) => setChanges(data ?? []));
  }, [itemId]);

  async function refreshChanges() {
    if (!itemId) return;
    const { data } = await supabase.from('budget_recurring_changes').select('*').eq('recurring_item_id', itemId).order('effective_date');
    setChanges(data ?? []);
  }

  async function addCancellation() {
    if (!itemId || !cancelDate) return;
    setChangeSaving(true);
    try {
      await supabase.from('budget_recurring_changes').insert({ recurring_item_id: itemId, change_type: 'cancellation', effective_date: cancelDate });
      await refreshChanges();
      setShowCancelForm(false); setCancelDate('');
    } finally { setChangeSaving(false); }
  }

  async function addPriceChange() {
    if (!itemId || !priceDate || !priceAmountStr) return;
    setChangeSaving(true);
    try {
      await supabase.from('budget_recurring_changes').insert({ recurring_item_id: itemId, change_type: 'price_change', effective_date: priceDate, new_amount: parseFloat(priceAmountStr.replace(',', '.')) });
      await refreshChanges();
      setShowPriceForm(false); setPriceDate(''); setPriceAmountStr('');
    } finally { setChangeSaving(false); }
  }

  async function deleteChange(id: string) {
    await supabase.from('budget_recurring_changes').delete().eq('id', id);
    setChanges(prev => prev.filter(c => c.id !== id));
  }

  async function save() {
    if (!riName.trim() || !riAmount) return;
    setSaving(true);
    try {
      const payload = {
        home_id: homeId, name: riName.trim(),
        amount: parseFloat(riAmount.replace(',', '.')), billing_day: Math.min(28, Math.max(1, parseInt(riDay) || 1)),
        category_id: riCategoryId, active: riActive, auto_book: riAutoBook,
      };
      if (item === 'new') {
        await supabase.from('budget_recurring_items').insert({ ...payload, sort_order: recurringItems.length });
      } else {
        await supabase.from('budget_recurring_items').update(payload).eq('id', item.id);
      }
      onSave();
    } finally { setSaving(false); }
  }

  async function deleteItem() {
    if (item === 'new') return;
    await supabase.from('budget_recurring_items').delete().eq('id', item.id);
    onSave();
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
        onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
          padding: 'var(--spacing-lg)', width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto',
        }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>
            {item === 'new' ? t.budgetRecurringNew : t.budgetRecurring}
          </h2>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetRecurringName}</label>
            <input type="text" value={riName} onChange={e => setRiName(e.target.value)} className="form-input" autoFocus placeholder="Netflix" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
            <div style={{ flex: 2 }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetRecurringAmountLabel}</label>
              <input type="text" inputMode="decimal" value={riAmount} onChange={e => setRiAmount(e.target.value.replace('.', ','))} className="form-input" placeholder="12,99" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetRecurringDayLabel}</label>
              <input type="number" inputMode="numeric" value={riDay} onChange={e => setRiDay(e.target.value)} min="1" max="28" className="form-input" placeholder="1" />
            </div>
          </div>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetCategory}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
              {categories.filter(c => c.category_type === 'expense').map(cat => (
                <Chip key={cat.id} label={`${cat.icon} ${cat.name}`} active={riCategoryId === cat.id}
                  onClick={() => setRiCategoryId(riCategoryId === cat.id ? null : cat.id)} color={cat.color} />
              ))}
              <Chip label={t.budgetNoCategory} active={riCategoryId === null} onClick={() => setRiCategoryId(null)} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)', padding: '10px var(--spacing-base)', background: 'var(--color-surface)', borderRadius: 'var(--rounded-md)' }}>
            <span className="text-body-md">{t.budgetRecurringActive}</span>
            <Toggle value={riActive} onChange={setRiActive} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)', padding: '10px var(--spacing-base)', background: 'var(--color-surface)', borderRadius: 'var(--rounded-md)' }}>
            <div>
              <div className="text-body-md">{t.budgetRecurringAutoBook}</div>
              <div className="text-body-sm text-muted" style={{ fontSize: '12px' }}>
                {language === 'de' ? 'Wird monatlich automatisch als bezahlt erfasst' : 'Automatically booked as paid each month'}
              </div>
            </div>
            <Toggle value={riAutoBook} onChange={setRiAutoBook} />
          </div>

          {/* Planned changes — edit mode only */}
          {item !== 'new' && (
            <div style={{ borderTop: '1px solid var(--color-hairline-soft)', paddingTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
              <div className="text-body-sm" style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>{t.budgetRecurringPlanChanges}</div>

              {/* Existing changes list */}
              {changes.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                  {changes.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-hairline-soft)' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, marginRight: 6, color: c.change_type === 'cancellation' ? '#ef4444' : '#f59e0b' }}>
                          {c.change_type === 'cancellation' ? '🚫' : '💱'}
                        </span>
                        <span className="text-body-sm">
                          {c.change_type === 'cancellation'
                            ? `${t.budgetRecurringCancelFrom}: ${formatDate(c.effective_date)}`
                            : `${t.budgetRecurringPriceAdjust}: ${formatDate(c.effective_date)} → ${formatAmt(Number(c.new_amount), language)} €`}
                        </span>
                      </div>
                      <button onClick={() => deleteChange(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Cancel contract form */}
              {showCancelForm ? (
                <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--rounded-md)', padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                  <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetRecurringEffectiveFrom}</label>
                  <input type="date" value={cancelDate} onChange={e => setCancelDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px var(--spacing-base)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '14px', marginBottom: 'var(--spacing-sm)' }} />
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button onClick={() => { setShowCancelForm(false); setCancelDate(''); }}
                      style={{ flex: 1, padding: '8px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-muted)' }}>{t.cancel}</button>
                    <button onClick={addCancellation} disabled={changeSaving || !cancelDate}
                      style={{ flex: 1, padding: '8px', borderRadius: 'var(--rounded-md)', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: changeSaving || !cancelDate ? 0.5 : 1 }}>
                      {changeSaving ? '…' : t.save}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowCancelForm(true); setShowPriceForm(false); }}
                  style={{ fontSize: '13px', padding: '6px 12px', borderRadius: 'var(--rounded-md)', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600, marginRight: 'var(--spacing-xs)' }}>
                  🚫 {t.budgetRecurringCancelContract}
                </button>
              )}

              {/* Price change form */}
              {showPriceForm ? (
                <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--rounded-md)', padding: 'var(--spacing-md)', marginTop: 'var(--spacing-xs)' }}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetRecurringEffectiveFrom}</label>
                      <input type="date" value={priceDate} onChange={e => setPriceDate(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px var(--spacing-base)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '14px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetRecurringNewPrice}</label>
                      <input type="text" inputMode="decimal" value={priceAmountStr} onChange={e => setPriceAmountStr(e.target.value.replace('.', ','))}
                        placeholder="15,99"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px var(--spacing-base)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button onClick={() => { setShowPriceForm(false); setPriceDate(''); setPriceAmountStr(''); }}
                      style={{ flex: 1, padding: '8px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-muted)' }}>{t.cancel}</button>
                    <button onClick={addPriceChange} disabled={changeSaving || !priceDate || !priceAmountStr}
                      style={{ flex: 1, padding: '8px', borderRadius: 'var(--rounded-md)', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: changeSaving || !priceDate || !priceAmountStr ? 0.5 : 1 }}>
                      {changeSaving ? '…' : t.save}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowPriceForm(true); setShowCancelForm(false); }}
                  style={{ fontSize: '13px', padding: '6px 12px', borderRadius: 'var(--rounded-md)', border: '1px solid #f59e0b', background: 'transparent', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, marginTop: showCancelForm ? 0 : 'var(--spacing-xs)' }}>
                  💱 {t.budgetRecurringPriceAdjust}
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            {item !== 'new' && (
              <button onClick={() => setConfirmDelete(true)}
                style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                {t.delete}
              </button>
            )}
            <button onClick={onClose}
              style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--color-muted)' }}>
              {t.cancel}
            </button>
            <button onClick={save} disabled={saving || !riName.trim() || !riAmount}
              style={{ flex: 1, padding: '12px 20px', borderRadius: 'var(--rounded-md)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: saving || !riName.trim() || !riAmount ? 0.5 : 1 }}>
              {saving ? '…' : t.save}
            </button>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 'var(--spacing-md)' }}>
          <div style={{ background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg)', padding: 'var(--spacing-lg)', maxWidth: 320, width: '100%' }}>
            <p className="text-body-md" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>{t.budgetConfirmDelete}</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>{t.cancel}</button>
              <button onClick={deleteItem} style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600 }}>{t.delete}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── BudgetSettingsView ───────────────────────────────────────────────────────

function BudgetSettingsView({
  homeId, language, categories, savingsGoals, recurringItems, homeSettings, userRole,
  onBack, onRefresh, onOpenRecurring,
}: {
  homeId: string; language: Lang; categories: BudgetCategory[];
  savingsGoals: SavingsGoal[]; recurringItems: RecurringItem[];
  homeSettings: HomeSettings; userRole?: 'admin' | 'member';
  onBack: () => void; onRefresh: () => void; onOpenRecurring: (item: RecurringItem | 'new') => void;
}) {
  const t = getT(language);
  const [catModal, setCatModal] = useState<BudgetCategory | 'new' | null>(null);
  const [goalModal, setGoalModal] = useState<SavingsGoal | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

  // Category form state
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('💰');
  const [catColor, setCatColor] = useState('#6366f1');
  const [catLimit, setCatLimit] = useState('');
  const [catPeriod, setCatPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catDesc, setCatDesc] = useState('');
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);

  // Goal form state
  const [goalName, setGoalName] = useState('');
  const [goalIcon, setGoalIcon] = useState('🎯');
  const [goalColor, setGoalColor] = useState('#14d8db');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string | null>(null);

  // Home settings form state
  const [hSharedAccount, setHSharedAccount] = useState<'yes' | 'no'>(homeSettings.budget_shared_account);
  const [hSplitMode, setHSplitMode] = useState<'even' | 'individual' | 'none'>(homeSettings.budget_split_mode);
  const [hDefaultPeriod, setHDefaultPeriod] = useState<'monthly' | 'weekly' | 'yearly'>(homeSettings.budget_default_period);
  const [hAiReceipts, setHAiReceipts] = useState<'yes' | 'no'>(homeSettings.budget_ai_receipts);
  const [hSaving, setHSaving] = useState(false);
  const [hSaved, setHSaved] = useState(false);

  function openCatModal(cat: BudgetCategory | 'new') {
    if (cat === 'new') {
      setCatName(''); setCatIcon('💰'); setCatColor('#6366f1');
      setCatLimit(''); setCatPeriod('monthly'); setCatType('expense'); setCatDesc('');
    } else {
      setCatName(cat.name); setCatIcon(cat.icon); setCatColor(cat.color);
      setCatLimit(cat.budget_limit != null ? String(cat.budget_limit).replace('.', ',') : '');
      setCatPeriod(cat.period); setCatType(cat.category_type);
      setCatDesc(cat.description ?? '');
    }
    setCatModal(cat);
  }

  function openGoalModal(goal: SavingsGoal | 'new') {
    if (goal === 'new') {
      setGoalName(''); setGoalIcon('🎯'); setGoalColor('#14d8db');
      setGoalTarget(''); setGoalCurrent('');
    } else {
      setGoalName(goal.name); setGoalIcon(goal.icon); setGoalColor(goal.color);
      setGoalTarget(String(goal.target_amount).replace('.', ',')); setGoalCurrent(String(goal.current_amount).replace('.', ','));
    }
    setGoalModal(goal);
  }

  async function sortCat(cat: BudgetCategory, dir: 'up' | 'down') {
    const idx = categories.findIndex(c => c.id === cat.id);
    const otherIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= categories.length) return;
    const other = categories[otherIdx];
    await supabase.from('budget_categories').update({ sort_order: other.sort_order }).eq('id', cat.id);
    await supabase.from('budget_categories').update({ sort_order: cat.sort_order }).eq('id', other.id);
    onRefresh();
  }

  async function saveHomeSettings() {
    setHSaving(true);
    try {
      await supabase.from('home_settings').upsert([
        { home_id: homeId, key: 'budget_shared_account', value: hSharedAccount },
        { home_id: homeId, key: 'budget_split_mode', value: hSplitMode },
        { home_id: homeId, key: 'budget_default_period', value: hDefaultPeriod },
        { home_id: homeId, key: 'budget_ai_receipts', value: hAiReceipts },
      ], { onConflict: 'home_id,key' });
      onRefresh();
      setHSaved(true);
      setTimeout(() => setHSaved(false), 2000);
    } finally {
      setHSaving(false);
    }
  }

  async function saveCategory() {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        home_id: homeId, name: catName.trim(), icon: catIcon, color: catColor,
        budget_limit: catLimit ? parseFloat(catLimit.replace(',', '.')) : null,
        period: catPeriod, category_type: catType,
        description: catDesc.trim() || null,
      };
      if (catModal === 'new') {
        await supabase.from('budget_categories').insert({ ...payload, sort_order: categories.length });
      } else if (catModal) {
        await supabase.from('budget_categories').update(payload).eq('id', catModal.id);
      }
      onRefresh(); setCatModal(null);
    } finally { setSaving(false); }
  }

  async function deleteCategory(id: string) {
    await supabase.from('budget_categories').delete().eq('id', id);
    onRefresh(); setCatModal(null); setConfirmDeleteCatId(null);
  }

  async function saveGoal() {
    if (!goalName.trim() || !goalTarget) return;
    setSaving(true);
    try {
      const payload = {
        home_id: homeId, name: goalName.trim(), icon: goalIcon, color: goalColor,
        target_amount: parseFloat(goalTarget.replace(',', '.')),
        current_amount: goalCurrent ? parseFloat(goalCurrent.replace(',', '.')) : 0,
      };
      if (goalModal === 'new') {
        await supabase.from('budget_savings_goals').insert(payload);
      } else if (goalModal) {
        await supabase.from('budget_savings_goals').update(payload).eq('id', goalModal.id);
      }
      onRefresh(); setGoalModal(null);
    } finally { setSaving(false); }
  }

  async function deleteGoal(id: string) {
    await supabase.from('budget_savings_goals').delete().eq('id', id);
    onRefresh(); setGoalModal(null); setConfirmDeleteGoalId(null);
  }

  const periodLabel = (p: string) => p === 'weekly' ? t.budgetPeriodWeekly : p === 'yearly' ? t.budgetPeriodYearly : t.budgetPeriodMonthly;
  const PRESET_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#ec4899','#14b8a6','#14d8db','#0ea5e9'];

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', padding: 0 }}>←</button>
        <h1 className="text-display-lg">{t.budgetSettings}</h1>
      </div>

      {/* Categories */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h2 className="text-title-md">{t.budgetCategory}</h2>
          <button onClick={() => openCatModal('new')}
            style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--rounded-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            + {t.budgetAddCategory}
          </button>
        </div>
        {categories.length === 0 && <p className="text-body-sm text-muted">{t.budgetNoCategories}</p>}
        {categories.map((cat, idx) => (
          <div key={cat.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: '1px solid var(--color-hairline-soft)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
              <button onClick={() => sortCat(cat, 'up')} disabled={idx === 0}
                style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--color-hairline)' : 'var(--color-muted)', fontSize: '12px', padding: '1px 4px', lineHeight: 1 }}>↑</button>
              <button onClick={() => sortCat(cat, 'down')} disabled={idx === categories.length - 1}
                style={{ background: 'none', border: 'none', cursor: idx === categories.length - 1 ? 'default' : 'pointer', color: idx === categories.length - 1 ? 'var(--color-hairline)' : 'var(--color-muted)', fontSize: '12px', padding: '1px 4px', lineHeight: 1 }}>↓</button>
            </div>
            <button onClick={() => openCatModal(cat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1,
                padding: '10px 0', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}>
              <span style={{ fontSize: '20px' }}>{cat.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="text-body-md" style={{ fontWeight: 500 }}>{cat.name}</div>
                <div className="text-body-sm text-muted">
                  {cat.budget_limit != null ? `${formatAmt(cat.budget_limit, language)} € · ${periodLabel(cat.period)}` : t.budgetNoLimit}
                  {' · '}{cat.category_type === 'expense' ? t.budgetExpense : t.budgetIncome}
                </div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--color-muted)', fontSize: '16px' }}>›</span>
            </button>
          </div>
        ))}
      </div>

      {/* Savings goals */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h2 className="text-title-md">{t.budgetSavingsGoals}</h2>
          <button onClick={() => openGoalModal('new')}
            style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--rounded-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            + {t.budgetSavingsGoalNew}
          </button>
        </div>
        {savingsGoals.length === 0 && <p className="text-body-sm text-muted">{t.budgetSavingsNoGoals}</p>}
        {savingsGoals.map(goal => (
          <button key={goal.id} onClick={() => openGoalModal(goal)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: '100%',
              padding: '10px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--color-hairline-soft)',
              cursor: 'pointer', textAlign: 'left',
            }}>
            <span style={{ fontSize: '20px' }}>{goal.icon}</span>
            <div style={{ flex: 1 }}>
              <div className="text-body-md" style={{ fontWeight: 500 }}>{goal.name}</div>
              <div className="text-body-sm text-muted">{formatAmt(goal.current_amount, language)} / {formatAmt(goal.target_amount, language)} €</div>
            </div>
            <span style={{ color: 'var(--color-muted)', fontSize: '16px' }}>›</span>
          </button>
        ))}
      </div>

      {/* Recurring expenses card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h2 className="text-title-md">{t.budgetRecurring}</h2>
          <button onClick={() => onOpenRecurring('new')}
            style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--rounded-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            + {t.budgetRecurringNew}
          </button>
        </div>
        {recurringItems.length === 0 && <p className="text-body-sm text-muted">{t.budgetRecurringNoItems}</p>}
        {recurringItems.map(item => (
          <button key={item.id} onClick={() => onOpenRecurring(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: '100%',
              padding: '10px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--color-hairline-soft)',
              cursor: 'pointer', textAlign: 'left', opacity: item.active ? 1 : 0.5,
            }}>
            <div style={{ flex: 1 }}>
              <div className="text-body-md" style={{ fontWeight: 500 }}>{item.name}</div>
              <div className="text-body-sm text-muted">{formatAmt(item.amount, language)} € · {t.budgetRecurringDayLabel.split('(')[0].trim()} {item.billing_day}</div>
            </div>
            {!item.active && <span className="text-body-sm text-muted" style={{ fontSize: '11px' }}>inaktiv</span>}
            <span style={{ color: 'var(--color-muted)', fontSize: '16px' }}>›</span>
          </button>
        ))}
      </div>

      {/* Home settings card — admin only */}
      {userRole === 'admin' && (
        <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{t.budgetHomeSettings}</h2>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetSetupQ1}</label>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
              <Chip label={t.budgetSetupA1Yes} active={hSharedAccount === 'yes'} onClick={() => setHSharedAccount('yes')} />
              <Chip label={t.budgetSetupA1No} active={hSharedAccount === 'no'} onClick={() => setHSharedAccount('no')} />
            </div>
          </div>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetSetupQ2}</label>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
              <Chip label={t.budgetSetupA2Even} active={hSplitMode === 'even'} onClick={() => setHSplitMode('even')} />
              <Chip label={t.budgetSetupA2Individual} active={hSplitMode === 'individual'} onClick={() => setHSplitMode('individual')} />
              <Chip label={t.budgetSetupA2None} active={hSplitMode === 'none'} onClick={() => setHSplitMode('none')} />
            </div>
          </div>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetSetupQ4}</label>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
              <Chip label={t.budgetSetupA4Monthly} active={hDefaultPeriod === 'monthly'} onClick={() => setHDefaultPeriod('monthly')} />
              <Chip label={t.budgetSetupA4Weekly} active={hDefaultPeriod === 'weekly'} onClick={() => setHDefaultPeriod('weekly')} />
              <Chip label={t.budgetSetupA4Yearly} active={hDefaultPeriod === 'yearly'} onClick={() => setHDefaultPeriod('yearly')} />
            </div>
          </div>
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetSetupQ8}</label>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
              <Chip label={t.budgetSetupA8Yes} active={hAiReceipts === 'yes'} onClick={() => setHAiReceipts('yes')} />
              <Chip label={t.budgetSetupA8No} active={hAiReceipts === 'no'} onClick={() => setHAiReceipts('no')} />
            </div>
          </div>
          <button onClick={saveHomeSettings} disabled={hSaving}
            style={{ padding: '10px 20px', borderRadius: 'var(--rounded-md)', background: hSaved ? '#10b981' : 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'background 0.3s' }}>
            {hSaving ? '…' : hSaved ? t.saved : t.save}
          </button>
        </div>
      )}

      {/* Category modal */}
      {catModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setCatModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
            padding: 'var(--spacing-lg)', width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto',
          }}>
            <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>
              {catModal === 'new' ? t.budgetAddCategory : t.budgetEditCategory}
            </h2>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryName}</label>
              <input type="text" value={catName} onChange={e => setCatName(e.target.value)} className="form-input" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{ flex: 1 }}>
                <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryIcon}</label>
                <input type="text" value={catIcon} onChange={e => setCatIcon(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '22px', textAlign: 'center' }} />
              </div>
              <div style={{ flex: 2 }}>
                <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryColor}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setCatColor(c)}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: catColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryType}</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Chip label={t.budgetCategoryTypeExpense} active={catType === 'expense'} onClick={() => setCatType('expense')} />
                {homeSettings.budget_shared_account === 'yes' && (
                  <Chip label={t.budgetCategoryTypeIncome} active={catType === 'income'} onClick={() => setCatType('income')} />
                )}
              </div>
            </div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryBudget}</label>
              <input type="text" inputMode="decimal" value={catLimit} onChange={e => setCatLimit(e.target.value.replace('.', ','))}
                placeholder="0"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px var(--spacing-base)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '15px' }}
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 6 }}>{t.budgetCategoryPeriod}</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                {(['monthly','weekly','yearly'] as const).map(p => (
                  <Chip key={p} label={periodLabel(p)} active={catPeriod === p} onClick={() => setCatPeriod(p)} />
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryAiHint}</label>
              <input type="text" value={catDesc} onChange={e => setCatDesc(e.target.value)}
                placeholder={t.budgetCategoryAiHintPlaceholder}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px var(--spacing-base)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              {catModal !== 'new' && (
                <button onClick={() => setConfirmDeleteCatId(catModal.id)}
                  style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                  {t.delete}
                </button>
              )}
              <button onClick={() => setCatModal(null)}
                style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--color-muted)' }}>
                {t.cancel}
              </button>
              <button onClick={saveCategory} disabled={saving || !catName.trim()}
                style={{ flex: 1, padding: '12px 20px', borderRadius: 'var(--rounded-md)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: saving || !catName.trim() ? 0.5 : 1 }}>
                {saving ? '…' : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal modal */}
      {goalModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setGoalModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
            padding: 'var(--spacing-lg)', width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto',
          }}>
            <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>
              {goalModal === 'new' ? t.budgetSavingsGoalNew : t.budgetSavingsGoals}
            </h2>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetSavingsGoalName}</label>
              <input type="text" value={goalName} onChange={e => setGoalName(e.target.value)} className="form-input" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{ flex: 1 }}>
                <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryIcon}</label>
                <input type="text" value={goalIcon} onChange={e => setGoalIcon(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--color-fg)', fontSize: '22px', textAlign: 'center' }} />
              </div>
              <div style={{ flex: 2 }}>
                <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetCategoryColor}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setGoalColor(c)}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: goalColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetSavingsGoalTarget}</label>
              <input type="text" inputMode="decimal" value={goalTarget} onChange={e => setGoalTarget(e.target.value.replace('.', ','))} className="form-input" placeholder="1200" />
            </div>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label className="text-body-sm text-muted" style={{ display: 'block', marginBottom: 4 }}>{t.budgetSavingsGoalCurrent}</label>
              <input type="text" inputMode="decimal" value={goalCurrent} onChange={e => setGoalCurrent(e.target.value.replace('.', ','))} className="form-input" placeholder="0" />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              {goalModal !== 'new' && (
                <button onClick={() => setConfirmDeleteGoalId(goalModal.id)}
                  style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                  {t.delete}
                </button>
              )}
              <button onClick={() => setGoalModal(null)}
                style={{ padding: '12px 20px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--color-muted)' }}>
                {t.cancel}
              </button>
              <button onClick={saveGoal} disabled={saving || !goalName.trim() || !goalTarget}
                style={{ flex: 1, padding: '12px 20px', borderRadius: 'var(--rounded-md)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: saving || !goalName.trim() || !goalTarget ? 0.5 : 1 }}>
                {saving ? '…' : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete category */}
      {confirmDeleteCatId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 'var(--spacing-md)' }}>
          <div style={{ background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg)', padding: 'var(--spacing-lg)', maxWidth: 320, width: '100%' }}>
            <p className="text-body-md" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>{t.budgetConfirmDeleteCat}</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button onClick={() => setConfirmDeleteCatId(null)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>{t.cancel}</button>
              <button onClick={() => deleteCategory(confirmDeleteCatId)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600 }}>{t.delete}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete goal */}
      {confirmDeleteGoalId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 'var(--spacing-md)' }}>
          <div style={{ background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg)', padding: 'var(--spacing-lg)', maxWidth: 320, width: '100%' }}>
            <p className="text-body-md" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>{t.budgetConfirmDelete}</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button onClick={() => setConfirmDeleteGoalId(null)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>{t.cancel}</button>
              <button onClick={() => deleteGoal(confirmDeleteGoalId)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--rounded-md)', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600 }}>{t.delete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EntriesView ──────────────────────────────────────────────────────────────

function EntriesView({ entries, members, language, onEdit, onBack }: {
  entries: BudgetEntry[]; members: Member[];
  language: Lang; onEdit: (e: BudgetEntry) => void; onBack: () => void;
}) {
  const t = getT(language);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '20px', padding: 0 }}>←</button>
        <h2 className="text-title-md">{t.budgetEntries}</h2>
      </div>
      {entries.length === 0 ? (
        <p className="text-body-sm text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>{t.budgetNoEntries}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {entries.map(entry => {
            const cat = entry.budget_categories;
            const member = members.find(m => m.user_id === entry.user_id);
            const d = new Date(entry.date + 'T12:00:00');
            const dateStr = `${d.getDate()}. ${t.monthNames[d.getMonth()].slice(0, 3)}`;
            const isIncome = entry.entry_type === 'income';
            return (
              <button key={entry.id} onClick={() => onEdit(entry)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                  padding: '12px var(--spacing-base)', background: 'var(--color-canvas)',
                  border: 'none', borderRadius: 'var(--rounded-md)', cursor: 'pointer', width: '100%', textAlign: 'left',
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--rounded-sm)',
                  background: cat ? cat.color + '33' : 'var(--color-surface-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                }}>
                  {isIncome ? '📥' : (cat?.icon ?? '💰')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-body-md" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.description || (cat?.name ?? t.budgetNoCategory)}
                  </div>
                  <div className="text-body-sm text-muted">
                    {dateStr} · {entry.split_mode === 'shared' ? t.budgetShared : t.budgetPersonal}
                  </div>
                </div>
                {member && <div style={{ width: 20, height: 20, borderRadius: '50%', background: member.avatar_color, flexShrink: 0 }} />}
                <div className="text-body-md" style={{ fontWeight: 700, minWidth: 60, textAlign: 'right', flexShrink: 0, color: isIncome ? '#10b981' : 'var(--color-fg)' }}>
                  {isIncome ? '+' : ''}{formatAmt(Number(entry.amount))} €
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Budget component ────────────────────────────────────────────────────

export function Budget({ homeId, language, userId, userRole }: {
  homeId: string; language: Lang; userId: string; userRole?: 'admin' | 'member';
}) {
  const t = getT(language);
  const now = new Date();
  const [view, setView] = useState<'dashboard' | 'entries' | 'settings'>('dashboard');
  const [currentMonth, setCurrentMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [recurringChanges, setRecurringChanges] = useState<RecurringChange[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [homeSettings, setHomeSettings] = useState<HomeSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Entry form modal state
  const [entryModal, setEntryModal] = useState<{ open: boolean; type: 'expense' | 'income'; editing: BudgetEntry | null }>({
    open: false, type: 'expense', editing: null,
  });

  // AI scan modal state
  const [aiScanOpen, setAiScanOpen] = useState(false);
  const [aiPrefilled, setAiPrefilled] = useState<{ amount: string; description: string; categoryId: string | null } | null>(null);

  // FAB state
  const [fabOpen, setFabOpen] = useState(false);
  const [fabExpenseOpen, setFabExpenseOpen] = useState(false);

  // Recurring item modal state
  const [recurringToEdit, setRecurringToEdit] = useState<RecurringItem | 'new' | null>(null);

  useEffect(() => { fetchAll(); }, [homeId, currentMonth]);

  async function fetchAll() {
    setLoading(true);
    const { year, month } = currentMonth;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endYear = month === 11 ? year + 1 : year;
    const endMonth = month === 11 ? 1 : month + 2;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const [catsRes, entriesRes, goalsRes, recurringRes, membersRes, settingsRes] = await Promise.all([
      supabase.from('budget_categories').select('*').eq('home_id', homeId).order('sort_order'),
      supabase.from('budget_entries')
        .select('*, budget_categories(name,icon,color)')
        .eq('home_id', homeId).gte('date', startDate).lt('date', endDate)
        .order('date', { ascending: false }),
      supabase.from('budget_savings_goals').select('*').eq('home_id', homeId).order('sort_order'),
      supabase.from('budget_recurring_items').select('*').eq('home_id', homeId).order('sort_order'),
      supabase.from('home_members').select('user_id, profiles(display_name, avatar_color)').eq('home_id', homeId),
      supabase.from('home_settings').select('key, value').eq('home_id', homeId)
        .in('key', ['budget_setup_done','budget_shared_account','budget_split_mode','budget_default_period','budget_ai_receipts']),
    ]);

    setCategories(catsRes.data ?? []);
    setSavingsGoals(goalsRes.data ?? []);
    const fetchedRecurring = recurringRes.data ?? [];
    setRecurringItems(fetchedRecurring);

    // Fetch changes for all recurring items
    const recurringIds = fetchedRecurring.map((r: RecurringItem) => r.id);
    if (recurringIds.length > 0) {
      const { data: changesData } = await supabase
        .from('budget_recurring_changes')
        .select('*')
        .in('recurring_item_id', recurringIds)
        .order('effective_date');
      setRecurringChanges(changesData ?? []);
    } else {
      setRecurringChanges([]);
    }

    // Auto-book recurring items marked as auto_book — only for the current real month
    const realNow = new Date();
    const isCurrentMonth = year === realNow.getFullYear() && month === realNow.getMonth();
    let finalEntries = entriesRes.data ?? [];
    if (isCurrentMonth) {
      const rawSettings = settingsRes.data ?? [];
      const splitModeSetting = rawSettings.find(r => r.key === 'budget_split_mode')?.value ?? 'none';
      const allChanges: RecurringChange[] = recurringIds.length > 0
        ? ((await supabase.from('budget_recurring_changes').select('*').in('recurring_item_id', recurringIds)).data ?? [])
        : [];
      const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const paidIds = new Set(finalEntries.filter(e => e.recurring_item_id).map((e: any) => e.recurring_item_id as string));
      const autoItems = (recurringRes.data ?? []).filter((r: RecurringItem) => {
        if (!r.active || !r.auto_book || paidIds.has(r.id)) return false;
        return !effectiveRecurring(r, allChanges, monthStart).cancelled;
      });
      if (autoItems.length > 0) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        await Promise.all(autoItems.map((item: RecurringItem) => {
          const day = Math.min(item.billing_day, daysInMonth);
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const eff = effectiveRecurring(item, allChanges, monthStart);
          return supabase.from('budget_entries').insert({
            home_id: homeId, user_id: userId,
            amount: eff.amount, category_id: item.category_id,
            description: item.name, date,
            split_mode: splitModeSetting === 'none' ? 'personal' : 'shared',
            entry_type: 'expense', recurring_item_id: item.id,
          });
        }));
        const refetch = await supabase.from('budget_entries')
          .select('*, budget_categories(name,icon,color)')
          .eq('home_id', homeId).gte('date', startDate).lt('date', endDate)
          .order('date', { ascending: false });
        finalEntries = refetch.data ?? [];
      }
    }
    setEntries(finalEntries);
    setMembers(
      (membersRes.data ?? []).map((m: any) => ({
        user_id: m.user_id,
        display_name: m.profiles?.display_name ?? null,
        avatar_color: m.profiles?.avatar_color ?? '#14d8db',
      }))
    );

    const raw = settingsRes.data ?? [];
    const get = (k: string) => raw.find(r => r.key === k)?.value ?? null;
    setHomeSettings({
      budget_setup_done: get('budget_setup_done') === 'true',
      budget_shared_account: (get('budget_shared_account') as 'yes' | 'no') ?? 'no',
      budget_split_mode: (get('budget_split_mode') as 'even' | 'individual' | 'none') ?? 'none',
      budget_default_period: (get('budget_default_period') as 'monthly' | 'weekly' | 'yearly') ?? 'monthly',
      budget_ai_receipts: (get('budget_ai_receipts') as 'yes' | 'no') ?? 'no',
    });

    setLoading(false);
  }

  function openAddExpense() {
    setAiPrefilled(null);
    setEntryModal({ open: true, type: 'expense', editing: null });
  }

  function openAddExpenseAI() {
    setAiScanOpen(true);
  }

  function openAddIncome() {
    setEntryModal({ open: true, type: 'income', editing: null });
  }

  function openEditEntry(entry: BudgetEntry) {
    setEntryModal({ open: true, type: entry.entry_type, editing: entry });
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}><p className="text-body-sm text-muted">{t.loading}</p></div>;
  }

  // Setup pending for members
  if (homeSettings && !homeSettings.budget_setup_done) {
    if (userRole !== 'admin') {
      return (
        <div style={{ paddingBottom: '120px' }}>
          <h1 className="text-display-lg" style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>{t.budgetTitle}</h1>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <div style={{ fontSize: '40px', marginBottom: 'var(--spacing-md)' }}>⚙️</div>
            <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>{t.budgetSetupPending}</h2>
            <p className="text-body-sm text-muted">{t.budgetSetupPendingDesc}</p>
          </div>
        </div>
      );
    }
    // Admin sees wizard
    return (
      <div style={{ paddingBottom: '120px' }}>
        <BudgetWizard homeId={homeId} language={language} onDone={() => fetchAll()} />
      </div>
    );
  }

  const effectiveSettings = homeSettings ?? {
    budget_setup_done: false, budget_shared_account: 'no' as const,
    budget_split_mode: 'none' as const, budget_default_period: 'monthly' as const,
    budget_ai_receipts: 'no' as const,
  };

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
        <h1 className="text-display-lg">{t.budgetTitle}</h1>
        {view !== 'settings' && homeSettings?.budget_setup_done && (
          <button
            onClick={() => setView('settings')}
            aria-label={t.budgetSettings}
            style={{ background: 'var(--color-surface-strong)', border: 'none', borderRadius: 'var(--rounded-full)', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-muted)', flexShrink: 0 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        )}
      </div>

      {view === 'dashboard' && (
        <BudgetDashboard
          homeId={homeId} userId={userId}
          language={language}
          categories={categories} entries={entries}
          savingsGoals={savingsGoals} recurringItems={recurringItems}
          recurringChanges={recurringChanges}
          homeSettings={effectiveSettings}
          currentMonth={currentMonth}
          onPrevMonth={() => setCurrentMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}
          onNextMonth={() => setCurrentMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}
          onGoToEntries={() => setView('entries')}
          onRefresh={fetchAll}
          onNewRecurring={() => setRecurringToEdit('new')}
          onEditRecurring={(item) => setRecurringToEdit(item)}
        />
      )}

      {view === 'entries' && (
        <EntriesView
          entries={entries} members={members}
          language={language} onEdit={openEditEntry} onBack={() => setView('dashboard')}
        />
      )}

      {view === 'settings' && (
        <BudgetSettingsView
          homeId={homeId} language={language}
          categories={categories} savingsGoals={savingsGoals}
          recurringItems={recurringItems} homeSettings={effectiveSettings}
          userRole={userRole}
          onBack={() => setView('dashboard')} onRefresh={fetchAll}
          onOpenRecurring={(item) => setRecurringToEdit(item)}
        />
      )}

      {/* FAB */}
      {(fabOpen || fabExpenseOpen) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => { setFabOpen(false); setFabExpenseOpen(false); }} />
      )}
      {fabExpenseOpen && (
        <div style={{ position: 'fixed', bottom: 148, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {effectiveSettings.budget_ai_receipts === 'yes' && (
            <button onClick={() => { setFabOpen(false); setFabExpenseOpen(false); openAddExpenseAI(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 24, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>🤖 {t.budgetAiScan}</button>
          )}
          <button onClick={() => { setFabOpen(false); setFabExpenseOpen(false); openAddExpense(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 24, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>✏️ {t.budgetManualEntry}</button>
        </div>
      )}
      {fabOpen && !fabExpenseOpen && (
        <div style={{ position: 'fixed', bottom: 148, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button onClick={() => { setFabExpenseOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 24, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{t.budgetAddExpense} ›</button>
          {effectiveSettings.budget_shared_account === 'yes' && (
            <button onClick={() => { setFabOpen(false); openAddIncome(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 24, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#10b981', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{t.budgetAddIncome}</button>
          )}
        </div>
      )}
      <button
        onClick={() => { setFabOpen(v => !v); setFabExpenseOpen(false); }}
        style={{
          position: 'fixed', bottom: 84, right: 16, zIndex: 300,
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          cursor: 'pointer', fontSize: '28px', fontWeight: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(20,216,219,0.45)',
          transform: fabOpen || fabExpenseOpen ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.2s',
        }}
      >+</button>

      {/* Recurring item modal */}
      {recurringToEdit !== null && (
        <RecurringItemModal
          homeId={homeId} language={language}
          categories={categories} recurringItems={recurringItems}
          item={recurringToEdit}
          onClose={() => setRecurringToEdit(null)}
          onSave={() => { setRecurringToEdit(null); fetchAll(); }}
        />
      )}

      {/* AI scan modal */}
      {aiScanOpen && (
        <AiScanModal
          language={language}
          categories={categories}
          onAnalysed={(pf) => {
            setAiScanOpen(false);
            setAiPrefilled(pf);
            setEntryModal({ open: true, type: 'expense', editing: null });
          }}
          onFallback={() => {
            setAiScanOpen(false);
            setAiPrefilled(null);
            setEntryModal({ open: true, type: 'expense', editing: null });
          }}
          onCancel={() => setAiScanOpen(false)}
        />
      )}

      {/* Entry form modal */}
      {entryModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => { setEntryModal(p => ({ ...p, open: false })); setAiPrefilled(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560 }}>
            <EntryForm
              homeId={homeId} language={language} userId={userId}
              categories={categories} members={members} homeSettings={effectiveSettings}
              entryType={entryModal.type}
              editingEntry={entryModal.editing}
              prefilled={aiPrefilled ?? undefined}
              onSave={() => { setEntryModal(p => ({ ...p, open: false })); setAiPrefilled(null); fetchAll(); }}
              onCancel={() => { setEntryModal(p => ({ ...p, open: false })); setAiPrefilled(null); }}
              onDelete={() => { setEntryModal(p => ({ ...p, open: false })); setAiPrefilled(null); fetchAll(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BudgetQuickExpenseModal ──────────────────────────────────────────────────
// Self-contained modal for recording a budget expense from outside the Budget
// module (e.g., from the Shopping List). Fetches its own categories/members/settings.

export function BudgetQuickExpenseModal({
  homeId, language, userId, onClose,
}: { homeId: string; language: Lang; userId: string; onClose: () => void }) {
  const t = getT(language);
  const [step, setStep] = useState<'loading' | 'menu' | 'ai' | 'form'>('loading');
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [homeSettings, setHomeSettings] = useState<HomeSettings | null>(null);
  const [aiPrefilled, setAiPrefilled] = useState<{ amount: string; description: string; categoryId: string | null } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('budget_categories').select('*').eq('home_id', homeId).order('sort_order'),
      supabase.from('home_members').select('user_id, profiles(display_name, avatar_color)').eq('home_id', homeId),
      supabase.from('home_settings').select('key, value').eq('home_id', homeId)
        .in('key', ['budget_shared_account', 'budget_split_mode', 'budget_default_period', 'budget_ai_receipts']),
    ]).then(([catsRes, membersRes, settingsRes]) => {
      setCategories(catsRes.data ?? []);
      setMembers(
        (membersRes.data ?? []).map((m: any) => ({
          user_id: m.user_id,
          display_name: m.profiles?.display_name ?? null,
          avatar_color: m.profiles?.avatar_color ?? '#14d8db',
        }))
      );
      const raw = settingsRes.data ?? [];
      const get = (k: string) => raw.find((r: any) => r.key === k)?.value ?? null;
      setHomeSettings({
        budget_setup_done: true,
        budget_shared_account: (get('budget_shared_account') as 'yes' | 'no') ?? 'no',
        budget_split_mode: (get('budget_split_mode') as 'even' | 'individual' | 'none') ?? 'none',
        budget_default_period: (get('budget_default_period') as 'monthly' | 'weekly' | 'yearly') ?? 'monthly',
        budget_ai_receipts: (get('budget_ai_receipts') as 'yes' | 'no') ?? 'no',
      });
      setStep('menu');
    });
  }, [homeId]);

  if (step === 'loading') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
        <p className="text-body-sm text-muted" style={{ color: 'white' }}>{t.loading}</p>
      </div>
    );
  }

  if (step === 'ai') {
    return (
      <AiScanModal
        language={language}
        categories={categories}
        onAnalysed={(pf) => { setAiPrefilled(pf); setStep('form'); }}
        onFallback={() => { setAiPrefilled(null); setStep('form'); }}
        onCancel={onClose}
      />
    );
  }

  if (step === 'form' && homeSettings) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
        onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560 }}>
          <EntryForm
            homeId={homeId} language={language} userId={userId}
            categories={categories} members={members} homeSettings={homeSettings}
            entryType="expense"
            prefilled={aiPrefilled ?? undefined}
            onSave={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    );
  }

  // menu step
  const aiEnabled = homeSettings?.budget_ai_receipts === 'yes';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-canvas)', borderRadius: 'var(--rounded-lg) var(--rounded-lg) 0 0',
        padding: 'var(--spacing-lg)', width: '100%', maxWidth: 560,
      }}>
        <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-md)' }}>{t.budgetAddExpense}</h2>
        {aiEnabled && (
          <button
            onClick={() => setStep('ai')}
            style={{
              width: '100%', padding: '14px var(--spacing-base)', textAlign: 'left',
              background: 'none', border: 'none', borderBottom: '1px solid var(--color-hairline-soft)',
              cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-fg)', fontFamily: 'inherit',
              borderRadius: 0,
            }}
          >🤖 {t.budgetAiScan}</button>
        )}
        <button
          onClick={() => setStep('form')}
          style={{
            width: '100%', padding: '14px var(--spacing-base)', textAlign: 'left',
            background: 'none', border: 'none', borderBottom: '1px solid var(--color-hairline-soft)',
            cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--color-fg)', fontFamily: 'inherit',
            borderRadius: 0,
          }}
        >✏️ {t.budgetManualEntry}</button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px var(--spacing-base)', textAlign: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: 500, color: 'var(--color-muted)', fontFamily: 'inherit',
            borderRadius: 0,
          }}
        >{t.cancel}</button>
      </div>
    </div>
  );
}
