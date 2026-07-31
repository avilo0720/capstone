/**
 * Shared download options modal with server-rendered live preview.
 */
class DownloadOptions {
  constructor() {
    this.overlay = null;
    this.pdfOnly = null;
    this.confirmBtn = null;
    this.columnsField = null;
    this.columnsContainer = null;
    this.previewSection = null;
    this.previewFrame = null;
    this.previewLoading = null;
    this.previewEmpty = null;
    this.previewStatus = null;
    this.modal = null;
    this.onConfirm = null;
    this.fetchPreview = null;
    this.columnApi = null;
    this.previewUrl = null;
    this.previewTimer = null;
    this.previewAbort = null;
    this.previewRequestId = 0;
    this.options = {
      format: "pdf",
      paper: "A4",
      orientation: "portrait",
      fontSize: "medium",
      rowSize: "normal",
    };
    this.bound = false;
  }

  ensureDom() {
    this.overlay = document.getElementById("downloadOptionsOverlay");
    if (!this.overlay) return false;

    this.pdfOnly = document.getElementById("downloadOptionsPdfOnly");
    this.confirmBtn = document.getElementById("downloadOptionsConfirm");
    this.columnsField = document.getElementById("downloadOptionsColumnsField");
    this.columnsContainer = document.getElementById("downloadOptionsColumns");
    this.previewSection = document.getElementById("downloadOptionsPreviewSection");
    this.previewFrame = document.getElementById("downloadPreviewFrame");
    this.previewLoading = document.getElementById("downloadPreviewLoading");
    this.previewEmpty = document.getElementById("downloadPreviewEmpty");
    this.previewStatus = document.getElementById("downloadPreviewStatus");
    this.modal = this.overlay.querySelector(".download-options-modal");

    if (!this.bound) {
      this.bindEvents();
      this.bound = true;
    }

    return true;
  }

