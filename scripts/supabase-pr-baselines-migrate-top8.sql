-- One-time migration: add teams column for top-8 shared cache.
-- Safe to run on existing holodream Supabase projects.

alter table public.pr_baselines
  add column if not exists teams jsonb not null default '[]'::jsonb;

-- Backfill single-team rows into teams[] for readers that expect the array
update public.pr_baselines
set teams = jsonb_build_array(
  jsonb_build_object(
    'leader_index', leader_index,
    'card_ids', card_ids,
    'effective_stat_total', effective_stat_total,
    'coverage', coverage,
    'avg_score_up', avg_score_up
  )
)
where jsonb_array_length(teams) = 0
  and card_ids is not null
  and jsonb_array_length(card_ids) = 5;
