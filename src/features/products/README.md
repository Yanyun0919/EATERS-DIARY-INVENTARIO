# products

Master Data: the product catalog. Global across the company (not per-store or per-brand).

Implemented: list (search, category filter, active/inactive filter), add, edit, disable/enable
(soft delete via `is_active` — never hard-deleted), base unit selection, per-product unit
conversions, supplier relationships (price/SKU/MOQ/lead time/IVA/preferred/available per
supplier), and alternate names (translations, barcodes, supplier-specific names).

Write access (create/edit/disable, and all sub-resource edits) is restricted to Admin/Manager
roles; Staff has read-only access. Enforced at the database level via RLS policies in
`supabase/migrations/002_master_data_rls_policies.sql`, and mirrored in the UI via
`useStaffProfile().canWriteMasterData`.

Categories, Units, and Suppliers are only read here (dropdowns/filters) — their own CRUD screens
are a separate future step in the Master Data module.
