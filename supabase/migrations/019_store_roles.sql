-- Store Operational Capabilities redesign (business design approved 2026-07-11, across four
-- review rounds). Three layers, three owners:
--   Layer 1 Store Roles          -- business identity, Administrator-assigned, many-to-many
--   Layer 2 Derived Capabilities -- automatic, read-only, always in sync with Roles
--   Layer 3 Operational Status   -- Administrator-controlled, temporary, independent of identity
--
-- Store Roles use a normalized lookup + join pair (store_role_definitions / store_roles),
-- exactly mirroring permission_definitions/store_permissions from migration 012 -- not boolean
-- columns on `stores`, not an enum array. This project has already paid the enum-recreation cost
-- twice (store_type in 008, staff_role in 011); a lookup table means a future third Store Role
-- is a plain INSERT, no migration, no new columns on `stores` ever.
--
-- store_permissions/permission_definitions (012) are NOT replaced -- Layer 2 stays exactly
-- there. Layer 3 (Operational Status) is one new column: store_permissions.is_enabled. A
-- security-definer trigger on store_roles keeps store_permissions in sync automatically,
-- inserting newly-derived capabilities and removing no-longer-derivable ones, while never
-- touching is_enabled on a row that continues to exist -- a capability disabled for maintenance
-- must survive an unrelated role change on the same store.
--
-- Two additional business rules from the final approval round:
--   1. A Store must always have at least one Store Role -- enforced by a deferred constraint
--      trigger on store_roles (see below for the exact guarantee this provides).
--   2. Store Role Definitions are system master data and are not deletable -- enforced by
--      omitting a delete policy/grant entirely; retiring one is done via is_active = false.

-- ============================================================
-- LAYER 1: store_role_definitions (lookup) + store_roles (assignment)
-- ============================================================

create table store_role_definitions (
  key text primary key,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table store_role_definitions enable row level security;

create policy "staff can read store role definitions" on store_role_definitions for select
  using (is_active_staff());
create policy "administrators can insert store role definitions" on store_role_definitions for insert
  with check (is_administrator());
create policy "administrators can update store role definitions" on store_role_definitions for update
  using (is_administrator()) with check (is_administrator());

-- System master data -- deliberately no delete policy and no delete grant. Retiring a Store Role
-- is done via is_active = false (the same soft-delete convention used by every other Master Data
-- table), never a DELETE -- a hard delete would orphan any store_roles row still referencing it.
grant select, insert, update on public.store_role_definitions to authenticated;
revoke delete on public.store_role_definitions from authenticated;

-- Descriptions double as future help text/tooltips in the Roles tab.
insert into store_role_definitions (key, name, description, sort_order) values
  ('retail_store', 'Retail Store', 'Customer-facing store that sells directly to customers.', 1),
  ('production_center', 'Production Center', 'Central kitchen or production facility that supplies other stores.', 2);

create table store_roles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  role_key text not null references store_role_definitions(key) on delete restrict,
  created_at timestamptz not null default now(),
  unique (store_id, role_key)
);

create index store_roles_store_id_idx on store_roles(store_id);

alter table store_roles enable row level security;

create policy "staff can read store roles" on store_roles for select using (is_active_staff());
create policy "administrators can insert store roles" on store_roles for insert with check (is_administrator());
create policy "administrators can delete store roles" on store_roles for delete using (is_administrator());

grant select, insert, delete on public.store_roles to authenticated;