  bindEvents() {
    const closeBtn = document.getElementById("downloadOptionsClose");
    const cancelBtn = document.getElementById("downloadOptionsCancel");
    const columnsDefault = document.getElementById("downloadColumnsDefault");
    const columnsAll = document.getElementById("downloadColumnsAll");

    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    if (cancelBtn) cancelBtn.addEventListener("click", () => this.close());

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.overlay && !this.overlay.classList.contains("--hidden")) {
        this.close();
      }
    });

    this.overlay.querySelectorAll(".download-options-chips[data-option]").forEach((group) => {
      group.addEventListener("click", (e) => {
        const chip = e.target.closest(".download-options-chip");
        if (!chip || !group.contains(chip)) return;

        const option = group.dataset.option;
        const value = chip.dataset.value;
        if (!option || !value) return;

        group.querySelectorAll(".download-options-chip").forEach((c) => c.classList.remove("--active"));
        chip.classList.add("--active");
        this.options[option] = value;

        if (option === "format") {
          this.syncPdfVisibility();
          this.syncPreviewVisibility();
        }
        this.queuePreviewRefresh();
      });
    });

    if (this.columnsContainer) {
      this.columnsContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".download-options-chip");
        if (!chip || !this.columnApi) return;
        const key = chip.dataset.column;
        if (!key) return;
        this.columnApi.onToggle(key);
        this.renderColumnChips();
        this.queuePreviewRefresh();
      });
    }

    if (columnsDefault) {
      columnsDefault.addEventListener("click", () => {
        if (!this.columnApi?.onSetDefault) return;
        this.columnApi.onSetDefault();
        this.renderColumnChips();
        this.queuePreviewRefresh();
      });
    }

    if (columnsAll) {
      columnsAll.addEventListener("click", () => {
        if (!this.columnApi?.onSetAll) return;
        this.columnApi.onSetAll();
        this.renderColumnChips();
        this.queuePreviewRefresh();
      });
    }

    if (this.confirmBtn) {
      this.confirmBtn.addEventListener("click", async () => {
        if (!this.onConfirm || this.confirmBtn.disabled) return;

        const result = this.currentOptions();

        this.setBusy(true);
        try {
          await this.onConfirm(result);
          this.close();
        } catch (err) {
          console.error("Export failed:", err);
          alert("Export failed. Please try again.");
        } finally {
          this.setBusy(false);
        }
      });
    }
  }

  syncPdfVisibility() {
    if (!this.pdfOnly) return;
    if (this.options.format === "pdf") {
      this.pdfOnly.classList.remove("--hidden");
    } else {
      this.pdfOnly.classList.add("--hidden");
    }
  }

  syncPreviewVisibility() {
    const showPreview =
      typeof this.fetchPreview === "function" && this.options.format === "pdf";
    const isExcel = this.options.format === "excel";

    if (this.previewSection) {
      this.previewSection.classList.toggle("--hidden", !showPreview);
    }
    if (this.modal) {
      this.modal.classList.toggle("download-options-modal--wide", showPreview);
      this.modal.classList.toggle("download-options-modal--compact", isExcel);
    }
    if (!showPreview) {
      if (this.previewAbort) {
        this.previewAbort.abort();
        this.previewAbort = null;
      }
      if (this.previewTimer) {
        clearTimeout(this.previewTimer);
        this.previewTimer = null;
      }
      this.clearPreviewFrame();
      this.setPreviewLoading(false);
      this.setPreviewStatus("");
    }
  }

  setActiveChip(option, value) {
    const group = this.overlay.querySelector(`.download-options-chips[data-option="${option}"]`);
    if (!group) return;
    group.querySelectorAll(".download-options-chip").forEach((chip) => {
      chip.classList.toggle("--active", chip.dataset.value === value);
    });
    this.options[option] = value;
  }

  renderColumnChips() {
    if (!this.columnsContainer || !this.columnApi) return;
    const visible = new Set(this.columnApi.getVisible());
    this.columnsContainer.innerHTML = this.columnApi.defs
      .map((col) => {
        const active = visible.has(col.key);
        const locked = col.required ? ' data-locked="true"' : "";
        return `<button type="button" class="download-options-chip${active ? " --active" : ""}" data-column="${col.key}"${locked}>${col.short}</button>`;
      })
      .join("");
  }

  currentOptions() {
    const result = { ...this.options };
    if (result.format !== "pdf") {
      delete result.paper;
      delete result.orientation;
      delete result.fontSize;
      delete result.rowSize;
    }
    return result;
  }

  setPreviewStatus(text) {
    if (this.previewStatus) this.previewStatus.textContent = text || "";
  }

  setPreviewLoading(loading) {
    if (this.previewLoading) {
      this.previewLoading.classList.toggle("--hidden", !loading);
    }
  }

  clearPreviewFrame() {
    if (this.previewFrame) {
      this.previewFrame.removeAttribute("src");
      this.previewFrame.classList.add("--hidden");
    }
    if (this.previewEmpty) {
      this.previewEmpty.classList.remove("--hidden");
    }
    this.revokePreviewUrl();
  }

  revokePreviewUrl() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  queuePreviewRefresh() {
    if (this.options.format !== "pdf" || typeof this.fetchPreview !== "function") {
      this.syncPreviewVisibility();
      return;
    }
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.setPreviewStatus("Updating…");
    this.setPreviewLoading(true);
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      this.refreshPreview();
    }, 350);
  }

  async refreshPreview() {
    if (
      !this.previewFrame ||
      typeof this.fetchPreview !== "function" ||
      this.options.format !== "pdf"
    ) {
      this.syncPreviewVisibility();
      return;
    }

    if (this.previewAbort) {
      this.previewAbort.abort();
    }
    const abort = new AbortController();
    this.previewAbort = abort;
    const requestId = ++this.previewRequestId;

    const paper = (this.options.paper || "A4").toLowerCase();
    const orientation = this.options.orientation || "portrait";
    const paperLabel =
      paper === "letter" ? "Letter" :
      paper === "legal" ? "Legal" :
      "A4";
    this.setPreviewStatus(`${paperLabel} · ${orientation}`);

    this.setPreviewLoading(true);
    if (this.previewEmpty) this.previewEmpty.classList.add("--hidden");

    try {
      const blob = await this.fetchPreview(this.currentOptions(), abort.signal);
      if (requestId !== this.previewRequestId || abort.signal.aborted) return;

      this.revokePreviewUrl();
      this.previewUrl = URL.createObjectURL(blob);
      this.previewFrame.classList.remove("--hidden");
      this.previewFrame.src = `${this.previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
      this.setPreviewLoading(false);
    } catch (err) {
      if (err?.name === "AbortError" || abort.signal.aborted) return;
      if (requestId !== this.previewRequestId) return;
      console.error("Preview failed:", err);
      this.clearPreviewFrame();
      this.setPreviewLoading(false);
      this.setPreviewStatus("Preview failed");
      if (this.previewEmpty) {
        this.previewEmpty.classList.remove("--hidden");
        this.previewEmpty.innerHTML = "<p>Could not generate preview. Try again.</p>";
      }
    }
  }

  /**
   * @param {{ format?: string, paper?: string, orientation?: string }} defaults
   * @param {(options: object) => Promise<void>} onConfirm
   * @param {{ fetchPreview?: Function, columns?: object }} extras
   */
  open(defaults = {}, onConfirm, extras = {}) {
    if (typeof onConfirm !== "function") {
      console.error("DownloadOptions.open requires an onConfirm callback");
      return;
    }

    if (!this.ensureDom()) {
      onConfirm({
        format: defaults.format || "pdf",
        paper: defaults.paper || "A4",
        orientation: defaults.orientation || "portrait",
        fontSize: defaults.fontSize || "medium",
        rowSize: defaults.rowSize || "normal",
      });
      return;
    }

    this.onConfirm = onConfirm;
    this.fetchPreview = typeof extras.fetchPreview === "function" ? extras.fetchPreview : null;
    this.columnApi = extras.columns || null;

    this.setActiveChip("format", defaults.format || "pdf");
    this.setActiveChip("paper", defaults.paper || "A4");
    this.setActiveChip("orientation", defaults.orientation || "portrait");
    this.setActiveChip("fontSize", defaults.fontSize || "medium");
    this.setActiveChip("rowSize", defaults.rowSize || "normal");
    this.syncPdfVisibility();
    this.setBusy(false);

    if (this.columnsField) {
      if (this.columnApi) {
        this.columnsField.classList.remove("--hidden");
        this.renderColumnChips();
      } else {
        this.columnsField.classList.add("--hidden");
      }
    }

    if (this.previewEmpty) {
      this.previewEmpty.innerHTML = "<p>Preview will appear here.</p>";
    }
    this.clearPreviewFrame();
    this.syncPreviewVisibility();
    this.overlay.classList.remove("--hidden");
    this.overlay.setAttribute("aria-hidden", "false");

    if (typeof this.fetchPreview === "function" && this.options.format === "pdf") {
      this.queuePreviewRefresh();
    } else {
      this.setPreviewStatus("");
      this.setPreviewLoading(false);
    }
  }

  close() {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.previewAbort) {
      this.previewAbort.abort();
      this.previewAbort = null;
    }
    this.clearPreviewFrame();
    this.setPreviewLoading(false);
    this.setPreviewStatus("");

    if (this.overlay) {
      this.overlay.classList.add("--hidden");
      this.overlay.setAttribute("aria-hidden", "true");
    }
    this.onConfirm = null;
    this.fetchPreview = null;
    this.columnApi = null;
    this.setBusy(false);
  }

  setBusy(busy) {
    if (!this.confirmBtn) return;
    this.confirmBtn.disabled = busy;
    this.confirmBtn.textContent = busy ? "Downloading…" : "Download";
  }
}

export default new DownloadOptions();
