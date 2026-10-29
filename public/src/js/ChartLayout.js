/**
 * Layout helpers for the hand-drawn canvas charts.
 */

/** Width available inside an element, excluding its padding (clientWidth includes padding). */
export function contentWidth(el) {
  if (!el) return 0;
  const style = getComputedStyle(el);
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return Math.max(0, el.clientWidth - padding);
}

/** Shortens text with an ellipsis so it fits within maxWidth using the context's current font. */
export function fitText(ctx, text, maxWidth) {
  const value = String(text ?? "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let end = value.length;
  while (end > 1 && ctx.measureText(`${value.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${value.slice(0, end)}…`;
}

/**
 * Left label column and right value margin for a horizontal bar chart, sized to the
 * widest label and value but never letting labels take more than 40% of the width.
 */
export function barChartGutters(ctx, data, width) {
  const widestLabel = Math.max(0, ...data.map((d) => ctx.measureText(String(d.label)).width));
  const widestValue = Math.max(0, ...data.map((d) => ctx.measureText(String(d.value)).width));
  const labelWidth = Math.min(widestLabel, Math.max(60, width * 0.4));
  return {
    labelWidth,
    left: labelWidth + 12,
    right: widestValue + 12,
  };
}
