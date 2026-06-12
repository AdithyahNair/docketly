-- Docketly initial schema
create extension if not exists "uuid-ossp";

create table firms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_email text not null,
  created_at timestamptz not null default now()
);

create table cases (
  id uuid primary key default uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  case_number text not null,
  client_name text not null,
  client_email text not null,
  attorney_email text not null,
  chapter int check (chapter in (7, 13)),
  created_at timestamptz not null default now(),
  unique (firm_id, case_number)
);

create table notices (
  id uuid primary key default uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  case_id uuid references cases(id) on delete set null,
  source text not null check (source in ('upload', 'webhook')),
  pdf_path text,
  raw_text text not null,
  content_hash text not null,
  status text not null default 'classifying'
    check (status in ('classifying', 'classified', 'needs_review', 'failed')),
  classification jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (firm_id, content_hash)
);
create index notices_firm_status_idx on notices (firm_id, status, created_at desc);

create table automations (
  id uuid primary key default uuid_generate_v4(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  match_notice_type text not null,
  match_chapter int check (match_chapter in (7, 13)),
  match_judge text,
  recipients jsonb not null default '[]',
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null default now()
);
create index automations_firm_idx on automations (firm_id, enabled);

create table automation_runs (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references automations(id) on delete cascade,
  notice_id uuid not null references notices(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  resend_email_id text,
  created_at timestamptz not null default now(),
  unique (automation_id, notice_id)
);
create index runs_notice_idx on automation_runs (notice_id);

create table eval_runs (
  id uuid primary key default uuid_generate_v4(),
  model text not null,
  dataset_size int not null,
  accuracy numeric not null,
  per_type jsonb not null,
  confusion jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS: dashboard reads go through the user's firm; service role bypasses for pipeline writes.
alter table firms enable row level security;
alter table cases enable row level security;
alter table notices enable row level security;
alter table automations enable row level security;
alter table automation_runs enable row level security;
alter table eval_runs enable row level security;

create policy "firm members read own firm" on firms for select
  using (id = (auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid);
create policy "firm members all cases" on cases for all
  using (firm_id = (auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid);
create policy "firm members all notices" on notices for all
  using (firm_id = (auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid);
create policy "firm members all automations" on automations for all
  using (firm_id = (auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid);
create policy "firm members read runs" on automation_runs for select
  using (exists (
    select 1 from notices n
    where n.id = automation_runs.notice_id
      and n.firm_id = (auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid
  ));
create policy "authenticated read evals" on eval_runs for select
  using (auth.role() = 'authenticated');
