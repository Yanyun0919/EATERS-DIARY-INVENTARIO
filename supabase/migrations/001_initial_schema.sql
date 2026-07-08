-- Eaters Diary ERP — initial schema
-- Single currency: EUR (no currency columns anywhere).
-- Spain-specific: nif_cif on Brand/Supplier, iva_rate on SupplierProduct/PurchaseOrderItem.
-- RLS is enabled on every table with NO policies yet (deny-by-default). Role-scoped
-- policies for Admin/Manager/Staff + store scoping are a follow-up migration.

create extension if not exists pgcrypto;

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type staff_role as enum ('admin', 'manager', 'staff');
create type store_type as enum ('restaurant', 'warehouse', 'central_kitchen');
create type unit_type as enum ('weight', 'volume', 'count');
create type product_alias_type as enum ('translation', 'supplier_name', 'barcode');
create type purchase_order_status as enum ('draft', 'sent', 'partially_received', 'received', 'cancelled');
create type stock_count_status as enum ('in_progress', 'completed', 'cancelled');
create type store_transfer_status as enum ('pending', 'in_transit', 'received', 'cancelled');
create type inventory_movement_type as enum (
  'purchase_receipt', 'transfer_in', 'transfer_out',
  'stock_count_adjustment', 'waste', 'manual_adjustment'
);
create type waste_reason as enum ('damaged', 'expired', 'employee_meal', 'other');
create type inventory_movement_reason as enum (
  'recount_correction', 'data_entry_error', 'theft_suspected', 'system_migration', 'opening_balance', 'other'
);
create type price_history_source as enum ('po_item', 'manual_update');

-- ============================================================
-- shared trigger: keep updated_at current
-- ============================================================

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- ORGANIZATION: brands, stores, staff
-- ============================================================

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  nif_cif text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  code text unique,
  address text,
  type store_type not null default 'restaurant',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stores_brand_id_idx on stores(brand_id);

create table staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  role staff_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staff_stores (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (staff_profile_id, store_id)
);

create index staff_stores_store_id_idx on staff_stores(store_id);

-- ============================================================
-- CATALOG: categories, units, products, conversions, aliases, recipes
-- ============================================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_category_id uuid references categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_parent_category_id_idx on categories(parent_category_id);

create table units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  abbreviation text not null unique,
  type unit_type not null
);

-- common restaurant-supply units, seeded so the system is usable immediately after deployment
insert into units (name, abbreviation, type) values
  ('kilogram', 'kg', 'weight'),
  ('gram', 'g', 'weight'),
  ('liter', 'L', 'volume'),
  ('milliliter', 'ml', 'volume'),
  ('piece', 'pc', 'count'),
  ('case', 'case', 'count'),
  ('box', 'box', 'count'),
  ('bag', 'bag', 'count'),
  ('pack', 'pack', 'count'),
  ('bottle', 'btl', 'count'),
  ('can', 'can', 'count');

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category_id uuid references categories(id) on delete set null,
  base_unit_id uuid not null references units(id) on delete restrict,
  is_active boolean not null default true,
  is_stock_tracked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on products(category_id);
create index products_base_unit_id_idx on products(base_unit_id);

create table product_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  from_unit_id uuid not null references units(id) on delete restrict,
  to_unit_id uuid not null references units(id) on delete restrict,
  factor numeric(14, 6) not null check (factor > 0),
  created_at timestamptz not null default now(),
  check (from_unit_id <> to_unit_id),
  unique (product_id, from_unit_id, to_unit_id)
);

create index product_unit_conversions_product_id_idx on product_unit_conversions(product_id);

create table product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  alias text not null,
  alias_type product_alias_type not null,
  language_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index product_aliases_product_id_idx on product_aliases(product_id);
create index product_aliases_alias_idx on product_aliases(alias);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  yield_quantity numeric(14, 4) not null check (yield_quantity > 0),
  yield_unit_id uuid not null references units(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_brand_id_idx on recipes(brand_id);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(14, 4) not null check (quantity > 0),
  unit_id uuid not null references units(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (recipe_id, product_id)
);

create index recipe_ingredients_recipe_id_idx on recipe_ingredients(recipe_id);
create index recipe_ingredients_product_id_idx on recipe_ingredients(product_id);

-- ============================================================
-- SUPPLIERS & PURCHASING
-- ============================================================

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nif_cif text unique,
  contact_name text,
  email text,
  phone text,
  address text,
  payment_terms text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  supplier_sku text,
  unit_price numeric(12, 4) not null check (unit_price >= 0),
  purchase_unit_id uuid not null references units(id) on delete restrict,
  moq numeric(14, 4) not null default 1 check (moq > 0),
  lead_time_days integer check (lead_time_days >= 0),
  iva_rate numeric(5, 2) not null default 10.00 check (iva_rate >= 0),
  is_preferred boolean not null default false,
  is_available boolean not null default true,
  price_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, product_id)
);

