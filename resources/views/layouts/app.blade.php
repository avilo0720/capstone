<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <link rel="icon" type="image/png" href="/assets/images/nabua-wave-logo.png" />
    <link rel="stylesheet" href="/src/css/font.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css" />
    <link rel="stylesheet" href="/src/css/style.css?v=130" />
    <title>{{ $title }} | Nabua Water Inventory</title>
    <script>
      // Attach the CSRF token to every same-origin request that changes data.
      (function () {
        var meta = document.querySelector('meta[name="csrf-token"]');
        var token = meta ? meta.getAttribute("content") : "";
        var nativeFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
          init = init || {};
          var method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
          var url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
          if (token && url.origin === window.location.origin && ["GET", "HEAD", "OPTIONS"].indexOf(method) === -1) {
            var headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
            if (!headers.has("X-CSRF-TOKEN")) headers.set("X-CSRF-TOKEN", token);
            init = Object.assign({}, init, { headers: headers });
          }
          return nativeFetch(input, init);
        };
      })();

      window.addEventListener("pageshow", function (event) {
        var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
        if (event.persisted || (nav && nav.type === "back_forward")) {
          window.location.reload();
        }
      });
    </script>
  </head>
  <body data-can-edit="{{ ($user['canEdit'] ?? false) ? 'true' : 'false' }}" data-can-calendar-table="{{ ($user['canViewCalendarTable'] ?? false) ? 'true' : 'false' }}" data-can-manage-users="{{ ($user['canManageUsers'] ?? false) ? 'true' : 'false' }}" data-can-procurement-add="{{ ($user['canAddProcurement'] ?? $user['canEditProcurement'] ?? false) ? 'true' : 'false' }}" data-can-procurement-edit="{{ ($user['canAddProcurement'] ?? $user['canEditProcurement'] ?? false) ? 'true' : 'false' }}" data-can-procurement-delete="{{ ($user['canDeleteProcurement'] ?? false) ? 'true' : 'false' }}" data-can-issuance-edit="{{ ($user['canEditIssuance'] ?? false) ? 'true' : 'false' }}" data-can-issuance-review="{{ ($user['canReviewIssuance'] ?? false) ? 'true' : 'false' }}" data-user-id="{{ $user['id'] ?? '' }}" data-inventory="{{ $currentInventory->slug ?? '' }}">
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
    <script src="/src/js/app.js?v=103" type="module"></script>
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
