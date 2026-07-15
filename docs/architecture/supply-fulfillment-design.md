# Supply Fulfillment — Final Technical Design (Frozen)

Frozen 2026-07-16. Supersedes `supply-fulfillment-status.md`, which tracked this design while it
was still under review. Governed by `BUSINESS_RULES.md` (Rules 1–12, the Store Purchase Request
Principle, Demand Lifecycle, and Execution Lock Principle) — if anything here ever conflicts
with that document, `BUSINESS_RULES.md` wins.

## Business Rules Compliance Review

Rules 1/2 — Weekly Count remains the sole inventory writer; nothing in this design writes to
`inventory`. **PASS.**
Rule 3 — Purchasing still never updates inventory. **PASS.**
Rules 4–7 — not implicated. **PASS.**
Rule 8 — demand (Store Purchase Request) and execution (Purchase Order, Goods Receipt) stay
independent facts throughout; Execution Lock is what makes the conversion moment explicit rather
than blurring it. **PASS.**
Rule 9 — every table in this design represents a real event (a request, a purchase, a delivery)
or a real classification (Emergency Reason) — nothing persists a computed value or a replacement
chain. **PASS.**
Rule 10 — nothing here touches `internal_products`/`internal_supply_requests`. **PASS.**
Rule 11 — Requested/Purchased/Received remain three independent facts throughout; §7 states
precisely where that independence has a real precision boundary. **PASS.**
Rule 12 — demand originates only in the Store Workspace; Purchasing and Goods Receipt only ever
fulfill. **PASS.**

All 12 rules pass.

## 1. Business Records

| Record | Tables | Immutability |
|---|---|---|
| Weekly Count | `stock_counts`, `stock_count_items` | Immutable once completed — establishes the Inventory Snapshot. |
| Store Purchase Request | `store_purchase_requests`, `store_purchase_request_items` | **Editable until Purchasing accepts it (Execution Lock, §3), immutable after.** The one Business Record in this design with a genuine pre-lock mutable phase. |
| Purchase Order | `purchase_orders`, `purchase_order_items` | Immutable from creation — a retrospective log of what was bought, never a lifecycle object. |
| Purchase Order Item Fulfillment | `purchase_order_item_fulfillments` | Immutable from creation — see §5 for its clarified purpose. |
| Goods Receipt | `store_goods_receipts`, `store_goods_receipt_items` | Immutable from creation — confirms what physically arrived. |
| Emergency Reason | `emergency_reason_definitions` | Master-Data-shaped lookup, not itself a Business Record — a classification an Emergency Purchase Item points to. |

Each Store Purchase Request represents exactly one real replenishment event. Requests are never
merged with each other, and never deleted once Purchasing has begun acting on them.

## 2. Relationships

```
Store Purchase Request
      │
      ├──< Store Purchase Request Item  (Requested Quantity)
      │           │
      │           │  many-to-many, same Store only
      │           ▼
      │    Purchase Order Item Fulfillment  (fulfilled_quantity)
      │           │
      │           ▼
      │    Purchase Order Item ──── N:1 ──── Purchase Order  (one Store, one Supplier)
      │           │  (Purchased Quantity = quantity_ordered)
      │           │
      │           │  1:N, direct — NOT through fulfillments
      │           ▼
      │    Store Goods Receipt Item  (Received Quantity)
      │           │
      │           ▼
      │    Store Goods Receipt  (one delivery event; N per Purchase Order)
      │
      └── Emergency items skip the fulfillment step entirely: a Purchase Order Item with zero
          fulfillment rows carries an emergency_reason_key instead. Goods Receipt is unaffected
          either way — it always references Purchase Order Item directly, never a fulfillment
          row, whether the item is linked or Emergency.
```

## 3. Execution Lock

Before Purchasing accepts a Store Purchase Request, Store Staff may freely edit it — change
quantities, add products, remove products. The request always reflects the Store's latest
operational reality; there is no separate "revision" concept, just direct editing of the one
live request.

**"Accept" is not a separate stored action.** It's derived: the moment any
`purchase_order_item_fulfillments` row references any item of a request, that request is
locked — reusing a relationship the design already needs, rather than adding a purpose-built
status column, per "operational simplicity over database relationship complexity."

Once locked: no further modification, ever. Additional replenishment requires a completely new
Store Purchase Request — a new event, not a revision of the old one.

