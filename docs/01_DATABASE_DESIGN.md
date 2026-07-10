# Database Design

Source of truth: `supabase/migrations/*.sql`. This doc explains the *why* and gives the full
current picture; the SQL files are authoritative for exact syntax. **As of this writing,
migrations 001–011 are applied; migration 012 (Permission Model Correction) is written and
reviewed but not yet applied** — this document describes the design 012 implements, pending
that final apply-and-verify step.

Eaters Diary is an internal restaurant **operations system covering procurement and internal
supply**, not a general ERP/POS/customer-facing system. Restaurant-first design principles apply
throughout: simplicity over features, speed over completeness, low training cost, minimal manual
input, minimal manual errors. Whenever there's a choice between adding a feature and simplifying
a workflow, simplify. See the project scope memory for the full company-wide exclusion list
(POS, customer/CRM, scheduling, payroll, invoice/receiving workflow, etc.).

## Module structure (frozen for V1)

1. **Product Management** — externally purchased raw materials only (Chicken, Flour, Coca-Cola).
2. **Internal Products** — manufactured by Production Centers (Gangnam Sauce, Honey Mustard).
   Completely independent from Product Management; never appears there.
3. **Supplier Management** — supplier info, supplier↔product relationships, purchase
   prices/specifications. External purchasing only.
4. **Stock Count** — physical counting. Externally purchased products only (Internal Products
   are explicitly not counted in V1).
5. **Purchasing** — supplier → purchase → inventory update. No goods-receipt step.
6. **Internal Supply** — store-to-store transfer of Internal Products, gated by per-store
   operational permissions rather than a fixed direction (see RBAC below). Completely
   independent from Purchasing; not modeled as a purchase, not modeled as suppliers.
7. **Business Insights** — reporting, split into External Purchasing analytics and Internal
   Supply analytics, kept deliberately separate (that separation is the whole reason Internal
   Products has its own catalog).

Only Product Management and Supplier Management have a built UI as of this writing (see
`src/features/products`, `src/features/suppliers`). The rest are schema-only.

## User roles & permissions (RBAC)

