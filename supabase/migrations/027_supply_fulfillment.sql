-- Supply Fulfillment (External Purchasing side) -- Technical Design approved 2026-07-14, across
-- five review rounds plus a dedicated Migration Design review. Frozen Business Architecture
-- Rules 1-10. Internal Transfer is deliberately OUT of scope here -- Migration 028, separately.
--
-- Three independent business facts, three owners, per Rule 8 (never overwriting each other):
--   Requested Quantity -> store_purchase_request_items (already exists, migration 026)
--   Purchased Quantity -> purchase_order_items.quantity_ordered (already exists, migration 016 --
--                          NOT a new field; this migration only adds traceability to it)
--   Received Quantity  -> store_goods_receipt_items (new, this migration)
--
-- Emergency Purchase is derived, never manually flagged: an item is Emergency purely because
-- store_purchase_request_item_id is null -- no is_emergency column exists anywhere.
--
-- Priority is a plain boolean on store_purchase_request_items only -- not Master Data, not
-- Inventory, not Stock Count, never copied anywhere else. Intentionally not a lookup table
-- (unlike Emergency Reason) -- a genuine two-state business decision, not an evolving category
-- list; do not over-design Version 1.

-- ============================================================
-- Emergency Reason -- lookup table, not a Postgres enum (this project already paid the
-- enum-recreation cost twice: store_type in 008, staff_role in 011) and not free text (loses
-- Analytics value). English keys, Spanish display names -- same convention already established
-- by permission_definitions/store_role_definitions.
-- ============================================================

create table emergency_reason_definitions (
  key text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table emergency_reason_definitions enable row level security;

create policy "staff can read emergency reason definitions" on emergency_reason_definitions for select using (is_active_staff());
create policy "administrators can insert emergency reason definitions" on emergency_reason_definitions for insert with check (is_administrator());
create policy "administrators can update emergency reason definitions" on emergency_reason_definitions for update using (is_administrator()) with check (is_administrator());

-- No delete policy/grant -- same convention as every other definitions table in this project;
-- retiring a reason is done via is_active = false, never a hard delete (would orphan any
-- purchase_order_items row still referencing it).
grant select, insert, update on public.emergency_reason_definitions to authenticated;

insert into emergency_reason_definitions (key, name, sort_order) values
  ('supplier_promotion', 'Promoción del Proveedor', 1),
  ('minimum_order_quantity', 'Cantidad Mínima de Pedido', 2),
  ('unexpected_demand', 'Demanda Inesperada', 3),
  ('out_of_stock', 'Sin Stock', 4),
  ('manager_request', 'Solicitud del Gerente', 5),
  ('other', 'Otro', 6);

-- ============================================================
-- purchase_order_items: traceability to demand, and the Emergency Purchase mechanism.
--
-- store_purchase_request_item_id present  -> Normal Purchase (fulfills real demand).
-- store_purchase_request_item_id absent   -> Emergency Purchase (must be justified).
-- No is_emergency column -- Emergency status is derived purely from this FK's nullability,
-- approved explicitly to avoid a second, independently-settable fact that could drift out of
-- sync with the FK it's describing.
-- ============================================================

alter table purchase_order_items
  add column store_purchase_request_item_id uuid references store_purchase_request_items(id) on delete restrict,
  add column emergency_reason_key text references emergency_reason_definitions(key) on delete restrict,
  add column emergency_reason_note text;

-- Backfill safety net: any purchase_order_items row inserted before this migration (Purchasing
-- has been live since migration 017, independent of Store Purchase Request, which didn't exist
-- yet) has both new columns null, which the check constraint below would otherwise reject. Those
-- rows were, factually, not linked to any Store Purchase Request Item -- classifying them
-- 'other' is accurate, not a guess, and this is a no-op if the table happens to be empty.
update purchase_order_items
set emergency_reason_key = 'other'
where store_purchase_request_item_id is null and emergency_reason_key is null;

-- Every item is either linked-and-normal or unlinked-and-justified -- nothing can exist in
-- between. This is what "preserve complete demand traceability" actually enforces, not just
-- describes.
alter table purchase_order_items
  add constraint purchase_order_items_demand_or_emergency_check
  check (
    (store_purchase_request_item_id is not null and emergency_reason_key is null)
    or
    (store_purchase_request_item_id is null and emergency_reason_key is not null)
  );

-- Same shape as the existing purchase_order_items_purchase_unit_spec_check (migration 015:
-- purchase_unit <> 'other' or purchase_unit_spec is not null) -- direct precedent in this exact
-- table for an "'other' unlocks a free-text field" pattern.
alter table purchase_order_items
  add constraint purchase_order_items_emergency_note_check
  check (emergency_reason_note is null or emergency_reason_key = 'other');

-- Needed for the Remaining Quantity computation (summing Purchased across every item linked to
-- one Store Purchase Request Item) and Purchase Order Detail's "Fulfills" section.
create index purchase_order_items_store_purchase_request_item_id_idx on purchase_order_items(store_purchase_request_item_id);

-- ============================================================
-- store_purchase_request_items: Priority. A plain boolean, not a lookup table -- Normal/High is
-- a genuine binary with no stated extensibility need (unlike Emergency Reason's explicit six
-- categories plus an "Other" valve). Lives here only -- never copied to Inventory, Stock Count,
-- or anywhere else.
-- ============================================================

alter table store_purchase_request_items add column is_high_priority boolean not null default false;

-- ============================================================
-- Store Goods Receipt -- confirmation of what the Store actually received. Belongs to the
-- receiving Store, not Purchasing (approved Business Architecture). Never updates inventory --
-- Inventory continues to be updated only by Stock Count (Rule 1). One Purchase Order can have
-- many receipts (Multiple Deliveries, approved) -- purchase_order_id is a plain FK, not unique.
-- ============================================================

create table store_goods_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete restrict,
  received_by uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index store_goods_receipts_purchase_order_id_idx on store_goods_receipts(purchase_order_id);

-- received_quantity has no database default -- defaulting (to Purchased Quantity on the first
-- receipt, to Remaining Quantity on later ones) is an application-layer concern (approved
-- design), since it depends on prior receipts' totals, which only the client/RPC caller
-- reasonably computes at submit time. Every row always carries an explicit, real value.
-- unique(store_goods_receipt_id, purchase_order_item_id): one row per item per delivery event,
-- but the same item can appear across multiple receipts (different store_goods_receipt_id) when
-- delivered in parts.
create table store_goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  store_goods_receipt_id uuid not null references store_goods_receipts(id) on delete cascade,
  purchase_order_item_id uuid not null references purchase_order_items(id) on delete restrict,
  received_quantity numeric(14, 4) not null check (received_quantity >= 0),
  created_at timestamptz not null default now(),
  unique (store_goods_receipt_id, purchase_order_item_id)
);

