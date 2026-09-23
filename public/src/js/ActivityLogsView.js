import Pagination from "./Pagination.js";
import { activityChanges, renderActivityChanges } from "./ActivityChanges.js";
import { bindBackdropClose } from "./OverlayDismiss.js";

const ACTION_BADGES = {
  created: { label: "Added", tone: "green" },
  updated: { label: "Updated", tone: "blue" },
  deleted: { label: "Deleted", tone: "red" },
  stock_added: { label: "Stock +", tone: "green" },
  stock_used: { label: "Stock −", tone: "orange" },
  procurement_submitted: { label: "Procure", tone: "blue" },
  procurement_dept_noted: { label: "Noted", tone: "blue" },
  procurement_checked: { label: "Checked", tone: "blue" },
  procurement_approved: { label: "Approved", tone: "green" },
  procurement_printed: { label: "Printed", tone: "green" },
  procurement_denied: { label: "Denied", tone: "red" },
  procurement_stock_entered: { label: "Stock in", tone: "green" },
  procurement_edited: { label: "Edited", tone: "blue" },
  procurement_resubmitted: { label: "Resubmitted", tone: "orange" },
  procurement_returned: { label: "Returned", tone: "orange" },
  procurement_deleted: { label: "Deleted", tone: "red" },
  issuance_submitted: { label: "Issuance", tone: "blue" },
  issuance_approved: { label: "Approved", tone: "green" },
  issuance_denied: { label: "Denied", tone: "red" },
  issuance_stock_used: { label: "Stock −", tone: "orange" },
  issuance_edited: { label: "Edited", tone: "blue" },
  issuance_resubmitted: { label: "Resubmitted", tone: "orange" },
  issuance_deleted: { label: "Deleted", tone: "red" },
};

class ActivityLogsView {
  constructor() {
    this.logs = [];
    this.total = 0;
    this.requestId = 0;
    this.filters = {
      q: "",
      action: "",
      date_from: "",
      date_to: "",
    };
    this.searchTimer = null;
    this.pagination = new Pagination({
      pageSize: 25,
      pageSizeOptions: [10, 25, 50, 100],
      onPageChange: () => this.loadLogs(),
    });
  }

  async setApp() {
    this.root = document.querySelector(".activity-logs-page");
    if (!this.root) return;

    this.tbody = document.getElementById("activityLogsTableBody");
    this.searchInput = document.getElementById("activityLogsSearch");
    this.actionSelect = document.getElementById("activityLogsAction");
    this.dateFrom = document.getElementById("activityLogsDateFrom");
    this.dateTo = document.getElementById("activityLogsDateTo");
    this.overlay = document.getElementById("activityLogDetailOverlay");
    this.detailTitle = document.getElementById("activityLogDetailTitle");
    this.detailBody = document.getElementById("activityLogDetailBody");

    this.pagination.setContainer(document.getElementById("activityLogsPagination"));
    this.bindEvents();
    await this.loadLogs();
  }

