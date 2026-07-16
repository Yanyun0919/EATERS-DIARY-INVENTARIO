# Eaters Diary Inventory - Business Rules

This document is the single source of truth for this project. It is the highest-priority
document — every technical design, migration, implementation, and review must comply with it.

If a future design conflicts with this document, the design must change. These rules are not
changed to fit an implementation.

## 1. Project Scope

This project is NOT an ERP.

Do NOT introduce ERP concepts unless explicitly requested.

The project only covers:

- Master Data
- Inventory
- Stock Count
- Purchasing
- Internal Supply
- Internal Transfer
- Waste (Desperdicio)
- Analytics

No accounting.

No invoices.

No customer management.

No POS.

No warehouse receiving workflow.

No warehouse shipping workflow.

No perpetual inventory system.

---

## 2. Immutable Business Rules

The following rules are permanent project invariants. Changing them requires explicit product
approval — they are not to be reinterpreted or worked around by a technical design.

### Rule 1

Inventory is updated ONLY by Stock Count.

No other module may update inventory.

"Stock Count" in this rule refers to Weekly Count specifically. Quick Count is a separate
operational workflow and never updates Inventory (see Module Responsibilities, Inventory
Counting).

### Rule 2

Inventory always represents the latest physically counted stock.

Inventory is not a transaction ledger.

It is a snapshot of reality.

Quick Count does not establish a new Inventory Snapshot — only Weekly Count does.

### Rule 3

Purchasing never updates inventory.

Purchasing records purchasing history only.

### Rule 4

Waste never updates inventory.

Waste exists only for statistics, analysis and reporting.

### Rule 5

Internal Transfer never updates inventory.

Internal Transfer records movement history only.

### Rule 6

Internal Purchase never updates inventory.

It records internal supply history only.

### Rule 7

Inventory is the only operational source of truth.

Purchasing, Waste, Internal Transfer and Internal Purchase are business records.

They exist for management, reporting and analytics.

### Rule 8

Business demand and business execution are different concepts.

Demand never becomes execution automatically.

Requested Quantity and Purchased Quantity represent different business facts and must remain
independent.

### Rule 9

Every Business Record represents one real-world business event.

The system should not create additional persistent business objects unless they represent a
real operational event.

### Rule 10

Raw Materials and Manufactured Products are separate business domains.

Raw Materials follow:

Inventory → Store Purchase Request → Supply Fulfillment → Analytics.

Manufactured Products follow:

Production → Internal Supply Request → Internal Supply → Analytics.

The two workflows remain operationally independent.

They are combined only inside Analytics.

### Rule 11

Demand represents operational intention. Store Purchase Requests describe what a Store believes
it needs. They are not operational facts.

Purchasing represents operational reality. Purchase Orders record what was actually purchased.

Receiving represents operational reality. Store Goods Receipts record what actually arrived.

Requested Quantity, Purchased Quantity and Received Quantity are three independent business
facts. Analytics must never substitute one for another.

### Rule 12

Demand is always created by the Store.

Fulfillment never creates demand.

---

## 3. Operational Principles

### Operational First

Eaters Diary Inventory is an operational management system.

It is NOT an accounting system, ERP, or financial management system.

The purpose of the system is to improve operational efficiency, reduce manual work, and support
better management decisions.

### Employees Record Reality, The System Calculates, Managers Decide

Employees record reality.

The system calculates automatically.

Managers make decisions.

### Reduce Operational Work

Every feature must reduce employee workload instead of creating additional administrative work.

Avoid requiring users to enter information that is not necessary for restaurant operations.

Whenever possible:

- Reuse existing data.
- Pre-fill values.
- Calculate automatically.
- Minimize manual input.

### Data Exists To Support Decisions

Data is collected only when it improves:

- Inventory accuracy.
- Purchasing decisions.
- Supplier management.
- Operational analysis.
- Management reporting.

The goal is not to collect more data.

The goal is to make better decisions with the smallest amount of manual work.

### Master Data Is The Only Source Of Default Values

Master Data is the only source of default values.

Examples include:

