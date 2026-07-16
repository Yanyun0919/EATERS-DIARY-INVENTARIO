-- submit_store_goods_receipt() -- fourth and final RPC of the Store Purchase Request lifecycle
-- implementation phase, per the frozen RPC Contract Design
-- (docs/architecture/supply-fulfillment-rpc-contracts.md). Same two changes as
-- create_purchase_order() (migration 032):
--
--   1. Idempotency: a required idempotency_key, checked immediately after authorization.
--   2. Stable error codes: every raise exception now carries a `using detail = 'CODE'` from the
--      frozen contract's closed error-code set -- the existing implementation (migration 027)
--      used free-text messages only.
--
-- Plus the structural convention this project settled into for create_purchase_order()
-- (migration 032, refactored after review): validate everything first, in one pass over
-- target_items with no writes, before the write phase begins. The prior implementation inserted
-- the store_goods_receipts header immediately after authorization, then interleaved per-item
-- validation with per-item writes -- transactionally safe, but inconsistent with the
-- validate-first convention now applied uniformly across every write RPC in this module.
--
-- store_goods_receipts is the header table for this RPC's idempotency key. Each call creates
-- exactly one store_goods_receipts row (one delivery event against one Purchase Order), so a
-- plain unique(idempotency_key) constraint is correct -- same shape as
-- submit_store_purchase_request() (031) and create_purchase_order() (032), no composite
-- constraint needed (that need only arose from create_purchase_order()'s earlier, since-reverted
-- multi-store design).

-- ============================================================
-- PRE-CHECK, per the defensive pattern established in Migrations 028-032.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'store_goods_receipts' and column_name = 'idempotency_key'
  ) then
    raise exception
      'Migration 033 pre-check failed: store_goods_receipts.idempotency_key already exists. This migration may have already been applied. Migration aborted, no changes made.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_store_goods_receipt'
      and pg_get_function_identity_arguments(p.oid) = 'target_purchase_order_id uuid, target_items jsonb'
  ) then
    raise exception
      'Migration 033 pre-check failed: expected function submit_store_goods_receipt(uuid, jsonb) was not found. Either this migration has already been applied, or the function is not in the state this migration expects. Migration aborted, no changes made.';
  end if;
end $$;

alter table store_goods_receipts add column idempotency_key uuid;
alter table store_goods_receipts add constraint store_goods_receipts_idempotency_key_key unique (idempotency_key);

-- Old 2-parameter signature must be dropped explicitly before the new 3-parameter version is
-- created -- CREATE OR REPLACE only replaces a function with an identical signature; adding a
-- parameter would otherwise leave the old (idempotency-unsafe) signature callable as an overload.
drop function submit_store_goods_receipt(uuid, jsonb);

-- ============================================================
-- submit_store_goods_receipt(target_purchase_order_id, target_items, idempotency_key)
--
-- Validation sequence, exactly per the frozen contract (all of it runs before any write):
--   1. Purchase Order exists                                       -> PURCHASE_ORDER_NOT_FOUND
--   2. Caller authorized against the order's own store_id           -> UNAUTHORIZED
--   3. Idempotency check -- return existing id on match, no error, no new write
--   4. target_items non-empty                                      -> EMPTY_ITEMS
--   5. Per item: purchase_order_item_id exists                      -> PURCHASE_ORDER_ITEM_NOT_FOUND
--      purchase_order_item_id belongs to target_purchase_order_id   -> PURCHASE_ORDER_ITEM_MISMATCH
--
-- Write phase, only after every item above has passed every check:
--   6. Insert Store Goods Receipt header.
--   7. Per item: insert Store Goods Receipt Item.
--   8. Return the new Store Goods Receipt id.
--
-- received_quantity's own non-negativity is enforced by the existing table check constraint
-- (store_goods_receipt_items, migration 027: check (received_quantity >= 0)) -- not re-validated
-- here, and not part of the frozen contract's error code set for this RPC.
--
-- No Execution Lock check -- Goods Receipt is independent of Store Purchase Request locking
-- (Supply Fulfillment Design, Goods Receipt independence). By the time a Purchase Order Item
-- exists to receive against, its originating request (if any) is already locked; this RPC never
-- reads or depends on that state.
-- ============================================================

create or replace function submit_store_goods_receipt(
  target_purchase_order_id uuid,
  target_items jsonb,
  idempotency_key uuid
) returns uuid as $$
declare
  provided_idempotency_key uuid := idempotency_key;
  resolved_store_id uuid;
  existing_receipt_id uuid;
  new_receipt_id uuid;
  caller_staff_id uuid;
  item jsonb;
  item_purchase_order_id uuid;
begin
  -- ============================================================
  -- VALIDATION PHASE -- no writes below this point until the phase completes successfully.
  -- ============================================================

  select store_id into resolved_store_id from purchase_orders where id = target_purchase_order_id;
  if resolved_store_id is null then
    raise exception 'Purchase Order % does not exist', target_purchase_order_id
      using detail = 'PURCHASE_ORDER_NOT_FOUND';
  end if;

  if not can_submit_store_purchase_request(resolved_store_id) then
    raise exception 'Not authorized to record a Store Goods Receipt for this store'
      using detail = 'UNAUTHORIZED';
  end if;

  select id into existing_receipt_id
  from store_goods_receipts
  where store_goods_receipts.idempotency_key = provided_idempotency_key;

  if existing_receipt_id is not null then
    return existing_receipt_id;
  end if;

  if target_items is null or jsonb_array_length(target_items) = 0 then
    raise exception 'A Store Goods Receipt must have at least one item'
      using detail = 'EMPTY_ITEMS';
  end if;

  for item in select * from jsonb_array_elements(target_items)
  loop
    select poi.purchase_order_id into item_purchase_order_id
    from purchase_order_items poi
    where poi.id = (item ->> 'purchase_order_item_id')::uuid;

    if item_purchase_order_id is null then
      raise exception 'Purchase Order Item % does not exist', item ->> 'purchase_order_item_id'
        using detail = 'PURCHASE_ORDER_ITEM_NOT_FOUND';
    end if;
    if item_purchase_order_id <> target_purchase_order_id then
      raise exception 'Purchase Order Item % does not belong to Purchase Order %',
        item ->> 'purchase_order_item_id', target_purchase_order_id
        using detail = 'PURCHASE_ORDER_ITEM_MISMATCH';
    end if;
  end loop;

  -- ============================================================
  -- WRITE PHASE -- every item above has already passed every check; nothing here raises a
  -- business-validation exception.
  -- ============================================================

  select id into caller_staff_id from staff_profiles where user_id = auth.uid();

  insert into store_goods_receipts (purchase_order_id, received_by, idempotency_key)
  values (target_purchase_order_id, caller_staff_id, provided_idempotency_key)
  returning id into new_receipt_id;

  for item in select * from jsonb_array_elements(target_items)
  loop
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

-- Grant hygiene applied from the start (migration 030's lesson), same as migrations 031-032.
revoke execute on function submit_store_goods_receipt(uuid, jsonb, uuid) from public;
grant execute on function submit_store_goods_receipt(uuid, jsonb, uuid) to authenticated;
