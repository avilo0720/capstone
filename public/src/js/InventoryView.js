import Storage from "./API.js";
import Pagination from "./Pagination.js";
import DownloadOptions from "./DownloadOptions.js";
import confirmAction from "./ConfirmDialog.js";

const mainApp = document.querySelector(".main");
// Selecting the prodcut modal
let addProModal;
let ProModalAddBtn;
let ProModalCancelBtn;
let ModalTitle;
let productForm;
let editToggleBtn;
let stockToggleBtn;
let filterToggleBtn;
let filterPanel;
let filterDropdown;
let downloadToggleBtn;

// Selecting the inputs in the add Product Modal
let productNameInput;
let itemSizeInput;
let productQuantityInput;
let productPriceInput;
let productDemandInput;

// --------------------- SearchBar --------------------------------
let searchBar;

const INVENTORY_COLUMNS = [
  { key: "no", label: "No", short: "No", required: true },
  { key: "item", label: "Item Description", short: "Item", required: true },
  { key: "size", label: "Size", short: "Size" },
  { key: "stock", label: "Current Stock", short: "Stock" },
  { key: "amc", label: "AMC", short: "AMC" },
  { key: "cumulative", label: "Cumulative", short: "Cumul" },
  { key: "percent", label: "%", short: "%" },
  { key: "fsn", label: "FSN", short: "FSN" },
  { key: "ltd", label: "LTD", short: "LTD" },
  { key: "leadTime", label: "Lead Time (Months)", short: "LT Mo" },
  { key: "ss", label: "SS", short: "SS" },
  { key: "rop", label: "ROP", short: "ROP" },
  { key: "msl", label: "MSL", short: "MSL" },
  { key: "unitCost", label: "Unit Cost", short: "Unit" },
  { key: "totalCost", label: "Total Cost", short: "Total" },
  { key: "trigger", label: "Trigger Point", short: "Trigger" },
];

const DEFAULT_VISIBLE_COLUMNS = ["no", "item", "size", "stock", "amc", "fsn", "trigger"];

class InventoryUi {
  constructor() {
    this.id = 0;
    this.isSubmitting = false;
    this.isEditMode = false;
    this.isStockMode = false;
    this.canEdit = true; // default, updated in setApp()
    this.selectedFsnFilter = "";
    this.selectedTriggerFilter = "";
    this.columnWidths = {};
    this.columnWidthStorageKey = "inventoryColumnWidths";
    this.visibleColumnsStorageKey = "inventoryVisibleColumns";
    this.visibleColumns = new Set(DEFAULT_VISIBLE_COLUMNS);
    this.filteredItems = [];
    this.pagination = new Pagination({
      pageSize: 10,
      onPageChange: () => this.renderTable(),
    });
  }

  setApp() {
    this.canEdit = document.body.dataset.canEdit === 'true';
    addProModal = document.querySelector(".addProSection");
    ProModalAddBtn = document.querySelector(".addProModalSubmitBtn");
    ProModalCancelBtn = document.querySelector(".addProModalCancelBtn");
    ModalTitle = document.querySelector(".addProModal__title");
    productForm = document.querySelector(".addProModal__form");
    editToggleBtn = document.querySelector(".editToggleBtn");
    stockToggleBtn = document.querySelector(".stockToggleBtn");
    filterToggleBtn = document.querySelector(".filterBtn");
    filterPanel = document.querySelector(".inventoryFilterPanel");
    filterDropdown = document.querySelector(".filterDropdown");
    downloadToggleBtn = document.querySelector(".downloadBtn");
    productNameInput = document.querySelector(".productNameInput");
    itemSizeInput = document.querySelector(".itemSizeInput");
    productQuantityInput = document.querySelector(".productQuantityInput");
    productPriceInput = document.querySelector(".productPriceInput");
    productDemandInput = document.querySelector(".productDemandInput");
    searchBar = document.querySelector(".searchBarInput");
    // Ensure table starts in fit-to-screen mode.
    localStorage.removeItem(this.columnWidthStorageKey);
    this.loadColumnWidths();
    this.loadVisibleColumns();
    this.inventoryRoot = document.querySelector(".inventory-app");
    this.pagination.setContainer(document.getElementById("inventoryPagination"));
    this.viewModal = document.getElementById("viewItemModal");
    this.viewModalBody = document.getElementById("viewItemBody");
    const viewItemClose = document.getElementById("viewItemClose");
    if (viewItemClose) {
      viewItemClose.addEventListener("click", () => this.closeViewModal());
    }
    if (this.viewModal) {
      this.viewModal.addEventListener("click", (e) => {
        if (e.target.classList.contains("viewItemSection")) this.closeViewModal();
      });
    }

    // Hide Add/Edit/Stock buttons for view-only roles
    if (!this.canEdit) {
      const addBtn = document.querySelector(".addProBtn");
      if (addBtn) addBtn.style.display = 'none';
      if (editToggleBtn) editToggleBtn.style.display = 'none';
      if (stockToggleBtn) stockToggleBtn.style.display = 'none';
    }

    this.renderColumnToggleButtons();
    this.bindEvents();
    this.applyEditModeUI();
    this.applyStockModeUI();
    this.applyFilterUI();

    // Selecting the products table section
    this.productSectionHTMl = document.querySelector(".product-section-table");
    if (this.productSectionHTMl) {
      this.filteredItems = this.getFilteredItems(Storage.getItems());
      this.renderTable();
    }
  }

