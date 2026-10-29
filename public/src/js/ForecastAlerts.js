/**
 * Low-stock alerts based on the forecast, shared by Reports, the Dashboard,
 * and the notification bell so all three list the same items.
 */
import Storage from "./API.js";
import { computeForecasts } from "./ForecastEngine.js";

export const DEFAULT_RESTOCK_WINDOW_MONTHS = 3;

const URGENCY_ORDER = { critical: 0, high: 1, medium: 2 };

/**
 * An item is an alert when its current quantity will not last `windowMonths`
 * at its forecast monthly use.
 */
export function buildForecastAlerts(forecastData, windowMonths = DEFAULT_RESTOCK_WINDOW_MONTHS) {
  return forecastData
    .map((item) => {
      const forecastAmc = Number(item.forecast) || 0;
      const stock = Number(item.quantity) || 0;
      const restockNeeded = Math.max(0, Math.ceil(forecastAmc * windowMonths - stock));
      const monthsLeft = forecastAmc > 0 ? stock / forecastAmc : null;
      const urgency = stock === 0 || (monthsLeft !== null && monthsLeft < 1)
        ? "critical"
        : monthsLeft !== null && monthsLeft < 2 ? "high" : "medium";
      const unitCost = Number(item.price) || 0;
      return {
        id: item.id,
        itemCode: item.itemCode,
        title: item.title,
        size: item.size,
        currentStock: stock,
        forecastAmc,
        monthsLeft: monthsLeft === null ? null : Number(monthsLeft.toFixed(2)),
        restockNeeded,
        need3m: Math.max(0, Math.ceil(forecastAmc * 3 - stock)),
        need6m: Math.max(0, Math.ceil(forecastAmc * 6 - stock)),
        need1y: Math.max(0, Math.ceil(forecastAmc * 12 - stock)),
        unitCost,
        restockCost: restockNeeded * unitCost,
        isStatic: item.method === "Static",
        urgency,
      };
    })
    .filter((alert) => alert.restockNeeded > 0)
    .sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3)
      || (a.monthsLeft ?? Infinity) - (b.monthsLeft ?? Infinity));
}

/** Fetches usage history and builds alerts for the items already loaded in Storage. */
export async function loadForecastAlerts(windowMonths = DEFAULT_RESTOCK_WINDOW_MONTHS) {
  const res = await fetch("/api/forecast-data");
  if (!res.ok) throw new Error("Could not load forecast data.");
  const usage = await res.json();
  return buildForecastAlerts(computeForecasts(Storage.getItems(), usage), windowMonths);
}

export function restockWindowLabel(windowMonths = DEFAULT_RESTOCK_WINDOW_MONTHS) {
  return windowMonths === 12 ? "1 year" : `${windowMonths} months`;
}

export function monthsLeftLabel(months) {
  if (months === null || months === undefined) return "—";
  return months >= 24 ? "24+ months" : `${months.toFixed(1)} months`;
}
