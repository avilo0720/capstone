/**
 * System-wide settings shared by every page. The layout renders the current
 * values onto <body>; refreshLeadTime() picks up changes made by other users.
 */
const DEFAULT_LEAD_TIME_MONTHS = 3.5;

let leadTimeMonths = Number(document.body?.dataset?.leadTimeMonths) || DEFAULT_LEAD_TIME_MONTHS;

/** Months from ordering until delivery, used for LTD, SS, ROP, and MSL. */
export function getLeadTimeMonths() {
  return leadTimeMonths;
}

export function formatLeadTime(months = leadTimeMonths) {
  return `${Number(months.toFixed(2))} month${months === 1 ? "" : "s"}`;
}

function remember(value) {
  const months = Number(value);
  if (!(months > 0)) return leadTimeMonths;
  leadTimeMonths = months;
  if (document.body) document.body.dataset.leadTimeMonths = String(months);
  document.dispatchEvent(new CustomEvent("leadtimechange", { detail: { leadTimeMonths: months } }));
  return months;
}

export async function refreshLeadTime() {
  try {
    const res = await fetch("/api/settings/lead-time");
    if (!res.ok) return leadTimeMonths;
    const data = await res.json();
    return remember(data.leadTimeMonths);
  } catch {
    return leadTimeMonths;
  }
}

/** Saves a new lead time. Throws with the server's message if it is rejected. */
export async function saveLeadTime(months) {
  const res = await fetch("/api/settings/lead-time", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ leadTimeMonths: months }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstError = data.errors ? Object.values(data.errors).flat()[0] : null;
    throw new Error(data.error || firstError || data.message || "Could not save the lead time.");
  }
  return remember(data.leadTimeMonths);
}
