-- Internal Products: completely independent from Product Management (products/categories).
-- Manufactured by Production Centers, never appear in Product Management or Purchasing —
-- keeping Purchasing Analytics and Internal Supply Analytics separated is the whole point.
--
-- internal_product_categories is a separate, flat (non-hierarchical) table — simplicity over
-- consistency with `categories`' self-referencing tree, since nothing in the business
-- description suggests nested internal-product categories.
--
-- Internal Selling Price is a plain editable column, not generated — the UI computes an
-- initial cost*margin suggestion, but managers can override it afterward and that override
-- must persist independent of later cost/margin changes.

create table internal_product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- default_production_center_id: which Production Center normally makes this product (e.g.
-- Gangnam Sauce -> CCC Amparo). Simplifies Internal Supply routing (default-selects the
-- Production Center when a Retail Store starts a request). References `stores(id)` rather
-- than a dedicated production-center table — that the referenced store must actually have
-- type = 'production_center' is enforced at the application layer, not the database, same
-- as the from/to store direction on internal_supply_requests.
create table internal_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references internal_product_categories(id) on delete restrict,
  base_unit_id uuid not null references units(id) on delete restrict,
  default_production_center_id uuid not null references stores(id) on delete restrict,
  cost_price numeric(12, 4) not null default 0 check (cost_price >= 0),
  margin_percent numeric(5, 2) not null default 0 check (margin_percent >= 0),
  internal_selling_price numeric(12, 4) not null default 0 check (internal_selling_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index internal_products_category_id_idx on internal_products(category_id);
create index internal_products_base_unit_id_idx on internal_products(base_unit_id);
create index internal_products_default_production_center_id_idx on internal_products(default_production_center_id);

create trigger set_updated_at before update on internal_product_categories for each row execute function set_updated_at();
create trigger set_updated_at before update on internal_products for each row execute function set_updated_at();

alter table internal_product_categories enable row level security;
alter table internal_products enable row level security;
