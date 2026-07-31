@php
  $allowedPages = $user['pages'] ?? [];
@endphp

<div class="sideBar-ontoggle --hidden">
  <div class="sideBar__brand">
    @include('partials.sidebar-logo')
  </div>
  <div class="sideBar__icons">
    <a href="/" class="sideBar__dashboard sideBar__icon {{ $title === 'Dashboard' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon">
        <use xlink:href="/assets/images/sprite.svg#homeIcon"></use>
      </svg>
      <p>Dashboard</p>
    </a>
    @if(in_array('inventory', $allowedPages))
    <a href="/inventory" class="sideBar__inventory sideBar__icon {{ $title === 'Inventory' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon">
        <use xlink:href="/assets/images/sprite.svg#productIcon"></use>
      </svg>
      <p>Inventory</p>
    </a>
    @endif
    @if(in_array('forecast', $allowedPages))
    <a href="/forecast" class="sideBar__forecast sideBar__icon {{ $title === 'Forecasting' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <img src="/assets/images/Categories.svg" alt="forecast icon" />
      <p>Forecasting</p>
    </a>
    @endif
    @if(in_array('reports', $allowedPages))
    <a href="/reports" class="sideBar__reports sideBar__icon {{ $title === 'Reports' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <p>Reports</p>
    </a>
    @endif
    @if(in_array('calendar', $allowedPages))
    <a href="/calendar" class="sideBar__calendar sideBar__icon {{ $title === 'Calendar' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p>Calendar</p>
    </a>
    @endif
    @if(in_array('activity-logs', $allowedPages))
    <a href="/activity-logs" class="sideBar__activity sideBar__icon {{ $title === 'Activity Logs' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
      <p>Activity</p>
    </a>
    @endif
    @if(in_array('users', $allowedPages))
    <a href="/users" class="sideBar__users sideBar__icon {{ $title === 'Users' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <p>Users</p>
    </a>
    @endif
  </div>
  @include('partials.sidebar-user')
</div>
<div class="sideBar-ontoggle-backdrop --hidden"></div>

<div class="sideBar">
  <div class="sideBar__brand">
    @include('partials.sidebar-logo')
  </div>

  <div class="sideBar__icons">
    <a href="/" class="sideBar__dashboard sideBar__icon {{ $title === 'Dashboard' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon">
        <use xlink:href="/assets/images/sprite.svg#homeIcon"></use>
      </svg>
      <p>Dashboard</p>
    </a>
    @if(in_array('inventory', $allowedPages))
    <a href="/inventory" class="sideBar__inventory sideBar__icon {{ $title === 'Inventory' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon">
        <use xlink:href="/assets/images/sprite.svg#productIcon"></use>
      </svg>
      <p>Inventory</p>
    </a>
    @endif
    @if(in_array('forecast', $allowedPages))
    <a href="/forecast" class="sideBar__forecast sideBar__icon {{ $title === 'Forecasting' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <img src="/assets/images/Categories.svg" alt="forecast icon" />
      <p>Forecasting</p>
    </a>
    @endif
    @if(in_array('reports', $allowedPages))
    <a href="/reports" class="sideBar__reports sideBar__icon {{ $title === 'Reports' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <p>Reports</p>
    </a>
    @endif
    @if(in_array('calendar', $allowedPages))
    <a href="/calendar" class="sideBar__calendar sideBar__icon {{ $title === 'Calendar' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p>Calendar</p>
    </a>
    @endif
    @if(in_array('activity-logs', $allowedPages))
    <a href="/activity-logs" class="sideBar__activity sideBar__icon {{ $title === 'Activity Logs' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
      <p>Activity</p>
    </a>
    @endif
    @if(in_array('users', $allowedPages))
    <a href="/users" class="sideBar__users sideBar__icon {{ $title === 'Users' ? '--selectedBtnUi' : '' }}" style="text-decoration: none; color: inherit;">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <p>Users</p>
    </a>
    @endif
  </div>

  @include('partials.sidebar-user')
</div>
