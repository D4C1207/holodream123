-- One-time migration: admin-only comment delete for existing holodream projects.
-- Run after supabase-comments.sql (comments table already exists).

create table if not exists public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;

create or replace function public.verify_comment_admin_key(p_admin_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_admin_key is null or btrim(p_admin_key) = '' then
    return false;
  end if;
  return exists (
    select 1 from app_config
    where key = 'comment_admin_key' and value = p_admin_key
  );
end;
$$;

create or replace function public.delete_comment_admin(p_comment_id uuid, p_admin_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_comment_admin_key(p_admin_key) then
    return false;
  end if;
  delete from public.comments where id = p_comment_id;
  return found;
end;
$$;

revoke all on function public.verify_comment_admin_key(text) from public;
revoke all on function public.delete_comment_admin(uuid, text) from public;
grant execute on function public.verify_comment_admin_key(text) to anon, authenticated;
grant execute on function public.delete_comment_admin(uuid, text) to anon, authenticated;

-- Set YOUR delete password (only you should know this string):
-- insert into public.app_config (key, value)
-- values ('comment_admin_key', 'pick-a-long-random-secret')
-- on conflict (key) do update set value = excluded.value;
