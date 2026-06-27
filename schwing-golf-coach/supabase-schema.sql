create table if not exists schwing_players (
  player_code text primary key,
  display_name text not null default '',
  profile jsonb not null default '{}'::jsonb,
  clubs jsonb not null default '[]'::jsonb,
  memories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table schwing_players enable row level security;

create or replace function set_schwing_players_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists schwing_players_updated_at on schwing_players;

create trigger schwing_players_updated_at
before update on schwing_players
for each row
execute function set_schwing_players_updated_at();
