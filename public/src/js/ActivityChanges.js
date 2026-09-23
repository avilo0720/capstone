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

function parseLineDump(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text.startsWith("[")) return null;
  try {
    const rows = JSON.parse(text);
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || row.title == null)) {
      return null;
    }
    return rows;
  } catch {
    return null;
  }
}

function lineKey(line) {
  return String(line.id ?? line.item_id ?? line.title);
}

function parseQtyMap(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text.startsWith("{")) return null;
  try {
    const map = JSON.parse(text);
    if (!map || Array.isArray(map) || typeof map !== "object") return null;
    const entries = Object.entries(map);
    if (!entries.length) return null;
    const valid = entries.every(([key, qty]) => /^\d+$/.test(String(key)) && Number.isFinite(Number(qty)));
    return valid ? map : null;
  } catch {
    return null;
  }
}

function expandLineDump(row, names = {}) {
  const before = parseLineDump(row.from);
  const after = parseLineDump(row.to);
  if (before || after) {
    const left = new Map((before || []).map((line) => [lineKey(line), line]));
    const right = new Map((after || []).map((line) => [lineKey(line), line]));
    const changes = [];

    [...new Set([...left.keys(), ...right.keys()])].forEach((key) => {
      const fromLine = left.get(key);
      const toLine = right.get(key);
      const name = (toLine || fromLine).title || "Item";
      const fromQty = fromLine ? String(fromLine.qty ?? fromLine.requested_qty ?? 0) : null;
      const toQty = toLine ? String(toLine.qty ?? toLine.requested_qty ?? 0) : null;
      if (fromLine && toLine && fromQty === toQty) return;
      if (!fromLine) changes.push({ field: name, to: toQty });
      else if (!toLine) changes.push({ field: name, from: fromQty, to: "Removed" });
      else changes.push({ field: name, from: fromQty, to: toQty });
    });

    return changes.length ? changes : [{ field: "Request lines", to: "No quantity changes" }];
  }

  const qtyBefore = parseQtyMap(row.from);
  const qtyAfter = parseQtyMap(row.to);
  if (!qtyBefore && !qtyAfter) return [row];

  const changes = [];
  [...new Set([...Object.keys(qtyBefore || {}), ...Object.keys(qtyAfter || {})])].forEach((key) => {
    const hasFrom = qtyBefore && Object.prototype.hasOwnProperty.call(qtyBefore, key);
    const hasTo = qtyAfter && Object.prototype.hasOwnProperty.call(qtyAfter, key);
    const fromQty = hasFrom ? String(Number(qtyBefore[key])) : null;
    const toQty = hasTo ? String(Number(qtyAfter[key])) : null;
    if (hasFrom && hasTo && fromQty === toQty) return;
    const name = names[key] || `Item ${key}`;
    if (!hasFrom) changes.push({ field: name, to: toQty });
    else if (!hasTo) changes.push({ field: name, from: fromQty, to: "Removed" });
    else changes.push({ field: name, from: fromQty, to: toQty });
  });

  return changes.length ? changes : [{ field: "Requested quantities", to: "No quantity changes" }];
}

export function activityChanges(meta, names = {}) {
  const rows = Array.isArray(meta?.changes) && meta.changes.length
    ? meta.changes.filter((row) => row && (row.field || row.from != null || row.to != null))
    : deriveLegacyChanges(meta);

  return rows.flatMap((row) => expandLineDump(row, names));
}

export function renderActivityChanges(meta, escapeHtml, names = {}) {
  const rows = activityChanges(meta, names);
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
