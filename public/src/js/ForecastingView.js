import Storage from "./API.js";
import Pagination from "./Pagination.js";
import { computeForecasts } from "./ForecastEngine.js";

class ForecastingUi {
  constructor() {
    this.columnWidths = {};
    this.columnWidthStorageKey = "forecastColumnWidths";
    this.forecastData = [];
    this.usageData = {};
    this.selectedItemId = null;
    this.amcMode = "forecast";
    this.pagination = new Pagination({
      pageSize: 10,
      onPageChange: () => this.renderTable(),
    });
  }

  setApp() {
    this.forecastSectionHTML = document.querySelector(".forecast-section-table");
    this.pagination.setContainer(document.getElementById("forecastPagination"));
    this.loadColumnWidths();

    const generateBtn = document.getElementById("generateForecastBtn");
    const placeholder = document.getElementById("forecastPlaceholder");
    const tableWrapper = document.getElementById("forecastTableWrapper");
    const actionsBar = document.getElementById("forecastActions");
    const chartClose = document.getElementById("forecastChartClose");

    const amcRadios = document.querySelectorAll('input[name="amcMode"]');
    amcRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.amcMode = e.target.value;
        if (this.forecastSectionHTML && this.forecastData.length > 0) {
          this.renderTable();
        }
      });
    });

    if (chartClose) {
      chartClose.addEventListener("click", () => {
        const panel = document.getElementById("forecastChartPanel");
        if (panel) panel.classList.add("--hidden");
        this.selectedItemId = null;
        // Remove active row highlight
        document.querySelectorAll(".forecast-section-table tr.--active").forEach(r => r.classList.remove("--active"));
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener("click", async () => {
        generateBtn.disabled = true;
        generateBtn.textContent = "Generating…";

        try {
          // Fetch transaction usage data
          const usageRes = await fetch("/api/forecast-data");
          this.usageData = await usageRes.json();

          // Get inventory items
          const items = Storage.getItems();
          this.forecastData = computeForecasts(items, this.usageData);

          // Hide placeholder, show table and actions
          if (placeholder) placeholder.classList.add("--hidden");
          if (tableWrapper) tableWrapper.classList.remove("--hidden");
          if (actionsBar) actionsBar.classList.remove("--hidden");

          const algoPanel = document.getElementById("forecastAlgoPanel");
          if (algoPanel) algoPanel.classList.remove("--hidden");

          this.pagination.reset();
          if (this.forecastSectionHTML) {
            this.renderTable();
          }
        } catch (err) {
          console.error("Failed to generate forecast:", err);
          alert("Failed to generate forecast. Please try again.");
        } finally {
          generateBtn.disabled = false;
          generateBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Generate Forecast`;
        }
      });
    }

    this.bindDownloadEvents();
  }

  // ============== DOM RENDERING ==============

  renderTable() {
    this.updateDom(this.forecastData);
  }

  updateDom(allItems) {
    const page = this.pagination.getSlice(allItems);

    let amcLabel = "AMC (Forecast)";
    if (this.amcMode === "inventory") amcLabel = "AMC (Inventory)";
    if (this.amcMode === "combined") amcLabel = "AMC (Combined)";

    let result = `
      <tr class="table__title">
        <td>Item</td>
        <td>Current Qty</td>
        <td>${amcLabel}</td>
        <td>3 Months Need</td>
        <td>6 Months Need</td>
        <td>1 Year Need</td>
        <td>Method</td>
      </tr>
    `;

    page.items.forEach(item => {
      result += this.createRowHTML(item);
    });

    this.forecastSectionHTML.innerHTML = result;
    this.pagination.renderControls({
      totalItems: page.totalItems,
      totalPages: page.totalPages,
      startIndex: page.startIndex,
      endIndex: page.endIndex,
    });
    this.enableColumnResize();
    this.bindRowClicks();
  }

  createRowHTML(item) {
    let demand = 0;
    const forecastAmc = item.forecast || 0;
    const inventoryAmc = Number(item.monthlyDemand) || 0;

    if (this.amcMode === "forecast") {
      demand = forecastAmc;
    } else if (this.amcMode === "inventory") {
      demand = inventoryAmc;
    } else if (this.amcMode === "combined") {
      demand = (forecastAmc + inventoryAmc) / 2;
    }

    const qty = item.quantity || 0;
    const itemNo = this.formatItemNo(item.itemCode);

    const need3m = Math.max(0, Math.ceil(demand * 3 - qty));
    const need6m = Math.max(0, Math.ceil(demand * 6 - qty));
    const need1y = Math.max(0, Math.ceil(demand * 12 - qty));

    const methodClass = item.method === "Croston" ? "badge-croston" : item.method === "WMA" ? "badge-wma" : "badge-static";

    return `
      <tr data-item-id="${item.id}" class="forecast-row">
        <td style="font-weight: 500;">
          ${itemNo ? `<span style="opacity:0.6;font-size:0.85em;">No. ${itemNo}</span><br/>` : ''}
          ${item.title} ${item.size ? `<span style="font-size:0.85em;">(${item.size})</span>` : ''}
        </td>
        <td><span class="badge badge-neutral">${qty}</span></td>
        <td>${demand.toFixed ? demand.toFixed(1) : demand}</td>
        <td>${need3m > 0 ? `<span class="badge badge-warning">+${need3m}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td>${need6m > 0 ? `<span class="badge badge-danger">+${need6m}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td>${need1y > 0 ? `<span class="badge badge-danger">+${need1y}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td><span class="badge ${methodClass}">${item.method}</span></td>
      </tr>
    `;
  }

  bindRowClicks() {
    const rows = this.forecastSectionHTML.querySelectorAll("tr.forecast-row");
    rows.forEach(row => {
      row.addEventListener("click", () => {
        const itemId = Number(row.dataset.itemId);
        const item = this.forecastData.find(i => i.id === itemId);
        if (!item) return;

        // Highlight active row
        rows.forEach(r => r.classList.remove("--active"));
        row.classList.add("--active");

        this.selectedItemId = itemId;
        this.showChart(item);
      });
    });
  }

  // ============== CHART RENDERING ==============

  showChart(item) {
    const panel = document.getElementById("forecastChartPanel");
    const title = document.getElementById("forecastChartTitle");
    if (!panel) return;

    panel.classList.remove("--hidden");
    title.textContent = `${item.title}${item.size ? ' (' + item.size + ')' : ''} — Demand Timeline`;

    // Update stat cards
    document.getElementById("statForecast").textContent =
      item.forecast ? `${item.forecast.toFixed(1)} / month` : "—";
    document.getElementById("statDemandSize").textContent =
      item.demandSize ? `${item.demandSize} units` : "—";
    document.getElementById("statInterval").textContent =
      item.demandInterval ? `Every ${item.demandInterval} days` : "—";

    const methodEl = document.getElementById("statMethod");
    methodEl.textContent = item.method;
    methodEl.className = "forecast-stat-card__value forecast-stat-card__method--" + item.method.toLowerCase();

    // Draw the canvas chart
    const dailyUsage = this.usageData[item.id] || [];
    this.drawChart(dailyUsage, item);
  }

  drawChart(dailyUsage, item) {
    const canvas = document.getElementById("forecastChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    // Size to container
    const wrapper = canvas.parentElement;
    const w = wrapper.clientWidth;
    const h = 260;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 30, right: 20, bottom: 45, left: 50 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    if (!dailyUsage || dailyUsage.length === 0) {
      ctx.fillStyle = "#8896a4";
      ctx.font = "500 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No usage data available for this item", w / 2, h / 2);
      return;
    }

    // Build full date range from first to last usage
    const dates = dailyUsage.map(d => new Date(d.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));

    // Build lookup of date -> qty
    const dayMap = {};
    dailyUsage.forEach(d => {
      const key = new Date(d.date).toISOString().slice(0, 10);
      dayMap[key] = (dayMap[key] || 0) + d.qty;
    });

    const maxQty = Math.max(...Object.values(dayMap), 1);

    // Draw grid lines
    ctx.strokeStyle = "#e8ecf1";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + plotH - (plotH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = "#8896a4";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(Math.round((maxQty / gridLines) * i), pad.left - 8, y + 4);
    }

    // Draw bars for each day in range
    const barColor = "#3b82f6";
    const barWidth = Math.max(2, Math.min(12, plotW / (totalDays + 1) - 1));

    for (let dayOffset = 0; dayOffset <= totalDays; dayOffset++) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + dayOffset);
      const key = d.toISOString().slice(0, 10);
      const qty = dayMap[key] || 0;
      if (qty === 0) continue;

      const x = pad.left + (dayOffset / totalDays) * plotW;
      const barH = (qty / maxQty) * plotH;
      const y = pad.top + plotH - barH;

      ctx.fillStyle = barColor;
      ctx.beginPath();
      const radius = Math.min(3, barWidth / 2);
      ctx.roundRect(x - barWidth / 2, y, barWidth, barH, [radius, radius, 0, 0]);
      ctx.fill();
    }

    // Draw forecast line (daily rate × totalDays → horizontal line)
    if (item.dailyRate && item.dailyRate > 0) {
      const forecastDaily = item.dailyRate;
      // Scale to monthly for display, but draw at daily rate level
      const lineY = pad.top + plotH - (forecastDaily / maxQty) * plotH;

      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, lineY);
      ctx.lineTo(pad.left + plotW, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = "#f97316";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Forecast: ${forecastDaily.toFixed(2)}/day`, pad.left + plotW - 140, lineY - 8);
    } else if (item.method === "WMA" && item.forecast > 0) {
      // For WMA items, show monthly forecast as daily equivalent
      const dailyEquiv = item.forecast / 30;
      const lineY = pad.top + plotH - (dailyEquiv / maxQty) * plotH;

      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, lineY);
      ctx.lineTo(pad.left + plotW, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#8b5cf6";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Forecast: ${dailyEquiv.toFixed(2)}/day`, pad.left + plotW - 140, lineY - 8);
    }

    // X-axis labels (date markers)
    ctx.fillStyle = "#8896a4";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const tickInterval = Math.max(1, Math.ceil(totalDays / 7));

    for (let dayOffset = 0; dayOffset <= totalDays; dayOffset += tickInterval) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + dayOffset);
      
      const x = pad.left + (dayOffset / totalDays) * plotW;
      const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
      
      ctx.fillText(label, x, h - pad.bottom + 20);

      // Tick mark
      ctx.strokeStyle = "#ccd3dc";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top + plotH);
      ctx.lineTo(x, pad.top + plotH + 6);
      ctx.stroke();
    }

    // Y-axis title
    ctx.save();
    ctx.fillStyle = "#8896a4";
    ctx.font = "11px Inter, sans-serif";
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Quantity", 0, 0);
    ctx.restore();
  }

  // ============== EXPORT ==============

  bindDownloadEvents() {
    const downloadBtn = document.getElementById("forecastDownloadBtn");
    const downloadMenu = document.getElementById("forecastDownloadMenu");

    if (downloadBtn && downloadMenu) {
      downloadBtn.addEventListener("click", () => {
        downloadMenu.classList.toggle("--hidden");
      });

      downloadMenu.addEventListener("click", async (e) => {
        const option = e.target.closest(".forecastDownloadOption");
        if (!option) return;
        const format = option.dataset.format;
        await this.exportForecast(format);
        downloadMenu.classList.add("--hidden");
      });

      document.addEventListener("click", (e) => {
        if (!downloadBtn.contains(e.target) && !downloadMenu.contains(e.target)) {
          downloadMenu.classList.add("--hidden");
        }
      });
    }
  }

  async exportForecast(format) {
    if (!this.forecastData || this.forecastData.length === 0) {
      alert("No forecast data to export. Generate a forecast first.");
      return;
    }

    let amcLabel = "AMC (Forecast)";
    if (this.amcMode === "inventory") amcLabel = "AMC (Inventory)";
    if (this.amcMode === "combined") amcLabel = "AMC (Combined)";

    const headers = ["Item Code", "Item Name", "Size", "Current Qty", amcLabel, "3 Months Need", "6 Months Need", "1 Year Need", "Method"];
    const rows = this.forecastData.map((item) => {
      let demand = 0;
      const forecastAmc = item.forecast || 0;
      const inventoryAmc = Number(item.monthlyDemand) || 0;

      if (this.amcMode === "forecast") {
        demand = forecastAmc;
      } else if (this.amcMode === "inventory") {
        demand = inventoryAmc;
      } else if (this.amcMode === "combined") {
        demand = (forecastAmc + inventoryAmc) / 2;
      }

      const qty = item.quantity || 0;
      const need3m = Math.max(0, Math.ceil(demand * 3 - qty));
      const need6m = Math.max(0, Math.ceil(demand * 6 - qty));
      const need1y = Math.max(0, Math.ceil(demand * 12 - qty));

      return [
        item.itemCode || "",
        item.title || "",
        item.size || "",
        qty,
        demand.toFixed ? demand.toFixed(1) : demand,
        need3m > 0 ? `+${need3m}` : "OK",
        need6m > 0 ? `+${need6m}` : "OK",
        need1y > 0 ? `+${need1y}` : "OK",
        item.method || "Static",
      ];
    });

    const endpoint = format === "pdf" ? "/api/export/forecast/pdf" : "/api/export/forecast/excel";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, rows }),
      });
      if (!res.ok) {
        alert("Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `forecast-${stamp}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed. Please try again.");
    }
  }

  // ============== COLUMN RESIZE (preserved) ==============

  formatItemNo(itemCode) {
    if (!itemCode) return "";
    const normalized = String(itemCode).trim();
    const numericOnly = normalized.replace(/^item[-_\s]*/i, "");
    return numericOnly || normalized;
  }

  applyColumnWidth(colIndex, width) {
    const table = this.forecastSectionHTML;
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      const cell = row.children[colIndex];
      if (!cell) return;
      cell.style.width = `${width}px`;
      cell.style.minWidth = `${width}px`;
      cell.style.maxWidth = `${width}px`;
    });
  }

  enableColumnResize() {
    const table = this.forecastSectionHTML;
    if (!table) return;

    const headerCells = table.querySelectorAll("tr.table__title td");
    if (!headerCells.length) return;

    headerCells.forEach((cell, colIndex) => {
      cell.querySelectorAll(".col-resize-handle").forEach((h) => h.remove());
      cell.style.position = "relative";

      if (this.columnWidths[colIndex]) {
        this.applyColumnWidth(colIndex, this.columnWidths[colIndex]);
      }

      const handle = document.createElement("span");
      handle.className = "col-resize-handle";
      cell.appendChild(handle);

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = cell.getBoundingClientRect().width;
        document.body.style.userSelect = "none";

        const onMove = (moveEvent) => {
          const newWidth = Math.max(70, startWidth + (moveEvent.clientX - startX));
          this.columnWidths[colIndex] = newWidth;
          this.applyColumnWidth(colIndex, newWidth);
        };

        const onUp = () => {
          this.saveColumnWidths();
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }

  loadColumnWidths() {
    try {
      const raw = localStorage.getItem(this.columnWidthStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        this.columnWidths = parsed;
      }
    } catch (e) {
      console.error("Failed to load forecast column widths:", e);
    }
  }

  saveColumnWidths() {
    try {
      localStorage.setItem(this.columnWidthStorageKey, JSON.stringify(this.columnWidths));
    } catch (e) {
      console.error("Failed to save forecast column widths:", e);
    }
  }
}

export default new ForecastingUi();
