<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/src/css/font.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css" />
    <link rel="stylesheet" href="/src/css/style.css?v=95" />
    <title>{{ $title }} | Nabua Water Inventory</title>
  </head>
  <body data-can-edit="{{ ($user['canEdit'] ?? false) ? 'true' : 'false' }}" data-can-calendar-table="{{ ($user['canViewCalendarTable'] ?? false) ? 'true' : 'false' }}" data-can-manage-users="{{ ($user['canManageUsers'] ?? false) ? 'true' : 'false' }}" data-can-procurement-edit="{{ ($user['canEditProcurement'] ?? false) ? 'true' : 'false' }}" data-can-procurement-review="{{ ($user['canReviewProcurement'] ?? false) ? 'true' : 'false' }}" data-can-issuance-edit="{{ ($user['canEditIssuance'] ?? false) ? 'true' : 'false' }}" data-can-issuance-review="{{ ($user['canReviewIssuance'] ?? false) ? 'true' : 'false' }}" data-user-id="{{ $user['id'] ?? '' }}" data-inventory="{{ $currentInventory->slug ?? '' }}">
    @include('partials.sidebar')
    <div class="app container">
      @include('partials.header')
      <div class="main">
        <div class="app-loading" id="appLoading" role="status" aria-live="polite" aria-busy="true">
          <div class="app-loading__card">
            <div class="app-loading__spinner" aria-hidden="true"></div>
            <p class="app-loading__title">Loading</p>
            <p class="app-loading__text">Please wait…</p>
          </div>
        </div>
        @yield('content')
      </div>
    </div>
    @include('partials.download-options-modal')
    @include('partials.profile-modal')
    @include('partials.profile-crop-modal')
    <script type="application/json" id="assigneeDirectory">@json($assigneeDirectory ?? [])</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js"></script>
    <script src="/src/js/app.js?v=93" type="module"></script>
    <script>
      setTimeout(function () {
        var overlay = document.getElementById("appLoading");
        if (overlay) {
          overlay.classList.add("app-loading--done");
          overlay.setAttribute("aria-busy", "false");
        }
      }, 8000);
    </script>
  </body>
</html>
