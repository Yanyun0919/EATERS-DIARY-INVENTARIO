-- Base PostgreSQL table privileges for the Products (Master Data) module.
--
-- Root cause: 001/002 enabled RLS and wrote policies, but never granted base table
-- privileges to the `anon`/`authenticated` Postgres roles. RLS only filters rows on an
-- operation the role is already permitted to attempt at the SQL level — without a GRANT,
-- Postgres rejects the query before RLS is ever evaluated (42501 permission denied).
-- This migration adds exactly those grants. It does not create, drop, or alter any RLS
-- policy — 001 and 002 are untouched and still the sole source of row-level access rules.
--
-- Grants are explicit per table (not `grant ... on all tables in schema public`) and
-- scoped to the operations each table's existing RLS policies actually support — granting
-- a privilege with no matching policy would be inert, so it's left out rather than added
-- "just in case". Any future master-data table must add its own explicit grants alongside
-- its RLS policies in that table's own migration.
--
-- `anon` gets nothing: this app has no unauthenticated data access — the login screen only
-- calls the Supabase Auth API, never a table query — so granting anon any table privilege
-- here would be excess, not minimum, privilege.

grant usage on schema public to authenticated;

-- brands: no RLS policy exists yet (out of scope for 002), so these grants are inert until
-- a future migration adds one — included because Products' Master Data scope names Brands,
-- and granting now avoids a second grants migration when that policy lands.
grant select, insert, update on public.brands to authenticated;

grant select, insert, update on public.categories to authenticated;
grant select, insert, update on public.units to authenticated;
grant select, insert, update on public.products to authenticated;

-- true child rows (fully owned by their parent product), hard-deletable per 002's policies
grant select, insert, update, delete on public.product_unit_conversions to authenticated;
grant select, insert, update, delete on public.product_aliases to authenticated;

grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update, delete on public.supplier_products to authenticated;

-- staff_profiles: only a "read own profile" policy exists (002) — no insert/update/delete
-- policy, so no such grants are added; profile management stays admin/SQL-only for now
grant select on public.staff_profiles to authenticated;
