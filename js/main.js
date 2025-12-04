/**
 * Main Application Entry Point
 * Initializes all modules and sets up event listeners
 */

// === EVENT LISTENERS ===
document
  .getElementById("login-form")
  .addEventListener("submit", handleLogin);
document
  .getElementById("logout-button")
  .addEventListener("click", logout);
window.addEventListener("hashchange", router);

// Handle navigation dengan data-page attribute
document.addEventListener("click", (e) => {
  const navLink = e.target.closest("[data-page]");
  if (navLink) {
    e.preventDefault();
    const page = navLink.getAttribute("data-page");
    window.location.hash = page;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("login-screen");
  const appLayout = document.getElementById("app-layout");
  const managementLink = document.getElementById("management-link");
  const hamburgerButton = document.getElementById("hamburger-button");
  const closeSidebarButton = document.getElementById("close-sidebar-button");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  
  if (localStorage.getItem("authToken")) {
    loginScreen.style.display = "none";
    appLayout.classList.remove("hidden");
    if (localStorage.getItem("userRole") === "management") {
      managementLink.classList.remove("hidden");
      document
        .getElementById("website-gki-link")
        .classList.remove("hidden");
    }

    updateUserGreeting();
    router();
  }
  hamburgerButton.addEventListener("click", toggleSidebar);
  closeSidebarButton.addEventListener("click", toggleSidebar);
  sidebarOverlay.addEventListener("click", toggleSidebar);
  document
    .getElementById("user-modal-close")
    .addEventListener("click", closeUserModal);
  document
    .getElementById("user-modal-form")
    .addEventListener("submit", handleUserFormSubmit);
  document
    .getElementById("room-modal-close")
    .addEventListener("click", closeRoomModal);
  document
    .getElementById("room-modal-form")
    .addEventListener("submit", handleRoomFormSubmit);
});

// ============================================================
// Global Action Menu Helpers (shared three-dot menu)
// ============================================================

const globalActionMenuState = {
  menuEl: null,
  itemsEl: null,
};

function ensureGlobalActionMenuElements() {
  if (!globalActionMenuState.menuEl) {
    globalActionMenuState.menuEl = document.getElementById(
      "global-action-menu"
    );
  }
  if (!globalActionMenuState.itemsEl) {
    globalActionMenuState.itemsEl = document.getElementById(
      "global-action-menu-items"
    );
  }
}

function closeGlobalActionMenu() {
  ensureGlobalActionMenuElements();
  if (globalActionMenuState.menuEl) {
    globalActionMenuState.menuEl.classList.add("hidden");
  }
  if (globalActionMenuState.itemsEl) {
    globalActionMenuState.itemsEl.innerHTML = "";
  }
}

function openGlobalActionMenu({ triggerElement, items = [] }) {
  ensureGlobalActionMenuElements();
  if (!globalActionMenuState.menuEl || !globalActionMenuState.itemsEl) {
    return;
  }

  globalActionMenuState.itemsEl.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${item.className || ""}`;
    button.innerHTML = `${
      item.icon ? `<i class="${item.icon}"></i>` : ""
    } <span>${item.label}</span>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeGlobalActionMenu();
      if (typeof item.onClick === "function") {
        item.onClick();
      }
    });
    globalActionMenuState.itemsEl.appendChild(button);
  });

  if (items.length === 0) {
    closeGlobalActionMenu();
    return;
  }

  if (!triggerElement) {
    closeGlobalActionMenu();
    return;
  }

  const rect = triggerElement.getBoundingClientRect();
  globalActionMenuState.menuEl.style.left = `${
    rect.left + window.scrollX
  }px`;
  globalActionMenuState.menuEl.style.top = `${
    rect.bottom + window.scrollY + 4
  }px`;
  globalActionMenuState.menuEl.classList.remove("hidden");
}

window.openGlobalActionMenu = openGlobalActionMenu;
window.closeGlobalActionMenu = closeGlobalActionMenu;

document.addEventListener("click", (event) => {
  ensureGlobalActionMenuElements();
  if (
    !globalActionMenuState.menuEl ||
    globalActionMenuState.menuEl.classList.contains("hidden")
  ) {
    return;
  }

  const clickedMenu = event.target.closest("#global-action-menu");
  const clickedTrigger = event.target.closest(".action-menu-btn");

  if (!clickedMenu && !clickedTrigger) {
    closeGlobalActionMenu();
  }
});
