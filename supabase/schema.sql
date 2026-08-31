-- A&B op reis — gedeelde paklijst, eigen paklijst-items en boodschappenlijst
-- Uitvoeren in Supabase: Project → SQL Editor → New query → plakken → Run.
--
-- Veilig om zo vaak opnieuw te draaien als je wilt. De policies worden in één
-- lus voor alle tabellen tegelijk gezet, zodat er geen tabel kan achterblijven
-- met wél rijbeveiliging maar géén policies — dat weigert namelijk alles, met
-- "new row violates row-level security policy" tot gevolg.
--
-- Onderaan staat een controle die een foutmelding gooit als er iets ontbreekt.
-- Zie je onderin "Success. No rows returned" plus de tabel met policies, dan
-- staat alles goed.

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

-- Rijbeveiliging, realtime en policies — voor elke tabel exact hetzelfde.
--
-- Er zit geen login achter: de publieke sleutel mag precies de rijen van déze
-- ene reis lezen en schrijven, en niets anders. Bewust laagdrempelig voor een
-- privélink tussen twee mensen, niet geschikt voor iets gevoeligs.
do $$
declare
  reis  text   := 'ab-op-reis';
  tabs  text[] := array['packing_state', 'packing_custom_items', 'shopping_items'];
  t     text;
begin
  -- "policy ... does not exist, skipping" bij elke drop is hier verwacht gedrag
  -- en levert twee schermen ruis op; alleen echte waarschuwingen tonen
  set local client_min_messages = warning;

  foreach t in array tabs loop
    -- volledige rij meesturen bij UPDATE/DELETE, anders mist Realtime velden
    execute format('alter table public.%I replica identity full', t);
    execute format('alter table public.%I enable row level security', t);

    -- policynamen uit eerdere versies van dit script opruimen
    execute format('drop policy if exists "select eigen reis" on public.%I', t);
    execute format('drop policy if exists "insert eigen reis" on public.%I', t);
    execute format('drop policy if exists "update eigen reis" on public.%I', t);
    execute format('drop policy if exists "delete eigen reis" on public.%I', t);

    execute format('drop policy if exists "reis select" on public.%I', t);
    execute format('create policy "reis select" on public.%I for select using (trip = %L)', t, reis);

    execute format('drop policy if exists "reis insert" on public.%I', t);
    execute format('create policy "reis insert" on public.%I for insert with check (trip = %L)', t, reis);

    execute format('drop policy if exists "reis update" on public.%I', t);
    execute format('create policy "reis update" on public.%I for update using (trip = %L) with check (trip = %L)', t, reis, reis);

    execute format('drop policy if exists "reis delete" on public.%I', t);
    execute format('create policy "reis delete" on public.%I for delete using (trip = %L)', t, reis);

    -- live updates; alter publication … add table heeft geen "if not exists"
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;

  reset client_min_messages;
end $$;

-- Controle: gooit een foutmelding als een tabel niet alle vier de policies
-- heeft of niet meedoet met Realtime. Beter luid falen dan stil half werken.
do $$
declare
  tabs text[] := array['packing_state', 'packing_custom_items', 'shopping_items'];
  t    text;
  n    int;
begin
  foreach t in array tabs loop
    select count(*) into n from pg_policies where schemaname = 'public' and tablename = t;
    if n <> 4 then
      raise exception 'Tabel % heeft % policies in plaats van 4 — schema niet compleet toegepast', t, n;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      raise exception 'Tabel % doet niet mee met Realtime', t;
    end if;
  end loop;
  raise notice 'Alles staat goed: 3 tabellen, elk 4 policies, alle drie live.';
end $$;

-- ter controle in beeld: twaalf rijen, vier per tabel
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('packing_state', 'packing_custom_items', 'shopping_items')
order by tablename, cmd;