**A consequence for a future phase, stated plainly but explicitly deferred**:
`store_purchase_request_items` will eventually need a genuine update/delete path (RPC-gated,
checking the lock condition before allowing the write) — not the insert-only shape this table
has had since migration 026. **This is not part of Migration 028.** Per the approved project
sequence — Business Rules → Architecture → Database → API/RPC → React — Migration 028 is
Database only. No RPC enabling Store-side editing is designed or implemented here; that happens
together with the rest of the API/RPC layer once Migration 028 is complete. `store_purchase_request_items`
keeps its current insert-only grants unchanged through this migration.

**Known, accepted operational reality, not a gap**: a Store could theoretically edit a request
at the same moment Purchasing is reviewing it in the Purchasing Workspace, before Finish. This
is ordinary concurrent-edit behavior, not something this design adds special handling for —
Finish reads whatever the request's current state is at that moment, same as any system where
one party edits while another reads.

## 4. Quick Count

Quick Count is not a revision mechanism and shares no schema with Weekly Count beyond producing
the same kind of Business Record. It always creates a completely new Store Purchase Request. It
never replaces an existing one, and it never modifies a locked one — if a request is already
locked, the only path forward is a new count producing a new request, same as any other
post-lock replenishment need. Requires no schema of its own (confirmed twice now, unchanged).

## 5. Purchase Order Item Fulfillment — purpose clarified

**Not cross-store consolidation.** Purchase Orders belong to exactly one Store (confirmed,
§6) — no Purchase Order Item ever serves more than one Store's demand.

**Its actual purpose is Business Event Traceability**: recording how one Purchase Order Item
fulfills one *or more* Store Purchase Request Items belonging to the *same* Store. This still
happens routinely — a request gets locked and partially executed, a later count produces a new
request for the same product, and Purchasing buys for both in one purchased line the next time
they're at that supplier. The many-to-many relationship is what keeps that traceable back to
each originating request, rather than forcing Purchasing to artificially split one buying
decision into multiple purchase lines.

## 6. Goods Receipt — final design

Purchase Orders belong to exactly one Store. Goods Receipt therefore references
`purchase_order_item_id` directly — **not** `purchase_order_item_fulfillments`. There is no
cross-store ambiguity to resolve at the receiving end, because there was never a cross-store
purchase to begin with.

Goods Receipt confirms three things: supplier delivery occurred, the actual quantity received,
and operational completion from the Store's side. It never updates Inventory — Weekly Count
remains the sole inventory writer, unconditionally.

**The precision boundary this creates, stated explicitly rather than left implicit**: Requested
and Purchased are always precise per individual Store Purchase Request Item, via
`purchase_order_item_fulfillments`. Received is precise per individual Store Purchase Request
Item *only* when a Purchase Order Item has exactly one contributing fulfillment — the common
case. When one Purchase Order Item serves multiple Store Purchase Request Items from the same
store (§5), Received can only be reported in aggregate across them, not attributed to one
individually. This is a direct, accepted consequence of keeping Goods Receipt simple and
non-fulfillment-aware (§6) — not an oversight, and not being reopened again after being weighed
explicitly across several rounds of review.

## 7. Operational Principle — confirmed

Inventory remains Snapshot-based. Only Weekly Count updates it; Quick Count never does.
Requested, Purchased, and Received remain three independent business facts, each owned by a
different table, none substituting for another — with the one precision boundary stated
explicitly in §6, not hidden.

## 8. Workspace responsibilities (unchanged from the Workspace Architecture freeze, restated for completeness)

- **Store Workspace**: Weekly Count or Quick Count → create and freely edit a Store Purchase
  Request until Purchasing locks it → later, confirm Goods Receipt.
- **Purchasing Workspace**: review Outstanding Demand across still-unlocked requests, edit
  Purchased Quantity per row, Finish Purchasing — which is the moment Purchase Orders and their
  fulfillment links are created, and the moment the underlying requests lock.
- **Central Kitchen Workspace**: unaffected by this design — Internal Supply and Internal
  Transfer remain a separate domain (Rule 10), untouched by anything in this document.

## 9. Analytics readiness

Requested vs. Purchased vs. Received (with §6's stated precision boundary), Priority vs.
Fulfillment Time, and Emergency Purchase reporting by reason are all directly computable from
this schema with no duplicated or derived stored values anywhere.

---

Ready for Migration 028 SQL to be revised against this design. No SQL produced this round, per
instruction.
