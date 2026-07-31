import Pagination from "./Pagination.js";
import confirmAction from "./ConfirmDialog.js";

const DEFAULT_CATALOG = {
  dashboard: { label: "Dashboard", abilities: ["view"] },
  inventory: { label: "Inventory", abilities: ["view", "edit"] },
  forecast: { label: "Forecasting", abilities: ["view"] },
  reports: { label: "Reports", abilities: ["view"] },
  calendar: { label: "Calendar", abilities: ["view"] },
  "activity-logs": { label: "Activity Logs", abilities: ["view"] },
  users: { label: "Users", abilities: ["view", "manage"] },
};

const PAGE_SHORT = {
  dashboard: "Dash",
  inventory: "Inv",
  forecast: "Forecast",
  reports: "Reports",
  calendar: "Cal",
  "activity-logs": "Activity",
  users: "Users",
};

const SORT_LABELS = {
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  "date-added-desc": "Date added (newest)",
  "date-added-asc": "Date added (oldest)",
  "role-asc": "Role A–Z",
  "department-asc": "Department A–Z",
  "members-desc": "Most members",
  "members-asc": "Fewest members",
};

class UsersView {
  constructor() {
    this.users = [];
    this.departments = [];
    this.catalog = DEFAULT_CATALOG;
    this.activeTab = "users";
    this.searchQuery = "";
    this.sortKey = "name-asc";
    this.lastNameFirst = localStorage.getItem("users_last_name_first") === "1";
    this.pagination = new Pagination({
      pageSize: 10,
      onPageChange: () => this.renderActiveList(),
    });
  }

  async setApp() {
    this.cacheDom();
    this.pagination.setContainer(document.getElementById("usersPagination"));
    this.bindEvents();
    await this.loadCatalog();
    await this.reload();
  }

  cacheDom() {
    this.root = document.querySelector(".users-page");
    this.usersBody = document.getElementById("usersTableBody");
    this.departmentsBody = document.getElementById("departmentsTableBody");
    this.usersPanel = document.getElementById("usersPanel");
    this.departmentsPanel = document.getElementById("departmentsPanel");
    this.userModal = document.getElementById("userModalOverlay");
    this.departmentModal = document.getElementById("departmentModalOverlay");
    this.userForm = document.getElementById("userForm");
    this.departmentForm = document.getElementById("departmentForm");
    this.userPermMatrix = document.getElementById("userPermMatrix");
    this.departmentPermMatrix = document.getElementById("departmentPermMatrix");
    this.userDepartment = document.getElementById("userDepartment");
    this.addUserBtn = document.getElementById("addUserBtn");
    this.addDepartmentBtn = document.getElementById("addDepartmentBtn");
    this.searchInput = document.getElementById("usersSearchInput");
    this.sortBtn = document.getElementById("usersSortBtn");
    this.sortMenu = document.getElementById("usersSortMenu");
    this.sortLabel = document.getElementById("usersSortLabel");
    this.lastNameFirstToggle = document.getElementById("lastNameFirstToggle");
  }

  bindEvents() {
    document.querySelectorAll(".users-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });

    this.addUserBtn?.addEventListener("click", () => this.openUserModal());
    this.addDepartmentBtn?.addEventListener("click", () => this.openDepartmentModal());

    this.lastNameFirstToggle?.addEventListener("click", () => {
      this.lastNameFirst = !this.lastNameFirst;
      localStorage.setItem("users_last_name_first", this.lastNameFirst ? "1" : "0");
      this.updateNameToggleUi();
      this.pagination.reset();
      this.renderActiveList();
    });

    this.searchInput?.addEventListener("input", () => {
      this.searchQuery = this.searchInput.value.trim().toLowerCase();
      this.pagination.reset();
      this.renderActiveList();
    });

    this.sortBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.sortMenu?.classList.toggle("--hidden");
      this.sortBtn.classList.toggle("--active", !this.sortMenu?.classList.contains("--hidden"));
    });

