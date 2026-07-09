import Storage from "./API.js";
import Pagination from "./Pagination.js";

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
let downloadMenu;
let downloadDropdown;

// Selecting the inputs in the add Product Modal
let productNameInput;
let itemSizeInput;
let productQuantityInput;
let productPriceInput;
let productDemandInput;

// --------------------- SearchBar --------------------------------
let searchBar;

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
    downloadMenu = document.querySelector(".downloadMenu");
    downloadDropdown = document.querySelector(".downloadDropdown");
    productNameInput = document.querySelector(".productNameInput");
    itemSizeInput = document.querySelector(".itemSizeInput");
    productQuantityInput = document.querySelector(".productQuantityInput");
    productPriceInput = document.querySelector(".productPriceInput");
    productDemandInput = document.querySelector(".productDemandInput");
    searchBar = document.querySelector(".searchBarInput");
    // Ensure table starts in fit-to-screen mode.
    localStorage.removeItem(this.columnWidthStorageKey);
    this.loadColumnWidths();
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
      filterToggleBtn.addEventListener("click", () => {
        filterPanel.classList.toggle("--hidden");
      });
      filterPanel.addEventListener("click", (e) => {
        const btn = e.target.closest(".filterOptionBtn");
        if (!btn) return;

        const group = btn.dataset.group;
        const value = btn.dataset.value;
        if (group === "fsn") {
          this.selectedFsnFilter = this.selectedFsnFilter === value ? "" : value;
        }
        if (group === "trigger") {
          this.selectedTriggerFilter = this.selectedTriggerFilter === value ? "" : value;
        }

        this.applyFilterUI();
        this.filteredItems = this.getFilteredItems(Storage.getItems());
        this.pagination.reset();
        this.renderTable();
      });
    }

    if (downloadToggleBtn && downloadMenu) {
      downloadToggleBtn.addEventListener("click", () => {
        downloadMenu.classList.toggle("--hidden");
      });
      downloadMenu.addEventListener("click", async (e) => {
        const option = e.target.closest(".downloadOptionBtn");
        if (!option) return;
        const format = option.dataset.format;
        await this.exportVisibleTable(format);
        downloadMenu.classList.add("--hidden");
      });
    }
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

  updateDom(allRowMetrics) {
    const page = this.pagination.getSlice(allRowMetrics);

    let result = `
    <tr class="table__title">
        <td>No</td>
        <td>Item Description</td>
        <td>Size</td>
        <td>Current Stock</td>
        <td>AMC</td>
        <td>FSN</td>
        <td>Trigger Point</td>
        <td></td>
    </tr>    
    `;

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

    // Selecting the delete and edit Icon
    const deleteBtns = document.querySelectorAll(".deleteIcon");
    deleteBtns.forEach((deleteBtn) =>
      deleteBtn.addEventListener("click", (e) => {
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

    const viewBtns = document.querySelectorAll(".viewIcon");
    viewBtns.forEach((viewBtn) =>
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(e.currentTarget.dataset.id);
        this.openViewModal(id);
      })
    );

    // Bind inline stock buttons
    const stockBtns = document.querySelectorAll(".inline-stock__btn");
    stockBtns.forEach((btn) =>
      btn.addEventListener("click", async (e) => {
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
    let actionsHtml;
    if (this.isStockMode && this.canEdit) {
      actionsHtml = `
        <td class="stockTableSection">
          <div class="inline-stock">
            <button type="button" class="inline-stock__btn --minus" data-id="${row.item.id}" data-action="use">−</button>
            <input type="number" class="inline-stock__input" data-id="${row.item.id}" value="1" min="1" />
            <button type="button" class="inline-stock__btn --plus" data-id="${row.item.id}" data-action="add">+</button>
          </div>
        </td>`;
    } else if (this.canEdit) {
      actionsHtml = `
        <td class="editTableSection">
            <div class="table__icons">
            <button type="button" class="viewIcon" data-id="${row.item.id}" title="View details">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <div class="editIcon" data-id=${row.item.id}>
                <svg class="icon">
                <use
                    xlink:href="../assets/images/sprite.svg#editIcon"
                ></use>
                </svg>
            </div>
            <div class="deleteIcon" data-id=${row.item.id}>
                <img src="../assets/images/deleteIcon.svg" alt="deleteIcon" />
            </div>
            </div>
        </td>`;
    } else {
      actionsHtml = `
        <td class="editTableSection">
          <button type="button" class="viewIcon" data-id="${row.item.id}" title="View details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </td>`;
    }

    return `
     <tr>
        <td>${this.formatItemCode(row.item.itemCode)}</td>
        <td>${row.item.title}</td>
        <td>${row.item.size || '---'}</td>
        <td>${row.currentStock}</td>
        <td>${row.amc}</td>
        <td>${row.fsn}</td>
        <td><span class="${row.triggerClass}">${row.triggerPoint}</span></td>
        ${actionsHtml}
    </tr>

    `;
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

  applyEditModeUI() {
    if (this.inventoryRoot) {
      this.inventoryRoot.classList.toggle("--editMode", this.isEditMode);
    }
    if (editToggleBtn) {
      editToggleBtn.textContent = "Edit";
      editToggleBtn.classList.toggle("--active", this.isEditMode);
    }
  }

  applyStockModeUI() {
    if (this.inventoryRoot) {
      this.inventoryRoot.classList.toggle("--stockMode", this.isStockMode);
    }
    if (stockToggleBtn) {
      stockToggleBtn.classList.toggle("--active", this.isStockMode);
    }
  }

  async handleStockAdjustment(itemId, action, quantity) {
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
      // Update local cache
      const item = Storage.getItems().find(i => i.id == itemId);
      if (item) {
        item.quantity = data.newQuantity;
      }
      this.filteredItems = this.getFilteredItems(Storage.getItems());
      this.renderTable();
    } catch (e) {
      console.error('Stock adjustment error:', e);
      alert('Failed to update stock. Please try again.');
    }
  }

  applyFilterUI() {
    if (!filterPanel) return;
    const optionBtns = filterPanel.querySelectorAll(".filterOptionBtn");
    optionBtns.forEach((btn) => {
      const group = btn.dataset.group;
      const value = btn.dataset.value;
      const isActive =
        (group === "fsn" && value === this.selectedFsnFilter) ||
        (group === "trigger" && value === this.selectedTriggerFilter);
      btn.classList.toggle("--active", isActive);
    });
    if (filterToggleBtn) {
      filterToggleBtn.classList.toggle(
        "--active",
        Boolean(this.selectedFsnFilter || this.selectedTriggerFilter)
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
    const fullHeaders = [
      "No", "Item Description", "Size", "Current Stock", "AMC", "Cumulative", "%",
      "FSN", "LTD", "Lead Time (Months)", "SS", "ROP", "MSL", "Unit Cost", "Total Cost", "Trigger Point"
    ];
    const rows = this.filteredItems.map((row) => [
      this.formatItemCode(row.item.itemCode),
      row.item.title,
      row.item.size || "---",
      String(row.currentStock),
      String(row.amc),
      String(row.cumulativeDemand),
      `${(row.cumulativePercent * 100).toFixed(2)}%`,
      row.fsn,
      String(row.roundedLeadTimeDemand),
      String(row.procurementLeadTimeMonths),
      String(row.roundedSafetyStock),
      String(row.reorderingPoint),
      String(row.displayedMinimumStockLevel),
      `₱${(Number(row.item.price) || 0).toFixed(2)}`,
      `₱${row.totalCost.toFixed(2)}`,
      row.triggerPoint,
    ]);
    return { headers: fullHeaders, rows };
  }

  async exportVisibleTable(format) {
    const tableData = this.getVisibleTableData();
    if (!tableData.headers.length) {
      alert("Nothing to export.");
      return;
    }

    const endpoint =
      format === "pdf" ? "/api/export/inventory/pdf" : "/api/export/inventory/excel";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tableData),
    });
    if (!response.ok) {
      alert("Export failed. Please try again.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `inventory-${stamp}.${format === "pdf" ? "pdf" : "xlsx"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

      // Updating Local Storage
      const isSaved = await Storage.saveItem({
        id: this.id,
        title: productNameInput.value.trim(),
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

  deleteBtnLogic(id) {
    // Deleting the Item
    Storage.deleteItem(id);
    // Update the DOM
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
