# Database Design

Source of truth: `supabase/migrations/001_initial_schema.sql`. This doc explains the *why* behind
choices that aren't obvious from the SQL alone.

Eaters Diary is an internal restaurant **procurement and inventory management system**, not a
general ERP/POS/customer-facing system. Every table below exists to serve one of four goals:
Inventory, Stock Count, Purchasing (external and internal), Analytics. See the project scope
memory for the full exclusion list (POS, customer/CRM, scheduling, payroll, invoice/receiving
workflow, etc.).

## Scope decisions

- **Single currency (EUR).** No currency column anywhere; all money columns are plain `numeric`.
- **Spain-specific fields included now:** `nif_cif` on `brands` and `suppliers`; `iva_rate` on
  `supplier_products` and `purchase_order_items` (typical hospitality rates: 21% / 10% / 4%).
  Added now rather than later to avoid a migration once accounting needs it.
- **Products are global**, shared across all Brands/Stores. **Recipes belong to a Brand**
  (menus differ per concept). **Inventory is always per-Store.**
- **`inventory` holds only the current balance.** Every change is written to
  `inventory_movements` first (append-only audit trail); `inventory.quantity_on_hand` is a
  maintained cache, not the source of truth.
- **Recipes/RecipeIngredients are costing-only.** They exist to price out menu/prep items.
  There is no link from a Recipe to inventory deduction and no POS/sales integration — that
  would require a POS, which is explicitly out of scope. If ever needed, it would require a new
  design pass and an explicit request, not an assumed "future phase."
- **No file/attachment storage.** The system intentionally does not store product images, stock
  count photos, waste photos, invoices, or delivery notes. Out of scope by design.
- **Internal Purchasing (`store_transfers`/`transfer_items`) carries its own internal pricing**
  (`transfer_items.unit_price` / generated `line_total`), separate from `iva_rate` — these are
  movements between the company's own stores (e.g. central kitchen → restaurant), not external
  supplier invoices, so no tax rate applies.

## Table groups

1. **Organization** — `brands`, `stores`, `staff_profiles` (1:1 with `auth.users`),
   `staff_stores` (many-to-many, supports staff working across multiple stores).
2. **Catalog** — `categories` (self-referencing tree), `units` (seeded with 11 common units —
   kg, g, L, ml, piece, case, box, bag, pack, bottle, can — so the system is usable immediately
   after deployment without manual setup), `products`, `product_unit_conversions` (conversion
   factors are per-product, not global — a case of product A ≠ a case of product B),
   `product_aliases` (multilingual names, supplier-specific names, barcodes — powers product
   search/matching; no OCR/document-scanning support, that would edge into the excluded invoice
   workflow), `recipes`, `recipe_ingredients` (costing only, see Scope decisions above).
3. **Suppliers & purchasing** — `suppliers` (contact/legal info only), `supplier_products`
   (many-to-many join carrying price, SKU, MOQ, lead time, IVA rate, availability per
   supplier+product), `supplier_price_history` (price over time, sourced either from a manual
   price-list update or from a received PO item — a check constraint requires
   `purchase_order_item_id` to be set for `po_item` source and null for `manual_update`, mirroring
   the same pattern used on `inventory_movements`), `purchase_orders`, `purchase_order_items`.
4. **Stock counts** — `stock_counts`, `stock_count_items` (variance is a generated column:
   `counted_quantity - expected_quantity`).
5. **Internal purchasing (store transfers)** — `store_transfers` (cross-brand allowed by design,
   e.g. central kitchen → any store regardless of brand), `transfer_items` (carries
   `unit_price` + generated `line_total` — the internal valuation of the movement).
6. **Waste** — `waste_records`, reason-coded (damaged / expired / employee_meal / other). Feeds
   both Inventory (a properly categorized movement, not a generic manual adjustment) and
   Analytics (loss/shrinkage reporting).
7. **Inventory** — `inventory` (current balance), `inventory_movements` (audit trail; a check
   constraint requires the matching source-document FK to be set for `purchase_receipt`,
   `transfer_in`/`transfer_out`, `stock_count_adjustment`, and `waste` movement types).
   `reason` (nullable `inventory_movement_reason` enum) is mainly for `manual_adjustment` rows —
   the other movement types already carry an implicit reason via their linked source document
   (a waste movement's reason lives on `waste_records.reason`, etc.), so `reason` is left null
   for those rather than duplicating it.

## Deletion policy

- **Master/catalog data** (brands, stores, staff, categories, units, products, suppliers,
  recipes) uses `ON DELETE RESTRICT` on incoming references — these are meant to be deactivated
  via `is_active`, not deleted, once referenced elsewhere.
- **Line items fully owned by a parent document** (purchase_order_items, recipe_ingredients,
  transfer_items, staff_stores) use `ON DELETE CASCADE` from their parent.
- **Audit trail source references** on `inventory_movements` and `supplier_price_history` use
  `ON DELETE RESTRICT` — once a movement or price-history row cites a document, that document
  cannot be deleted out from under it.

## Row Level Security

RLS is **enabled on every table with no policies yet** — this is deny-by-default (only the
Supabase service role bypasses RLS). Role-scoped policies for Admin / Manager / Staff, and
store-scoping via `staff_stores`, are intentionally a separate follow-up migration once the app
layer needs real read/write access.

## Open follow-ups (not yet implemented)

- RLS policies per role/store.
- Automatic purchase suggestion logic (computed from `inventory.par_level`/`reorder_point` vs.
  `supplier_products`) — this is an application-layer feature over existing tables, no schema
  change anticipated.
- Analytics — read-only queries/views over `purchase_order_items`, `supplier_price_history`,
  `inventory_movements`, `waste_records`, `stock_count_items`; no new tables anticipated.
