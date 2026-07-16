# Supply Fulfillment — RPC Contract Design (Frozen)

Frozen 2026-07-16. Defines the exact interface every write RPC in this module must satisfy.
React is built against this document, not against any RPC's implementation — the contract is
the boundary. Governed by `supply-fulfillment-api-design.md` and `BUSINESS_RULES.md`.

No RPC has been implemented from this document. Next phase: implementation, once approved.

## Error code mechanism

This project has never used custom Postgres error codes before — every existing `raise
exception` relies on the default SQLSTATE (`P0001`), differentiated only by free-text message,
which is exactly what "error codes must be stable" is here to fix.

**Convention**: every `raise exception` in these RPCs carries a stable, closed-set string code in
the exception's `DETAIL` field — not `ERRCODE` (Postgres constrains that to 5 characters, too
cramped for a readable name) and not `MESSAGE` (kept human-readable, for logs, never parsed).

```sql
raise exception 'Human-readable message for logs' using detail = 'STABLE_CODE';
```

PostgREST surfaces `DETAIL` as `.details` in its JSON error body; supabase-js exposes it on the
returned `PostgrestError` the same way. **The client always switches on `error.details`, never
on `error.message`** — the exact same contract already established for the `invite-user` Edge
Function's `code` field, applied here to keep the whole project's error-handling shape
consistent across both RPCs and Edge Functions.

## Idempotency mechanism (applies to the three RPCs that need it)

Each carries a required `idempotency_key uuid` parameter and a uniquely-constrained
`idempotency_key` column on its header table (schema consequence noted, not designed further
here — see `supply-fulfillment-api-design.md` §4). **Sequence, fixed for all three**:
authorization is always checked first (an unauthorized retry must fail the same way every time,
never short-circuit into leaking a result); only then is the idempotency key checked. If a row
already exists with that key, the RPC returns that row's id immediately — same shape as a fresh
success, no error, no new write, indistinguishable to the caller from the original call
succeeding.

---

## `complete_stock_count(target_count_id uuid)`

*(Weekly Count — verified against the actual current implementation, migration 014, not
assumed.)*

**Purpose**: establish the Inventory Snapshot for a store from a completed count.

**Input Contract**:
```
target_count_id: uuid (required)
```

**Validation Sequence**:
1. Look up the count by id where `status = 'in_progress'` — a single combined check; the actual
   implementation does not distinguish "doesn't exist" from "not in progress" (e.g., already
   completed), so neither does this contract. → `STOCK_COUNT_NOT_ACTIVE`
2. Caller authorized for that store (`can_manage_stock_count`). → `UNAUTHORIZED`

**Transaction Boundary**: one transaction — resolve expected quantities, upsert `inventory`,
mark the count completed.

**Success Response**: `void` (unchanged from current behavior — no id to return, the count's own
id was already known to the caller).

**Error Codes**: `STOCK_COUNT_NOT_ACTIVE`, `UNAUTHORIZED`.

**Idempotency Behavior**: safe by construction, no key needed — step 1's status filter means a
retried call against an already-completed count fails with `STOCK_COUNT_NOT_ACTIVE` rather than
re-applying anything. Confirmed by reading the actual implementation, not assumed.

---

## `submit_store_purchase_request(target_store_id uuid, target_notes text, target_items jsonb, idempotency_key uuid)`

**Purpose**: create a new Store Purchase Request from a reviewed Draft (Weekly Count or Quick
Count origin — identical contract either way).

**Input Contract**:
```
target_store_id: uuid (required)
target_notes: text | null
target_items: jsonb array, each element:
  {
    product_id: uuid (required)
    requested_quantity: numeric > 0 (required)
    is_high_priority: boolean (optional, defaults false)
  }
idempotency_key: uuid (required)
```

**Validation Sequence**:
1. Caller authorized (`can_submit_store_purchase_request(target_store_id)`). → `UNAUTHORIZED`
2. Idempotency check (see mechanism, above) — return early on match.
3. `target_items` non-empty. → `EMPTY_ITEMS`
4. Each `product_id` resolves to an existing product. → `PRODUCT_NOT_FOUND`

**Transaction Boundary**: one transaction — header + all items.

**Success Response**: `uuid` — the new request's id.

**Error Codes**: `UNAUTHORIZED`, `EMPTY_ITEMS`, `PRODUCT_NOT_FOUND`.

**Idempotency Behavior**: required key; see mechanism above.

---

## `update_store_purchase_request(target_request_id uuid, target_items jsonb)`

