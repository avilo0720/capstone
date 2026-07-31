import DashboardUi from "./Dashboard.js";
import InventoryUi from "./InventoryView.js";
import ForecastingUi from "./ForecastingView.js";
import ReportsView from "./ReportsView.js";
import CalendarView from "./CalendarView.js";
import UsersView from "./UsersView.js";
import ActivityLogsView from "./ActivityLogsView.js";
import Storage from "./API.js";
import confirmAction from "./ConfirmDialog.js";

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
  } else if (document.querySelector(".users-page")) {
    UsersView.setApp();
  } else if (document.querySelector(".activity-logs-page")) {
    ActivityLogsView.setApp();
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
    this.notifReadIds = [];
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

    // Profile card (name / role) — opens details, then edit / logout
    document.querySelectorAll(".sideBar__user-card").forEach((card) => {
      card.addEventListener("click", () => this.openProfileModal());
    });
    this.bindProfileModal();

    // ---- Notification Bell Events ----
    document.querySelectorAll(".notif").forEach((wrapper) => {
      const bellBtn = wrapper.querySelector(".notif__bell");
      const notifPanel = wrapper.querySelector(".notif__panel");
      const notifMarkRead = wrapper.querySelector(".notif__mark-read");
      const notifPanelBody = wrapper.querySelector(".notif__panel-body");

      if (bellBtn && notifPanel) {
        bellBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // Close other open panels first
          document.querySelectorAll(".notif__panel").forEach((panel) => {
            if (panel !== notifPanel) panel.classList.add("--hidden");
          });
          notifPanel.classList.toggle("--hidden");
        });

        notifPanel.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }

      if (notifMarkRead) {
        notifMarkRead.addEventListener("click", () => {
          this.markAllNotificationsRead();
        });
      }

      if (notifPanelBody) {
        notifPanelBody.addEventListener("click", async (e) => {
          const item = e.target.closest(".notif__item");
          if (!item) return;
          const id = item.dataset.notifId;
          const href = item.dataset.notifHref;
          if (id) await this.markNotificationRead(id);
          if (href) {
            window.location.href = href;
          }
        });
      }
    });

    // Close notification panels when clicking outside
    document.addEventListener("click", (e) => {
      if (e.target.closest(".notif")) return;
      document.querySelectorAll(".notif__panel").forEach((panel) => {
        panel.classList.add("--hidden");
      });
    });
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

  bindProfileModal() {
    const overlay = document.getElementById("profileModalOverlay");
    const form = document.getElementById("profileForm");
    if (!overlay || !form) return;

    document.getElementById("profileModalClose")?.addEventListener("click", () => {
      this.closeProfileModal();
    });
    document.getElementById("profileBackBtn")?.addEventListener("click", () => {
      this.showProfileView();
    });
    document.getElementById("profileEditBtn")?.addEventListener("click", () => {
      this.showProfileEdit();
    });
    document.getElementById("profileLogoutBtn")?.addEventListener("click", async () => {
      const ok = await confirmAction({
        title: "Log out?",
        message: "You will need to sign in again to continue.",
        confirmLabel: "Log out",
        danger: true,
      });
      if (ok) await this.logout();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closeProfileModal();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveProfile();
    });

    document.getElementById("profilePictureInput")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        this.showProfileError("Source image must be 8MB or smaller.");
        e.target.value = "";
        return;
      }
      if (!file.type.startsWith("image/")) {
        this.showProfileError("Please choose an image file.");
        e.target.value = "";
        return;
      }
      this.hideProfileError();
      const reader = new FileReader();
      reader.onload = () => this.openProfileCropper(reader.result);
      reader.readAsDataURL(file);
      e.target.value = "";
    });

    document.getElementById("profilePictureRemoveBtn")?.addEventListener("click", () => {
      this.pendingProfilePicture = null;
      this.pendingProfilePicturePreview = null;
      this.removeProfilePicture = true;
      const input = document.getElementById("profilePictureInput");
      if (input) input.value = "";
      this.renderAvatarElement(
        document.getElementById("profilePicturePreview"),
        null,
        this.profileInitials(this.currentProfile)
      );
    });

    document.getElementById("profileCropClose")?.addEventListener("click", () => {
      this.closeProfileCropper(false);
    });
    document.getElementById("profileCropCancel")?.addEventListener("click", () => {
      this.closeProfileCropper(false);
    });
    document.getElementById("profileCropApply")?.addEventListener("click", () => {
      this.applyProfileCrop();
    });
    document.getElementById("profileCropZoomIn")?.addEventListener("click", () => {
      this.profileCropper?.zoom(0.1);
    });
    document.getElementById("profileCropZoomOut")?.addEventListener("click", () => {
      this.profileCropper?.zoom(-0.1);
    });
    document.getElementById("profileCropRotate")?.addEventListener("click", () => {
      this.profileCropper?.rotate(90);
    });
    document.getElementById("profileCropOverlay")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.closeProfileCropper(false);
    });
  }

  openProfileCropper(imageSrc) {
    const overlay = document.getElementById("profileCropOverlay");
    const image = document.getElementById("profileCropImage");
    const CropperLib = window.Cropper;
    if (!overlay || !image || typeof CropperLib === "undefined") {
      this.showProfileError("Cropper failed to load. Please refresh and try again.");
      return;
    }

    this.destroyProfileCropper();
    image.src = imageSrc;
    overlay.classList.remove("--hidden");

    this.profileCropper = new CropperLib(image, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.85,
      responsive: true,
      background: false,
      guides: false,
      center: false,
      highlight: false,
      cropBoxMovable: false,
      cropBoxResizable: false,
      toggleDragModeOnDblclick: false,
      wheelZoomRatio: 0.08,
      ready() {
        const containerData = this.getContainerData();
        const size = Math.min(containerData.width, containerData.height) * 0.72;
        this.setCropBoxData({
          width: size,
          height: size,
          left: (containerData.width - size) / 2,
          top: (containerData.height - size) / 2,
        });
      },
    });
  }

  destroyProfileCropper() {
    if (this.profileCropper) {
      this.profileCropper.destroy();
      this.profileCropper = null;
    }
    const image = document.getElementById("profileCropImage");
    if (image) image.src = "";
  }

  closeProfileCropper() {
    this.destroyProfileCropper();
    document.getElementById("profileCropOverlay")?.classList.add("--hidden");
  }

  applyProfileCrop() {
    if (!this.profileCropper) return;

    const canvas = this.profileCropper.getCroppedCanvas({
      width: 512,
      height: 512,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });

    if (!canvas) {
      this.showProfileError("Unable to crop this image.");
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.showProfileError("Unable to process the cropped image.");
          return;
        }

        const file = new File([blob], `profile_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        this.pendingProfilePicture = file;
        this.pendingProfilePicturePreview = canvas.toDataURL("image/jpeg", 0.92);
        this.removeProfilePicture = false;
        this.renderAvatarElement(
          document.getElementById("profilePicturePreview"),
          this.pendingProfilePicturePreview,
          this.profileInitials(this.currentProfile)
        );
        this.closeProfileCropper();
      },
      "image/jpeg",
      0.92
    );
  }

  profileInitials(profile = {}) {
    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    return (
      fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "?"
    );
  }

  renderAvatarElement(el, pictureUrl, initials) {
    if (!el) return;
    el.dataset.initials = initials || "?";
    if (pictureUrl) {
      el.innerHTML = `<img src="${pictureUrl}" alt="" />`;
      el.classList.add("--has-image");
    } else {
      el.innerHTML = "";
      el.textContent = initials || "?";
      el.classList.remove("--has-image");
    }
  }

  updateSidebarAvatars(pictureUrl, initials) {
    document.querySelectorAll(".sideBar__user-avatar").forEach((avatar) => {
      avatar.dataset.initials = initials || "?";
      if (pictureUrl) {
        avatar.innerHTML = `<img src="${pictureUrl}" alt="" class="sideBar__user-avatar-img" />`;
      } else {
        avatar.innerHTML = `<span class="sideBar__user-avatar-initials">${initials || "?"}</span>`;
      }
    });
  }

  showProfileView() {
    document.getElementById("profileView")?.classList.remove("--hidden");
    document.getElementById("profileForm")?.classList.add("--hidden");
    const title = document.getElementById("profileModalTitle");
    const subtitle = document.getElementById("profileModalSubtitle");
    if (title) title.textContent = "My Profile";
    if (subtitle) subtitle.textContent = "Your account details";
    this.hideProfileError();
  }

  showProfileEdit() {
    document.getElementById("profileView")?.classList.add("--hidden");
    document.getElementById("profileForm")?.classList.remove("--hidden");
    const title = document.getElementById("profileModalTitle");
    const subtitle = document.getElementById("profileModalSubtitle");
    if (title) title.textContent = "Edit Profile";
    if (subtitle) subtitle.textContent = "Update your account details";
    this.hideProfileError();
    this.pendingProfilePicture = null;
    this.pendingProfilePicturePreview = null;
    this.removeProfilePicture = false;
    const input = document.getElementById("profilePictureInput");
    if (input) input.value = "";
    document.getElementById("profileCurrentPassword").value = "";
    document.getElementById("profileNewPassword").value = "";
    document.getElementById("profileConfirmPassword").value = "";
    this.renderAvatarElement(
      document.getElementById("profilePicturePreview"),
      this.currentProfile?.profile_picture || null,
      this.profileInitials(this.currentProfile)
    );
  }

  fillProfileDetails(profile) {
    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "—";
    const initials = this.profileInitials(profile);
    const birthday = profile.birthday
      ? new Date(`${profile.birthday}T00:00:00`).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Not set";

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    this.renderAvatarElement(
      document.getElementById("profileViewAvatar"),
      profile.profile_picture || null,
      initials
    );
    setText("profileViewName", fullName);
    setText("profileViewRole", profile.role || "—");
    setText("profileViewUsername", profile.username ? `@${profile.username}` : "—");
    setText("profileViewBirthday", birthday);
    setText("profileViewRoleDetail", profile.role || "—");
    setText("profileViewDepartment", profile.department_name || "—");

    document.getElementById("profileFirstName").value = profile.first_name || "";
    document.getElementById("profileLastName").value = profile.last_name || "";
    document.getElementById("profileUsername").value = profile.username || "";
    document.getElementById("profileBirthday").value = profile.birthday || "";
    setText("profileRoleDisplay", profile.role || "—");
    setText("profileDepartmentDisplay", profile.department_name || "—");
    this.renderAvatarElement(
      document.getElementById("profilePicturePreview"),
      profile.profile_picture || null,
      initials
    );
  }

  async openProfileModal() {
    const overlay = document.getElementById("profileModalOverlay");
    if (!overlay) return;

    this.hideProfileError();
    this.showProfileView();
    overlay.classList.remove("--hidden");

    try {
      const res = await fetch("/api/auth/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      const profile = await res.json();
      this.currentProfile = profile;
      this.fillProfileDetails(profile);
    } catch {
      this.showProfileError("Unable to load your profile.");
    }
  }

  closeProfileModal() {
    this.closeProfileCropper();
    document.getElementById("profileModalOverlay")?.classList.add("--hidden");
    this.hideProfileError();
    this.showProfileView();
  }

  showProfileError(message) {
    const box = document.getElementById("profileFormError");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("--hidden");
  }

  hideProfileError() {
    const box = document.getElementById("profileFormError");
    if (!box) return;
    box.textContent = "";
    box.classList.add("--hidden");
  }

  async saveProfile() {
    this.hideProfileError();
    const saveBtn = document.getElementById("profileSaveBtn");
    const newPassword = document.getElementById("profileNewPassword").value;
    const confirmPassword = document.getElementById("profileConfirmPassword").value;
    const currentPassword = document.getElementById("profileCurrentPassword").value;

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        this.showProfileError("Enter your current password to change it.");
        return;
      }
      if (newPassword.length < 6) {
        this.showProfileError("New password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        this.showProfileError("New password and confirmation do not match.");
        return;
      }
    }

    const ok = await confirmAction({
      title: "Save profile changes?",
      message: newPassword
        ? "Your profile details and password will be updated."
        : "Your profile details will be updated.",
      confirmLabel: "Save changes",
    });
    if (!ok) return;

    const formData = new FormData();
    formData.append("first_name", document.getElementById("profileFirstName").value.trim());
    formData.append("last_name", document.getElementById("profileLastName").value.trim());
    formData.append("username", document.getElementById("profileUsername").value.trim());
    formData.append("birthday", document.getElementById("profileBirthday").value || "");

    if (newPassword) {
      formData.append("current_password", currentPassword);
      formData.append("password", newPassword);
      formData.append("password_confirmation", confirmPassword);
    }

    if (this.pendingProfilePicture) {
      formData.append("profile_picture", this.pendingProfilePicture);
    }
    if (this.removeProfilePicture) {
      formData.append("remove_picture", "1");
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
    }

    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          (data.errors ? Object.values(data.errors).flat().join(" ") : null) ||
          "Failed to update profile.";
        this.showProfileError(message);
        return;
      }

      const fullName =
        data.user?.fullName ||
        `${formData.get("first_name")} ${formData.get("last_name")}`.trim();
      const initials = this.profileInitials({
        first_name: formData.get("first_name"),
        last_name: formData.get("last_name"),
      });

      document.querySelectorAll(".sideBar__user-name").forEach((el) => {
        el.textContent = fullName;
      });
      document.querySelectorAll(".sideBar__user-role").forEach((el) => {
        el.textContent = data.user?.role || el.textContent;
      });
      this.updateSidebarAvatars(data.user?.profilePicture || null, initials);

      this.currentProfile = {
        first_name: formData.get("first_name"),
        last_name: formData.get("last_name"),
        username: formData.get("username"),
        birthday: formData.get("birthday") || null,
        profile_picture: data.user?.profilePicture || null,
        role: data.user?.role || this.currentProfile?.role,
        department_name: data.user?.departmentName || this.currentProfile?.department_name,
      };
      this.pendingProfilePicture = null;
      this.removeProfilePicture = false;
      this.fillProfileDetails(this.currentProfile);
      this.showProfileView();
    } catch {
      this.showProfileError("Failed to update profile.");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save changes";
      }
    }
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
    if (!document.querySelector(".notif__bell")) return;

    await this.fetchAndRenderNotifications();

    // Auto-refresh notifications
    this.notifRefreshTimer = setInterval(() => {
      this.fetchAndRenderNotifications();
    }, NOTIF_REFRESH_INTERVAL);
  }

  async fetchAndRenderNotifications() {
    try {
      const [summaryRes, readRes, calendarRes] = await Promise.all([
        fetch('/api/reports/summary'),
        fetch('/api/notifications/read'),
        fetch('/api/notifications/alerts'),
      ]);
      if (!summaryRes.ok) return;
      const data = await summaryRes.json();

      if (readRes.ok) {
        const readData = await readRes.json();
        this.notifReadIds = Array.isArray(readData.readIds) ? readData.readIds : [];
      } else {
        this.notifReadIds = [];
      }

      // Drop leftover shared browser key from older client versions
      try {
        sessionStorage.removeItem('notif_read');
      } catch {
        /* ignore */
      }

      const stockAlerts = (data.lowStockItems || []).map(item => ({
        id: `lowstock-${item.id}`,
        type: 'lowstock',
        title: item.title,
        itemCode: item.itemCode,
        currentStock: item.currentStock,
        reorderPoint: item.reorderPoint,
        minimumStockLevel: item.minimumStockLevel,
        deficit: item.deficit,
        fsn: item.fsn,
        urgency: item.urgency || 'medium',
      }));

      let calendarAlerts = [];
      if (calendarRes.ok) {
        const calendarData = await calendarRes.json();
        calendarAlerts = (calendarData.alerts || []).map((alert) => ({
          id: alert.id,
          type: alert.type || 'calendar',
          title: alert.title,
          message: alert.message || '',
          noteDate: alert.note_date,
          endDate: alert.end_date,
          urgency: alert.urgency || 'medium',
          href: alert.href || '/calendar',
        }));
      }

      this.notifAlerts = [...calendarAlerts, ...stockAlerts];

      // Sort by urgency: critical > high > medium; calendar due before shared
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      const typeOrder = { calendar_due: 0, calendar_shared: 1, lowstock: 2 };
      this.notifAlerts.sort((a, b) => {
        const urgencyDiff =
          (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3);
        if (urgencyDiff !== 0) return urgencyDiff;
        return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
      });

      this.renderNotifications();
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }

  getReadNotifIds() {
    return Array.isArray(this.notifReadIds) ? this.notifReadIds : [];
  }

  async persistReadNotifIds(ids) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) return;

    // Optimistic per-user update; server is source of truth after response
    this.notifReadIds = [...new Set([...this.getReadNotifIds(), ...uniqueIds])];

    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: uniqueIds }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.readIds)) {
        this.notifReadIds = data.readIds;
      }
    } catch (e) {
      console.error('Failed to save notification read state:', e);
    }
  }

  renderNotifications() {
    const badges = document.querySelectorAll(".notif__badge");
    const bellBtns = document.querySelectorAll(".notif__bell");
    const panelBodies = document.querySelectorAll(".notif__panel-body");
    const viewAllLinks = document.querySelectorAll(".notif__view-all");

    if (!badges.length || !panelBodies.length) return;

    const readIds = this.getReadNotifIds();
    const unreadAlerts = this.notifAlerts.filter(a => !readIds.includes(a.id));
    const unreadCount = unreadAlerts.length;

    // Update badges
    badges.forEach((badge) => {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('--hidden');
      } else {
        badge.classList.add('--hidden');
      }
    });

    bellBtns.forEach((bellBtn) => {
      if (unreadCount > 0) bellBtn.classList.add('--has-alerts');
      else bellBtn.classList.remove('--has-alerts');
    });

    // Hide "View Full Report" if user doesn't have access to reports
    const hasReportsAccess = document.querySelector('.sideBar__reports');
    viewAllLinks.forEach((viewAllLink) => {
      if (!hasReportsAccess) {
        viewAllLink.style.display = 'none';
      }
    });

    // Empty state
    let html = '';
    if (this.notifAlerts.length === 0) {
      html = `
        <div class="notif__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>All clear! No alerts right now.</p>
        </div>`;
    } else {
      this.notifAlerts.forEach(alert => {
        const isUnread = !readIds.includes(alert.id);
        const isCalendar =
          alert.type === 'calendar_shared' || alert.type === 'calendar_due';
        const urgencyLabel = isCalendar
          ? (alert.type === 'calendar_due' ? 'Today' : 'Note')
          : (alert.urgency.charAt(0).toUpperCase() + alert.urgency.slice(1));
        const safeTitle = this.escapeNotifHtml(alert.title || 'Notification');
        const hrefAttr = alert.href
          ? ` data-notif-href="${this.escapeNotifAttr(alert.href)}"`
          : '';

        let description = '';
        let meta = '';
        if (isCalendar) {
          description = this.escapeNotifHtml(alert.message || 'Open calendar to view this note.');
          meta = alert.type === 'calendar_due' ? 'Calendar · Due today' : 'Calendar · Shared with you';
        } else if (alert.currentStock === 0) {
          description = `Out of stock! Needs ${alert.deficit} units to reach MSL.`;
          meta = `<span class="dashboard-alerts__fsn" style="font-size:0.6rem;">${alert.fsn || ''}</span>
                ${alert.itemCode ? `· Item #${alert.itemCode}` : ''}`;
        } else {
          description = `Stock: ${alert.currentStock} — below ROP (${alert.reorderPoint}). Deficit: ${alert.deficit}`;
          meta = `<span class="dashboard-alerts__fsn" style="font-size:0.6rem;">${alert.fsn || ''}</span>
                ${alert.itemCode ? `· Item #${alert.itemCode}` : ''}`;
        }

        html += `
          <div class="notif__item ${isUnread ? '--unread' : ''} ${isCalendar ? '--calendar' : ''}" data-notif-id="${this.escapeNotifAttr(alert.id)}"${hrefAttr}>
            <div class="notif__item-dot --${alert.urgency}${isCalendar ? ' --calendar' : ''}"></div>
            <div class="notif__item-content">
              <p class="notif__item-title">
                ${safeTitle}
                <span class="notif__item-urgency --${alert.urgency}">${urgencyLabel}</span>
              </p>
              <p class="notif__item-desc">${description}</p>
              <p class="notif__item-time">${meta}</p>
            </div>
          </div>`;
      });
    }

    panelBodies.forEach((panelBody) => {
      panelBody.innerHTML = html;
    });
  }

  async markNotificationRead(id) {
    if (this.getReadNotifIds().includes(id)) return;
    await this.persistReadNotifIds([id]);
    this.renderNotifications();
  }

  async markAllNotificationsRead() {
    const unreadIds = this.notifAlerts
      .map(a => a.id)
      .filter(id => !this.getReadNotifIds().includes(id));
    if (!unreadIds.length) return;
    await this.persistReadNotifIds(unreadIds);
    this.renderNotifications();
  }

  escapeNotifHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  escapeNotifAttr(value) {
    return this.escapeNotifHtml(value).replace(/`/g, '&#96;');
  }
}

