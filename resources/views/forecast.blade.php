@extends('layouts.app')

@section('content')
  <div class="forecastUi">
    <div class="product-section__header">
      <div class="product-section__header__title">
        <h1>Inventory Forecasting</h1>
        @if($currentInventory)
          <span class="inventory-context-name">{{ $currentInventory->name }}</span>
        @endif
        <div class="forecast-info">
          <button
            type="button"
            class="forecast-info__btn"
            id="forecastInfoBtn"
            aria-expanded="false"
            aria-controls="forecastAlgoPanel"
            title="Forecasting algorithms"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
          <div class="forecast-info__panel --hidden" id="forecastAlgoPanel" role="dialog" aria-labelledby="forecastAlgoTitle">
            <h3 class="forecast-algo-panel__title" id="forecastAlgoTitle">Forecasting Algorithms</h3>
            <div class="forecast-algo-panel__grid">
              <div class="forecast-algo-card">
                <h4>Weighted Moving Average (WMA)</h4>
                <p>Used for items with regular demand (usage on ≥33% of days in the analysis period). Aggregates daily usage into calendar months, then applies weights 1, 2, 3 to the last three months:</p>
                <code class="forecast-algo-formula">Forecast = (M₁×1 + M₂×2 + M₃×3) ÷ 6</code>
              </div>
              <div class="forecast-algo-card">
                <h4>Croston's Method</h4>
                <p>Used for intermittent demand (usage on &lt;33% of days). Separately smooths demand size and interval between usage events (α = 0.2), then derives a daily rate:</p>
                <code class="forecast-algo-formula">Daily Rate = Smoothed Size ÷ Smoothed Interval</code>
                <p class="forecast-algo-note">Monthly forecast = Daily Rate × 30</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="product-section__header__buttons --hidden" id="forecastActions">
        <div class="amc-toggle" id="amcToggleGroup">
          <input type="radio" id="amcForecast" name="amcMode" value="forecast" checked>
          <label for="amcForecast">Forecast AMC</label>

          <input type="radio" id="amcInventory" name="amcMode" value="inventory">
          <label for="amcInventory">Inventory AMC</label>

          <input type="radio" id="amcCombined" name="amcMode" value="combined">
          <label for="amcCombined">Combined AMC</label>
        </div>

        <button type="button" class="downloadBtn" id="forecastDownloadBtn">Download</button>
        <button type="button" class="downloadBtn" id="forecastSendProcurementBtn">Send to Procurement</button>
      </div>
    </div>

    <div class="forecast-visuals --hidden" id="forecastVisuals">
      <div class="reports-summary forecast-summary" id="forecastSummary">
        <div class="reports-summary__card">
          <div class="reports-summary__card-icon reports-summary__card-icon--items">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <div class="reports-summary__card-info">
            <p class="reports-summary__card-label">Items Forecasted</p>
            <p class="reports-summary__card-value" id="forecastKpiItems">—</p>
          </div>
        </div>
        <div class="reports-summary__card reports-summary__card--alert">
          <div class="reports-summary__card-icon reports-summary__card-icon--alert">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="reports-summary__card-info">
            <p class="reports-summary__card-label">Need Restock (3 mo)</p>
            <p class="reports-summary__card-value" id="forecastKpiRestock">—</p>
          </div>
        </div>
        <div class="reports-summary__card">
          <div class="reports-summary__card-icon reports-summary__card-icon--qty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="reports-summary__card-info">
            <p class="reports-summary__card-label">Avg Monthly Demand</p>
            <p class="reports-summary__card-value" id="forecastKpiAmc">—</p>
          </div>
        </div>
        <div class="reports-summary__card">
          <div class="reports-summary__card-icon reports-summary__card-icon--leadtime">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="reports-summary__card-info">
            <p class="reports-summary__card-label">Median Stock Cover</p>
            <p class="reports-summary__card-value" id="forecastKpiCover">—</p>
          </div>
        </div>
      </div>

      <div class="forecast-overview">
        <div class="forecast-overview__header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Demand Overview
          </h2>
          <p>Stock coverage, forecast methods, and the largest restock gaps across this inventory</p>
        </div>

        <div class="forecast-coverage-mix" id="forecastCoverageMix"></div>

        <div class="forecast-overview__grid">
          <div class="forecast-chart-card">
            <h3>Method Mix</h3>
            <canvas id="forecastMethodChart" height="240"></canvas>
          </div>
          <div class="forecast-chart-card">
            <h3>Top Restock Needs (3 Months)</h3>
            <canvas id="forecastNeedChart" height="240"></canvas>
          </div>
        </div>
      </div>
    </div>

    <p class="forecast-table-hint --hidden" id="forecastTableHint">Click a row to inspect daily demand and stock runway</p>

    <div class="product-section --hidden" id="forecastTableWrapper">
      <table class="forecast-section-table"></table>
      <div class="table-pagination-container" id="forecastPagination"></div>
    </div>

    <div id="forecastChartHost" class="forecast-chart-host" aria-hidden="true">
      <div class="forecast-chart-panel --hidden" id="forecastChartPanel">
        <div class="forecast-chart-panel__header">
          <div class="forecast-chart-panel__heading">
            <h2 id="forecastChartTitle">Demand Timeline</h2>
            <div class="forecast-chart-legend">
              <span class="forecast-chart-legend__item">
                <i class="forecast-chart-legend__swatch forecast-chart-legend__swatch--demand"></i>
                Actual demand
              </span>
              <span class="forecast-chart-legend__item forecast-chart-legend__forecast">
                <i class="forecast-chart-legend__swatch forecast-chart-legend__swatch--forecast"></i>
                Forecast rate
              </span>
              <span class="forecast-chart-legend__item">
                <i class="forecast-chart-legend__swatch forecast-chart-legend__swatch--stock"></i>
                Projected stock
              </span>
            </div>
          </div>
          <button type="button" class="forecast-chart-panel__close" id="forecastChartClose" title="Close chart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="forecast-chart-grid">
          <div class="forecast-chart-wrapper">
            <h3 class="forecast-chart-wrapper__title">Daily demand</h3>
            <canvas id="forecastChart" width="900" height="280"></canvas>
          </div>
          <div class="forecast-chart-wrapper">
            <h3 class="forecast-chart-wrapper__title">Stock runway (12 months)</h3>
            <canvas id="forecastRunwayChart" width="520" height="280"></canvas>
          </div>
        </div>
        <div class="forecast-stat-cards" id="forecastStatCards">
          <div class="forecast-stat-card">
            <span class="forecast-stat-card__label">Monthly Forecast</span>
            <span class="forecast-stat-card__value" id="statForecast">—</span>
          </div>
          <div class="forecast-stat-card">
            <span class="forecast-stat-card__label">Avg Demand Size</span>
            <span class="forecast-stat-card__value" id="statDemandSize">—</span>
          </div>
          <div class="forecast-stat-card">
            <span class="forecast-stat-card__label">Avg Interval</span>
            <span class="forecast-stat-card__value" id="statInterval">—</span>
          </div>
          <div class="forecast-stat-card">
            <span class="forecast-stat-card__label">Method</span>
            <span class="forecast-stat-card__value" id="statMethod">—</span>
          </div>
        </div>
      </div>
    </div>
  </div>
@endsection
