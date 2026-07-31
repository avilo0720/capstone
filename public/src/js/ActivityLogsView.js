import Pagination from "./Pagination.js";

const ACTION_BADGES = {
  created: { label: "Added", tone: "green" },
  updated: { label: "Updated", tone: "blue" },
  deleted: { label: "Deleted", tone: "red" },
  stock_added: { label: "Stock +", tone: "green" },
  stock_used: { label: "Stock −", tone: "orange" },
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

  setApp() {
    this.root = document.querySelector(".activity-logs-page");
    if (!this.root) return;

    this.tbody = document.getElementById("activityLogsTableBody");
    this.searchInput = document.getElementById("activityLogsSearch");
    this.actionSelect = document.getElementById("activityLogsAction");
    this.dateFrom = document.getElementById("activityLogsDateFrom");
    this.dateTo = document.getElementById("activityLogsDateTo");

    this.pagination.setContainer(document.getElementById("activityLogsPagination"));
    this.bindEvents();
    this.loadLogs();
  }

  bindEvents() {
    document.getElementById("activityLogsClearBtn")?.addEventListener("click", () => {
      this.clearFilters();
      this.pagination.reset();
      this.loadLogs();
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

  clearFilters() {
    if (this.searchInput) this.searchInput.value = "";
    if (this.actionSelect) this.actionSelect.value = "";
    if (this.dateFrom) this.dateFrom.value = "";
    if (this.dateTo) this.dateTo.value = "";
    this.readFilters();
  }

  async loadLogs() {
    if (!this.tbody) return;
    const requestId = ++this.requestId;
    this.tbody.innerHTML = `
      <tr>
        <td colspan="4" class="users-empty">Loading activity…</td>
      </tr>`;

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

    return `
      <tr>
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
        <td>${description}</td>
      </tr>`;
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
