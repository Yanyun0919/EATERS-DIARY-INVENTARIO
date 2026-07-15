# Workspace Architecture — Official Architecture Document

Approved and frozen 2026-07-15. This is the top-level operational architecture for Eaters
Diary — how employees work, how Business Records are created, and how the two relate. Governed
by `BUSINESS_RULES.md` (Rules 9, 11, 12; the Workspace Principle) — if anything here ever
conflicts with that document, `BUSINESS_RULES.md` wins.

## Business Rules Compliance Review

Rules 1–7 — no inventory-writing behavior anywhere in this architecture; Business Records are
unchanged by it. **PASS.**
Rule 8 — Workspaces are the interface through which a human makes each demand-to-execution
decision; never automatic. **PASS.**
Rule 9 — a Workspace is never itself persisted; only its completion action creates a Business
Record. **PASS.**
Rule 10 — the Central Kitchen Workspace unifies operational *experience* across Internal Supply
and Internal Transfer without merging their Business Records. **PASS.**
Rule 11 — the three independent facts (Requested/Purchased/Received) are exactly what the Store
and Purchasing Workspaces' completion actions produce, never substituted for each other.
**PASS.**
Rule 12 — Store Workspace is the only place demand originates; Purchasing and Central Kitchen
Workspaces only ever fulfill. Daily Production (below) creates supply capacity, not store
demand — does not implicate this rule. **PASS.**

All 12 rules pass.

## Core Philosophy

The system is Workspace-driven. Two layers, never confused with each other:

- **Operational Workspaces** — where employees work. Ephemeral, or at most local session state,
  until a specific completion action commits it. No table, no independent existence as data, no
  history of its own.
- **Business Records** — what actually happened. Permanent, immutable, created only by a
  Workspace's completion action (Submit, Finish, Confirm) — never edited afterward.

Workspaces never replace Business Records. Business Records never dictate operational workflow.

## Three architectural layers

```
Planning
   ↓
Workspace
   ↓
Business Records
```

- **Planning** — work prepared *before* execution (a Production Schedule, a future Purchasing
  Plan). **Explicitly out of scope for V1.** Not designed, not tabled, not workflowed here —
  this section exists only to reserve Planning's position above Workspace in the architecture,
  so a future Planning layer has a defined place to slot into without requiring this document to
  be redesigned when it arrives.
- **Workspace** — where an employee does the work, informed by Planning when it exists (today,
  informed only by current Business Record state — e.g. Inventory vs. Minimum Stock).
- **Business Records** — the permanent facts a Workspace's completion action produces.

## The three Workspaces

### 1. Store Workspace — unchanged

**Owner**: Store Staff. **Responsibilities**: Stock Count, Store Purchase Request (Draft review,
Priority selection, Submit), Goods Receipt.

```
Stock Count → Demand → Purchase Request → Goods Receipt → Store Purchase Request Closed
```

A Store Purchase Request is operationally closed after the Store confirms Goods Receipt.
"Closed" is a computed label (e.g., no outstanding receipt activity remains), not a stored
status — Store Purchase Request keeps its existing no-status-column design. If products are
still required afterward, the next Stock Count generates a completely new Store Purchase
Request — the system never automatically creates demand.

### 2. Purchasing Workspace — unchanged

**Owner**: Purchasing Staff. **Responsibilities**: Outstanding Demand, Store Filter (All /
Single / Multiple Stores), Supplier Filter, Purchased Quantity (editable per row), Emergency
Purchase, Finish Purchasing.

Finish Purchasing automatically creates Purchase Orders. Purchasers never manually create
Purchase Orders — the prior manual creation screen is fully superseded, the same way Purchase
Suggestions was superseded by the Store Purchase Request Draft. Purchasing represents
operational reality, never demand.

### 3. Central Kitchen Workspace — renamed and restructured (was "Production Workspace")

**Owner**: Production-center stores (CCC Amparo, MR.Sando). Two distinct responsibilities:

**A. Daily Production** — executing production tasks planned in advance (e.g., Gangnam Sauce,
Honey Mustard, Curry, Tamago). **Flagging plainly**: this responsibility has no Business Record
of its own today, and none is designed here. Planning (above) is what would define *what* to
produce and *when* — explicitly deferred. Until Planning exists, this Workspace can only
reference internal_products (the existing catalog) and cannot yet record "production happened"
as a fact; the only thing that becomes a permanent record today is what actually ships, via
Internal Supply.

**B. Internal Fulfillment** — one unified operational workflow for handling Store requests that
resolve to Internal Supply or Internal Transfer. Employees don't switch between modules to
handle these — the Workspace presents them together. Their Business Records stay separate
(Rule 10) — this is a navigation/UX unification, not a data merger, same principle already
applied to the other two Workspaces.

## Business Records — confirmed unchanged

| Record | Status |
|---|---|
| Stock Count | Unchanged. |
| Store Purchase Request | Unchanged. |
| Purchase Order | Unchanged — created exclusively via Purchasing Workspace's Finish action. |
| Goods Receipt | Unchanged. |
| Internal Supply | Unchanged — different domain (Rule 10). |
| Internal Transfer | Unchanged in principle — Technical Design still pending (Migration 028). |

The Workspace layer never changes Business Record ownership. No table, column, or RPC
referenced by this document is altered by it.

## Future Compatibility

- **Analytics** — reads Business Records only; Workspaces hold nothing for it to read directly.
- **Notifications** — every Workspace is naturally organized around a Pending view; notifications
  link into it (Notifications Principle), no new architecture needed.
- **Dashboard** — a read-only aggregation over the same Business Records Analytics reads.
- **Mobile** — a Workspace is client-side state until its completion action calls the same RPC
  any client would call; a mobile app is just another client rendering the same Workspaces.
- **Planning** (future) — already reserved a defined position above Workspace, per this
  document's own layering, so its eventual design doesn't require revisiting this architecture.

None of these require touching the Business Record architecture.