create index supplier_products_supplier_id_idx on supplier_products(supplier_id);
create index supplier_products_product_id_idx on supplier_products(product_id);
-- only one preferred supplier per product
create unique index supplier_products_preferred_per_product_idx
  on supplier_products(product_id) where is_preferred = true;

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete restrict,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  status purchase_order_status not null default 'draft',
  order_date date not null default current_date,
  expected_delivery_date date,
  created_by uuid references staff_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_store_id_idx on purchase_orders(store_id);
create index purchase_orders_supplier_id_idx on purchase_orders(supplier_id);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  unit_id uuid not null references units(id) on delete restrict,
  supplier_product_id uuid references supplier_products(id) on delete set null,
  quantity_ordered numeric(14, 4) not null check (quantity_ordered > 0),
  quantity_received numeric(14, 4) not null default 0 check (quantity_received >= 0),
  unit_price numeric(12, 4) not null check (unit_price >= 0),
  iva_rate numeric(5, 2) not null default 10.00 check (iva_rate >= 0),
  line_total numeric(14, 4) generated always as (quantity_ordered * unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_order_items_purchase_order_id_idx on purchase_order_items(purchase_order_id);
create index purchase_order_items_product_id_idx on purchase_order_items(product_id);

-- historical price log; referenced by inventory_movements is not needed, but
-- po items can seed a row here so price trend reporting doesn't need to scan PO items directly
create table supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  supplier_product_id uuid not null references supplier_products(id) on delete cascade,
  purchase_order_item_id uuid references purchase_order_items(id) on delete restrict,
  unit_price numeric(12, 4) not null check (unit_price >= 0),
  effective_date date not null default current_date,
  source price_history_source not null default 'manual_update',
  created_at timestamptz not null default now(),
  check (
    (source = 'po_item' and purchase_order_item_id is not null)
    or (source = 'manual_update' and purchase_order_item_id is null)
  )
);

create index supplier_price_history_supplier_product_id_idx on supplier_price_history(supplier_product_id);
create index supplier_price_history_effective_date_idx on supplier_price_history(effective_date);

-- ============================================================
-- STOCK COUNTS
-- ============================================================

create table stock_counts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete restrict,
  status stock_count_status not null default 'in_progress',
  counted_by uuid references staff_profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_counts_store_id_idx on stock_counts(store_id);

create table stock_count_items (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references stock_counts(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  unit_id uuid not null references units(id) on delete restrict,
  expected_quantity numeric(14, 4) not null default 0,
  counted_quantity numeric(14, 4) not null check (counted_quantity >= 0),
  variance numeric(14, 4) generated always as (counted_quantity - expected_quantity) stored,
  notes text,
  created_at timestamptz not null default now(),
  unique (stock_count_id, product_id)
);

create index stock_count_items_stock_count_id_idx on stock_count_items(stock_count_id);
create index stock_count_items_product_id_idx on stock_count_items(product_id);

-- ============================================================
-- STORE TRANSFERS (cross-brand allowed)
-- ============================================================

create table store_transfers (
  id uuid primary key default gen_random_uuid(),
  from_store_id uuid not null references stores(id) on delete restrict,
  to_store_id uuid not null references stores(id) on delete restrict,
  status store_transfer_status not null default 'pending',
  requested_by uuid references staff_profiles(id) on delete set null,
  sent_at timestamptz,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_store_id <> to_store_id)
);

create index store_transfers_from_store_id_idx on store_transfers(from_store_id);
create index store_transfers_to_store_id_idx on store_transfers(to_store_id);

