-- Supabase RLS setup for browser-side sync without full auth.
-- Run this after db/schema.sql.

create or replace function public.request_sync_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-sync-user-id', '')::uuid
$$;

create or replace function public.request_sync_secret_hash()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-sync-secret-hash', '')
$$;

alter table public.users
  add column if not exists sync_secret_hash text;

create or replace function public.is_sync_identity(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = target_user_id
      and u.id = public.request_sync_user_id()
      and u.sync_secret_hash = public.request_sync_secret_hash()
  )
$$;

grant execute on function public.request_sync_user_id() to anon, authenticated;
grant execute on function public.request_sync_secret_hash() to anon, authenticated;
grant execute on function public.is_sync_identity(uuid) to anon, authenticated;

alter table public.users enable row level security;
alter table public.matches enable row level security;
alter table public.points enable row level security;
alter table public.point_shots enable row level security;

alter table public.users force row level security;
alter table public.matches force row level security;
alter table public.points force row level security;
alter table public.point_shots force row level security;

drop policy if exists users_select_sync on public.users;
create policy users_select_sync
on public.users
for select
to anon, authenticated
using (
  id = public.request_sync_user_id()
  and sync_secret_hash = public.request_sync_secret_hash()
);

drop policy if exists users_insert_sync on public.users;
create policy users_insert_sync
on public.users
for insert
to anon, authenticated
with check (
  id = public.request_sync_user_id()
  and sync_secret_hash = public.request_sync_secret_hash()
);

drop policy if exists users_update_sync on public.users;
create policy users_update_sync
on public.users
for update
to anon, authenticated
using (
  id = public.request_sync_user_id()
  and (
    sync_secret_hash = public.request_sync_secret_hash()
    or sync_secret_hash is null
  )
)
with check (
  id = public.request_sync_user_id()
  and sync_secret_hash = public.request_sync_secret_hash()
);

drop policy if exists users_delete_sync on public.users;
create policy users_delete_sync
on public.users
for delete
to anon, authenticated
using (
  id = public.request_sync_user_id()
  and sync_secret_hash = public.request_sync_secret_hash()
);

drop policy if exists matches_select_sync on public.matches;
create policy matches_select_sync
on public.matches
for select
to anon, authenticated
using (public.is_sync_identity(user_id));

drop policy if exists matches_insert_sync on public.matches;
create policy matches_insert_sync
on public.matches
for insert
to anon, authenticated
with check (public.is_sync_identity(user_id));

drop policy if exists matches_update_sync on public.matches;
create policy matches_update_sync
on public.matches
for update
to anon, authenticated
using (public.is_sync_identity(user_id))
with check (public.is_sync_identity(user_id));

drop policy if exists matches_delete_sync on public.matches;
create policy matches_delete_sync
on public.matches
for delete
to anon, authenticated
using (public.is_sync_identity(user_id));

drop policy if exists points_select_sync on public.points;
create policy points_select_sync
on public.points
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_sync_identity(m.user_id)
  )
);

drop policy if exists points_insert_sync on public.points;
create policy points_insert_sync
on public.points
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_sync_identity(m.user_id)
  )
);

drop policy if exists points_update_sync on public.points;
create policy points_update_sync
on public.points
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_sync_identity(m.user_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_sync_identity(m.user_id)
  )
);

drop policy if exists points_delete_sync on public.points;
create policy points_delete_sync
on public.points
for delete
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and public.is_sync_identity(m.user_id)
  )
);

drop policy if exists point_shots_select_sync on public.point_shots;
create policy point_shots_select_sync
on public.point_shots
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and public.is_sync_identity(m.user_id)
  )
);

drop policy if exists point_shots_insert_sync on public.point_shots;
create policy point_shots_insert_sync
on public.point_shots
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and public.is_sync_identity(m.user_id)
  )
);

drop policy if exists point_shots_update_sync on public.point_shots;
create policy point_shots_update_sync
on public.point_shots
for update
to anon, authenticated
using (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and public.is_sync_identity(m.user_id)
  )
)
with check (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and public.is_sync_identity(m.user_id)
  )
);

drop policy if exists point_shots_delete_sync on public.point_shots;
create policy point_shots_delete_sync
on public.point_shots
for delete
to anon, authenticated
using (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and public.is_sync_identity(m.user_id)
  )
);
