-- Permission Model Correction: Master Data belongs to Administrators only; operational
-- capabilities (Internal Supply Request, Internal Supply Fulfillment, Stock Count) belong to
-- STORES, not to individual login accounts or roles.
--
-- A login account is just a way to access the system. An Administrator creates accounts,
-- assigns each to one or more stores (staff_stores, already many-to-many since migration 001 —
-- correctly supports one store with multiple accounts, and staff replacement without touching
-- business permissions), and configures each store's capabilities independently
-- (store_permissions below). An account's effective capability at a given store is entirely
-- inherited from that store's configuration — never owned by the account itself.
--
-- Permission keys are a lookup table (permission_definitions), not a Postgres enum -- this
-- project has already hit the enum-recreation cost twice this session (store_type in 008,
-- staff_role in 011: rename column, create new type, migrate data, swap). A table lets new
-- permissions, renames, and disables happen via plain INSERT/UPDATE, no migration, ever.
-- `module` is a plain text grouping label (not its own table) since the module set is the
-- already-frozen 7-module V1 architecture -- a far more stable vocabulary than individual
-- permission keys, so a third table here would be over-engineering a rarely-changing label.
--
-- staff_profiles.role's retail_store/production_center values remain (avoiding another
-- enum-recreation migration on an already-applied type) but are now purely descriptive/default
-- labels -- no permission check in this migration reads current_staff_role() for Internal
-- Supply. Every capability is an explicit per-store grant, nothing is implied by role.
--
-- Mechanics: 002/011 are already applied and untouched. is_active_staff_writer() and
-- is_internal_products_writer() are CREATE OR REPLACEd (not renamed) so every existing policy
-- that already calls them by name inherits the tightened logic automatically. Both are now
-- pure aliases for is_administrator().

create or replace function is_active_staff_writer() returns boolean as $$
  select is_administrator();
$$ language sql stable security definer set search_path = public;

create or replace function is_internal_products_writer() returns boolean as $$
  select is_administrator();
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- STORE-LEVEL OPERATIONAL PERMISSIONS
-- ============================================================

create table permission_definitions (
  key text primary key,
  module text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table permission_definitions enable row level security;

create policy "staff can read permission definitions" on permission_definitions for select using (is_active_staff());
create policy "administrators can insert permission definitions" on permission_definitions for insert with check (is_administrator());
create policy "administrators can update permission definitions" on permission_definitions for update using (is_administrator()) with check (is_administrator());

grant select, insert, update on public.permission_definitions to authenticated;

insert into permission_definitions (key, module, name, description, sort_order) values
  ('internal_supply_request', 'Internal Supply', 'Internal Supply Request', 'Allows this store to create Internal Supply requests to another store.', 1),
  ('internal_supply_fulfillment', 'Internal Supply', 'Internal Supply Fulfillment', 'Allows this store to accept, prepare, and ship Internal Supply requests from other stores.', 2),
  ('stock_count', 'Inventory', 'Stock Count', 'Allows this store to perform physical stock counts.', 3);

create table store_permissions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  permission_key text not null references permission_definitions(key) on delete restrict,
  granted_by uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, permission_key)
);

create index store_permissions_store_id_idx on store_permissions(store_id);

alter table store_permissions enable row level security;

create policy "staff can read store permissions" on store_permissions for select using (is_active_staff());
create policy "administrators can grant store permissions" on store_permissions for insert with check (is_administrator());
create policy "administrators can revoke store permissions" on store_permissions for delete using (is_administrator());

grant select, insert, delete on public.store_permissions to authenticated;

-- pure lookup: does THIS STORE have THIS PERMISSION, independent of who's asking
create or replace function store_has_operational_permission(target_store_id uuid, perm_key text) returns boolean as $$
  select exists (select 1 from store_permissions sp where sp.store_id = target_store_id and sp.permission_key = perm_key);
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- INTERNAL SUPPLY: store-capability-driven write access + Pending-only cancel
--
-- Business workflow:
--   Pending    -> the requesting store's account may cancel (pending -> cancelled only).
--   Preparing  -> no longer cancellable/editable by the requesting store.
--   Shipped    -> read-only for everyone except Administrator.
--   Cancelled  -> read-only for everyone except Administrator.
--
-- An account can create a request only if BOTH true: (1) it's assigned to the destination
-- store (has_store_access, i.e. this login can act for that store) and (2) that store has
-- been granted 'internal_supply_request'. Same shape for fulfillment against the origin
-- store. This is what makes CCC Amparo/MR.SANDO (both request+fulfillment) and Lavapiés
-- (request only) behave differently through configuration, not through account role.
--
-- SELECT policies from 011 are untouched -- both parties still need to see requests touching
-- their store regardless of status. Only the underlying functions INSERT/UPDATE rely on change.
-- ============================================================

create or replace function can_create_supply_request(target_to_store_id uuid) returns boolean as $$
  select is_administrator()
    or (has_store_access(target_to_store_id) and store_has_operational_permission(target_to_store_id, 'internal_supply_request'));
$$ language sql stable security definer set search_path = public;

create or replace function can_manage_supply_request(target_from_store_id uuid) returns boolean as $$
  select is_administrator()
    or (has_store_access(target_from_store_id) and store_has_operational_permission(target_from_store_id, 'internal_supply_fulfillment'));
$$ language sql stable security definer set search_path = public;

create or replace function can_create_supply_item(request_id uuid) returns boolean as $$
  select exists (
    select 1 from internal_supply_requests r
    where r.id = request_id and can_create_supply_request(r.to_store_id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function can_manage_supply_item(request_id uuid) returns boolean as $$
  select exists (
    select 1 from internal_supply_requests r
    where r.id = request_id and can_manage_supply_request(r.from_store_id)
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "internal supply roles can insert requests" on internal_supply_requests;
drop policy if exists "internal supply roles can update requests" on internal_supply_requests;

create policy "stores can create supply requests" on internal_supply_requests for insert
  with check (can_create_supply_request(to_store_id));

-- USING checks the OLD row (must be pending, must be the requesting store's own account);
-- WITH CHECK checks the NEW row (must land on cancelled, nothing else) -- together this allows
-- exactly one transition, pending -> cancelled, and nothing more.
create policy "requesting store can cancel pending supply requests" on internal_supply_requests for update
  using (status = 'pending' and can_create_supply_request(to_store_id))
  with check (status = 'cancelled' and can_create_supply_request(to_store_id));

create policy "fulfilling store can manage supply requests" on internal_supply_requests for update
  using (can_manage_supply_request(from_store_id))
  with check (can_manage_supply_request(from_store_id));

drop policy if exists "internal supply roles can insert items" on internal_supply_items;
drop policy if exists "internal supply roles can update items" on internal_supply_items;

create policy "stores can create supply items" on internal_supply_items for insert
  with check (can_create_supply_item(internal_supply_request_id));

create policy "fulfilling store can manage supply items" on internal_supply_items for update
  using (can_manage_supply_item(internal_supply_request_id))
  with check (can_manage_supply_item(internal_supply_request_id));
