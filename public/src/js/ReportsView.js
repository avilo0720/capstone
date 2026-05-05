class ReportsView {
  constructor() {
    this.summaryData = null;
  }

  async setApp() {
    await this.loadSummary();
    this.bindEvents();
  }

  async loadSummary() {
    try {
      const res = await fetch('/api/reports/summary');
      if (!res.ok) throw new Error('Failed to load summary');
      this.summaryData = await res.json();
      this.renderSummary();
      this.renderAlerts();
    } catch (e) {
      console.error('Failed to load report summary:', e);
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
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(from + (target - from) * eased);
      el.textContent = `${prefix}${current.toLocaleString()}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  renderAlerts() {
    const body = document.getElementById('reportsAlertsBody');
    if (!body || !this.summaryData) return;

    const items = this.summaryData.lowStockItems || [];

    if (items.length === 0) {
      body.innerHTML = `
        <div class="reports-alerts__empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#12b76a" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>All stock levels are sufficient. No alerts at this time.</p>
        </div>`;
      return;
    }

    // Sort by urgency: critical > high > medium
    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    items.sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3));

    let html = `
      <table class="reports-alerts__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Current Stock</th>
            <th>Reorder Point</th>
            <th>Min Stock Level</th>
            <th>Deficit</th>
            <th>Restock Cost</th>
            <th>FSN</th>
            <th>Urgency</th>
          </tr>
        </thead>
        <tbody>`;

    items.forEach((item) => {
      const urgencyClass = `reports-urgency--${item.urgency}`;
      html += `
          <tr>
            <td class="reports-alerts__item-name">${item.title}</td>
            <td>${item.currentStock}</td>
            <td>${item.reorderPoint}</td>
            <td>${item.minimumStockLevel}</td>
            <td>${item.deficit}</td>
            <td>₱${Number(item.restockCost).toLocaleString()}</td>
            <td><span class="reports-fsn-badge">${item.fsn}</span></td>
            <td><span class="reports-urgency-badge ${urgencyClass}">${item.urgency.toUpperCase()}</span></td>
          </tr>`;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
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

    // Close download menu when clicking outside
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
