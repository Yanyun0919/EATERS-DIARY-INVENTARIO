-- Purchase Suggestions module (business design approved 2026-07-11, UI deferred to the next
-- phase). Per the approved design, Purchase Suggestions has no persistent storage of its own --
-- it's a pure computed comparison of inventory.quantity_on_hand vs products.minimum_stock, and
-- manager edits to suggested quantities are local UI state only, never saved. So the only
-- database change this module needs is read access.
--
-- The `purchasing` role currently has no way to read `inventory` at all: migration 014's read
-- policy only allows Administrator or an account assigned to that specific store via
-- staff_stores -- Purchasing accounts aren't assigned to stores, that's what
-- retail_store/production_center accounts are for. That blocks Purchase Suggestions entirely
-- for that role.
--
-- This grants the Purchasing role READ-ONLY access to Inventory only, and nothing more. The
-- permission exists solely to support purchasing decisions (comparing Current Stock against
-- Minimum Stock to know what to buy) -- it does not grant access to Stock Count history or
-- Stock Count details. can_view_store_inventory() (also used by stock_counts/stock_count_items)
-- is deliberately left untouched, so Purchasing still cannot read Stock Count history/detail --
-- not asked for, not needed to answer "what should we buy."

create or replace function can_view_inventory(target_store_id uuid) returns boolean as $$
  select is_administrator()
    or has_store_access(target_store_id)
    or current_staff_role() = 'purchasing';
$$ language sql stable security definer set search_path = public;

alter policy "store access can read inventory" on inventory
  using (can_view_inventory(store_id));
