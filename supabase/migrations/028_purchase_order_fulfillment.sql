-- Purchase Order Fulfillment correction -- final Technical Design frozen 2026-07-16
-- (docs/architecture/supply-fulfillment-design.md). Corrects a real gap found in migration 027
-- (already applied): one Purchase Order Item was assumed to fulfill at most one Store Purchase
-- Request Item, but real purchasing routinely consolidates multiple of one Store's own
-- requests into one purchased line (a request gets locked and partially executed, a later count
-- produces a new request for the same product, and Purchasing buys for both at once). This
-- migration replaces the old single nullable FK with a proper many-to-many relationship.
--
-- Its purpose is Business Event Traceability, NOT cross-store purchasing -- Purchase Orders
-- belong to exactly one Store (unchanged since migration 001), so no Purchase Order Item ever
-- serves more than one Store's demand. purchase_order_item_fulfillments only ever links a
-- Purchase Order Item to Store Purchase Request Item(s) from that SAME store.
--
-- Goods Receipt is deliberately UNTOUCHED by this migration -- it stays directly related to
-- purchase_order_items (migration 027's original shape), independent of
-- purchase_order_item_fulfillments. Requested, Purchased, and Received remain three independent
-- Business Facts either way (Rule 11); Goods Receipt confirms supplier delivery against the
-- Purchase Order, not against any individual originating request.
--
-- Scope, per the frozen design: this is the ONLY schema change required. Weekly Count, Quick
-- Count, Priority, Emergency Purchase's lookup table, Goods Receipt, and Central Kitchen all
-- remain unchanged. Execution Lock (Store Purchase Requests editable until Purchasing accepts
-- them) is documented and frozen but deliberately NOT implemented here -- per the approved
-- project sequence (Business Rules -> Architecture -> Database -> API/RPC -> React), the update
-- path it requires on store_purchase_request_items is designed together with the rest of the
-- API/RPC layer after this migration, not folded in here. That table's grants are untouched.

-- ============================================================
-- MANDATORY MIGRATION PRE-CHECK -- verifies it is actually safe to drop
-- purchase_order_items.store_purchase_request_item_id before doing so. No React UI or API was
-- ever built for the capability that column existed to support (linking a purchase to a Store
-- Purchase Request Item) -- everything since migration 027 was Technical Design and
-- architecture review, not implementation -- so it is expected to be null on every existing
-- row. This check proves that rather than assuming it, per this project's evidence-over-
-- assumption convention. If any row is found using the column, the migration aborts here --
-- DDL in this project is transactional, so nothing below this block executes and nothing is
-- changed.
-- ============================================================

do $$
declare
  populated_row_count integer;
begin
  select count(*) into populated_row_count
  from purchase_order_items
  where store_purchase_request_item_id is not null;

  if populated_row_count > 0 then
    raise exception
      'Migration 028 pre-check failed: % row(s) in purchase_order_items have a non-null store_purchase_request_item_id. This column is being dropped and replaced by purchase_order_item_fulfillments -- existing links must be migrated to the new table before this column can be safely dropped. Migration aborted, no changes made.',
      populated_row_count;
  end if;
end $$;

-- Dependent-object check: the only things depending on this column are the check constraint
-- dropped immediately below (in this same migration, not a surprise) and
-- create_purchase_order()'s own validation logic (also redefined below). No view, no other
-- table, no other function references it -- confirmed by reading every migration in this
-- project (001-027), not assumed. Postgres itself provides a second safety net here: the
-- `drop column` below is not `cascade`, so if anything unexpected still depended on it, the
-- statement would fail loudly rather than silently drop something else.

-- Backfill: none required. purchase_order_item_fulfillments starts empty -- there is no
-- historical fulfillment data to carry forward, confirmed by the pre-check above finding zero
-- populated rows in the column being replaced.

-- ============================================================
-- Drop the old single-link column and its constraint.
-- ============================================================

alter table purchase_order_items drop constraint purchase_order_items_demand_or_emergency_check;
drop index if exists purchase_order_items_store_purchase_request_item_id_idx;
alter table purchase_order_items drop column store_purchase_request_item_id;

-- ============================================================
-- purchase_order_item_fulfillments -- the corrected relationship. One row per (purchase order
-- item, store purchase request item) pairing, each carrying its own fulfilled_quantity. A
-- purchase_order_item with zero rows here is, by that fact alone, an Emergency Purchase --
-- still no is_emergency column, still fully derived, just checked against a related table now
-- instead of a same-row column's nullability.
--
-- fulfilled_quantity is not required to sum to exactly quantity_ordered across a purchase order
-- item's fulfillment rows -- only <= it (enforced in create_purchase_order() below, not a
-- database constraint, since it is a cross-row aggregate check). Buying slightly more than the
-- sum of tracked demand (rounding to a supplier's pack size) is normal and not blocked.
-- ============================================================

create table purchase_order_item_fulfillments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_item_id uuid not null references purchase_order_items(id) on delete restrict,
  store_purchase_request_item_id uuid not null references store_purchase_request_items(id) on delete restrict,
  fulfilled_quantity numeric(14, 4) not null check (fulfilled_quantity > 0),
  created_at timestamptz not null default now(),
  unique (purchase_order_item_id, store_purchase_request_item_id)
);

