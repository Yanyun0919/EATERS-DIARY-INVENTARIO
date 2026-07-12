-- Staff Management (Personal) module -- business design approved across several rounds
-- (2026-07-12/13). Three layers owned by this module:
--   1. System Role       (staff_profiles.role)              -- who the employee is
--   2. Staff Permissions  (staff_permission_definitions/staff_permissions) -- which modules
--      they may open
--   3. Locale Access      (staff_stores, unchanged schema)   -- which Locales they may access
-- Layers 4-5 (Store Role / Operational Permissions, migration 019) are untouched -- Store Role
-- belongs to the Local, not the employee, and stays that way.
--
-- Administrator is the one hardcoded exception throughout: never governed by Staff Permissions,
-- always has unrestricted access. Every function below composes `is_administrator() or
-- has_staff_permission('key')` explicitly at each call site rather than baking the admin bypass
-- into has_staff_permission() itself -- matches the existing convention (`is_administrator() or
-- has_store_access(...)`) instead of hiding it.
--
-- V1.0 explicitly keeps the whole Personal module (create/edit staff, assign roles, assign
-- permissions, assign Locales) Administrator-only -- no delegation yet. The `users` permission
-- key is seeded but inactive so turning delegation on later is a policy + is_active flip, no new
-- migration -- same "define now, wire in later" pattern already used for
-- internal_supply_request/fulfillment since migration 012.
--
-- This migration also reopens a restriction migration 012 deliberately introduced ("Master Data
-- belongs to Administrators only") -- Products/Categories/Suppliers/Locales become assignable
-- Staff Permissions. That reversal is intentional, confirmed explicitly across the design
-- review, not an oversight.
--
-- DEPENDENCY NOTE (why this file is ordered the way it is): current_staff_role() returns
-- `staff_role` directly, so its own signature depends on the type -- DROP TYPE fails while it
-- exists (confirmed by an earlier apply attempt: "function current_staff_role() depends on type
-- staff_role"). But current_staff_role() itself has its own live dependents that must be cleared
-- first, checked directly against every migration rather than assumed: is_administrator(),
-- has_store_access(), can_view_supplier_management(), can_manage_purchasing(),
-- can_view_inventory(), is_internal_products_writer(), can_view_internal_products(),
-- can_access_internal_supply(). All eight are redefined via CREATE OR REPLACE (none of their
-- signatures change, only their bodies) BEFORE current_staff_role() is dropped -- CREATE OR
-- REPLACE never drops a function, so every existing policy or function that already calls any of
-- these eight by name keeps working completely undisturbed, with no CASCADE anywhere and nothing
-- else in the schema touched. Only current_staff_role() itself is ever actually dropped, and only
-- once nothing calls it anymore.

-- ============================================================
-- LAYER 2: staff_permission_definitions (lookup) + staff_permissions (grant)
-- ============================================================

create table staff_permission_definitions (
  key text primary key,
  name text not null,
  description text,
  permission_group text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table staff_permission_definitions enable row level security;

create policy "staff can read staff permission definitions" on staff_permission_definitions for select
  using (is_active_staff());
create policy "administrators can insert staff permission definitions" on staff_permission_definitions for insert
  with check (is_administrator());
create policy "administrators can update staff permission definitions" on staff_permission_definitions for update
  using (is_administrator()) with check (is_administrator());

-- System master data -- same "no delete, retire via is_active" convention as
-- store_role_definitions. permission_group is UI-organization only (Master Data / Operations /
-- Reports / Administration), no RLS reads it.
grant select, insert, update on public.staff_permission_definitions to authenticated;
revoke delete on public.staff_permission_definitions from authenticated;

insert into staff_permission_definitions (key, name, description, permission_group, sort_order, is_active) values
  ('products', 'Productos', 'Permite gestionar el catálogo de productos, unidades y conversiones.', 'Master Data', 1, true),
  ('categories', 'Categorías', 'Permite gestionar las categorías de productos.', 'Master Data', 2, true),
  ('suppliers', 'Proveedores', 'Permite gestionar proveedores y sus productos.', 'Master Data', 3, true),
  ('locales', 'Locales', 'Permite gestionar los restaurantes y sus marcas.', 'Master Data', 4, true),
  ('inventory', 'Inventario', 'Permite acceder al módulo de inventario.', 'Operations', 5, true),
  ('purchasing', 'Compras', 'Permite acceder al módulo de compras.', 'Operations', 6, true),
  ('internal_supply', 'Suministro Interno', 'Permite acceder al módulo de suministro interno.', 'Operations', 7, true),
  ('analytics', 'Análisis', 'Permite acceder a los informes y análisis.', 'Reports', 8, true),
  ('settings', 'Configuración', 'Permite acceder a la configuración del sistema.', 'Administration', 9, true),
  ('users', 'Personal', 'Permite gestionar el personal.', 'Administration', 10, false);

create table staff_permissions (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  permission_key text not null references staff_permission_definitions(key) on delete restrict,
  created_at timestamptz not null default now(),
  unique (staff_profile_id, permission_key)
);

create index staff_permissions_staff_profile_id_idx on staff_permissions(staff_profile_id);

alter table staff_permissions enable row level security;

-- Grant = row exists, revoke = row removed -- no status field, per the approved simplification.
create policy "staff can read own staff permissions" on staff_permissions for select
  using (exists (select 1 from staff_profiles sp where sp.id = staff_permissions.staff_profile_id and sp.user_id = auth.uid()));
create policy "administrators can read all staff permissions" on staff_permissions for select
  using (is_administrator());
create policy "administrators can insert staff permissions" on staff_permissions for insert
  with check (is_administrator());
create policy "administrators can delete staff permissions" on staff_permissions for delete
  using (is_administrator());

-- Insert/delete stay Administrator-only, full stop -- no `users` permission branch, since Personal
-- itself is Administrator-only for V1.0 (see header). This is also what closes off the privilege-
-- escalation path: nobody but a true Administrator can ever grant or revoke a permission.
grant select, insert, delete on public.staff_permissions to authenticated;

create or replace function has_staff_permission(target_permission_key text) returns boolean as $$
  select exists (
    select 1
    from staff_permissions sperm
    join staff_profiles sp on sp.id = sperm.staff_profile_id
    where sp.user_id = auth.uid()
      and sp.is_active
      and sperm.permission_key = target_permission_key
  );
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- staff_profiles: email (business data, not an auth uniqueness guarantee -- Supabase Auth
-- already owns that)
-- ============================================================

alter table staff_profiles add column email text;

update staff_profiles sp set email = au.email from auth.users au where au.id = sp.user_id;

alter table staff_profiles alter column email set not null;

-- ============================================================
-- staff_profiles: System Role, part 1 -- the new enum, added and backfilled alongside the old
-- one. administrator/purchasing keep their identity; retail_store/production_center are dropped
-- (Store Role, migration 019, now owns that concept entirely); manager is new. Existing
-- retail_store/production_center accounts become plain staff -- Store Role and Operational
-- Permissions for those people now come entirely from whichever Locale(s) they're assigned to,
-- not from their own role. The OLD type is not dropped yet -- see the dependency note at the top
-- of this file for why.
-- ============================================================

alter table staff_profiles rename column role to role_old;

create type staff_role_new as enum ('administrator', 'manager', 'purchasing', 'staff');

alter table staff_profiles add column role staff_role_new;

update staff_profiles set role = case role_old
  when 'administrator' then 'administrator'::staff_role_new
  when 'purchasing' then 'purchasing'::staff_role_new
  when 'retail_store' then 'staff'::staff_role_new
  when 'production_center' then 'staff'::staff_role_new
end;

alter table staff_profiles alter column role set not null;
alter table staff_profiles drop column role_old;

-- ============================================================
-- Clear every live dependent of current_staff_role() BEFORE touching the old type or the
-- function itself -- see the dependency note at the top of this file. None of these eight
-- functions' signatures change, only their bodies, so this is CREATE OR REPLACE throughout: no
-- DROP, no CASCADE, and every existing caller (dozens of policies across the whole schema)
-- continues working undisturbed.
-- ============================================================

create or replace function is_administrator() returns boolean as $$
  select exists (
    select 1 from staff_profiles sp
    where sp.user_id = auth.uid() and sp.is_active and sp.role = 'administrator'
  );
$$ language sql stable security definer set search_path = public;

-- administrator sees every store; everyone else only stores they're assigned to via staff_stores
create or replace function has_store_access(target_store_id uuid) returns boolean as $$
  select is_administrator()
    or exists (
      select 1 from staff_stores ss
      join staff_profiles sp on sp.id = ss.staff_profile_id
      where sp.user_id = auth.uid() and sp.is_active and ss.store_id = target_store_id
    );
$$ language sql stable security definer set search_path = public;

create or replace function can_view_supplier_management() returns boolean as $$
  select is_administrator() or has_staff_permission('suppliers');
$$ language sql stable security definer set search_path = public;

create or replace function can_manage_purchasing() returns boolean as $$
  select is_administrator() or has_staff_permission('purchasing');
$$ language sql stable security definer set search_path = public;

-- Two independent paths, deliberately not one merged OR: Purchasing needs cross-store visibility
-- with no Locale requirement at all (unchanged intent from migration 015 -- "needs to see stock
-- levels everywhere to decide what to buy"), while a Locale-assigned employee needs BOTH the
-- inventory permission AND the Locale assignment -- Locale Access alone is no longer sufficient,
-- matching every other module's two-layer gate (module permission + Locale access). Without this,
-- `inventory` would be a decorative permission: everyone already assigned to a Local would see its
-- stock regardless of whether they'd ever been granted the module.
create or replace function can_view_inventory(target_store_id uuid) returns boolean as $$
  select is_administrator()
    or has_staff_permission('purchasing')
    or (has_store_access(target_store_id) and has_staff_permission('inventory'));
$$ language sql stable security definer set search_path = public;

create or replace function is_internal_products_writer() returns boolean as $$
  select is_administrator() or has_staff_permission('internal_supply');
$$ language sql stable security definer set search_path = public;

-- Internal Products/Internal Supply intentionally drop the Store-Role re-check from an earlier
-- draft of this design -- redundant, since every Local already has at least one Store Role
-- (migration 019's own "must have at least one Role" trigger guarantees it), so re-checking it
-- here added no actual restriction, only complexity.
create or replace function can_view_internal_products() returns boolean as $$
  select is_administrator()
    or (
      has_staff_permission('internal_supply')
      and exists (
        select 1 from staff_stores ss
        join staff_profiles sp on sp.id = ss.staff_profile_id
        where sp.user_id = auth.uid() and sp.is_active
      )
    );
$$ language sql stable security definer set search_path = public;

create or replace function can_access_internal_supply() returns boolean as $$
  select is_administrator()
    or (
      has_staff_permission('internal_supply')
      and exists (
        select 1 from staff_stores ss
        join staff_profiles sp on sp.id = ss.staff_profile_id
        where sp.user_id = auth.uid() and sp.is_active
      )
    );
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- staff_profiles: System Role, part 2 -- current_staff_role() now has zero remaining callers
-- (every function above was just redefined to stop calling it), so it can be dropped cleanly,
-- and the type swap can complete with no CASCADE.
-- ============================================================

drop function current_staff_role();

drop type staff_role;
alter type staff_role_new rename to staff_role;

-- Recreated fresh against the new type. Nothing in this migration calls it anymore -- every
-- former caller now goes through has_staff_permission() or queries staff_profiles directly -- but
-- it's a cheap, generically useful primitive worth keeping available for future code.
create or replace function current_staff_role() returns staff_role as $$
  select sp.role from staff_profiles sp where sp.user_id = auth.uid() and sp.is_active limit 1;
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- staff_profiles: guard triggers. Created only now, after every DML step above, so the backfill
-- UPDATE that already ran isn't itself blocked by a not-yet-relevant admin check (a migration
-- runs outside any authenticated session, so is_administrator() would read as false during it).
-- ============================================================

-- Currently redundant -- the whole table is already Administrator-only for V1.0 -- but built now
-- so that if Personal is ever delegated in a future version (via the dormant `users` permission),
-- this is the only thing still preventing a delegated non-Administrator from escalating someone's
-- role, and it needs no new trigger work at that point, only a policy change.
create or replace function enforce_role_change_requires_admin() returns trigger as $$
begin
  if new.role is distinct from old.role and not is_administrator() then
    raise exception 'Only an Administrator may change a staff role';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger staff_profiles_role_change_requires_admin
  before update on staff_profiles
  for each row execute function enforce_role_change_requires_admin();

-- Actively meaningful today: blocks demoting or deactivating the last active Administrator,
-- even by another Administrator.
create or replace function enforce_last_administrator() returns trigger as $$
begin
  if old.role = 'administrator' and old.is_active
     and (new.role <> 'administrator' or not new.is_active) then
    if not exists (
      select 1 from staff_profiles
      where role = 'administrator' and is_active and id <> old.id
    ) then
      raise exception 'Cannot remove the last active Administrator';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger staff_profiles_last_administrator_guard
  before update on staff_profiles
  for each row execute function enforce_last_administrator();

-- ============================================================
-- Master Data write access: split the one shared is_active_staff_writer() into per-module
-- functions, since Products/Categories/Suppliers/Locales are now independently grantable Staff
-- Permissions rather than one flat "administrator or purchasing" gate. Units falls under
-- Products ("all product-related master data") -- product_unit_conversions and product_aliases,
-- which is_active_staff_writer() also originally covered in migration 002, no longer exist as
-- tables at all (dropped by migrations 004 and 007 respectively, long before this session), so
-- there is nothing left to redirect for either. Brands stay under Locales, not their own
-- permission -- Brand only exists to support Store creation, same reasoning as its earlier
-- relocation into the Stores feature.
-- ============================================================

create or replace function can_write_products() returns boolean as $$
  select is_administrator() or has_staff_permission('products');
$$ language sql stable security definer set search_path = public;

create or replace function can_write_categories() returns boolean as $$
  select is_administrator() or has_staff_permission('categories');
$$ language sql stable security definer set search_path = public;

create or replace function can_write_suppliers() returns boolean as $$
  select is_administrator() or has_staff_permission('suppliers');
$$ language sql stable security definer set search_path = public;

create or replace function can_write_locales() returns boolean as $$
  select is_administrator() or has_staff_permission('locales');
$$ language sql stable security definer set search_path = public;

-- categories
alter policy "writers can insert categories" on categories with check (can_write_categories());
alter policy "writers can update categories" on categories using (can_write_categories()) with check (can_write_categories());

-- units (Product Management)
alter policy "writers can insert units" on units with check (can_write_products());
alter policy "writers can update units" on units using (can_write_products()) with check (can_write_products());

-- products
alter policy "writers can insert products" on products with check (can_write_products());
alter policy "writers can update products" on products using (can_write_products()) with check (can_write_products());

-- suppliers
alter policy "writers can insert suppliers" on suppliers with check (can_write_suppliers());
alter policy "writers can update suppliers" on suppliers using (can_write_suppliers()) with check (can_write_suppliers());

-- supplier_products
alter policy "writers can insert supplier_products" on supplier_products with check (can_write_suppliers());
alter policy "writers can update supplier_products" on supplier_products using (can_write_suppliers()) with check (can_write_suppliers());
alter policy "writers can delete supplier_products" on supplier_products using (can_write_suppliers());

-- stores -- previously is_administrator()-only; renamed since "administrators can insert stores"
-- would now be a misleading name once Staff Permission holders can too.
drop policy "administrators can insert stores" on stores;
create policy "writers can insert stores" on stores for insert with check (can_write_locales());

drop policy "administrators can update stores" on stores;
create policy "writers can update stores" on stores for update using (can_write_locales()) with check (can_write_locales());

-- brands -- was is_active_staff_writer() (migration 018), now can_write_locales() specifically.
drop policy "administrators can insert brands" on brands;
create policy "writers can insert brands" on brands for insert with check (can_write_locales());

-- is_active_staff_writer() has no remaining callers after the above -- retire it.
drop function is_active_staff_writer();
