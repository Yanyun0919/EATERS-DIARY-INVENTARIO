# products

Master Data: the product catalog. Global across the company (not per-store or per-brand).

Deliberately minimal — internal procurement/inventory, not retail/POS. Products are identified
by name only; no SKU, barcode, or alternate-name/translation matching (removed entirely in
`004_simplify_product_master.sql`, not just hidden). Every field on the Product Master must have
a real operational use. Designed to let restaurant staff create a product in ~15–20 seconds.

Product Master fields (`005_product_master_freeze.sql`): required Name, Category, Inventory Unit,
Minimum Stock; optional Default Supplier, Default Purchase Price (a lightweight single-value
reference, not synced with the full multi-supplier catalog below); automatic Active/timestamps.
Inventory Unit is restricted to 4 values — unidad, kg, g, ml (`006_restrict_inventory_units.sql`)
— packaging units belong to purchasing, not inventory.

Implemented: list (search by name, category filter, active/inactive filter), add, edit,
disable/enable (soft delete via `is_active` — never hard-deleted), per-product unit conversions,
and supplier relationships (price/SKU/MOQ/lead time/IVA/preferred/available per supplier —
supplier-specific SKU lives on `supplier_products.supplier_sku`, not on the product itself).

Write access (create/edit/disable, and all sub-resource edits) is restricted to Admin/Manager
roles; Staff has read-only access. Enforced at the database level via RLS policies
(`002_master_data_rls_policies.sql`) plus base table grants (`003_master_data_grants.sql` — RLS
alone isn't sufficient, Postgres rejects the query before RLS runs without a grant), mirrored in
the UI via `useStaffProfile().canWriteMasterData`.

Categories, Units, and Suppliers are only read here (dropdowns/filters) — their own CRUD screens
are a separate future step in the Master Data module.
