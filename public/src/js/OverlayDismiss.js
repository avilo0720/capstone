/**
 * Close an overlay only when the press starts and ends on the backdrop.
 * Prevents a form drag / text select from closing the dialog on mouseup outside.
 */
export function bindBackdropClose(overlay, onClose, isBackdrop) {
  if (!overlay) return;

  const matches = (event) =>
    typeof isBackdrop === "function" ? isBackdrop(event) : event.target === overlay;

  let startedOnBackdrop = false;

  overlay.addEventListener("pointerdown", (event) => {
    startedOnBackdrop = matches(event);
  });

  overlay.addEventListener("click", (event) => {
    if (startedOnBackdrop && matches(event)) onClose(event);
    startedOnBackdrop = false;
  });
}