-- A Store must always have at least one Store Role -- enforced as a deferred constraint trigger
-- so a single transaction that removes one role and adds another (a Roles-tab "save" that swaps
-- the selection) is checked only once, at commit, rather than failing on the intermediate zero
-- state. This does not retroactively require a brand-new Store to already have a Role at the
-- instant `stores` is inserted -- Store creation and Role assignment are two separate PostgREST
-- requests under the approved Create -> Save -> Configure workflow (no create_store() RPC), so
-- that first request is necessarily a moment with zero roles. The guarantee this trigger actually
-- provides is the one the business rule is protecting against in practice: once a Store has a
-- Role, it can never be brought back down to zero. Because the check is deferred to commit, any
-- future UI that edits a Store's roles must submit the role changes as a single request (e.g. one
-- RPC, or a single statement) for a role-swap to be checked correctly -- two separate
-- delete-then-insert requests would each commit on their own and the delete alone would fail.
-- Guards only against a Store losing its last Role while it continues to exist. If the Store row
-- itself was deleted (its store_roles rows cascading away with it), skip the check entirely --
-- otherwise cascading a Store delete would itself trip "must have at least one Role" on the way
-- out.
create or replace function enforce_store_has_role() returns trigger as $$
begin
  if exists (select 1 from stores where id = old.store_id)
     and not exists (select 1 from store_roles where store_id = old.store_id) then
    raise exception 'A Store must have at least one Store Role';
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create constraint trigger store_roles_require_at_least_one
  after delete on store_roles
  deferrable initially deferred
  for each row execute function enforce_store_has_role();

-- ============================================================
-- LAYER 3: Operational Status column (added before the trigger exists, so every insert the
-- trigger makes -- including the backfill below -- already has it available)
-- ============================================================

alter table store_permissions add column is_enabled boolean not null default true;

-- ============================================================
-- LAYER 2: automatic derivation + sync trigger
-- ============================================================

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

create or replace function sync_store_permissions_from_roles() returns trigger as $$
declare
  target_store_id uuid;
  derived_keys text[];
begin
  target_store_id := coalesce(new.store_id, old.store_id);
  derived_keys := derive_store_permission_keys(target_store_id);

  -- insert newly derived capabilities only -- is_enabled defaults to true for genuinely new rows
  insert into store_permissions (store_id, permission_key)
  select target_store_id, key
  from unnest(derived_keys) as key
  where not exists (
    select 1 from store_permissions sp where sp.store_id = target_store_id and sp.permission_key = key
  );

  -- remove capabilities no longer derivable -- this only ever deletes rows that shouldn't exist
  -- at all anymore; rows that remain (still derivable) are never touched, so is_enabled survives
  delete from store_permissions
  where store_id = target_store_id
    and permission_key <> all(derived_keys);

  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger sync_store_permissions
  after insert or delete on store_roles
  for each row execute function sync_store_permissions_from_roles();

-- ============================================================
-- BACKFILL: migrate every existing store's single `type` value into store_roles. This also
-- exercises the trigger above for every existing store, which reconciles any store_permissions
-- rows left over from the old manual Capabilities UI against what the new derivation rule
-- actually produces -- the same mechanism that will handle every future Role change, running
-- once now as the correction pass.
-- ============================================================

insert into store_roles (store_id, role_key)
select id, type::text from stores;

-- ============================================================
-- Drop the old single-value Store Type column and enum -- safe now that every store's identity
-- has been migrated into store_roles above.
-- ============================================================

alter table stores drop column type;
drop type store_type;

-- ============================================================
-- Tighten store_has_operational_permission() to also require Operational Status -- same
-- signature, same callers (can_create_supply_request, can_manage_supply_request,
-- can_manage_stock_count from migrations 012/014), no other code changes. Every existing row
-- defaults is_enabled = true, so this is a no-op until an Administrator actually disables
-- something.
-- ============================================================

create or replace function store_has_operational_permission(target_store_id uuid, perm_key text) returns boolean as $$
  select exists (
    select 1 from store_permissions sp
    where sp.store_id = target_store_id and sp.permission_key = perm_key and sp.is_enabled
  );
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- store_permissions: manual grant/revoke (012) no longer applies -- only the trigger inserts/
-- deletes rows now. The one remaining manual write is toggling is_enabled.
-- ============================================================

drop policy if exists "administrators can grant store permissions" on store_permissions;
drop policy if exists "administrators can revoke store permissions" on store_permissions;

create policy "administrators can update store permission status" on store_permissions for update
  using (is_administrator()) with check (is_administrator());

revoke insert, delete on public.store_permissions from authenticated;
grant update on public.store_permissions to authenticated;
