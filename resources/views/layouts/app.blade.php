<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/src/css/font.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css" />
    <link rel="stylesheet" href="/src/css/style.css?v=54" />
    <title>{{ $title }} | Inventory</title>
  </head>
  <body data-can-edit="{{ ($user['canEdit'] ?? false) ? 'true' : 'false' }}">
    @include('partials.sidebar')
    <div class="app container">
      @include('partials.header')
      <div class="main">
        @yield('content')
      </div>
    </div>
    @include('partials.download-options-modal')
    @include('partials.profile-modal')
    @include('partials.profile-crop-modal')
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js"></script>
    <script src="/src/js/app.js?v=49" type="module"></script>
  </body>
</html>