Two layers, not one — this is the most-revised part of the design (migration 012 corrected
migration 011's initial approach) and worth understanding precisely.

### Layer 1 — Master Data: role-based, Administrator only

`staff_profiles.role` is `administrator` | `purchasing` | `retail_store` | `production_center`
(migration 011, replacing an earlier admin/manager/staff model). **Master Data — Product
Management, Internal Products, Supplier Management, Store Management, User Management — is
Administrator-only to write, full stop** (migration 012 tightened this; 011 had briefly allowed
Purchasing to also write Product/Supplier Management, which was corrected). Every other role,
including Purchasing, only *reads* Master Data as reference (e.g. Purchasing selects from an
Administrator-curated supplier/product catalog when creating purchase orders — it doesn't
maintain that catalog itself).

`retail_store`/`production_center` **remain as enum values but are now purely descriptive
labels with no functional permission meaning** — kept only to avoid a third enum-recreation
migration on an already-applied type (see migration history: `store_type` and `staff_role` each
already needed the full rename/recreate/swap dance once). Nothing in Internal Supply reads
`current_staff_role()` for retail_store/production_center anymore — that's Layer 2.

### Layer 2 — Internal Supply: store-based, not role-based or account-based

This is the actual correction migration 012 makes. **Operational capabilities belong to the
*store*, not to the login account and not to the account's role.** A login account is just a
way to access the system — an Administrator creates accounts, assigns each to one or more
stores (`staff_stores`, many-to-many since 001 — this already correctly supports one store
with multiple accounts, and staff replacement without touching business permissions), and
separately configures what each *store* is allowed to do (`store_permissions`, keyed to a
`permission_definitions` lookup table rather than an enum — see Database schema below). An
account's effective capability at a given store is entirely inherited from that store's
configuration.

Example: CCC Amparo and MR.SANDO are both granted `internal_supply_request` **and**
`internal_supply_fulfillment` (either can request from or fulfill for the other); Lavapiés is
granted `internal_supply_request` only (can request, cannot fulfill). Any account assigned to
Lavapiés inherits exactly that — regardless of the account's `role` value.

**Internal Supply status-based write rules** (still enforced, now via store-permission checks
instead of role checks):
- **Pending** → the requesting store may cancel (pending → cancelled only, nothing else).
- **Preparing** → the requesting store can no longer modify or cancel.
- **Shipped** / **Cancelled** → read-only for everyone except Administrator.
- The fulfilling store (accept/prepare/edit shipped quantity/ship) needs
  `internal_supply_fulfillment` on its store; unrestricted by status except by the state
  machine itself.

### Why two layers instead of one

Master Data (pricing, catalog structure) is sensitive and centrally controlled — role-based,
Administrator-only is the right fit. Internal Supply is *operational* and needs to scale to many
stores with heterogeneous capabilities without a schema change per store — store-based
permissions (a data problem: which rows exist in `store_permissions`) solve that; role-based
permissions (a schema problem: which enum values exist) would not have.

Future operational permissions (a "Waste Reporting" capability, a "Purchasing" capability for
stores, etc.) are added the same way `internal_supply_request`/`internal_supply_fulfillment`/
`stock_count` were: a new row in `permission_definitions`, then RLS policies that check it — no
migration needed for the permission *definition* itself, only for whatever new logic it gates.

## Business workflows

### Purchasing (schema built, UI not yet built)
```
Supplier → Purchase → Update inventory
```
No goods-receipt step — the purchaser is also the receiver. `purchase_order_items` already
captures both `quantity_ordered` (suggested/ordered) and `quantity_received` (actual), the same
pattern Internal Supply reuses for requested-vs-shipped.

### Stock Count (schema built, UI not yet built)
Physical count is the source of truth for inventory — `inventory.quantity_on_hand` is never
computed from purchase/sales math, only from the latest count plus completed purchases and
approved adjustments since (all flowing through `inventory_movements`).

### Internal Supply (V1 — deliberately minimal, no inventory involved at all)
```
Requesting store (needs internal_supply_request permission) → create Internal Supply Request
→ select fulfilling store → select Internal Products → enter Requested Quantity → send

Fulfilling store (needs internal_supply_fulfillment permission) → review request →
(preparing) → modify Actual Shipped Quantity → ship
```
"Retail Store"/"Production Center" in earlier drafts of this doc described the *typical* case,
not a hard rule — see RBAC Layer 2 above. Any store granted the right permission can be either
party; CCC Amparo and MR.SANDO can both request from and fulfill for each other.
The system stores Requested Quantity, Actual Shipped Quantity, and a snapshotted Internal
Selling Price. Settlement amount = Actual Shipped Quantity × Internal Selling Price (a safe
generated column, since — unlike the product-level selling price — it's never manually
overridden). Example: requested 10, shipped 5, price €3.20 → amount €16.00, representing the
internal cost charged to the Retail Store.

**Explicitly excluded from V1:** production output tracking, internal inventory, internal stock
count, waste tracking, production planning, recipes, BOM. If asked to add any of these, confirm
scope expansion first rather than building it — it was excluded deliberately, not by omission.

## Database schema by module

### Organization
- **`brands`** — owns stores.
- **`stores`** — `type` is `production_center` | `retail_store` (migration 008 replaced
  placeholder values `restaurant`/`warehouse`/`central_kitchen` that predated any real Store
  Management). `code` (e.g. `CCC-AMP`, `CCC-TET`, `MS-LAV`) existed since 001 but was optional;
  migration 008 makes it required — useful for reporting, exports, and future integrations.
  Store Management (create/edit/disable/assign users/change type) is Administrator-only.
- **`staff_profiles`** — 1:1 with `auth.users`. `role` is `administrator` | `purchasing` |
  `retail_store` | `production_center` (migration 011). `is_active` already existed since 001 —
  users are deactivated, never deleted, same pattern as every other table.
- **`staff_stores`** — many-to-many staff↔store, the mechanism for all store-scoped RLS.
- **`permission_definitions`** (migration 012) — lookup table for operational permission keys:
  `key` (text, PK), `module` (plain text grouping label — e.g. "Internal Supply", "Inventory" —
  not its own table, since the module set is the already-frozen 7-module V1 architecture, a far
  more stable vocabulary than individual permission keys), `name`, `description`, `is_active`,
  `sort_order`. A lookup table rather than a Postgres enum specifically because this project
  already paid the enum-recreation cost twice (`store_type`, `staff_role`) — new permissions,
  renames, and disables now happen via plain INSERT/UPDATE, no migration. Seeded with
  `internal_supply_request`, `internal_supply_fulfillment`, `stock_count`.
- **`store_permissions`** (migration 012) — `store_id` + `permission_key` (FK into
  `permission_definitions`), `granted_by`. This is where a store's actual capabilities live —
  see RBAC Layer 2 above.

### Product Management (Catalog)
- **`categories`** — self-referencing tree. Required on `products` (was optional pre-005;
  migration 005 backfills any pre-existing product with a null category into a fallback
  "Uncategorized" category rather than deleting it or requiring a manual fix first).
- **`units`** — Inventory Unit, restricted to exactly 4 values: unidad, kg, g, ml (migration
  006 trimmed an original 11-unit seed — packaging units removed, "packaging is not an
  inventory unit, packaging belongs to purchasing"). Any pre-existing row referencing a
  removed unit is auto-remapped rather than blocking the migration: liter→ml is a precise
  ×1000 conversion applied to every affected quantity column; case/box/bag/pack/bottle/can→
  unidad is a best-effort relabel only (no stored pack size to convert precisely) and worth a
  manual spot-check afterward.
- **`products`** — name-only identification, no SKU/barcode/alias/translation (all built, then
  removed entirely in migration 004 — schema-level removal, not UI-hiding, once confirmed
  out of scope). Required: Name, Category, Inventory Unit, Minimum Stock. Optional: Default
  Supplier, Default Purchase Price — a lightweight single-value reference, intentionally not
  synced with `supplier_products.is_preferred`/`unit_price` (Supplier Management's more
  detailed per-supplier relationship); the two are allowed to disagree. Minimum Stock is
  product-level, not per-store (`inventory.par_level`/`reorder_point` were dropped in the same
  migration, 005, as redundant once this single value exists).
- **`recipes`**, **`recipe_ingredients`** — costing-only, brand-scoped. No link to inventory
  deduction or POS/sales; that would require a POS, which is out of scope.

### Internal Products (independent catalog — migration 009)
- **`internal_product_categories`** — separate from `categories`, flat (no hierarchy), admin
  and Production Center managed.
- **`internal_products`** — Name, Category, **Inventory Unit** (same restricted 4-value list as
  Product Management, added per explicit decision — "for operational clarity even though V1
  does not manage Internal Product inventory"), **Default Production Center** (→ `stores`,
  required — which Production Center normally makes this product, e.g. Gangnam Sauce → CCC
  Amparo; simplifies Internal Supply routing by default-selecting it when a Retail Store starts
  a request; that the referenced store is actually a production_center is app-enforced, not a
  DB constraint), Cost Price, Margin %, Internal Selling Price (**manually editable, not a
  generated column** — margin gives an initial suggestion, managers can override and that
  override must persist independent of later cost/margin changes), Active.

### Supplier Management
- **`suppliers`** — contact/legal info only.
- **`supplier_products`** — many-to-many join: price, MOQ, lead time, IVA rate, availability,
  `is_preferred` (DB-enforced one-preferred-supplier-per-product via partial unique index).
  Purchase Unit (migration 007) is a simple descriptive enum — kg/g/L/ml/other + free-text spec
  when "other" (e.g. "24 cans/box") — decoupled entirely from the Inventory Unit `units` table
  and not used for any automated conversion; it only indicates the purchasing specification.
  `product_unit_conversions` (the original per-product unit-conversion table) was dropped in
  the same migration once Purchase Unit stopped referencing `units` — nothing left to convert.
- **`supplier_price_history`** — price over time, sourced from a manual update or a received PO
  item (check constraint enforces which).
- **`purchase_orders`**, **`purchase_order_items`** — see Purchasing workflow above.

### Stock Count
- **`stock_counts`**, **`stock_count_items`** — variance is a generated column
  (`counted_quantity - expected_quantity`). Scoped to `products` only — Internal Products are
  not counted in V1.

### Internal Supply (migration 010)
- **`internal_supply_requests`** — `from_store_id`/`to_store_id` (both → `stores`), `status`
  (`pending` | `preparing` | `shipped` | `cancelled` — `preparing` is Production Center staff
  actively preparing the order before shipment; still no separate receipt-confirmation state,
  matching "no goods-receipt" simplification), `requested_by`.
- **`internal_supply_items`** — `internal_product_id`, `quantity_requested`, `quantity_shipped`,
  snapshotted `internal_selling_price`, generated `settlement_amount`.

### Store Transfers (schema exists, intentionally dormant)
- **`store_transfers`**, **`transfer_items`** — the *original* general-purpose store-to-store
  transfer tables (predate Internal Supply). Explicitly **not** repurposed for Internal Supply —
  kept as-is, reserved for a possible future need to move regular Products between stores
  outside of Purchasing. Cross-brand allowed by design.

### Waste
- **`waste_records`** — reason-coded (damaged/expired/employee_meal/other). Feeds both
  Inventory (a properly categorized movement, not a generic manual adjustment) and Analytics.

### Inventory
- **`inventory`** — current balance only, per Store+Product. Not a source of truth in itself —
  see Stock Count workflow above.
- **`inventory_movements`** — append-only audit trail. A check constraint requires the matching
  source-document FK for `purchase_receipt`, `transfer_in`/`transfer_out`,
  `stock_count_adjustment`, and `waste` movement types. `reason` (nullable) is mainly for
  `manual_adjustment` rows — other movement types carry an implicit reason via their linked
  source document already.

## Scope decisions

- **Single currency (EUR).** No currency column anywhere.
- **Spain-specific fields:** `nif_cif` on `brands`/`suppliers`; `iva_rate` on
  `supplier_products`/`purchase_order_items` (typical hospitality rates: 21%/10%/4%).
- **Products are global**, shared across all Brands/Stores. Recipes belong to a Brand.
  Inventory is always per-Store. Internal Products are global (no brand scoping specified).
- **No file/attachment storage** — no product images, count photos, invoices, delivery notes.
- **Every field must have a real operational use** — the guiding principle behind every removal
  above (SKU, barcode, aliases, `product_unit_conversions`, `inventory.par_level`/`reorder_point`).
  When something is rejected, the schema is changed to remove it, not just hidden in the UI.

## Deletion policy

- **Master/catalog data** (brands, stores, staff, categories, units, products, internal
  products/categories, suppliers, recipes) uses `ON DELETE RESTRICT` — deactivate via
  `is_active`, never delete, once referenced elsewhere.
- **Line items fully owned by a parent document** (purchase_order_items, recipe_ingredients,
  transfer_items, internal_supply_items, staff_stores) use `ON DELETE CASCADE` from their parent.
- **Audit trail source references** on `inventory_movements` and `supplier_price_history` use
  `ON DELETE RESTRICT` — a cited document can never be deleted out from under a movement/price
  record.

## Row Level Security & grants

RLS is enabled on every table. Two layers are both required — a base PostgreSQL table `GRANT`
(without one, Postgres rejects the query before RLS is even evaluated) and an RLS policy (which
filters rows). Helper functions (`security definer`, so they can read `staff_profiles`/
`staff_stores` regardless of the calling user's own row visibility):

| Function | Meaning |
|---|---|
| `is_active_staff()` | any active staff, any role |
| `current_staff_role()` | the caller's role, or null |
| `is_administrator()` | administrator only |
| `is_active_staff_writer()` | **as of 012: an alias for `is_administrator()`** (was administrator/purchasing in 011, tightened — Master Data is Administrator-only). Redefined via `CREATE OR REPLACE`, not renamed, so every 002 policy that already calls it by name inherits the change automatically |
| `is_internal_products_writer()` | **as of 012: also an alias for `is_administrator()`** (was administrator/production_center in 011, same tightening) |
| `can_view_internal_products()` | administrator, production_center, or retail_store (read-only reference — Retail Store needs to see the catalog to build Internal Supply requests) |
| `can_view_supplier_management()` | administrator or purchasing |
| `has_store_access(store_id)` | administrator, or the store is one of the caller's via `staff_stores` |
| `store_has_operational_permission(store_id, permission_key)` | pure lookup — does *this store* have *this permission*, independent of who's asking |
| `can_create_supply_request(to_store_id)` | administrator, or (`has_store_access` AND that store has `internal_supply_request`) |
| `can_manage_supply_request(from_store_id)` | administrator, or (`has_store_access` AND that store has `internal_supply_fulfillment`) |
| `can_create_supply_item(request_id)` / `can_manage_supply_item(request_id)` | look up the parent request's `to_store_id`/`from_store_id` and delegate to the two functions above |

**Policy summary by table group:**
- `categories`/`units`/`products`: read = any active staff; write = **administrator only** (012).
- `suppliers`/`supplier_products`: read **and** write = administrator/purchasing (the original
  002 read policy was too permissive under the 011 role model — dropped and recreated in 011;
  write stayed administrator/purchasing in 012, unlike the other Master Data tables, since
  Purchasing's whole job is this catalog).
- `stores`: read = any active staff; write = administrator only.
- `staff_profiles`/`staff_stores`: read own row, or administrator reads all; write =
  administrator only.
- `internal_product_categories`/`internal_products`: read = administrator/production_center/
  retail_store; write = **administrator only** (012 — was administrator/production_center in 011).
- `permission_definitions`: read = any active staff; write = administrator only.
- `store_permissions`: read = any active staff; insert/delete = administrator only (no update —
  a permission is granted or revoked, not edited in place).
- `internal_supply_requests`/`internal_supply_items`: read = administrator, or any store-assigned
  account touching that store (either direction, unchanged from 011). Write = split and
  store-permission-gated (012) — see RBAC Layer 2 above for the exact insert/update rules,
  including the Pending-only cancel policy.
- Everything else (purchase_orders, purchase_order_items, supplier_price_history, stock_counts,
  stock_count_items, store_transfers, transfer_items, waste_records, inventory,
  inventory_movements, recipes, recipe_ingredients, brands): RLS enabled, **zero policies** —
  deny-by-default until each module's UI gets built and its access rules are worked out.

## Migration history

| # | What it did |
|---|---|
| 001 | Initial schema — all core tables, enums, RLS enabled (no policies), seed 11 units |
| 002 | RLS policies for Product/Supplier Management master data (admin/manager write model) |
| 003 | Base table grants for the same tables (RLS alone isn't sufficient) |
| 004 | Dropped `products.sku` and `product_aliases` — no SKU/barcode/alias/translation |
| 005 | Added `products.minimum_stock`/`default_supplier_id`/`default_purchase_price`; made `category_id` required; dropped `inventory.par_level`/`reorder_point` |
| 006 | Trimmed `units` seed to 4 (unidad/kg/g/ml); removed packaging units |
| 007 | Purchase Unit → simple enum + spec, decoupled from `units`; dropped `product_unit_conversions`; **kept** `default_supplier_id`/`default_purchase_price` (an earlier revision of this file had dropped them — reverted per final design freeze) |
| 008 | `stores.type` → production_center/retail_store; `stores.code` made required |
| 009 | `internal_product_categories` + `internal_products` (incl. required `default_production_center_id`) |
| 010 | `internal_supply_requests` (status now pending/preparing/shipped/cancelled) + `internal_supply_items` |
| 011 | Role model replacement (admin/manager/staff → administrator/purchasing/retail_store/production_center), store-scoped read access via `staff_stores`, Store/User Management policies, fixes 002's over-permissive supplier read policy |
| 012 *(written, not yet applied)* | Permission Model Correction — tightened Master Data to Administrator-only (`is_active_staff_writer()`/`is_internal_products_writer()` redefined as `is_administrator()` aliases); replaced role-based Internal Supply access with store-based (`permission_definitions` + `store_permissions`, lookup table not enum); Pending-only cancel for the requesting store |

## Open follow-ups (not yet implemented)

- UI for Store Management, User Management, Internal Products, Internal Supply, Stock Count,
  Purchasing, Business Insights — only Product Management and Supplier Management have a UI so
  far.
- RLS policies + grants for purchase_orders/stock_counts/waste_records/inventory/etc. once those
  modules' UIs get built and their access rules are worked out (likely following the same
  store-scoped pattern Internal Supply established).
- Automatic purchase suggestion logic (`products.minimum_stock` vs. current
  `inventory.quantity_on_hand`) — application-layer, no schema change anticipated.
- Business Insights — read-only queries/views over existing transactional tables, split into
  External Purchasing analytics and Internal Supply analytics; no new tables anticipated.
- Packaging/purchase units as their own concept (separate from the restricted Inventory Unit
  list) if `supplier_products.purchase_unit`'s "other" free-text spec ever needs to become
  structured — not needed yet.
- Production output / initial Internal Product inventory, internal stock count, waste tracking
  for Internal Products — all explicitly excluded from V1, not an oversight.
