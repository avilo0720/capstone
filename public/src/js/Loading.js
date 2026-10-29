const overlay = () => document.getElementById("appLoading");

function show(title = "Working", message = "Please wait…") {
  const element = overlay();
  if (!element) return;
  const titleElement = element.querySelector(".app-loading__title");
  const messageElement = element.querySelector(".app-loading__text");
  if (titleElement) titleElement.textContent = title;
  if (messageElement) messageElement.textContent = message;
  element.classList.remove("app-loading--done");
  element.setAttribute("aria-busy", "true");
}

function hide() {
  const element = overlay();
  if (!element) return;
  element.classList.add("app-loading--done");
  element.setAttribute("aria-busy", "false");
}

export default { show, hide };