import confirmAction, { notifyAlert, pickAssignee } from "./ConfirmDialog.js";
import { bindBackdropClose } from "./OverlayDismiss.js";
import Pagination from "./Pagination.js";
import { fetchAssignees } from "./API.js";

const STATUS = {
  pending: { label: "Dept. head", tone: "orange" },
  dept_noted: { label: "Procurement check", tone: "blue" },
  procurement_checked: { label: "Branch manager", tone: "orange" },
  approved: { label: "Approved · print RS", tone: "green" },
  denied: { label: "Denied", tone: "red" },
  stock_entered: { label: "Stock entered", tone: "blue" },
};

const NEXT_STEP = {
  pending: {
    action: "Note this request",
    nextLabel: "who in procurement should check it next",
    confirm: "Note and send",
  },
  dept_noted: {
    action: "Mark this request as checked",
    nextLabel: "which branch manager should approve it next",
    confirm: "Check and send",
  },
  procurement_checked: {
    action: "Approve this request",
    nextLabel: "who in procurement should print the RS slip",
    confirm: "Approve and send",
  },
};

class ProcurementView {
  constructor() {
    this.requests = [];
    this.selectedId = null;
    this.detail = null;
    this.statusFilter = "all";
    this.search = "";
    this.searchTimer = null;
    this.requestedOnly = false;
    this.manualItems = [];
    this.manualQtys = {};
    this.manualSearch = "";
    this.people = [];
    this.canEdit = document.body.dataset.canProcurementEdit === "true";
    this.canReview = document.body.dataset.canProcurementReview === "true";
    this.canManageUsers = document.body.dataset.canManageUsers === "true";
    this.userId = Number(document.body.dataset.userId || 0);
    this.pagination = new Pagination({
      pageSize: 10,
      onPageChange: () => this.renderList(),
    });
  }

  async setApp() {
    this.root = document.querySelector(".procurement-page:not(.issuance-page)");
    if (!this.root) return;
    this.tbody = document.getElementById("procurementTableBody");
    this.detailEl = document.getElementById("procurementDetail");
    this.detailOverlay = document.getElementById("procurementDetailOverlay");
    this.pagination.setContainer(document.getElementById("procurementPagination"));
    this.closeDeny();
    this.closeStock();
    this.closeManual();
    this.hideDetail();
    const requestId = Number(new URLSearchParams(window.location.search).get("request"));
    if (requestId) this.selectedId = requestId;
    this.bindEvents();
    await Promise.all([this.loadPeople(), this.loadRequests()]);
  }

  async loadPeople() {
    this.people = await fetchAssignees();
    this.fillAssigneeSelect(document.getElementById("procurementManualAssignee"));
  }

  fillAssigneeSelect(select, selectedId = "") {
    if (!select) return;
    const options = this.people.map((person) => {
      const bits = [person.role, person.department].filter(Boolean).join(" · ");
      const label = bits ? `${person.name} — ${bits}` : person.name;
      const selected = String(person.id) === String(selectedId) ? " selected" : "";
      return `<option value="${person.id}"${selected}>${this.escape(label)}</option>`;
    }).join("");
    select.innerHTML = `<option value="">Select a person…</option>${options}`;
  }

  async chooseNextPerson({ title, message, confirmLabel }) {
    if (!this.people.length) await this.loadPeople();
    if (!this.people.length) {
      notifyAlert("Could not load people to send this request to.");
      return null;
    }
    return pickAssignee({
      title,
      message,
      people: this.people,
      confirmLabel,
    });
  }

