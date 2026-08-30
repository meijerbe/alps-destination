-- schema.sql moet zo vaak te draaien zijn als je wilt. Deze controle draait ná
-- een tweede run en kijkt of de data er nog is en de policies niet verdubbeld.
do $$
declare n int;
begin
  select count(*) into n from shopping_items where label = 'Melk';
  if n <> 1 then
    raise exception 'Data ging verloren bij opnieuw draaien: % rijen Melk in plaats van 1', n;
  end if;

  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename = 'shopping_items';
  if n <> 4 then
    raise exception 'shopping_items heeft % policies na een tweede run, verwacht 4', n;
  end if;

  raise notice 'Opnieuw draaien is veilig: data intact, policies niet verdubbeld.';
end $$;
