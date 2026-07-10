-- Replace stores.type's placeholder values (restaurant/warehouse/central_kitchen — set before
-- any Store Management UI existed) with the real business types: Production Center / Retail
-- Store. No Store Management UI exists yet, so this is a clean cutover rather than a
-- backward-compatible addition.
--
-- NOTE: 'warehouse' has no clean mapping to either new type. If any store currently has
-- type = 'warehouse', the UPDATE below leaves its new `type` column null and the later
-- `set not null` will fail — reclassify that row as production_center or retail_store first.

alter table stores rename column type to type_old;

create type store_type_new as enum ('production_center', 'retail_store');

alter table stores add column type store_type_new;

update stores set type = case type_old
  when 'central_kitchen' then 'production_center'::store_type_new
  when 'restaurant' then 'retail_store'::store_type_new
  else null
end;

alter table stores alter column type set not null;
alter table stores alter column type set default 'retail_store';

alter table stores drop column type_old;

drop type store_type;
alter type store_type_new rename to store_type;

-- Store Code (e.g. CCC-AMP, CCC-TET, MS-LAV) already existed as an optional unique column
-- since 001 — making it required now that Store Management is a real module (reporting,
-- exports, future integrations all depend on every store having one).
-- NOTE: this fails if any existing store has a null code — set one first.
alter table stores alter column code set not null;