  bindEvents() {
    document.getElementById("procurementFilters")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-status]");
      if (btn) this.setStatusFilter(btn.dataset.status);
    });

    document.getElementById("procurementSummary")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-status]");
      if (card) this.setStatusFilter(card.dataset.status);
    });

    document.getElementById("procurementSearch")?.addEventListener("input", (e) => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.search = e.target.value.trim().toLowerCase();
        this.pagination.reset();
        this.renderList();
      }, 250);
    });

    this.tbody?.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-id]");
      if (row) this.selectRequest(Number(row.dataset.id));
    });

    document.getElementById("procurementDetailClose")?.addEventListener("click", () => this.hideDetail());
    bindBackdropClose(this.detailOverlay, () => this.hideDetail());

    document.getElementById("procurementManualBtn")?.addEventListener("click", () => this.openManual());
    document.getElementById("procurementManualCancel")?.addEventListener("click", () => this.closeManual());
    document.getElementById("procurementManualConfirm")?.addEventListener("click", () => this.submitManual());
    document.getElementById("procurementManualFillRop")?.addEventListener("click", () => this.fillManualByMode("missing-rop"));
    document.getElementById("procurementManualFillProcurement")?.addEventListener("click", () => this.fillManualByMode("procurement"));
    document.getElementById("procurementManualClearAll")?.addEventListener("click", () => this.clearManualQtys());
    document.getElementById("procurementManualSearch")?.addEventListener("input", (e) => {
      this.manualSearch = e.target.value.trim().toLowerCase();
      this.renderManualLines();
    });
    document.getElementById("procurementManualBody")?.addEventListener("input", (e) => {
      const input = e.target.closest("input[data-item-id]");
      if (!input) return;
      const id = Number(input.dataset.itemId);
      const qty = Math.max(0, Math.floor(Number(input.value) || 0));
      if (qty > 0) this.manualQtys[id] = qty;
      else delete this.manualQtys[id];
      this.updateManualHint();
    });

    document.getElementById("procurementDenyCancel")?.addEventListener("click", () => this.closeDeny());
    document.getElementById("procurementDenyConfirm")?.addEventListener("click", () => this.submitDeny());
    document.getElementById("procurementStockCancel")?.addEventListener("click", () => this.closeStock());
    document.getElementById("procurementStockConfirm")?.addEventListener("click", () => this.submitStock());

    bindBackdropClose(document.getElementById("procurementDenyOverlay"), () => this.closeDeny());
    bindBackdropClose(document.getElementById("procurementStockOverlay"), () => this.closeStock());
    bindBackdropClose(document.getElementById("procurementManualOverlay"), () => this.closeManual());

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (document.getElementById("procurementDenyOverlay")?.classList.contains("is-open")) {
        this.closeDeny();
        return;
      }
      if (document.getElementById("procurementStockOverlay")?.classList.contains("is-open")) {
        this.closeStock();
        return;
      }
      if (document.getElementById("procurementManualOverlay")?.classList.contains("is-open")) {
        this.closeManual();
        return;
      }
      this.hideDetail();
    });
  }

  setStatusFilter(status) {
    this.statusFilter = status || "all";
    document.querySelectorAll("#procurementFilters .users-tab").forEach((el) => {
      el.classList.toggle("--active", el.dataset.status === this.statusFilter);
    });
    document.querySelectorAll("#procurementSummary [data-status]").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.status === this.statusFilter);
    });
    this.pagination.reset();
    this.renderKpis();
    this.renderList();
  }

  filtered() {
    return this.requests.filter((row) => {
      if (this.statusFilter !== "all" && row.status !== this.statusFilter) return false;
      if (!this.search) return true;
      const haystack = [
        row.id,
        row.rs_number,
        row.original_filename,
        row.source,
        row.status,
        row.uploaded_by,
        row.assigned_to?.name,
        row.purpose,
      ].join(" ").toLowerCase();
      return haystack.includes(this.search);
    });
  }

  async refreshLive() {
    if (!document.querySelector(".procurement-page")) return;
    await this.loadRequests();
  }

  async loadRequests() {
    try {
      const res = await fetch("/api/procurement-requests");
      const data = await res.json();
      this.requests = Array.isArray(data.requests) ? data.requests : [];
      this.renderKpis();
      this.renderList();
      if (this.selectedId) await this.selectRequest(this.selectedId);
    } catch (err) {
      console.error(err);
      if (this.tbody) {
        this.tbody.innerHTML = `<tr><td colspan="8" class="users-empty">Unable to load procurement requests.</td></tr>`;
      }
    }
  }

  renderKpis() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };
    set("procurementKpiTotal", this.requests.length);
    set("procurementKpiPending", this.requests.filter((r) => r.status === "pending").length);
    set("procurementKpiChecked", this.requests.filter((r) => r.status === "dept_noted").length);
    set("procurementKpiManager", this.requests.filter((r) => r.status === "procurement_checked").length);
    set("procurementKpiApproved", this.requests.filter((r) => r.status === "approved").length);
    set("procurementKpiDenied", this.requests.filter((r) => r.status === "denied").length);
    set("procurementKpiStockEntered", this.requests.filter((r) => r.status === "stock_entered").length);
  }

  renderList() {
    const rows = this.filtered();
    if (!this.tbody) return;
    if (!rows.length) {
      this.tbody.innerHTML = `<tr><td colspan="8" class="users-empty">No procurement requests match this view. Add a request or send one from Forecasting.</td></tr>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    const page = this.pagination.getSlice(rows);
    this.tbody.innerHTML = page.items.map((row) => {
      const badge = STATUS[row.status] || STATUS.pending;
      const selected = row.id === this.selectedId ? " is-selected" : "";
      return `<tr data-id="${row.id}" class="${selected}">
        <td><strong>${this.escape(row.rs_number || `#${row.id}`)}</strong></td>
        <td>${this.escape(row.original_filename || row.source || "Forecast")}</td>
        <td><span class="dashboard-activity__badge dashboard-activity__badge--${badge.tone}">${badge.label}</span></td>
        <td>${this.escape(row.assigned_to?.name || "—")}</td>
        <td>${row.line_count ?? 0}</td>
        <td>${row.total_requested ?? 0}</td>
        <td>${this.escape(row.uploaded_by || "—")}</td>
        <td>${this.formatWhen(row.created_at)}</td>
      </tr>`;
    }).join("");

    this.pagination.renderControls({
      totalItems: page.totalItems,
      totalPages: page.totalPages,
      startIndex: page.startIndex,
      endIndex: page.endIndex,
    });
  }

  hideDetail() {
    this.selectedId = null;
    this.detail = null;
    this.requestedOnly = false;
    this.toggleOverlay("procurementDetailOverlay", false);
    const footer = document.getElementById("procurementDetailFooter");
    if (footer) {
      footer.hidden = true;
      footer.innerHTML = "";
    }
    const badgeEl = document.getElementById("procurementDetailBadge");
    if (badgeEl) {
      badgeEl.hidden = true;
      badgeEl.textContent = "";
    }
    this.renderList();
  }

  async selectRequest(id) {
    this.selectedId = id;
    this.requestedOnly = false;
    this.renderList();
    try {
      const detailRes = await fetch(`/api/procurement-requests/${id}`);
      const detailData = await detailRes.json();
      this.detail = detailData.request || null;
      this.renderDetail();
    } catch (err) {
      console.error(err);
      if (this.detailEl) {
        this.detailEl.innerHTML = `<p class="users-empty">Unable to load this request.</p>`;
      }
      this.toggleOverlay("procurementDetailOverlay", true);
    }
  }

  detailLines() {
    const items = this.detail?.items || [];
    if (!this.requestedOnly) return items;
    return items.filter((line) => {
      const requested = Number(line.requested_qty) > 0;
      const applied = line.applied_qty != null && Number(line.applied_qty) > 0;
      return requested || applied;
    });
  }

  renderDetail() {
    const req = this.detail;
    if (!req || !this.detailEl) {
      this.hideDetail();
      return;
    }

    const badge = STATUS[req.status] || STATUS.pending;
    const pending = req.status === "pending";
    const inWorkflow = ["pending", "dept_noted", "procurement_checked"].includes(req.status);
    const approved = req.status === "approved";
    const denied = req.status === "denied";
    const allItems = req.items || [];
    const items = this.detailLines();
    const hiddenCount = Math.max(0, allItems.length - items.length);

    const title = document.getElementById("procurementDetailTitle");
    const meta = document.getElementById("procurementDetailMeta");
    const badgeEl = document.getElementById("procurementDetailBadge");
    const footer = document.getElementById("procurementDetailFooter");
    if (title) title.textContent = req.rs_number || `Request #${req.id}`;
    if (badgeEl) {
      badgeEl.hidden = false;
      badgeEl.className = `dashboard-activity__badge dashboard-activity__badge--${badge.tone}`;
      badgeEl.textContent = badge.label;
    }
    if (meta) {
      const source = this.escape(req.original_filename || req.source || "Forecast");
      const by = this.escape(req.uploaded_by || "Unknown");
      const waiting = req.assigned_to?.name
        ? `<span class="procurement-detail-meta__sep">·</span><span class="procurement-detail-meta__chip">Waiting on ${this.escape(req.assigned_to.name)}</span>`
        : "";
      meta.innerHTML = `
        <span class="procurement-detail-meta__chip">${source}</span>
        <span class="procurement-detail-meta__sep">·</span>
        <span class="procurement-detail-meta__chip">Requested by ${by}</span>
        ${waiting}
      `;
    }

    const reason = req.rejection_reason
      ? `<div class="procurement-note procurement-note--danger"><strong>Rejection reason</strong><p>${this.escape(req.rejection_reason)}</p></div>`
      : "";
    const previous = req.previous_rejection_reason
      ? `<div class="procurement-note"><strong>Previous rejection</strong><p>${this.escape(req.previous_rejection_reason)}</p></div>`
      : "";
    const unmatched = req.unmatched_count
      ? `<p class="procurement-warning">${req.unmatched_count} line(s) are not linked to inventory items.</p>`
      : "";
    const slipMeta = `
      <div class="procurement-slip-meta">
        <div><strong>To</strong><span>${this.escape(req.destination || "—")}</span></div>
        <div><strong>Date needed</strong><span>${this.escape(req.date_needed || "—")}</span></div>
        <div class="procurement-slip-meta__wide"><strong>Purpose</strong><span>${this.escape(req.purpose || "—")}</span></div>
      </div>`;

    const itemRows = items.map((line) => {
      const qtyControl = denied && this.canEdit
        ? `<input type="number" min="0" class="procurement-qty-input" data-line-id="${line.id}" value="${line.requested_qty}">`
        : String(line.requested_qty);
      const applied = line.applied_qty == null ? "—" : String(line.applied_qty);
      const match = line.matched ? "" : ` <span class="procurement-unmatched">Unmatched</span>`;
      const size = line.size ? `<span class="procurement-detail-size">${this.escape(line.size)}</span>` : "";
      return `<tr>
        <td class="procurement-detail-code">${this.escape(line.item_code || "—")}</td>
        <td><span class="procurement-detail-item">${this.escape(line.title)}</span>${match}${size}</td>
        <td class="num">${line.current_qty}</td>
        <td class="num">${line.need_3m}</td>
        <td class="num">${qtyControl}</td>
        <td class="num">${applied}</td>
      </tr>`;
    }).join("");

    const step = NEXT_STEP[req.status];
    const reviewBtns = inWorkflow && req.can_act && step ? `
      <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-action="approve">${this.escape(step.confirm)}</button>
      <button type="button" class="confirm-modal__btn confirm-modal__btn--danger" data-action="deny">Deny</button>
    ` : "";

    const printBtns = (approved || req.status === "stock_entered") && req.can_print ? `
      <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-action="print">Print RS slip</button>
      ${approved ? `<button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-action="stock">Stock entry</button>` : ""}
    ` : "";

    const deniedBtns = denied && this.canEdit ? `
      <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-action="save-edit">Save edits</button>
      <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-action="resubmit">Resubmit to dept. head</button>
    ` : "";

    const canDelete = this.canDeleteRequest(req);
    const deleteBtn = (pending || denied) && canDelete
      ? `<button type="button" class="confirm-modal__btn ${denied ? "confirm-modal__btn--danger" : "confirm-modal__btn--ghost"}" data-action="delete">Delete</button>`
      : "";

    const actions = `${reviewBtns}${printBtns}${deniedBtns}${deleteBtn}`;
    if (footer) {
      footer.hidden = !actions;
      footer.innerHTML = actions
        ? `<div class="procurement-detail-modal__actions">${actions}</div>`
        : "";
      footer.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => this.onAction(btn.dataset.action));
      });
    }

    const emptyMessage = this.requestedOnly
      ? "No lines with requested or applied quantity."
      : "No lines";

    this.detailEl.innerHTML = `
      ${this.renderWorkflow(req)}
      ${slipMeta}
      ${reason}${previous}${unmatched}
      <div class="procurement-detail-toolbar">
        <label class="procurement-mine-toggle" title="Show only lines with requested or applied quantity">
          <span class="procurement-mine-toggle__label">Requested / Applied</span>
          <input type="checkbox" id="procurementRequestedOnly" ${this.requestedOnly ? "checked" : ""} />
          <span class="procurement-mine-toggle__switch" aria-hidden="true"></span>
        </label>
        <span class="procurement-detail-toolbar__hint">${items.length} shown${hiddenCount ? ` · ${hiddenCount} hidden` : ""} of ${allItems.length}</span>
      </div>
      <div class="procurement-detail-table-wrap">
        <table class="product-section-table procurement-detail-table">
          <thead>
            <tr class="table__title">
              <td>Code</td>
              <td>Item</td>
              <td class="num">Stock</td>
              <td class="num">3 mo need</td>
              <td class="num">Requested</td>
              <td class="num">Applied</td>
            </tr>
          </thead>
          <tbody>${itemRows || `<tr><td colspan="6" class="users-empty">${emptyMessage}</td></tr>`}</tbody>
        </table>
      </div>
    `;

    this.toggleOverlay("procurementDetailOverlay", true);
    this.detailEl.querySelector("#procurementRequestedOnly")?.addEventListener("change", (e) => {
      this.requestedOnly = !!e.target.checked;
      this.renderDetail();
    });
  }

  renderWorkflow(req) {
    const steps = [
      { key: "request", label: "1. Request slip", person: req.uploaded_by, done: true },
      { key: "dept", label: "2. Department head", person: req.noted_by?.name, done: !!req.noted_at, waiting: req.status === "pending" },
      { key: "check", label: "3. Procurement check", person: req.checked_by?.name, done: !!req.checked_at, waiting: req.status === "dept_noted" },
      { key: "manager", label: "4. Branch manager", person: req.approved_by?.name, done: !!req.approved_at, waiting: req.status === "procurement_checked" },
      { key: "print", label: "Print RS slip", person: req.status === "approved" || req.status === "stock_entered" ? (req.assigned_to?.name || req.checked_by?.name) : null, done: !!req.printed_at, waiting: req.status === "approved" },
    ];

    return `<ol class="procurement-workflow">
      ${steps.map((step) => {
        const state = step.done ? "is-done" : step.waiting ? "is-current" : "";
        const who = step.person
          ? this.escape(step.person)
          : step.waiting && req.assigned_to?.name
            ? `Waiting on ${this.escape(req.assigned_to.name)}`
            : "—";
        return `<li class="${state}"><strong>${step.label}</strong><span>${who}</span></li>`;
      }).join("")}
    </ol>`;
  }

  canDeleteRequest(req) {
    if (this.canReview || this.canManageUsers) return true;
    if (!this.canEdit || !req) return false;
    return this.userId > 0 && Number(req.uploaded_by_id) === this.userId;
  }

  async onAction(action) {
    if (!this.detail) return;
    if (action === "approve") return this.approve();
    if (action === "print") return this.printSlip();
    if (action === "deny") return this.openDeny();
    if (action === "stock") return this.openStock();
    if (action === "save-edit") return this.saveEdits();
    if (action === "resubmit") return this.resubmit();
    if (action === "delete") return this.remove();
  }

  async openManual() {
    if (!this.canEdit) return;
    this.closeDeny();
    this.closeStock();
    this.manualQtys = {};
    this.manualSearch = "";
    const search = document.getElementById("procurementManualSearch");
    if (search) search.value = "";
    document.getElementById("procurementManualError")?.classList.add("--hidden");
    const body = document.getElementById("procurementManualBody");
    if (body) body.innerHTML = `<tr><td colspan="6" class="users-empty">Loading items…</td></tr>`;
    this.fillAssigneeSelect(document.getElementById("procurementManualAssignee"));
    const dest = document.getElementById("procurementManualDestination");
    const purpose = document.getElementById("procurementManualPurpose");
    const needed = document.getElementById("procurementManualDateNeeded");
    if (dest) dest.value = "";
    if (purpose) purpose.value = "";
    if (needed) needed.value = "";
    this.toggleOverlay("procurementManualOverlay", true);
    this.updateManualHint();
    if (!this.people.length) await this.loadPeople();
    else this.fillAssigneeSelect(document.getElementById("procurementManualAssignee"));
    try {
      const res = await fetch("/api/items");
      const data = await res.json();
      this.manualItems = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        itemCode: item.itemCode ?? item.item_code ?? "",
        title: item.title || item.name || "",
        size: item.size || "",
        quantity: item.quantity ?? item.stock ?? 0,
        monthlyDemand: item.monthlyDemand ?? item.monthly_demand ?? 0,
      }));
      this.renderManualLines();
    } catch (err) {
      console.error(err);
      if (body) body.innerHTML = `<tr><td colspan="6" class="users-empty">Unable to load inventory items.</td></tr>`;
    }
  }

  closeManual() {
    this.toggleOverlay("procurementManualOverlay", false);
  }

  roundHalfDown(value) {
    const floored = Math.floor(value);
    return value - floored === 0.5 ? floored : Math.round(value);
  }

  manualMetrics(item) {
    const stock = Number(item.quantity) || 0;
    const amc = Number(item.monthlyDemand) || 0;
    const leadTimeDemand = amc * 3.495065789473684;
    const safetyStock = (amc + leadTimeDemand) * 0.1;
    const rop = this.roundHalfDown(leadTimeDemand) + this.roundHalfDown(safetyStock);
    const need3m = Math.max(0, Math.ceil(amc * 3 - stock));
    const missingRop = Math.max(0, rop - stock);
    return { stock, amc, rop, need3m, missingRop, belowRop: stock < rop };
  }

  filteredManualItems() {
    if (!this.manualSearch) return this.manualItems;
    return this.manualItems.filter((item) => {
      const hay = [item.itemCode, item.title, item.size].join(" ").toLowerCase();
      return hay.includes(this.manualSearch);
    });
  }

  fillManualByMode(mode) {
    let filled = 0;
    this.manualItems.forEach((item) => {
      const m = this.manualMetrics(item);
      const qty = mode === "missing-rop" ? m.missingRop : m.need3m;
      if (qty > 0) {
        this.manualQtys[item.id] = qty;
        filled += 1;
      } else {
        delete this.manualQtys[item.id];
      }
    });
    this.renderManualLines();
    const hint = document.getElementById("procurementManualHint");
    if (hint && !filled) {
      hint.textContent = mode === "missing-rop"
        ? "No items are below ROP."
        : "No items have a 3-month procurement need.";
    }
  }

  clearManualQtys() {
    this.manualQtys = {};
    this.renderManualLines();
  }

  renderManualLines() {
    const body = document.getElementById("procurementManualBody");
    if (!body) return;
    const items = this.filteredManualItems();
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="6" class="users-empty">No items match this search.</td></tr>`;
      this.updateManualHint();
      return;
    }
    body.innerHTML = items.map((item) => {
      const m = this.manualMetrics(item);
      const qty = this.manualQtys[item.id] ?? "";
      const stockClass = m.belowRop ? "procurement-manual-stock--low" : "";
      const title = item.title || item.size || "Item";
      const size = item.size && item.size !== title ? item.size : "";
      return `<tr>
        <td>${this.escape(item.itemCode || "—")}</td>
        <td><strong>${this.escape(title)}</strong>${size ? `<div class="activity-logs-when"><small>${this.escape(size)}</small></div>` : ""}</td>
        <td class="${stockClass}"><strong>${m.stock}</strong></td>
        <td>${m.rop}</td>
        <td>${m.need3m > 0 ? `+${m.need3m}` : "OK"}</td>
        <td><input type="number" min="0" step="1" class="procurement-qty-input" data-item-id="${item.id}" value="${qty}" placeholder="0"></td>
      </tr>`;
    }).join("");
    this.updateManualHint();
  }

  updateManualHint() {
    const hint = document.getElementById("procurementManualHint");
    if (!hint) return;
    const count = Object.keys(this.manualQtys).length;
    const total = Object.values(this.manualQtys).reduce((sum, qty) => sum + Number(qty || 0), 0);
    hint.textContent = count
      ? `${count} line${count === 1 ? "" : "s"} ready · ${total} total qty`
      : "0 lines ready — enter quantities or use Fill Missing ROP / Fill Procurement need";
  }

  async submitManual() {
    const error = document.getElementById("procurementManualError");
    const items = this.manualItems
      .filter((item) => Number(this.manualQtys[item.id]) > 0)
      .map((item) => ({
        item_id: item.id,
        item_code: item.itemCode || "",
        title: item.title || "Item",
        size: item.size || "",
        current_qty: Number(item.quantity) || 0,
        amc: Number(item.monthlyDemand) || 0,
        need_3m: Number(this.manualQtys[item.id]) || 0,
        need_6m: 0,
        need_1y: 0,
        method: "Manual",
        requested_qty: Number(this.manualQtys[item.id]) || 0,
      }));

    const assignedTo = Number(document.getElementById("procurementManualAssignee")?.value || 0);
    if (!items.length) {
      if (error) {
        error.textContent = "Enter at least one requested quantity greater than 0.";
        error.classList.remove("--hidden");
      }
      return;
    }
    if (!assignedTo) {
      if (error) {
        error.textContent = "Pick who should review this request next.";
        error.classList.remove("--hidden");
      }
      return;
    }

    const ok = await confirmAction({
      title: "Submit request slip?",
      message: `Create a request slip with ${items.length} line item${items.length === 1 ? "" : "s"} and send it to the person you picked?`,
      confirmLabel: "Submit request",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/procurement-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          original_filename: "Manual entry",
          destination: document.getElementById("procurementManualDestination")?.value.trim() || "",
          purpose: document.getElementById("procurementManualPurpose")?.value.trim() || "",
          date_needed: document.getElementById("procurementManualDateNeeded")?.value || null,
          assigned_to: assignedTo,
          items,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create request.");
      this.closeManual();
      await this.loadRequests();
      if (data.request?.id) await this.selectRequest(data.request.id);
    } catch (err) {
      if (error) {
        error.textContent = err.message || "Could not create request.";
        error.classList.remove("--hidden");
      } else {
        notifyAlert(err.message || "Could not create request.");
      }
    }
  }

  async approve() {
    const step = NEXT_STEP[this.detail?.status];
    if (!step) return;
    const assignedTo = await this.chooseNextPerson({
      title: step.action,
      message: `This does not add stock yet. After you continue, pick ${step.nextLabel}.`,
      confirmLabel: step.confirm,
    });
    if (!assignedTo) return;
    await this.post(`/api/procurement-requests/${this.detail.id}/approve`, { assigned_to: assignedTo });
  }

  printSlip() {
    if (!this.detail?.id) return;
    window.open(`/procurement-requests/${this.detail.id}/slip`, "_blank", "noopener");
  }

  openDeny() {
    this.closeStock();
    document.getElementById("procurementDenyReason").value = "";
    document.getElementById("procurementDenyError")?.classList.add("--hidden");
    this.toggleOverlay("procurementDenyOverlay", true);
  }

  closeDeny() {
    this.toggleOverlay("procurementDenyOverlay", false);
  }

  async submitDeny() {
    const reason = document.getElementById("procurementDenyReason").value.trim();
    const error = document.getElementById("procurementDenyError");
    if (reason.length < 3) {
      error.textContent = "Must be completed before denying this request.";
      error.classList.remove("--hidden");
      return;
    }
    await this.post(`/api/procurement-requests/${this.detail.id}/deny`, { reason });
    this.closeDeny();
  }

  openStock() {
    this.closeDeny();
    const host = document.getElementById("procurementStockLines");
    const items = this.detail?.items || [];
    host.innerHTML = items.length
      ? items.map((line) => `
      <label class="procurement-stock-line">
        <span>
          <strong>${this.escape(line.title)}</strong>
          <small>${this.escape(line.item_code || "")} · requested ${line.requested_qty}</small>
        </span>
        <input type="number" min="0" data-line-id="${line.id}" value="${line.requested_qty}">
      </label>
    `).join("")
      : `<p class="users-empty">No item lines on this request.</p>`;
    document.getElementById("procurementStockError")?.classList.add("--hidden");
    this.toggleOverlay("procurementStockOverlay", true);
  }

  closeStock() {
    this.toggleOverlay("procurementStockOverlay", false);
  }

  toggleOverlay(id, open) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !open;
    el.classList.toggle("is-open", open);
  }

  async submitStock() {
    const items = [...document.querySelectorAll("#procurementStockLines input")].map((input) => ({
      id: Number(input.dataset.lineId),
      qty: Number(input.value || 0),
    }));
    await this.post(`/api/procurement-requests/${this.detail.id}/stock-entry`, { items });
    this.closeStock();
  }

  collectQtyEdits() {
    return [...this.detailEl.querySelectorAll(".procurement-qty-input")].map((input) => ({
      id: Number(input.dataset.lineId),
      requested_qty: Number(input.value || 0),
    }));
  }

  async saveEdits() {
    await this.put(`/api/procurement-requests/${this.detail.id}`, { items: this.collectQtyEdits() });
  }

  async resubmit() {
    const assignedTo = await this.chooseNextPerson({
      title: "Resubmit request slip?",
      message: "Quantity edits will be saved, then pick who should note this request next.",
      confirmLabel: "Resubmit",
    });
    if (!assignedTo) return;
    const edits = this.collectQtyEdits();
    if (edits.length) {
      await this.put(`/api/procurement-requests/${this.detail.id}`, { items: edits });
    }
    await this.post(`/api/procurement-requests/${this.detail.id}/resubmit`, { assigned_to: assignedTo });
  }

  async remove() {
    if (!this.canDeleteRequest(this.detail)) {
      notifyAlert("You can only delete your own requests.");
      return;
    }
    const ok = await confirmAction({
      title: "Delete this request?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/procurement-requests/${this.detail.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      notifyAlert(data.error || "Could not delete this request.");
      return;
    }
    this.hideDetail();
    await this.loadRequests();
  }

  async post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notifyAlert(data.error || "Request failed.");
      return;
    }
    await this.loadRequests();
    if (data.request?.id) await this.selectRequest(data.request.id);
  }

  async put(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notifyAlert(data.error || "Could not save edits.");
      return;
    }
    await this.loadRequests();
    if (data.request?.id) await this.selectRequest(data.request.id);
  }

  formatWhen(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

export default new ProcurementView();
