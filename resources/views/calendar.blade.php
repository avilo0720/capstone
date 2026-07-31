@extends('layouts.app')

@section('content')
  <div class="calendar-page">
    <div class="calendar-header">
      <h1>Transaction Calendar</h1>
      <div class="calendar-nav">
        <select id="calMonthSelect" class="calendar-select"></select>
        <div class="calendar-year-control">
          <button type="button" class="calendar-year-btn" id="calYearPrev" aria-label="Previous year">‹</button>
          <input
            type="number"
            id="calYearSelect"
            class="calendar-select calendar-year-input"
            inputmode="numeric"
            aria-label="Year"
          />
          <button type="button" class="calendar-year-btn" id="calYearNext" aria-label="Next year">›</button>
        </div>
      </div>
    </div>

    <div class="calendar-grid-wrapper">
      <div class="calendar-weekdays">
        <div class="calendar-weekday">Sun</div>
        <div class="calendar-weekday">Mon</div>
        <div class="calendar-weekday">Tue</div>
        <div class="calendar-weekday">Wed</div>
        <div class="calendar-weekday">Thu</div>
        <div class="calendar-weekday">Fri</div>
        <div class="calendar-weekday">Sat</div>
      </div>
      <div class="calendar-grid" id="calendarGrid"></div>
    </div>

    <div class="calendar-footer">
      <button type="button" class="addProBtn calendar-add-note-btn" id="calAddNoteBtn">Add Note</button>
    </div>
  </div>

  <div class="daily-overview-overlay --hidden" id="dailyOverlayModal">
    <div class="daily-overview-modal">
      <div class="daily-overview-modal__header">
        <h2 id="dailyOverviewTitle">Daily Overview</h2>
        <button type="button" class="daily-overview-modal__close" id="dailyOverviewClose">&times;</button>
      </div>
      <div class="daily-overview-modal__stats">
        <div class="daily-stat --added">
          <span class="daily-stat__label">Total Added</span>
          <span class="daily-stat__value" id="dailyTotalAdded">0</span>
        </div>
        <div class="daily-stat --used">
          <span class="daily-stat__label">Total Used</span>
          <span class="daily-stat__value" id="dailyTotalUsed">0</span>
        </div>
      </div>

      <div class="daily-overview-tabs" role="tablist">
        <button type="button" class="daily-overview-tab --active" data-daily-tab="transactions" role="tab">Transactions</button>
        <button type="button" class="daily-overview-tab" data-daily-tab="notes" role="tab">
          Notes
          <span class="daily-overview-tab__count" id="dailyNotesCount">0</span>
        </button>
      </div>

      <div class="daily-overview-panel" id="dailyTransactionsPanel">
        <div class="daily-overview-modal__list" id="dailyTransactionList"></div>
        <div class="table-pagination-container" id="calendarPagination"></div>
      </div>

      <div class="daily-overview-panel --hidden" id="dailyNotesPanel">
        <div class="daily-overview-modal__list" id="dailyNotesList"></div>
      </div>
    </div>
  </div>

  <div class="users-modal-overlay --hidden" id="noteModalOverlay">
    <div class="users-modal cal-note-modal">
      <div class="users-modal__header">
        <div>
          <h2 id="noteModalTitle">Add Note</h2>
          <p class="users-modal__subtitle">Color-coded note with department or individual visibility</p>
        </div>
        <button type="button" class="users-modal__close" id="noteModalClose" aria-label="Close">&times;</button>
      </div>
      <form id="noteForm" class="users-modal__body">
        <input type="hidden" id="noteId" />

        <section class="users-section">
          <h3 class="users-section__title">Details</h3>
          <div class="users-form-grid">
            <label class="users-form-grid__full">
              <span>Title</span>
              <input type="text" id="noteTitle" maxlength="150" required />
            </label>
            <label class="users-form-grid__full">
              <span>Note</span>
              <textarea id="noteBody" rows="3" maxlength="5000" placeholder="Optional details..."></textarea>
            </label>
            <label>
              <span>Start date</span>
              <input type="date" id="noteDate" required />
            </label>
            <label>
              <span>End date</span>
              <input type="date" id="noteEndDate" required />
              <small>Note appears on every day in this range</small>
            </label>
            <label class="users-form-grid__full">
              <span>Color</span>
              <div class="cal-note-colors" id="noteColorPicker" role="radiogroup" aria-label="Note color"></div>
              <input type="hidden" id="noteColor" value="blue" />
            </label>
          </div>
        </section>

        <section class="users-section">
          <h3 class="users-section__title">Who can see this</h3>
          <div class="users-perm-mode">
            <label class="users-choice">
              <input type="radio" name="noteVisibility" value="private" checked />
              <span>
                <strong>Only me</strong>
                <small>Private note — not shared</small>
              </span>
            </label>
            <label class="users-choice">
              <input type="radio" name="noteVisibility" value="department" />
              <span>
                <strong>Departments</strong>
                <small>Everyone in selected departments</small>
              </span>
            </label>
            <label class="users-choice">
              <input type="radio" name="noteVisibility" value="individual" />
              <span>
                <strong>Individuals</strong>
                <small>Only selected people</small>
              </span>
            </label>
            <label class="users-choice">
              <input type="radio" name="noteVisibility" value="multiple" />
              <span>
                <strong>Multiple selection</strong>
                <small>Departments and selected people</small>
              </span>
            </label>
          </div>

          <div class="cal-note-share --hidden" id="noteDeptShare">
            <p class="cal-note-share__label">Departments</p>
            <input
              type="search"
              id="noteDeptSearch"
              class="cal-note-search"
              placeholder="Search departments..."
              autocomplete="off"
            />
            <div class="cal-note-checklist" id="noteDepartmentList"></div>
          </div>

          <div class="cal-note-share --hidden" id="noteUserShare">
            <p class="cal-note-share__label">People</p>
            <input
              type="search"
              id="noteUserSearch"
              class="cal-note-search"
              placeholder="Search people..."
              autocomplete="off"
            />
            <div class="cal-note-checklist" id="noteUserList"></div>
          </div>
        </section>

        <div class="users-modal__footer">
          <button type="button" class="users-btn users-btn--danger --hidden" id="noteDeleteBtn">Delete</button>
          <div class="users-modal__footer-actions">
            <button type="button" class="users-btn users-btn--ghost" id="noteCancelBtn">Cancel</button>
            <button type="submit" class="users-btn users-btn--primary" id="noteSaveBtn">Save Note</button>
          </div>
        </div>
      </form>
    </div>
  </div>
@endsection
