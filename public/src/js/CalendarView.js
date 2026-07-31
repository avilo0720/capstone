import Pagination from "./Pagination.js";
import confirmAction from "./ConfirmDialog.js";

const NOTE_COLORS = [
  { key: "blue", label: "Blue" },
  { key: "green", label: "Green" },
  { key: "amber", label: "Amber" },
  { key: "red", label: "Red" },
  { key: "purple", label: "Purple" },
  { key: "teal", label: "Teal" },
  { key: "pink", label: "Pink" },
  { key: "slate", label: "Slate" },
];

class CalendarView {
  constructor() {
    this.currentMonth = new Date().getMonth(); // 0-indexed
    this.currentYear = new Date().getFullYear();
    this.transactions = [];
    this.notes = [];
    this.dayTransactions = [];
    this.dayNotes = [];
    this.selectedDay = null;
    this.activeDailyTab = "transactions";
    this.options = { departments: [], users: [], colors: NOTE_COLORS.map((c) => c.key) };
    this.monthSelect = null;
    this.yearSelect = null;
    this.grid = null;
    this.overlay = null;
    this.noteOverlay = null;
    this.pagination = null;
  }

  setApp() {
    this.monthSelect = document.getElementById("calMonthSelect");
    this.yearSelect = document.getElementById("calYearSelect");
    this.grid = document.getElementById("calendarGrid");
    this.overlay = document.getElementById("dailyOverlayModal");
    this.noteOverlay = document.getElementById("noteModalOverlay");
    this.pagination = new Pagination({
      pageSize: 8,
      onPageChange: () => this.renderDayTransactions(),
    });
    this.pagination.setContainer(document.getElementById("calendarPagination"));

    if (!this.grid) return;

    this.applyDateQueryParam();
    this.buildDropdowns();
    this.buildColorPicker();
    this.bindEvents();
    this.loadOptions();
    this.loadMonth().then(() => this.openDateFromQuery());
  }

  applyDateQueryParam() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("date");
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;

    const [year, month, day] = raw.split("-").map(Number);
    const probe = new Date(year, month - 1, day);
    if (
      probe.getFullYear() !== year ||
      probe.getMonth() !== month - 1 ||
      probe.getDate() !== day
    ) {
      return;
    }

