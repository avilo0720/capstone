import Pagination from "./Pagination.js";
import { computeForecasts } from "./ForecastEngine.js";

class ReportsView {
  constructor() {
    this.summaryData = null;
    this.forecastData = [];
    this.alertItems = [];
    this.pagination = new Pagination({
      pageSize: 10,
      onPageChange: () => this.renderAlerts(),
    });
  }

  async setApp() {
    this.pagination.setContainer(document.getElementById("reportsPagination"));
    await this.loadSummary();
    await this.loadForecastCharts();
    this.bindEvents();
  }

  async loadSummary() {
    try {
      const res = await fetch('/api/reports/summary');
      if (!res.ok) throw new Error('Failed to load summary');
      this.summaryData = await res.json();
      this.renderSummary();
      this.alertItems = this.summaryData.lowStockItems || [];
      this.renderAlerts();
    } catch (e) {
      console.error('Failed to load report summary:', e);
    }
  }

  async loadForecastCharts() {
    try {
      const [usageRes, itemsRes] = await Promise.all([
        fetch('/api/forecast-data'),
        fetch('/api/items'),
      ]);
      if (!usageRes.ok || !itemsRes.ok) return;

      const usageData = await usageRes.json();
      const items = await itemsRes.json();
      this.forecastData = computeForecasts(items, usageData);
      this.renderForecastCharts();
    } catch (e) {
      console.error('Failed to load forecast charts:', e);
    }
  }

  renderSummary() {
    if (!this.summaryData) return;
    const d = this.summaryData;

    const totalItemsEl = document.getElementById('reportTotalItems');
    const totalQtyEl = document.getElementById('reportTotalQty');
    const totalValueEl = document.getElementById('reportTotalValue');
    const lowStockCountEl = document.getElementById('reportLowStockCount');

    if (totalItemsEl) this.animateCounter(totalItemsEl, d.totalItems);
    if (totalQtyEl) this.animateCounter(totalQtyEl, d.totalQuantity);
    if (totalValueEl) this.animateCounter(totalValueEl, d.totalValue, '₱');
    if (lowStockCountEl) this.animateCounter(lowStockCountEl, d.lowStockCount);
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

    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    const sorted = [...this.alertItems].sort(
      (a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3)
    );

    if (sorted.length === 0) {
      body.innerHTML = `
        <div class="reports-alerts__empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#12b76a" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>All stock levels are sufficient. No alerts at this time.</p>
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
            <th>Current Stock</th>
            <th>Deficit</th>
            <th>Urgency</th>
            <th></th>
          </tr>
        </thead>
        <tbody>`;

    page.items.forEach((item) => {
      const urgencyClass = `reports-urgency--${item.urgency}`;
      html += `
          <tr>
            <td class="reports-alerts__item-name">${item.title}</td>
            <td>${item.currentStock}</td>
            <td>${item.deficit}</td>
            <td><span class="reports-urgency-badge ${urgencyClass}">${item.urgency.toUpperCase()}</span></td>
            <td><button type="button" class="reports-view-btn" data-id="${item.id}">View</button></td>
          </tr>`;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
    this.pagination.renderControls(page);

    body.querySelectorAll(".reports-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = sorted.find((i) => i.id == btn.dataset.id);
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
            <div class="viewItemModal__field"><span>Current Stock</span><strong>${item.currentStock}</strong></div>
            <div class="viewItemModal__field"><span>Reorder Point</span><strong>${item.reorderPoint}</strong></div>
            <div class="viewItemModal__field"><span>Minimum Stock Level</span><strong>${item.minimumStockLevel}</strong></div>
            <div class="viewItemModal__field"><span>Deficit</span><strong>${item.deficit}</strong></div>
            <div class="viewItemModal__field"><span>Unit Cost</span><strong>₱${Number(item.unitCost).toLocaleString()}</strong></div>
            <div class="viewItemModal__field"><span>Restock Cost</span><strong>₱${Number(item.restockCost).toLocaleString()}</strong></div>
            <div class="viewItemModal__field"><span>FSN</span><strong>${item.fsn}</strong></div>
            <div class="viewItemModal__field"><span>Urgency</span><strong>${item.urgency.toUpperCase()}</strong></div>
            <div class="viewItemModal__field"><span>Trigger Point</span><strong>${item.triggerPoint}</strong></div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector(".viewItemModal__close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }

  renderForecastCharts() {
    const methodCanvas = document.getElementById("reportsMethodChart");
    const needCanvas = document.getElementById("reportsNeedChart");
    if (!methodCanvas || !needCanvas || !this.forecastData.length) return;

    const methodCounts = { WMA: 0, Croston: 0, Static: 0 };
    this.forecastData.forEach((item) => {
      methodCounts[item.method] = (methodCounts[item.method] || 0) + 1;
    });

    this.drawBarChart(methodCanvas, [
      { label: "WMA", value: methodCounts.WMA, color: "#8b5cf6" },
      { label: "Croston", value: methodCounts.Croston, color: "#f97316" },
      { label: "Static", value: methodCounts.Static, color: "#94a3b8" },
    ], "Items");

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
        label: item.title.length > 18 ? item.title.slice(0, 18) + "…" : item.title,
        value: item.need3m,
        color: "#1570ef",
      })),
      "Units needed"
    );
  }

  drawBarChart(canvas, data, yLabel) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 20, right: 20, bottom: 40, left: 40 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const barW = plotW / data.length * 0.55;

    data.forEach((d, i) => {
      const x = pad.left + (i + 0.5) * (plotW / data.length) - barW / 2;
      const barH = (d.value / maxVal) * plotH;
      const y = pad.top + plotH - barH;

      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = "#344054";
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(d.value), x + barW / 2, y - 6);

      ctx.fillStyle = "#667085";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(d.label, x + barW / 2, h - pad.bottom + 16);
    });

    ctx.fillStyle = "#8896a4";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(yLabel, pad.left / 2, pad.top + plotH / 2);
  }

  drawHorizontalBarChart(canvas, data, xLabel) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 16, right: 30, bottom: 30, left: 100 };
    const plotW = w - pad.left - pad.right;
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
      ctx.fillText(d.label, pad.left - 8, y + barH / 2 + 4);

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
    const w = canvas.parentElement.clientWidth;
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
    const downloadMenu = document.getElementById('reportDownloadMenu');

    if (downloadBtn && downloadMenu) {
      downloadBtn.addEventListener('click', () => {
        downloadMenu.classList.toggle('--hidden');
      });
      downloadMenu.addEventListener('click', async (e) => {
        const option = e.target.closest('.reportDownloadOption');
        if (!option) return;
        const format = option.dataset.format;
        await this.exportReport(format);
        downloadMenu.classList.add('--hidden');
      });
    }

    document.addEventListener('click', (e) => {
      if (downloadMenu && downloadBtn && !downloadBtn.contains(e.target) && !downloadMenu.contains(e.target)) {
        downloadMenu.classList.add('--hidden');
      }
    });
  }

  async exportReport(format) {
    if (!this.summaryData) {
      alert('Report data not loaded yet.');
      return;
    }

    const endpoint = format === 'pdf' ? '/api/export/report/pdf' : '/api/export/report/excel';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: {
            totalItems: this.summaryData.totalItems,
            totalQuantity: this.summaryData.totalQuantity,
            totalValue: this.summaryData.totalValue,
            lowStockCount: this.summaryData.lowStockCount
          },
          lowStockItems: this.summaryData.lowStockItems
        })
      });
      if (!res.ok) {
        alert('Export failed. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `inventory-report-${stamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Please try again.');
    }
  }
}

export default new ReportsView();
