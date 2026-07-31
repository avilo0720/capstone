@if($user)
@php
  $initials = collect(preg_split('/\s+/', trim($user['fullName'] ?? '')))
    ->filter()
    ->take(2)
    ->map(fn ($part) => strtoupper(substr($part, 0, 1)))
    ->implode('');
  if ($initials === '') $initials = '?';
@endphp
<div class="sideBar__user">
  <div class="notif">
    <button type="button" class="notif__bell" title="Notifications" aria-label="Notifications">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span class="notif__badge --hidden">0</span>
    </button>
    <div class="notif__panel --hidden">
      <div class="notif__panel-header">
        <h3 class="notif__panel-title">Notifications</h3>
        <button type="button" class="notif__mark-read" title="Mark all as read">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </button>
      </div>
      <div class="notif__panel-body"></div>
      <div class="notif__panel-footer">
        <a href="/reports" class="notif__view-all">View Full Report →</a>
      </div>
    </div>
  </div>

  <button type="button" class="sideBar__user-card" title="View profile" aria-label="View profile">
    <span class="sideBar__user-avatar" data-initials="{{ $initials }}">
      @if(!empty($user['profilePicture']))
        <img src="{{ $user['profilePicture'] }}" alt="" class="sideBar__user-avatar-img" />
      @else
        <span class="sideBar__user-avatar-initials">{{ $initials }}</span>
      @endif
    </span>
    <span class="sideBar__user-text">
      <span class="sideBar__user-name">{{ $user['fullName'] }}</span>
      <span class="sideBar__user-role">{{ $user['role'] }}</span>
      @if(!empty($user['departmentName']) && ($user['departmentName'] !== $user['role']))
        <span class="sideBar__user-dept">{{ $user['departmentName'] }}</span>
      @endif
    </span>
  </button>
</div>
@endif
