-- Purchase creation must be atomic (approved adjustment to the Purchasing UI, 2026-07-12):
-- Page 2's original implementation did two sequential client-side inserts (order, then items),
-- which could leave an orphan purchase header if the browser closed between the two calls.
-- create_purchase_order() replaces that with a single security-definer function -- same design
-- philosophy as complete_stock_count() (migration 014): one function call, one transaction, all
-- writes succeed together or none do. A plpgsql function body runs inside the calling
-- transaction; any unhandled exception aborts everything the function has done so far, no
-- explicit ROLLBACK needed.
--
-- Also matches complete_stock_count()'s "read current truth inside the transaction, don't trust
-- a client-supplied snapshot" principle: supplier_name, product_name, purchase_unit, and
-- purchase_unit_spec are all resolved here from suppliers/products/supplier_products at the
-- moment of the transaction, not passed in by the client -- a client-fetched name could already
-- be stale if a rename happened between opening the form and submitting it. quantity_ordered,
-- unit_price, and iva_rate ARE trusted from the client, because those are the manager's actual
-- decision (freely editable by design, per the approved business design), not a value to be
-- independently re-derived.
--
-- Now that create_purchase_order() is the only intended write path, the direct client INSERT
-- policies/grants from migration 016 are removed -- same shape as `inventory`, which has never
-- allowed direct client writes, only complete_stock_count(). This also closes a real gap the old
-- direct-insert policies had: nothing previously stopped a client from inserting a
-- purchase_order_item whose supplier_product_id belonged to a different supplier than the
-- purchase's own supplier_id. The function checks this explicitly and rejects it.

drop policy if exists "purchasing can create purchase orders" on purchase_orders;
drop policy if exists "purchasing can create purchase order items" on purchase_order_items;

revoke insert on public.purchase_orders from authenticated;
revoke insert on public.purchase_order_items from authenticated;

create or replace function create_purchase_order(
  target_store_id uuid,
  target_supplier_id uuid,
  target_notes text,
  target_items jsonb
) returns uuid as $$
declare
  new_order_id uuid;
  caller_staff_id uuid;
  resolved_supplier_name text;
  item jsonb;
  resolved_product_name text;
  resolved_purchase_unit purchase_unit_type;
  resolved_purchase_unit_spec text;
  item_supplier_id uuid;
begin
  if not can_manage_purchasing() then
    raise exception 'Not authorized to create a purchase';
  end if;

  if target_items is null or jsonb_array_length(target_items) = 0 then
    raise exception 'A purchase must have at least one item';
  end if;

  select name into resolved_supplier_name from suppliers where id = target_supplier_id;
  if resolved_supplier_name is null then
    raise exception 'Supplier % does not exist', target_supplier_id;
  end if;

  select id into caller_staff_id from staff_profiles where user_id = auth.uid();

  insert into purchase_orders (store_id, supplier_id, supplier_name, created_by, notes)
  values (target_store_id, target_supplier_id, resolved_supplier_name, caller_staff_id, nullif(target_notes, ''))
  returning id into new_order_id;

  for item in select * from jsonb_array_elements(target_items)
  loop
    select p.name into resolved_product_name
    from products p
    where p.id = (item ->> 'product_id')::uuid;
    if resolved_product_name is null then
      raise exception 'Product % does not exist', item ->> 'product_id';
    end if;

    select sp.supplier_id, sp.purchase_unit, sp.purchase_unit_spec
    into item_supplier_id, resolved_purchase_unit, resolved_purchase_unit_spec
    from supplier_products sp
    where sp.id = (item ->> 'supplier_product_id')::uuid;
    if item_supplier_id is null then
      raise exception 'Supplier product % does not exist', item ->> 'supplier_product_id';
    end if;
    if item_supplier_id <> target_supplier_id then
      raise exception 'Supplier product % does not belong to supplier %', item ->> 'supplier_product_id', target_supplier_id;
    end if;

    insert into purchase_order_items (
      purchase_order_id, product_id, product_name, supplier_product_id,
      quantity_ordered, unit_price, iva_rate, purchase_unit, purchase_unit_spec
    )
    values (
      new_order_id,
      (item ->> 'product_id')::uuid,
      resolved_product_name,
      (item ->> 'supplier_product_id')::uuid,
      (item ->> 'quantity_ordered')::numeric,
      (item ->> 'unit_price')::numeric,
      coalesce((item ->> 'iva_rate')::numeric, 10.00),
      resolved_purchase_unit,
      resolved_purchase_unit_spec
    );
  end loop;

  return new_order_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function create_purchase_order(uuid, uuid, text, jsonb) to authenticated;