**Purpose**: replace an existing, still-unlocked request's items in place — the sole edit path
for Execution Lock's pre-lock editable phase. **Revision**: an empty `target_items` is now a
valid input, not an error — it means the Store removed the last remaining item, and the request
is automatically cancelled (hard-deleted, not soft-cancelled — see below).

**Input Contract**:
```
target_request_id: uuid (required)
target_items: jsonb array, same shape as submit's target_items -- always the COMPLETE new set,
  never a partial patch. May be empty [] -- this is the cancellation path, not an error.
```
No `notes` field — Execution Lock names quantities, additions, and removals as editable;
`notes` isn't named, so it's out of this RPC's surface rather than silently included.
No `idempotency_key` — see below.

**Validation Sequence**:
1. Request exists. → `REQUEST_NOT_FOUND`
2. Caller authorized against the request's own `store_id`. → `UNAUTHORIZED`
3. **Lock check**: no `purchase_order_item_fulfillments` row exists for any of the request's
   current items. Applies identically whether `target_items` is empty or not — "no
   modification, no deletion, no cancellation" is one rule after lock, not three separate ones.
   → `REQUEST_LOCKED`
4. Each `product_id` in `target_items` (if any) resolves to an existing product. →
   `PRODUCT_NOT_FOUND`

**Transaction Boundary**: one transaction.
- If `target_items` is non-empty: full diff against current items (insert new, update changed
  quantity/priority, delete removed) applies atomically or not at all — unchanged from before.
- If `target_items` is empty: the request header itself is deleted (`store_purchase_request_items`
  cascades away with it via the existing FK, migration 026 — no separate item-deletion step
  needed). **Hard delete, not a stored "cancelled" status** — explicitly justified by the
  business rule itself: this is not yet a Business Record, because execution has never begun.
  No status field is introduced; "no empty Store Purchase Request should remain" is enforced by
  the row genuinely not existing, not by a flag saying so.

**Success Response**: `uuid` — the request's id, returned for both the update and the
cancellation path (the caller already knows what it submitted; this just confirms which request
was affected, even though after cancellation it no longer exists to look up).

**Error Codes**: `REQUEST_NOT_FOUND`, `UNAUTHORIZED`, `REQUEST_LOCKED`, `PRODUCT_NOT_FOUND`.
`EMPTY_ITEMS` no longer applies to this RPC — an empty submission is valid input, not a failure.

**Idempotency Behavior**: safe by construction, no key — full-replace semantics mean resubmitting
an identical `target_items` twice changes nothing on the second call, including the empty case:
retrying a cancellation against an already-cancelled (now-deleted) request simply fails
`REQUEST_NOT_FOUND`, not a duplicate deletion of anything.

---

## `create_purchase_order(target_supplier_id uuid, target_stores jsonb, idempotency_key uuid)`

**Purpose**: the sole write path for Purchase Orders — one Finish Purchasing action, one or more
stores, fully atomic.

**Input Contract**:
```
target_supplier_id: uuid (required)
target_stores: jsonb array, each element:
  {
    store_id: uuid (required, unique within the array)
    notes: text | null
    items: jsonb array, each element:
      {
        product_id: uuid (required)
        supplier_product_id: uuid (required)
        quantity_ordered: numeric > 0 (required)
        unit_price: numeric >= 0 (required)
        iva_rate: numeric >= 0 (optional, defaults to the supplier product's own rate)
        fulfillments: jsonb array (optional, empty/absent = Emergency), each element:
          { store_purchase_request_item_id: uuid, fulfilled_quantity: numeric > 0 }
        emergency_reason_key: text (required iff fulfillments is empty)
        emergency_reason_note: text | null (only meaningful when emergency_reason_key = 'other')
      }
  }
idempotency_key: uuid (required)
```

**Validation Sequence** (per store-group, within the one call):
1. Caller authorized (`can_manage_purchasing()`). → `UNAUTHORIZED`
2. Idempotency check — return early on match.
3. `target_stores` non-empty, and every `store_id` within it distinct. → `EMPTY_ITEMS`
4. Supplier exists. → `SUPPLIER_NOT_FOUND`
5. Per item: product exists → `PRODUCT_NOT_FOUND`; supplier product exists →
   `SUPPLIER_PRODUCT_NOT_FOUND`; supplier product belongs to `target_supplier_id` →
   `SUPPLIER_PRODUCT_MISMATCH`.
6. Per item: `fulfillments` non-empty XOR `emergency_reason_key` present — never both, never
   neither. → `FULFILLMENT_CONFLICT` (both present) or `EMERGENCY_REASON_REQUIRED` (neither).
