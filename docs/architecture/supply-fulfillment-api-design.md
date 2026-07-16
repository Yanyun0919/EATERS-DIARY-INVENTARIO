# Supply Fulfillment — API / RPC Architecture (Frozen)

Frozen 2026-07-16. Governs the RPC layer for Weekly Count, Quick Count, Store Purchase Request,
Purchasing Workspace, Purchase Order, and Goods Receipt. Builds on
`supply-fulfillment-design.md` (database layer, Migration 028) and `BUSINESS_RULES.md` — if
anything here ever conflicts with either, those win.

No RPC has been implemented from this document yet. Next phase: RPC Error Contract Design.

## Business Rules Compliance Review

Rules 1/2 — only `complete_stock_count()` writes to `inventory`; every other RPC here writes
exclusively to Business Record tables. Rule 8/12 — every RPC either records demand or records
execution, never both, and Execution Lock (§3) makes that boundary a precise, enforced moment
rather than an implicit one. Rule 9 — "Accept" stays derived, never a stored action; idempotency
keys (§4) prevent duplicate records, they don't introduce new business concepts. Rule 11 —
Requested/Purchased/Received stay three independently-written facts across three separate RPCs.
All rules pass.

## API Design Principles

- **Business Rules First** — every RPC's validation exists because a frozen business rule
  requires it, not because it seemed convenient to check.
- **Automatic Before Manual** — defaults, unit/price resolution, and derived state (Emergency
  status, Execution Lock) are computed by the RPC, never supplied by the caller as a separate
  fact that could drift out of sync with reality.
- **Minimum Necessary API Surface** — no RPC exists without a concrete caller need; rejected
  candidates (§6) are rejected explicitly, not silently omitted.
- **RPC Naming Principle** — an RPC name always describes the Business Record it writes, never
  the Workspace action that triggered the call:

  ```
  Workspace: Finish Purchasing
        ↓
  RPC: create_purchase_order()
        ↓
  Business Record: Purchase Order
  ```

  This keeps the two vocabularies independent — a Workspace's UI label can change without
  implying any RPC rename, and an RPC's name always tells you which table it writes to.

- **Idempotency Principle** — every write RPC must be idempotent-safe: a repeated client call
  (network timeout, browser retry, duplicate submission) must never create a duplicated
  Business Record. This protects against **infrastructure** retries only — it is not a
  mechanism for preventing legitimate business activity. If a user intentionally creates a new
  Store Purchase Request after a previous one has completed or locked, that's a new Business
  Event with its own fresh idempotency key, not a retry of the old one. The key is generated
  once per user-intended action (e.g., when the Submit/Finish/Receive button becomes active) and
  never reused across genuinely separate actions.

## RPC Catalog

### `complete_stock_count()` — Weekly Count

Purpose: establish the Inventory Snapshot. Trigger: Store completes a Weekly Count. Caller:
store-scoped (unchanged). Validation: all stock-tracked products counted or explicitly Not
Counted; one in-progress count per store. Transaction: one — writes `inventory` from
`stock_count_items`. Success: Inventory updated, count marked completed. Failure: no count in
progress, unauthorized. Idempotency: safe by construction, pending verification that the
existing "already completed" guard rejects a second completion rather than re-applying it — not
redesigned here. Never auto-creates a Store Purchase Request — the Draft stays a live,
non-persisted, human-reviewed view.

### Quick Count — no RPC

No schema, no dedicated write path. A Store Workspace entry point that computes Required
Quantity client-side for staff-selected products, then calls `submit_store_purchase_request()` —
the same RPC Weekly-Count-originated Drafts use. One RPC serves both counting workflows.

### `submit_store_purchase_request()`

Purpose: create a new Store Purchase Request. Trigger: Store Staff submit a reviewed Draft.
Caller: `can_submit_store_purchase_request(store_id)`. Validation: at least one item, valid
products, quantity > 0. Transaction: one — header + all items. Success: new request, unlocked.
Failure: no items, unauthorized, invalid product. Idempotency: **at risk, needs an explicit
idempotency key** — a pure create with nothing else preventing a duplicate.

### `update_store_purchase_request()`