  bindEvents() {
    this.tbody?.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-log-id]");
      if (!row) return;
      const log = this.logs.find((item) => String(item.id) === String(row.dataset.logId));
      if (log) this.openDetail(log);
    });

    document.getElementById("activityLogDetailClose")?.addEventListener("click", () => this.closeDetail());
    bindBackdropClose(this.overlay, () => this.closeDetail());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.overlay && !this.overlay.classList.contains("--hidden")) {
        this.closeDetail();
      }
    });

    document.getElementById("activityLogsRefreshBtn")?.addEventListener("click", () => {
      this.loadLogs();
    });

    this.searchInput?.addEventListener("input", () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.readFilters();
        this.pagination.reset();
        this.loadLogs();
      }, 350);
    });

    this.actionSelect?.addEventListener("change", () => {
      this.readFilters();
      this.pagination.reset();
      this.loadLogs();
    });

    [this.dateFrom, this.dateTo].forEach((input) => {
      input?.addEventListener("change", () => {
        this.readFilters();
        this.pagination.reset();
        this.loadLogs();
      });
    });
  }

  readFilters() {
    this.filters = {
      q: this.searchInput?.value?.trim() || "",
      action: this.actionSelect?.value || "",
      date_from: this.dateFrom?.value || "",
      date_to: this.dateTo?.value || "",
    };
  }

  async refreshLive() {
    if (!this.root) return;
    await this.loadLogs({ silent: true });
  }

  async loadLogs({ silent = false } = {}) {
    if (!this.tbody) return;
    const requestId = ++this.requestId;
    if (!silent) {
      this.tbody.innerHTML = `
      <tr>
        <td colspan="4" class="users-empty">Loading activity…</td>
      </tr>`;
    }

    try {
      const params = new URLSearchParams({
        page: String(this.pagination.currentPage),
        per_page: String(this.pagination.pageSize),
      });

      if (this.filters.q) params.set("q", this.filters.q);
      if (this.filters.action) params.set("action", this.filters.action);
      if (this.filters.date_from) params.set("date_from", this.filters.date_from);
      if (this.filters.date_to) params.set("date_to", this.filters.date_to);

      const res = await fetch(`/api/activity-logs?${params}`);
      if (requestId !== this.requestId) return;

      if (!res.ok) {
        this.tbody.innerHTML = `
          <tr>
            <td colspan="4" class="users-empty">Unable to load activity logs.</td>
          </tr>`;
        this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
        return;
      }

      const data = await res.json();
      if (requestId !== this.requestId) return;

      this.logs = Array.isArray(data.logs) ? data.logs : [];
      this.total = Number(data.total) || this.logs.length;

      if (Number(data.page) && Number(data.page) !== this.pagination.currentPage) {
        this.pagination.currentPage = Number(data.page);
      }

      this.renderTable();
      this.pagination.renderControls({
        totalItems: this.total,
        totalPages: Math.max(1, Number(data.last_page) || 1),
        startIndex: Number(data.from) || 0,
        endIndex: Number(data.to) || 0,
      });
    } catch (e) {
      if (requestId !== this.requestId) return;
      console.error("Failed to load activity logs:", e);
      this.tbody.innerHTML = `
        <tr>
          <td colspan="4" class="users-empty">Unable to load activity logs.</td>
        </tr>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
    }
  }

  renderTable() {
    if (!this.logs.length) {
      this.tbody.innerHTML = `
        <tr>
          <td colspan="4" class="users-empty">No activity found.</td>
        </tr>`;
      return;
    }

    this.tbody.innerHTML = this.logs.map((log) => this.renderRow(log)).join("");
  }

  renderRow(log) {
    const badge = ACTION_BADGES[log.action] || { label: "Action", tone: "gray" };
    const name = this.escape(log.user?.full_name || "Unknown user");
    const role = this.escape(log.user?.role || "");
    const description = this.escape(log.description || "—");
    const when = this.formatWhen(log.created_at);
    const changes = renderActivityChanges(log.meta, (value) => this.escape(value));

    return `
      <tr class="activity-logs-row" data-log-id="${this.escape(log.id)}" title="View details">
        <td>
          <div class="activity-logs-when">
            <strong>${when.primary}</strong>
            <small>${when.secondary}</small>
          </div>
        </td>
        <td>
          <div class="activity-logs-user">
            <strong>${name}</strong>
            ${role ? `<small>${role}</small>` : ""}
          </div>
        </td>
        <td>
          <span class="dashboard-activity__badge dashboard-activity__badge--${badge.tone}">${badge.label}</span>
        </td>
        <td>
          <div class="activity-logs-details">
            <p class="activity-logs-details__summary">${description}</p>
            ${changes ? `<div class="activity-changes-scroll">${changes}</div>` : ""}
          </div>
        </td>
      </tr>`;
  }

  openDetail(log) {
    const badge = ACTION_BADGES[log.action] || { label: "Action", tone: "gray" };
    const when = this.formatWhen(log.created_at);
    const name = this.escape(log.user?.full_name || "Unknown user");
    const role = this.escape(log.user?.role || "—");
    const description = this.escape(log.description || "—");
    const subject = this.escape(this.subjectLabel(log));
    const extra = this.renderExtraMeta(log.meta);
    const changes = activityChanges(log.meta);

    if (this.detailTitle) {
      this.detailTitle.textContent = badge.label;
    }

    if (this.detailBody) {
      this.detailBody.innerHTML = `
        <div class="activity-log-detail">
          <p class="activity-log-detail__lead">${description}</p>
          <div class="viewItemModal__grid">
            <div class="viewItemModal__field"><span>When</span><strong>${this.escape(when.primary)}</strong></div>
            <div class="viewItemModal__field"><span>User</span><strong>${name}</strong></div>
            <div class="viewItemModal__field"><span>Role</span><strong>${role}</strong></div>
            <div class="viewItemModal__field"><span>Related to</span><strong>${subject}</strong></div>
            ${extra}
          </div>
          ${this.renderChangeTable(changes)}
        </div>`;
    }

    this.overlay?.classList.remove("--hidden");
  }

  closeDetail() {
    this.overlay?.classList.add("--hidden");
  }

  subjectLabel(log) {
    const id = Number(log.entity_id);
    if (log.entity_type === "procurement_request" && id) return `Procurement request #${id}`;
    if (log.entity_type === "issuance_request" && id) return `Issuance request #${id}`;
    if (log.entity_type === "item" && id) return `Inventory item #${id}`;
    if (log.entity_type === "user" && id) return `User #${id}`;
    if (log.entity_type) return String(log.entity_type).replaceAll("_", " ");
    return "—";
  }

  renderExtraMeta(meta) {
    if (!meta || typeof meta !== "object") return "";
    const fields = [
      ["status", "Status"],
      ["rejection_reason", "Rejection reason"],
      ["reason", "Reason"],
      ["original_filename", "File"],
    ];
    return fields
      .filter(([key]) => meta[key] != null && String(meta[key]).trim() !== "")
      .map(([key, label]) => {
        const value = this.escape(String(meta[key]).replaceAll("_", " "));
        return `<div class="viewItemModal__field"><span>${label}</span><strong>${value}</strong></div>`;
      })
      .join("");
  }

  renderChangeTable(changes) {
    if (!changes.length) {
      return `<p class="activity-log-detail__empty">No field-level changes were recorded for this action.</p>`;
    }

    const rows = changes.map((row) => {
      const field = this.escape(row.field || "Field");
      const hasFrom = Object.prototype.hasOwnProperty.call(row, "from");
      const from = hasFrom ? this.escape(this.displayValue(row.from)) : "—";
      const to = this.escape(this.displayValue(row.to));
      const delta = this.changeDelta(row);
      return `<tr>
        <td><strong>${field}</strong></td>
        <td>${from}</td>
        <td>${to}</td>
        <td>${delta}</td>
      </tr>`;
    }).join("");

    return `
      <h3 class="activity-log-detail__heading">What changed</h3>
      <div class="activity-log-detail__table-wrap">
        <table class="activity-log-detail__table">
          <thead>
            <tr>
              <th>Item / field</th>
              <th>Before</th>
              <th>After</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  changeDelta(row) {
    if (!Object.prototype.hasOwnProperty.call(row, "from")) {
      return this.escape(this.displayValue(row.to));
    }
    const fromNum = Number(row.from);
    const toNum = Number(row.to);
    if (Number.isFinite(fromNum) && Number.isFinite(toNum) && String(row.from).trim() !== "" && String(row.to).trim() !== "") {
      const diff = toNum - fromNum;
      if (diff === 0) return "No change";
      const sign = diff > 0 ? "+" : "";
      return this.escape(`${sign}${diff}`);
    }
    return `${this.escape(this.displayValue(row.from))} → ${this.escape(this.displayValue(row.to))}`;
  }

  displayValue(value) {
    if (value == null || String(value).trim() === "") return "—";
    return String(value);
  }

  formatWhen(iso) {
    if (!iso) return { primary: "—", secondary: "" };
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return { primary: "—", secondary: "" };

    const primary = date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    let secondary = "";
    if (mins < 1) secondary = "Just now";
    else if (mins < 60) secondary = `${mins}m ago`;
    else if (mins < 1440) secondary = `${Math.floor(mins / 60)}h ago`;
    else secondary = `${Math.floor(mins / 1440)}d ago`;

    return { primary, secondary };
  }

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

export default new ActivityLogsView();
