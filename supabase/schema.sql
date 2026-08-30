-- A&B op reis — gedeelde paklijst
-- Uitvoeren in Supabase: Project → SQL Editor → New query → plakken → Run.
-- Veilig om opnieuw te draaien (bijvoorbeeld na een foutmelding halverwege) —
-- elke stap hieronder controleert eerst of hij al gedaan is.

create table if not exists public.packing_state (
  id           bigint generated always as identity primary key,
  trip         text not null default 'ab-op-reis',
  item_key     text not null,
  scope        text not null check (scope in ('gedeeld', 'A', 'B')),
  checked      boolean not null default false,
  comment      text,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  unique (trip, item_key, scope)
);

-- zodat een UPDATE/DELETE-event via Realtime de volledige rij meestuurt
alter table public.packing_state replica identity full;

alter table public.packing_state enable row level security;

-- de anon/publishable-sleutel mag alleen rijen van déze reis zien en wijzigen
-- — geen login, dus dit is bewust laagdrempelige beveiliging voor een
-- privélink tussen twee mensen, niet voor iets gevoeligs.
drop policy if exists "select eigen reis" on public.packing_state;
create policy "select eigen reis" on public.packing_state
  for select using (trip = 'ab-op-reis');

drop policy if exists "insert eigen reis" on public.packing_state;
create policy "insert eigen reis" on public.packing_state
  for insert with check (trip = 'ab-op-reis');

drop policy if exists "update eigen reis" on public.packing_state;
create policy "update eigen reis" on public.packing_state
  for update using (trip = 'ab-op-reis') with check (trip = 'ab-op-reis');

-- live updates aanzetten voor deze tabel (Database → Replication laat 'm
-- hierna zien); alter publication … add table heeft geen "if not exists",
-- dus eerst checken of hij er al in zit
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'packing_state'
  ) then
    alter publication supabase_realtime add table public.packing_state;
  end if;
end $$;

-- controle: zou precies deze drie rijen moeten teruggeven
select policyname, cmd from pg_policies where tablename = 'packing_state';
