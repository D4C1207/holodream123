-- Guest comment board for holodream (run once in Supabase SQL editor).

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  nickname text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_len check (char_length(body) between 1 and 500),
  constraint comments_nickname_len check (char_length(nickname) <= 24)
);

create index if not exists comments_created_idx
  on public.comments (created_at desc);

alter table public.comments enable row level security;

drop policy if exists "Public read comments" on public.comments;
create policy "Public read comments"
  on public.comments for select
  to anon, authenticated
  using (true);

drop policy if exists "Public post comments" on public.comments;
create policy "Public post comments"
  on public.comments for insert
  to anon, authenticated
  with check (true);
