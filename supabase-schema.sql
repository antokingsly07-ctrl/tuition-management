-- ============================================================
-- Tuition Manager — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

create table if not exists users (
  id       text primary key,
  username text unique not null,
  password text not null,
  name     text not null,
  role     text not null check (role in ('admin', 'teacher')),
  section  text
);

create table if not exists students (
  id         text primary key,
  name       text not null,
  phone      text,
  section    text not null check (section in ('tuition', 'typewriting')),
  batch      text,
  "joinDate" date,
  "monthlyFee" numeric not null default 0,
  active     boolean not null default true
);

create table if not exists payments (
  id         text primary key,
  "studentId" text not null references students(id) on delete cascade,
  amount     numeric not null,
  month      text not null,
  date       date not null,
  note       text
);

create table if not exists attendance (
  id      text primary key,
  date    date not null,
  section text not null,
  records jsonb not null default '{}',
  unique (date, section)
);

-- ------------------------------------------------------------
-- Row Level Security
-- NOTE: this app uses its own users-table login (not Supabase
-- Auth), so the anon key must have full access. The anon key is
-- public by design, but anyone with it could read/write data.
-- Acceptable for a small internal tool; migrate to Supabase Auth
-- for stricter security later.
-- ------------------------------------------------------------
alter table users      enable row level security;
alter table students   enable row level security;
alter table payments   enable row level security;
alter table attendance enable row level security;

create policy "anon all users"      on users      for all using (true) with check (true);
create policy "anon all students"   on students   for all using (true) with check (true);
create policy "anon all payments"   on payments   for all using (true) with check (true);
create policy "anon all attendance" on attendance for all using (true) with check (true);
