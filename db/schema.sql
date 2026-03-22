-- Pickleball rally analysis MVP schema (PostgreSQL/Supabase)
create extension if not exists pgcrypto;

create type match_type as enum ('singles', 'doubles');
create type point_result as enum ('won', 'lost');
create type finish_type as enum ('my_winner', 'opp_winner', 'my_error', 'opp_error', 'other');
create type side_type as enum ('me', 'opponent');
create type server_side_type as enum ('me', 'opponent', 'unknown');
create type zone_id as enum ('Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'Z9');

create table users (
  id uuid primary key,
  display_name text,
  created_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  opponent_name text,
  match_date date not null,
  match_type match_type not null,
  my_team_name text,
  opponent_team_name text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table points (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  point_number integer not null check (point_number > 0),
  my_score_after integer check (my_score_after is null or my_score_after >= 0),
  opponent_score_after integer check (opponent_score_after is null or opponent_score_after >= 0),
  point_result point_result not null,
  finish_type finish_type not null,
  server_side server_side_type,
  receiver_side server_side_type,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, point_number)
);

create table point_shots (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references points(id) on delete cascade,
  reverse_order integer not null check (reverse_order between 1 and 5),
  hitter_side side_type not null,
  target_zone_id zone_id not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (point_id, reverse_order)
);

create index idx_points_match_result on points(match_id, point_result);
create index idx_point_shots_point_reverse on point_shots(point_id, reverse_order);
create index idx_point_shots_zone on point_shots(target_zone_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_matches_updated_at
before update on matches
for each row execute function set_updated_at();

create trigger trg_points_updated_at
before update on points
for each row execute function set_updated_at();

create trigger trg_point_shots_updated_at
before update on point_shots
for each row execute function set_updated_at();
