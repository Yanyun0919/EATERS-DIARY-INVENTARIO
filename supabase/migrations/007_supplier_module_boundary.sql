-- Refine module boundaries per architecture review:
-- 1. Purchase Unit becomes a simple descriptive enum (kg/g/L/ml/other + free-text spec when
--    "other"), decoupled entirely from the Inventory Unit `units` table. It indicates the
--    purchasing specification only — it is not used for any automated conversion math.
-- 2. product_unit_conversions is dropped: it existed to convert between two `units` rows, but
--    Purchase Unit no longer references `units` at all, so it has nothing left to convert.
-- 3. products.default_supplier_id / default_purchase_price are explicitly KEPT (final design
--    freeze decision) — they intentionally coexist with supplier_products.is_preferred as two
--    separate concepts: a quick product-level reference vs. the detailed per-supplier
--    relationship Supplier Management owns.

create type purchase_unit_type as enum ('kg', 'g', 'L', 'ml', 'other');

alter table supplier_products
  add column purchase_unit purchase_unit_type,
  add column purchase_unit_spec text;

-- best-effort backfill from the old units-based purchase_unit_id: map the standard
-- abbreviations directly, anything else (already-removed packaging units can't appear here
-- post-006) falls back to 'other' with the unit's name preserved as the spec
update supplier_products sp
set purchase_unit = case u.abbreviation
      when 'kg' then 'kg'::purchase_unit_type
      when 'g' then 'g'::purchase_unit_type
      when 'ml' then 'ml'::purchase_unit_type
      else 'other'::purchase_unit_type
    end,
    purchase_unit_spec = case when u.abbreviation not in ('kg', 'g', 'ml') then u.name else null end
from units u
where u.id = sp.purchase_unit_id;

alter table supplier_products alter column purchase_unit set not null;
alter table supplier_products add constraint supplier_products_purchase_unit_spec_check
  check (purchase_unit <> 'other' or purchase_unit_spec is not null);

alter table supplier_products drop column purchase_unit_id;

drop table if exists product_unit_conversions;
