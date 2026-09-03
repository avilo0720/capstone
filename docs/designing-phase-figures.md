# Designing Phase — Figures for Documentation

Insert the following figures into the Designing section of the document. Each image already includes an on-figure caption; the text below can be used as formal figure captions in the manuscript.

---

## Figure 1. System Architecture Diagram

**File:** `docs/figure-1-system-architecture.png`

**Caption:** *Figure 1. System Architecture Diagram of the Nawad Inventory Management System.*

Three-tier web architecture showing Staff/Admin browsers in the presentation layer (Blade views, vanilla JS, CSS), the Laravel 11 application layer (controllers, middleware, services, models, RBAC, forecasting, and procurement workflow), and the MySQL data layer (inventories, items, transactions, procurement, users/ACL, logs).

---

## Figure 2. Entity-Relationship Diagram (ERD)

**File:** `docs/figure-2-erd.png`

**Caption:** *Figure 2. Entity-Relationship Diagram of the Nawad Inventory Management System.*

Crow’s Foot ERD of the major entities: departments and users with page/ability permissions; inventories and items with stock transactions; procurement requests and line items; activity logs; calendar notes and shares; and notification reads.

---

## Figure 3. User Interface Wireframes / Mockups

**File:** `docs/figure-3-ui-wireframes.png`

**Caption:** *Figure 3. User interface wireframes for key screens of the Nawad Inventory Management System.*

Low-fidelity Designing-phase mockups: (a) Login, (b) Dashboard Overview, (c) Inventory, (d) Forecasting, (e) Procurement, and (f) Reports and alerts.

---

### Suggested insertion text (replace the red placeholder)

> The Designing phase produced the system architecture diagram (Figure 1), the entity-relationship diagram (Figure 2), and the user interface wireframes (Figure 3). Figure 1 shows the three-tier client–server structure of Nawad. Figure 2 models the MySQL schema and relationships among users, inventories, transactions, and procurement. Figure 3 presents low-fidelity wireframes of the primary screens used by Staff and Admin.

---

Regenerate images with:

```bash
python docs/render_design_figures.py
```
