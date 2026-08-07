-- Remove guest comment board from Supabase (run once in SQL editor).

drop function if exists public.delete_comment_admin(uuid, text);
drop function if exists public.verify_comment_admin_key(text);

drop table if exists public.comments;
drop table if exists public.app_config;
