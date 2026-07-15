-- Supply Source (Master Data) -- Technical Design approved 2026-07-13, across the frozen
-- Business Architecture (Rules 9/10) and two Master Data Technical Design review rounds.
--
-- Supply Source is the routing classification a Product uses to determine which operational
-- workflow fulfills it:
--   External -> resolves to a Supplier, via the product's own supplier_products.is_preferred
--               row (already existing, unchanged -- no configuration needed for this case).
--   Internal -> resolves to a Locale holding the production_center Store Role, fulfilled via
--               Internal Transfer (not Internal Supply -- Rule 10, separate domain).
--
-- "Design for Extension, Build for Today" (explicit instruction from the approved Technical
-- Design): only the Internal resolution gets its own configuration table right now. External
-- needs none. A future resolution type gets its own small config table later, added
-- independently -- supply_sources itself never needs to change shape to accommodate one.

create type supply_source_resolution_type as enum ('external', 'internal');

create table supply_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  resolution_type supply_source_resolution_type not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on supply_sources for each row execute function set_updated_at();

alter table supply_sources enable row level security;

-- Permission model: dependency-based, not role-based (approved revision) -- Supply Source
-- access mirrors Product access exactly, reusing is_active_staff()/can_write_products()
-- directly rather than a new permission key, since Supply Source exists only because Product
-- depends on it.
create policy "staff can read supply sources" on supply_sources for select using (is_active_staff());
create policy "writers can insert supply sources" on supply_sources for insert with check (can_write_products());
create policy "writers can update supply sources" on supply_sources for update using (can_write_products()) with check (can_write_products());

-- No delete policy -- Master Data in this project is never hard-deleted, only soft-deactivated
-- via is_active (same convention as categories, suppliers, store_role_definitions).
grant select, insert, update on public.supply_sources to authenticated;

-- ============================================================
-- Internal resolution configuration -- one row per `internal`-type Supply Source, pointing to
-- the Locale that fulfills it. Never populated for `external`-type sources, which resolve
-- entirely through existing Product/supplier_products data and need no configuration row at
-- all. supply_source_id is both the primary key and the FK: a strict 1:1 extension of a
-- supply_sources row, not an independent entity -- it's configuration, not a business event
-- (Rule 9).
--
-- store_id is not constrained at the database level to a store holding the production_center
-- Store Role -- enforced at the application layer instead, matching the exact precedent
-- already set by internal_products.default_production_center_id (migration 009).
-- ============================================================

create table supply_source_locale_config (
  supply_source_id uuid primary key references supply_sources(id) on delete cascade,
  store_id uuid not null references stores(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on supply_source_locale_config for each row execute function set_updated_at();

alter table supply_source_locale_config enable row level security;

create policy "staff can read supply source locale config" on supply_source_locale_config for select using (is_active_staff());
create policy "writers can insert supply source locale config" on supply_source_locale_config for insert with check (can_write_products());
create policy "writers can update supply source locale config" on supply_source_locale_config for update using (can_write_products()) with check (can_write_products());
create policy "writers can delete supply source locale config" on supply_source_locale_config for delete using (can_write_products());

-- Delete is allowed here (unlike supply_sources itself) -- this row is pure configuration, not
-- a business record, so it may need to be removed if a Supply Source's resolution_type ever
-- changes away from 'internal'. That consistency (an 'internal' source always has exactly one
-- config row, an 'external' source always has none) is an application-layer responsibility,
-- not enforced by a database constraint here.
grant select, insert, update, delete on public.supply_source_locale_config to authenticated;

-- ============================================================
-- Product gains its Supply Source classification. Nullable -- this project has real, populated
-- product data already in production and there is no safe default to backfill (unlike e.g. a
-- generated identity column); existing products start unassigned, and an Administrator assigns
-- each one's Supply Source afterward via the Products UI. Not retroactively forced not-null by
-- this migration.
-- ============================================================

alter table products add column supply_source_id uuid references supply_sources(id) on delete restrict;
create index products_supply_source_id_idx on products(supply_source_id);
