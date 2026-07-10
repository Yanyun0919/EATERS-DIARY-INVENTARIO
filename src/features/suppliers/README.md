# suppliers

Master Data: Supplier Management, split out from Products per the 2026-07-09 architecture
review — "Supplier relationships belong to Supplier Management, NOT Product Management."

Owns: supplier core data (name, contact, NIF/CIF, payment terms), and the full
`supplier_products` relationship — which products a supplier supplies, at what price, in what
Purchase Unit, with what MOQ/lead time/IVA, and whether it's the preferred supplier for that
product. "Default supplier relationship" is `supplier_products.is_preferred` (DB-enforced one
preferred supplier per product via a partial unique index) — there is no separate
`products.default_supplier_id`; that field was tried and removed as a redundant, unsynced
duplicate of this.

Purchase Unit (`supplier_products.purchase_unit` + `purchase_unit_spec`) is a simple descriptive
enum — kg / g / L / ml / Other (free text, e.g. "24 cans/box") — not a reference to the Inventory
Unit catalog and not used for any automated conversion. It only indicates the purchasing
specification; inventory calculations always use Inventory Units (see `features/products`).

Implemented: supplier list (search, active/inactive filter), add, edit, disable/enable (soft
delete via `is_active`), and the products-supplied editor on the supplier detail page.

Write access is restricted to Admin/Manager roles, same pattern as Products
(`useStaffProfile().canWriteMasterData`), enforced via the same RLS policies + grants
(`002_master_data_rls_policies.sql`, `003_master_data_grants.sql` — those already cover
`suppliers` and `supplier_products` generically, no new policy/grant migration needed for this
module split).

Products are only read here (the "add product" picker) — Product Management owns product CRUD.
