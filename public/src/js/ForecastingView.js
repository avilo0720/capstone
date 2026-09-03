import Storage from "./API.js";
import Pagination from "./Pagination.js";
import DownloadOptions from "./DownloadOptions.js";
import confirmAction from "./ConfirmDialog.js";
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

  async setApp() {
    this.forecastSectionHTML = document.querySelector(".forecast-section-table");
    this.pagination.setContainer(document.getElementById("forecastPagination"));
    this.loadColumnWidths();

    const chartClose = document.getElementById("forecastChartClose");

    const amcRadios = document.querySelectorAll('input[name="amcMode"]');
    amcRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.amcMode = e.target.value;
        if (this.forecastData.length > 0) {
          this.renderVisuals();
          this.renderTable();
        }
      });
    });

    if (chartClose) {
      chartClose.addEventListener("click", () => {
        this.hideChart();
      });
    }

    window.addEventListener("resize", () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.onResize(), 160);
    });

    this.bindAlgoInfo();
    this.bindDownloadEvents();
    this.bindSendToProcurement();
    await this.loadForecast();
  }

  onResize() {
    if (!this.forecastData.length) return;
    this.renderOverviewCharts();
    if (this.selectedItemId == null) return;
    const item = this.forecastData.find((i) => i.id === this.selectedItemId);
    if (!item) return;
    this.drawChart(this.usageData[item.id] || [], item);
    this.drawRunwayChart(item);
  }

  bindAlgoInfo() {
    const btn = document.getElementById("forecastInfoBtn");
    const panel = document.getElementById("forecastAlgoPanel");
    if (!btn || !panel) return;

    const setOpen = (open) => {
      panel.classList.toggle("--hidden", !open);
      btn.classList.toggle("--active", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(panel.classList.contains("--hidden"));
    });

    document.addEventListener("click", (e) => {
      if (panel.classList.contains("--hidden")) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  async loadForecast() {
    const tableWrapper = document.getElementById("forecastTableWrapper");
    const actionsBar = document.getElementById("forecastActions");
    const visuals = document.getElementById("forecastVisuals");
    const hint = document.getElementById("forecastTableHint");

    try {
      const usageRes = await fetch("/api/forecast-data");
      this.usageData = await usageRes.json();

      const items = Storage.getItems();
      this.forecastData = computeForecasts(items, this.usageData);

      if (tableWrapper) tableWrapper.classList.remove("--hidden");
      if (actionsBar) actionsBar.classList.remove("--hidden");
      if (visuals) visuals.classList.remove("--hidden");
      if (hint) hint.classList.remove("--hidden");

      this.renderVisuals();
      this.pagination.reset();
      if (this.forecastSectionHTML) {
        this.renderTable();
      }
    } catch (err) {
      console.error("Failed to generate forecast:", err);
    }
  }

  getDemand(item) {
    const forecastAmc = item.forecast || 0;
    const inventoryAmc = Number(item.monthlyDemand) || 0;
    if (this.amcMode === "inventory") return inventoryAmc;
    if (this.amcMode === "combined") return (forecastAmc + inventoryAmc) / 2;
    return forecastAmc;
  }

  getNeeds(item) {
    const demand = this.getDemand(item);
    const qty = item.quantity || 0;
    return {
      demand,
      qty,
      need3m: Math.max(0, Math.ceil(demand * 3 - qty)),
      need6m: Math.max(0, Math.ceil(demand * 6 - qty)),
      need1y: Math.max(0, Math.ceil(demand * 12 - qty)),
    };
  }

  getCoverageMonths(item) {
    const demand = this.getDemand(item);
    const qty = item.quantity || 0;
    if (demand <= 0) return qty > 0 ? 24 : 0;
    return qty / demand;
  }

  coverageTone(months) {
    if (months < 1) return "critical";
    if (months < 3) return "low";
    if (months < 6) return "watch";
    return "healthy";
  }

  renderVisuals() {
    this.renderSummary();
    this.renderCoverageMix();
    requestAnimationFrame(() => this.renderOverviewCharts());
  }

  renderSummary() {
    const itemsEl = document.getElementById("forecastKpiItems");
    const restockEl = document.getElementById("forecastKpiRestock");
    const amcEl = document.getElementById("forecastKpiAmc");
    const coverEl = document.getElementById("forecastKpiCover");
    if (!itemsEl) return;

    const rows = this.forecastData.map((item) => {
      const { demand, need3m } = this.getNeeds(item);
      return { demand, need3m, cover: this.getCoverageMonths(item) };
    });

    const restockCount = rows.filter((r) => r.need3m > 0).length;
    const avgDemand = rows.length
      ? rows.reduce((sum, r) => sum + r.demand, 0) / rows.length
      : 0;
    const covers = rows.map((r) => r.cover).sort((a, b) => a - b);
    const mid = covers.length ? covers[Math.floor(covers.length / 2)] : 0;

    itemsEl.textContent = String(this.forecastData.length);
    restockEl.textContent = String(restockCount);
    amcEl.textContent = avgDemand.toFixed(1);
    coverEl.textContent = mid >= 24 ? "24+ mo" : `${mid.toFixed(1)} mo`;
  }

  renderCoverageMix() {
    const host = document.getElementById("forecastCoverageMix");
    if (!host) return;

    const bands = {
      critical: { label: "Under 1 month", count: 0 },
      low: { label: "1–3 months", count: 0 },
      watch: { label: "3–6 months", count: 0 },
      healthy: { label: "6+ months", count: 0 },
    };

    this.forecastData.forEach((item) => {
      bands[this.coverageTone(this.getCoverageMonths(item))].count += 1;
    });

    const total = Math.max(this.forecastData.length, 1);
    const order = ["critical", "low", "watch", "healthy"];

    host.innerHTML = `
      <div class="forecast-coverage-mix__heading">
        <h3>Stock coverage</h3>
        <p>How long current quantity lasts at the selected monthly demand</p>
      </div>
      <div class="forecast-coverage-mix__bar" role="img" aria-label="Stock coverage mix">
        ${order.map((key) => {
          const pct = (bands[key].count / total) * 100;
          if (pct <= 0) return "";
          return `<span class="forecast-coverage-mix__seg forecast-coverage-mix__seg--${key}" style="width:${pct}%" title="${bands[key].label}: ${bands[key].count}"></span>`;
        }).join("")}
      </div>
      <div class="forecast-coverage-mix__legend">
        ${order.map((key) => `
          <span class="forecast-coverage-mix__legend-item">
            <i class="forecast-coverage-mix__dot forecast-coverage-mix__dot--${key}"></i>
            ${bands[key].label}
            <strong>${bands[key].count}</strong>
          </span>
        `).join("")}
      </div>
    `;
  }

  renderOverviewCharts() {
    const methodCanvas = document.getElementById("forecastMethodChart");
    const needCanvas = document.getElementById("forecastNeedChart");
    if (!methodCanvas || !needCanvas) return;

    const methodCounts = { WMA: 0, Croston: 0, Static: 0 };
    this.forecastData.forEach((item) => {
      methodCounts[item.method] = (methodCounts[item.method] || 0) + 1;
    });

    this.drawDonutChart(methodCanvas, [
      { label: "WMA", value: methodCounts.WMA, color: "#8b5cf6" },
      { label: "Croston", value: methodCounts.Croston, color: "#f97316" },
      { label: "Static", value: methodCounts.Static, color: "#94a3b8" },
    ]);

    const topNeeds = [...this.forecastData]
      .map((item) => ({ item, need: this.getNeeds(item).need3m }))
      .filter((row) => row.need > 0)
      .sort((a, b) => b.need - a.need)
      .slice(0, 6);

    if (!topNeeds.length) {
      this.drawEmptyChart(needCanvas, "No restock needs in the next 3 months");
      return;
    }

    this.drawHorizontalBarChart(
      needCanvas,
      topNeeds.map((row) => ({
        label: row.item.title.length > 20 ? `${row.item.title.slice(0, 20)}…` : row.item.title,
        value: row.need,
        color: this.coverageTone(this.getCoverageMonths(row.item)) === "critical" ? "#ef4444" : "#1570ef",
      }))
    );
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
        <td>Qty / Cover</td>
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
    const { demand, qty, need3m, need6m, need1y } = this.getNeeds(item);
    const itemNo = this.formatItemNo(item.itemCode);
    const months = this.getCoverageMonths(item);
    const tone = this.coverageTone(months);
    const coverPct = Math.min(100, (Math.min(months, 12) / 12) * 100);
    const coverLabel = months >= 24 ? "24+ mo" : `${months.toFixed(1)} mo`;
    const methodClass = item.method === "Croston" ? "badge-croston" : item.method === "WMA" ? "badge-wma" : "badge-static";

    return `
      <tr data-item-id="${item.id}" class="forecast-row">
        <td class="forecast-row__item">
          <div class="forecast-row__item-main">
            ${itemNo ? `<span class="forecast-row__item-no">No. ${itemNo}</span>` : ""}
            <span class="forecast-row__item-name">${item.title}${item.size ? ` <span class="forecast-row__item-size">(${item.size})</span>` : ""}</span>
          </div>
          ${this.sparklineSVG(item.id)}
        </td>
        <td>
          <div class="forecast-qty-cell">
            <span class="badge badge-neutral">${qty}</span>
            <div class="forecast-coverage" title="Stock cover: ${coverLabel}">
              <div class="forecast-coverage__track">
                <div class="forecast-coverage__fill forecast-coverage__fill--${tone}" style="width:${coverPct}%"></div>
              </div>
              <span class="forecast-coverage__label">${coverLabel}</span>
            </div>
          </div>
        </td>
        <td>${demand.toFixed ? demand.toFixed(1) : demand}</td>
        <td>${need3m > 0 ? `<span class="badge badge-warning">+${need3m}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td>${need6m > 0 ? `<span class="badge badge-danger">+${need6m}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td>${need1y > 0 ? `<span class="badge badge-danger">+${need1y}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td><span class="badge ${methodClass}">${item.method}</span></td>
      </tr>
    `;
  }

  sparklineSVG(itemId) {
    const dailyUsage = this.usageData[itemId] || [];
    if (!dailyUsage.length) {
      return `<span class="forecast-sparkline forecast-sparkline--empty" title="No usage history">No usage</span>`;
    }

    const weeks = new Array(16).fill(0);
    const now = new Date();
    dailyUsage.forEach((d) => {
      const dt = new Date(d.date);
      const weeksAgo = Math.floor((now - dt) / (7 * 24 * 3600 * 1000));
      if (weeksAgo >= 0 && weeksAgo < 16) weeks[15 - weeksAgo] += d.qty;
    });

    const max = Math.max(...weeks, 1);
    const w = 76;
    const h = 26;
    const points = weeks.map((v, i) => {
      const x = (i / (weeks.length - 1)) * w;
      const y = h - 3 - (v / max) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return `<svg class="forecast-sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" title="Weekly usage, last 16 weeks"><polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
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
      this.drawRunwayChart(item);
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
    const w = Math.max(wrapper.clientWidth, 280);
    const h = 280;
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

  drawRunwayChart(item) {
    const canvas = document.getElementById("forecastRunwayChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';
    const wrapper = canvas.parentElement;
    const w = Math.max(wrapper.clientWidth, 240);
    const h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    const pad = { top: 28, right: 18, bottom: 44, left: 48 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const { demand, qty } = this.getNeeds(item);
    const months = 12;
    const points = [];
    for (let m = 0; m <= months; m++) {
      points.push({ month: m, qty: Math.max(0, qty - demand * m) });
    }

    const maxQty = Math.max(qty, demand * 3, 1) * 1.12;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pad.left - 8, pad.top - 8, plotW + 16, plotH + 16, 10);
    ctx.fill();
    ctx.stroke();

    const gridLines = 4;
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
      ctx.fillText(String(Math.round((maxQty / gridLines) * i)), pad.left - 10, y);
    }

    const toX = (m) => pad.left + (m / months) * plotW;
    const toY = (v) => pad.top + plotH - (v / maxQty) * plotH;

    [3, 6, 12].forEach((m) => {
      const x = toX(m);
      ctx.strokeStyle = "#e2e8f0";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    const zeroMonth = demand > 0 ? qty / demand : Infinity;
    if (zeroMonth > 0 && zeroMonth < months) {
      const x = toX(zeroMonth);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const areaGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    areaGrad.addColorStop(0, "rgba(14, 165, 233, 0.28)");
    areaGrad.addColorStop(1, "rgba(14, 165, 233, 0.03)");
    ctx.beginPath();
    ctx.moveTo(toX(0), pad.top + plotH);
    points.forEach((p) => ctx.lineTo(toX(p.month), toY(p.qty)));
    ctx.lineTo(toX(months), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    points.forEach((p, i) => {
      const x = toX(p.month);
      const y = toY(p.qty);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;
    ctx.arc(toX(0), toY(qty), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = `500 11px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    [0, 3, 6, 9, 12].forEach((m) => {
      ctx.fillText(`${m}m`, toX(m), pad.top + plotH + 10);
    });

    const cover = this.getCoverageMonths(item);
    const tone = this.coverageTone(cover);
    const toneColor = { critical: "#ef4444", low: "#f59e0b", watch: "#1570ef", healthy: "#16a34a" }[tone];
    const label = cover >= 24 ? "Cover 24+ mo" : `Runs out in ${cover.toFixed(1)} mo`;
    ctx.font = `700 11px ${fontFamily}`;
    const textW = ctx.measureText(label).width;
    const boxW = textW + 16;
    const boxX = pad.left + 8;
    const boxY = pad.top + 8;
    ctx.fillStyle = toneColor;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, 22, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, boxX + 8, boxY + 11);
  }

  sizeCanvas(canvas, height = 240) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(canvas.parentElement.clientWidth, 200);
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  drawDonutChart(canvas, data) {
    const { ctx, w, h } = this.sizeCanvas(canvas, 240);
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const cx = w * 0.38;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 18;
    const inner = radius * 0.58;

    if (total === 0) {
      this.drawEmptyChart(canvas, "No forecast data");
      return;
    }

    let start = -Math.PI / 2;
    data.forEach((d) => {
      if (!d.value) return;
      const slice = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      start += slice;
    });

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 22px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(total), cx, cy - 8);
    ctx.fillStyle = "#64748b";
    ctx.font = "600 11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("items", cx, cy + 12);

    let legendY = 28;
    data.forEach((d) => {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect(w - 118, legendY, 10, 10, 3);
      ctx.fill();
      ctx.fillStyle = "#334155";
      ctx.font = "600 12px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${d.label}  ${d.value}`, w - 102, legendY + 5);
      legendY += 24;
    });
  }

  drawHorizontalBarChart(canvas, data) {
    const { ctx, w, h } = this.sizeCanvas(canvas, 240);
    const pad = { top: 12, right: 36, bottom: 16, left: 108 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const rowH = plotH / data.length;
    const barH = Math.min(22, rowH * 0.55);

    data.forEach((d, i) => {
      const y = pad.top + i * rowH + (rowH - barH) / 2;
      const barW = Math.max(4, (d.value / maxVal) * plotW);
      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + barW, 0);
      grad.addColorStop(0, d.color);
      grad.addColorStop(1, d.color === "#ef4444" ? "#f97316" : "#38bdf8");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, barW, barH, [0, 6, 6, 0]);
      ctx.fill();

      ctx.fillStyle = "#475569";
      ctx.font = "600 11px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(d.label, pad.left - 8, y + barH / 2);

      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.fillText(String(d.value), pad.left + barW + 6, y + barH / 2);
    });
  }

  drawEmptyChart(canvas, message) {
    const { ctx, w, h } = this.sizeCanvas(canvas, 240);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, w / 2, h / 2);
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

  bindSendToProcurement() {
    const sendBtn = document.getElementById("forecastSendProcurementBtn");
    if (!sendBtn) return;
    sendBtn.addEventListener("click", () => this.sendToProcurement());
  }

  procurementPayload() {
    return {
      original_filename: "Forecast send",
      amc_mode: this.amcMode,
      items: this.forecastData.map((item) => {
        const { demand, qty, need3m, need6m, need1y } = this.getNeeds(item);
        return {
          item_id: item.id,
          item_code: item.itemCode || "",
          title: item.title || "",
          size: item.size || "",
          current_qty: qty,
          amc: demand,
          need_3m: need3m,
          need_6m: need6m,
          need_1y: need1y,
          method: item.method || "Static",
          requested_qty: need3m,
        };
      }),
    };
  }

  async sendToProcurement() {
    if (!this.forecastData?.length) {
      alert("No forecast data to send. Generate a forecast first.");
      return;
    }

    const ok = await confirmAction({
      title: "Send to Procurement?",
      message: "This creates a pending procurement request from the current forecast so it can be reviewed, approved, denied, or used for stock entry.",
      confirmLabel: "Send request",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/procurement-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.procurementPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not send this forecast to Procurement.");
      }
      const go = await confirmAction({
        title: "Sent to Procurement",
        message: "Request #" + (data.request?.id || "") + " is pending review. Open the Procurement tab now?",
        confirmLabel: "Open Procurement",
        cancelLabel: "Stay here",
      });
      if (go) window.location.href = "/procurement";
    } catch (err) {
      alert(err.message || "Could not send this forecast to Procurement.");
    }
  }

  getForecastExportData() {
    let amcLabel = "AMC (Forecast)";
    if (this.amcMode === "inventory") amcLabel = "AMC (Inventory)";
    if (this.amcMode === "combined") amcLabel = "AMC (Combined)";

    const headers = ["Item Code", "Item Name", "Size", "Current Qty", amcLabel, "3 Months Need", "6 Months Need", "1 Year Need", "Method"];
    const rows = this.forecastData.map((item) => {
      const { demand, qty, need3m, need6m, need1y } = this.getNeeds(item);

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