  bindEvents() {
    // Submit item form from button click or Enter key.
    if (productForm) {
      productForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.addProductModalLogic();
      });
    }

    // Delegate Add Item trigger so it still works if element is re-rendered.
    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".addProBtn");
      if (!addBtn) return;
      if (!ModalTitle || !ProModalAddBtn) return;
      ModalTitle.textContent = "New Item";
      ProModalAddBtn.textContent = "Add Item";
      this.openProductModal();
    });
    
    if (ProModalCancelBtn) {
      ProModalCancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.closeProductModal();
      });
    }

    if (addProModal) {
      addProModal.addEventListener("click", (e) => {
        // Checking if the user click on the empty black space behind the add modal so we can close it
        if (e.target.classList.contains("addProSection")) {
          this.closeProductModal(e); // Closing the Modal
        }
      });
    }

    if (editToggleBtn) {
      editToggleBtn.addEventListener("click", () => {
        this.isEditMode = !this.isEditMode;
        if (this.isEditMode) { this.isStockMode = false; this.applyStockModeUI(); }
        this.applyEditModeUI();
        this.renderTable();
      });
    }

    if (stockToggleBtn) {
      stockToggleBtn.addEventListener("click", () => {
        this.isStockMode = !this.isStockMode;
        if (this.isStockMode) { this.isEditMode = false; this.applyEditModeUI(); }
        this.applyStockModeUI();
        this.renderTable();
      });
    }

    if (filterToggleBtn && filterPanel) {
      filterToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        filterPanel.classList.toggle("--hidden");
      });
      filterPanel.addEventListener("click", (e) => {
        e.stopPropagation();

        const linkBtn = e.target.closest(".filterLinkBtn");
        if (linkBtn) {
          const action = linkBtn.dataset.action;
          if (action === "columns-default") this.setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          if (action === "columns-all") this.setVisibleColumns(INVENTORY_COLUMNS.map((c) => c.key));
          this.applyFilterUI();
          this.renderTable();
          return;
        }

        const btn = e.target.closest(".filterOptionBtn");
        if (!btn) return;

        const group = btn.dataset.group;
        const value = btn.dataset.value;
        if (group === "fsn") {
          this.selectedFsnFilter = this.selectedFsnFilter === value ? "" : value;
          this.applyFilterUI();
          this.filteredItems = this.getFilteredItems(Storage.getItems());
          this.pagination.reset();
          this.renderTable();
          return;
        }
        if (group === "trigger") {
          this.selectedTriggerFilter = this.selectedTriggerFilter === value ? "" : value;
          this.applyFilterUI();
          this.filteredItems = this.getFilteredItems(Storage.getItems());
          this.pagination.reset();
          this.renderTable();
          return;
        }
        if (group === "column") {
          this.toggleColumn(value);
          this.applyFilterUI();
          this.renderTable();
        }
      });
    }

    if (downloadToggleBtn) {
      downloadToggleBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (filterPanel) filterPanel.classList.add("--hidden");
        await this.exportVisibleTable();
      });
    }

    document.addEventListener("click", (e) => {
      const clickedFilter =
        (filterDropdown && filterDropdown.contains(e.target)) ||
        (filterToggleBtn && filterToggleBtn.contains(e.target)) ||
        (filterPanel && filterPanel.contains(e.target));

      if (!clickedFilter && filterPanel) {
        filterPanel.classList.add("--hidden");
      }
    });
  }

  getFilteredItems(allItems) {
    const maxCumulative =
      allItems.reduce((acc, item) => acc + (Number(item.monthlyDemand) || 0), 0) || 0;
    const totalProcurementLeadTimeMonths = 3.5;
    let cumulativeDemand = 0;
    const rows = [];

    allItems.forEach((item) => {
      cumulativeDemand += Number(item.monthlyDemand) || 0;
      const cumulativePercent = maxCumulative === 0 ? 0 : cumulativeDemand / maxCumulative;
      const rowMetrics = this.getRowMetrics(
        item,
        cumulativeDemand,
        cumulativePercent,
        totalProcurementLeadTimeMonths
      );
      if (this.passesFilters(rowMetrics)) {
        rows.push(rowMetrics);
      }
    });

    return rows;
  }

  renderTable() {
    this.updateDom(this.filteredItems);
  }

  showActionsColumn() {
    return this.canEdit && (this.isEditMode || this.isStockMode);
  }

  updateDom(allRowMetrics) {
    const page = this.pagination.getSlice(allRowMetrics);
    const visibleCols = this.getVisibleColumnDefs();
    const showActions = this.showActionsColumn();

    let result = `<tr class="table__title">`;
    visibleCols.forEach((col) => {
      result += `<td>${col.label}</td>`;
    });
    if (showActions) {
      result += `<td>${this.isStockMode ? "Adjust" : "Actions"}</td>`;
    }
    result += `</tr>`;

    page.items.forEach((rowMetrics) => {
      result += this.createItemHTML(rowMetrics);
    });

    this.productSectionHTMl.innerHTML = result;
    this.pagination.renderControls({
      totalItems: page.totalItems,
      totalPages: page.totalPages,
      startIndex: page.startIndex,
      endIndex: page.endIndex,
    });
    this.enableColumnResize();

    this.productSectionHTMl.querySelectorAll("tr.inventory-row").forEach((rowEl) => {
      rowEl.addEventListener("click", (e) => {
        if (e.target.closest(".editTableSection, .stockTableSection, button, input, a")) {
          return;
        }
        const id = Number(rowEl.dataset.id);
        if (id) this.openViewModal(id);
      });
    });

    const deleteBtns = document.querySelectorAll(".deleteIcon");
    deleteBtns.forEach((deleteBtn) =>
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(e.currentTarget.dataset.id);
        this.deleteBtnLogic(id);
      })
    );

    const editBtns = document.querySelectorAll(".editIcon");
    editBtns.forEach((editBtn) =>
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(e.currentTarget.dataset.id);
        this.editBtnLogic(id);
      })
    );

    const stockBtns = document.querySelectorAll(".inline-stock__btn");
    stockBtns.forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = Number(e.currentTarget.dataset.id);
        const action = e.currentTarget.dataset.action;
        const input = e.currentTarget.parentElement.querySelector(".inline-stock__input");
        const qty = Math.max(1, Number(input?.value) || 1);
        await this.handleStockAdjustment(id, action, qty);
      })
    );
  }

  getRowMetrics(item, cumulativeDemand, cumulativePercent, procurementLeadTimeMonths) {
    const fsn = this.getAutoFSN(cumulativePercent);
    const leadTimeDemand = (Number(item.monthlyDemand) || 0) * 3.495065789473684;
    const roundedLeadTimeDemand = this.roundHalfDown(leadTimeDemand);
    const safetyStock = ((Number(item.monthlyDemand) || 0) + leadTimeDemand) * 0.1;
    const roundedSafetyStock = this.roundHalfDown(safetyStock);
    const currentStock = Number(item.quantity) || 0;
    const amc = Number(item.monthlyDemand) || 0;
    const reorderingPoint = roundedLeadTimeDemand + roundedSafetyStock;
    const minimumStockLevel =
      fsn === "N" && currentStock < 3
        ? 3
        : amc + leadTimeDemand + safetyStock;
    const displayedMinimumStockLevel = Math.round(minimumStockLevel);
    const totalCost = minimumStockLevel * (Number(item.price) || 0);
    const triggerPoint =
      ((reorderingPoint > currentStock && (fsn === "F" || fsn === "S")) ||
        (fsn === "N" && currentStock < 3))
        ? "RS Needed"
        : "Sufficient";
    const triggerClass =
      triggerPoint === "Sufficient" ? "trigger-pill --ok" : "trigger-pill --need";
    return {
      item,
      cumulativeDemand,
      cumulativePercent,
      procurementLeadTimeMonths,
      fsn,
      roundedLeadTimeDemand,
      roundedSafetyStock,
      currentStock,
      amc,
      reorderingPoint,
      minimumStockLevel,
      displayedMinimumStockLevel,
      totalCost,
      triggerPoint,
      triggerClass,
    };
  }

  passesFilters(rowMetrics) {
    if (this.selectedFsnFilter && rowMetrics.fsn !== this.selectedFsnFilter) return false;
    if (
      this.selectedTriggerFilter &&
      rowMetrics.triggerPoint !== this.selectedTriggerFilter
    ) {
      return false;
    }
    return true;
  }

  createItemHTML(row) {
    let actionsHtml = "";
    if (this.isStockMode && this.canEdit) {
      actionsHtml = `
        <td class="stockTableSection">
          <div class="inline-stock" data-id="${row.item.id}">
            <input type="number" class="inline-stock__input" data-id="${row.item.id}" value="1" min="1" aria-label="Quantity" />
            <button type="button" class="inline-stock__btn --use" data-id="${row.item.id}" data-action="use" title="Use stock">Use</button>
            <button type="button" class="inline-stock__btn --add" data-id="${row.item.id}" data-action="add" title="Add stock">Add</button>
          </div>
        </td>`;
    } else if (this.isEditMode && this.canEdit) {
      actionsHtml = `
        <td class="editTableSection">
          <div class="table__actions">
            <div class="table__icons">
              <button type="button" class="row-action --edit editIcon" data-id="${row.item.id}" title="Edit item" aria-label="Edit item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button type="button" class="row-action --delete deleteIcon" data-id="${row.item.id}" title="Delete item" aria-label="Delete item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>
        </td>`;
    }

    let cells = "";
    this.getVisibleColumnDefs().forEach((col) => {
      cells += this.renderTableCell(row, col.key);
    });

    return `<tr class="inventory-row" data-id="${row.item.id}" title="Click to view details">${cells}${actionsHtml}</tr>`;
  }

  renderTableCell(row, key) {
    if (key === "trigger") {
      return `<td><span class="${row.triggerClass}">${row.triggerPoint}</span></td>`;
    }
    return `<td>${this.getColumnValue(row, key)}</td>`;
  }

  getColumnValue(row, key) {
    switch (key) {
      case "no":
        return this.formatItemCode(row.item.itemCode);
      case "item":
        return row.item.title || "";
      case "size":
        return row.item.size || "---";
      case "stock":
        return String(row.currentStock);
      case "amc":
        return String(row.amc);
      case "cumulative":
        return String(row.cumulativeDemand);
      case "percent":
        return `${(row.cumulativePercent * 100).toFixed(2)}%`;
      case "fsn":
        return row.fsn;
      case "ltd":
        return String(row.roundedLeadTimeDemand);
      case "leadTime":
        return String(row.procurementLeadTimeMonths);
      case "ss":
        return String(row.roundedSafetyStock);
      case "rop":
        return String(row.reorderingPoint);
      case "msl":
        return String(row.displayedMinimumStockLevel);
      case "unitCost":
        return `₱${(Number(row.item.price) || 0).toFixed(2)}`;
      case "totalCost":
        return `₱${row.totalCost.toFixed(2)}`;
      case "trigger":
        return row.triggerPoint;
      default:
        return "";
    }
  }

  getVisibleColumnDefs() {
    return INVENTORY_COLUMNS.filter((col) => this.visibleColumns.has(col.key));
  }

  renderColumnToggleButtons() {
    const container = document.getElementById("inventoryColumnToggles");
    if (!container) return;
    container.innerHTML = INVENTORY_COLUMNS.map((col) => {
      const locked = col.required ? ' data-locked="true"' : "";
      return `<button type="button" class="filterOptionBtn" data-group="column" data-value="${col.key}"${locked}>${col.short}</button>`;
    }).join("");
  }

  loadVisibleColumns() {
    try {
      const raw = localStorage.getItem(this.visibleColumnsStorageKey);
      if (!raw) {
        this.visibleColumns = new Set(DEFAULT_VISIBLE_COLUMNS);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.visibleColumns = new Set(DEFAULT_VISIBLE_COLUMNS);
        return;
      }
      const valid = parsed.filter((key) => INVENTORY_COLUMNS.some((col) => col.key === key));
      DEFAULT_VISIBLE_COLUMNS.filter((key) =>
        INVENTORY_COLUMNS.find((col) => col.key === key)?.required
      ).forEach((key) => {
        if (!valid.includes(key)) valid.push(key);
      });
      this.visibleColumns = new Set(valid.length ? valid : DEFAULT_VISIBLE_COLUMNS);
    } catch (e) {
      console.error("Failed to load inventory visible columns:", e);
      this.visibleColumns = new Set(DEFAULT_VISIBLE_COLUMNS);
    }
  }

  saveVisibleColumns() {
    try {
      localStorage.setItem(
        this.visibleColumnsStorageKey,
        JSON.stringify([...this.visibleColumns])
      );
    } catch (e) {
      console.error("Failed to save inventory visible columns:", e);
    }
  }

  setVisibleColumns(keys) {
    const next = new Set(keys);
    INVENTORY_COLUMNS.forEach((col) => {
      if (col.required) next.add(col.key);
    });
    this.visibleColumns = next;
    this.saveVisibleColumns();
    this.applyFilterUI();
  }

  toggleColumn(key) {
    const col = INVENTORY_COLUMNS.find((c) => c.key === key);
    if (!col || col.required) return;
    if (this.visibleColumns.has(key)) {
      this.visibleColumns.delete(key);
    } else {
      this.visibleColumns.add(key);
    }
    this.saveVisibleColumns();
  }

  hasCustomColumns() {
    if (this.visibleColumns.size !== DEFAULT_VISIBLE_COLUMNS.length) return true;
    return DEFAULT_VISIBLE_COLUMNS.some((key) => !this.visibleColumns.has(key));
  }

  openViewModal(id) {
    const row = this.filteredItems.find((r) => r.item.id == id);
    if (!row || !this.viewModal || !this.viewModalBody) return;

    this.viewModalBody.innerHTML = `
      <div class="viewItemModal__section">
        <h3>${row.item.title}${row.item.size ? ` (${row.item.size})` : ""}</h3>
        <p class="viewItemModal__code">Item No. ${this.formatItemCode(row.item.itemCode)}</p>
      </div>
      <div class="viewItemModal__grid">
        <div class="viewItemModal__field"><span>Current Stock</span><strong>${row.currentStock}</strong></div>
        <div class="viewItemModal__field"><span>Average Monthly Consumption</span><strong>${row.amc}</strong></div>
        <div class="viewItemModal__field"><span>Cumulative Demand</span><strong>${row.cumulativeDemand}</strong></div>
        <div class="viewItemModal__field"><span>Cumulative %</span><strong>${(row.cumulativePercent * 100).toFixed(2)}%</strong></div>
        <div class="viewItemModal__field"><span>FSN Classification</span><strong>${row.fsn}</strong></div>
        <div class="viewItemModal__field"><span>Lead Time Demand (LTD)</span><strong>${row.roundedLeadTimeDemand}</strong></div>
        <div class="viewItemModal__field"><span>Procurement Lead Time</span><strong>${row.procurementLeadTimeMonths} months</strong></div>
        <div class="viewItemModal__field"><span>Safety Stock (SS)</span><strong>${row.roundedSafetyStock}</strong></div>
        <div class="viewItemModal__field"><span>Reordering Point (ROP)</span><strong>${row.reorderingPoint}</strong></div>
        <div class="viewItemModal__field"><span>Minimum Stock Level (MSL)</span><strong>${row.displayedMinimumStockLevel}</strong></div>
        <div class="viewItemModal__field"><span>Unit Cost</span><strong>₱${(Number(row.item.price) || 0).toFixed(2)}</strong></div>
        <div class="viewItemModal__field"><span>Total Cost</span><strong>₱${row.totalCost.toFixed(2)}</strong></div>
        <div class="viewItemModal__field"><span>Trigger Point</span><strong><span class="${row.triggerClass}">${row.triggerPoint}</span></strong></div>
      </div>`;

    this.viewModal.classList.remove("--hidden");
  }

  closeViewModal() {
    if (this.viewModal) this.viewModal.classList.add("--hidden");
  }

  formatItemCode(itemCode) {
    if (!itemCode) return "---";
    const normalized = String(itemCode).trim();
    const numericOnly = normalized.replace(/^item[-_\s]*/i, "");
    return numericOnly || normalized;
  }

  roundHalfDown(value) {
    const sign = value < 0 ? -1 : 1;
    const absVal = Math.abs(value);
    const floor = Math.floor(absVal);
    const fraction = absVal - floor;
    if (fraction > 0.5) return sign * (floor + 1);
    return sign * floor;
  }

  getDefaultColumnWidths(columnCount) {
    const defaults = {
      0: 72,   // No
      1: 260,  // Item Description
      2: 90,   // Size
      3: 120,  // Current Stock
      4: 90,   // AMC
      5: 72,   // FSN
      6: 130,  // Trigger Point
      7: 140,  // Actions / Stock
    };
    const widths = {};
    for (let i = 0; i < columnCount; i += 1) {
      widths[i] = defaults[i] || 110;
    }
    return widths;
  }

  applyColumnWidth(colIndex, width) {
    const table = this.productSectionHTMl;
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
    const table = this.productSectionHTMl;
    if (!table) return;

    const headerCells = table.querySelectorAll("tr.table__title td");
    if (!headerCells.length) return;

    const defaults = this.getDefaultColumnWidths(headerCells.length);

    headerCells.forEach((cell, colIndex) => {
      cell.querySelectorAll(".col-resize-handle").forEach((h) => h.remove());
      cell.style.position = "relative";

      const width = this.columnWidths[colIndex] || defaults[colIndex];
      this.applyColumnWidth(colIndex, width);

      // Last actions column stays fixed-ish; still allow resize but with a clearer handle
      const handle = document.createElement("span");
      handle.className = "col-resize-handle";
      handle.title = "Drag to resize column";
      cell.appendChild(handle);

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = cell.getBoundingClientRect().width;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        handle.classList.add("is-dragging");

        const onMove = (moveEvent) => {
          const minWidth = colIndex === 1 ? 140 : 64;
          const newWidth = Math.max(minWidth, startWidth + (moveEvent.clientX - startX));
          this.columnWidths[colIndex] = newWidth;
          this.applyColumnWidth(colIndex, newWidth);
        };

        const onUp = () => {
          this.saveColumnWidths();
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
          handle.classList.remove("is-dragging");
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }

  applyEditModeUI() {
    if (this.inventoryRoot) {
      this.inventoryRoot.classList.toggle("--editMode", this.isEditMode);
    }
    if (editToggleBtn) {
      editToggleBtn.textContent = this.isEditMode ? "Done" : "Edit";
      editToggleBtn.classList.toggle("--active", this.isEditMode);
    }
  }

  applyStockModeUI() {
    if (this.inventoryRoot) {
      this.inventoryRoot.classList.toggle("--stockMode", this.isStockMode);
    }
    if (stockToggleBtn) {
      stockToggleBtn.textContent = this.isStockMode ? "Done" : "Adjust Stock";
      stockToggleBtn.classList.toggle("--active", this.isStockMode);
    }
    const banner = document.getElementById("stockModeBanner");
    if (banner) {
      banner.classList.toggle("--hidden", !this.isStockMode);
    }
  }

  async handleStockAdjustment(itemId, action, quantity) {
    const actionLabel = action === "use" ? "used" : "added";
    const item = Storage.getItems().find((i) => i.id == itemId);
    const itemName = item?.title || "this item";
    const isUse = action === "use";
    const ok = await confirmAction({
      title: isUse ? "Use stock?" : "Add stock?",
      message: isUse
        ? `Use ${quantity} unit(s) of "${itemName}"? This will reduce current stock.`
        : `Add ${quantity} unit(s) to "${itemName}"? This will increase current stock.`,
      confirmLabel: isUse ? "Use stock" : "Add stock",
      danger: isUse,
    });
    if (!ok) return;

    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action, quantity })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Stock update failed');
        return;
      }
      const data = await res.json();
      const updated = Storage.getItems().find(i => i.id == itemId);
      if (updated) {
        updated.quantity = data.newQuantity;
      }
      this.filteredItems = this.getFilteredItems(Storage.getItems());
      this.renderTable();
      this.showStockToast(`${quantity} ${actionLabel}. New stock: ${data.newQuantity}`);
    } catch (e) {
      console.error('Stock adjustment error:', e);
      alert('Failed to update stock. Please try again.');
    }
  }

  showStockToast(message) {
    let toast = document.querySelector(".stock-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "stock-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("--show");
    clearTimeout(this._stockToastTimer);
    this._stockToastTimer = setTimeout(() => {
      toast.classList.remove("--show");
    }, 2200);
  }

  applyFilterUI() {
    if (!filterPanel) return;
    const optionBtns = filterPanel.querySelectorAll(".filterOptionBtn");
    optionBtns.forEach((btn) => {
      const group = btn.dataset.group;
      const value = btn.dataset.value;
      let isActive = false;
      if (group === "fsn") isActive = value === this.selectedFsnFilter;
      if (group === "trigger") isActive = value === this.selectedTriggerFilter;
      if (group === "column") isActive = this.visibleColumns.has(value);
      btn.classList.toggle("--active", isActive);
    });
    if (filterToggleBtn) {
      filterToggleBtn.classList.toggle(
        "--active",
        Boolean(this.selectedFsnFilter || this.selectedTriggerFilter || this.hasCustomColumns())
      );
    }
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
      console.error("Failed to load inventory column widths:", e);
    }
  }

  saveColumnWidths() {
    try {
      localStorage.setItem(this.columnWidthStorageKey, JSON.stringify(this.columnWidths));
    } catch (e) {
      console.error("Failed to save inventory column widths:", e);
    }
  }

  getAutoFSN(cumulativePercent) {
    if (cumulativePercent <= 0.2) return "N";
    if (cumulativePercent < 0.7) return "S";
    return "F";
  }

  getVisibleTableData() {
    const cols = this.getVisibleColumnDefs();
    const headers = cols.map((col) => col.label);
    const rows = this.filteredItems.map((row) =>
      cols.map((col) => this.getColumnValue(row, col.key))
    );
    return { headers, rows };
  }

  exportVisibleTable() {
    if (!this.getVisibleColumnDefs().length) {
      alert("Nothing to export.");
      return;
    }

    DownloadOptions.open(
      { format: "pdf", paper: "A4", orientation: "landscape" },
      async (options) => {
        const tableData = this.getVisibleTableData();
        const endpoint =
          options.format === "pdf" ? "/api/export/inventory/pdf" : "/api/export/inventory/excel";
        const payload = { ...tableData };
        if (options.format === "pdf") {
          payload.paper = options.paper;
          payload.orientation = options.orientation;
          payload.fontSize = options.fontSize;
          payload.rowSize = options.rowSize;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        link.href = url;
        link.download = `inventory-${stamp}.${options.format === "pdf" ? "pdf" : "xlsx"}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      },
      {
        fetchPreview: async (options, signal) => {
          const tableData = this.getVisibleTableData();
          const payload = {
            format: options.format,
            ...tableData,
          };
          if (options.format === "pdf") {
            payload.paper = options.paper;
            payload.orientation = options.orientation;
            payload.fontSize = options.fontSize;
            payload.rowSize = options.rowSize;
          }
          const res = await fetch("/api/export/inventory/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal,
          });
          if (!res.ok) throw new Error("Preview failed");
          return res.blob();
        },
        columns: {
          defs: INVENTORY_COLUMNS,
          getVisible: () => [...this.visibleColumns],
          onToggle: (key) => {
            this.toggleColumn(key);
            this.applyFilterUI();
            this.renderTable();
          },
          onSetDefault: () => {
            this.setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
            this.renderTable();
          },
          onSetAll: () => {
            this.setVisibleColumns(INVENTORY_COLUMNS.map((c) => c.key));
            this.renderTable();
          },
        },
      }
    );
  }

  openProductModal() {
    if (!addProModal) return;
    addProModal.classList.remove("--hidden");
    this.clearInputsField();
  }

  closeProductModal() {
    if (!addProModal) return;
    addProModal.classList.add("--hidden");
    this.clearInputsField();
    this.id = 0;
  }

  clearInputsField() {
    // clear the input fields
    [
      productPriceInput,
      productQuantityInput,
      productNameInput,
      itemSizeInput,
      productDemandInput,
    ].forEach((input) => {
      if (input) input.value = "";
    });
  }

  async addProductModalLogic() {
    if (this.isSubmitting) return -1;
    this.isSubmitting = true;
    try {

      // Checking of the field are empty or not
      if (
        !productNameInput.value ||
        !productQuantityInput.value ||
        !productPriceInput.value
      ) {
        alert("Please enter all of the fields!");
        return -1;
      }
      if (
        Number(productPriceInput.value) < 0 ||
        Number(productQuantityInput.value) < 0 ||
        Number(productDemandInput.value) < 0
      ) {
        alert("Quantity, Price, and Demand should be at least 0");
        return -1;
      }

      const isEdit = Boolean(this.id);
      const itemName = productNameInput.value.trim();
      const ok = await confirmAction({
        title: isEdit ? "Save item changes?" : "Add this item?",
        message: isEdit
          ? `Update "${itemName}" with the details you entered?`
          : `Add "${itemName}" to inventory?`,
        confirmLabel: isEdit ? "Save changes" : "Add item",
      });
      if (!ok) return -1;

      // Updating Local Storage
      const isSaved = await Storage.saveItem({
        id: this.id,
        title: itemName,
        size: itemSizeInput.value.trim(),
        category: "",
        quantity: Number(productQuantityInput.value),
        price: Number(productPriceInput.value),
        monthlyDemand: Number(productDemandInput.value),
      });
      if (!isSaved) {
        alert("Failed to save item. Please check database/server and try again.");
        return -1;
      }

      this.id = 0;

      if (searchBar) searchBar.value = "";

      // Updating the DOM
      this.filteredItems = this.getFilteredItems(Storage.getItems());
      this.renderTable();
      // Closing the modal
      this.closeProductModal();
    } finally {
      this.isSubmitting = false;
    }
  }

  async deleteBtnLogic(id) {
    const item = Storage.getItems().find((i) => i.id == id);
    const itemName = item?.title || "this item";
    const ok = await confirmAction({
      title: "Delete item?",
      message: `Permanently delete "${itemName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    await Storage.deleteItem(id);
    if (searchBar) searchBar.value = "";

    this.filteredItems = this.getFilteredItems(Storage.getItems());
    this.renderTable();
  }

  editBtnLogic(id) {
    this.id = id;
    const allItems = Storage.getItems();
    const selectedItem = allItems.find((item) => item.id == id);

    this.openProductModal();

    ModalTitle.textContent = "Edit Item"; // Upating Modal title
    ProModalAddBtn.textContent = "Submit Edit";

    productNameInput.value = selectedItem.title;
    itemSizeInput.value = selectedItem.size || '';
    productQuantityInput.value = selectedItem.quantity;
    productPriceInput.value = selectedItem.price;
    productDemandInput.value = selectedItem.monthlyDemand || 0;
  }

  seachLogic(inputValue) {
    const targetValue = inputValue.toLowerCase().trim();
    const allItems = Storage.getItems();
    const searchedItems = targetValue
      ? allItems.filter((item) =>
          item.title.toLowerCase().trim().includes(targetValue) ||
          (item.itemCode && item.itemCode.toLowerCase().trim().includes(targetValue))
        )
      : allItems;
    this.filteredItems = this.getFilteredItems(searchedItems);
    this.pagination.reset();
    this.renderTable();
  }
}

export default new InventoryUi();
