import DashboardUi from "./Dashboard.js";
import InventoryUi from "./InventoryView.js";
import ForecastingUi from "./ForecastingView.js";
import ReportsView from "./ReportsView.js";
import CalendarView from "./CalendarView.js";
import Storage from "./API.js";

// --------------------------  Sidebar-Menu  ---------------------------------
const menuToggle = document.querySelector(".menu-toggle");
const sideBarOnToggle = document.querySelector(".sideBar-ontoggle");
const sideBarBackdrop = document.querySelector(".sideBar-ontoggle-backdrop");

// -------------------------- Search Bar -------------------------------------
const searchBar = document.querySelector(".searchBarInput");

// -------------------------- Session Management -----------------------------
const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every 60s
const SESSION_WARNING_BEFORE = 2 * 60 * 1000; // Warn 2 minutes before expiry

// -------------------------- Notification Refresh ---------------------------
const NOTIF_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh every 5 minutes

document.addEventListener("DOMContentLoaded", async () => {
  await Storage.init();
  
  const app = new App();
  app.addEventListeners();

  // Initialize the specific page based on what exists in the DOM
  if (document.querySelector(".dashboardUi")) {
    DashboardUi.setApp();
  } else if (document.querySelector(".inventory-app")) {
    InventoryUi.setApp();
  } else if (document.querySelector(".forecastUi")) {
    ForecastingUi.setApp();
  } else if (document.querySelector(".reports-page")) {
    ReportsView.setApp();
  } else if (document.querySelector(".calendar-page")) {
    CalendarView.setApp();
  }

  // Start session monitoring
  app.startSessionMonitor();

  // Load notifications
  app.initNotifications();
});

class App {
  constructor() {
    this.sessionWarningShown = false;
    this.sessionCheckTimer = null;
    this.notifRefreshTimer = null;
    this.notifAlerts = [];
  }

