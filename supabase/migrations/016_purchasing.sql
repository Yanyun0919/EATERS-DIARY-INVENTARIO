-- Purchasing module (business design + schema review approved 2026-07-11 / 2026-07-12).
-- purchase_orders/purchase_order_items have existed since migration 001 with RLS enabled and
-- zero policies -- nobody, not even Administrator, can read or write them today. They were also
-- shaped for a formal ERP ordering/receiving workflow that BUSINESS_RULES.md explicitly
-- excludes (no draft, no resume, no cancel, no goods receipt). This migration simplifies both
-- tables to match the approved design and makes them usable for the first time.
--
-- Both tables are safe to alter directly (drop/backfill-then-not-null) rather than requiring a
-- destructive rebuild: RLS has blocked every insert since table creation, so in the ordinary
-- case there are zero rows. The backfill steps below exist only as a safety net for the
-- unlikely case a row was inserted directly via the Supabase SQL editor during earlier testing
-- -- if that backfill can't find a source row to copy from, the final NOT NULL constraint fails
-- loudly rather than silently guessing a value, matching this project's established convention
-- (see migration 011's staff_role backfill).

-- Snapshot columns below (supplier_name, product_name, purchase_unit, purchase_unit_spec,
-- alongside the already-existing unit_price/iva_rate) exist purely to preserve historical
-- accuracy: purchase history must never change just because a supplier or product is renamed,
-- or a supplier relationship's price/unit is updated, later.

-- ============================================================
-- purchase_orders
-- ============================================================

-- No lifecycle survives: No Draft, No Resume, No Cancel (approved business design). A purchase
-- has exactly one state once it exists.
drop trigger if exists set_updated_at on purchase_orders;

alter table purchase_orders
  drop column if exists status,
  drop column if exists expected_delivery_date,
  drop column if exists updated_at;

drop type if exists purchase_order_status;

-- Immutable snapshot: history must never change if a supplier is renamed later.
alter table purchase_orders add column if not exists supplier_name text;

update purchase_orders po
set supplier_name = s.name
from suppliers s
where s.id = po.supplier_id and po.supplier_name is null;

alter table purchase_orders alter column supplier_name set not null;

-- ============================================================
-- purchase_order_items
-- ============================================================

drop trigger if exists set_updated_at on purchase_order_items;

alter table purchase_order_items
  drop column if exists unit_id,
  drop column if exists quantity_received,
  drop column if exists updated_at;
-- quantity_ordered is kept as-is (not renamed) -- still clearly "the quantity purchased" and
-- avoids any confusion with Inventory's own quantity fields.

-- Immutable snapshots: product name (renames shouldn't rewrite history), and Purchase Unit /
-- Purchase Unit Specification (unit_id is gone -- stale since migration 007 decoupled Purchase
-- Unit from the `units` table; purchase_unit_type is that same enum already used by
-- supplier_products).
alter table purchase_order_items
  add column if not exists product_name text,
  add column if not exists purchase_unit purchase_unit_type,
  add column if not exists purchase_unit_spec text;

update purchase_order_items poi
set product_name = p.name
from products p
where p.id = poi.product_id and poi.product_name is null;

update purchase_order_items poi
set purchase_unit = sp.purchase_unit, purchase_unit_spec = sp.purchase_unit_spec
from supplier_products sp
where sp.id = poi.supplier_product_id and poi.purchase_unit is null;

alter table purchase_order_items
  alter column product_name set not null,
  alter column purchase_unit set not null;

alter table purchase_order_items
  add constraint purchase_order_items_purchase_unit_spec_check
  check (purchase_unit <> 'other' or purchase_unit_spec is not null);

-- unit_price and iva_rate were already snapshot-shaped (plain numeric columns, not FKs/live
-- references) -- no change needed, they already satisfy "immutable once created."

-- ============================================================
-- PERMISSIONS: Administrator + Purchasing role, role-based (not store-based), read + create
-- only -- no update, no delete, matching "Purchase history is immutable."
-- ============================================================

create or replace function can_manage_purchasing() returns boolean as $$
  select is_administrator() or current_staff_role() = 'purchasing';
$$ language sql stable security definer set search_path = public;

create policy "purchasing can read purchase orders" on purchase_orders for select
  using (can_manage_purchasing());
create policy "purchasing can create purchase orders" on purchase_orders for insert
  with check (can_manage_purchasing());

create policy "purchasing can read purchase order items" on purchase_order_items for select
  using (can_manage_purchasing());
create policy "purchasing can create purchase order items" on purchase_order_items for insert
  with check (can_manage_purchasing());

grant select, insert on public.purchase_orders to authenticated;
grant select, insert on public.purchase_order_items to authenticated;
