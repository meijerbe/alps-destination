-- Na schema.sql: mag de publieke sleutel precies doen wat de app nodig heeft,
-- en niet meer dan dat?
grant all on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;

set role anon;

-- de drie schrijfacties die de app doet
insert into shopping_items (trip, label, created_by) values ('ab-op-reis', 'Melk', 'A');
insert into packing_custom_items (trip, group_name, label) values ('ab-op-reis', 'Kleding', 'Extra sokken');

-- upsert precies zoals setPackState hem stuurt: zonder id, alleen wat wijzigt.
-- Twee keer achter elkaar, want daar liep het eerder op stuk.
insert into packing_state (trip, item_key, scope, checked, updated_by, updated_at)
values ('ab-op-reis', 'eten-koken__brander', 'gedeeld', true, 'A', now())
on conflict (trip, item_key, scope) do update
  set checked = excluded.checked, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

insert into packing_state (trip, item_key, scope, checked, updated_by, updated_at)
values ('ab-op-reis', 'eten-koken__brander', 'gedeeld', false, 'B', now())
on conflict (trip, item_key, scope) do update
  set checked = excluded.checked, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

update shopping_items set checked = true where label = 'Melk';
delete from packing_custom_items where label = 'Extra sokken';

reset role;

-- rijen van een ándere reis mogen niet zichtbaar of schrijfbaar zijn
insert into shopping_items (trip, label) values ('andere-reis', 'Niet van ons');

do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from shopping_items where trip = 'andere-reis';
  if n <> 0 then
    raise exception 'anon ziet % rijen van een andere reis — rijbeveiliging lekt', n;
  end if;
  reset role;
  raise notice 'Rechten kloppen: anon mag deze reis en niets anders.';
end $$;
