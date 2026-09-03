function displayValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function deriveLegacyChanges(meta) {
  if (!meta || typeof meta !== "object") return [];

  if (meta.previous_quantity != null && meta.new_quantity != null) {
    return [{ field: "Quantity", from: meta.previous_quantity, to: meta.new_quantity }];
  }

  const rows = [];
  if (meta.quantity != null) rows.push({ field: "Quantity", to: meta.quantity });
  if (meta.itemCode && meta.quantity != null) rows.push({ field: "Item code", to: meta.itemCode });
  if (meta.role) rows.push({ field: "Role", to: meta.role });
  return rows;
}

export function activityChanges(meta) {
  if (Array.isArray(meta?.changes) && meta.changes.length) {
    return meta.changes.filter((row) => row && (row.field || row.from != null || row.to != null));
  }
  return deriveLegacyChanges(meta);
}

export function renderActivityChanges(meta, escapeHtml) {
  const rows = activityChanges(meta);
  if (!rows.length) return "";

  return `<ul class="activity-changes">${rows.map((row) => {
    const field = escapeHtml(row.field || "Field");
    const hasFrom = Object.prototype.hasOwnProperty.call(row, "from");
    const to = escapeHtml(displayValue(row.to));

    if (!hasFrom) {
      return `<li class="activity-changes__chip">
        <span class="activity-changes__field">${field}</span>
        <span class="activity-changes__to">${to}</span>
      </li>`;
    }

    const from = escapeHtml(displayValue(row.from));
    return `<li class="activity-changes__chip">
      <span class="activity-changes__field">${field}</span>
      <span class="activity-changes__from">${from}</span>
      <span class="activity-changes__arrow" aria-hidden="true">→</span>
      <span class="activity-changes__to">${to}</span>
    </li>`;
  }).join("")}</ul>`;
}
