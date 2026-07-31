<div class="download-options-overlay --hidden" id="downloadOptionsOverlay" aria-hidden="true">
  <div class="download-options-modal download-options-modal--wide" role="dialog" aria-modal="true" aria-labelledby="downloadOptionsTitle">
    <div class="download-options-modal__header">
      <h2 id="downloadOptionsTitle">Download Options</h2>
      <button type="button" class="download-options-modal__close" id="downloadOptionsClose" aria-label="Close">&times;</button>
    </div>
    <div class="download-options-modal__content">
      <div class="download-options-modal__controls">
        <div class="download-options-field">
          <p class="download-options-field__label">File format</p>
          <div class="download-options-chips" data-option="format">
            <button type="button" class="download-options-chip --active" data-value="pdf">PDF</button>
            <button type="button" class="download-options-chip" data-value="excel">Excel</button>
          </div>
        </div>

        <div class="download-options-pdf-only" id="downloadOptionsPdfOnly">
          <div class="download-options-field">
            <p class="download-options-field__label">Paper size</p>
            <div class="download-options-chips" data-option="paper">
              <button type="button" class="download-options-chip --active" data-value="A4">A4 (8.27 × 11.69 in)</button>
              <button type="button" class="download-options-chip" data-value="letter">Letter (8.5 × 11 in)</button>
              <button type="button" class="download-options-chip" data-value="legal">Legal (8.5 × 13 in)</button>
            </div>
          </div>

          <div class="download-options-field">
            <p class="download-options-field__label">Orientation</p>
            <div class="download-options-chips" data-option="orientation">
              <button type="button" class="download-options-chip --active" data-value="portrait">Portrait</button>
              <button type="button" class="download-options-chip" data-value="landscape">Landscape</button>
            </div>
          </div>

          <div class="download-options-field">
            <p class="download-options-field__label">Font size</p>
            <div class="download-options-chips" data-option="fontSize">
              <button type="button" class="download-options-chip" data-value="small">Small</button>
              <button type="button" class="download-options-chip --active" data-value="medium">Medium</button>
              <button type="button" class="download-options-chip" data-value="large">Large</button>
              <button type="button" class="download-options-chip" data-value="xlarge">Extra Large</button>
            </div>
          </div>

          <div class="download-options-field">
            <p class="download-options-field__label">Row size</p>
            <div class="download-options-chips" data-option="rowSize">
              <button type="button" class="download-options-chip" data-value="compact">Compact</button>
              <button type="button" class="download-options-chip --active" data-value="normal">Normal</button>
              <button type="button" class="download-options-chip" data-value="comfortable">Comfortable</button>
            </div>
          </div>
        </div>

        <div class="download-options-field download-options-columns-field --hidden" id="downloadOptionsColumnsField">
          <div class="download-options-field__header">
            <p class="download-options-field__label">Columns</p>
            <div class="download-options-field__actions">
              <button type="button" class="filterLinkBtn" id="downloadColumnsDefault">Default</button>
              <button type="button" class="filterLinkBtn" id="downloadColumnsAll">All</button>
            </div>
          </div>
          <div class="download-options-chips download-options-chips--multi" id="downloadOptionsColumns"></div>
        </div>
      </div>

      <div class="download-options-modal__preview" id="downloadOptionsPreviewSection">
        <div class="download-options-field__header">
          <p class="download-options-field__label">Live preview</p>
          <p class="download-preview-status" id="downloadPreviewStatus"></p>
        </div>
        <div class="download-preview-stage download-preview-stage--live" id="downloadPreviewStage">
          <div class="download-preview-frame-wrap" id="downloadPreviewFrameWrap">
            <iframe
              id="downloadPreviewFrame"
              class="download-preview-frame"
              title="Download preview"
            ></iframe>
            <div class="download-preview-loading --hidden" id="downloadPreviewLoading">
              <div class="download-preview-spinner"></div>
              <p>Generating preview…</p>
            </div>
            <div class="download-preview-empty-state" id="downloadPreviewEmpty">
              <p>Preview will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="download-options-modal__footer">
      <button type="button" class="download-options-btn download-options-btn--ghost" id="downloadOptionsCancel">Cancel</button>
      <button type="button" class="download-options-btn download-options-btn--primary" id="downloadOptionsConfirm">Download</button>
    </div>
  </div>
</div>
