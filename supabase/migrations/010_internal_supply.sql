-- Internal Supply: a completely separate workflow from Purchasing and from
-- store_transfers/transfer_items (kept, dormant, for a possible future general
-- store-to-store transfer of regular Products). No inventory tracking in V1 — this is a
-- request/ship/settlement record only, so it has no relationship to inventory_movements.
--
-- Version 1 explicitly excludes: production output, internal inventory, internal stock
-- count, waste tracking, production planning, recipes, BOM.

-- preparing: Production Center staff are actively preparing the order before shipment
create type internal_supply_status as enum ('pending', 'preparing', 'shipped', 'cancelled');

create table internal_supply_requests (
  id uuid primary key default gen_random_uuid(),
  from_store_id uuid not null references stores(id) on delete restrict,
  to_store_id uuid not null references stores(id) on delete restrict,
  status internal_supply_status not null default 'pending',
  requested_by uuid references staff_profiles(id) on delete set null,
  shipped_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_store_id <> to_store_id)
);

create index internal_supply_requests_from_store_id_idx on internal_supply_requests(from_store_id);
create index internal_supply_requests_to_store_id_idx on internal_supply_requests(to_store_id);

-- internal_selling_price is snapshotted from internal_products.internal_selling_price at the
-- moment the item is added to the request — future price changes must never alter historical
-- transactions. settlement_amount is safely a generated column (unlike the price on the
-- product master) since it's a pure derived calculation, never manually overridden.
create table internal_supply_items (
  id uuid primary key default gen_random_uuid(),
  internal_supply_request_id uuid not null references internal_supply_requests(id) on delete cascade,
  internal_product_id uuid not null references internal_products(id) on delete restrict,
  quantity_requested numeric(14, 4) not null check (quantity_requested > 0),
  quantity_shipped numeric(14, 4) check (quantity_shipped >= 0),
  internal_selling_price numeric(12, 4) not null check (internal_selling_price >= 0),
  settlement_amount numeric(14, 4) generated always as (quantity_shipped * internal_selling_price) stored,
  created_at timestamptz not null default now()
);

create index internal_supply_items_request_id_idx on internal_supply_items(internal_supply_request_id);
create index internal_supply_items_internal_product_id_idx on internal_supply_items(internal_product_id);

create trigger set_updated_at before update on internal_supply_requests for each row execute function set_updated_at();

alter table internal_supply_requests enable row level security;
alter table internal_supply_items enable row level security;
