-- A&B op reis — gedeelde paklijst, eigen paklijst-items en boodschappenlijst
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

-- door de gebruiker toegevoegde regels bij een bestaande paklijst-groep
-- (Kamp & slapen, Kleding, …) — het vinkje/de notitie daarvan blijft
-- gewoon in packing_state, op dezelfde item_key als een ingebouwde regel
create table if not exists public.packing_custom_items (
  id           bigint generated always as identity primary key,
  trip         text not null default 'ab-op-reis',
  group_name   text not null,
  label        text not null,
  personal     boolean not null default false,
  created_by   text,
  created_at   timestamptz not null default now(),
  unique (trip, group_name, label)
);

-- losstaande boodschappenlijst, geen relatie met de paklijst
create table if not exists public.shopping_items (
  id           bigint generated always as identity primary key,
  trip         text not null default 'ab-op-reis',
  label        text not null,
  checked      boolean not null default false,
  created_by   text,
  updated_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- zodat een UPDATE/DELETE-event via Realtime de volledige rij meestuurt
alter table public.packing_state        replica identity full;
alter table public.packing_custom_items replica identity full;
alter table public.shopping_items       replica identity full;

alter table public.packing_state        enable row level security;
alter table public.packing_custom_items enable row level security;
alter table public.shopping_items       enable row level security;

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

drop policy if exists "select eigen reis" on public.packing_custom_items;
create policy "select eigen reis" on public.packing_custom_items
  for select using (trip = 'ab-op-reis');
drop policy if exists "insert eigen reis" on public.packing_custom_items;
create policy "insert eigen reis" on public.packing_custom_items
  for insert with check (trip = 'ab-op-reis');
drop policy if exists "delete eigen reis" on public.packing_custom_items;
create policy "delete eigen reis" on public.packing_custom_items
  for delete using (trip = 'ab-op-reis');

drop policy if exists "select eigen reis" on public.shopping_items;
create policy "select eigen reis" on public.shopping_items
  for select using (trip = 'ab-op-reis');
drop policy if exists "insert eigen reis" on public.shopping_items;
create policy "insert eigen reis" on public.shopping_items
  for insert with check (trip = 'ab-op-reis');
drop policy if exists "update eigen reis" on public.shopping_items;
create policy "update eigen reis" on public.shopping_items
  for update using (trip = 'ab-op-reis') with check (trip = 'ab-op-reis');
drop policy if exists "delete eigen reis" on public.shopping_items;
create policy "delete eigen reis" on public.shopping_items
  for delete using (trip = 'ab-op-reis');

-- live updates aanzetten voor deze drie tabellen (Database → Replication
-- laat ze hierna zien); alter publication … add table heeft geen
-- "if not exists", dus eerst checken of een tabel er al in zit
do $$
declare t text;
begin
  foreach t in array array['packing_state','packing_custom_items','shopping_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- controle: zou negen rijen moeten teruggeven, drie policies per tabel
select tablename, policyname, cmd from pg_policies
where tablename in ('packing_state','packing_custom_items','shopping_items')
order by tablename, cmd;
