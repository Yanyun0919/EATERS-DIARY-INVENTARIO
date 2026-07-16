-- create_purchase_order() -- third RPC of the Store Purchase Request lifecycle implementation
-- phase, per the frozen RPC Contract Design (docs/architecture/supply-fulfillment-rpc-contracts.md,
-- synchronized 2026-07-16 against the Direct Store Procurement Principle and Purchasing Workspace
-- Filtering Principle in BUSINESS_RULES.md). Two changes from the existing implementation
-- (migrations 017/027/028):
--
--   1. Idempotency: a required idempotency_key, checked immediately after authorization, same
--      shape as submit_store_purchase_request() (migration 031).
--   2. Stable error codes: every raise exception now carries a `using detail = 'CODE'` from the
--      frozen contract's closed error-code set -- the prior implementation used free-text
--      messages only.
--
-- The signature itself (target_store_id, target_supplier_id, target_notes, target_items) is
-- otherwise unchanged -- confirmed against the synchronized RPC Contract: create_purchase_order()
-- always creates exactly one store's Purchase Order per call, never a multi-store batch, per the
-- Purchasing Workspace Filtering Principle ("Finish Purchasing always operates on exactly one
-- selected store... there is no All Stores Finish operation"). Because each call creates exactly
-- one purchase_orders row, a plain unique(idempotency_key) constraint is sufficient -- the same
-- shape already used by submit_store_purchase_request() and (below) submit_store_goods_receipt().

-- ============================================================
-- PRE-CHECK, per the defensive pattern established in Migrations 028-031.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'purchase_orders' and column_name = 'idempotency_key'
  ) then
    raise exception
      'Migration 032 pre-check failed: purchase_orders.idempotency_key already exists. This migration may have already been applied. Migration aborted, no changes made.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_purchase_order'
      and pg_get_function_identity_arguments(p.oid) = 'target_store_id uuid, target_supplier_id uuid, target_notes text, target_items jsonb'
  ) then
    raise exception
      'Migration 032 pre-check failed: expected function create_purchase_order(uuid, uuid, text, jsonb) was not found. Either this migration has already been applied, or the function is not in the state this migration expects. Migration aborted, no changes made.';
  end if;
end $$;

alter table purchase_orders add column idempotency_key uuid;
alter table purchase_orders add constraint purchase_orders_idempotency_key_key unique (idempotency_key);

-- Old 4-parameter signature must be dropped explicitly before the new 5-parameter version is
-- created -- CREATE OR REPLACE only replaces a function with an identical signature; adding a
-- parameter would otherwise leave the old (idempotency-unsafe) signature callable as an overload.
drop function create_purchase_order(uuid, uuid, text, jsonb);

-- ============================================================
-- create_purchase_order(target_store_id, target_supplier_id, target_notes, target_items,
--                        idempotency_key)
--
-- Structural convention (refactored 2026-07-16, matching update_store_purchase_request() and
-- submit_store_purchase_request(), migrations 029/031): validate everything first, in one pass
-- over target_items with no writes; only once every check has passed does the write phase begin.
-- The original implementation (migrations 017/027/028) inserted the Purchase Order header
-- immediately after supplier validation, then interleaved per-item validation with per-item
-- writes -- transactionally safe (any exception rolls back everything regardless of write
-- order), but inconsistent with the validate-first convention this project settled into for the
-- other two create-RPCs. This refactor is structural only: identical inputs produce identical
-- outputs, identical error codes, identical transaction semantics. Product name, purchase unit,
-- and purchase unit spec are re-resolved in the write phase rather than cached from the
-- validation phase -- same "read current truth at write time" principle already used everywhere
-- else in this project, and cheap, since validation already proved each row exists.
--
-- Validation sequence, exactly per the frozen contract (all of it now runs before any write):
--   1. Caller authorized                                          -> UNAUTHORIZED
--   2. Idempotency check -- return existing id on match, no error, no new write
--   3. target_items non-empty                                     -> EMPTY_ITEMS
--   4. Supplier exists                                            -> SUPPLIER_NOT_FOUND
--   Per item:
--   5. Product exists                                             -> PRODUCT_NOT_FOUND
--      Supplier product exists                                    -> SUPPLIER_PRODUCT_NOT_FOUND
--      Supplier product belongs to target_supplier_id              -> SUPPLIER_PRODUCT_MISMATCH
--   6. fulfillments non-empty XOR emergency_reason_key present    -> FULFILLMENT_CONFLICT /
--                                                                     EMERGENCY_REASON_REQUIRED
--   7. If Emergency: emergency_reason_key exists and is active     -> EMERGENCY_REASON_INVALID
--   8. If fulfillments: each store_purchase_request_item_id exists -> STORE_PURCHASE_REQUEST_ITEM_NOT_FOUND
--   9. If fulfillments: sum(fulfilled_quantity) <= quantity_ordered -> FULFILLMENT_EXCEEDS_PURCHASED
--
-- Write phase, only after every item above has passed every check:
--   10. Insert Purchase Order header.
--   11. Per item: insert Purchase Order Item, then insert its fulfillment rows (if any).
--   12. Return the new Purchase Order id.
--
-- One store, one call, one Purchase Order, one transaction -- no multi-store batching, per the
-- Purchasing Workspace Filtering Principle. A purchaser finishing several stores in one
-- procurement trip makes one independent call per store, each with its own idempotency_key.
-- ============================================================

