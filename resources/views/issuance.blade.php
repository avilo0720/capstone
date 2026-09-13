@extends('layouts.app')

@section('content')
  <div class="procurement-page issuance-page">
    <div class="product-section__header">
      <div class="product-section__header__title">
        <h1>Issuance</h1>
        @if($currentInventory)
          <span class="inventory-context-name">{{ $currentInventory->name }}</span>
        @endif
        <div class="users-tabs" id="issuanceFilters" role="tablist">
          <button type="button" class="users-tab --active" data-status="all" role="tab">All</button>
          <button type="button" class="users-tab" data-status="pending" role="tab">Pending</button>
          <button type="button" class="users-tab" data-status="approved" role="tab">Approved</button>
          <button type="button" class="users-tab" data-status="denied" role="tab">Denied</button>
          <button type="button" class="users-tab" data-status="stock_entered" role="tab">Stock used</button>
        </div>
        <form class="inventory-search__form" onsubmit="return false;">
          <div class="inventory-search">
            <svg class="icon">
              <use xlink:href="/assets/images/sprite.svg#search"></use>
            </svg>
            <input type="text" placeholder="Search requests" id="issuanceSearch" />
          </div>
        </form>
      </div>
      <div class="product-section__header__buttons">
        @if($user['canEditIssuance'] ?? false)
          <button type="button" class="addProBtn" id="issuanceManualBtn">Add request</button>
          <label class="downloadBtn" for="issuanceFileInput">Upload file</label>
          <input type="file" id="issuanceFileInput" accept=".xlsx,.xls,.csv,text/csv" hidden>
        @endif
      </div>
    </div>

    <div class="module-body">
    <div class="reports-summary" id="issuanceSummary">
      <button type="button" class="reports-summary__card reports-summary__card--clickable is-active" data-status="all">
        <div class="reports-summary__card-icon reports-summary__card-icon--items">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Total requests</p>
          <p class="reports-summary__card-value" id="issuanceKpiTotal">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="pending">
        <div class="reports-summary__card-icon reports-summary__card-icon--leadtime">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Pending</p>
          <p class="reports-summary__card-value" id="issuanceKpiPending">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="denied">
        <div class="reports-summary__card-icon reports-summary__card-icon--alert">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Denied</p>
          <p class="reports-summary__card-value" id="issuanceKpiDenied">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="stock_entered">
        <div class="reports-summary__card-icon reports-summary__card-icon--value">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Stock used</p>
          <p class="reports-summary__card-value" id="issuanceKpiStockEntered">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="approved">
        <div class="reports-summary__card-icon reports-summary__card-icon--qty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Approved</p>
          <p class="reports-summary__card-value" id="issuanceKpiApproved">0</p>
        </div>
      </button>
    </div>

    <div class="product-section procurement-list">
      <table class="product-section-table">
        <thead>
          <tr class="table__title">
            <td>Request</td>
            <td>File</td>
            <td>Status</td>
            <td>Lines</td>
            <td>Qty</td>
            <td>Submitted by</td>
            <td>When</td>
          </tr>
        </thead>
        <tbody id="issuanceTableBody">
          <tr>
            <td colspan="7" class="users-empty">Loading issuance requests…</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-pagination-container" id="issuancePagination"></div>

    </div>
  </div>

  <div class="procurement-overlay" id="issuanceDetailOverlay" hidden>
    <div class="confirm-modal confirm-modal--wide procurement-detail-modal" role="dialog" aria-modal="true" aria-labelledby="issuanceDetailTitle">
      <div class="procurement-detail-modal__header">
        <div class="procurement-detail-modal__heading">
          <div class="procurement-detail-modal__title-row">
            <h2 class="confirm-modal__title" id="issuanceDetailTitle">Request</h2>
            <span id="issuanceDetailBadge" class="dashboard-activity__badge" hidden></span>
          </div>
          <p class="procurement-detail-meta" id="issuanceDetailMeta"></p>
        </div>
        <button type="button" class="procurement-detail-modal__close" id="issuanceDetailClose" title="Close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="procurement-detail-body" id="issuanceDetail"></div>
      <div class="procurement-detail-modal__footer" id="issuanceDetailFooter" hidden></div>
    </div>
  </div>

  <div class="procurement-overlay" id="issuanceManualOverlay" hidden>
    <div class="confirm-modal confirm-modal--wide procurement-manual-modal" role="dialog" aria-modal="true" aria-labelledby="issuanceManualTitle">
      <h2 class="confirm-modal__title" id="issuanceManualTitle">Add issuance request</h2>
      <p class="confirm-modal__message">Enter the quantities you will use. Only lines with a requested quantity greater than 0 are submitted.</p>
      <div class="procurement-manual-toolbar">
        <div class="procurement-manual-actions">
          <button type="button" class="editToggleBtn" id="issuanceManualFillOnHand" title="Fill items with current on-hand quantity">
            Fill on-hand
          </button>
          <button type="button" class="editToggleBtn" id="issuanceManualClearAll" title="Set all requested quantities back to 0">
            Clear all
          </button>
        </div>
      </div>
      <div class="inventory-search procurement-manual-search">
        <svg class="icon">
          <use xlink:href="/assets/images/sprite.svg#search"></use>
        </svg>
        <input type="text" placeholder="Search items" id="issuanceManualSearch" />
      </div>
      <div class="procurement-manual-table-wrap">
        <table class="product-section-table procurement-manual-table">
          <thead>
            <tr class="table__title">
              <td>Code</td>
              <td>Item</td>
              <td>Stock</td>
              <td>To use</td>
            </tr>
          </thead>
          <tbody id="issuanceManualBody">
            <tr><td colspan="4" class="users-empty">Loading items…</td></tr>
          </tbody>
        </table>
      </div>
      <p class="procurement-manual-hint" id="issuanceManualHint">0 lines ready</p>
      <p class="procurement-modal__error --hidden" id="issuanceManualError"></p>
      <div class="confirm-modal__actions">
        <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" id="issuanceManualCancel">Cancel</button>
        <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" id="issuanceManualConfirm">Submit request</button>
      </div>
    </div>
  </div>

  <div class="procurement-overlay" id="issuanceDenyOverlay" hidden>
    <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="issuanceDenyTitle">
      <h2 class="confirm-modal__title" id="issuanceDenyTitle">Manager rejection reason</h2>
      <p class="confirm-modal__message">This reason is required. After deny, the request can be edited, deleted, or returned to pending.</p>
      <textarea id="issuanceDenyReason" class="procurement-reason-input" rows="4" placeholder="Enter reason…"></textarea>
      <p class="procurement-modal__error --hidden" id="issuanceDenyError">Must be completed before denying.</p>
      <div class="confirm-modal__actions">
        <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" id="issuanceDenyCancel">Cancel</button>
        <button type="button" class="confirm-modal__btn confirm-modal__btn--danger" id="issuanceDenyConfirm">Deny request</button>
      </div>
    </div>
  </div>

  <div class="procurement-overlay" id="issuanceStockOverlay" hidden>
    <div class="confirm-modal confirm-modal--wide" role="dialog" aria-modal="true" aria-labelledby="issuanceStockTitle">
      <h2 class="confirm-modal__title" id="issuanceStockTitle">Enter used stock quantity</h2>
      <p class="confirm-modal__message">Entered quantities are deducted from the inventory record.</p>
      <div id="issuanceStockLines" class="procurement-stock-lines"></div>
      <p class="procurement-modal__error --hidden" id="issuanceStockError"></p>
      <div class="confirm-modal__actions">
        <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" id="issuanceStockCancel">Cancel</button>
        <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" id="issuanceStockConfirm">Save stock</button>
      </div>
    </div>
  </div>
@endsection
