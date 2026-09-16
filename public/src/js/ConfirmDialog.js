/**
 * Shared confirmation / notice dialogs.
 * Returns Promise<boolean> — true if the user confirms (always true for notices).
 */
import { bindBackdropClose } from "./OverlayDismiss.js";

export default function confirmAction({
  title = "Confirm",
  message = "Are you sure you want to continue?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  notice = false,
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector(".confirm-dialog-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay confirm-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "confirmModalTitle");

    const confirmClass = danger
      ? "confirm-modal__btn confirm-modal__btn--danger"
      : "confirm-modal__btn confirm-modal__btn--primary";

    const tone = danger ? "danger" : notice ? "info" : "default";
    const icon = danger
      ? `<span class="confirm-modal__icon confirm-modal__icon--danger" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </span>`
      : notice
        ? `<span class="confirm-modal__icon confirm-modal__icon--info" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </span>`
        : `<span class="confirm-modal__icon confirm-modal__icon--default" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
            </svg>
          </span>`;

    const cancelBtn = notice
      ? ""
      : `<button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-confirm-cancel></button>`;

    overlay.innerHTML = `
      <div class="confirm-modal confirm-modal--${tone}">
        <div class="confirm-modal__header">
          ${icon}
          <div class="confirm-modal__heading">
            <h2 class="confirm-modal__title" id="confirmModalTitle"></h2>
          </div>
        </div>
        <p class="confirm-modal__message"></p>
        <div class="confirm-modal__actions">${cancelBtn}
          <button type="button" class="${confirmClass}" data-confirm-ok></button>
        </div>
      </div>
    `;

    overlay.querySelector(".confirm-modal__title").textContent = title;
    overlay.querySelector(".confirm-modal__message").textContent = message;
    const cancelEl = overlay.querySelector("[data-confirm-cancel]");
    if (cancelEl) cancelEl.textContent = cancelLabel;
    overlay.querySelector("[data-confirm-ok]").textContent = confirmLabel;

    let closed = false;
    const finish = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(notice ? true : false);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
    };

    cancelEl?.addEventListener("click", () => finish(false));
    overlay.querySelector("[data-confirm-ok]").addEventListener("click", () => finish(true));
    bindBackdropClose(overlay, () => finish(notice ? true : false));

    document.body.appendChild(overlay);
    overlay.querySelector("[data-confirm-ok]").focus();

    setTimeout(() => {
      if (!closed) document.addEventListener("keydown", onKeyDown);
    }, 50);
  });
}

/** Ask the user to pick the next person (and optionally sign). Returns { assignedTo, signature } or null. */
export function pickAssignee({
  title = "Send to next person",
  message = "Choose who should handle the next step. This is a person, not a fixed role.",
  people = [],
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  requireSignature = false,
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector(".confirm-dialog-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay confirm-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "confirmModalTitle");

    const options = (Array.isArray(people) ? people : [])
      .map((person) => {
        const bits = [person.role, person.department].filter(Boolean).join(" · ");
        const label = bits ? `${person.name} — ${bits}` : person.name;
        return `<option value="${person.id}">${escapeOption(label)}</option>`;
      })
      .join("");

    const signatureBlock = requireSignature ? signaturePadMarkup() : "";

    overlay.innerHTML = `
      <div class="confirm-modal confirm-modal--default ${requireSignature ? "confirm-modal--signature" : ""}">
        <div class="confirm-modal__header">
          <span class="confirm-modal__icon confirm-modal__icon--default" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
            </svg>
          </span>
          <div class="confirm-modal__heading">
            <h2 class="confirm-modal__title" id="confirmModalTitle"></h2>
          </div>
        </div>
        <p class="confirm-modal__message"></p>
        <label class="confirm-modal__field">
          <span>Next person</span>
          <select id="confirmAssigneeSelect">
            <option value="">Select a person…</option>
            ${options}
          </select>
        </label>
        <p class="confirm-modal__hint">Anyone can be chosen. They do not have to match a department or job title.</p>
        ${signatureBlock}
        <div class="confirm-modal__actions">
          <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-confirm-cancel></button>
          <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-confirm-ok></button>
        </div>
      </div>
    `;

    overlay.querySelector(".confirm-modal__title").textContent = title;
    overlay.querySelector(".confirm-modal__message").textContent = message;
    overlay.querySelector("[data-confirm-cancel]").textContent = cancelLabel;
    overlay.querySelector("[data-confirm-ok]").textContent = confirmLabel;

    const select = overlay.querySelector("#confirmAssigneeSelect");
    const signatureApi = requireSignature ? bindSignaturePad(overlay) : null;
    let closed = false;
    const finish = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const submit = () => {
      const value = Number(select.value || 0);
      if (!value) {
        select.focus();
        return;
      }
      let signature = null;
      if (requireSignature) {
        signature = signatureApi?.getDataUrl();
        if (!signature) {
          signatureApi?.showError("Draw or upload your signature before continuing.");
          return;
        }
      }
      finish({ assignedTo: value, signature });
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    };

    overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => finish(null));
    overlay.querySelector("[data-confirm-ok]").addEventListener("click", submit);
    bindBackdropClose(overlay, () => finish(null));
    document.body.appendChild(overlay);
    select.focus();
    setTimeout(() => {
      if (!closed) document.addEventListener("keydown", onKeyDown);
    }, 50);
  });
}

