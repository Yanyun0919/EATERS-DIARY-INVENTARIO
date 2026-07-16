-- submit_store_purchase_request() -- second RPC of the Store Purchase Request lifecycle
-- implementation phase, per the frozen RPC Contract Design
-- (docs/architecture/supply-fulfillment-rpc-contracts.md). The only behavioral change from the
-- existing implementation (migrations 026/027) is idempotency: a required idempotency_key,
-- checked immediately after authorization, so a retried call (network timeout, browser retry,
-- duplicate submission) returns the original request's id instead of creating a duplicate.
--
-- Schema consequence, already flagged in the frozen API design document, not a new discovery:
-- store_purchase_requests gains a uniquely-constrained idempotency_key column. Nullable --
-- existing rows predate idempotency tracking entirely; there is no value to backfill for a
-- request that already succeeded and will never be retried (same reasoning already applied to
-- products.supply_source_id in migration 025).

-- ============================================================
-- PRE-CHECK, per the defensive pattern established in Migrations 028-030: verify every
-- prerequisite object is in the exact expected state before performing any destructive or
-- structural change. Two things must both be true, or this migration has already run (or a
-- prior migration is missing) and continuing would corrupt state rather than fix it.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'store_purchase_requests' and column_name = 'idempotency_key'
  ) then
    raise exception
      'Migration 031 pre-check failed: store_purchase_requests.idempotency_key already exists. This migration may have already been applied. Migration aborted, no changes made.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_store_purchase_request'
      and pg_get_function_identity_arguments(p.oid) = 'target_store_id uuid, target_notes text, target_items jsonb'
  ) then
    raise exception
      'Migration 031 pre-check failed: expected function submit_store_purchase_request(uuid, text, jsonb) was not found. Either this migration has already been applied, or the function is not in the state this migration expects. Migration aborted, no changes made.';
  end if;
end $$;

alter table store_purchase_requests add column idempotency_key uuid;
alter table store_purchase_requests add constraint store_purchase_requests_idempotency_key_key unique (idempotency_key);

-- ============================================================
-- The frozen contract adds a 4th parameter to a function that currently has 3
-- (target_store_id uuid, target_notes text, target_items jsonb). CREATE OR REPLACE only
-- replaces a function with an identical signature -- with a parameter added, it would create a
-- second, overloaded version alongside the old one, leaving the old (idempotency-unsafe)
-- signature still callable. Dropping it explicitly first. No internal dependents exist -- this
-- is a leaf RPC, only ever called from the client via PostgREST, confirmed by reading every
-- migration that references it (026, 027), not assumed.
-- ============================================================

drop function submit_store_purchase_request(uuid, text, jsonb);

-- ============================================================
-- submit_store_purchase_request(target_store_id, target_notes, target_items, idempotency_key)
-- Validation sequence, exactly per the frozen contract:
--   1. Caller authorized                                   -> UNAUTHORIZED
--   2. Idempotency check -- return existing id on match, no error, no new write
--   3. target_items non-empty                               -> EMPTY_ITEMS
--   4. Each product exists                                  -> PRODUCT_NOT_FOUND
--
-- The parameter is assigned to a local variable immediately -- `idempotency_key` as a bare
-- parameter name would be ambiguous inside any query touching the identically-named column on
-- store_purchase_requests. This same pattern applies to every RPC in this module that takes an
-- idempotency_key, for consistency.
-- ============================================================

create or replace function submit_store_purchase_request(
  target_store_id uuid,
  target_notes text,
  target_items jsonb,
  idempotency_key uuid
) returns uuid as $$
declare
  provided_idempotency_key uuid := idempotency_key;
  existing_request_id uuid;
  new_request_id uuid;
  caller_staff_id uuid;
  item jsonb;
  resolved_product_name text;
begin
  if not can_submit_store_purchase_request(target_store_id) then
    raise exception 'Not authorized to submit a Store Purchase Request for this store'
      using detail = 'UNAUTHORIZED';
  end if;

  select id into existing_request_id
  from store_purchase_requests
  where store_purchase_requests.idempotency_key = provided_idempotency_key;

  if existing_request_id is not null then
    return existing_request_id;
  end if;

  if target_items is null or jsonb_array_length(target_items) = 0 then
    raise exception 'A Store Purchase Request must have at least one item'
      using detail = 'EMPTY_ITEMS';
  end if;

  -- Validate every product exists before writing anything.
  for item in select * from jsonb_array_elements(target_items)
  loop
    if not exists (select 1 from products p where p.id = (item ->> 'product_id')::uuid) then
      raise exception 'Product % does not exist', item ->> 'product_id'
        using detail = 'PRODUCT_NOT_FOUND';
    end if;
  end loop;

  select id into caller_staff_id from staff_profiles where user_id = auth.uid();

  insert into store_purchase_requests (store_id, submitted_by, notes, idempotency_key)
  values (target_store_id, caller_staff_id, nullif(target_notes, ''), provided_idempotency_key)
  returning id into new_request_id;

  for item in select * from jsonb_array_elements(target_items)
  loop
    select p.name into resolved_product_name from products p where p.id = (item ->> 'product_id')::uuid;

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

-- Grant hygiene applied from the start this time (migration 030's lesson), not left as a gap to
-- close later.
revoke execute on function submit_store_purchase_request(uuid, text, jsonb, uuid) from public;
grant execute on function submit_store_purchase_request(uuid, text, jsonb, uuid) to authenticated;
