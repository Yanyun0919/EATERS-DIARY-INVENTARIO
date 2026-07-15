-- Purchase Number (business design approved 2026-07-12): a human-readable, immutable, sequential
-- reference for each purchase order, e.g. "PO-000001" -- addresses "how do I refer to a specific
-- past purchase" without introducing any accounting concept (not an invoice number, no lifecycle
-- attached to it).
--
-- `generated always as identity` is a native Postgres auto-incrementing column -- clients cannot
-- supply or override its value even if they tried, matching "Purchase history is immutable"
-- (migration 016). create_purchase_order() (migration 017) needs no change: Postgres assigns the
-- number automatically on insert.
--
-- Only the raw integer is stored. The "PO-000001" formatting is a display concern, applied in the
-- UI at render time -- storing a pre-formatted string would duplicate data derived from the
-- integer (Simplicity First, BUSINESS_RULES.md #9).

alter table purchase_orders
  add column purchase_number bigint generated always as identity;
