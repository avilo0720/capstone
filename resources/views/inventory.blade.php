@extends('layouts.app')

@section('content')
  <div class="inventory-app">
    <div class="product-section__header">
      <div class="product-section__header__title">
        <h1>Items</h1>
        <form class="inventory-search__form" onsubmit="return false;">
          <div class="inventory-search">
            <svg class="icon">
              <use xlink:href="/assets/images/sprite.svg#search"></use>
            </svg>
            <input
              type="text"
              placeholder="Search product"
              class="searchBarInput"
            />
          </div>
        </form>
      </div>
      <div class="product-section__header__buttons">
        <button type="button" class="addProBtn">Add New Item</button>
        <button type="button" class="stockToggleBtn">Adjust Stock</button>
        <button type="button" class="editToggleBtn">Edit</button>
        <button type="button" class="downloadBtn">Download</button>
        <div class="filterDropdown">
          <button type="button" class="filterBtn">
            <img src="/assets/images/filterIcon.svg" alt="filter Icon" />
            <p>Filters</p>
          </button>
          <div class="inventoryFilterPanel --hidden">
            <div class="filterGroup">
              <p class="filterGroupTitle">FSN</p>
              <div class="filterGroupOptions">
                <button type="button" class="filterOptionBtn" data-group="fsn" data-value="F">F</button>
                <button type="button" class="filterOptionBtn" data-group="fsn" data-value="S">S</button>
                <button type="button" class="filterOptionBtn" data-group="fsn" data-value="N">N</button>
              </div>
            </div>
            <div class="filterGroup">
              <p class="filterGroupTitle">Trigger Point</p>
              <div class="filterGroupOptions">
                <button type="button" class="filterOptionBtn" data-group="trigger" data-value="RS Needed">RS Needed</button>
                <button type="button" class="filterOptionBtn" data-group="trigger" data-value="Sufficient">Sufficient</button>
              </div>
            </div>
            <div class="filterGroup filterGroup--columns">
              <div class="filterGroupHeader">
                <p class="filterGroupTitle">Columns</p>
                <div class="filterGroupHeaderActions">
                  <button type="button" class="filterLinkBtn" data-action="columns-default">Default</button>
                  <button type="button" class="filterLinkBtn" data-action="columns-all">All</button>
                </div>
              </div>
              <p class="filterGroupHint">Toggle which columns show in the table and downloads.</p>
              <div class="filterGroupOptions" id="inventoryColumnToggles"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="stock-mode-banner --hidden" id="stockModeBanner" role="status">
      Enter a quantity, then choose <strong>Use</strong> or <strong>Add</strong>.
    </div>

    <div class="product-section">
      <table class="product-section-table"></table>
    </div>
    <div class="table-pagination-container" id="inventoryPagination"></div>
  </div>
  @include('partials.add-product-modal')
  @include('partials.view-item-modal')
@endsection
