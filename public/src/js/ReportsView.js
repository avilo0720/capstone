import Storage from "./API.js";
import Pagination from "./Pagination.js";
import DownloadOptions from "./DownloadOptions.js";
import { computeForecasts } from "./ForecastEngine.js";
import { buildForecastAlerts, monthsLeftLabel, restockWindowLabel } from "./ForecastAlerts.js";
import { notifyAlert } from "./ConfirmDialog.js";
import { bindBackdropClose } from "./OverlayDismiss.js";
import { barChartGutters, contentWidth, fitText } from "./ChartLayout.js";
// Same specifiers as app.js so the Reports tab shares one instance of each page module.
import InventoryView from "./InventoryView.js?v=104";
import ForecastingView from "./ForecastingView.js?v=104";
import ProcurementView from "./ProcurementView.js?v=104";
import CalendarView from "./CalendarView.js?v=102";

class ReportsView {
  constructor() {
    this.summaryData = null;
    this.forecastData = [];
    this.alertItems = [];
    this.restockWindow = 3; // months; Low-Stock Alerts list items that won't last this long
    this.pagination = new Pagination({
      pageSize: 10,
      onPageChange: () => this.renderAlerts(),
    });
  }

  async setApp() {
    this.pagination.setContainer(document.getElementById("reportsPagination"));
    this.bindEvents();
    await Promise.all([this.loadSummary(), this.loadForecastCharts()]);
    window.addEventListener("resize", () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.renderForecastCharts(), 160);
    });
  }

  async refreshLive() {
    if (!document.querySelector(".reports-page")) return;
    await Promise.all([this.loadSummary(), this.loadForecastCharts()]);
  }

  /** Totals come from the items Storage already loaded, saving a server round trip. */
  async loadSummary() {
    const items = Storage.getItems();
    this.summaryData = {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      totalValue: Math.round(
        items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0) * 100
      ) / 100,
    };
    this.renderSummary();
  }

  async loadForecastCharts() {
    try {
      // Items are already loaded (and kept fresh by realtime sync) in Storage.
      const usageRes = await fetch('/api/forecast-data');
      if (!usageRes.ok) return;

      const usageData = await usageRes.json();
      this.forecastData = computeForecasts(Storage.getItems(), usageData);
      this.renderForecastCharts();
      this.updateAlerts();
    } catch (e) {
      console.error('Failed to load forecast charts:', e);
    }
  }

  /** Low-Stock Alerts follow the forecast (shared with the Dashboard and the notification bell). */
  updateAlerts() {
    this.alertItems = buildForecastAlerts(this.forecastData, this.restockWindow);
    this.renderAlerts();

    const label = document.getElementById("reportLowStockLabel");
    if (label) label.textContent = `Restock needed (${restockWindowLabel(this.restockWindow)})`;
    const count = document.getElementById("reportLowStockCount");
    if (count) this.animateCounter(count, this.alertItems.length);
  }

  asOfDate() {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  renderSummary() {
    if (!this.summaryData) return;
    const d = this.summaryData;

    const totalItemsEl = document.getElementById('reportTotalItems');
    const totalQtyEl = document.getElementById('reportTotalQty');
    const totalValueEl = document.getElementById('reportTotalValue');

    if (totalItemsEl) this.animateCounter(totalItemsEl, d.totalItems);
    if (totalQtyEl) this.animateCounter(totalQtyEl, d.totalQuantity);
    if (totalValueEl) this.animateCounter(totalValueEl, d.totalValue, '₱');
    // The "Restock needed" card is set by updateAlerts() from the forecast.
  }

  animateCounter(el, target, prefix = '') {
    const duration = 800;
    const start = performance.now();
    const from = 0;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      el.textContent = `${prefix}${current.toLocaleString()}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  renderAlerts() {
    const body = document.getElementById('reportsAlertsBody');
    if (!body) return;

    const sorted = this.alertItems; // already sorted by urgency, then soonest to run out

    if (sorted.length === 0) {
      body.innerHTML = `
        <div class="reports-alerts__empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#12b76a" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>Based on the forecast, current stock will last ${restockWindowLabel(this.restockWindow)} for every item.</p>
        </div>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    const page = this.pagination.getSlice(sorted);

    let html = `
      <table class="reports-alerts__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Current Qty (as of ${this.asOfDate()})</th>
            <th>Forecast / Month</th>
            <th>Stock Will Last</th>
            <th>Restock Needed (${restockWindowLabel(this.restockWindow)})</th>
            <th>Urgency</th>
          </tr>
        </thead>
        <tbody>`;

    page.items.forEach((item) => {
      const urgencyClass = `reports-urgency--${item.urgency}`;
      const staticTag = item.isStatic
        ? ` <span class="badge badge-static" title="Not enough usage history. Uses the AMC entered in Inventory.">Static</span>`
        : "";
      html += `
          <tr class="reports-alert-row" data-id="${item.id}" title="Click to view details">
            <td class="reports-alerts__item-name">${item.title}${item.size ? ` <span class="reports-alerts__size">(${item.size})</span>` : ""}</td>
            <td>${item.currentStock}</td>
            <td>${item.forecastAmc.toFixed(1)}${staticTag}</td>
            <td>${monthsLeftLabel(item.monthsLeft)}</td>
            <td>+${item.restockNeeded}</td>
            <td><span class="reports-urgency-badge ${urgencyClass}">${item.urgency.toUpperCase()}</span></td>
          </tr>`;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
    this.pagination.renderControls(page);

    body.querySelectorAll(".reports-alert-row").forEach((rowEl) => {
      rowEl.addEventListener("click", () => {
        const item = sorted.find((i) => i.id == rowEl.dataset.id);
        if (item) this.showAlertDetail(item);
      });
    });
  }

  showAlertDetail(item) {
    const overlay = document.createElement("div");
    overlay.className = "viewItemSection";
    overlay.innerHTML = `
      <div class="viewItemModal">
        <div class="viewItemModal__header">
          <h2 class="viewItemModal__title">Alert Details</h2>
          <button type="button" class="viewItemModal__close">&times;</button>
        </div>
        <div class="viewItemModal__body">
          <div class="viewItemModal__section">
            <h3>${item.title}${item.size ? ` (${item.size})` : ""}</h3>
            <p class="viewItemModal__code">Item Code: ${item.itemCode || "—"}</p>
          </div>
          <div class="viewItemModal__grid">
            <div class="viewItemModal__field"><span>Current Qty (as of ${this.asOfDate()})</span><strong>${item.currentStock}</strong></div>
            <div class="viewItemModal__field"><span>Forecast / Month</span><strong>${item.forecastAmc.toFixed(1)}</strong></div>
            <div class="viewItemModal__field"><span>Forecast Basis</span><strong>${item.isStatic ? "Static (AMC from Inventory)" : "Usage history"}</strong></div>
            <div class="viewItemModal__field"><span>Stock Will Last</span><strong>${monthsLeftLabel(item.monthsLeft)}</strong></div>
            <div class="viewItemModal__field"><span>Restock for 3 Months</span><strong>${item.need3m > 0 ? `+${item.need3m}` : "OK"}</strong></div>
            <div class="viewItemModal__field"><span>Restock for 6 Months</span><strong>${item.need6m > 0 ? `+${item.need6m}` : "OK"}</strong></div>
            <div class="viewItemModal__field"><span>Restock for 1 Year</span><strong>${item.need1y > 0 ? `+${item.need1y}` : "OK"}</strong></div>
            <div class="viewItemModal__field"><span>Unit Cost</span><strong>₱${Number(item.unitCost).toLocaleString()}</strong></div>
            <div class="viewItemModal__field"><span>Restock Cost (${restockWindowLabel(this.restockWindow)})</span><strong>₱${Number(item.restockCost).toLocaleString()}</strong></div>
            <div class="viewItemModal__field"><span>Urgency</span><strong>${item.urgency.toUpperCase()}</strong></div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector(".viewItemModal__close").addEventListener("click", close);
    bindBackdropClose(overlay, close);
  }

  renderForecastCharts() {
    const needCanvas = document.getElementById("reportsNeedChart");
    if (!needCanvas || !this.forecastData.length) return;

    const topNeeds = [...this.forecastData]
      .filter((item) => item.need3m > 0)
      .sort((a, b) => b.need3m - a.need3m)
      .slice(0, 5);

    if (topNeeds.length === 0) {
      this.drawEmptyChart(needCanvas, "No restock needs projected");
      return;
    }

    this.drawHorizontalBarChart(
      needCanvas,
      topNeeds.map((item) => ({
        label: item.title,
        value: item.need3m,
        color: "#1570ef",
      })),
      "Units needed"
    );
  }

  drawHorizontalBarChart(canvas, data, xLabel) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(contentWidth(canvas.parentElement), 200);
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.font = "11px Inter, sans-serif";
    const gutters = barChartGutters(ctx, data, w);
    const pad = { top: 16, right: gutters.right, bottom: 30, left: gutters.left };
    const plotW = Math.max(w - pad.left - pad.right, 1);
    const plotH = h - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const barH = plotH / data.length * 0.6;

    data.forEach((d, i) => {
      const y = pad.top + i * (plotH / data.length) + (plotH / data.length - barH) / 2;
      const barW = (d.value / maxVal) * plotW;

      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, barW, barH, [0, 4, 4, 0]);
      ctx.fill();

      ctx.fillStyle = "#344054";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(fitText(ctx, d.label, gutters.labelWidth), pad.left - 8, y + barH / 2 + 4);

      ctx.textAlign = "left";
      ctx.fillText(String(d.value), pad.left + barW + 6, y + barH / 2 + 4);
    });

    ctx.fillStyle = "#8896a4";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xLabel, pad.left + plotW / 2, h - 8);
  }

  drawEmptyChart(canvas, message) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(contentWidth(canvas.parentElement), 200);
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#8896a4";
    ctx.font = "500 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, w / 2, h / 2);
  }

  bindEvents() {
    const downloadBtn = document.getElementById('reportDownloadBtn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        await this.exportReport();
      });
    }

    document.querySelectorAll('[data-report]').forEach((btn) => {
      btn.addEventListener('click', () => this.downloadFromLibrary(btn.dataset.report));
    });

    document.getElementById('reportsAlertWindow')?.addEventListener('change', (e) => {
      this.restockWindow = Number(e.target.value) || 3;
      this.pagination.reset();
      this.updateAlerts();
    });
  }

  /** "All Reports" section: each report reuses the download dialog from its own page. */
  async downloadFromLibrary(report) {
    if (report === 'summary') return this.exportReport();
    if (report === 'inventory') return InventoryView.exportForReports();
    if (report === 'forecast') {
      const mode = document.getElementById('reportsForecastMode')?.value || 'forecast';
      return ForecastingView.exportForReports(mode);
    }
    if (report === 'procurement') return ProcurementView.exportForReports();
    if (report === 'calendar') {
      const value = document.getElementById('reportsCalendarMonth')?.value || '';
      const [year, month] = value.split('-').map(Number);
      if (!year || !month) {
        notifyAlert('Pick a month first.');
        return false;
      }
      const hideEmpty = document.getElementById('reportsCalendarHideEmpty')?.checked ?? true;
      return CalendarView.exportMonthForReports(year, month - 1, hideEmpty);
    }
    return false;
  }

  exportReport() {
    if (!this.summaryData) {
      notifyAlert('Report data not loaded yet.');
      return;
    }

    DownloadOptions.open(
      { format: 'pdf', paper: 'A4', orientation: 'portrait' },
      async (options) => {
        const endpoint = options.format === 'pdf' ? '/api/export/report/pdf' : '/api/export/report/excel';
        const payload = {
          summary: {
            totalItems: this.summaryData.totalItems,
            totalQuantity: this.summaryData.totalQuantity,
            totalValue: this.summaryData.totalValue,
            lowStockCount: this.alertItems.length,
            restockWindowMonths: this.restockWindow,
          },
          lowStockItems: this.alertItems
        };
        if (options.format === 'pdf') {
          payload.paper = options.paper;
          payload.orientation = options.orientation;
          payload.fontSize = options.fontSize;
          payload.rowSize = options.rowSize;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Export failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.download = `inventory-report-${stamp}.${options.format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      },
      {
        fetchPreview: async (options, signal) => {
          const payload = {
            format: options.format,
            summary: {
              totalItems: this.summaryData.totalItems,
              totalQuantity: this.summaryData.totalQuantity,
              totalValue: this.summaryData.totalValue,
              lowStockCount: this.alertItems.length,
              restockWindowMonths: this.restockWindow,
            },
            lowStockItems: this.alertItems,
          };
          if (options.format === "pdf") {
            payload.paper = options.paper;
            payload.orientation = options.orientation;
            payload.fontSize = options.fontSize;
            payload.rowSize = options.rowSize;
          }
          const res = await fetch("/api/export/report/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal,
          });
          if (!res.ok) throw new Error("Preview failed");
          return res.blob();
        },
      }
    );
  }
}

export default new ReportsView();
