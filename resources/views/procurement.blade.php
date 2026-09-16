@extends('layouts.app')

@section('content')
  <div class="procurement-page">
    <div class="product-section__header">
      <div class="product-section__header__title">
        <h1>Procurement</h1>
        @if($currentInventory)
          <span class="inventory-context-name">{{ $currentInventory->name }}</span>
        @endif
        <div class="users-tabs" id="procurementFilters" role="tablist">
          <button type="button" class="users-tab --active" data-status="all" role="tab">All</button>
          <button type="button" class="users-tab" data-status="pending" role="tab">Dept. head</button>
          <button type="button" class="users-tab" data-status="dept_noted" role="tab">Procurement</button>
          <button type="button" class="users-tab" data-status="procurement_checked" role="tab">Branch mgr</button>
          <button type="button" class="users-tab" data-status="approved" role="tab">Approved</button>
          <button type="button" class="users-tab" data-status="denied" role="tab">Denied</button>
          <button type="button" class="users-tab" data-status="stock_entered" role="tab">Stock entered</button>
        </div>
        <form class="inventory-search__form" onsubmit="return false;">
          <div class="inventory-search">
            <svg class="icon">
              <use xlink:href="/assets/images/sprite.svg#search"></use>
            </svg>
            <input type="text" placeholder="Search requests" id="procurementSearch" />
          </div>
        </form>
      </div>
      <div class="product-section__header__buttons">
        <button type="button" class="downloadBtn" id="procurementDownloadBtn">Download report</button>
        @if($user['canEditProcurement'] ?? false)
          <button type="button" class="addProBtn" id="procurementManualBtn">Add request</button>
        @endif
      </div>
    </div>

    <div class="module-body">
    <div class="reports-summary" id="procurementSummary">
      <button type="button" class="reports-summary__card reports-summary__card--clickable is-active" data-status="all">
        <div class="reports-summary__card-icon reports-summary__card-icon--items">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Total requests</p>
          <p class="reports-summary__card-value" id="procurementKpiTotal">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="pending">
        <div class="reports-summary__card-icon reports-summary__card-icon--leadtime">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Dept. head</p>
          <p class="reports-summary__card-value" id="procurementKpiPending">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="dept_noted">
        <div class="reports-summary__card-icon reports-summary__card-icon--value">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Procurement check</p>
          <p class="reports-summary__card-value" id="procurementKpiChecked">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="procurement_checked">
        <div class="reports-summary__card-icon reports-summary__card-icon--qty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Branch manager</p>
          <p class="reports-summary__card-value" id="procurementKpiManager">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="denied">
        <div class="reports-summary__card-icon reports-summary__card-icon--alert">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Denied</p>
          <p class="reports-summary__card-value" id="procurementKpiDenied">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="stock_entered">
        <div class="reports-summary__card-icon reports-summary__card-icon--value">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Stock entered</p>
          <p class="reports-summary__card-value" id="procurementKpiStockEntered">0</p>
        </div>
      </button>
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-status="approved">
        <div class="reports-summary__card-icon reports-summary__card-icon--qty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Approved</p>
          <p class="reports-summary__card-value" id="procurementKpiApproved">0</p>
        </div>
      </button>
    </div>

    <div class="product-section procurement-list">
      <table class="product-section-table">
        <thead>
          <tr class="table__title">
            <td>RS No.</td>
            <td>File</td>
            <td>Status</td>
            <td>Next person</td>
            <td>Lines</td>
            <td>Qty</td>
            <td>Requested by</td>
            <td>When</td>
          </tr>
        </thead>
        <tbody id="procurementTableBody">
          <tr>
            <td colspan="8" class="users-empty">Loading procurement requests…</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-pagination-container" id="procurementPagination"></div>

    </div>
  </div>

  <div class="procurement-overlay" id="procurementDetailOverlay" hidden>
    <div class="confirm-modal confirm-modal--wide procurement-detail-modal" role="dialog" aria-modal="true" aria-labelledby="procurementDetailTitle">
      <div class="procurement-detail-modal__header">
        <div class="procurement-detail-modal__heading">
          <div class="procurement-detail-modal__title-row">
            <h2 class="confirm-modal__title" id="procurementDetailTitle">Request</h2>
            <span id="procurementDetailBadge" class="dashboard-activity__badge" hidden></span>
          </div>
          <p class="procurement-detail-meta" id="procurementDetailMeta"></p>
        </div>
        <button type="button" class="procurement-detail-modal__close" id="procurementDetailClose" title="Close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="procurement-detail-body" id="procurementDetail"></div>
      <div class="procurement-detail-modal__footer" id="procurementDetailFooter" hidden></div>
    </div>
  </div>

  <div class="procurement-overlay" id="procurementManualOverlay" hidden>
    <div class="confirm-modal confirm-modal--wide procurement-manual-modal" role="dialog" aria-modal="true" aria-labelledby="procurementManualTitle">
      <h2 class="confirm-modal__title" id="procurementManualTitle">Add request slip</h2>
      <p class="confirm-modal__message">Submit a requisition slip, then pick the next person. After the branch manager approves, procurement prints the RS slip.</p>
      <div class="procurement-manual-meta">
        <label>
          <span class="procurement-manual-meta__label">To</span>
          <input type="text" id="procurementManualDestination" placeholder="e.g. Technical / Procurement" />
        </label>
        <label>
          <span class="procurement-manual-meta__label">Date needed</span>
          <input type="date" id="procurementManualDateNeeded" />
        </label>
        <label class="procurement-manual-meta__wide">
          <span class="procurement-manual-meta__label">Purpose</span>
          <input type="text" id="procurementManualPurpose" placeholder="Why these items are needed" />
        </label>
        <label class="procurement-manual-meta__wide">
          <span class="procurement-manual-meta__label">Send next to</span>
          <select id="procurementManualAssignee">
            <option value="">Select a person…</option>
          </select>
        </label>
        <div class="procurement-manual-meta__wide procurement-manual-attach">
          <span class="procurement-manual-meta__label">Attachment image <em>(optional)</em></span>
          <div class="procurement-manual-attach__row">
            <label class="procurement-manual-attach__pick">
              Choose image
              <input type="file" id="procurementManualAttachment" accept="image/png,image/jpeg,image/jpg,image/webp" hidden />
            </label>
            <button type="button" class="procurement-manual-attach__clear --hidden" id="procurementManualAttachmentClear">Remove</button>
          </div>
          <p class="procurement-manual-attach__hint" id="procurementManualAttachmentHint">PNG, JPG, or WebP · shown at the bottom of the RS slip</p>
          <img class="procurement-manual-attach__preview --hidden" id="procurementManualAttachmentPreview" alt="Attachment preview" />
        </div>
      </div>
      <div class="procurement-manual-toolbar">
        <div class="procurement-manual-actions">
          <button type="button" class="editToggleBtn" id="procurementManualFillRop" title="Fill items below ROP with the ROP deficit">
            Fill Missing ROP
          </button>
          <button type="button" class="editToggleBtn" id="procurementManualFillProcurement" title="Fill items with 3-month procurement need">
            Fill Procurement need
          </button>
          <button type="button" class="editToggleBtn" id="procurementManualClearAll" title="Set all requested quantities back to 0">
            Clear all
          </button>
        </div>
      </div>
      <div class="inventory-search procurement-manual-search">
        <svg class="icon">
          <use xlink:href="/assets/images/sprite.svg#search"></use>
        </svg>
        <input type="text" placeholder="Search items" id="procurementManualSearch" />
      </div>
      <div class="procurement-manual-table-wrap">
        <table class="product-section-table procurement-manual-table">
          <thead>
            <tr class="table__title">
              <td>Code</td>
              <td>Item</td>
              <td>Stock</td>
              <td>ROP</td>
              <td>3 mo need</td>
              <td>Requested</td>
            </tr>
          </thead>
          <tbody id="procurementManualBody">
            <tr><td colspan="6" class="users-empty">Loading items…</td></tr>
          </tbody>
        </table>
      </div>
      <p class="procurement-manual-hint" id="procurementManualHint">0 lines ready</p>
      <p class="procurement-modal__error --hidden" id="procurementManualError"></p>
      <div class="confirm-modal__actions">
        <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" id="procurementManualCancel">Cancel</button>
        <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" id="procurementManualConfirm">Submit request</button>
      </div>
    </div>
  </div>

  <div class="procurement-overlay" id="procurementDenyOverlay" hidden>
    <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="procurementDenyTitle">
      <h2 class="confirm-modal__title" id="procurementDenyTitle">Reject this request slip</h2>
      <p class="confirm-modal__message">This reason is required. The end user can then edit quantities and resubmit from step 1.</p>
      <textarea id="procurementDenyReason" class="procurement-reason-input" rows="4" placeholder="Enter reason…"></textarea>
      <p class="procurement-modal__error --hidden" id="procurementDenyError">Must be completed before denying.</p>
      <div class="confirm-modal__actions">
        <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" id="procurementDenyCancel">Cancel</button>
        <button type="button" class="confirm-modal__btn confirm-modal__btn--danger" id="procurementDenyConfirm">Deny request</button>
      </div>
    </div>
  </div>

  <div class="procurement-overlay" id="procurementStockOverlay" hidden>
    <div class="confirm-modal confirm-modal--wide" role="dialog" aria-modal="true" aria-labelledby="procurementStockTitle">
      <h2 class="confirm-modal__title" id="procurementStockTitle">Enter added stock quantity</h2>
      <p class="confirm-modal__message">Entered quantities are saved to the inventory record.</p>
      <div id="procurementStockLines" class="procurement-stock-lines"></div>
      <p class="procurement-modal__error --hidden" id="procurementStockError"></p>
      <div class="confirm-modal__actions">
        <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" id="procurementStockCancel">Cancel</button>
        <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" id="procurementStockConfirm">Save stock</button>
      </div>
    </div>
  </div>

  <div class="procurement-overlay" id="procurementHistoryOverlay" hidden>
    <div class="confirm-modal confirm-modal--wide procurement-history-modal" role="dialog" aria-modal="true" aria-labelledby="procurementHistoryTitle">
      <div class="procurement-detail-modal__header">
        <div class="procurement-detail-modal__heading">
          <h2 class="confirm-modal__title" id="procurementHistoryTitle">Request history</h2>
          <p class="procurement-detail-meta" id="procurementHistoryMeta"></p>
        </div>
        <button type="button" class="procurement-detail-modal__close" id="procurementHistoryClose" title="Close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="procurement-history-body" id="procurementHistoryBody">
        <p class="users-empty">Loading history…</p>
      </div>
    </div>
  </div>
@endsection
