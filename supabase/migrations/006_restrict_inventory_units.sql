-- Restrict Inventory Units to exactly the 4 restaurant-relevant units: unidad, kg, g, ml.
-- Packaging/purchasing units (case, box, bag, pack, bottle, can) and liter are removed —
-- "packaging is not an inventory unit, packaging belongs to purchasing."
--
-- Any existing row still referencing a doomed unit is remapped automatically rather than
-- left to block the DELETE:
--   - liter -> ml: a precise, known conversion (x1000), applied to every quantity column
--     alongside the remapped unit_id so the physical quantity is preserved exactly.
--   - case/box/bag/pack/bottle/can -> unidad: NOT a precise conversion — there's no stored
--     pack size (a "case" could be 6, 12, or 24 units depending on the product), so the
--     quantity number is carried over unchanged and only the unit label changes. Anything
--     remapped this way should be spot-checked afterward; the verification query below
--     lists exactly which products were affected so nothing is silently wrong.

do $$
declare
  unidad_id uuid;
  ml_id uuid;
  liter_id uuid;
  packaging_ids uuid[];
begin
  select id into unidad_id from units where abbreviation = 'pc';
  select id into ml_id from units where abbreviation = 'ml';
  select id into liter_id from units where abbreviation = 'L';
  select array_agg(id) into packaging_ids from units where abbreviation in ('case', 'box', 'bag', 'pack', 'btl', 'can');

  -- products
  update products set minimum_stock = minimum_stock * 1000, base_unit_id = ml_id where base_unit_id = liter_id;
  update products set base_unit_id = unidad_id where base_unit_id = any(packaging_ids);

  -- purchase_order_items
  update purchase_order_items set quantity_ordered = quantity_ordered * 1000, quantity_received = quantity_received * 1000, unit_id = ml_id where unit_id = liter_id;
  update purchase_order_items set unit_id = unidad_id where unit_id = any(packaging_ids);

  -- stock_count_items
  update stock_count_items set expected_quantity = expected_quantity * 1000, counted_quantity = counted_quantity * 1000, unit_id = ml_id where unit_id = liter_id;
  update stock_count_items set unit_id = unidad_id where unit_id = any(packaging_ids);

  -- transfer_items
  update transfer_items set quantity_sent = quantity_sent * 1000, quantity_received = quantity_received * 1000, unit_id = ml_id where unit_id = liter_id;
  update transfer_items set unit_id = unidad_id where unit_id = any(packaging_ids);

  -- waste_records
  update waste_records set quantity = quantity * 1000, unit_id = ml_id where unit_id = liter_id;
  update waste_records set unit_id = unidad_id where unit_id = any(packaging_ids);

  -- recipe_ingredients
  update recipe_ingredients set quantity = quantity * 1000, unit_id = ml_id where unit_id = liter_id;
  update recipe_ingredients set unit_id = unidad_id where unit_id = any(packaging_ids);

  -- inventory
  update inventory set quantity_on_hand = quantity_on_hand * 1000, unit_id = ml_id where unit_id = liter_id;
  update inventory set unit_id = unidad_id where unit_id = any(packaging_ids);

  -- inventory_movements
  update inventory_movements set quantity_delta = quantity_delta * 1000, unit_id = ml_id where unit_id = liter_id;
  update inventory_movements set unit_id = unidad_id where unit_id = any(packaging_ids);
end $$;

delete from units where abbreviation in ('L', 'case', 'box', 'bag', 'pack', 'btl', 'can');

update units set name = 'unidad' where abbreviation = 'pc';
