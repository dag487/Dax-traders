-- 001_create_users_and_withdrawals.sql

-- Run this migration in Supabase (SQL editor) or via psql against your Postgres DB.

create table if not exists users (
  id uuid primary key,
  username text not null,
  encrypted_token text,
  created_at timestamptz default now()
);

create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  amount numeric not null,
  currency text not null,
  method text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  prompt text not null,
  response text,
  created_at timestamptz default now()
);
