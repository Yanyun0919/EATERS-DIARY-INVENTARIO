-- Store Purchase Request -- Technical Design approved 2026-07-13 (two review rounds), frozen
-- Business Architecture Rules 1-10. Represents demand only -- a Store Purchase Request is NOT
-- a Purchase Order (Rule 8), and is never updated by anything (immutable once submitted, same
-- posture as purchase_orders).
--
-- The Draft stage (Current Stock vs Minimum Stock, manual overrides/removals/additions) is
-- deliberately NOT modeled here at all -- it stays exactly what today's Purchase Suggestions
-- module already is: a live, non-persisted computation (Rule 9 -- no event has happened yet).
-- submit_store_purchase_request() is the only write path, and the only moment a Store Purchase
-- Request comes into existence -- one function, one transaction, same design philosophy as
-- create_purchase_order() (migration 017) and complete_stock_count() (migration 014).
--
-- product_name is snapshotted (protects history from a later product rename), matching every
-- other Business Record in this project. Supply Source and unit are deliberately NOT
-- snapshotted -- Supply Source grouping is a live view over the product's current
-- classification (approved architecture: "an automatic grouped view... rather than a new
-- persistent business record"), and requested_quantity is denominated in the product's base
-- (Inventory) unit, which this module treats as live/current, same precedent as Stock Count
-- Items (which never snapshot base_unit_id either).
--
-- No display_order column -- ordering is computed live (Category Order, then Product Name),
-- the same deterministic rule already used by Stock Count's counting list and today's Purchase
-- Suggestions table (BUSINESS_RULES.md #4). No new ordering concept introduced.

create table store_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete restrict,
  submitted_by uuid references staff_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index store_purchase_requests_store_id_idx on store_purchase_requests(store_id);

create table store_purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  store_purchase_request_id uuid not null references store_purchase_requests(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  product_name text not null,
  requested_quantity numeric(14, 4) not null check (requested_quantity > 0),
  created_at timestamptz not null default now()
);

create index store_purchase_request_items_request_id_idx on store_purchase_request_items(store_purchase_request_id);
create index store_purchase_request_items_product_id_idx on store_purchase_request_items(product_id);

alter table store_purchase_requests enable row level security;
alter table store_purchase_request_items enable row level security;

-- ============================================================
-- PERMISSIONS -- store-scoped, not System-Role-based (approved revision). Enforcement goes
-- through the existing store_permissions / store_has_operational_permission() mechanism
-- (migration 019), the same primitive already governing Stock Count and Internal Supply --
-- not a new pattern.
-- ============================================================

insert into permission_definitions (key, module, name, description, sort_order) values
  ('store_purchase_request', 'Solicitud de Compra', 'Solicitud de Compra',
   'Permite a este local crear y enviar Solicitudes de Compra para reponer stock.', 4);

-- Extends the existing derivation function (Layer 2) -- CREATE OR REPLACE, not a new function,
-- so every existing caller/trigger picks this up automatically. 'store_purchase_request' is
-- derived for the same Store Role ('retail_store') that already derives
-- 'internal_supply_request' -- stores request supply, they don't fulfill it internally.
create or replace function derive_store_permission_keys(target_store_id uuid) returns text[] as $$
declare
  has_retail boolean;
  has_production boolean;
  keys text[] := '{}';
begin
  select exists (
    select 1 from store_roles where store_id = target_store_id and role_key = 'retail_store'
  ) into has_retail;
  select exists (
    select 1 from store_roles where store_id = target_store_id and role_key = 'production_center'
  ) into has_production;

  if has_retail then
    keys := array_append(keys, 'internal_supply_request');
    keys := array_append(keys, 'store_purchase_request');
  end if;
  if has_production then
    keys := array_append(keys, 'internal_supply_fulfillment');
  end if;
  if has_retail or has_production then
    keys := array_append(keys, 'stock_count');
  end if;

  return keys;
end;
$$ language plpgsql stable security definer set search_path = public;

-- Backfill: redefining the derivation function does not retroactively re-run the migration
-- 019 sync trigger for stores that already hold 'retail_store' -- the trigger only fires on
-- store_roles insert/delete. Reconciling existing stores now, same shape as migration 019's
-- own backfill, scoped to exactly the one new key. is_enabled defaults to true for these new
-- rows, same as every other newly-derived capability.
insert into store_permissions (store_id, permission_key)
select sr.store_id, 'store_purchase_request'
from store_roles sr
where sr.role_key = 'retail_store'
  and not exists (
    select 1 from store_permissions sp
    where sp.store_id = sr.store_id and sp.permission_key = 'store_purchase_request'
  );

-- Enforcement function -- same naming/shape convention as can_manage_stock_count,
-- can_create_supply_request. store_has_operational_permission() already checks is_enabled
-- (Layer 3, tightened by migration 019) -- reused as-is, not redefined.
create or replace function can_submit_store_purchase_request(target_store_id uuid) returns boolean as $$
  select is_administrator()
    or store_has_operational_permission(target_store_id, 'store_purchase_request');
$$ language sql stable security definer set search_path = public;

-- Read: broader than write, same precedent as Internal Supply Requests -- store access is
-- about being assigned to that store, not about whether submission is currently enabled there.
-- Administrator and the Purchasing role (needs visibility to eventually fulfill this demand)
-- see every store; a store-assigned account sees its own store's history.
create policy "read access can view store purchase requests" on store_purchase_requests for select
  using (is_administrator() or can_manage_purchasing() or has_store_access(store_id));

create policy "read access can view store purchase request items" on store_purchase_request_items for select
  using (
    is_administrator() or can_manage_purchasing()
    or exists (
      select 1 from store_purchase_requests spr
      where spr.id = store_purchase_request_id and has_store_access(spr.store_id)
    )
  );

-- No insert/update/delete policy on either table -- submit_store_purchase_request() is the
-- sole write path (security definer, bypasses RLS as its own owner, same as
-- create_purchase_order()). Immutable once submitted: no update, no delete, anywhere.
grant select on public.store_purchase_requests to authenticated;
grant select on public.store_purchase_request_items to authenticated;

-- ============================================================
-- submit_store_purchase_request() -- the sole write path. One function, one transaction, same
-- design philosophy as create_purchase_order() (017) and complete_stock_count() (014):
-- resolves product_name from current data inside the transaction rather than trusting a
-- client-supplied snapshot, rejects an empty item list, authorization checked first.
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
      store_purchase_request_id, product_id, product_name, requested_quantity
    )
    values (
      new_request_id,
      (item ->> 'product_id')::uuid,
      resolved_product_name,
      (item ->> 'requested_quantity')::numeric
    );
  end loop;

  return new_request_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function submit_store_purchase_request(uuid, text, jsonb) to authenticated;
