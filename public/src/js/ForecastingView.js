import Storage from "./API.js";

const mainApp = document.querySelector(".main");

class ForecastingUi {
  constructor() {
    this.columnWidths = {};
    this.columnWidthStorageKey = "forecastColumnWidths";
    this.forecastData = []; // Store generated data for export
  }

  setApp() {
    this.forecastSectionHTML = document.querySelector(".forecast-section-table");
    this.loadColumnWidths();

    const generateBtn = document.getElementById("generateForecastBtn");
    const placeholder = document.getElementById("forecastPlaceholder");
    const tableWrapper = document.getElementById("forecastTableWrapper");
    const actionsBar = document.getElementById("forecastActions");

    if (generateBtn) {
      generateBtn.addEventListener("click", () => {
        // Hide placeholder, show table and actions
        if (placeholder) placeholder.classList.add("--hidden");
        if (tableWrapper) tableWrapper.classList.remove("--hidden");
        if (actionsBar) actionsBar.classList.remove("--hidden");

        const items = Storage.getItems();
        this.forecastData = items;

        if (this.forecastSectionHTML) {
          this.updateDom(items);
        }
      });
    }

    // Download dropdown
    this.bindDownloadEvents();
  }

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

      // Close menu on outside click
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

    const headers = ["Item Code", "Item Name", "Size", "Current Qty", "AMC", "3 Months Need", "6 Months Need", "1 Year Need"];
    const rows = this.forecastData.map((item) => {
      const demand = item.monthlyDemand || 0;
      const qty = item.quantity || 0;
      const need3m = Math.max(0, demand * 3 - qty);
      const need6m = Math.max(0, demand * 6 - qty);
      const need1y = Math.max(0, demand * 12 - qty);

      return [
        item.itemCode || "",
        item.title || "",
        item.size || "",
        qty,
        demand,
        need3m > 0 ? `+${need3m}` : "OK",
        need6m > 0 ? `+${need6m}` : "OK",
        need1y > 0 ? `+${need1y}` : "OK",
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

  updateDom(allItems) {
    let result = `
      <tr class="table__title">
        <td>Item</td>
        <td>Current Quantity</td>
        <td>Average Monthly Consumption (AMC)</td>
        <td>3 Months Need</td>
        <td>6 Months Need</td>
        <td>1 Year Need</td>
      </tr>    
    `;

    allItems.forEach((item) => {
      result += this.createRowHTML(item);
    });

    this.forecastSectionHTML.innerHTML = result;
    this.enableColumnResize();
  }

  createRowHTML(item) {
    const demand = item.monthlyDemand || 0;
    const qty = item.quantity || 0;
    const itemNo = this.formatItemNo(item.itemCode);

    const need3m = Math.max(0, (demand * 3) - qty);
    const need6m = Math.max(0, (demand * 6) - qty);
    const need1y = Math.max(0, (demand * 12) - qty);

    return `
      <tr>
        <td style="font-weight: 500;">
          ${itemNo ? `<span style="opacity:0.6;font-size:0.85em;">No. ${itemNo}</span><br/>` : ''}
          ${item.title} ${item.size ? `<span style="font-size:0.85em;">(${item.size})</span>` : ''}
        </td>
        <td><span class="badge badge-neutral">${qty}</span></td>
        <td>${demand}</td>
        <td>${need3m > 0 ? `<span class="badge badge-warning">+${need3m}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td>${need6m > 0 ? `<span class="badge badge-danger">+${need6m}</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td>${need1y > 0 ? `<span class="badge badge-danger">+${need1y}</span>` : '<span class="badge badge-success">OK</span>'}</td>
      </tr>
    `;
  }

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
