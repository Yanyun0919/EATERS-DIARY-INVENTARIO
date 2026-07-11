-- Inventory & Stock Count, per docs/BUSINESS_RULES.md sections 2 and 3.
--
-- inventory / stock_counts / stock_count_items have existed since migration 001 with RLS
-- enabled and zero policies -- nobody, not even Administrator, can read or write them today.
-- This migration makes them usable and defines complete_stock_count() as the single function
-- that ever writes to `inventory`, since "Only Stock Count updates Inventory" (BUSINESS_RULES
-- section 2) and Purchasing/Internal Purchase/Internal Transfer/Waste must never touch it.
--
-- inventory_movements is deliberately left untouched -- not read, not written, not referenced
-- anywhere below. Reserved for possible future business-analysis use (BUSINESS_RULES section 7
-- discussion / section 1 scope).

-- ============================================================
-- SCHEMA CLEANUP: inventory
-- ============================================================

-- par_level/reorder_point predate products.minimum_stock (005) and were never wired into any
-- UI. unit_id is redundant since 006 restricted inventory units to exactly the 4 that map 1:1
-- to products.base_unit_id -- storing it a second time here could drift out of sync with the
-- product. last_movement_at -> last_counted_at: there are no "movements" in this design, only
-- counts (BUSINESS_RULES section 2: "Inventory is never calculated").
alter table inventory
  drop column if exists par_level,
  drop column if exists reorder_point,
  drop column if exists unit_id;

alter table inventory rename column last_movement_at to last_counted_at;

-- ============================================================
-- SCHEMA CLEANUP: stock_count_items
-- ============================================================

-- Same redundancy as inventory.unit_id above, and it was NOT NULL with no default -- every
-- insert would otherwise be forced to carry a value that's always just the product's own
-- base_unit_id.
alter table stock_count_items drop column if exists unit_id;

-- ============================================================
-- ONE ACTIVE STOCK COUNT PER STORE
-- ============================================================

create unique index if not exists stock_counts_one_in_progress_per_store_idx
  on stock_counts(store_id) where status = 'in_progress';

-- ============================================================
-- PERMISSION HELPERS (same shape as migration 012's can_create_supply_request)
-- ============================================================

-- read: anyone assigned to the store (or Administrator) can see its current stock -- same
-- viewing rule as Internal Supply.
create or replace function can_view_store_inventory(target_store_id uuid) returns boolean as $$
  select is_administrator() or has_store_access(target_store_id);
$$ language sql stable security definer set search_path = public;

-- write: only stores an Administrator has explicitly granted 'stock_count' to.
create or replace function can_manage_stock_count(target_store_id uuid) returns boolean as $$
  select is_administrator()
    or (has_store_access(target_store_id) and store_has_operational_permission(target_store_id, 'stock_count'));
$$ language sql stable security definer set search_path = public;

create or replace function can_manage_stock_count_for_count(target_count_id uuid) returns boolean as $$
  select exists (
    select 1 from stock_counts sc where sc.id = target_count_id and can_manage_stock_count(sc.store_id)
  );
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- RLS: inventory (read-only to clients; only complete_stock_count() ever writes it)
-- ============================================================

create policy "store access can read inventory" on inventory for select
  using (can_view_store_inventory(store_id));

grant select on public.inventory to authenticated;

-- ============================================================
-- RLS: stock_counts
-- ============================================================

create policy "store access can read stock counts" on stock_counts for select
  using (can_view_store_inventory(store_id));

create policy "stock count managers can start counts" on stock_counts for insert
  with check (can_manage_stock_count(store_id));

-- Clients may only cancel an in-progress count (in_progress -> cancelled). Completion is
-- exclusively done by complete_stock_count() below, which runs as security definer and bypasses
-- this policy -- a direct client UPDATE can never set status = 'completed'.
create policy "stock count managers can cancel in-progress counts" on stock_counts for update
  using (status = 'in_progress' and can_manage_stock_count(store_id))
  with check (status = 'cancelled' and can_manage_stock_count(store_id));

grant select, insert, update on public.stock_counts to authenticated;

-- ============================================================
-- RLS: stock_count_items
-- ============================================================

-- Same table for the employee counting screen and the Administrator review screen -- which
-- columns each screen requests/shows is a UI decision (BUSINESS_RULES section 3), not a
-- database one.
create policy "store access can read stock count items" on stock_count_items for select
  using (
    exists (
      select 1 from stock_counts sc
      where sc.id = stock_count_items.stock_count_id and can_view_store_inventory(sc.store_id)
    )
  );

-- Only while the parent count is in_progress -- once completed, items are read-only (audit
-- trail), matching every other "no editing history" rule in this app.
create policy "stock count managers can add items while in progress" on stock_count_items for insert
  with check (
    can_manage_stock_count_for_count(stock_count_id)
    and exists (select 1 from stock_counts sc where sc.id = stock_count_id and sc.status = 'in_progress')
  );

create policy "stock count managers can edit items while in progress" on stock_count_items for update
  using (
    can_manage_stock_count_for_count(stock_count_id)
    and exists (select 1 from stock_counts sc where sc.id = stock_count_id and sc.status = 'in_progress')
  )
  with check (
    can_manage_stock_count_for_count(stock_count_id)
    and exists (select 1 from stock_counts sc where sc.id = stock_count_id and sc.status = 'in_progress')
  );

grant select, insert, update on public.stock_count_items to authenticated;

-- ============================================================
-- COMPLETION: the single writer into `inventory`
-- ============================================================

-- Captures expected_quantity from the current inventory value (before it's overwritten), sets
-- inventory.quantity_on_hand to what was counted, and marks the count completed -- all in one
-- transaction. This is the only path that ever changes `inventory`, and the only path that ever
-- populates expected_quantity, so an employee's insert/update of stock_count_items never
-- touches or sees it (BUSINESS_RULES section 3).
--
-- counted_by (001, previously unused) is set here, at completion, not at count creation -- so it
-- directly answers "who completed this count" (BUSINESS_RULES section 3's Stock Count History
-- requirement) with the one existing column, no separate completed_by needed.
create or replace function complete_stock_count(target_count_id uuid) returns void as $$
declare
  target_store_id uuid;
  caller_staff_id uuid;
begin
  select store_id into target_store_id from stock_counts where id = target_count_id and status = 'in_progress';
  if target_store_id is null then
    raise exception 'Stock count % is not in progress or does not exist', target_count_id;
  end if;

  if not can_manage_stock_count(target_store_id) then
    raise exception 'Not authorized to complete this stock count';
  end if;

  select id into caller_staff_id from staff_profiles where user_id = auth.uid();

  update stock_count_items sci
  set expected_quantity = coalesce(inv.quantity_on_hand, 0)
  from inventory inv
  where sci.stock_count_id = target_count_id
    and inv.store_id = target_store_id
    and inv.product_id = sci.product_id;
  -- products with no prior inventory row keep expected_quantity's 001 default of 0 -- correctly
  -- "not counted before".

  insert into inventory (store_id, product_id, quantity_on_hand, last_counted_at)
  select target_store_id, sci.product_id, sci.counted_quantity, now()
  from stock_count_items sci
  where sci.stock_count_id = target_count_id
  on conflict (store_id, product_id)
  do update set quantity_on_hand = excluded.quantity_on_hand, last_counted_at = excluded.last_counted_at;

  update stock_counts
  set status = 'completed', completed_at = now(), counted_by = caller_staff_id
  where id = target_count_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function complete_stock_count(uuid) to authenticated;
