/**
 * Shared second-layer confirmation dialog.
 * Returns a Promise<boolean> — true if the user confirms.
 */
export default function confirmAction({
  title = "Confirm",
  message = "Are you sure you want to continue?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector(".confirm-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "confirmModalTitle");

    const confirmClass = danger
      ? "confirm-modal__btn confirm-modal__btn--danger"
      : "confirm-modal__btn confirm-modal__btn--primary";

    overlay.innerHTML = `
      <div class="confirm-modal">
        <h2 class="confirm-modal__title" id="confirmModalTitle"></h2>
        <p class="confirm-modal__message"></p>
        <div class="confirm-modal__actions">
          <button type="button" class="confirm-modal__btn confirm-modal__btn--ghost" data-confirm-cancel></button>
          <button type="button" class="${confirmClass}" data-confirm-ok></button>
        </div>
      </div>
    `;

    overlay.querySelector(".confirm-modal__title").textContent = title;
    overlay.querySelector(".confirm-modal__message").textContent = message;
    overlay.querySelector("[data-confirm-cancel]").textContent = cancelLabel;
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
        finish(false);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
    };

    overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => finish(false));
    overlay.querySelector("[data-confirm-ok]").addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(false);
    });

    document.body.appendChild(overlay);
    overlay.querySelector("[data-confirm-cancel]").focus();

    // Defer keyboard binding so the Enter/submit that opened this dialog
    // cannot immediately auto-confirm.
    setTimeout(() => {
      if (!closed) document.addEventListener("keydown", onKeyDown);
    }, 50);
  });
}
