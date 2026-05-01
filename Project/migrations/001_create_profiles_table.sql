-- Migration: 001_create_profiles_table.sql
-- Description: Creates the profiles table, enables RLS, and sets up an auto-profile creation trigger.

-- 1. Create the profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone default now(),
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- 2. Enable Row Level Security
alter table public.profiles enable row level security;

-- 3. Set up RLS Policies
-- Allow anyone to view profiles (change to 'auth.uid() = id' if you want private profiles)
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

-- Allow users to insert their own profile
create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

-- Allow users to update their own profile
create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- 4. Create a trigger function to handle new user registration automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- 5. Create the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
