-- Migration: 002_create_events_table.sql
-- Description: Creates the events table for the calendar module with RLS.

-- 1. Create the events table
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  category text default 'event', -- 'event', 'reminder', 'birthday'
  is_all_day boolean default false,
  created_at timestamp with time zone default now()
);

-- 2. Enable Row Level Security
alter table public.events enable row level security;

-- 3. Set up RLS Policies
-- Users can only see their own events
create policy "Users can view their own events." on public.events
  for select using (auth.uid() = user_id);

-- Users can insert their own events
create policy "Users can insert their own events." on public.events
  for insert with check (auth.uid() = user_id);

-- Users can update their own events
create policy "Users can update their own events." on public.events
  for update using (auth.uid() = user_id);

-- Users can delete their own events
create policy "Users can delete their own events." on public.events
  for delete using (auth.uid() = user_id);