- Purchase price.
- Purchase unit.
- Package size.
- IVA.

Operational users should not repeatedly enter default information.

---

## 4. Module Responsibilities

### Inventory

Inventory is never calculated — it is a snapshot of the latest confirmed physical stock count
(Rule 2), not a transaction ledger.

Inventory exists only to support operational visibility and purchasing calculations.

Which modules may or may not update Inventory is governed by Rules 1–7, not restated here.

### Inventory Counting

Two distinct counting workflows are recognized. Both generate replenishment demand; only one
of them updates Inventory.

#### Weekly Count

Establishes the official Inventory Snapshot (Rule 2) — the only process that updates current
inventory (Rule 1).

- Scheduled — normally performed once per week.
- Counts every stock-tracked product.
- Updates Inventory.
- After completion, the system calculates replenishment demand.

When a Weekly Count begins:

- All stock-tracked products must already be displayed.
- Employees should NOT search and add products one by one.
- Employees only enter counted quantities.

The counting list should prioritize:

1. Low Stock
2. Category Order
3. Product Name

Employees should NOT see the expected/system quantity or variance while counting.

Expected quantity, counted quantity, and variance are shown only after the count is completed,
and only to Administrators. This is a UI responsibility, not a database responsibility — there
is a single count record; employees and Administrators simply see different information through
different screens.

Each store can have only one Weekly Count in progress at a time. A new one cannot be started
until the current one is completed or cancelled.

If a product has never been counted, display "Not Counted" instead of "0" — this avoids
confusing "no inventory" with "not yet counted".

##### Weekly Count History

Weekly Count History must always show:

- Store
- Count Date
- Counted By
- Status

Administrators must always be able to see who completed each Weekly Count.

#### Quick Count

Responds to operational stock shortages, at any time, outside the weekly schedule.

- Performed at any time — not scheduled.
- Counts only selected products — the ones staff discover running low during normal
  operations, not the full catalog.
- Generates replenishment demand directly.
- Does NOT update Inventory. Does NOT establish a new Inventory Snapshot (Rule 2). Is not
  another Inventory model — there is still only one Inventory, and Weekly Count is still its
  only source.

Quick Count is an operational workflow only — it produces a Store Purchase Request, not an
Inventory fact.

### Purchasing

Purchasing is based on:

Current Stock

compared with

Minimum Stock.

Purchasing does NOT perform goods receipt.

Purchasing does NOT perform warehouse receiving.

#### Purchasing Is Operational

Purchasing records operational purchasing activities.

Accounting records invoices, payments, taxation, bookkeeping and financial reporting.

These are different responsibilities.

The Purchasing module must not evolve into an accounting module.

#### Automatic Before Manual

Whenever possible, values should come automatically from Master Data (see Master Data Is The
Only Source Of Default Values).

The purchaser should normally only need to enter:

- Quantity.

and only modify price when the supplier price has changed.

#### Tax (IVA)

IVA is not an operational input.

Purchasing should never require operational staff to manually calculate or input IVA for every
purchase.

#### Purchasing Is Store-Driven

Each Store Purchase Request belongs to its originating store.

External Purchasing fulfills store-originated demand — it is not a centralized stock allocation
process. Purchasing does not decide what stores need; it fulfills what stores have already
requested.

External Purchasing is responsible only for external suppliers.

Purchasing users do NOT handle:

- Internal Supply.
- Internal Transfer.

Purchasing users need to see:

- Supplier.
- Store.
- Product.
- Requested Quantity.

### Internal Supply

Internal Supply is NOT Internal Transfer.

Internal Supply means:

- A store purchases products from the Central Kitchen.
- The Central Kitchen produces the products.
- The store pays an internal purchase price.
- This is an internal purchasing workflow.

Internal Supply belongs only to Locales that hold the Central Kitchen (Production Center)
capability.

Examples: CCC Amparo, MR.Sando.

These Locales may simultaneously perform Stock Count, Store Purchase Request, Internal Supply,
and Internal Transfer — already fully supported by the existing Locale + Store Role
architecture (migrations 008, 019). No redesign is required.

