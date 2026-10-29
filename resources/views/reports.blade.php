@extends('layouts.app')

@section('content')
  <div class="reports-page">
    <div class="reports-page__header">
      <div class="page-title-group">
        <h1>Reports & Alerts</h1>
        @if($currentInventory)
          <span class="inventory-context-name">{{ $currentInventory->name }}</span>
        @endif
      </div>
      <div class="reports-page__header__actions">
        <button type="button" class="reportDownloadBtn" id="reportDownloadBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Report
        </button>
      </div>
    </div>

    <div class="module-body">
    <div class="reports-summary" id="reportsSummary">
      <div class="reports-summary__card">
        <div class="reports-summary__card-icon reports-summary__card-icon--items">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Total Items</p>
          <p class="reports-summary__card-value" id="reportTotalItems">—</p>
        </div>
      </div>
      <div class="reports-summary__card">
        <div class="reports-summary__card-icon reports-summary__card-icon--qty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Total Quantity</p>
          <p class="reports-summary__card-value" id="reportTotalQty">—</p>
        </div>
      </div>
      <div class="reports-summary__card">
        <div class="reports-summary__card-icon reports-summary__card-icon--value">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Total Value</p>
          <p class="reports-summary__card-value" id="reportTotalValue">—</p>
        </div>
      </div>
      <div class="reports-summary__card reports-summary__card--alert">
        <div class="reports-summary__card-icon reports-summary__card-icon--alert">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label" id="reportLowStockLabel">Restock needed (3 months)</p>
          <p class="reports-summary__card-value" id="reportLowStockCount">—</p>
        </div>
      </div>
    </div>

    @php
      $canOpen = fn (string $page) => \App\Support\RolePermissions::canAccessPage($user ?? null, $page);
    @endphp
    <section class="reports-library" aria-labelledby="reportsLibraryTitle">
      <div class="reports-forecast-charts__header">
        <h2 id="reportsLibraryTitle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
          All Reports
        </h2>
        <p class="reports-forecast-charts__desc">Download any report as PDF or Excel. Reports use the inventory selected in the sidebar.</p>
      </div>
      <div class="reports-library__grid">
        <article class="reports-library__card">
          <h3>Inventory summary &amp; low-stock alerts</h3>
          <p>Totals for items, quantity, and value, plus every item that needs restocking.</p>
          <button type="button" class="reportDownloadBtn" data-report="summary">Download</button>
        </article>

        @if($canOpen('inventory'))
          <article class="reports-library__card">
            <h3>Inventory list</h3>
            <p>Every item with stock, AMC, FSN, reorder levels, costs, and trigger point.</p>
            <button type="button" class="reportDownloadBtn" data-report="inventory">Download</button>
          </article>
        @endif

        @if($canOpen('forecast'))
          <article class="reports-library__card">
            <h3>Inventory forecast</h3>
            <p>Current quantity as of today, AMC, and restock needed for 3 months, 6 months, and 1 year.</p>
            <label class="reports-library__field">
              <span>AMC basis</span>
              <select id="reportsForecastMode">
                <option value="forecast">Forecast AMC</option>
                <option value="inventory">AMC</option>
                <option value="combined">Combined AMC</option>
              </select>
            </label>
            <button type="button" class="reportDownloadBtn" data-report="forecast">Download</button>
          </article>
        @endif

        @if($canOpen('procurement'))
          <article class="reports-library__card">
            <h3>Procurement requests</h3>
            <p>All request slips with status, signers, quantities, and dates.</p>
            <button type="button" class="reportDownloadBtn" data-report="procurement">Download</button>
          </article>
        @endif

        @if($canOpen('calendar') && !empty($user['canViewCalendarTable']))
          <article class="reports-library__card">
            <h3>Monthly transactions</h3>
            <p>Stock added and used per item for each day of the month.</p>
            <label class="reports-library__field">
              <span>Month</span>
              <input type="month" id="reportsCalendarMonth" value="{{ now()->format('Y-m') }}" />
            </label>
            <label class="reports-library__check">
              <input type="checkbox" id="reportsCalendarHideEmpty" checked />
              <span>Hide items and days with no transactions</span>
            </label>
            <button type="button" class="reportDownloadBtn" data-report="calendar">Download</button>
          </article>
        @endif
      </div>
    </section>

    <div class="reports-forecast-charts" id="reportsForecastCharts">
      <div class="reports-forecast-charts__header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Forecasting Overview
        </h2>
        <p class="reports-forecast-charts__desc">Items that need the most stock in the next 3 months, based on the forecast</p>
      </div>
      <div class="reports-forecast-charts__grid reports-forecast-charts__grid--single">
        <div class="reports-chart-card">
          <h3>Top Restock Needs (3 Months)</h3>
          <canvas id="reportsNeedChart" height="220"></canvas>
        </div>
      </div>
    </div>

    <div class="reports-alerts">
      <div class="reports-alerts__header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Low-Stock Alerts
        </h2>
        <div class="reports-alerts__controls">
          <p class="reports-alerts__desc">Items whose current quantity will not last the selected window at the forecast monthly use.</p>
          <label class="reports-alerts__window">
            <span>Restock window</span>
            <select id="reportsAlertWindow">
              <option value="3" selected>3 months</option>
              <option value="6">6 months</option>
              <option value="12">1 year</option>
            </select>
          </label>
        </div>
      </div>
      <div class="reports-alerts__body" id="reportsAlertsBody">
        <div class="reports-alerts__loading">Loading alerts...</div>
      </div>
      <div class="table-pagination-container" id="reportsPagination"></div>
    </div>
    </div>
  </div>
@endsection