create index store_goods_receipt_items_receipt_id_idx on store_goods_receipt_items(store_goods_receipt_id);
create index store_goods_receipt_items_purchase_order_item_id_idx on store_goods_receipt_items(purchase_order_item_id);

alter table store_goods_receipts enable row level security;
alter table store_goods_receipt_items enable row level security;

-- Read: Administrator, Purchasing role (placed the order, needs visibility into what arrived),
-- or the receiving store's own staff (has_store_access, resolved via purchase_orders.store_id).
create policy "read access can view store goods receipts" on store_goods_receipts for select
  using (
    is_administrator() or can_manage_purchasing()
    or exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_id and has_store_access(po.store_id)
    )
  );

create policy "read access can view store goods receipt items" on store_goods_receipt_items for select
  using (
    is_administrator() or can_manage_purchasing()
    or exists (
      select 1 from store_goods_receipts sgr
      join purchase_orders po on po.id = sgr.purchase_order_id
      where sgr.id = store_goods_receipt_id and has_store_access(po.store_id)
    )
  );

-- No insert/update/delete policy on either table -- submit_store_goods_receipt() is the sole
-- write path (security definer, bypasses RLS as its own owner, same pattern as
-- create_purchase_order()/submit_store_purchase_request()). Immutable once created, same
-- posture as every other Business Record in this project.
grant select on public.store_goods_receipts to authenticated;
grant select on public.store_goods_receipt_items to authenticated;

-- ============================================================
-- Goods Receipt permissions: NOT a new capability. Reuses can_submit_store_purchase_request()
-- directly (approved, explicit correction from the design review) -- any store already able to
-- submit a Store Purchase Request can also complete a Goods Receipt for it. CCC Amparo and
-- MR.Sando need no special handling: they already hold the retail_store Role among their
-- multiple roles, so they already have this access today, with zero new grant logic required.
-- No new permission_definitions row, no derive_store_permission_keys() change, no new
-- enforcement function -- see submit_store_goods_receipt() below.
-- ============================================================

