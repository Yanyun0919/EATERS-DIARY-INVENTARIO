-- update_store_purchase_request() -- first RPC of the Store Purchase Request lifecycle
-- implementation phase, per the frozen RPC Contract Design
-- (docs/architecture/supply-fulfillment-rpc-contracts.md). Implements Execution Lock's pre-lock
-- editable phase: the client always submits the complete current state of a request; the
-- server treats it as authoritative and performs one atomic full diff. An empty submission is
-- valid input, not an error -- it cancels the request outright (hard delete, not a stored
-- status -- justified because a pre-lock request is not yet a Business Record, per
-- BUSINESS_RULES.md's Execution Lock Principle).

-- ============================================================
-- PRE-CHECK: the full-diff upsert below needs a unique constraint on
-- (store_purchase_request_id, product_id) to work correctly -- and it's a genuine data-quality
-- improvement independent of that: two separate line items for the same product in one request
-- would always be a bug, never a legitimate state. submit_store_purchase_request() (migration
-- 026) never validated against a caller submitting the same product twice, so verifying no
-- existing duplicate exists before constraining it, rather than assuming.
-- ============================================================

do $$
declare
  duplicate_count integer;
begin
  select count(*) into duplicate_count
  from (
    select store_purchase_request_id, product_id
    from store_purchase_request_items
    group by store_purchase_request_id, product_id
    having count(*) > 1
  ) dupes;

  if duplicate_count > 0 then
    raise exception
      'Migration 029 pre-check failed: % store_purchase_request(s) have more than one item row for the same product. These must be resolved (merged or one removed) before this constraint can be added. Migration aborted, no changes made.',
      duplicate_count;
  end if;
end $$;

alter table store_purchase_request_items
  add constraint store_purchase_request_items_request_product_key unique (store_purchase_request_id, product_id);

-- ============================================================
-- update_store_purchase_request(target_request_id, target_items)
-- Validation sequence, exactly per the frozen contract:
--   1. Request exists                                    -> REQUEST_NOT_FOUND
--   2. Caller authorized for the request's own store      -> UNAUTHORIZED
--   3. Lock check (any fulfillment against any item)      -> REQUEST_LOCKED
--      -- applies identically whether target_items is empty or not: "no modification, no
--      -- deletion, no cancellation" is one rule after lock, not three.
--   4. Empty target_items -> cancel (hard delete), return early.
--   5. Each product exists                                -> PRODUCT_NOT_FOUND
--   Then: full diff -- delete items no longer present, upsert every submitted item.
--
-- No idempotency_key -- full-replace semantics make this RPC safe by construction (frozen
-- contract, confirmed): resubmitting the same target_items twice changes nothing the second
-- time, and retrying a cancellation against an already-deleted request simply fails
-- REQUEST_NOT_FOUND, not a duplicate deletion.
--
-- Error codes ride in the exception DETAIL field, never MESSAGE -- the client switches on
-- error.details, per the frozen contract's error code mechanism.
-- ============================================================

create or replace function update_store_purchase_request(
  target_request_id uuid,
  target_items jsonb
) returns uuid as $$
declare
  resolved_store_id uuid;
  is_locked boolean;
  item jsonb;
  resolved_product_name text;
  target_product_ids uuid[];
begin
  select store_id into resolved_store_id from store_purchase_requests where id = target_request_id;
  if resolved_store_id is null then
    raise exception 'Store Purchase Request % does not exist', target_request_id
      using detail = 'REQUEST_NOT_FOUND';
  end if;

  if not can_submit_store_purchase_request(resolved_store_id) then
    raise exception 'Not authorized to update this Store Purchase Request'
      using detail = 'UNAUTHORIZED';
  end if;

  select exists (
    select 1
    from store_purchase_request_items spri
    join purchase_order_item_fulfillments poif on poif.store_purchase_request_item_id = spri.id
    where spri.store_purchase_request_id = target_request_id
  ) into is_locked;

  if is_locked then
    raise exception 'Store Purchase Request % is locked and can no longer be modified', target_request_id
      using detail = 'REQUEST_LOCKED';
  end if;

  -- Empty submission -- cancellation path. Items cascade away via the existing FK
  -- (store_purchase_request_items.store_purchase_request_id references ... on delete cascade,
  -- migration 026); no separate item-deletion statement needed.
  if target_items is null or jsonb_array_length(target_items) = 0 then
    delete from store_purchase_requests where id = target_request_id;
    return target_request_id;
  end if;

  -- Validate every product exists before writing anything -- if any is invalid, the exception
  -- aborts the whole transaction before the delete/upsert below ever runs.
  for item in select * from jsonb_array_elements(target_items)
  loop
    if not exists (select 1 from products p where p.id = (item ->> 'product_id')::uuid) then
      raise exception 'Product % does not exist', item ->> 'product_id'
        using detail = 'PRODUCT_NOT_FOUND';
    end if;
  end loop;

  target_product_ids := array(
    select (elem ->> 'product_id')::uuid from jsonb_array_elements(target_items) elem
  );

  -- Full diff, part 1: remove items no longer present in the submitted set.
  delete from store_purchase_request_items
  where store_purchase_request_id = target_request_id
    and product_id <> all(target_product_ids);

  -- Full diff, part 2: insert new items, update existing ones -- product_name is re-resolved
  -- from current data on every call, same "read current truth inside the transaction" principle
  -- already used throughout this project's other RPCs.
  for item in select * from jsonb_array_elements(target_items)
  loop
    select p.name into resolved_product_name from products p where p.id = (item ->> 'product_id')::uuid;

    insert into store_purchase_request_items (
      store_purchase_request_id, product_id, product_name, requested_quantity, is_high_priority
    )
    values (
      target_request_id,
      (item ->> 'product_id')::uuid,
      resolved_product_name,
      (item ->> 'requested_quantity')::numeric,
      coalesce((item ->> 'is_high_priority')::boolean, false)
    )
    on conflict (store_purchase_request_id, product_id)
    do update set
      requested_quantity = excluded.requested_quantity,
      is_high_priority = excluded.is_high_priority,
      product_name = excluded.product_name;
  end loop;

  return target_request_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function update_store_purchase_request(uuid, jsonb) to authenticated;
