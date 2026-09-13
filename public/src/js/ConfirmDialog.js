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

/** Ask the user to pick the next person. Returns a user id or null. */
export function pickAssignee({
  title = "Send to next person",
  message = "Choose who should handle the next step. This is a person, not a fixed role.",
  people = [],
  confirmLabel = "Continue",
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

    const options = (Array.isArray(people) ? people : [])
      .map((person) => {
        const bits = [person.role, person.department].filter(Boolean).join(" · ");
        const label = bits ? `${person.name} — ${bits}` : person.name;
        return `<option value="${person.id}">${escapeOption(label)}</option>`;
      })
      .join("");

    overlay.innerHTML = `
      <div class="confirm-modal confirm-modal--default">
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
      finish(value);
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
    select.focus();
    setTimeout(() => {
      if (!closed) document.addEventListener("keydown", onKeyDown);
    }, 50);
  });
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
