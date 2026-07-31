const mainApp = document.querySelector(".main");
import Storage from "./API.js";

class DashboardUi {
  setApp() {
    const qtyElem = document.querySelector('#dashboardItems');
    const totalQtyElem = document.querySelector('#dashboardQty');
    const salesElem = document.querySelector('#dashboardSales');
    const catElem = document.querySelector('#dashboardCategories');
    const subtotalTotalCostElem = document.querySelector('#dashboardSubtotalTotalCost');
    const subtotalRestockCostElem = document.querySelector('#dashboardSubtotalRestockCost');
    const restockPerLeadTimeElem = document.querySelector('#dashboardRestockPerLeadTime');
    const halfRestockCostElem = document.querySelector('#dashboardHalfRestockCost');
    this.metrics = this.buildMetricsSnapshot();

    if (qtyElem) qtyElem.textContent = this.metrics.itemsCount.toLocaleString();
    if (totalQtyElem) totalQtyElem.textContent = this.metrics.totalQuantity.toLocaleString();
    if (salesElem) salesElem.textContent = `₱${this.metrics.totalValue.toLocaleString()}`;
    if (catElem) catElem.textContent = this.totalCategories();
    if (subtotalTotalCostElem) subtotalTotalCostElem.textContent = `₱${this.metrics.subtotalTotalCost.toLocaleString()}`;
    if (subtotalRestockCostElem) subtotalRestockCostElem.textContent = `₱${this.metrics.subtotalRestockCost.toLocaleString()}`;
    if (restockPerLeadTimeElem) restockPerLeadTimeElem.textContent = `₱${this.metrics.restockPerLeadTime.toLocaleString()}`;
    if (halfRestockCostElem) halfRestockCostElem.textContent = `₱${this.metrics.halfRestockCost.toLocaleString()}`;

    this.renderLowStockAlerts();
    this.bindMetricCards();
    this.initActivityLog();
  }

  initActivityLog() {
    const section = document.getElementById("dashboardActivity");
    if (!section) return;

    document.getElementById("activityRefreshBtn")?.addEventListener("click", () => {
      this.loadActivityLogs();
    });

    this.loadActivityLogs();
  }

  async loadActivityLogs() {
    const list = document.getElementById("activityLogList");
    if (!list) return;

    list.innerHTML = `<p class="dashboard-activity__loading">Loading activity…</p>`;

    try {
      const res = await fetch("/api/activity-logs?limit=5");
      if (!res.ok) {
        list.innerHTML = `<p class="dashboard-activity__empty">Unable to load activity log.</p>`;
        return;
      }

      const data = await res.json();
      const logs = Array.isArray(data) ? data : data.logs || [];

      if (!logs.length) {
        list.innerHTML = `
          <div class="dashboard-activity__empty">
            <p>No recent activity yet.</p>
            <small>Actions like adding items, adjusting stock, or managing accounts will show up here.</small>
          </div>`;
        return;
      }

      list.innerHTML = `
        <ul class="dashboard-activity__list">
          ${logs.map((log) => this.renderActivityItem(log, true)).join("")}
        </ul>`;
    } catch {
      list.innerHTML = `<p class="dashboard-activity__empty">Unable to load activity log.</p>`;
    }
  }

  renderActivityItem(log, isToday = true) {
    const name = this.escapeHtml(log.user?.full_name || "Unknown user");
    const role = this.escapeHtml(log.user?.role || "");
    const description = this.escapeHtml(log.description || "");
    const when = this.formatActivityTime(log.created_at, isToday);
    const badge = this.activityBadge(log.action);

    return `
      <li class="dashboard-activity__item">
        <span class="dashboard-activity__dot dashboard-activity__dot--${badge.tone}"></span>
        <div class="dashboard-activity__content">
          <p class="dashboard-activity__text">
            <strong>${name}</strong>
            ${role ? `<span class="dashboard-activity__role">${role}</span>` : ""}
            ${description}
          </p>
          <time class="dashboard-activity__time" datetime="${this.escapeHtml(log.created_at || "")}">${when}</time>
        </div>
        <span class="dashboard-activity__badge dashboard-activity__badge--${badge.tone}">${badge.label}</span>
      </li>`;
  }

