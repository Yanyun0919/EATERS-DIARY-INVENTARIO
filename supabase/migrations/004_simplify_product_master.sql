-- Simplify Product Master: this is an internal restaurant procurement/inventory system, not
-- retail/POS — products are identified by name only. SKU, barcode, translations, and
-- alternate-name matching are explicitly rejected as out of scope (supplier-specific naming
-- is already covered by supplier_products.supplier_sku). Removing the underlying schema
-- rather than just hiding it in the UI, per "every field should have a real operational use."

drop table if exists product_aliases;
drop type if exists product_alias_type;

alter table products drop column if exists sku;