/** Capture only a signature. Returns a data URL string or null. */
export function captureSignature({
  title = "Add your signature",
  message = "Draw your signature or upload an image. It will appear on the RS slip.",
  confirmLabel = "Save signature",
  cancelLabel = "Cancel",
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector(".confirm-dialog-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay confirm-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "confirmModalTitle");

    overlay.innerHTML = `
      <div class="confirm-modal confirm-modal--default confirm-modal--signature">
        <div class="confirm-modal__header">
          <span class="confirm-modal__icon confirm-modal__icon--default" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
            </svg>
          </span>
          <div class="confirm-modal__heading">
            <h2 class="confirm-modal__title" id="confirmModalTitle"></h2>
          </div>
        </div>
        <p class="confirm-modal__message"></p>
        ${signaturePadMarkup()}
        <div class="confirm-modal__actions">
          <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-confirm-cancel></button>
          <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-confirm-ok></button>
        </div>
      </div>
    `;

    overlay.querySelector(".confirm-modal__title").textContent = title;
    overlay.querySelector(".confirm-modal__message").textContent = message;
    overlay.querySelector("[data-confirm-cancel]").textContent = cancelLabel;
    overlay.querySelector("[data-confirm-ok]").textContent = confirmLabel;

    const signatureApi = bindSignaturePad(overlay);
    let closed = false;
    const finish = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const submit = () => {
      const signature = signatureApi.getDataUrl();
      if (!signature) {
        signatureApi.showError("Draw or upload your signature before continuing.");
        return;
      }
      finish(signature);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    };

    overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => finish(null));
    overlay.querySelector("[data-confirm-ok]").addEventListener("click", submit);
    bindBackdropClose(overlay, () => finish(null));
    document.body.appendChild(overlay);
    setTimeout(() => {
      if (!closed) document.addEventListener("keydown", onKeyDown);
    }, 50);
  });
}

function signaturePadMarkup() {
  return `
    <div class="signature-pad" data-signature-pad>
      <div class="signature-pad__header">
        <span>Your signature</span>
        <div class="signature-pad__tools">
          <label class="signature-pad__upload">
            Upload image
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden data-signature-file />
          </label>
          <button type="button" class="signature-pad__clear" data-signature-clear>Clear</button>
        </div>
      </div>
      <canvas class="signature-pad__canvas" width="520" height="160" data-signature-canvas></canvas>
      <p class="signature-pad__hint">Draw with your mouse or finger, or upload a signature image.</p>
      <p class="signature-pad__error --hidden" data-signature-error></p>
    </div>
  `;
}

function bindSignaturePad(root) {
  const canvas = root.querySelector("[data-signature-canvas]");
  const clearBtn = root.querySelector("[data-signature-clear]");
  const fileInput = root.querySelector("[data-signature-file]");
  const errorEl = root.querySelector("[data-signature-error]");
  if (!canvas) {
    return {
      getDataUrl: () => null,
      showError: () => {},
    };
  }

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let dirty = false;
  let last = null;

  const resizeForDisplay = () => {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 520));
    const height = 160;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#101828";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    dirty = false;
  };

  requestAnimationFrame(resizeForDisplay);

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top,
    };
  };

  const start = (event) => {
    event.preventDefault();
    hideError();
    drawing = true;
    last = pointFromEvent(event);
  };

  const move = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    last = point;
    dirty = true;
  };

  const end = () => {
    drawing = false;
    last = null;
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
  canvas.addEventListener("touchcancel", end);

  clearBtn?.addEventListener("click", () => {
    hideError();
    resizeForDisplay();
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Please choose an image file.");
      return;
    }
    if (file.size > 700000) {
      showError("Image is too large. Use a smaller signature file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        const scale = Math.min(width / image.width, height / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        dirty = true;
        hideError();
      };
      image.onerror = () => showError("Could not read that image.");
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });

  const hideError = () => errorEl?.classList.add("--hidden");
  const showError = (text) => {
    if (!errorEl) return;
    errorEl.textContent = text;
    errorEl.classList.remove("--hidden");
  };

  return {
    getDataUrl: () => (dirty ? canvas.toDataURL("image/png") : null),
    showError,
  };
}

function escapeOption(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Clean single-button notice (replaces window.alert). */
export function notifyAlert(message, title = "Notice") {
  const text = typeof message === "string" ? message : String(message ?? "");
  return confirmAction({
    title,
    message: text,
    confirmLabel: "OK",
    notice: true,
  });
}