7. If Emergency: `emergency_reason_key` exists and is active. → `EMERGENCY_REASON_INVALID`
8. If fulfillments present: each `store_purchase_request_item_id` exists. →
   `STORE_PURCHASE_REQUEST_ITEM_NOT_FOUND`
9. If fulfillments present: `Σ fulfilled_quantity ≤ quantity_ordered`. →
   `FULFILLMENT_EXCEEDS_PURCHASED`

**Transaction Boundary**: one transaction for the entire call — every store's Purchase Order,
every item, every fulfillment. Any single failure anywhere aborts everything; no store's order
partially commits while another's fails.

**Success Response**: `uuid[]` — one Purchase Order id per store in `target_stores`, same order.

**Error Codes**: `UNAUTHORIZED`, `EMPTY_ITEMS`, `SUPPLIER_NOT_FOUND`, `PRODUCT_NOT_FOUND`,
`SUPPLIER_PRODUCT_NOT_FOUND`, `SUPPLIER_PRODUCT_MISMATCH`, `FULFILLMENT_CONFLICT`,
`EMERGENCY_REASON_REQUIRED`, `EMERGENCY_REASON_INVALID`, `STORE_PURCHASE_REQUEST_ITEM_NOT_FOUND`,
`FULFILLMENT_EXCEEDS_PURCHASED`.

**Idempotency Behavior**: required key; see mechanism above. This is the single most
consequential RPC to get this right for — a retried call without protection would double-count
Purchased Quantity against real demand.

---

## `submit_store_goods_receipt(target_purchase_order_id uuid, target_items jsonb, idempotency_key uuid)`

**Purpose**: confirm what physically arrived against a Purchase Order — one delivery event.

**Input Contract**:
```
target_purchase_order_id: uuid (required)
target_items: jsonb array, each element:
  {
    purchase_order_item_id: uuid (required)
    received_quantity: numeric >= 0 (required)
  }
idempotency_key: uuid (required)
```

**Validation Sequence**:
1. Purchase Order exists. → `PURCHASE_ORDER_NOT_FOUND`
2. Caller authorized against the order's own `store_id`
   (`can_submit_store_purchase_request`). → `UNAUTHORIZED`
3. Idempotency check — return early on match.
4. `target_items` non-empty. → `EMPTY_ITEMS`
5. Each `purchase_order_item_id` exists and belongs to `target_purchase_order_id`. →
   `PURCHASE_ORDER_ITEM_NOT_FOUND` / `PURCHASE_ORDER_ITEM_MISMATCH`

**Transaction Boundary**: one transaction — header + all items of the one delivery event.

**Success Response**: `uuid` — the new Goods Receipt's id.

**Error Codes**: `PURCHASE_ORDER_NOT_FOUND`, `UNAUTHORIZED`, `EMPTY_ITEMS`,
`PURCHASE_ORDER_ITEM_NOT_FOUND`, `PURCHASE_ORDER_ITEM_MISMATCH`.

**Idempotency Behavior**: required key; see mechanism above.

---

## Closed error code set (project-wide reference for this module)

`UNAUTHORIZED`, `STOCK_COUNT_NOT_ACTIVE`, `EMPTY_ITEMS`, `PRODUCT_NOT_FOUND`,
`REQUEST_NOT_FOUND`, `REQUEST_LOCKED`, `SUPPLIER_NOT_FOUND`, `SUPPLIER_PRODUCT_NOT_FOUND`,
`SUPPLIER_PRODUCT_MISMATCH`, `FULFILLMENT_CONFLICT`, `EMERGENCY_REASON_REQUIRED`,
`EMERGENCY_REASON_INVALID`, `STORE_PURCHASE_REQUEST_ITEM_NOT_FOUND`,
`FULFILLMENT_EXCEEDS_PURCHASED`, `PURCHASE_ORDER_NOT_FOUND`, `PURCHASE_ORDER_ITEM_NOT_FOUND`,
`PURCHASE_ORDER_ITEM_MISMATCH`.

`UNAUTHORIZED` is intentionally the one code shared verbatim across every RPC — permission
denial means the same thing everywhere in this module. Every other code is specific to the one
RPC (or pair of closely related RPCs) that can actually raise it — no code is invented
speculatively for a situation that can't occur.

---

**RPC Contract Design is frozen.** React is to be built against this document's error codes and
response shapes only. No RPC, SQL, or React implemented from it. Waiting for review before any
RPC is written.
