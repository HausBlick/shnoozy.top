-- Migration: 008_create_sticky_notes.sql

CREATE TABLE public.sticky_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator_email text NOT NULL,
  visible_to text NOT NULL DEFAULT 'both' CHECK (visible_to IN ('me', 'partner', 'both')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

-- Own notes always visible; partner/both notes visible to all household members
CREATE POLICY "Read relevant sticky notes"
  ON public.sticky_notes FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR visible_to IN ('partner', 'both'));

CREATE POLICY "Create own sticky notes"
  ON public.sticky_notes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update own sticky notes"
  ON public.sticky_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Delete own sticky notes"
  ON public.sticky_notes FOR DELETE TO authenticated
  USING (created_by = auth.uid());

ALTER publication supabase_realtime ADD TABLE sticky_notes;
