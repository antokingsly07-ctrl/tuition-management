-- ============================================================================
-- Tuition Management ΓÇö Supabase (PostgreSQL) schema
-- ============================================================================
-- HOW TO USE:
--   1. Create a project at https://supabase.com
--   2. Open the SQL Editor (Dashboard -> SQL Editor -> New query)
--   3. Paste this entire file and click RUN
--   4. Copy the Project URL and anon/public key from
--      Dashboard -> Settings -> API  ->  into js/supabase.js
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extension for auto-generating UUIDs
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- STUDENTS table
-- Fields: UUID primary key, name, phone, email, course (tuition/typewriting),
--         batch, joining_date, fee_amount, status, created_at, updated_at
-- ============================================================================
create table if not exists students (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text,
  email        text,
  course       text default 'tuition',        -- keeps the Tuition / Typewriting section switch working
  batch        text,                          -- e.g. "Morning", "Batch A (10AM)"
  joining_date date,
  fee_amount   numeric default 0,             -- monthly fee in rupees
  status       text default 'active',         -- 'active' | 'inactive'
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Indexes for fast searching/listing of students
create index if not exists idx_students_name   on students (lower(name));
create index if not exists idx_students_course on students (course);
create index if not exists idx_students_status on students (status);
-- Composite index for the most common listing query: students in a course, newest first
create index if not exists idx_students_course_created on students (course, created_at desc);

-- ============================================================================
-- ATTENDANCE table
-- One row per student per day. status is either 'Present' or 'Absent'.
-- student_id -> students.id with ON DELETE CASCADE (deleting a student also
-- removes their attendance). Unique on (student_id, attendance_date) prevents
-- duplicate records on the same day.
-- ============================================================================
create table if not exists attendance (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  attendance_date date not null,
  status          text not null check (status in ('Present', 'Absent')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  constraint uq_attendance_student_date unique (student_id, attendance_date)
);

create index if not exists idx_attendance_date    on attendance (attendance_date);
create index if not exists idx_attendance_student on attendance (student_id);
-- Composite index: the app queries attendance BY DATE for a whole class,
-- so (attendance_date, student_id) serves those lookups directly.
create index if not exists idx_attendance_date_student on attendance (attendance_date, student_id);

-- ============================================================================
-- USERS table (app's own login ΓÇö admin / tuition / typewriting teachers)
-- ============================================================================
create table if not exists users (
  id       uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  name     text not null,
  role     text not null check (role in ('admin', 'teacher')),
  section  text check (section in ('tuition', 'typewriting') or section is null)
);

create index if not exists idx_users_username on users (username);

-- Optional: pre-seed the demo login accounts (skip if you already have them)
insert into users (username, password, name, role, section) values
  ('admin',       'admin123', 'Admin',              'admin',   null),
  ('tuition',     'teach123', 'Tuition Teacher',    'teacher', 'tuition'),
  ('typewriting', 'teach123', 'Typewriting Teacher','teacher', 'typewriting')
on conflict (username) do nothing;

-- ============================================================================
-- PAYMENTS table (fees module ΓÇö kept working, references the student)
-- ============================================================================
create table if not exists payments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  amount     numeric not null default 0,
  month      text not null,       -- "YYYY-MM"
  date       date not null,
  note       text
);

create index if not exists idx_payments_student on payments (student_id);
create index if not exists idx_payments_month   on payments (month);
-- Composite index: fees page lists payments by month or by (student, month)
create index if not exists idx_payments_student_month on payments (student_id, month);

-- ============================================================================
-- updated_at trigger (keeps timestamps current on UPDATE)
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_students_updated   on students;
drop trigger if exists trg_attendance_updated on attendance;

create trigger trg_students_updated
  before update on students
  for each row execute function set_updated_at();

create trigger trg_attendance_updated
  before update on attendance
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- NOTE: this app uses its own users-table login (NOT Supabase Auth), so the
-- browser calls Supabase with the public "anon" key. The policies below grant
-- the anon role full CRUD so the app keeps working. The anon key is public by
-- design; anyone with it could read/write these tables. That is acceptable for
-- a small internal tool but you should move to Supabase Auth for production
-- security. The service_role key is NEVER used in the frontend.
-- ============================================================================
alter table students   enable row level security;
alter table attendance enable row level security;
alter table payments   enable row level security;
alter table users      enable row level security;

-- students: grant anon full CRUD
drop policy if exists "anon students select" on students;
drop policy if exists "anon students insert" on students;
drop policy if exists "anon students update" on students;
drop policy if exists "anon students delete" on students;

create policy "anon students select" on students for select to anon using (true);
create policy "anon students insert" on students for insert to anon with check (true);
create policy "anon students update" on students for update to anon using (true) with check (true);
create policy "anon students delete" on students for delete to anon using (true);

-- attendance: grant anon full CRUD
drop policy if exists "anon attendance select" on attendance;
drop policy if exists "anon attendance insert" on attendance;
drop policy if exists "anon attendance update" on attendance;
drop policy if exists "anon attendance delete" on attendance;

create policy "anon attendance select" on attendance for select to anon using (true);
create policy "anon attendance insert" on attendance for insert to anon with check (true);
create policy "anon attendance update" on attendance for update to anon using (true) with check (true);
create policy "anon attendance delete" on attendance for delete to anon using (true);

-- payments: grant anon full CRUD (fees module)
drop policy if exists "anon payments select" on payments;
drop policy if exists "anon payments insert" on payments;
drop policy if exists "anon payments update" on payments;
drop policy if exists "anon payments delete" on payments;

create policy "anon payments select" on payments for select to anon using (true);
create policy "anon payments insert" on payments for insert to anon with check (true);
create policy "anon payments update" on payments for update to anon using (true) with check (true);
create policy "anon payments delete" on payments for delete to anon using (true);

-- users: only needed for the app's own login lookup
drop policy if exists "anon users select" on users;
drop policy if exists "anon users insert" on users;

create policy "anon users select" on users for select to anon using (true);
create policy "anon users insert" on users for insert to anon with check (true);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