  activityBadge(action) {
    const map = {
      created: { label: "Added", tone: "green" },
      updated: { label: "Updated", tone: "blue" },
      deleted: { label: "Deleted", tone: "red" },
      stock_added: { label: "Stock +", tone: "green" },
      stock_used: { label: "Stock −", tone: "orange" },
    };
    return map[action] || { label: "Action", tone: "gray" };
  }

  formatActivityTime(iso, isToday = true) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";

    const clock = date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return `Just now · ${clock}`;
    if (mins < 60) return `${mins}m ago · ${clock}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago · ${clock}`;
    if (!isToday) return clock;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago · ${clock}`;
    return clock;
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  bindMetricCards() {
    const overlay = document.getElementById("metricExplainOverlay");
    const closeBtn = document.getElementById("metricExplainClose");

    document.querySelectorAll(".reports-summary__card[data-metric]").forEach((card) => {
      card.addEventListener("click", () => {
        this.openMetricExplain(card.dataset.metric);
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeMetricExplain());
    }
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) this.closeMetricExplain();
      });
    }
  }

  openMetricExplain(metricKey) {
    const overlay = document.getElementById("metricExplainOverlay");
    const titleEl = document.getElementById("metricExplainTitle");
    const bodyEl = document.getElementById("metricExplainBody");
    if (!overlay || !titleEl || !bodyEl) return;

    const explanation = this.getMetricExplanation(metricKey);
    if (!explanation) return;

    titleEl.textContent = explanation.title;
    bodyEl.innerHTML = explanation.html;
    overlay.classList.remove("--hidden");
  }

  closeMetricExplain() {
    const overlay = document.getElementById("metricExplainOverlay");
    if (overlay) overlay.classList.add("--hidden");
  }

  money(value) {
    return `₱${Number(value || 0).toLocaleString()}`;
  }

  getMetricExplanation(metricKey) {
    const m = this.metrics || this.buildMetricsSnapshot();

    const explanations = {
      items: {
        title: "Number of Items",
        html: `
          <p class="metric-explain__result">Current value: <strong>${m.itemsCount.toLocaleString()}</strong></p>
          <p>This is a simple count of every product currently listed in inventory.</p>
          <div class="metric-explain__formula">Count of all inventory items</div>
          <ul class="metric-explain__points">
            <li>Each unique item record counts as 1</li>
            <li>Does not depend on stock quantity or price</li>
          </ul>
        `,
      },
      quantity: {
        title: "Total Quantity",
        html: `
          <p class="metric-explain__result">Current value: <strong>${m.totalQuantity.toLocaleString()}</strong></p>
          <p>This adds up the on-hand stock of every item.</p>
          <div class="metric-explain__formula">Σ (item quantity)</div>
          <ul class="metric-explain__points">
            <li>Based on current stock levels in inventory</li>
            <li>Across <strong>${m.itemsCount.toLocaleString()}</strong> item${m.itemsCount === 1 ? "" : "s"}</li>
          </ul>
        `,
      },
      value: {
        title: "Total Value in Hand",
        html: `
          <p class="metric-explain__result">Current value: <strong>${this.money(m.totalValue)}</strong></p>
          <p>This is the money value of stock you currently hold.</p>
          <div class="metric-explain__formula">Σ (price × quantity)</div>
          <ul class="metric-explain__points">
            <li>Uses each item’s unit price times its current quantity</li>
            <li>Reflects inventory value already in hand, not restock needs</li>
          </ul>
        `,
      },
      totalCost: {
        title: "Subtotal of Total Cost",
        html: `
          <p class="metric-explain__result">Current value: <strong>${this.money(m.subtotalTotalCost)}</strong></p>
          <p>This estimates the total cost of bringing every item up to its Maximum Stock Level (MSL).</p>
          <div class="metric-explain__formula">Σ (MSL × price)</div>
          <ul class="metric-explain__points">
            <li><strong>LTD</strong> = AMC × 3.495 (lead-time demand)</li>
            <li><strong>Safety Stock</strong> = (AMC + LTD) × 10%</li>
            <li><strong>MSL</strong> = AMC + LTD + Safety Stock (or 3 for Non-moving items with stock &lt; 3)</li>
            <li>Then multiply MSL by unit price for each item and sum them all</li>
          </ul>
        `,
      },
      restockCost: {
        title: "Subtotal Cost (RS Needed)",
        html: `
          <p class="metric-explain__result">Current value: <strong>${this.money(m.subtotalRestockCost)}</strong></p>
          <p>Same MSL cost formula as Total Cost, but only for items marked <strong>RS Needed</strong>.</p>
          <div class="metric-explain__formula">Σ (MSL × price) for RS Needed items only</div>
          <ul class="metric-explain__points">
            <li><strong>${m.restockItemCount.toLocaleString()}</strong> item${m.restockItemCount === 1 ? "" : "s"} currently need restocking</li>
            <li>RS Needed when stock is below reorder point (F/S items), or Non-moving stock is under 3</li>
            <li>Items marked Sufficient are excluded from this total</li>
          </ul>
        `,
      },
      restockPerLead: {
        title: "RS Needed Cost / Lead Time",
        html: `
          <p class="metric-explain__result">Current value: <strong>${this.money(m.restockPerLeadTime)}</strong></p>
          <p>Spreads the RS Needed cost across the procurement lead time so you can see the monthly-equivalent funding need.</p>
          <div class="metric-explain__formula">RS Needed Cost ÷ 3.5 months</div>
          <ul class="metric-explain__points">
            <li>RS Needed Cost = <strong>${this.money(m.subtotalRestockCost)}</strong></li>
            <li>Procurement lead time used = <strong>3.5 months</strong></li>
            <li>${this.money(m.subtotalRestockCost)} ÷ 3.5 = <strong>${this.money(m.restockPerLeadTime)}</strong></li>
          </ul>
        `,
      },
      halfRestock: {
        title: "Half of RS Needed Cost",
        html: `
          <p class="metric-explain__result">Current value: <strong>${this.money(m.halfRestockCost)}</strong></p>
          <p>A quick planning figure equal to half of the full restock cost for items that need replenishment.</p>
          <div class="metric-explain__formula">RS Needed Cost ÷ 2</div>
          <ul class="metric-explain__points">
            <li>RS Needed Cost = <strong>${this.money(m.subtotalRestockCost)}</strong></li>
            <li>${this.money(m.subtotalRestockCost)} ÷ 2 = <strong>${this.money(m.halfRestockCost)}</strong></li>
          </ul>
        `,
      },
    };

    return explanations[metricKey] || null;
  }

  renderLowStockAlerts() {
    const container = document.getElementById('dashboardAlerts');
    if (!container) return;

    const allItems = Storage.getItems();
    const totalDemand = allItems.reduce((acc, item) => acc + (Number(item.monthlyDemand) || 0), 0);

    let cumulativeDemand = 0;
    const lowStockItems = [];

    allItems.forEach((item) => {
      const amc = Number(item.monthlyDemand) || 0;
      const stock = Number(item.quantity) || 0;

      cumulativeDemand += amc;
      const cumulativePercent = totalDemand === 0 ? 0 : cumulativeDemand / totalDemand;
      const fsn = this.getAutoFSN(cumulativePercent);

      const leadTimeDemand = amc * 3.495065789473684;
      const ltd = this.roundHalfDown(leadTimeDemand);
      const safetyStock = (amc + leadTimeDemand) * 0.1;
      const ss = this.roundHalfDown(safetyStock);
      const rop = ltd + ss;

      const triggerPoint =
        ((rop > stock && (fsn === 'F' || fsn === 'S')) || (fsn === 'N' && stock < 3))
          ? 'RS Needed' : 'Sufficient';

      if (triggerPoint === 'RS Needed') {
        lowStockItems.push({
          title: item.title,
          currentStock: stock,
          reorderPoint: rop,
          fsn
        });
      }
    });

    if (lowStockItems.length === 0) {
      container.innerHTML = `
        <div class="dashboard-alerts__banner dashboard-alerts__banner--ok">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>All stock levels are sufficient.</span>
        </div>`;
      return;
    }

    const topItems = lowStockItems.slice(0, 5);
    const remaining = lowStockItems.length - topItems.length;

    let itemsList = topItems.map(item =>
      `<li><strong>${item.title}</strong> — Stock: ${item.currentStock}, ROP: ${item.reorderPoint} <span class="dashboard-alerts__fsn">${item.fsn}</span></li>`
    ).join('');

    if (remaining > 0) {
      itemsList += `<li class="dashboard-alerts__more">...and ${remaining} more item${remaining > 1 ? 's' : ''}</li>`;
    }

    container.innerHTML = `
      <div class="dashboard-alerts__banner dashboard-alerts__banner--warning">
        <div class="dashboard-alerts__banner-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span><strong>${lowStockItems.length}</strong> item${lowStockItems.length > 1 ? 's' : ''} need${lowStockItems.length === 1 ? 's' : ''} restocking</span>
          ${document.querySelector('.sideBar__reports') ? '<a href="/reports" class="dashboard-alerts__view-link">View Full Report →</a>' : ''}
        </div>
        <ul class="dashboard-alerts__list">${itemsList}</ul>
      </div>`;
  }

  totalCategories() {
    const allCategories = Storage.getCategories();
    return allCategories.length.toLocaleString();
  }

  roundHalfDown(value) {
    const sign = value < 0 ? -1 : 1;
    const absVal = Math.abs(value);
    const floor = Math.floor(absVal);
    const fraction = absVal - floor;
    if (fraction > 0.5) return sign * (floor + 1);
    return sign * floor;
  }

  getAutoFSN(cumulativePercent) {
    if (cumulativePercent <= 0.2) return "N";
    if (cumulativePercent < 0.7) return "S";
    return "F";
  }

  buildMetricsSnapshot() {
    const allItems = Storage.getItems();
    const totalDemand = allItems.reduce(
      (acc, item) => acc + (Number(item.monthlyDemand) || 0),
      0
    );
    const procurementLeadTimeMonths = 3.5;

    let cumulativeDemand = 0;
    let subtotalTotalCost = 0;
    let subtotalRestockCost = 0;
    let restockItemCount = 0;
    let totalQuantity = 0;
    let totalValue = 0;

    allItems.forEach((item) => {
      const amc = Number(item.monthlyDemand) || 0;
      const stock = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;

      totalQuantity += stock;
      totalValue += price * stock;

      cumulativeDemand += amc;
      const cumulativePercent = totalDemand === 0 ? 0 : cumulativeDemand / totalDemand;
      const fsn = this.getAutoFSN(cumulativePercent);

      const leadTimeDemand = amc * 3.495065789473684;
      const ltd = this.roundHalfDown(leadTimeDemand);
      const safetyStock = (amc + leadTimeDemand) * 0.1;
      const ss = this.roundHalfDown(safetyStock);
      const rop = ltd + ss;
      const msl =
        fsn === "N" && stock < 3 ? 3 : amc + leadTimeDemand + safetyStock;
      const totalCost = msl * price;
      const triggerPoint =
        ((rop > stock && (fsn === "F" || fsn === "S")) ||
          (fsn === "N" && stock < 3))
          ? "RS Needed"
          : "Sufficient";

      subtotalTotalCost += totalCost;
      if (triggerPoint === "RS Needed") {
        subtotalRestockCost += totalCost;
        restockItemCount += 1;
      }
    });

    const restockPerLeadTime = subtotalRestockCost / procurementLeadTimeMonths;
    const halfRestockCost = subtotalRestockCost / 2;

    return {
      itemsCount: allItems.length,
      totalQuantity,
      totalValue: Number(totalValue.toFixed(2)),
      subtotalTotalCost: Number(subtotalTotalCost.toFixed(2)),
      subtotalRestockCost: Number(subtotalRestockCost.toFixed(2)),
      restockPerLeadTime: Number(restockPerLeadTime.toFixed(2)),
      halfRestockCost: Number(halfRestockCost.toFixed(2)),
      restockItemCount,
    };
  }
}

export default new DashboardUi();
