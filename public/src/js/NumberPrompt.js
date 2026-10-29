/**
 * Small dialog that asks for one number, styled like the shared confirm dialogs.
 */
import { bindBackdropClose } from "./OverlayDismiss.js";

/** Ask for a number. Returns the number, or null if cancelled. */
export function promptNumber({
  title = "Enter a value",
  message = "",
  label = "Value",
  value = "",
  min = null,
  max = null,
  step = "any",
  hint = "",
  confirmLabel = "Save",
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
      <div class="confirm-modal confirm-modal--default">
        <div class="confirm-modal__header">
          <span class="confirm-modal__icon confirm-modal__icon--default" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <div class="confirm-modal__heading">
            <h2 class="confirm-modal__title" id="confirmModalTitle"></h2>
          </div>
        </div>
        <p class="confirm-modal__message"></p>
        <label class="confirm-modal__field">
          <span data-prompt-label></span>
          <input type="number" id="confirmNumberInput" inputmode="decimal" />
        </label>
        <p class="confirm-modal__hint" data-prompt-hint></p>
        <div class="confirm-modal__actions">
          <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-confirm-cancel></button>
          <button type="button" class="confirm-modal__btn confirm-modal__btn--primary" data-confirm-ok></button>
        </div>
      </div>
    `;

    overlay.querySelector(".confirm-modal__title").textContent = title;
    overlay.querySelector(".confirm-modal__message").textContent = message;
    overlay.querySelector("[data-prompt-label]").textContent = label;
    const hintEl = overlay.querySelector("[data-prompt-hint]");
    hintEl.textContent = hint;
    overlay.querySelector("[data-confirm-cancel]").textContent = cancelLabel;
    overlay.querySelector("[data-confirm-ok]").textContent = confirmLabel;

    const input = overlay.querySelector("#confirmNumberInput");
    input.value = String(value);
    input.step = String(step);
    if (min !== null) input.min = String(min);
    if (max !== null) input.max = String(max);

    let closed = false;
    const finish = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const submit = () => {
      const number = Number(input.value);
      const outOfRange = (min !== null && number < min) || (max !== null && number > max);
      if (input.value.trim() === "" || !Number.isFinite(number) || outOfRange) {
        hintEl.textContent = min !== null && max !== null
          ? `Enter a number from ${min} to ${max}.`
          : "Enter a valid number.";
        hintEl.classList.add("confirm-modal__hint--error");
        input.focus();
        return;
      }
      finish(number);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };

    overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => finish(null));
    overlay.querySelector("[data-confirm-ok]").addEventListener("click", submit);
    bindBackdropClose(overlay, () => finish(null));
    document.body.appendChild(overlay);
    input.focus();
    input.select();
    setTimeout(() => {
      if (!closed) document.addEventListener("keydown", onKeyDown);
    }, 50);
  });
}
