@extends('layouts.app')

@section('content')
  <div class="activity-logs-page">
    <div class="product-section__header">
      <div class="product-section__header__title">
        <h1>Activity Logs</h1>
        <form class="inventory-search__form activity-logs-search__form" onsubmit="return false;">
          <div class="inventory-search">
            <svg class="icon">
              <use xlink:href="/assets/images/sprite.svg#search"></use>
            </svg>
            <input
              type="text"
              placeholder="Search activity"
              class="activityLogsSearchInput"
              id="activityLogsSearch"
            />
          </div>
        </form>
      </div>
      <div class="product-section__header__buttons">
        <select class="editToggleBtn activity-logs-select" id="activityLogsAction" title="Filter by action">
          <option value="">All actions</option>
          <option value="created">Added</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
          <option value="stock_added">Stock +</option>
          <option value="stock_used">Stock −</option>
          <option value="procurement_submitted">Procurement submitted</option>
          <option value="procurement_dept_noted">Procurement noted</option>
          <option value="procurement_checked">Procurement checked</option>
          <option value="procurement_approved">Procurement approved</option>
          <option value="procurement_printed">Procurement printed</option>
          <option value="procurement_denied">Procurement denied</option>
          <option value="procurement_stock_entered">Procurement stock</option>
          <option value="procurement_edited">Procurement edited</option>
          <option value="procurement_resubmitted">Procurement resubmitted</option>
          <option value="procurement_returned">Procurement returned</option>
          <option value="procurement_deleted">Procurement deleted</option>
          <option value="issuance_submitted">Issuance submitted</option>
          <option value="issuance_approved">Issuance approved</option>
          <option value="issuance_denied">Issuance denied</option>
          <option value="issuance_stock_used">Issuance stock used</option>
          <option value="issuance_edited">Issuance edited</option>
          <option value="issuance_resubmitted">Issuance resubmitted</option>
          <option value="issuance_deleted">Issuance deleted</option>
        </select>
        <input type="date" class="editToggleBtn activity-logs-date" id="activityLogsDateFrom" title="From date" />
        <input type="date" class="editToggleBtn activity-logs-date" id="activityLogsDateTo" title="To date" />
        <button type="button" class="editToggleBtn" id="activityLogsRefreshBtn" title="Refresh">Refresh</button>
      </div>
    </div>

    <div class="module-body">
    <div class="product-section">
      <table class="product-section-table activity-logs-table">
        <thead>
          <tr class="table__title">
            <td>When</td>
            <td>User</td>
            <td>Action</td>
            <td>Description</td>
          </tr>
        </thead>
        <tbody id="activityLogsTableBody">
          <tr>
            <td colspan="4" class="users-empty">Loading activity…</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-pagination-container" id="activityLogsPagination"></div>
    </div>
  </div>

  <div class="viewItemSection --hidden" id="activityLogDetailOverlay">
    <div class="viewItemModal activity-log-detail-modal">
      <div class="viewItemModal__header">
        <h2 class="viewItemModal__title" id="activityLogDetailTitle">Activity details</h2>
        <button type="button" class="viewItemModal__close" id="activityLogDetailClose" title="Close">&times;</button>
      </div>
      <div class="viewItemModal__body" id="activityLogDetailBody"></div>
    </div>
  </div>
@endsection
