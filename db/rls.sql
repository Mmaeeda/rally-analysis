-- Supabase Auth + RLS setup for browser-side sync.
-- Run this after db/schema.sql.

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, public.users.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user();

insert into public.users (id, display_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'display_name', email)
from auth.users
on conflict (id) do update
set display_name = coalesce(excluded.display_name, public.users.display_name);

alter table public.users enable row level security;
alter table public.matches enable row level security;
alter table public.points enable row level security;
alter table public.point_shots enable row level security;

alter table public.users force row level security;
alter table public.matches force row level security;
alter table public.points force row level security;
alter table public.point_shots force row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists users_insert_own on public.users;
create policy users_insert_own
on public.users
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists users_delete_own on public.users;
create policy users_delete_own
on public.users
for delete
to authenticated
using (id = auth.uid());

drop policy if exists matches_select_own on public.matches;
create policy matches_select_own
on public.matches
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists matches_insert_own on public.matches;
create policy matches_insert_own
on public.matches
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists matches_update_own on public.matches;
create policy matches_update_own
on public.matches
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists matches_delete_own on public.matches;
create policy matches_delete_own
on public.matches
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists points_select_own on public.points;
create policy points_select_own
on public.points
for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists points_insert_own on public.points;
create policy points_insert_own
on public.points
for insert
to authenticated
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists points_update_own on public.points;
create policy points_update_own
on public.points
for update
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists points_delete_own on public.points;
create policy points_delete_own
on public.points
for delete
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists point_shots_select_own on public.point_shots;
create policy point_shots_select_own
on public.point_shots
for select
to authenticated
using (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists point_shots_insert_own on public.point_shots;
create policy point_shots_insert_own
on public.point_shots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists point_shots_update_own on public.point_shots;
create policy point_shots_update_own
on public.point_shots
for update
to authenticated
using (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists point_shots_delete_own on public.point_shots;
create policy point_shots_delete_own
on public.point_shots
for delete
to authenticated
using (
  exists (
    select 1
    from public.points p
    join public.matches m on m.id = p.match_id
    where p.id = point_id
      and m.user_id = auth.uid()
  )
);