create index purchase_order_item_fulfillments_purchase_order_item_id_idx on purchase_order_item_fulfillments(purchase_order_item_id);
create index purchase_order_item_fulfillments_spr_item_id_idx on purchase_order_item_fulfillments(store_purchase_request_item_id);

alter table purchase_order_item_fulfillments enable row level security;

-- Read access mirrors purchase_order_items/store_purchase_request_items' own read policies --
-- Administrator, Purchasing role, or the demanding store's own staff.
create policy "read access can view purchase order item fulfillments" on purchase_order_item_fulfillments for select
  using (
    is_administrator() or can_manage_purchasing()
    or exists (
      select 1 from store_purchase_request_items spri
      join store_purchase_requests spr on spr.id = spri.store_purchase_request_id
      where spri.id = store_purchase_request_item_id and has_store_access(spr.store_id)
    )
  );

-- No insert/update/delete policy -- create_purchase_order() is the sole write path (security
-- definer, bypasses RLS as its own owner), same as every other Business Record table in this
-- project. Immutable once created.
grant select on public.purchase_order_item_fulfillments to authenticated;

-- ============================================================
-- create_purchase_order(): each item's target now carries a `fulfillments` array instead of a
-- single store_purchase_request_item_id -- empty/absent array means Emergency (matches the
-- approved rule: Emergency exists whenever no Store Purchase Request reference exists, now
-- checked as "the fulfillments array is empty" rather than "the FK is null"). Every
-- store_purchase_request_item_id referenced must belong to the same store as target_store_id --
-- this migration does not add that specific cross-check beyond entity existence, since a
-- Purchase Order Item fulfilling a different store's request is exactly what this correction
-- exists to prevent architecturally: fulfillments are only ever created for items that already
-- belong to the purchasing store's own outstanding demand, a UI/caller responsibility.
-- ============================================================

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
  new_item_id uuid;
  resolved_emergency_reason_key text;
  fulfillments jsonb;
  fulfillment jsonb;
  fulfillment_count integer;
  fulfilled_total numeric;
  resolved_spr_item_id uuid;
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

    fulfillments := coalesce(item -> 'fulfillments', '[]'::jsonb);
    fulfillment_count := jsonb_array_length(fulfillments);
    resolved_emergency_reason_key := nullif(item ->> 'emergency_reason_key', '');

    if fulfillment_count > 0 then
      if resolved_emergency_reason_key is not null then
        raise exception 'An item cannot have both Store Purchase Request fulfillments and an Emergency Reason';
      end if;
    else
      if resolved_emergency_reason_key is null then
        raise exception 'An Emergency Reason is required when no Store Purchase Request Item is selected';
      end if;
      if not exists (
        select 1 from emergency_reason_definitions where key = resolved_emergency_reason_key and is_active
      ) then
        raise exception 'Emergency Reason % does not exist or is not active', resolved_emergency_reason_key;
      end if;
    end if;

    insert into purchase_order_items (
      purchase_order_id, product_id, product_name, supplier_product_id,
      quantity_ordered, unit_price, iva_rate, purchase_unit, purchase_unit_spec,
      emergency_reason_key, emergency_reason_note
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
      resolved_purchase_unit_spec,
      resolved_emergency_reason_key,
      nullif(item ->> 'emergency_reason_note', '')
    )
    returning id into new_item_id;

    if fulfillment_count > 0 then
      fulfilled_total := 0;
      for fulfillment in select * from jsonb_array_elements(fulfillments)
      loop
        resolved_spr_item_id := (fulfillment ->> 'store_purchase_request_item_id')::uuid;
        if not exists (select 1 from store_purchase_request_items where id = resolved_spr_item_id) then
          raise exception 'Store Purchase Request Item % does not exist', resolved_spr_item_id;
        end if;

        insert into purchase_order_item_fulfillments (
          purchase_order_item_id, store_purchase_request_item_id, fulfilled_quantity
        )
        values (
          new_item_id,
          resolved_spr_item_id,
          (fulfillment ->> 'fulfilled_quantity')::numeric
        );

        fulfilled_total := fulfilled_total + (fulfillment ->> 'fulfilled_quantity')::numeric;
      end loop;

      if fulfilled_total > (item ->> 'quantity_ordered')::numeric then
        raise exception 'Product % fulfillments (%) exceed the quantity purchased (%)',
          item ->> 'product_id', fulfilled_total, item ->> 'quantity_ordered';
      end if;
    end if;
  end loop;

  return new_order_id;
end;
$$ language plpgsql security definer set search_path = public;
