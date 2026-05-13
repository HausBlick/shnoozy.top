-- Migration: 012_shopping_categories.sql
-- Creates dynamic per-home shopping categories and subcategories.
-- Adds language preference column to profiles.

-- ── shopping_categories ─────────────────────────────────────────────────────
CREATE TABLE shopping_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id     uuid        NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  icon        text        NOT NULL DEFAULT '📦',
  color       text        NOT NULL DEFAULT '#757575',
  description text        NOT NULL DEFAULT '',
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(home_id, name)
);

ALTER TABLE shopping_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_members_all" ON shopping_categories
  USING  (is_home_member(home_id))
  WITH CHECK (is_home_member(home_id));

-- ── shopping_subcategories ───────────────────────────────────────────────────
CREATE TABLE shopping_subcategories (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid  NOT NULL REFERENCES shopping_categories(id) ON DELETE CASCADE,
  name        text  NOT NULL,
  sort_order  int   NOT NULL DEFAULT 0,
  UNIQUE(category_id, name)
);

ALTER TABLE shopping_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_members_all" ON shopping_subcategories
  USING (
    EXISTS (
      SELECT 1 FROM shopping_categories sc
      WHERE sc.id = category_id AND is_home_member(sc.home_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_categories sc
      WHERE sc.id = category_id AND is_home_member(sc.home_id)
    )
  );

-- ── profiles.language ───────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'de'));

-- ── Default categories for existing home ────────────────────────────────────
-- Sort order follows supermarket-aisle logic (same as previous hardcoded order).
-- "Luna" is intentionally included here as a custom category for this specific
-- home. New homes will NOT receive a Luna category by default.
INSERT INTO shopping_categories (home_id, name, icon, color, description, sort_order) VALUES
  ('89cd774f-b26e-40ce-9362-7589ded42c8d', 'Fruits & Veggies', '🥦', '#7cb342',
   'Fresh fruits and vegetables — apples, bananas, tomatoes, salad, herbs', 1),
  ('89cd774f-b26e-40ce-9362-7589ded42c8d', 'Luna', '🐕', '#14d8db',
   'Alles für Hunde: Futter, Leckerlis, Spielzeug, Pflegeprodukte, Tierarztbedarf', 2),
  ('89cd774f-b26e-40ce-9362-7589ded42c8d', 'Drogerie', '💊', '#8e24aa',
   'Körperpflege, Shampoo, Zahnpasta, Medikamente, Kosmetik, Windeln', 3),
  ('89cd774f-b26e-40ce-9362-7589ded42c8d', 'Cleaning', '🧹', '#039be5',
   'Reinigungsmittel, Putzmittel, Müllbeutel, Schwämme, Waschmittel', 4),
  ('89cd774f-b26e-40ce-9362-7589ded42c8d', 'Groceries', '🛒', '#43a047',
   'Lebensmittel, Obst, Gemüse, Getränke, Backwaren, Tiefkühlkost, Milchprodukte', 5),
  ('89cd774f-b26e-40ce-9362-7589ded42c8d', 'Misc', '📦', '#757575',
   'Alles, was in keine andere Kategorie passt', 6);

-- ── Subcategories for Groceries (existing home) ─────────────────────────────
INSERT INTO shopping_subcategories (category_id, name, sort_order)
SELECT sc.id, subs.name, subs.ord
FROM shopping_categories sc
CROSS JOIN (VALUES
  ('Spices',      1),
  ('Meat',        2),
  ('Frozen',      3),
  ('Coffee & Tea',4),
  ('Dairy',       5),
  ('Cans & Boxes',6),
  ('Dry Food',    7),
  ('Drinks',      8),
  ('Snacks',      9)
) AS subs(name, ord)
WHERE sc.home_id = '89cd774f-b26e-40ce-9362-7589ded42c8d'
  AND sc.name = 'Groceries';
