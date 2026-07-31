@extends('layouts.app')

@section('content')
  <div class="users-page">
    <div class="product-section__header">
      <div class="product-section__header__title">
        <h1>Users</h1>
        <div class="users-tabs" role="tablist">
          <button type="button" class="users-tab --active" data-tab="users" role="tab">People</button>
          <button type="button" class="users-tab" data-tab="departments" role="tab">Departments</button>
        </div>
        <form class="inventory-search__form users-search__form" onsubmit="return false;">
          <div class="inventory-search">
            <svg class="icon">
              <use xlink:href="/assets/images/sprite.svg#search"></use>
            </svg>
            <input
              type="text"
              placeholder="Search people"
              class="usersSearchInput"
              id="usersSearchInput"
            />
          </div>
        </form>
      </div>
      <div class="product-section__header__buttons">
        <button type="button" class="editToggleBtn users-name-toggle" id="lastNameFirstToggle" aria-pressed="false">
          Last name first
        </button>
        <div class="users-sort">
          <button type="button" class="editToggleBtn" id="usersSortBtn">
            Sort
            <span class="users-sort__label" id="usersSortLabel">Name A–Z</span>
          </button>
          <div class="users-sort__menu --hidden" id="usersSortMenu">
            <button type="button" class="users-sort__option --active" data-sort="name-asc">Name A–Z</button>
            <button type="button" class="users-sort__option" data-sort="name-desc">Name Z–A</button>
            <button type="button" class="users-sort__option" data-sort="date-added-desc">Date added (newest)</button>
            <button type="button" class="users-sort__option" data-sort="date-added-asc">Date added (oldest)</button>
            <button type="button" class="users-sort__option --people-only" data-sort="role-asc">Role A–Z</button>
            <button type="button" class="users-sort__option --people-only" data-sort="department-asc">Department A–Z</button>
            <button type="button" class="users-sort__option --dept-only --hidden" data-sort="members-desc">Most members</button>
            <button type="button" class="users-sort__option --dept-only --hidden" data-sort="members-asc">Fewest members</button>
          </div>
        </div>
        <button type="button" class="addProBtn" id="addUserBtn">Add User</button>
        <button type="button" class="addProBtn --hidden" id="addDepartmentBtn">Add Department</button>
      </div>
    </div>

    <div class="users-panel" id="usersPanel">
      <div class="product-section">
        <table class="product-section-table users-table">
          <thead>
            <tr class="table__title">
              <td>User</td>
              <td>Role</td>
              <td>Department</td>
              <td>Access</td>
            </tr>
          </thead>
          <tbody id="usersTableBody"></tbody>
        </table>
      </div>
    </div>

    <div class="users-panel --hidden" id="departmentsPanel">
      <div class="product-section">
        <table class="product-section-table users-table">
          <thead>
            <tr class="table__title">
              <td>Department</td>
              <td>Members</td>
              <td>Access</td>
            </tr>
          </thead>
          <tbody id="departmentsTableBody"></tbody>
        </table>
      </div>
    </div>

    <div class="table-pagination-container" id="usersPagination"></div>
  </div>

  <div class="users-modal-overlay --hidden" id="userModalOverlay">
    <div class="users-modal">
      <div class="users-modal__header">
        <div>
          <h2 id="userModalTitle">Add User</h2>
          <p class="users-modal__subtitle">Profile, role, and page access</p>
        </div>
        <button type="button" class="users-modal__close" data-close-modal aria-label="Close">&times;</button>
      </div>
      <form id="userForm" class="users-modal__body">
        <input type="hidden" id="userId" />

        <section class="users-section">
          <h3 class="users-section__title">Profile</h3>
          <div class="users-form-grid">
            <label>
              <span>First name</span>
              <input type="text" id="userFirstName" required />
            </label>
            <label>
              <span>Last name</span>
              <input type="text" id="userLastName" required />
            </label>
            <label>
              <span>Username</span>
              <input type="text" id="userUsername" required />
            </label>
            <label>
              <span>Birthday</span>
              <input type="date" id="userBirthday" />
            </label>
            <label class="users-form-grid__full">
              <span>Password</span>
              <input type="password" id="userPassword" autocomplete="new-password" />
              <small id="userPasswordHint">Required for new users. Leave blank to keep current password.</small>
            </label>
          </div>
        </section>

        <section class="users-section">
          <h3 class="users-section__title">Role</h3>
          <div class="users-form-grid">
            <label>
              <span>Role name</span>
              <input type="text" id="userRole" required placeholder="e.g. Shift Lead" />
            </label>
            <label>
              <span>Department</span>
              <select id="userDepartment"></select>
            </label>
          </div>

          <div class="users-perm-mode">
            <label class="users-choice">
              <input type="radio" name="permMode" value="department" checked />
              <span>
                <strong>Department defaults</strong>
                <small>Inherit this department’s page access</small>
              </span>
            </label>
            <label class="users-choice">
              <input type="radio" name="permMode" value="custom" />
              <span>
                <strong>Custom access</strong>
                <small>Set pages for this user only</small>
              </span>
            </label>
          </div>

          <div class="users-perm-matrix --hidden" id="userPermMatrix"></div>
        </section>

        <div class="users-modal__footer">
          <button type="button" class="users-btn users-btn--danger --hidden" id="deleteUserBtn">Delete</button>
          <div class="users-modal__footer-actions">
            <button type="button" class="users-btn users-btn--ghost" data-close-modal>Cancel</button>
            <button type="submit" class="users-btn users-btn--primary">Save</button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <div class="users-modal-overlay --hidden" id="departmentModalOverlay">
    <div class="users-modal">
      <div class="users-modal__header">
        <div>
          <h2 id="departmentModalTitle">Add Department</h2>
          <p class="users-modal__subtitle">Name and default page access</p>
        </div>
        <button type="button" class="users-modal__close" data-close-modal aria-label="Close">&times;</button>
      </div>
      <form id="departmentForm" class="users-modal__body">
        <input type="hidden" id="departmentId" />

        <section class="users-section">
          <h3 class="users-section__title">Details</h3>
          <div class="users-form-grid">
            <label class="users-form-grid__full">
              <span>Department name</span>
              <input type="text" id="departmentName" required placeholder="e.g. Logistics" />
            </label>
            <label class="users-form-grid__full">
              <span>Description</span>
              <textarea id="departmentDescription" rows="2" placeholder="Optional"></textarea>
            </label>
          </div>
        </section>

        <section class="users-section">
          <h3 class="users-section__title">Default access</h3>
          <div class="users-perm-matrix" id="departmentPermMatrix"></div>
        </section>

        <div class="users-modal__footer">
          <button type="button" class="users-btn users-btn--danger --hidden" id="deleteDepartmentBtn">Delete</button>
          <div class="users-modal__footer-actions">
            <button type="button" class="users-btn users-btn--ghost" data-close-modal>Cancel</button>
            <button type="submit" class="users-btn users-btn--primary">Save</button>
          </div>
        </div>
      </form>
    </div>
  </div>
@endsection