  addEventListeners() {
    if (menuToggle) {
      menuToggle.addEventListener("click", () => {
        this.menuToggleLogic();
      });
    }
    
    if (sideBarBackdrop) {
      sideBarBackdrop.addEventListener("click", () => {
        this.hideMenu();
      });
    }

    if (searchBar) {
      searchBar.addEventListener("input", () => {
        this.searchInputLogic();
      });
    }

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await this.logout();
      });
    }

    // ---- Notification Bell Events ----
    const bellBtn = document.getElementById("notifBellBtn");
    const notifPanel = document.getElementById("notifPanel");
    const notifMarkRead = document.getElementById("notifMarkRead");

    if (bellBtn && notifPanel) {
      bellBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notifPanel.classList.toggle("--hidden");
      });

      // Close panel when clicking outside
      document.addEventListener("click", (e) => {
        const wrapper = document.getElementById("notifWrapper");
        if (wrapper && !wrapper.contains(e.target)) {
          notifPanel.classList.add("--hidden");
        }
      });
    }

    if (notifMarkRead) {
      notifMarkRead.addEventListener("click", () => {
        this.markAllNotificationsRead();
      });
    }
  }

  searchInputLogic() {
    if (document.querySelector(".inventory-app")) {
      InventoryUi.seachLogic(searchBar.value);
    } else {
      // If we try to search from another page, ideally we'd redirect to /inventory?q=...
      // For now, since everything is MPA, we just let it be or redirect to inventory
      window.location.href = `/inventory`;
    }
  }

  menuToggleLogic(event) {
    sideBarOnToggle.classList.remove("--hidden");
    sideBarBackdrop.classList.remove("--hidden");
  }

  hideMenu() {
    sideBarOnToggle.classList.add("--hidden");
    sideBarBackdrop.classList.add("--hidden");
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed:', e);
    }
    window.location.href = '/login';
  }

  startSessionMonitor() {
    this.sessionCheckTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.status === 401) {
          this.showSessionExpired();
          return;
        }
        const data = await res.json();
        if (!data.authenticated) {
          this.showSessionExpired();
          return;
        }
      } catch (e) {
        console.error('Session check failed:', e);
      }
    }, SESSION_CHECK_INTERVAL);
  }

  showSessionExpired() {
    if (this.sessionCheckTimer) {
      clearInterval(this.sessionCheckTimer);
    }
    // Show session expired overlay
    this.showSessionModal(
      'Session Expired',
      'Your session has timed out due to inactivity. Please sign in again.',
      'Sign In',
      () => { window.location.href = '/login'; }
    );
  }

  showSessionModal(title, message, btnText, onAction) {
    // Remove any existing modal
    const existing = document.querySelector('.session-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'session-modal-overlay';
    overlay.innerHTML = `
      <div class="session-modal">
        <div class="session-modal__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2 class="session-modal__title">${title}</h2>
        <p class="session-modal__message">${message}</p>
        <button class="session-modal__btn">${btnText}</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.session-modal__btn').addEventListener('click', onAction);
  }

  // ===================== NOTIFICATION SYSTEM =====================

  async initNotifications() {
    const bellBtn = document.getElementById("notifBellBtn");
    if (!bellBtn) return; // Not logged in or bell not in DOM

    await this.fetchAndRenderNotifications();

    // Auto-refresh notifications
    this.notifRefreshTimer = setInterval(() => {
      this.fetchAndRenderNotifications();
    }, NOTIF_REFRESH_INTERVAL);
  }

  async fetchAndRenderNotifications() {
    try {
      const res = await fetch('/api/reports/summary');
      if (!res.ok) return;
      const data = await res.json();

      this.notifAlerts = (data.lowStockItems || []).map(item => ({
        id: `lowstock-${item.id}`,
        title: item.title,
        itemCode: item.itemCode,
        currentStock: item.currentStock,
        reorderPoint: item.reorderPoint,
        minimumStockLevel: item.minimumStockLevel,
        deficit: item.deficit,
        fsn: item.fsn,
        urgency: item.urgency || 'medium',
      }));

      // Sort by urgency: critical > high > medium
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      this.notifAlerts.sort((a, b) =>
        (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3)
      );

      this.renderNotifications();
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }

  getReadNotifIds() {
    try {
      return JSON.parse(sessionStorage.getItem('notif_read') || '[]');
    } catch {
      return [];
    }
  }

  setReadNotifIds(ids) {
    sessionStorage.setItem('notif_read', JSON.stringify(ids));
  }

  renderNotifications() {
    const badge = document.getElementById("notifBadge");
    const bellBtn = document.getElementById("notifBellBtn");
    const panelBody = document.getElementById("notifPanelBody");
    const viewAllLink = document.getElementById("notifViewAll");

    if (!badge || !panelBody) return;

    const readIds = this.getReadNotifIds();
    const unreadAlerts = this.notifAlerts.filter(a => !readIds.includes(a.id));
    const unreadCount = unreadAlerts.length;

    // Update badge
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.classList.remove('--hidden');
      if (bellBtn) bellBtn.classList.add('--has-alerts');
    } else {
      badge.classList.add('--hidden');
      if (bellBtn) bellBtn.classList.remove('--has-alerts');
    }

    // Hide "View Full Report" if user doesn't have access to reports
    if (viewAllLink) {
      const hasReportsAccess = document.querySelector('.sideBar__reports') ||
                               document.querySelector('.sideBar-ontoggle .sideBar__reports');
      if (!hasReportsAccess) {
        viewAllLink.style.display = 'none';
      }
    }

    // Empty state
    if (this.notifAlerts.length === 0) {
      panelBody.innerHTML = `
        <div class="notif__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>All clear! No alerts right now.</p>
        </div>`;
      return;
    }

    // Render notification items
    let html = '';
    this.notifAlerts.forEach(alert => {
      const isUnread = !readIds.includes(alert.id);
      const urgencyLabel = alert.urgency.charAt(0).toUpperCase() + alert.urgency.slice(1);

      let description = '';
      if (alert.currentStock === 0) {
        description = `Out of stock! Needs ${alert.deficit} units to reach MSL.`;
      } else {
        description = `Stock: ${alert.currentStock} — below ROP (${alert.reorderPoint}). Deficit: ${alert.deficit}`;
      }

      html += `
        <div class="notif__item ${isUnread ? '--unread' : ''}" data-notif-id="${alert.id}">
          <div class="notif__item-dot --${alert.urgency}"></div>
          <div class="notif__item-content">
            <p class="notif__item-title">
              ${alert.title}
              <span class="notif__item-urgency --${alert.urgency}">${urgencyLabel}</span>
            </p>
            <p class="notif__item-desc">${description}</p>
            <p class="notif__item-time">
              <span class="dashboard-alerts__fsn" style="font-size:0.6rem;">${alert.fsn}</span>
              ${alert.itemCode ? `· Item #${alert.itemCode}` : ''}
            </p>
          </div>
        </div>`;
    });

    panelBody.innerHTML = html;
  }

  markAllNotificationsRead() {
    const allIds = this.notifAlerts.map(a => a.id);
    this.setReadNotifIds(allIds);
    this.renderNotifications();
  }
}

