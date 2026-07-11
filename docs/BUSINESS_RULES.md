# Eaters Diary Inventory - Business Rules

These business rules are the highest priority for this project. Future implementations must
always follow these rules unless explicitly approved otherwise.

## 1. Project Scope

This project is NOT an ERP.

Do NOT introduce ERP concepts unless explicitly requested.

The project only covers:

- Master Data
- Inventory
- Stock Count
- Purchasing
- Internal Purchase
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

## 2. Inventory

Inventory is never calculated. Inventory always shows the latest confirmed physical stock count.

Only Stock Count updates Inventory.

Inventory is never updated by:

- Purchasing
- Internal Purchase
- Internal Transfer
- Waste

Inventory exists only to support operational visibility and purchasing calculations.

---

## 3. Stock Count

Stock Count is the only process that updates current inventory.

When a stock count begins:

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
is a single stock count record; employees and Administrators simply see different information
through different screens.

Each store can have only one Stock Count in progress at a time. A new Stock Count cannot be
started until the current one is completed or cancelled.

If a product has never been counted, display "Not Counted" instead of "0" — this avoids
confusing "no inventory" with "not yet counted".

### Stock Count History

Stock Count History must always show:

- Store
- Count Date
- Counted By
- Status

Administrators must always be able to see who completed each Stock Count.

---

## 4. Purchasing

Purchasing is based on:

Current Stock

compared with

Minimum Stock.

Purchasing does NOT update inventory.

Purchasing does NOT perform goods receipt.

Purchasing does NOT perform warehouse receiving.

---

## 5. Internal Purchase

Internal Purchase is NOT Internal Transfer.

Internal Purchase means:

- A store purchases products from the Central Kitchen.
- The Central Kitchen produces the products.
- The store pays an internal purchase price.
- This is an internal purchasing workflow.

Internal Purchase does NOT update Inventory.

---

## 6. Internal Transfer

Internal Transfer means:

- Transfer raw materials between stores.
- No production.
- No purchasing.
- No internal pricing.
- No payment.

It is used for reporting and business analysis.

Internal Transfer does NOT update Inventory.

---

## 7. Waste (Desperdicio)

Waste records product loss because of spoilage, damage, expiration or other operational
reasons.

It is used for reporting and business analysis.

Waste does NOT update Inventory.

Waste is independent from Purchasing, Internal Purchase and Internal Transfer.

---

## 8. Simplicity First

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

---

## 9. Future Development Rule

Before implementing any new module, verify that the design complies with this
BUSINESS_RULES.md document.

If any conflict exists, stop implementation and report it before writing code.

Do not implement anything that violates these business rules without explicit approval.

---

## 10. Business First, Technology Second

Business workflow always has higher priority than technical elegance.

If a technically advanced solution makes the business workflow more complicated, prefer the
simpler business-oriented solution.

The goal of this project is operational efficiency for restaurant staff, not technical
sophistication.
