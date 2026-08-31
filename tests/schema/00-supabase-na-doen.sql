-- Bootst de stukjes Supabase na die schema.sql verwacht, zodat we het schema
-- tegen een kale Postgres kunnen draaien: de publicatie voor Realtime en de
-- anon-rol waar de publieke sleutel op uitkomt.
--
-- Net als schema.sql zelf: veilig om opnieuw te draaien.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to anon;
alter default privileges in schema public grant all on tables to anon;
alter default privileges in schema public grant usage, select on sequences to anon;
