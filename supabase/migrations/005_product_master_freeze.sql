-- Freeze the Product Master design per the restaurant-first review: Minimum Stock is
-- product-level (not per-store), Category becomes required, and an optional Default
-- Supplier / Default Purchase Price give a quick single-value reference distinct from the
-- full multi-supplier catalog in supplier_products.
--
-- Written idempotently (IF NOT EXISTS / drop-then-add guards throughout) since a prior run
-- failed partway through on the category_id NOT NULL step and it's not certain whether the
-- statements before that point were committed — safe to run this whole file again either way.
--
-- Any existing product with a null category_id is backfilled into a fallback "Uncategorized"
-- category rather than deleted or requiring a manual fix — staff can reassign it to a real
-- category later through the UI.

alter table products
  add column if not exists minimum_stock numeric(14, 4) not null default 0 check (minimum_stock >= 0),
  add column if not exists default_supplier_id uuid references suppliers(id) on delete set null,
  add column if not exists default_purchase_price numeric(12, 4) check (default_purchase_price is null or default_purchase_price >= 0);

create index if not exists products_default_supplier_id_idx on products(default_supplier_id);

insert into categories (name, is_active)
select 'Uncategorized', true
where not exists (select 1 from categories where name = 'Uncategorized');

update products
set category_id = (select id from categories where name = 'Uncategorized')
where category_id is null;

-- category_id: was optional, now required. Swap the FK action from SET NULL to RESTRICT —
-- a required column can't tolerate being nulled out when its category is deleted.
alter table products alter column category_id set not null;
alter table products drop constraint if exists products_category_id_fkey;
alter table products add constraint products_category_id_fkey
  foreign key (category_id) references categories(id) on delete restrict;

-- Minimum Stock is now a single product-level value (products.minimum_stock above), not
-- per-store — these per-store fields are redundant with the new single source of truth.
alter table inventory drop column if exists par_level;
alter table inventory drop column if exists reorder_point;
