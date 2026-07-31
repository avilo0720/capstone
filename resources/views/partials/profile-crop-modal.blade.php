@if($user)
<div class="profile-crop-overlay --hidden" id="profileCropOverlay">
  <div class="profile-crop-modal" role="dialog" aria-modal="true" aria-labelledby="profileCropTitle">
    <div class="profile-crop-modal__header">
      <h2 id="profileCropTitle">Adjust photo</h2>
      <button type="button" class="profile-crop-modal__close" id="profileCropClose" aria-label="Close">&times;</button>
    </div>

    <div class="profile-crop-modal__stage">
      <img id="profileCropImage" alt="Crop preview" />
      <div class="profile-crop-modal__tools">
        <button type="button" class="profile-crop-tool" id="profileCropZoomOut" title="Zoom out" aria-label="Zoom out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button type="button" class="profile-crop-tool" id="profileCropZoomIn" title="Zoom in" aria-label="Zoom in">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button type="button" class="profile-crop-tool" id="profileCropRotate" title="Rotate" aria-label="Rotate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
        </button>
      </div>
    </div>

    <p class="profile-crop-modal__hint">Drag to move · scroll to zoom</p>

    <div class="profile-crop-modal__footer">
      <button type="button" class="profile-btn profile-btn--ghost" id="profileCropCancel">Cancel</button>
      <button type="button" class="profile-btn profile-btn--primary" id="profileCropApply">Use photo</button>
    </div>
  </div>
</div>
@endif