    this.sortMenu?.querySelectorAll(".users-sort__option").forEach((option) => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        if (option.classList.contains("--hidden")) return;
        this.sortKey = option.dataset.sort;
        this.updateSortUi();
        this.sortMenu.classList.add("--hidden");
        this.sortBtn.classList.remove("--active");
        this.pagination.reset();
        this.renderActiveList();
      });
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest(".users-sort")) return;
      this.sortMenu?.classList.add("--hidden");
      this.sortBtn?.classList.remove("--active");
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => this.closeModals());
    });

    this.userModal?.addEventListener("click", (e) => {
      if (e.target === this.userModal) this.closeModals();
    });
    this.departmentModal?.addEventListener("click", (e) => {
      if (e.target === this.departmentModal) this.closeModals();
    });

    this.userForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveUser();
    });

    this.departmentForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveDepartment();
    });

    document.querySelectorAll('input[name="permMode"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (input.value === "custom" && input.checked) {
          const deptId = this.userDepartment?.value;
          const dept = this.departments.find((d) => String(d.id) === String(deptId));
          const current = this.collectPageFlags(this.userPermMatrix);
          const hasAny = Object.values(current).some((flags) => Object.values(flags).some(Boolean));
          if (!hasAny && dept?.permissions?.length) {
            this.renderPermMatrix(this.userPermMatrix, "user", dept.permissions);
          }
        }
        this.toggleUserPermMatrix();
      });
    });

    this.userDepartment?.addEventListener("change", () => {
      const roleInput = document.getElementById("userRole");
      const selected = this.departments.find((d) => String(d.id) === this.userDepartment.value);
      if (selected && roleInput && !roleInput.dataset.touched) {
        roleInput.value = selected.name;
      }
    });

    document.getElementById("userRole")?.addEventListener("input", (e) => {
      e.target.dataset.touched = "1";
    });

    document.getElementById("deleteUserBtn")?.addEventListener("click", () => {
      const id = document.getElementById("userId")?.value;
      if (id) this.deleteUser(id);
    });

    document.getElementById("deleteDepartmentBtn")?.addEventListener("click", () => {
      const id = document.getElementById("departmentId")?.value;
      if (id) this.deleteDepartment(id);
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll(".users-tab").forEach((el) => {
      el.classList.toggle("--active", el.dataset.tab === tab);
    });
    this.usersPanel?.classList.toggle("--hidden", tab !== "users");
    this.departmentsPanel?.classList.toggle("--hidden", tab !== "departments");
    this.addUserBtn?.classList.toggle("--hidden", tab !== "users");
    this.addDepartmentBtn?.classList.toggle("--hidden", tab !== "departments");

    if (this.searchInput) {
      this.searchInput.placeholder = tab === "departments" ? "Search departments" : "Search people";
    }

    this.lastNameFirstToggle?.classList.toggle("--hidden", tab !== "users");

    // Reset tab-specific sorts when switching
    const deptOnlySorts = ["members-desc", "members-asc"];
    const peopleOnlySorts = ["role-asc", "department-asc"];
    if (tab === "departments" && peopleOnlySorts.includes(this.sortKey)) {
      this.sortKey = "name-asc";
    }
    if (tab === "users" && deptOnlySorts.includes(this.sortKey)) {
      this.sortKey = "name-asc";
    }

    this.updateNameToggleUi();
    this.updateSortUi();
    this.pagination.reset();
    this.renderActiveList();
  }

  updateNameToggleUi() {
    if (!this.lastNameFirstToggle) return;
    this.lastNameFirstToggle.classList.toggle("--active", this.lastNameFirst);
    this.lastNameFirstToggle.setAttribute("aria-pressed", this.lastNameFirst ? "true" : "false");
  }

  formatDisplayName(user) {
    const first = (user.first_name || "").trim();
    const last = (user.last_name || "").trim();
    if (this.lastNameFirst) {
      return [last, first].filter(Boolean).join(" ") || user.full_name || "—";
    }
    return [first, last].filter(Boolean).join(" ") || user.full_name || "—";
  }

  updateSortUi() {
    if (this.sortLabel) {
      this.sortLabel.textContent = SORT_LABELS[this.sortKey] || "Name A–Z";
    }

    this.sortMenu?.querySelectorAll(".users-sort__option").forEach((option) => {
      const isDeptOnly = option.classList.contains("--dept-only");
      const isPeopleOnly = option.classList.contains("--people-only");
      if (isDeptOnly) {
        option.classList.toggle("--hidden", this.activeTab !== "departments");
      }
      if (isPeopleOnly) {
        option.classList.toggle("--hidden", this.activeTab !== "users");
      }
      option.classList.toggle("--active", option.dataset.sort === this.sortKey);
    });
  }

  renderActiveList() {
    if (this.activeTab === "departments") {
      this.renderDepartments();
    } else {
      this.renderUsers();
    }
  }

  getFilteredUsers() {
    let list = [...this.users];
    if (this.searchQuery) {
      list = list.filter((user) => {
        const haystack = [
          user.full_name,
          user.username,
          user.role,
          user.department_name,
          ...(user.effective?.pages || []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(this.searchQuery);
      });
    }

    return this.sortUsers(list);
  }

  getFilteredDepartments() {
    let list = [...this.departments];
    if (this.searchQuery) {
      list = list.filter((dept) => {
        const pages = (dept.permissions || []).map((p) => p.page).join(" ");
        const haystack = [dept.name, dept.description, pages].join(" ").toLowerCase();
        return haystack.includes(this.searchQuery);
      });
    }

    return this.sortDepartments(list);
  }

  createdTimestamp(value) {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }

  sortUsers(list) {
    const collator = new Intl.Collator(undefined, { sensitivity: "base" });
    const nameKey = (user) => this.formatDisplayName(user);

    return list.sort((a, b) => {
      switch (this.sortKey) {
        case "name-desc":
          return collator.compare(nameKey(b), nameKey(a));
        case "date-added-desc":
          return this.createdTimestamp(b.created) - this.createdTimestamp(a.created);
        case "date-added-asc":
          return this.createdTimestamp(a.created) - this.createdTimestamp(b.created);
        case "role-asc":
          return (
            collator.compare(a.role || "", b.role || "") ||
            collator.compare(nameKey(a), nameKey(b))
          );
        case "department-asc":
          return (
            collator.compare(a.department_name || "", b.department_name || "") ||
            collator.compare(nameKey(a), nameKey(b))
          );
        case "name-asc":
        default:
          return collator.compare(nameKey(a), nameKey(b));
      }
    });
  }

  sortDepartments(list) {
    const collator = new Intl.Collator(undefined, { sensitivity: "base" });
    return list.sort((a, b) => {
      switch (this.sortKey) {
        case "date-added-desc":
          return this.createdTimestamp(b.created) - this.createdTimestamp(a.created);
        case "date-added-asc":
          return this.createdTimestamp(a.created) - this.createdTimestamp(b.created);
        case "members-desc":
          return (b.users_count ?? 0) - (a.users_count ?? 0);
        case "members-asc":
          return (a.users_count ?? 0) - (b.users_count ?? 0);
        case "name-asc":
        default:
          return collator.compare(a.name || "", b.name || "");
      }
    });
  }

  async loadCatalog() {
    try {
      const res = await fetch("/api/permission-catalog");
      if (res.ok) {
        const data = await res.json();
        this.catalog = data.pages || DEFAULT_CATALOG;
      }
    } catch {
      this.catalog = DEFAULT_CATALOG;
    }
  }

  async reload() {
    const [usersRes, departmentsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/departments"),
    ]);

    if (!usersRes.ok || !departmentsRes.ok) {
      this.usersBody.innerHTML = `<tr><td colspan="4" class="users-empty">Unable to load users.</td></tr>`;
      return;
    }

    this.users = await usersRes.json();
    this.departments = await departmentsRes.json();
    this.updateNameToggleUi();
    this.updateSortUi();
    this.pagination.reset();
    this.renderActiveList();
    this.fillDepartmentSelect();
  }

  fillDepartmentSelect(selectedId = "") {
    if (!this.userDepartment) return;
    this.userDepartment.innerHTML =
      `<option value="">No department</option>` +
      this.departments
        .map(
          (d) =>
            `<option value="${d.id}" ${String(d.id) === String(selectedId) ? "selected" : ""}>${this.escape(d.name)}</option>`
        )
        .join("");
  }

  pageChips(pages = [], canEdit = false) {
    if (!pages.length) {
      return `<span class="users-muted">No access</span>`;
    }

    return pages
      .map((page) => {
        const label = PAGE_SHORT[page] || page;
        const edit = page === "inventory" && canEdit ? " · edit" : "";
        const manage = page === "users" ? " · admin" : "";
        return `<span class="users-chip">${this.escape(label)}${edit}${manage}</span>`;
      })
      .join("");
  }

  renderUsers() {
    const list = this.getFilteredUsers();

    if (!this.users.length) {
      this.usersBody.innerHTML = `<tr><td colspan="4" class="users-empty">No users yet.</td></tr>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    if (!list.length) {
      this.usersBody.innerHTML = `<tr><td colspan="4" class="users-empty">No people match your search.</td></tr>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    const page = this.pagination.getSlice(list);

    this.usersBody.innerHTML = page.items
      .map((user) => {
        const source = user.use_custom_permissions ? "Custom" : "Dept";
        const pages = user.effective?.pages || [];
        const displayName = this.formatDisplayName(user);
        const avatar = user.profile_picture
          ? `<img src="${this.escape(user.profile_picture)}" alt="" class="users-person__avatar-img" />`
          : this.escape(this.initials(displayName));
        return `
          <tr class="users-row" data-open-user="${user.id}" tabindex="0" role="button" aria-label="Edit ${this.escape(displayName)}">
            <td>
              <div class="users-person">
                <span class="users-person__avatar ${user.profile_picture ? "--has-image" : ""}">${avatar}</span>
                <span class="users-person__meta">
                  <strong>${this.escape(displayName)}</strong>
                  <small>@${this.escape(user.username)}</small>
                </span>
              </div>
            </td>
            <td>
              <div class="users-role-cell">
                <span>${this.escape(user.role)}</span>
                <span class="users-badge">${source}</span>
              </div>
            </td>
            <td>${this.escape(user.department_name || "—")}</td>
            <td><div class="users-chips">${this.pageChips(pages, user.effective?.canEdit)}</div></td>
          </tr>
        `;
      })
      .join("");

    this.pagination.renderControls(page);

    this.usersBody.querySelectorAll("[data-open-user]").forEach((row) => {
      const open = () => {
        const user = this.users.find((u) => String(u.id) === row.dataset.openUser);
        if (user) this.openUserModal(user);
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  renderDepartments() {
    const list = this.getFilteredDepartments();

    if (!this.departments.length) {
      this.departmentsBody.innerHTML = `<tr><td colspan="3" class="users-empty">No departments yet.</td></tr>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    if (!list.length) {
      this.departmentsBody.innerHTML = `<tr><td colspan="3" class="users-empty">No departments match your search.</td></tr>`;
      this.pagination.renderControls({ totalItems: 0, totalPages: 1 });
      return;
    }

    const page = this.pagination.getSlice(list);

    this.departmentsBody.innerHTML = page.items
      .map((dept) => {
        const pages = [...new Set((dept.permissions || []).map((p) => p.page))];
        const canEdit = (dept.permissions || []).some(
          (p) => p.page === "inventory" && p.ability === "edit"
        );
        return `
          <tr class="users-row" data-open-department="${dept.id}" tabindex="0" role="button" aria-label="Edit ${this.escape(dept.name)}">
            <td>
              <div class="users-person__meta">
                <strong>${this.escape(dept.name)}</strong>
                <small>${this.escape(dept.description || "No description")}</small>
              </div>
            </td>
            <td>${dept.users_count ?? 0}</td>
            <td><div class="users-chips">${this.pageChips(pages, canEdit)}</div></td>
          </tr>
        `;
      })
      .join("");

    this.pagination.renderControls(page);

    this.departmentsBody.querySelectorAll("[data-open-department]").forEach((row) => {
      const open = () => {
        const dept = this.departments.find((d) => String(d.id) === row.dataset.openDepartment);
        if (dept) this.openDepartmentModal(dept);
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  initials(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
  }

  openUserModal(user = null) {
    document.getElementById("userModalTitle").textContent = user ? "Edit User" : "Add User";
    document.getElementById("userId").value = user?.id || "";
    document.getElementById("userFirstName").value = user?.first_name || "";
    document.getElementById("userLastName").value = user?.last_name || "";
    document.getElementById("userUsername").value = user?.username || "";
    document.getElementById("userBirthday").value = user?.birthday || "";
    const roleInput = document.getElementById("userRole");
    roleInput.value = user?.role || "";
    roleInput.dataset.touched = user ? "1" : "";
    document.getElementById("userPassword").value = "";
    document.getElementById("userPassword").required = !user;
    document.getElementById("userPasswordHint").textContent = user
      ? "Leave blank to keep the current password."
      : "Required for new users (min 6 characters).";

    const deleteBtn = document.getElementById("deleteUserBtn");
    deleteBtn?.classList.toggle("--hidden", !user);

    this.fillDepartmentSelect(user?.department_id || "");

    const mode = user?.use_custom_permissions ? "custom" : "department";
    document.querySelectorAll('input[name="permMode"]').forEach((input) => {
      input.checked = input.value === mode;
    });

    this.renderPermMatrix(
      this.userPermMatrix,
      "user",
      user?.use_custom_permissions ? user.permissions : []
    );
    this.toggleUserPermMatrix();
    this.userModal.classList.remove("--hidden");
  }

  openDepartmentModal(department = null) {
    document.getElementById("departmentModalTitle").textContent = department
      ? "Edit Department"
      : "Add Department";
    document.getElementById("departmentId").value = department?.id || "";
    document.getElementById("departmentName").value = department?.name || "";
    document.getElementById("departmentDescription").value = department?.description || "";

    const deleteBtn = document.getElementById("deleteDepartmentBtn");
    deleteBtn?.classList.toggle("--hidden", !department);

    this.renderPermMatrix(this.departmentPermMatrix, "dept", department?.permissions || []);
    this.departmentModal.classList.remove("--hidden");
  }

  closeModals() {
    this.userModal?.classList.add("--hidden");
    this.departmentModal?.classList.add("--hidden");
  }

  toggleUserPermMatrix() {
    const custom = document.querySelector('input[name="permMode"]:checked')?.value === "custom";
    this.userPermMatrix?.classList.toggle("--hidden", !custom);
  }

  renderPermMatrix(container, prefix, permissions = []) {
    if (!container) return;

    const granted = new Set(permissions.map((p) => `${p.page}.${p.ability}`));

    container.innerHTML = Object.entries(this.catalog)
      .map(([page, def]) => {
        const abilities = def.abilities
          .map((ability) => {
            const id = `${prefix}_${page}_${ability}`;
            const checked = granted.has(`${page}.${ability}`) ? "checked" : "";
            const label = ability === "view" ? "Access" : ability === "edit" ? "Edit" : "Manage";
            return `
              <label class="users-check">
                <input type="checkbox" id="${id}" data-page="${page}" data-ability="${ability}" ${checked} />
                <span>${label}</span>
              </label>
            `;
          })
          .join("");

        return `
          <div class="users-perm-row">
            <span class="users-perm-row__label">${this.escape(def.label)}</span>
            <div class="users-perm-row__abilities">${abilities}</div>
          </div>
        `;
      })
      .join("");
  }

  collectPageFlags(container) {
    const flags = {};
    container.querySelectorAll("input[type=checkbox]").forEach((input) => {
      const page = input.dataset.page;
      const ability = input.dataset.ability;
      if (!flags[page]) flags[page] = {};
      flags[page][ability] = input.checked;
    });
    return flags;
  }

  async saveUser() {
    const id = document.getElementById("userId").value;
    const firstName = document.getElementById("userFirstName").value.trim();
    const lastName = document.getElementById("userLastName").value.trim();
    const displayName = `${firstName} ${lastName}`.trim() || "this user";
    const ok = await confirmAction({
      title: id ? "Save user changes?" : "Create this user?",
      message: id
        ? `Update "${displayName}" with the details you entered?`
        : `Create account for "${displayName}"?`,
      confirmLabel: id ? "Save changes" : "Create user",
    });
    if (!ok) return;

    const useCustom = document.querySelector('input[name="permMode"]:checked')?.value === "custom";
    const payload = {
      first_name: firstName,
      last_name: lastName,
      username: document.getElementById("userUsername").value.trim(),
      birthday: document.getElementById("userBirthday").value || null,
      role: document.getElementById("userRole").value.trim(),
      department_id: document.getElementById("userDepartment").value
        ? Number(document.getElementById("userDepartment").value)
        : null,
      use_custom_permissions: useCustom,
      page_flags: useCustom ? this.collectPageFlags(this.userPermMatrix) : {},
    };

    const password = document.getElementById("userPassword").value;
    if (password) payload.password = password;
    if (!id) payload.password = password;

    const res = await fetch(id ? `/api/users/${id}` : "/api/users", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || this.formatValidation(err) || "Failed to save user");
      return;
    }

    this.closeModals();
    await this.reload();
  }

  async saveDepartment() {
    const id = document.getElementById("departmentId").value;
    const name = document.getElementById("departmentName").value.trim();
    const ok = await confirmAction({
      title: id ? "Save department changes?" : "Create this department?",
      message: id
        ? `Update "${name || "this department"}" with the details you entered?`
        : `Create department "${name || "Untitled"}"?`,
      confirmLabel: id ? "Save changes" : "Create department",
    });
    if (!ok) return;

    const payload = {
      name,
      description: document.getElementById("departmentDescription").value.trim() || null,
      page_flags: this.collectPageFlags(this.departmentPermMatrix),
    };

    const res = await fetch(id ? `/api/departments/${id}` : "/api/departments", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || this.formatValidation(err) || "Failed to save department");
      return;
    }

    this.closeModals();
    await this.reload();
  }

  async deleteUser(id) {
    const firstName = document.getElementById("userFirstName")?.value?.trim() || "";
    const lastName = document.getElementById("userLastName")?.value?.trim() || "";
    const displayName = `${firstName} ${lastName}`.trim() || "this user";
    const ok = await confirmAction({
      title: "Delete user?",
      message: `Permanently delete "${displayName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete user");
      return;
    }
    this.closeModals();
    await this.reload();
  }

  async deleteDepartment(id) {
    const name = document.getElementById("departmentName")?.value?.trim() || "this department";
    const ok = await confirmAction({
      title: "Delete department?",
      message: `Permanently delete "${name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete department");
      return;
    }
    this.closeModals();
    await this.reload();
  }

  formatValidation(err) {
    if (!err?.errors) return null;
    return Object.values(err.errors).flat().join("\n");
  }

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

export default new UsersView();
