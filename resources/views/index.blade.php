@extends('layouts.app')

@section('content')
  <div class="dashboardUi">
    <div class="dashboardUi__header">
      <h1>Overview</h1>
    </div>

    <div class="reports-summary dashboardUi__summary">
      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-metric="items">
        <div class="reports-summary__card-icon reports-summary__card-icon--items">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Number of Items</p>
          <p class="reports-summary__card-value" id="dashboardItems">0</p>
        </div>
      </button>

      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-metric="quantity">
        <div class="reports-summary__card-icon reports-summary__card-icon--qty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Total Quantity</p>
          <p class="reports-summary__card-value" id="dashboardQty">0</p>
        </div>
      </button>

      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-metric="value">
        <div class="reports-summary__card-icon reports-summary__card-icon--value">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Total Value in Hand</p>
          <p class="reports-summary__card-value" id="dashboardSales">₱0</p>
        </div>
      </button>

      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-metric="totalCost">
        <div class="reports-summary__card-icon reports-summary__card-icon--cost">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Subtotal of Total Cost</p>
          <p class="reports-summary__card-value" id="dashboardSubtotalTotalCost">₱0</p>
        </div>
      </button>

      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-metric="restockCost">
        <div class="reports-summary__card-icon reports-summary__card-icon--restock">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Subtotal Cost (RS Needed)</p>
          <p class="reports-summary__card-value" id="dashboardSubtotalRestockCost">₱0</p>
        </div>
      </button>

      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-metric="restockPerLead">
        <div class="reports-summary__card-icon reports-summary__card-icon--leadtime">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">RS Needed Cost / Total Procurement Lead Time</p>
          <p class="reports-summary__card-value" id="dashboardRestockPerLeadTime">₱0</p>
        </div>
      </button>

      <button type="button" class="reports-summary__card reports-summary__card--clickable" data-metric="halfRestock">
        <div class="reports-summary__card-icon reports-summary__card-icon--half">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="reports-summary__card-info">
          <p class="reports-summary__card-label">Half of RS Needed Cost</p>
          <p class="reports-summary__card-value" id="dashboardHalfRestockCost">₱0</p>
        </div>
      </button>
    </div>

    <div class="dashboard-alerts" id="dashboardAlerts"></div>

    @if(in_array('activity-logs', $user['pages'] ?? [], true) || ($user['canManageUsers'] ?? false))
    <section class="dashboard-activity" id="dashboardActivity">
      <div class="dashboard-activity__header">
        <div class="dashboard-activity__title">
          <h2>Recent Activity</h2>
          <p class="dashboard-activity__subtitle">Latest 5 actions</p>
        </div>
        <div class="dashboard-activity__controls">
          <button type="button" class="dashboard-activity__refresh" id="activityRefreshBtn" title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
          <a href="/activity-logs" class="dashboard-activity__view-all">View all →</a>
        </div>
      </div>
      <div class="dashboard-activity__body" id="activityLogList">
        <p class="dashboard-activity__loading">Loading activity…</p>
      </div>
    </section>
    @endif
  </div>

  <div class="metric-explain-overlay --hidden" id="metricExplainOverlay">
    <div class="metric-explain-modal" role="dialog" aria-modal="true" aria-labelledby="metricExplainTitle">
      <div class="metric-explain-modal__header">
        <h2 id="metricExplainTitle">Metric breakdown</h2>
        <button type="button" class="metric-explain-modal__close" id="metricExplainClose" aria-label="Close">&times;</button>
      </div>
      <div class="metric-explain-modal__body" id="metricExplainBody"></div>
    </div>
  </div>
@endsection