    this.currentYear = year;
    this.currentMonth = month - 1;
    this.pendingOpenDay = day;
  }

  openDateFromQuery() {
    if (!this.pendingOpenDay) return;
    const day = this.pendingOpenDay;
    this.pendingOpenDay = null;
    this.openDailyModal(day, { preferNotesTab: true });

    // Clean the query so refreshes/bookmarks stay on the month view.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("date");
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch {
      /* ignore */
    }
  }

  buildDropdowns() {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    this.monthSelect.innerHTML = monthNames
      .map((name, i) => `<option value="${i}" ${i === this.currentMonth ? "selected" : ""}>${name}</option>`)
      .join("");

    this.yearSelect.value = String(this.currentYear);
  }

  buildColorPicker() {
    const picker = document.getElementById("noteColorPicker");
    if (!picker) return;

    picker.innerHTML = NOTE_COLORS.map((color) => `
      <button
        type="button"
        class="cal-note-color ${color.key === "blue" ? "--selected" : ""}"
        data-color="${color.key}"
        title="${color.label}"
        aria-label="${color.label}"
      ></button>
    `).join("");
  }

  setYear(year) {
    const next = Number.parseInt(year, 10);
    if (Number.isNaN(next)) {
      this.yearSelect.value = String(this.currentYear);
      return;
    }
    this.currentYear = next;
    this.yearSelect.value = String(this.currentYear);
    this.loadMonth();
  }

  bindEvents() {
    this.monthSelect.addEventListener("change", () => {
      this.currentMonth = Number(this.monthSelect.value);
      this.loadMonth();
    });

    const commitYear = () => this.setYear(this.yearSelect.value);

    this.yearSelect.addEventListener("change", commitYear);
    this.yearSelect.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitYear();
        this.yearSelect.blur();
      }
    });

    const yearPrev = document.getElementById("calYearPrev");
    const yearNext = document.getElementById("calYearNext");
    if (yearPrev) yearPrev.addEventListener("click", () => this.setYear(this.currentYear - 1));
    if (yearNext) yearNext.addEventListener("click", () => this.setYear(this.currentYear + 1));

    const closeBtn = document.getElementById("dailyOverviewClose");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeDailyModal());
    if (this.overlay) {
      this.overlay.addEventListener("click", (e) => {
        if (e.target === this.overlay) this.closeDailyModal();
      });
    }

    document.querySelectorAll("[data-daily-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.setDailyTab(tab.dataset.dailyTab);
      });
    });

    const addNoteBtn = document.getElementById("calAddNoteBtn");
    if (addNoteBtn) {
      addNoteBtn.addEventListener("click", () => this.openNoteModal());
    }

    if (this.grid) {
      this.grid.addEventListener("click", (e) => {
        const addBtn = e.target.closest("[data-add-note-day]");
        if (!addBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const day = Number(addBtn.dataset.addNoteDay);
        if (!day) return;
        const date = this.formatDate(this.currentYear, this.currentMonth, day);
        this.openNoteModal({ note_date: date, end_date: date });
      });
    }

    const noteClose = document.getElementById("noteModalClose");
    const noteCancel = document.getElementById("noteCancelBtn");
    if (noteClose) noteClose.addEventListener("click", () => this.closeNoteModal());
    if (noteCancel) noteCancel.addEventListener("click", () => this.closeNoteModal());
    if (this.noteOverlay) {
      this.noteOverlay.addEventListener("click", (e) => {
        if (e.target === this.noteOverlay) this.closeNoteModal();
      });
    }

    const colorPicker = document.getElementById("noteColorPicker");
    if (colorPicker) {
      colorPicker.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-color]");
        if (!btn) return;
        this.setSelectedColor(btn.dataset.color);
      });
    }

    document.querySelectorAll('input[name="noteVisibility"]').forEach((radio) => {
      radio.addEventListener("change", () => this.updateVisibilityPanels());
    });

    const deptSearch = document.getElementById("noteDeptSearch");
    const userSearch = document.getElementById("noteUserSearch");
    if (deptSearch) {
      deptSearch.addEventListener("input", () => this.filterShareList("noteDepartmentList", deptSearch.value));
    }
    if (userSearch) {
      userSearch.addEventListener("input", () => this.filterShareList("noteUserList", userSearch.value));
    }

    const noteStart = document.getElementById("noteDate");
    const noteEnd = document.getElementById("noteEndDate");
    if (noteStart && noteEnd) {
      noteStart.addEventListener("change", () => {
        if (!noteEnd.value || noteEnd.value < noteStart.value) {
          noteEnd.value = noteStart.value;
        }
        noteEnd.min = noteStart.value;
      });
    }

    const noteForm = document.getElementById("noteForm");
    if (noteForm) {
      noteForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveNote();
      });
    }

    const deleteBtn = document.getElementById("noteDeleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => this.deleteNote());
    }

    const notesList = document.getElementById("dailyNotesList");
    if (notesList) {
      notesList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-edit-note]");
        if (!btn) return;
        const note = this.notes.find((n) => String(n.id) === String(btn.dataset.editNote));
        if (note) this.openNoteModal(note);
      });
    }
  }

  async loadOptions() {
    try {
      const res = await fetch("/api/calendar-notes/options");
      if (!res.ok) return;
      this.options = await res.json();
      this.renderShareLists();
    } catch (e) {
      console.error("Failed to load note options:", e);
    }
  }

  renderShareLists() {
    const deptList = document.getElementById("noteDepartmentList");
    const userList = document.getElementById("noteUserList");

    if (deptList) {
      deptList.innerHTML = (this.options.departments || []).map((dept) => `
        <label class="cal-note-check" data-search="${this.escapeHtml(String(dept.name).toLowerCase())}">
          <input type="checkbox" name="noteDepartments" value="${dept.id}" />
          <span>${this.escapeHtml(dept.name)}</span>
        </label>
      `).join("") || `<p class="cal-note-share__empty">No departments available.</p>`;
    }

    if (userList) {
      userList.innerHTML = (this.options.users || []).map((user) => {
        const haystack = [
          user.full_name,
          user.username,
          user.department_name || "",
        ].join(" ").toLowerCase();

        return `
          <label class="cal-note-check" data-search="${this.escapeHtml(haystack)}">
            <input type="checkbox" name="noteUsers" value="${user.id}" />
            <span>
              ${this.escapeHtml(user.full_name)}
              <small>@${this.escapeHtml(user.username)}${user.department_name ? ` · ${this.escapeHtml(user.department_name)}` : ""}</small>
            </span>
          </label>`;
      }).join("") || `<p class="cal-note-share__empty">No users available.</p>`;
    }
  }

  filterShareList(listId, query) {
    const list = document.getElementById(listId);
    if (!list) return;

    const q = String(query || "").trim().toLowerCase();
    let visible = 0;

    list.querySelectorAll(".cal-note-check").forEach((row) => {
      const match = !q || (row.dataset.search || "").includes(q);
      row.classList.toggle("--hidden", !match);
      if (match) visible += 1;
    });

    let empty = list.querySelector(".cal-note-share__empty--filter");
    if (!visible && q) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "cal-note-share__empty cal-note-share__empty--filter";
        list.appendChild(empty);
      }
      empty.textContent = "No matches found.";
      empty.classList.remove("--hidden");
    } else if (empty) {
      empty.classList.add("--hidden");
    }
  }

  async loadMonth() {
    try {
      const [txRes, notesRes] = await Promise.all([
        fetch(`/api/transactions?month=${this.currentMonth + 1}&year=${this.currentYear}`),
        fetch(`/api/calendar-notes?month=${this.currentMonth + 1}&year=${this.currentYear}`),
      ]);

      this.transactions = txRes.ok ? await txRes.json() : [];
      this.notes = notesRes.ok ? await notesRes.json() : [];
    } catch (e) {
      console.error("Failed to fetch calendar data:", e);
      this.transactions = [];
      this.notes = [];
    }
    this.renderGrid();

    if (this.selectedDay && this.overlay && !this.overlay.classList.contains("--hidden")) {
      this.openDailyModal(this.selectedDay, { keepTab: true });
    }
  }

  renderGrid() {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const totalBlocks = 42;

    const txByDay = {};
    this.transactions.forEach((tx) => {
      const d = new Date(tx.transactionDate);
      const day = d.getDate();
      if (!txByDay[day]) txByDay[day] = [];
      txByDay[day].push(tx);
    });

    const notesByDay = {};
    this.notes.forEach((note) => {
      this.eachDayInNoteRange(note, (dateKey) => {
        const [y, m, d] = dateKey.split("-").map(Number);
        if (y !== this.currentYear || m !== this.currentMonth + 1) return;
        if (!notesByDay[d]) notesByDay[d] = [];
        notesByDay[d].push(note);
      });
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
      const dayNotes = notesByDay[dayNum] || [];
      const addedCount = dayTx.filter((t) => t.action === "add").reduce((s, t) => s + (Number(t.quantity) || 0), 0);
      const usedCount = dayTx.filter((t) => t.action === "use").reduce((s, t) => s + (Number(t.quantity) || 0), 0);

      let badges = "";
      if (addedCount > 0) badges += `<span class="cal-badge --add">+${addedCount}</span>`;
      if (usedCount > 0) badges += `<span class="cal-badge --use">-${usedCount}</span>`;

      const maxVisibleNotes = 2;
      const noteTitles = dayNotes.slice(0, maxVisibleNotes).map((note) =>
        `<span class="cal-note-chip --${this.escapeHtml(note.color)}" title="${this.escapeHtml(note.title)}">${this.escapeHtml(note.title)}</span>`
      ).join("");
      const extraNotes = dayNotes.length > maxVisibleNotes
        ? `<span class="cal-note-more">+${dayNotes.length - maxVisibleNotes} more</span>`
        : "";

      html += `
        <div class="${dayClass}${todayClass}" data-day="${dayNum}">
          <div class="calendar-day__top">
            <span class="calendar-day__num">${dayNum}</span>
            <button
              type="button"
              class="calendar-day__add-note"
              data-add-note-day="${dayNum}"
              title="Add note"
              aria-label="Add note on day ${dayNum}"
            >+</button>
          </div>
          ${dayNotes.length ? `<div class="calendar-day__notes">${noteTitles}${extraNotes}</div>` : ""}
          <div class="calendar-day__badges">${badges}</div>
        </div>`;
    }

    this.grid.innerHTML = html;

    this.grid.querySelectorAll(".calendar-day:not(.--empty)").forEach((cell) => {
      cell.addEventListener("click", (e) => {
        if (e.target.closest("[data-add-note-day]")) return;
        const day = Number(cell.dataset.day);
        if (day) this.openDailyModal(day);
      });
    });
  }

  openDailyModal(day, { keepTab = false, preferNotesTab = false } = {}) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    this.selectedDay = day;

    const title = document.getElementById("dailyOverviewTitle");
    const totalAddedEl = document.getElementById("dailyTotalAdded");
    const totalUsedEl = document.getElementById("dailyTotalUsed");
    const notesCountEl = document.getElementById("dailyNotesCount");

    title.textContent = `${monthNames[this.currentMonth]} ${day}, ${this.currentYear}`;

    const dayTx = this.transactions.filter((tx) => {
      const d = new Date(tx.transactionDate);
      return d.getDate() === day;
    });

    const dateKey = this.formatDate(this.currentYear, this.currentMonth, day);
    this.dayNotes = this.notes.filter((note) => this.noteCoversDate(note, dateKey));

    const totalAdded = dayTx.filter((t) => t.action === "add").reduce((s, t) => s + (Number(t.quantity) || 0), 0);
    const totalUsed = dayTx.filter((t) => t.action === "use").reduce((s, t) => s + (Number(t.quantity) || 0), 0);

    this.dayTransactions = dayTx;
    totalAddedEl.textContent = totalAdded;
    totalUsedEl.textContent = totalUsed;
    if (notesCountEl) notesCountEl.textContent = String(this.dayNotes.length);

    this.pagination.reset();
    this.renderDayTransactions();
    this.renderDayNotes();

    if (!keepTab) {
      if (preferNotesTab) {
        this.setDailyTab("notes");
      } else {
        this.setDailyTab(this.dayNotes.length && !dayTx.length ? "notes" : "transactions");
      }
    } else {
      this.setDailyTab(this.activeDailyTab);
    }

    this.overlay.classList.remove("--hidden");
  }

  setDailyTab(tab) {
    this.activeDailyTab = tab === "notes" ? "notes" : "transactions";

    document.querySelectorAll("[data-daily-tab]").forEach((btn) => {
      btn.classList.toggle("--active", btn.dataset.dailyTab === this.activeDailyTab);
    });

    const txPanel = document.getElementById("dailyTransactionsPanel");
    const notesPanel = document.getElementById("dailyNotesPanel");
    if (txPanel) txPanel.classList.toggle("--hidden", this.activeDailyTab !== "transactions");
    if (notesPanel) notesPanel.classList.toggle("--hidden", this.activeDailyTab !== "notes");
  }

  renderDayTransactions() {
    const listEl = document.getElementById("dailyTransactionList");
    if (!listEl) return;

    if (this.dayTransactions.length === 0) {
      listEl.innerHTML = `
        <div class="daily-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No transactions on this day.</p>
        </div>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    const page = this.pagination.getSlice(this.dayTransactions);
    let listHtml = "";

    page.items.forEach((tx) => {
      const time = new Date(tx.transactionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const actionClass = tx.action === "add" ? "--add" : "--use";
      const actionLabel = tx.action === "add" ? "Added" : "Used";
      const itemCode = tx.itemCode ? `#${String(tx.itemCode).replace(/^item[-_\s]*/i, "")}` : "";

      listHtml += `
        <div class="daily-tx-item ${actionClass}">
          <div class="daily-tx-item__indicator"></div>
          <div class="daily-tx-item__info">
            <p class="daily-tx-item__name">${this.escapeHtml(tx.itemTitle || "Unknown Item")} <span class="daily-tx-item__code">${this.escapeHtml(itemCode)}</span></p>
            <p class="daily-tx-item__meta">${actionLabel} <strong>${tx.quantity}</strong> unit${tx.quantity !== 1 ? "s" : ""} · ${time}</p>
          </div>
        </div>`;
    });

    listEl.innerHTML = listHtml;
    this.pagination.renderControls(page);
  }

  renderDayNotes() {
    const listEl = document.getElementById("dailyNotesList");
    if (!listEl) return;

    if (!this.dayNotes.length) {
      listEl.innerHTML = `
        <div class="daily-empty">
          <p>No notes on this day.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = this.dayNotes.map((note) => {
      const start = note.note_date;
      const end = note.end_date || note.note_date;
      const rangeLabel = start && end && start !== end ? `${start} → ${end}` : start;

      return `
        <div class="daily-note-item --${this.escapeHtml(note.color)}">
          <div class="daily-note-item__bar"></div>
          <div class="daily-note-item__body">
            <div class="daily-note-item__top">
              <p class="daily-note-item__title">${this.escapeHtml(note.title)}</p>
              ${note.can_edit ? `<button type="button" class="daily-note-item__edit" data-edit-note="${note.id}">Edit</button>` : ""}
            </div>
            ${note.body ? `<p class="daily-note-item__text">${this.escapeHtml(note.body)}</p>` : ""}
            <p class="daily-note-item__meta">
              ${this.escapeHtml(note.creator?.full_name || "Unknown")}
              · ${this.escapeHtml(rangeLabel || "")}
            </p>
          </div>
        </div>`;
    }).join("");
  }

  closeDailyModal() {
    this.overlay.classList.add("--hidden");
  }

  openNoteModal(note = null) {
    const form = document.getElementById("noteForm");
    const titleEl = document.getElementById("noteModalTitle");
    const deleteBtn = document.getElementById("noteDeleteBtn");
    if (!form || !this.noteOverlay) return;

    form.reset();
    const startDate = note?.note_date || this.todayIso();
    const endDate = note?.end_date || note?.note_date || startDate;

    document.getElementById("noteId").value = note?.id || "";
    document.getElementById("noteTitle").value = note?.title || "";
    document.getElementById("noteBody").value = note?.body || "";
    document.getElementById("noteDate").value = startDate;
    const endInput = document.getElementById("noteEndDate");
    if (endInput) {
      endInput.value = endDate;
      endInput.min = startDate;
    }
    this.setSelectedColor(note?.color || "blue");

    let visibility = note?.visibility || "private";
    if (visibility === "both") visibility = "multiple";
    const visibilityRadio = document.querySelector(`input[name="noteVisibility"][value="${visibility}"]`);
    if (visibilityRadio) visibilityRadio.checked = true;

    document.querySelectorAll('input[name="noteDepartments"]').forEach((input) => {
      input.checked = (note?.department_ids || []).map(String).includes(input.value);
    });
    document.querySelectorAll('input[name="noteUsers"]').forEach((input) => {
      input.checked = (note?.user_ids || []).map(String).includes(input.value);
    });

    const deptSearch = document.getElementById("noteDeptSearch");
    const userSearch = document.getElementById("noteUserSearch");
    if (deptSearch) deptSearch.value = "";
    if (userSearch) userSearch.value = "";
    this.filterShareList("noteDepartmentList", "");
    this.filterShareList("noteUserList", "");

    this.updateVisibilityPanels();

    titleEl.textContent = note?.id ? "Edit Note" : "Add Note";
    if (deleteBtn) {
      deleteBtn.classList.toggle("--hidden", !note?.id || !note?.can_edit);
    }

    this.noteOverlay.classList.remove("--hidden");
  }

  closeNoteModal() {
    if (this.noteOverlay) this.noteOverlay.classList.add("--hidden");
  }

  setSelectedColor(color) {
    const value = NOTE_COLORS.some((c) => c.key === color) ? color : "blue";
    document.getElementById("noteColor").value = value;
    document.querySelectorAll("#noteColorPicker .cal-note-color").forEach((btn) => {
      btn.classList.toggle("--selected", btn.dataset.color === value);
    });
  }

  updateVisibilityPanels() {
    const mode = document.querySelector('input[name="noteVisibility"]:checked')?.value || "private";
    const deptShare = document.getElementById("noteDeptShare");
    const userShare = document.getElementById("noteUserShare");
    const isMultiple = mode === "multiple" || mode === "both";

    if (deptShare) {
      deptShare.classList.toggle("--hidden", mode !== "department" && !isMultiple);
    }
    if (userShare) {
      userShare.classList.toggle("--hidden", mode !== "individual" && !isMultiple);
    }
  }

  collectVisibilityPayload() {
    const mode = document.querySelector('input[name="noteVisibility"]:checked')?.value || "private";
    const departmentIds = [...document.querySelectorAll('input[name="noteDepartments"]:checked')]
      .map((el) => Number(el.value));
    const userIds = [...document.querySelectorAll('input[name="noteUsers"]:checked')]
      .map((el) => Number(el.value));

    if (mode === "private") {
      return { department_ids: [], user_ids: [] };
    }
    if (mode === "department") {
      return { department_ids: departmentIds, user_ids: [] };
    }
    if (mode === "individual") {
      return { department_ids: [], user_ids: userIds };
    }
    return { department_ids: departmentIds, user_ids: userIds };
  }

  async saveNote() {
    const id = document.getElementById("noteId").value;
    const title = document.getElementById("noteTitle").value.trim();
    const body = document.getElementById("noteBody").value.trim();
    const noteDate = document.getElementById("noteDate").value;
    const endDate = document.getElementById("noteEndDate")?.value || noteDate;
    const color = document.getElementById("noteColor").value || "blue";
    const visibility = this.collectVisibilityPayload();
    const mode = document.querySelector('input[name="noteVisibility"]:checked')?.value || "private";

    if (!title || !noteDate || !endDate) return;

    if (endDate < noteDate) {
      alert("End date must be on or after the start date.");
      return;
    }

    if (mode === "department" && !visibility.department_ids.length) {
      alert("Select at least one department.");
      return;
    }
    if (mode === "individual" && !visibility.user_ids.length) {
      alert("Select at least one person.");
      return;
    }
    if ((mode === "multiple" || mode === "both") && (!visibility.department_ids.length || !visibility.user_ids.length)) {
      alert("For Multiple selection, pick at least one department and one person.");
      return;
    }

    const ok = await confirmAction({
      title: id ? "Save note changes?" : "Save this note?",
      message: id
        ? `Update "${title}" with the details you entered?`
        : `Create note "${title}"?`,
      confirmLabel: id ? "Save changes" : "Save note",
    });
    if (!ok) return;

    const payload = {
      title,
      body: body || null,
      note_date: noteDate,
      end_date: endDate,
      color,
      ...visibility,
    };

    const saveBtn = document.getElementById("noteSaveBtn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    try {
      const res = await fetch(id ? `/api/calendar-notes/${id}` : "/api/calendar-notes", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || err.message || "Failed to save note.");
        return;
      }

      this.closeNoteModal();
      await this.loadMonth();
    } catch (e) {
      console.error("Failed to save note:", e);
      alert("Failed to save note.");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Note";
      }
    }
  }

  async deleteNote() {
    const id = document.getElementById("noteId").value;
    if (!id) return;
    const title = document.getElementById("noteTitle")?.value?.trim() || "this note";
    const ok = await confirmAction({
      title: "Delete note?",
      message: `Permanently delete "${title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/calendar-notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete note.");
        return;
      }
      this.closeNoteModal();
      await this.loadMonth();
    } catch (e) {
      console.error("Failed to delete note:", e);
      alert("Failed to delete note.");
    }
  }

  formatDate(year, monthIndex, day) {
    const mm = String(monthIndex + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  todayIso() {
    const now = new Date();
    return this.formatDate(now.getFullYear(), now.getMonth(), now.getDate());
  }

  noteCoversDate(note, dateKey) {
    const start = note.note_date;
    const end = note.end_date || note.note_date;
    if (!start || !dateKey) return false;
    return dateKey >= start && dateKey <= end;
  }

  eachDayInNoteRange(note, callback) {
    const start = note.note_date;
    const end = note.end_date || note.note_date;
    if (!start || !end) return;

    const cursor = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return;

    while (cursor <= last) {
      callback(this.formatDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

export default new CalendarView();
