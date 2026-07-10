-- FINAL RBAC for Version 1. Replaces the previous admin/manager/staff model completely with
-- four roles: administrator, purchasing, retail_store, production_center. Permissions are
-- based on (1) role and (2) assigned store via staff_stores — see the design freeze doc.
--
-- Mechanics: this migration cannot edit 002/003 (already applied), so:
--   - is_active_staff_writer() is CREATE OR REPLACEd (not renamed) — every existing 002 policy
--     that already calls it by name automatically inherits the new logic below. It now means
--     "administrator or purchasing", which happens to be exactly the writer set 002 needs for
--     categories/units/products/suppliers/supplier_products (Product Management + Supplier
--     Management share the same writers).
--   - is_active_staff() is untouched (no role literals in its body) — still correctly means
--     "any active staff, any role", used where reference data must stay readable across
--     modules (e.g. Stock Count needs to read the product catalog even though "Product
--     Management" as an editing module isn't in Retail Store's/Production Center's list).
--   - Two 002 read policies (suppliers, supplier_products) are too permissive under the new
--     model — Retail Store/Production Center have no reason to read supplier data. Those are
--     dropped and recreated here; 002's file itself is untouched.

-- ============================================================
-- ROLE MODEL: replace admin/manager/staff with the four final roles
-- ============================================================

alter table staff_profiles rename column role to role_old;

create type staff_role_new as enum ('administrator', 'purchasing', 'retail_store', 'production_center');

alter table staff_profiles add column role staff_role_new;

-- only 'admin' → 'administrator' is mapped; if any row has 'manager'/'staff' this intentionally
-- fails the NOT NULL constraint below rather than silently guessing a new role for a real person
update staff_profiles set role = case role_old
  when 'admin' then 'administrator'::staff_role_new
  else null
end;

alter table staff_profiles alter column role set not null;
alter table staff_profiles drop column role_old;

drop type staff_role;
alter type staff_role_new rename to staff_role;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function current_staff_role() returns staff_role as $$
  select sp.role from staff_profiles sp where sp.user_id = auth.uid() and sp.is_active limit 1;
$$ language sql stable security definer set search_path = public;

-- redefines the function 002's policies already call — see header note
create or replace function is_active_staff_writer() returns boolean as $$
  select current_staff_role() in ('administrator', 'purchasing');
$$ language sql stable security definer set search_path = public;

create or replace function is_administrator() returns boolean as $$
  select current_staff_role() = 'administrator';
$$ language sql stable security definer set search_path = public;

create or replace function is_internal_products_writer() returns boolean as $$
  select current_staff_role() in ('administrator', 'production_center');
$$ language sql stable security definer set search_path = public;

-- Retail Store can view (not write) the internal product catalog to build supply requests
create or replace function can_view_internal_products() returns boolean as $$
  select current_staff_role() in ('administrator', 'production_center', 'retail_store');
$$ language sql stable security definer set search_path = public;

create or replace function can_view_supplier_management() returns boolean as $$
  select current_staff_role() in ('administrator', 'purchasing');
$$ language sql stable security definer set search_path = public;

create or replace function can_access_internal_supply() returns boolean as $$
  select current_staff_role() in ('administrator', 'retail_store', 'production_center');
$$ language sql stable security definer set search_path = public;

-- administrator sees every store; everyone else only stores they're assigned to via staff_stores
create or replace function has_store_access(target_store_id uuid) returns boolean as $$
  select current_staff_role() = 'administrator'
    or exists (
      select 1 from staff_stores ss
      join staff_profiles sp on sp.id = ss.staff_profile_id
      where sp.user_id = auth.uid() and sp.is_active and ss.store_id = target_store_id
    );
$$ language sql stable security definer set search_path = public;

create or replace function can_access_internal_supply_request(request_id uuid) returns boolean as $$
  select exists (
    select 1 from internal_supply_requests r
    where r.id = request_id
      and can_access_internal_supply()
      and (has_store_access(r.from_store_id) or has_store_access(r.to_store_id))
  );
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- FIX OVER-PERMISSIVE 002 POLICIES (Supplier Management is Administrator/Purchasing only)
-- ============================================================

drop policy "staff can read suppliers" on suppliers;
create policy "purchasing can read suppliers" on suppliers for select using (can_view_supplier_management());

drop policy "staff can read supplier_products" on supplier_products;
create policy "purchasing can read supplier_products" on supplier_products for select using (can_view_supplier_management());

-- ============================================================
-- STORE MANAGEMENT (Administrator-only write; any active staff can read store names)
-- ============================================================

create policy "staff can read stores" on stores for select using (is_active_staff());
create policy "administrators can insert stores" on stores for insert with check (is_administrator());
create policy "administrators can update stores" on stores for update using (is_administrator()) with check (is_administrator());

grant select, insert, update on public.stores to authenticated;

-- ============================================================
-- USER MANAGEMENT (Administrator-only; 002 already has "read own profile")
-- ============================================================

create policy "administrators can read all profiles" on staff_profiles for select using (is_administrator());
create policy "administrators can insert profiles" on staff_profiles for insert with check (is_administrator());
create policy "administrators can update profiles" on staff_profiles for update using (is_administrator()) with check (is_administrator());

grant insert, update on public.staff_profiles to authenticated;

-- store assignment: users can see their own assignments; administrators manage all
create policy "staff can read own store assignments" on staff_stores for select
  using (
    is_administrator()
    or exists (select 1 from staff_profiles sp where sp.id = staff_stores.staff_profile_id and sp.user_id = auth.uid())
  );
create policy "administrators can insert store assignments" on staff_stores for insert with check (is_administrator());
create policy "administrators can update store assignments" on staff_stores for update using (is_administrator()) with check (is_administrator());
create policy "administrators can delete store assignments" on staff_stores for delete using (is_administrator());

grant select, insert, update, delete on public.staff_stores to authenticated;

-- ============================================================
-- INTERNAL PRODUCTS (Administrator/Production Center write; + Retail Store can view)
-- ============================================================

create policy "internal roles can read internal_product_categories" on internal_product_categories for select using (can_view_internal_products());
create policy "internal writers can insert internal_product_categories" on internal_product_categories for insert with check (is_internal_products_writer());
create policy "internal writers can update internal_product_categories" on internal_product_categories for update using (is_internal_products_writer()) with check (is_internal_products_writer());

create policy "internal roles can read internal_products" on internal_products for select using (can_view_internal_products());
create policy "internal writers can insert internal_products" on internal_products for insert with check (is_internal_products_writer());
create policy "internal writers can update internal_products" on internal_products for update using (is_internal_products_writer()) with check (is_internal_products_writer());

grant select, insert, update on public.internal_product_categories to authenticated;
grant select, insert, update on public.internal_products to authenticated;

-- ============================================================
-- INTERNAL SUPPLY (Administrator/Retail Store/Production Center, scoped to assigned stores)
-- ============================================================

create policy "internal supply roles can read requests" on internal_supply_requests for select
  using (can_access_internal_supply() and (has_store_access(from_store_id) or has_store_access(to_store_id)));
create policy "internal supply roles can insert requests" on internal_supply_requests for insert
  with check (can_access_internal_supply() and (has_store_access(from_store_id) or has_store_access(to_store_id)));
create policy "internal supply roles can update requests" on internal_supply_requests for update
  using (can_access_internal_supply() and (has_store_access(from_store_id) or has_store_access(to_store_id)))
  with check (can_access_internal_supply() and (has_store_access(from_store_id) or has_store_access(to_store_id)));

create policy "internal supply roles can read items" on internal_supply_items for select
  using (can_access_internal_supply_request(internal_supply_request_id));
create policy "internal supply roles can insert items" on internal_supply_items for insert
  with check (can_access_internal_supply_request(internal_supply_request_id));
create policy "internal supply roles can update items" on internal_supply_items for update
  using (can_access_internal_supply_request(internal_supply_request_id))
  with check (can_access_internal_supply_request(internal_supply_request_id));

grant select, insert, update on public.internal_supply_requests to authenticated;
grant select, insert, update on public.internal_supply_items to authenticated;
