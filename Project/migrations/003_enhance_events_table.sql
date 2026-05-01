-- Migration: 003_enhance_events_table.sql
-- Description: Adds recurring support and improves event fields.

-- 1. Add recurrence and refine fields
alter table public.events 
add column if not exists recurrence_type text default 'none', -- 'none', 'yearly', 'weekly', 'monthly'
add column if not exists color text; -- for visual distinction

-- 2. Update RLS (already enabled, but ensuring policies are broad enough for new fields)
-- No changes needed to policies as they are user_id based.

-- 3. Indexing for performance
create index if not exists events_start_time_idx on public.events (start_time);
create index if not exists events_user_id_idx on public.events (user_id);
