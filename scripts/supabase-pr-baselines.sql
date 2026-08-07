-- Shared PR9999 baseline cache for holodream (Supabase free tier).
-- Run once in Supabase SQL editor, then set GitHub repo secrets:
--   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

create table if not exists public.pr_baselines (
  cache_key text primary key,
  costume_id text not null,
  song_length integer not null,
  pool_card_count integer not null,
  leader_index integer not null,
  card_ids jsonb not null,
  effective_stat_total numeric not null,
  coverage numeric not null,
  avg_score_up numeric not null,
  updated_at timestamptz not null default now()
);

create index if not exists pr_baselines_costume_idx
  on public.pr_baselines (costume_id, song_length, pool_card_count);

alter table public.pr_baselines enable row level security;

drop policy if exists "Public read PR baselines" on public.pr_baselines;
create policy "Public read PR baselines"
  on public.pr_baselines for select
  to anon, authenticated
  using (true);

drop policy if exists "Public upsert PR baselines" on public.pr_baselines;
create policy "Public upsert PR baselines"
  on public.pr_baselines for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public update PR baselines" on public.pr_baselines;
create policy "Public update PR baselines"
  on public.pr_baselines for update
  to anon, authenticated
  using (true)
  with check (true);