### Internal Transfer

Internal Transfer means:

- Transfer raw materials between stores.
- No production.
- No purchasing.
- No internal pricing.
- No payment.

It is used for reporting and business analysis.

Internal Transfer is an independent operational workflow. It is not Purchasing. It is not
Internal Supply. It belongs only to Raw Materials (Productos Externos) — see Rule 10.

### Waste (Desperdicio)

Waste records product loss because of spoilage, damage, expiration or other operational
reasons.

It is used for reporting and business analysis.

Waste is independent from Purchasing, Internal Purchase and Internal Transfer.

---

## 5. Design Principles

### Simplicity First

Always choose the simplest workflow that satisfies the business requirements.

Avoid ERP-style complexity.

Avoid unnecessary database structures.

Avoid duplicate data.

Do not introduce additional tables, views, triggers, or database structures unless they solve a
real business problem. Every new table, view, or function must provide clear business value, not
only technical value.

When multiple technical solutions are possible, always choose the one that is:

- Easier for restaurant staff to use.
- Easier to understand.
- Easier to maintain.
- Easier to extend in the future.

Every new feature must answer one question: "Does this reduce work for restaurant staff?"

If the answer is no, the feature should be redesigned before implementation.

### Business First, Technology Second

Business workflow always has higher priority than technical elegance.

If a technically advanced solution makes the business workflow more complicated, prefer the
simpler business-oriented solution.

The goal of this project is operational efficiency for restaurant staff, not technical
sophistication.

### Store Purchase Request Principle

Store Purchase Requests represent demand only.

They do not determine how the demand will be fulfilled.

Future fulfillment may be:

- External purchasing.
- Internal transfer.
- Central kitchen supply.

Therefore, Store Purchase Requests must remain independent from fulfillment methods.

A Store Purchase Request owns Requested Quantity. A Purchase Order (or a future Internal
Transfer / Internal Supply execution record) owns Purchased Quantity. Converting a request
into an execution record is always a manual decision — see Rule 8.

#### Demand Lifecycle

Every replenishment request is an independent operational event.

Weekly Count or Quick Count → Store Purchase Request → Purchasing → Goods Receipt →
Operationally Closed.

Operationally Closed means the Store has confirmed receipt for this demand event. It does NOT
mean the requested quantity was fully satisfied.

Requested Quantity, Purchased Quantity, and Received Quantity remain permanent Business Records
for Analytics regardless of closure (Rule 11).

If additional replenishment is required later, a completely new Store Purchase Request is
created. Existing requests are never reopened, never extended, and never appended once
Purchasing has accepted them (Execution Lock Principle, below).

#### Execution Lock Principle

A Store Purchase Request remains editable until Purchasing explicitly accepts it. Before
acceptance, Store Staff may update it — quantities changed, products added, products removed —
and the updated values always represent the Store's latest operational reality. Store employees
never think in incremental demand: they simply recount inventory (Weekly Count or Quick Count)
and submit the latest required quantities. This applies equally to both counting workflows — the
counting workflow differs, the business outcome is identical.

If the Store removes the last remaining product from a still-unlocked request, the request is
automatically cancelled — no empty Store Purchase Request may remain. This is not a violation of
Business Record immutability: before Purchasing accepts it, a request is not yet a Business
Record, because execution has never begun on it. No status field represents this — the request
is simply gone, the same way it never has a status while editable.

Once Purchasing accepts the request (Execution Lock — the first successful Purchase Order
creation against it, never before), it becomes operationally locked: the Store can no longer
modify it, quantities cannot be changed, products cannot be added or removed, and it can no
longer be cancelled. If additional replenishment is required afterward, the Store performs a new
Weekly Count or Quick Count and creates a completely new Store Purchase Request — a completely
new business event.

One operational event produces one Store Purchase Request. A new operational event always
creates a new Store Purchase Request. The system never combines quantities from different
requests automatically, and does not track replacement chains or superseded requests — there is
nothing to supersede, since a request is edited in place until locked, not replaced by a new row.

