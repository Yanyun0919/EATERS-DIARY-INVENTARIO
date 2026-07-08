-- RLS policies for global master-data tables (Products module and its dependencies).
-- Read: any active staff member. Write (insert/update): admin or manager role only.
-- No delete policies anywhere — this app never hard-deletes; products are disabled via
-- is_active instead, matching the RESTRICT-heavy deletion policy in 001.

create function is_active_staff() returns boolean as $$
  select exists (
    select 1 from staff_profiles sp
    where sp.user_id = auth.uid() and sp.is_active
  );
$$ language sql stable security definer set search_path = public;

create function is_active_staff_writer() returns boolean as $$
  select exists (
    select 1 from staff_profiles sp
    where sp.user_id = auth.uid() and sp.is_active and sp.role in ('admin', 'manager')
  );
$$ language sql stable security definer set search_path = public;

-- categories
create policy "staff can read categories" on categories for select using (is_active_staff());
create policy "writers can insert categories" on categories for insert with check (is_active_staff_writer());
create policy "writers can update categories" on categories for update using (is_active_staff_writer()) with check (is_active_staff_writer());

-- units
create policy "staff can read units" on units for select using (is_active_staff());
create policy "writers can insert units" on units for insert with check (is_active_staff_writer());
create policy "writers can update units" on units for update using (is_active_staff_writer()) with check (is_active_staff_writer());

-- products
create policy "staff can read products" on products for select using (is_active_staff());
create policy "writers can insert products" on products for insert with check (is_active_staff_writer());
create policy "writers can update products" on products for update using (is_active_staff_writer()) with check (is_active_staff_writer());

-- product_unit_conversions
create policy "staff can read product_unit_conversions" on product_unit_conversions for select using (is_active_staff());
create policy "writers can insert product_unit_conversions" on product_unit_conversions for insert with check (is_active_staff_writer());
create policy "writers can update product_unit_conversions" on product_unit_conversions for update using (is_active_staff_writer()) with check (is_active_staff_writer());
create policy "writers can delete product_unit_conversions" on product_unit_conversions for delete using (is_active_staff_writer());

-- product_aliases
create policy "staff can read product_aliases" on product_aliases for select using (is_active_staff());
create policy "writers can insert product_aliases" on product_aliases for insert with check (is_active_staff_writer());
create policy "writers can update product_aliases" on product_aliases for update using (is_active_staff_writer()) with check (is_active_staff_writer());
create policy "writers can delete product_aliases" on product_aliases for delete using (is_active_staff_writer());

-- suppliers
create policy "staff can read suppliers" on suppliers for select using (is_active_staff());
create policy "writers can insert suppliers" on suppliers for insert with check (is_active_staff_writer());
create policy "writers can update suppliers" on suppliers for update using (is_active_staff_writer()) with check (is_active_staff_writer());

-- supplier_products
create policy "staff can read supplier_products" on supplier_products for select using (is_active_staff());
create policy "writers can insert supplier_products" on supplier_products for insert with check (is_active_staff_writer());
create policy "writers can update supplier_products" on supplier_products for update using (is_active_staff_writer()) with check (is_active_staff_writer());
create policy "writers can delete supplier_products" on supplier_products for delete using (is_active_staff_writer());

-- every authenticated user needs to be able to read their own staff profile (and role) to
-- pass the checks above and to drive role-based UI
create policy "staff can read own profile" on staff_profiles for select using (user_id = auth.uid());
