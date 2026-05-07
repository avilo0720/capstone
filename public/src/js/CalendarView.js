class CalendarView {
  constructor() {
    this.currentMonth = new Date().getMonth(); // 0-indexed
    this.currentYear = new Date().getFullYear();
    this.transactions = [];
    this.monthSelect = null;
    this.yearSelect = null;
    this.grid = null;
    this.overlay = null;
  }

  setApp() {
    this.monthSelect = document.getElementById("calMonthSelect");
    this.yearSelect = document.getElementById("calYearSelect");
    this.grid = document.getElementById("calendarGrid");
    this.overlay = document.getElementById("dailyOverlayModal");

    if (!this.grid) return;

    this.buildDropdowns();
    this.bindEvents();
    this.loadMonth();
  }

  buildDropdowns() {
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    // Populate month select
    this.monthSelect.innerHTML = monthNames
      .map((name, i) => `<option value="${i}" ${i === this.currentMonth ? "selected" : ""}>${name}</option>`)
      .join("");

    // Populate year select (5 years back, 2 years forward)
    const startYear = this.currentYear - 5;
    const endYear = this.currentYear + 2;
    let yearOptions = "";
    for (let y = startYear; y <= endYear; y++) {
      yearOptions += `<option value="${y}" ${y === this.currentYear ? "selected" : ""}>${y}</option>`;
    }
    this.yearSelect.innerHTML = yearOptions;
  }

  bindEvents() {
    this.monthSelect.addEventListener("change", () => {
      this.currentMonth = Number(this.monthSelect.value);
      this.loadMonth();
    });
    this.yearSelect.addEventListener("change", () => {
      this.currentYear = Number(this.yearSelect.value);
      this.loadMonth();
    });

    // Daily overview modal close
    const closeBtn = document.getElementById("dailyOverviewClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeDailyModal());
    }
    if (this.overlay) {
      this.overlay.addEventListener("click", (e) => {
        if (e.target === this.overlay) this.closeDailyModal();
      });
    }
  }

  async loadMonth() {
    try {
      const res = await fetch(`/api/transactions?month=${this.currentMonth + 1}&year=${this.currentYear}`);
      if (res.ok) {
        this.transactions = await res.json();
      } else {
        this.transactions = [];
      }
    } catch (e) {
      console.error("Failed to fetch transactions:", e);
      this.transactions = [];
    }
    this.renderGrid();
  }

  renderGrid() {
    // Calculate first day and total days
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const totalBlocks = 42; // fixed 6 rows × 7 columns

    // Group transactions by day
    const txByDay = {};
    this.transactions.forEach((tx) => {
      const d = new Date(tx.transactionDate);
      const day = d.getDate();
      if (!txByDay[day]) txByDay[day] = [];
      txByDay[day].push(tx);
    });

    let html = "";
    const today = new Date();
    const isCurrentMonth = today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;

    for (let i = 0; i < totalBlocks; i++) {
      const dayNum = i - firstDay + 1;
      const isValid = dayNum >= 1 && dayNum <= daysInMonth;
      const isToday = isValid && isCurrentMonth && dayNum === today.getDate();
      const dayClass = isValid ? "calendar-day" : "calendar-day --empty";
      const todayClass = isToday ? " --today" : "";

      if (!isValid) {
        html += `<div class="${dayClass}${todayClass}"></div>`;
        continue;
      }

      const dayTx = txByDay[dayNum] || [];
      const addedCount = dayTx.filter(t => t.action === "add").reduce((s, t) => s + (Number(t.quantity) || 0), 0);
      const usedCount = dayTx.filter(t => t.action === "use").reduce((s, t) => s + (Number(t.quantity) || 0), 0);

      let badges = "";
      if (addedCount > 0) {
        badges += `<span class="cal-badge --add">+${addedCount}</span>`;
      }
      if (usedCount > 0) {
        badges += `<span class="cal-badge --use">-${usedCount}</span>`;
      }

      html += `
        <div class="${dayClass}${todayClass}" data-day="${dayNum}">
          <span class="calendar-day__num">${dayNum}</span>
          <div class="calendar-day__badges">${badges}</div>
        </div>`;
    }

    this.grid.innerHTML = html;

    // Bind day click events
    this.grid.querySelectorAll(".calendar-day:not(.--empty)").forEach((cell) => {
      cell.addEventListener("click", () => {
        const day = Number(cell.dataset.day);
        if (day) this.openDailyModal(day);
      });
    });
  }

  openDailyModal(day) {
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    const title = document.getElementById("dailyOverviewTitle");
    const totalAddedEl = document.getElementById("dailyTotalAdded");
    const totalUsedEl = document.getElementById("dailyTotalUsed");
    const listEl = document.getElementById("dailyTransactionList");

    title.textContent = `${monthNames[this.currentMonth]} ${day}, ${this.currentYear}`;

    // Filter transactions for this day
    const dayTx = this.transactions.filter((tx) => {
      const d = new Date(tx.transactionDate);
      return d.getDate() === day;
    });

    const totalAdded = dayTx.filter(t => t.action === "add").reduce((s, t) => s + (Number(t.quantity) || 0), 0);
    const totalUsed = dayTx.filter(t => t.action === "use").reduce((s, t) => s + (Number(t.quantity) || 0), 0);

    totalAddedEl.textContent = totalAdded;
    totalUsedEl.textContent = totalUsed;

    if (dayTx.length === 0) {
      listEl.innerHTML = `
        <div class="daily-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No transactions on this day.</p>
        </div>`;
    } else {
      let listHtml = "";
      dayTx.forEach((tx) => {
        const time = new Date(tx.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const actionClass = tx.action === "add" ? "--add" : "--use";
        const actionLabel = tx.action === "add" ? "Added" : "Used";
        const itemCode = tx.itemCode ? `#${String(tx.itemCode).replace(/^item[-_\s]*/i, "")}` : "";

        listHtml += `
          <div class="daily-tx-item ${actionClass}">
            <div class="daily-tx-item__indicator"></div>
            <div class="daily-tx-item__info">
              <p class="daily-tx-item__name">${tx.itemTitle || "Unknown Item"} <span class="daily-tx-item__code">${itemCode}</span></p>
              <p class="daily-tx-item__meta">${actionLabel} <strong>${tx.quantity}</strong> unit${tx.quantity !== 1 ? 's' : ''} · ${time}</p>
            </div>
          </div>`;
      });
      listEl.innerHTML = listHtml;
    }

    this.overlay.classList.remove("--hidden");
  }

  closeDailyModal() {
    this.overlay.classList.add("--hidden");
  }
}

export default new CalendarView();