create table transfer_items (
  id uuid primary key default gen_random_uuid(),
  store_transfer_id uuid not null references store_transfers(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  unit_id uuid not null references units(id) on delete restrict,
  quantity_sent numeric(14, 4) not null check (quantity_sent > 0),
  quantity_received numeric(14, 4) check (quantity_received >= 0),
  created_at timestamptz not null default now()
);

create index transfer_items_store_transfer_id_idx on transfer_items(store_transfer_id);
create index transfer_items_product_id_idx on transfer_items(product_id);

-- ============================================================
-- WASTE
-- ============================================================

create table waste_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  unit_id uuid not null references units(id) on delete restrict,
  quantity numeric(14, 4) not null check (quantity > 0),
  reason waste_reason not null,
  recorded_by uuid references staff_profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  notes text
);

create index waste_records_store_id_idx on waste_records(store_id);
create index waste_records_product_id_idx on waste_records(product_id);

-- ============================================================
-- INVENTORY: current balance + audit trail
-- ============================================================

create table inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  unit_id uuid not null references units(id) on delete restrict,
  quantity_on_hand numeric(14, 4) not null default 0,
  par_level numeric(14, 4),
  reorder_point numeric(14, 4),
  last_movement_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, product_id)
);

create index inventory_product_id_idx on inventory(product_id);

-- append-only ledger; Inventory.quantity_on_hand is a maintained cache of this table.
-- the reference columns are typed FKs (not a loose polymorphic pointer) so the source
-- document can never be deleted out from under an existing movement (on delete restrict).
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  unit_id uuid not null references units(id) on delete restrict,
  quantity_delta numeric(14, 4) not null check (quantity_delta <> 0),
  movement_type inventory_movement_type not null,
  purchase_order_item_id uuid references purchase_order_items(id) on delete restrict,
  transfer_item_id uuid references transfer_items(id) on delete restrict,
  stock_count_item_id uuid references stock_count_items(id) on delete restrict,
  waste_record_id uuid references waste_records(id) on delete restrict,
  reason inventory_movement_reason,
  created_by uuid references staff_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (movement_type = 'purchase_receipt' and purchase_order_item_id is not null)
    or (movement_type in ('transfer_in', 'transfer_out') and transfer_item_id is not null)
    or (movement_type = 'stock_count_adjustment' and stock_count_item_id is not null)
    or (movement_type = 'waste' and waste_record_id is not null)
    or (movement_type in ('manual_adjustment', 'pos_deduction'))
  )
);

create index inventory_movements_store_product_idx on inventory_movements(store_id, product_id);
create index inventory_movements_created_at_idx on inventory_movements(created_at);
create index inventory_movements_movement_type_idx on inventory_movements(movement_type);

-- ============================================================
-- updated_at TRIGGERS
-- ============================================================

create trigger set_updated_at before update on brands for each row execute function set_updated_at();
create trigger set_updated_at before update on stores for each row execute function set_updated_at();
create trigger set_updated_at before update on storage_locations for each row execute function set_updated_at();
create trigger set_updated_at before update on staff_profiles for each row execute function set_updated_at();
create trigger set_updated_at before update on categories for each row execute function set_updated_at();
create trigger set_updated_at before update on products for each row execute function set_updated_at();
create trigger set_updated_at before update on recipes for each row execute function set_updated_at();
create trigger set_updated_at before update on suppliers for each row execute function set_updated_at();
create trigger set_updated_at before update on supplier_products for each row execute function set_updated_at();
create trigger set_updated_at before update on purchase_orders for each row execute function set_updated_at();
create trigger set_updated_at before update on purchase_order_items for each row execute function set_updated_at();
create trigger set_updated_at before update on stock_counts for each row execute function set_updated_at();
create trigger set_updated_at before update on store_transfers for each row execute function set_updated_at();
create trigger set_updated_at before update on inventory for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (enabled everywhere, no policies yet — deny by default)
-- ============================================================

alter table brands enable row level security;
alter table stores enable row level security;
alter table storage_locations enable row level security;
alter table staff_profiles enable row level security;
alter table staff_stores enable row level security;
alter table categories enable row level security;
alter table units enable row level security;
alter table products enable row level security;
alter table product_unit_conversions enable row level security;
alter table product_aliases enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table suppliers enable row level security;
alter table supplier_products enable row level security;
alter table supplier_price_history enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table stock_counts enable row level security;
alter table stock_count_items enable row level security;
alter table store_transfers enable row level security;
alter table transfer_items enable row level security;
alter table waste_records enable row level security;
alter table inventory enable row level security;
alter table inventory_movements enable row level security;
