-- Migration: 007_create_shopping_items.sql
-- Shared shopping list for the household. No user scoping — both users see all items.

CREATE TABLE public.shopping_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Misc',
  is_checked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read and manage all items (shared household)
CREATE POLICY "Authenticated users can manage shopping items"
  ON public.shopping_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