create or replace function create_purchase_order(
  target_store_id uuid,
  target_supplier_id uuid,
  target_notes text,
  target_items jsonb,
  idempotency_key uuid
) returns uuid as $$
declare
  provided_idempotency_key uuid := idempotency_key;
  existing_order_id uuid;
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
  -- ============================================================
  -- VALIDATION PHASE -- no writes below this point until the phase completes successfully.
  -- ============================================================

  if not can_manage_purchasing() then
    raise exception 'Not authorized to create a purchase'
      using detail = 'UNAUTHORIZED';
  end if;

  select id into existing_order_id
  from purchase_orders
  where purchase_orders.idempotency_key = provided_idempotency_key;

  if existing_order_id is not null then
    return existing_order_id;
  end if;

  if target_items is null or jsonb_array_length(target_items) = 0 then
    raise exception 'A purchase must have at least one item'
      using detail = 'EMPTY_ITEMS';
  end if;

  select name into resolved_supplier_name from suppliers where id = target_supplier_id;
  if resolved_supplier_name is null then
    raise exception 'Supplier % does not exist', target_supplier_id
      using detail = 'SUPPLIER_NOT_FOUND';
  end if;

  for item in select * from jsonb_array_elements(target_items)
  loop
    if not exists (select 1 from products p where p.id = (item ->> 'product_id')::uuid) then
      raise exception 'Product % does not exist', item ->> 'product_id'
        using detail = 'PRODUCT_NOT_FOUND';
    end if;

    select sp.supplier_id into item_supplier_id
    from supplier_products sp
    where sp.id = (item ->> 'supplier_product_id')::uuid;
    if item_supplier_id is null then
      raise exception 'Supplier product % does not exist', item ->> 'supplier_product_id'
        using detail = 'SUPPLIER_PRODUCT_NOT_FOUND';
    end if;
    if item_supplier_id <> target_supplier_id then
      raise exception 'Supplier product % does not belong to supplier %', item ->> 'supplier_product_id', target_supplier_id
        using detail = 'SUPPLIER_PRODUCT_MISMATCH';
    end if;

    fulfillments := coalesce(item -> 'fulfillments', '[]'::jsonb);
    fulfillment_count := jsonb_array_length(fulfillments);
    resolved_emergency_reason_key := nullif(item ->> 'emergency_reason_key', '');

    if fulfillment_count > 0 then
      if resolved_emergency_reason_key is not null then
        raise exception 'An item cannot have both Store Purchase Request fulfillments and an Emergency Reason'
          using detail = 'FULFILLMENT_CONFLICT';
      end if;

      fulfilled_total := 0;
      for fulfillment in select * from jsonb_array_elements(fulfillments)
      loop
        resolved_spr_item_id := (fulfillment ->> 'store_purchase_request_item_id')::uuid;
        if not exists (select 1 from store_purchase_request_items where id = resolved_spr_item_id) then
          raise exception 'Store Purchase Request Item % does not exist', resolved_spr_item_id
            using detail = 'STORE_PURCHASE_REQUEST_ITEM_NOT_FOUND';
        end if;

        fulfilled_total := fulfilled_total + (fulfillment ->> 'fulfilled_quantity')::numeric;
      end loop;

      if fulfilled_total > (item ->> 'quantity_ordered')::numeric then
        raise exception 'Product % fulfillments (%) exceed the quantity purchased (%)',
          item ->> 'product_id', fulfilled_total, item ->> 'quantity_ordered'
          using detail = 'FULFILLMENT_EXCEEDS_PURCHASED';
      end if;
    else
      if resolved_emergency_reason_key is null then
        raise exception 'An Emergency Reason is required when no Store Purchase Request Item is selected'
          using detail = 'EMERGENCY_REASON_REQUIRED';
      end if;
      if not exists (
        select 1 from emergency_reason_definitions where key = resolved_emergency_reason_key and is_active
      ) then
        raise exception 'Emergency Reason % does not exist or is not active', resolved_emergency_reason_key
          using detail = 'EMERGENCY_REASON_INVALID';
      end if;
    end if;
  end loop;

  -- ============================================================
  -- WRITE PHASE -- every item above has already passed every check; nothing here raises a
  -- business-validation exception. Product name, purchase unit, and purchase unit spec are
  -- re-resolved (not cached from the validation loop) -- read current truth at write time, same
  -- principle used throughout this project.
  -- ============================================================

  select id into caller_staff_id from staff_profiles where user_id = auth.uid();

  insert into purchase_orders (store_id, supplier_id, supplier_name, created_by, notes, idempotency_key)
  values (target_store_id, target_supplier_id, resolved_supplier_name, caller_staff_id, nullif(target_notes, ''), provided_idempotency_key)
  returning id into new_order_id;

  for item in select * from jsonb_array_elements(target_items)
  loop
    select p.name into resolved_product_name
    from products p
    where p.id = (item ->> 'product_id')::uuid;

    select sp.purchase_unit, sp.purchase_unit_spec
    into resolved_purchase_unit, resolved_purchase_unit_spec
    from supplier_products sp
    where sp.id = (item ->> 'supplier_product_id')::uuid;

    fulfillments := coalesce(item -> 'fulfillments', '[]'::jsonb);
    fulfillment_count := jsonb_array_length(fulfillments);
    resolved_emergency_reason_key := nullif(item ->> 'emergency_reason_key', '');

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
      for fulfillment in select * from jsonb_array_elements(fulfillments)
      loop
        insert into purchase_order_item_fulfillments (
          purchase_order_item_id, store_purchase_request_item_id, fulfilled_quantity
        )
        values (
          new_item_id,
          (fulfillment ->> 'store_purchase_request_item_id')::uuid,
          (fulfillment ->> 'fulfilled_quantity')::numeric
        );
      end loop;
    end if;
  end loop;

  return new_order_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Grant hygiene applied from the start (migration 030's lesson), same as migration 031.
revoke execute on function create_purchase_order(uuid, uuid, text, jsonb, uuid) from public;
grant execute on function create_purchase_order(uuid, uuid, text, jsonb, uuid) to authenticated;
