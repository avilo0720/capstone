import Storage from "./API.js";
import Pagination from "./Pagination.js";
import DownloadOptions from "./DownloadOptions.js";
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
        this.hideChart();
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
    this.parkChartPanel();

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

    // Re-open chart under the selected row if it is still on this page
    if (this.selectedItemId != null) {
      const activeRow = this.forecastSectionHTML.querySelector(
        `tr.forecast-row[data-item-id="${this.selectedItemId}"]`
      );
      const item = this.forecastData.find((i) => i.id === this.selectedItemId);
      if (activeRow && item) {
        activeRow.classList.add("--active");
        this.showChart(item, activeRow);
      } else {
        this.hideChart();
      }
    }
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

        // Toggle closed if tapping the same row again
        if (this.selectedItemId === itemId) {
          this.hideChart();
          return;
        }

        rows.forEach(r => r.classList.remove("--active"));
        row.classList.add("--active");

        this.selectedItemId = itemId;
        this.showChart(item, row);
      });
    });
  }

  // ============== CHART RENDERING ==============

  parkChartPanel() {
    const panel = document.getElementById("forecastChartPanel");
    const host = document.getElementById("forecastChartHost");
    if (panel && host && panel.parentElement !== host) {
      host.appendChild(panel);
    }
    document.querySelectorAll(".forecast-chart-expand-row").forEach((row) => row.remove());
  }

  hideChart() {
    const panel = document.getElementById("forecastChartPanel");
    if (panel) panel.classList.add("--hidden");
    this.parkChartPanel();
    this.selectedItemId = null;
    document
      .querySelectorAll(".forecast-section-table tr.--active")
      .forEach((r) => r.classList.remove("--active"));
  }

  showChart(item, row) {
    const panel = document.getElementById("forecastChartPanel");
    const title = document.getElementById("forecastChartTitle");
    if (!panel || !row) return;

    // Place chart directly under the tapped row
    this.parkChartPanel();

    const expandRow = document.createElement("tr");
    expandRow.className = "forecast-chart-expand-row";
    const cell = document.createElement("td");
    cell.colSpan = row.cells.length || 7;
    cell.className = "forecast-chart-expand-cell";
    cell.appendChild(panel);
    expandRow.appendChild(cell);
    row.after(expandRow);

    panel.classList.remove("--hidden");
    title.textContent = `${item.title}${item.size ? ' (' + item.size + ')' : ''} — Demand Timeline`;

    document.getElementById("statForecast").textContent =
      item.forecast ? `${item.forecast.toFixed(1)} / month` : "—";
    document.getElementById("statDemandSize").textContent =
      item.demandSize ? `${item.demandSize} units` : "—";
    document.getElementById("statInterval").textContent =
      item.demandInterval ? `Every ${item.demandInterval} days` : "—";

    const methodEl = document.getElementById("statMethod");
    methodEl.textContent = item.method;
    methodEl.className = "forecast-stat-card__value forecast-stat-card__method--" + item.method.toLowerCase();

    const dailyUsage = this.usageData[item.id] || [];

    // Draw after layout so canvas width matches the expanded cell
    requestAnimationFrame(() => {
      this.drawChart(dailyUsage, item);
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  drawChart(dailyUsage, item) {
    const canvas = document.getElementById("forecastChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';

    const wrapper = canvas.parentElement;
    const w = Math.max(wrapper.clientWidth, 320);
    const h = 340;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 28, right: 24, bottom: 52, left: 56 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Soft panel background
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    if (!dailyUsage || dailyUsage.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = `500 15px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText("No usage data available for this item", w / 2, h / 2);
      return;
    }

    const dates = dailyUsage.map((d) => new Date(d.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalDays = Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)));

    const dayMap = {};
    dailyUsage.forEach((d) => {
      const key = new Date(d.date).toISOString().slice(0, 10);
      dayMap[key] = (dayMap[key] || 0) + d.qty;
    });

    let forecastDaily = 0;
    let forecastColor = "#f97316";
    if (item.dailyRate && item.dailyRate > 0) {
      forecastDaily = item.dailyRate;
      forecastColor = "#f97316";
    } else if (item.method === "WMA" && item.forecast > 0) {
      forecastDaily = item.forecast / 30;
      forecastColor = "#8b5cf6";
    }

    const rawMax = Math.max(...Object.values(dayMap), forecastDaily, 1);
    const maxQty = rawMax * 1.15;

    // Plot area card
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pad.left - 8, pad.top - 8, plotW + 16, plotH + 16, 10);
    ctx.fill();
    ctx.stroke();

    // Horizontal grid + Y labels
    const gridLines = 5;
    ctx.font = `500 11px ${fontFamily}`;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + plotH - (plotH / gridLines) * i;
      ctx.strokeStyle = i === 0 ? "#cbd5e1" : "#f1f5f9";
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const labelVal = (maxQty / gridLines) * i;
      ctx.fillText(labelVal >= 10 ? Math.round(labelVal) : labelVal.toFixed(1), pad.left - 12, y);
    }

    // Build series points for line/area
    const points = [];
    for (let dayOffset = 0; dayOffset <= totalDays; dayOffset++) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + dayOffset);
      const key = d.toISOString().slice(0, 10);
      const qty = dayMap[key] || 0;
      const x = pad.left + (dayOffset / totalDays) * plotW;
      const y = pad.top + plotH - (qty / maxQty) * plotH;
      points.push({ x, y, qty, dayOffset });
    }

    // Area under line
    const areaGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    areaGrad.addColorStop(0, "rgba(37, 99, 235, 0.22)");
    areaGrad.addColorStop(1, "rgba(37, 99, 235, 0.02)");
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.top + plotH);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Smooth-ish demand line
    ctx.beginPath();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.25;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Gradient bars on usage days
    const barWidth = Math.max(3, Math.min(14, plotW / (totalDays + 1) - 1.5));
    points.forEach((p) => {
      if (p.qty <= 0) return;
      const barH = (p.qty / maxQty) * plotH;
      const y = pad.top + plotH - barH;
      const grad = ctx.createLinearGradient(0, y, 0, pad.top + plotH);
      grad.addColorStop(0, "#3b82f6");
      grad.addColorStop(1, "#1d4ed8");
      ctx.fillStyle = grad;
      ctx.beginPath();
      const radius = Math.min(4, barWidth / 2);
      ctx.roundRect(p.x - barWidth / 2, y, barWidth, barH, [radius, radius, 0, 0]);
      ctx.fill();
    });

    // Peak points as dots
    points.forEach((p) => {
      if (p.qty <= 0) return;
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Forecast reference line
    if (forecastDaily > 0) {
      const lineY = pad.top + plotH - (forecastDaily / maxQty) * plotH;

      ctx.save();
      ctx.shadowColor = "rgba(249, 115, 22, 0.25)";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = forecastColor;
      ctx.lineWidth = 2.25;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(pad.left, lineY);
      ctx.lineTo(pad.left + plotW, lineY);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);

      const label = `Forecast ${forecastDaily.toFixed(2)}/day`;
      ctx.font = `700 11px ${fontFamily}`;
      const textW = ctx.measureText(label).width;
      const boxW = textW + 16;
      const boxH = 22;
      let boxX = pad.left + plotW - boxW;
      let boxY = lineY - boxH - 8;
      if (boxY < pad.top) boxY = lineY + 8;

      ctx.fillStyle = forecastColor;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, boxX + 8, boxY + boxH / 2);
    }

    // X-axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = `500 11px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const tickInterval = Math.max(1, Math.ceil(totalDays / 6));

    for (let dayOffset = 0; dayOffset <= totalDays; dayOffset += tickInterval) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + dayOffset);
      const x = pad.left + (dayOffset / totalDays) * plotW;
      const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top + plotH);
      ctx.lineTo(x, pad.top + plotH + 6);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.fillText(label, x, pad.top + plotH + 12);
    }

    // Y-axis title
    ctx.save();
    ctx.fillStyle = "#64748b";
    ctx.font = `600 11px ${fontFamily}`;
    ctx.translate(16, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Daily quantity", 0, 0);
    ctx.restore();

    // Update HTML legend colors for method
    const legendForecast = document.querySelector(".forecast-chart-legend__forecast");
    if (legendForecast) {
      legendForecast.style.setProperty("--forecast-swatch", forecastColor);
    }
  }

  // ============== EXPORT ==============

  bindDownloadEvents() {
    const downloadBtn = document.getElementById("forecastDownloadBtn");

    if (downloadBtn) {
      downloadBtn.addEventListener("click", async () => {
        await this.exportForecast();
      });
    }
  }

  getForecastExportData() {
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

    return { headers, rows };
  }

  exportForecast() {
    if (!this.forecastData || this.forecastData.length === 0) {
      alert("No forecast data to export. Generate a forecast first.");
      return;
    }

    DownloadOptions.open(
      { format: "pdf", paper: "A4", orientation: "landscape" },
      async (options) => {
        const { headers, rows } = this.getForecastExportData();
        const endpoint = options.format === "pdf" ? "/api/export/forecast/pdf" : "/api/export/forecast/excel";
        const payload = { headers, rows };
        if (options.format === "pdf") {
          payload.paper = options.paper;
          payload.orientation = options.orientation;
          payload.fontSize = options.fontSize;
          payload.rowSize = options.rowSize;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Export failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        link.href = url;
        link.download = `forecast-${stamp}.${options.format === "pdf" ? "pdf" : "xlsx"}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      },
      {
        fetchPreview: async (options, signal) => {
          const { headers, rows } = this.getForecastExportData();
          const payload = { format: options.format, headers, rows };
          if (options.format === "pdf") {
            payload.paper = options.paper;
            payload.orientation = options.orientation;
            payload.fontSize = options.fontSize;
            payload.rowSize = options.rowSize;
          }
          const res = await fetch("/api/export/forecast/preview", {
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
