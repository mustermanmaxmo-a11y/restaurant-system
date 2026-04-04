-- Inventory Triggers
-- Automatischer Lagerabzug bei Bestellungen und Verlust-Einträgen

-- ============================================================
-- TRIGGER 1: Lagerabzug wenn Bestellstatus → 'new'
-- Feuert bei UPDATE auf orders wenn status zu 'new' wechselt
-- ============================================================
create or replace function public.deduct_stock_on_order()
returns trigger language plpgsql security definer as $$
declare
  v_item        jsonb;
  v_item_id     uuid;
  v_qty         numeric;
  v_ing         record;
begin
  -- Nur feuern wenn Status zu 'new' wechselt (nicht bei Re-Set auf 'new')
  if NEW.status <> 'new' or OLD.status = 'new' then
    return NEW;
  end if;

  -- Alle Items in der JSONB-Array durchgehen
  for v_item in select * from jsonb_array_elements(NEW.items) loop
    v_item_id := nullif(v_item->>'item_id', '')::uuid;
    if v_item_id is null then continue; end if;
    v_qty := coalesce((v_item->>'qty')::numeric, 1);

    -- Für jede verknüpfte Zutat den Bestand reduzieren
    for v_ing in
      select mii.ingredient_id, mii.quantity_per_serving
      from public.menu_item_ingredients mii
      where mii.menu_item_id = v_item_id
    loop
      update public.ingredients
        set current_stock = current_stock - (v_ing.quantity_per_serving * v_qty)
        where id = v_ing.ingredient_id;

      -- Audit-Log Eintrag
      insert into public.stock_movements
        (restaurant_id, ingredient_id, movement_type, quantity_delta, order_id)
      values
        (NEW.restaurant_id, v_ing.ingredient_id, 'order_deduction',
         -(v_ing.quantity_per_serving * v_qty), NEW.id);
    end loop;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_deduct_stock_on_order on public.orders;
create trigger trg_deduct_stock_on_order
  after update on public.orders
  for each row execute function public.deduct_stock_on_order();

-- ============================================================
-- TRIGGER 2: Lagerabzug bei Waste-Eintrag
-- Feuert bei INSERT auf waste_log
-- ============================================================
create or replace function public.deduct_stock_on_waste()
returns trigger language plpgsql security definer as $$
declare
  v_restaurant_id uuid;
begin
  select restaurant_id into v_restaurant_id
    from public.ingredients where id = NEW.ingredient_id;

  -- Bestand reduzieren
  update public.ingredients
    set current_stock = current_stock - NEW.quantity
    where id = NEW.ingredient_id;

  -- Audit-Log Eintrag
  insert into public.stock_movements
    (restaurant_id, ingredient_id, movement_type, quantity_delta, note)
  values
    (v_restaurant_id, NEW.ingredient_id, 'waste', -NEW.quantity,
     'Verlust: ' || NEW.reason::text);

  return NEW;
end;
$$;

drop trigger if exists trg_deduct_stock_on_waste on public.waste_log;
create trigger trg_deduct_stock_on_waste
  after insert on public.waste_log
  for each row execute function public.deduct_stock_on_waste();