Purpose: edit an existing, still-unlocked request in place. Trigger: Store Staff editing before
Purchasing acts on it. Caller: same as submit, checked against the request's own store.
Validation: request must not be locked (no `purchase_order_item_fulfillments` row exists for any
of its items); per-item rules same as submit. **Design, permanently fixed**: the client always
submits the complete current state of the request; the server treats it as the sole source of
truth and performs one atomic full diff (insert/update/delete as needed) — partial
synchronization is permanently rejected, no "patch one field" variant exists or will be added.
Transaction: one — the full diff applies atomically or not at all. Success: items now exactly
match the submitted set. Failure: locked, unauthorized. Idempotency: **safe by construction** —
full-replace semantics mean resubmitting the same state twice changes nothing the second time;
no key needed.

Open, not decided: whether reducing a request to zero items should be allowed (effective
withdrawal) or rejected the same as on creation.

### `accept_store_purchase_request()` — rejected

Not needed. Execution Lock is derived, not a stored action (§ below) — there is no intermediate
"Purchasing has started looking at this" state in the approved Workspace flow to give a name to.

### `create_purchase_order()`

Name kept, per the RPC Naming Principle — describes the record it creates, not the Workspace
action that triggers it. Purpose: the sole moment Purchase Orders, their items, and fulfillment
attributions are created — and the sole moment referenced Store Purchase Request Items lock.
Trigger: Purchasing presses Finish. Caller: `can_manage_purchasing()`. Validation: per-item rules
(product/supplier-product validity, demand-or-emergency mutual exclusivity, fulfillment sum ≤
purchased quantity), applied per store-group since one Finish may span multiple stores.
Transaction: one, however many stores the Finish action covers — no partial commit across
stores. Success: one Purchase Order per store; every referenced Store Purchase Request Item now
locked. Failure: any item's validation failing aborts the entire call. Idempotency: **at risk,
and the most consequential of the three — needs an explicit idempotency key.** A retried call
would otherwise create a second Purchase Order and double-count Purchased Quantity against the
same request.

### Execution Lock — final definition

A Store Purchase Request locks only at the moment a `create_purchase_order()` transaction
**successfully commits** with a fulfillment referencing one of its items. Not at viewing, not at
selection in the Purchasing Workspace, not at review beginning. A failed or aborted Finish
attempt leaves every referenced request exactly as unlocked as before — there is no partial-lock
state.

### `submit_store_goods_receipt()`

Purpose: confirm what physically arrived against a Purchase Order. Trigger: receiving store
staff, on delivery. Caller: `can_submit_store_purchase_request(purchase_orders.store_id)` —
reused, not a new permission. Validation: items belong to the target order; `received_quantity`
present and non-negative. Transaction: one — header + all items of one delivery event. Success:
new immutable Goods Receipt. Failure: item doesn't belong to the order, unauthorized.
Idempotency: **at risk, needs an explicit idempotency key** — same shape as the other two pure
creates.

### "Is this request locked" helper — rejected

A plain read, answerable via a normal query under existing RLS. No RPC needed.

## Idempotency — schema consequence for the next SQL phase

Three RPCs need a new `idempotency_key` parameter and a corresponding unique-constrained column
on their header table: `store_purchase_requests`, `purchase_orders`, `store_goods_receipts`.
Each RPC checks for an existing row with the supplied key before writing anything; if found,
returns that row's id as a no-op; otherwise proceeds and stores the key. Not designed further or
implemented here — flagged so it's expected, not a surprise, when Migration 029 (or wherever
this lands) gets written.

## Final RPC surface

| RPC | Status |
|---|---|
| `complete_stock_count()` | Unchanged |
| Quick Count | No RPC |
| `submit_store_purchase_request()` | Unchanged behavior; gains idempotency key |
| `update_store_purchase_request()` | New; full-request-only; naturally idempotent |
| `accept_store_purchase_request()` | Rejected |
| `create_purchase_order()` | Unchanged name; gains idempotency key |
| `submit_store_goods_receipt()` | Unchanged behavior; gains idempotency key |
| "is locked" helper | Rejected |

---

**API / RPC Architecture is frozen.** No RPC, SQL, or React implemented from this document. Next
phase: RPC Error Contract Design.
