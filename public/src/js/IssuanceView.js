import confirmAction, { notifyAlert } from "./ConfirmDialog.js";
import { bindBackdropClose } from "./OverlayDismiss.js";
import Pagination from "./Pagination.js";

const STATUS = {
  pending: { label: "Pending", tone: "orange" },
  approved: { label: "Approved", tone: "green" },
  denied: { label: "Denied", tone: "red" },
  stock_entered: { label: "Stock used", tone: "blue" },
};

class IssuanceView {
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
    this.canEdit = document.body.dataset.canIssuanceEdit === "true";
    this.canReview = document.body.dataset.canIssuanceReview === "true";
    this.canManageUsers = document.body.dataset.canManageUsers === "true";
    this.userId = Number(document.body.dataset.userId || 0);
    this.pagination = new Pagination({
      pageSize: 10,
      onPageChange: () => this.renderList(),
    });
  }

  async setApp() {
    this.root = document.querySelector(".issuance-page");
    if (!this.root) return;
    this.tbody = document.getElementById("issuanceTableBody");
    this.detailEl = document.getElementById("issuanceDetail");
    this.detailOverlay = document.getElementById("issuanceDetailOverlay");
    this.pagination.setContainer(document.getElementById("issuancePagination"));
    this.closeDeny();
    this.closeStock();
    this.closeManual();
    this.hideDetail();
    const requestId = Number(new URLSearchParams(window.location.search).get("request"));
    if (requestId) this.selectedId = requestId;
    this.bindEvents();
    await this.loadRequests();
  }

  bindEvents() {
    document.getElementById("issuanceSummary")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-status]");
      if (card) this.setStatusFilter(card.dataset.status);
    });

    document.getElementById("issuanceSearch")?.addEventListener("input", (e) => {
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

    document.getElementById("issuanceDetailClose")?.addEventListener("click", () => this.hideDetail());
    bindBackdropClose(this.detailOverlay, () => this.hideDetail());

    document.getElementById("issuanceManualBtn")?.addEventListener("click", () => this.openManual());
    document.getElementById("issuanceManualCancel")?.addEventListener("click", () => this.closeManual());
    document.getElementById("issuanceManualConfirm")?.addEventListener("click", () => this.submitManual());
    document.getElementById("issuanceManualFillOnHand")?.addEventListener("click", () => this.fillOnHand());
    document.getElementById("issuanceManualClearAll")?.addEventListener("click", () => this.clearManualQtys());
    document.getElementById("issuanceManualSearch")?.addEventListener("input", (e) => {
      this.manualSearch = e.target.value.trim().toLowerCase();
      this.renderManualLines();
    });
    document.getElementById("issuanceManualBody")?.addEventListener("input", (e) => {
      const input = e.target.closest("input[data-item-id]");
      if (!input) return;
      const id = Number(input.dataset.itemId);
      const qty = Math.max(0, Math.floor(Number(input.value) || 0));
      if (qty > 0) this.manualQtys[id] = qty;
      else delete this.manualQtys[id];
      this.updateManualHint();
    });

    document.getElementById("issuanceDenyCancel")?.addEventListener("click", () => this.closeDeny());
    document.getElementById("issuanceDenyConfirm")?.addEventListener("click", () => this.submitDeny());
    document.getElementById("issuanceStockCancel")?.addEventListener("click", () => this.closeStock());
    document.getElementById("issuanceStockConfirm")?.addEventListener("click", () => this.submitStock());

    bindBackdropClose(document.getElementById("issuanceDenyOverlay"), () => this.closeDeny());
    bindBackdropClose(document.getElementById("issuanceStockOverlay"), () => this.closeStock());
    bindBackdropClose(document.getElementById("issuanceManualOverlay"), () => this.closeManual());

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (document.getElementById("issuanceDenyOverlay")?.classList.contains("is-open")) {
        this.closeDeny();
        return;
      }
      if (document.getElementById("issuanceStockOverlay")?.classList.contains("is-open")) {
        this.closeStock();
        return;
      }
      if (document.getElementById("issuanceManualOverlay")?.classList.contains("is-open")) {
        this.closeManual();
        return;
      }
      this.hideDetail();
    });
  }

  setStatusFilter(status) {
    this.statusFilter = status || "all";
    document.querySelectorAll("#issuanceSummary [data-status]").forEach((el) => {
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
        row.original_filename,
        row.source,
        row.status,
        row.uploaded_by,
      ].join(" ").toLowerCase();
      return haystack.includes(this.search);
    });
  }

  async refreshLive() {
    if (!document.querySelector(".issuance-page")) return;
    await this.loadRequests();
  }

  async loadRequests() {
    try {
      const res = await fetch("/api/issuance-requests");
      const data = await res.json();
      this.requests = Array.isArray(data.requests) ? data.requests : [];
      this.renderKpis();
      this.renderList();
      if (this.selectedId) await this.selectRequest(this.selectedId);
    } catch (err) {
      console.error(err);
      if (this.tbody) {
        this.tbody.innerHTML = `<tr><td colspan="7" class="users-empty">Unable to load issuance requests.</td></tr>`;
      }
    }
  }

  renderKpis() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };
    set("issuanceKpiTotal", this.requests.length);
    set("issuanceKpiPending", this.requests.filter((r) => r.status === "pending").length);
    set("issuanceKpiApproved", this.requests.filter((r) => r.status === "approved").length);
    set("issuanceKpiDenied", this.requests.filter((r) => r.status === "denied").length);
    set("issuanceKpiStockEntered", this.requests.filter((r) => r.status === "stock_entered").length);
  }

  renderList() {
    const rows = this.filtered();
    if (!this.tbody) return;
    if (!rows.length) {
      this.tbody.innerHTML = `<tr><td colspan="7" class="users-empty">No issuance requests match this view. Add a request to get started.</td></tr>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    const page = this.pagination.getSlice(rows);
    this.tbody.innerHTML = page.items.map((row) => {
      const badge = STATUS[row.status] || STATUS.pending;
      const selected = row.id === this.selectedId ? " is-selected" : "";
      return `<tr data-id="${row.id}" class="${selected}">
        <td><strong>#${row.id}</strong></td>
        <td>${this.escape(row.original_filename || row.source || "Request")}</td>
        <td><span class="dashboard-activity__badge dashboard-activity__badge--${badge.tone}">${badge.label}</span></td>
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
    this.toggleOverlay("issuanceDetailOverlay", false);
    const footer = document.getElementById("issuanceDetailFooter");
    if (footer) {
      footer.hidden = true;
      footer.innerHTML = "";
    }
    const badgeEl = document.getElementById("issuanceDetailBadge");
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
      const detailRes = await fetch(`/api/issuance-requests/${id}`);
      const detailData = await detailRes.json();
      this.detail = detailData.request || null;
      this.renderDetail();
    } catch (err) {
      console.error(err);
      if (this.detailEl) {
        this.detailEl.innerHTML = `<p class="users-empty">Unable to load this request.</p>`;
      }
      this.toggleOverlay("issuanceDetailOverlay", true);
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
    const denied = req.status === "denied";
    const allItems = req.items || [];
    const items = this.detailLines();
    const hiddenCount = Math.max(0, allItems.length - items.length);

    const title = document.getElementById("issuanceDetailTitle");
    const meta = document.getElementById("issuanceDetailMeta");
    const badgeEl = document.getElementById("issuanceDetailBadge");
    const footer = document.getElementById("issuanceDetailFooter");
    if (title) title.textContent = `Request #${req.id}`;
    if (badgeEl) {
      badgeEl.hidden = false;
      badgeEl.className = `dashboard-activity__badge dashboard-activity__badge--${badge.tone}`;
      badgeEl.textContent = badge.label;
    }
    if (meta) {
      const source = this.escape(req.original_filename || req.source || "Request");
      const by = this.escape(req.uploaded_by || "Unknown");
      meta.innerHTML = `
        <span class="procurement-detail-meta__chip">${source}</span>
        <span class="procurement-detail-meta__sep">·</span>
        <span class="procurement-detail-meta__chip">Submitted by ${by}</span>
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
        <td class="num">${qtyControl}</td>
        <td class="num">${applied}</td>
      </tr>`;
    }).join("");

    const reviewBtns = pending && this.canReview ? `
      <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-action="approve">Approve</button>
      <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-action="stock">Use stock</button>
      <button type="button" class="confirm-modal__btn confirm-modal__btn--danger" data-action="deny">Deny</button>
    ` : "";

    const deniedBtns = denied && this.canEdit ? `
      <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-action="save-edit">Save edits</button>
      <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-action="resubmit">Return to pending</button>
    ` : "";

    const canDelete = this.canDeleteRequest(req);
    const deleteBtn = (pending || denied) && canDelete
      ? `<button type="button" class="confirm-modal__btn ${denied ? "confirm-modal__btn--danger" : "confirm-modal__btn--ghost"}" data-action="delete">Delete</button>`
      : "";

    const actions = `${reviewBtns}${deniedBtns}${deleteBtn}`;
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
      ${reason}${previous}${unmatched}
      <div class="procurement-detail-toolbar">
        <label class="procurement-mine-toggle" title="Show only lines with requested or applied quantity">
          <span class="procurement-mine-toggle__label">Requested / Applied</span>
          <input type="checkbox" id="issuanceRequestedOnly" ${this.requestedOnly ? "checked" : ""} />
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
              <td class="num">To use</td>
              <td class="num">Used</td>
            </tr>
          </thead>
          <tbody>${itemRows || `<tr><td colspan="5" class="users-empty">${emptyMessage}</td></tr>`}</tbody>
        </table>
      </div>
    `;

    this.toggleOverlay("issuanceDetailOverlay", true);
    this.detailEl.querySelector("#issuanceRequestedOnly")?.addEventListener("change", (e) => {
      this.requestedOnly = !!e.target.checked;
      this.renderDetail();
    });
  }

  canDeleteRequest(req) {
    if (this.canReview || this.canManageUsers) return true;
    if (!this.canEdit || !req) return false;
    return this.userId > 0 && Number(req.uploaded_by_id) === this.userId;
  }

  async onAction(action) {
    if (!this.detail) return;
    if (action === "approve") return this.approve();
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
    const search = document.getElementById("issuanceManualSearch");
    if (search) search.value = "";
    document.getElementById("issuanceManualError")?.classList.add("--hidden");
    const body = document.getElementById("issuanceManualBody");
    if (body) body.innerHTML = `<tr><td colspan="4" class="users-empty">Loading items…</td></tr>`;
    this.toggleOverlay("issuanceManualOverlay", true);
    this.updateManualHint();
    try {
      const res = await fetch("/api/items");
      const data = await res.json();
      this.manualItems = Array.isArray(data) ? data : [];
      this.renderManualLines();
    } catch (err) {
      console.error(err);
      if (body) body.innerHTML = `<tr><td colspan="4" class="users-empty">Unable to load inventory items.</td></tr>`;
    }
  }

  closeManual() {
    this.toggleOverlay("issuanceManualOverlay", false);
  }

  fillOnHand() {
    let filled = 0;
    this.manualItems.forEach((item) => {
      const stock = Math.max(0, Math.floor(Number(item.quantity) || 0));
      if (stock > 0) {
        this.manualQtys[item.id] = stock;
        filled += 1;
      } else {
        delete this.manualQtys[item.id];
      }
    });
    this.renderManualLines();
    const hint = document.getElementById("issuanceManualHint");
    if (hint && !filled) {
      hint.textContent = "No items currently have on-hand stock.";
    }
  }

  clearManualQtys() {
    this.manualQtys = {};
    this.renderManualLines();
  }

  filteredManualItems() {
    if (!this.manualSearch) return this.manualItems;
    return this.manualItems.filter((item) => {
      const hay = [item.itemCode, item.title, item.size].join(" ").toLowerCase();
      return hay.includes(this.manualSearch);
    });
  }

  renderManualLines() {
    const body = document.getElementById("issuanceManualBody");
    if (!body) return;
    const items = this.filteredManualItems();
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="4" class="users-empty">No items match this search.</td></tr>`;
      this.updateManualHint();
      return;
    }
    body.innerHTML = items.map((item) => {
      const stock = Number(item.quantity) || 0;
      const qty = this.manualQtys[item.id] ?? "";
      const stockClass = stock <= 0 ? "procurement-manual-stock--low" : "";
      return `<tr>
        <td>${this.escape(item.itemCode || "—")}</td>
        <td><strong>${this.escape(item.title || "Item")}</strong>${item.size ? `<div class="activity-logs-when"><small>${this.escape(item.size)}</small></div>` : ""}</td>
        <td class="${stockClass}"><strong>${stock}</strong></td>
        <td><input type="number" min="0" step="1" class="procurement-qty-input" data-item-id="${item.id}" value="${qty}" placeholder="0"></td>
      </tr>`;
    }).join("");
    this.updateManualHint();
  }

  updateManualHint() {
    const hint = document.getElementById("issuanceManualHint");
    if (!hint) return;
    const count = Object.keys(this.manualQtys).length;
    const total = Object.values(this.manualQtys).reduce((sum, qty) => sum + Number(qty || 0), 0);
    hint.textContent = count
      ? `${count} line${count === 1 ? "" : "s"} ready · ${total} total qty`
      : "0 lines ready — enter quantities or use Fill on-hand";
  }

  async submitManual() {
    const error = document.getElementById("issuanceManualError");
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

    if (!items.length) {
      if (error) {
        error.textContent = "Enter at least one quantity greater than 0.";
        error.classList.remove("--hidden");
      }
      return;
    }

    const ok = await confirmAction({
      title: "Submit issuance request?",
      message: `Create a pending request to use stock for ${items.length} line item${items.length === 1 ? "" : "s"}?`,
      confirmLabel: "Submit request",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/issuance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          original_filename: "Manual entry",
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
    const ok = await confirmAction({
      title: "Approve this request?",
      message: "Requested quantities will be deducted from inventory automatically. Approval fails if any line exceeds on-hand stock.",
      confirmLabel: "Approve",
    });
    if (!ok) return;
    await this.post(`/api/issuance-requests/${this.detail.id}/approve`);
  }

  openDeny() {
    this.closeStock();
    document.getElementById("issuanceDenyReason").value = "";
    document.getElementById("issuanceDenyError")?.classList.add("--hidden");
    this.toggleOverlay("issuanceDenyOverlay", true);
  }

  closeDeny() {
    this.toggleOverlay("issuanceDenyOverlay", false);
  }

  async submitDeny() {
    const reason = document.getElementById("issuanceDenyReason").value.trim();
    const error = document.getElementById("issuanceDenyError");
    if (reason.length < 3) {
      error.textContent = "Must be completed before denying this request.";
      error.classList.remove("--hidden");
      return;
    }
    await this.post(`/api/issuance-requests/${this.detail.id}/deny`, { reason });
    this.closeDeny();
  }

  openStock() {
    this.closeDeny();
    const host = document.getElementById("issuanceStockLines");
    const items = this.detail?.items || [];
    host.innerHTML = items.length
      ? items.map((line) => `
      <label class="procurement-stock-line">
        <span>
          <strong>${this.escape(line.title)}</strong>
          <small>${this.escape(line.item_code || "")} · requested ${line.requested_qty} · on hand ${line.current_qty}</small>
        </span>
        <input type="number" min="0" data-line-id="${line.id}" value="${line.requested_qty}">
      </label>
    `).join("")
      : `<p class="users-empty">No item lines on this request.</p>`;
    document.getElementById("issuanceStockError")?.classList.add("--hidden");
    this.toggleOverlay("issuanceStockOverlay", true);
  }

  closeStock() {
    this.toggleOverlay("issuanceStockOverlay", false);
  }

  toggleOverlay(id, open) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !open;
    el.classList.toggle("is-open", open);
  }

  async submitStock() {
    const items = [...document.querySelectorAll("#issuanceStockLines input")].map((input) => ({
      id: Number(input.dataset.lineId),
      qty: Number(input.value || 0),
    }));
    await this.post(`/api/issuance-requests/${this.detail.id}/stock-entry`, { items });
    this.closeStock();
  }

  collectQtyEdits() {
    return [...this.detailEl.querySelectorAll(".procurement-qty-input")].map((input) => ({
      id: Number(input.dataset.lineId),
      requested_qty: Number(input.value || 0),
    }));
  }

  async saveEdits() {
    await this.put(`/api/issuance-requests/${this.detail.id}`, { items: this.collectQtyEdits() });
  }

  async resubmit() {
    const ok = await confirmAction({
      title: "Return to pending?",
      message: "Quantity edits will be saved, then the request goes back to pending.",
      confirmLabel: "Resubmit",
    });
    if (!ok) return;
    const edits = this.collectQtyEdits();
    if (edits.length) {
      await this.put(`/api/issuance-requests/${this.detail.id}`, { items: edits });
    }
    await this.post(`/api/issuance-requests/${this.detail.id}/resubmit`);
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
    const res = await fetch(`/api/issuance-requests/${this.detail.id}`, { method: "DELETE" });
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

export default new IssuanceView();