Before acceptance, the Store owns demand. After acceptance, Purchasing owns execution, and the
Store can no longer modify that demand — this separates demand ownership from execution
ownership (Rule 8, Rule 12). Operational simplicity is preferred over database relationship
complexity — this workflow is supported by operational process, not additional database
structures.

### Direct Store Procurement Principle

The Purchasing Workspace provides a consolidated purchasing view only for operational
convenience.

The consolidated view exists to help the purchaser buy identical products for multiple stores
during a single procurement trip.

It is NOT a centralized purchasing process.

It is NOT a purchase-then-allocation workflow.

Every quantity shown in the consolidated purchasing view already belongs to a specific store
before purchasing begins.

The purchaser buys products directly for each individual store during the same procurement trip
and delivers them directly to the stores.

Therefore:

- Every store always owns its own independent Purchase Order.
- There is never a "master" Purchase Order.
- There is never a post-purchase allocation or distribution workflow.
- The Purchasing Workspace is only a consolidated operational view, not a business entity.
- The system must never introduce concepts such as Purchase Allocation, Inventory Distribution,
  Split Inventory, or Central Warehouse Allocation.

The purchaser must be able to see, directly in the consolidated purchasing table, the required
quantity for every store for every product.

Example:

| Product     | Total | Mr. Sando | CCC Amparo | CCC Tetuán |
|-------------|-------|-----------|------------|------------|
| Chicken Leg | 45 kg | 10 kg     | 15 kg      | 20 kg      |

The purchaser should never need to open individual Purchase Orders just to know how much belongs
to each store.

Finish Purchasing may be performed independently for each store.

The consolidated purchasing table remains available throughout the purchasing process, while
each store's Purchase Order progresses independently.

### Purchasing Workspace Filtering Principle

The Purchasing Workspace is always a single workspace.

The default view is "All Stores", showing the consolidated purchasing demand.

The workspace must support filtering by individual store.

Changing the filter only changes the operational view.

It does not create a different purchasing workflow.

It does not create a different Purchase Order model.

It does not create a different Business Record.

When "All Stores" is selected, the purchaser must see:

- Total quantity.
- Quantity required by each individual store.

The purchaser should never need to open a Purchase Order simply to know how much belongs to each
store.

When a single store is selected, the same workspace displays only that store's purchasing
demand.

Finish Purchasing always operates on exactly one selected store. There is no "All Stores Finish"
operation. If the purchaser completes purchasing for multiple stores during the same procurement
trip, the purchaser performs one independent Finish action per store — the system never combines
them into a single multi-store operation, at the UI layer or the RPC layer.

### Notifications Principle

Notifications are reminders. Notifications are NOT business workflows.

Every operational module owns its own Pending queue.

Examples:

- Compras → Pendientes.
- Internal Supply → Pendientes.
- Internal Transfer → Pendientes.

Notifications simply direct users to the correct Pending queue.

The Pending queue remains the operational source of work.

Future notification channels (web, mobile push, email, etc.) must never replace the Pending
queue.

### Workspace Principle

The system is Workspace-driven. Employees work inside Operational Workspaces.

Operational Workspaces help employees perform work. Business Records permanently record
reality.

Workspaces never replace Business Records. Business Records never dictate operational
workflows.

A Workspace is never itself a Business Record. It holds no permanent data of its own beyond
what a specific completion action (Submit, Finish, Confirm) commits — see Rule 9.

---

## 6. Governance — Business Rules Compliance Review

Before implementing any new module or feature, verify that the design complies with this
BUSINESS_RULES.md document.

If any conflict exists, stop implementation and report it before writing code.

Do not implement anything that violates these business rules without explicit approval.

From now on, every future Technical Design Document must begin with a **Business Rules
Compliance Review** section. For every Immutable Business Rule (Section 2), the review must
state whether the design affects it, and why it remains compliant.

Example:

> **Rule 1** — Inventory is updated only by Stock Count.
>
> Compliance: This design does not modify inventory. No inventory update statements exist.
>
> **PASS.**

This must be repeated for every Immutable Business Rule. No implementation may begin until the
Business Rules Compliance Review has been completed and approved.