-- ============================================================
-- create_purchase_order(): extended (CREATE OR REPLACE, signature unchanged) to accept and
-- validate the demand-or-emergency fields per item. Mirrors this function's own existing
-- cross-contamination guard shape (item_supplier_id <> target_supplier_id) for the new checks.
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
  resolved_spr_item_id uuid;
  resolved_emergency_reason_key text;
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

    resolved_spr_item_id := nullif(item ->> 'store_purchase_request_item_id', '')::uuid;
    resolved_emergency_reason_key := nullif(item ->> 'emergency_reason_key', '');

    if resolved_spr_item_id is not null then
      if not exists (select 1 from store_purchase_request_items where id = resolved_spr_item_id) then
        raise exception 'Store Purchase Request Item % does not exist', resolved_spr_item_id;
      end if;
      if resolved_emergency_reason_key is not null then
        raise exception 'An item cannot have both a Store Purchase Request reference and an Emergency Reason';
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
      store_purchase_request_item_id, emergency_reason_key, emergency_reason_note
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
      resolved_spr_item_id,
      resolved_emergency_reason_key,
      nullif(item ->> 'emergency_reason_note', '')
    );
  end loop;

  return new_order_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- submit_store_purchase_request(): extended (CREATE OR REPLACE, signature unchanged) to accept
-- is_high_priority per item. Defaults to false when omitted -- same coalesce shape already used
-- for iva_rate's default in create_purchase_order().
-- ============================================================

create or replace function submit_store_purchase_request(
  target_store_id uuid,
  target_notes text,
  target_items jsonb
) returns uuid as $$
declare
  new_request_id uuid;
  caller_staff_id uuid;
  item jsonb;
  resolved_product_name text;
begin
  if not can_submit_store_purchase_request(target_store_id) then
    raise exception 'Not authorized to submit a Store Purchase Request for this store';
  end if;

  if target_items is null or jsonb_array_length(target_items) = 0 then
    raise exception 'A Store Purchase Request must have at least one item';
  end if;

  select id into caller_staff_id from staff_profiles where user_id = auth.uid();

  insert into store_purchase_requests (store_id, submitted_by, notes)
  values (target_store_id, caller_staff_id, nullif(target_notes, ''))
  returning id into new_request_id;

  for item in select * from jsonb_array_elements(target_items)
  loop
    select p.name into resolved_product_name
    from products p
    where p.id = (item ->> 'product_id')::uuid;
    if resolved_product_name is null then
      raise exception 'Product % does not exist', item ->> 'product_id';
    end if;

    insert into store_purchase_request_items (
      store_purchase_request_id, product_id, product_name, requested_quantity, is_high_priority
    )
    values (
      new_request_id,
      (item ->> 'product_id')::uuid,
      resolved_product_name,
      (item ->> 'requested_quantity')::numeric,
      coalesce((item ->> 'is_high_priority')::boolean, false)
    );
  end loop;

  return new_request_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- submit_store_goods_receipt(): new, sole write path for Store Goods Receipt. Same atomic,
-- single-transaction design philosophy as every other submit RPC in this project. Authorization
-- reuses can_submit_store_purchase_request() against the Purchase Order's own store_id -- no new
-- enforcement function. Guards against cross-order contamination the same way
-- create_purchase_order() guards against cross-supplier contamination.
-- ============================================================

create or replace function submit_store_goods_receipt(
  target_purchase_order_id uuid,
  target_items jsonb
) returns uuid as $$
declare
  new_receipt_id uuid;
  caller_staff_id uuid;
  resolved_store_id uuid;
  item jsonb;
  item_purchase_order_id uuid;
begin
  select store_id into resolved_store_id from purchase_orders where id = target_purchase_order_id;
  if resolved_store_id is null then
    raise exception 'Purchase Order % does not exist', target_purchase_order_id;
  end if;

  if not can_submit_store_purchase_request(resolved_store_id) then
    raise exception 'Not authorized to record a Store Goods Receipt for this store';
  end if;

  if target_items is null or jsonb_array_length(target_items) = 0 then
    raise exception 'A Store Goods Receipt must have at least one item';
  end if;

  select id into caller_staff_id from staff_profiles where user_id = auth.uid();

  insert into store_goods_receipts (purchase_order_id, received_by)
  values (target_purchase_order_id, caller_staff_id)
  returning id into new_receipt_id;

  for item in select * from jsonb_array_elements(target_items)
  loop
    select poi.purchase_order_id into item_purchase_order_id
    from purchase_order_items poi
    where poi.id = (item ->> 'purchase_order_item_id')::uuid;

    if item_purchase_order_id is null then
      raise exception 'Purchase Order Item % does not exist', item ->> 'purchase_order_item_id';
    end if;
    if item_purchase_order_id <> target_purchase_order_id then
      raise exception 'Purchase Order Item % does not belong to Purchase Order %',
        item ->> 'purchase_order_item_id', target_purchase_order_id;
    end if;

    insert into store_goods_receipt_items (
      store_goods_receipt_id, purchase_order_item_id, received_quantity
    )
    values (
      new_receipt_id,
      (item ->> 'purchase_order_item_id')::uuid,
      (item ->> 'received_quantity')::numeric
    );
  end loop;

  return new_receipt_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function submit_store_goods_receipt(uuid, jsonb) to authenticated;
