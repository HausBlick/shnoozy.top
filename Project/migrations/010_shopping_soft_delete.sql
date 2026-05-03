-- Migration: 010_shopping_soft_delete.sql
-- Soft-delete for shopping items so checked-off products build a history
-- that powers autocomplete and category reuse when re-adding items.

ALTER TABLE public.shopping_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Partial index keeps active-item queries fast
CREATE INDEX IF NOT EXISTS idx_shopping_items_active
  ON public.shopping_items(created_at)
  WHERE deleted_at IS NULL;
