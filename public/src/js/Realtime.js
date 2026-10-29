// Keep these specifiers identical to app.js: a different ?v= loads a second, unused copy of the module.
import Storage from "./API.js";
import { refreshLeadTime } from "./Settings.js";
import DashboardUi from "./Dashboard.js?v=103";
import InventoryUi from "./InventoryView.js?v=104";
import ForecastingUi from "./ForecastingView.js?v=104";
import ReportsView from "./ReportsView.js?v=109";
import CalendarView from "./CalendarView.js?v=102";
import UsersView from "./UsersView.js";
import ActivityLogsView from "./ActivityLogsView.js?v=101";
import ProcurementView from "./ProcurementView.js?v=104";
import IssuanceView from "./IssuanceView.js";

const POLL_MS = 2000;
const STORAGE_TYPES = new Set(["inventory", "procurement", "issuance"]);

export function startRealtime({ onNotifications } = {}) {
  let since = -1;
  let globalSince = -1;
  let timer = null;
  let inFlight = false;
  let applying = false;

  async function poll() {
    if (inFlight || document.hidden) return;
    inFlight = true;
    try {
      const res = await fetch(`/api/realtime/events?since=${since}&global_since=${globalSince}`);
      if (!res.ok) return;
      const data = await res.json();
      since = Number.isFinite(data.lastId) ? data.lastId : since;
      globalSince = Number.isFinite(data.globalLastId) ? data.globalLastId : globalSince;
      const events = Array.isArray(data.events) ? data.events : [];
      if (events.length) await applyEvents(events);
    } catch (err) {
      console.error("Realtime sync failed:", err);
    } finally {
      inFlight = false;
    }
  }

  async function applyEvents(events) {
    if (applying) return;
    applying = true;
    try {
      const types = new Set(events.map((event) => event.type).filter(Boolean));
      const needsStorage = [...types].some((type) => STORAGE_TYPES.has(type));

      if (needsStorage) {
        await Storage.init();
      }

      // A new lead time changes LTD, SS, ROP, and MSL everywhere. The "leadtimechange"
      // event updates the Inventory page; the refreshes below cover the other pages.
      const settingsChanged = types.has("settings");
      if (settingsChanged) {
        await refreshLeadTime();
      }

      const tasks = [];

      if (needsStorage || settingsChanged || types.has("activity")) {
        tasks.push(DashboardUi.refreshLive?.());
        tasks.push(InventoryUi.refreshLive?.());
        tasks.push(ForecastingUi.refreshLive?.());
        tasks.push(ReportsView.refreshLive?.());
        tasks.push(ActivityLogsView.refreshLive?.());
      }

      if (needsStorage || types.has("activity") || types.has("calendar")) {
        tasks.push(CalendarView.refreshLive?.());
      }

      if (types.has("procurement")) {
        tasks.push(ProcurementView.refreshLive?.());
      }

      if (types.has("issuance")) {
        tasks.push(IssuanceView.refreshLive?.());
      }

      if (types.has("users")) {
        tasks.push(UsersView.refreshLive?.());
      }

      if (needsStorage || types.has("calendar")) {
        tasks.push(onNotifications?.());
      }

      await Promise.all(tasks.filter(Boolean));
    } finally {
      applying = false;
    }
  }

  poll();
  timer = setInterval(poll, POLL_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) poll();
  });

  return () => {
    if (timer) clearInterval(timer);
  };
}
