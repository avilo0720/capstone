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
        </select>
        <input type="date" class="editToggleBtn activity-logs-date" id="activityLogsDateFrom" title="From date" />
        <input type="date" class="editToggleBtn activity-logs-date" id="activityLogsDateTo" title="To date" />
        <button type="button" class="editToggleBtn" id="activityLogsClearBtn">Clear</button>
        <button type="button" class="editToggleBtn" id="activityLogsRefreshBtn" title="Refresh">Refresh</button>
      </div>
    </div>

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
@endsection
