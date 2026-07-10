-- Product Categories: flat (single-level) list only. parent_category_id has never been read
-- or written by any UI or query since the schema was created in 001 -- categories has been
-- flat in practice this whole time. Dropping it removes dead schema per "every field needs a
-- real operational use."
--
-- No RLS/grants change is needed: "writers can insert/update categories" (002) already
-- resolves to is_administrator() since migration 012 tightened is_active_staff_writer(), and
-- "staff can read categories" was already open to any active staff member. This migration only
-- touches schema shape and seed data.

drop index if exists categories_parent_category_id_idx;
alter table categories drop column if exists parent_category_id;

-- Seed the restaurant's standard category list. Idempotent by name so this is safe to re-run.
-- Does not touch the "Uncategorized" fallback category seeded in 005 for products that
-- pre-dated category_id being required -- rename or disable it through the new Category
-- Management UI if it's no longer wanted.
insert into categories (name, sort_order, is_active)
select v.name, v.sort_order, true
from (values
  ('Meat', 1),
  ('Vegetables', 2),
  ('Dairy', 3),
  ('Frozen Food', 4),
  ('Sauces & Seasonings', 5),
  ('Beverages', 6),
  ('Packaging', 7),
  ('Cleaning Supplies', 8),
  ('Other', 9)
) as v(name, sort_order)
where not exists (select 1 from categories c where c.name = v.name);
