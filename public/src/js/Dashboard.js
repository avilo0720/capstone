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
    const extraMetrics = this.calculateAdvancedCostMetrics();

    if (qtyElem) qtyElem.textContent = this.calculateItems();
    if (totalQtyElem) totalQtyElem.textContent = this.calculateQuantity();
    if (salesElem) salesElem.textContent = `₱${this.calculatePrice()}`;
    if (catElem) catElem.textContent = this.totalCategories();
    if (subtotalTotalCostElem) subtotalTotalCostElem.textContent = `₱${extraMetrics.subtotalTotalCost.toLocaleString()}`;
    if (subtotalRestockCostElem) subtotalRestockCostElem.textContent = `₱${extraMetrics.subtotalRestockCost.toLocaleString()}`;
    if (restockPerLeadTimeElem) restockPerLeadTimeElem.textContent = `₱${extraMetrics.restockPerLeadTime.toLocaleString()}`;
    if (halfRestockCostElem) halfRestockCostElem.textContent = `₱${extraMetrics.halfRestockCost.toLocaleString()}`;

    // Show low-stock alerts
    this.renderLowStockAlerts();
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

  // Calculate the Quantity
  calculateQuantity() {
    const allItems = Storage.getItems();
    return allItems
      .reduce((acc, item) => acc + item.quantity, 0)
      .toLocaleString();
  }

  // Calculate the Price
  calculatePrice() {
    const allItems = Storage.getItems();
    const totalPrice = allItems.reduce(
      (acc, item) => acc + (Number(item.price) * Number(item.quantity)),
      0
    );
    return totalPrice.toLocaleString();
  }

  // Calculate total categories
  totalCategories() {
    const allCategories = Storage.getCategories();
    const total = allCategories.length;
    return total.toLocaleString();
  }

  // Calculate total Items
  calculateItems() {
    const allItems = Storage.getItems();
    return allItems.length.toLocaleString();
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

  calculateAdvancedCostMetrics() {
    const allItems = Storage.getItems();
    const totalDemand = allItems.reduce(
      (acc, item) => acc + (Number(item.monthlyDemand) || 0),
      0
    );
    const procurementLeadTimeMonths = 3.5;

    let cumulativeDemand = 0;
    let subtotalTotalCost = 0;
    let subtotalRestockCost = 0;

    allItems.forEach((item) => {
      const amc = Number(item.monthlyDemand) || 0;
      const stock = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;

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
      }
    });

    const restockPerLeadTime = subtotalRestockCost / procurementLeadTimeMonths;
    const halfRestockCost = subtotalRestockCost / 2;

    return {
      subtotalTotalCost: Number(subtotalTotalCost.toFixed(2)),
      subtotalRestockCost: Number(subtotalRestockCost.toFixed(2)),
      restockPerLeadTime: Number(restockPerLeadTime.toFixed(2)),
      halfRestockCost: Number(halfRestockCost.toFixed(2)),
    };
  }
}

export default new DashboardUi();
